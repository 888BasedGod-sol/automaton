/**
 * Agent Heartbeat Recording API
 * 
 * POST /api/survival/heartbeat - Record an agent heartbeat and earn points
 * 
 * Body options:
 * - agentId, evmAddress, or solanaAddress to identify the agent
 * - tier (optional): Override survival tier
 * - syncFromConway (optional): Pull live data from Conway sandbox
 * - checkSolanaBalance (optional): Check agent's Solana wallet balance for funding
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  recordHeartbeat,
  resetStreak,
  initSurvivalGameTables,
  recordHeartbeatTransaction,
} from '@/lib/survival-game';
import { query } from '@/lib/postgres';
import { isConwayConfigured, getAgentHeartbeat } from '@/lib/conway';
import { 
  getSolBalance, 
  getSurvivalTierFromBalance, 
  solToCredits,
  solToRuntimeHours,
  getSolPrice,
} from '@/lib/balances';
import { deductHeartbeatFee, HEARTBEAT_MAX_CAP_SECONDS, STREAK_RESET_SECONDS, HEARTBEAT_COST_CREDITS } from '@/lib/compute-payment';
import { getAgentWithKeys } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initSurvivalGameTables();
    initialized = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureInit();

    const body = await request.json();
    const { agentId, sandboxId, evmAddress, solanaAddress, tier, syncFromConway, checkSolanaBalance = true } = body;

    // Find agent by ID or address
    let agent = null;
    
    if (agentId) {
      const result = await query(
        `SELECT id, sandbox_id, survival_tier, uptime_seconds, last_heartbeat, credits_balance, solana_address FROM agents WHERE id = $1`,
        [agentId]
      );
      agent = result.rows[0];
    } else if (evmAddress) {
      const result = await query(
        `SELECT id, sandbox_id, survival_tier, uptime_seconds, last_heartbeat, credits_balance, solana_address FROM agents WHERE LOWER(evm_address) = LOWER($1)`,
        [evmAddress]
      );
      agent = result.rows[0];
    } else if (solanaAddress) {
      const result = await query(
        `SELECT id, sandbox_id, survival_tier, uptime_seconds, last_heartbeat, credits_balance, solana_address FROM agents WHERE solana_address = $1`,
        [solanaAddress]
      );
      agent = result.rows[0];
    }

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // RATE LIMITING: Minimum 15 seconds between heartbeats (prevents duplicate tabs/spam)
    const MIN_HEARTBEAT_INTERVAL_MS = 15000;
    if (agent.last_heartbeat) {
      const lastBeatTime = new Date(agent.last_heartbeat).getTime();
      const timeSinceLastBeat = Date.now() - lastBeatTime;
      if (timeSinceLastBeat < MIN_HEARTBEAT_INTERVAL_MS) {
        return NextResponse.json({
          success: true,
          agentId: agent.id,
          skipped: true,
          message: 'Heartbeat too recent, skipped',
          waitMs: MIN_HEARTBEAT_INTERVAL_MS - timeSinceLastBeat,
        });
      }
    }

    let uptimeToRecord: number;
    let agentTier: string = agent.survival_tier || 'normal';
    let solBalance: number | null = null;
    let runtimeHours: number | null = null;
    let conwayData: any = null;

    // PRIORITY 1: Check agent's Solana wallet balance for funding
    if (checkSolanaBalance && agent.solana_address) {
      try {
        // Fetch live SOL price for conversions
        const solPrice = await getSolPrice();
        
        solBalance = await getSolBalance(agent.solana_address);
        runtimeHours = solToRuntimeHours(solBalance, solPrice);
        agentTier = getSurvivalTierFromBalance(solBalance, solPrice);
        
        // Running agents always earn at least endangered points (0.5x multiplier)
        if (agentTier === 'suspended') agentTier = 'endangered';
        
        // Update credits_balance in DB (SOL converted to USDC at live price)
        const creditsFromSol = solToCredits(solBalance, solPrice);
        await query(`
          UPDATE agents SET credits_balance = $1, survival_tier = $2 WHERE id = $3
        `, [creditsFromSol, agentTier, agent.id]);
        
        // If wallet is empty, agent is suspended
        if (solBalance < 0.001) {
          agentTier = 'suspended';
          // Reset streak and stop survival mode on suspension
          await resetStreak(agent.id);
          await query(`
            UPDATE agents SET status = 'suspended', survival_tier = 'suspended' WHERE id = $1
          `, [agent.id]);
          return NextResponse.json({
            success: false,
            error: 'Agent wallet is empty. Send SOL to keep agent alive.',
            agentId: agent.id,
            solanaAddress: agent.solana_address,
            solBalance: solBalance,
            runtimeHours: 0,
            tier: 'suspended',
            walletEmpty: true,
          });
        }
      } catch (balanceError) {
        console.error('Failed to check Solana balance:', balanceError);
        // Fall back to existing data
        agentTier = tier || agent.survival_tier || 'normal';
      }
    }

    // If syncFromConway is requested and agent has a sandbox, pull live data
    // NOTE: SOL balance determines survival tier. Conway provides uptime data only.
    const agentSandboxId = sandboxId || agent.sandbox_id;
    if (syncFromConway && agentSandboxId && isConwayConfigured()) {
      const heartbeat = await getAgentHeartbeat(agentSandboxId);
      
      if (heartbeat) {
        conwayData = heartbeat;
        
        // Use Conway's reported uptime
        uptimeToRecord = Math.min(heartbeat.uptimeSeconds, HEARTBEAT_MAX_CAP_SECONDS);
        
        // Only use Conway tier if we didn't get SOL balance
        if (solBalance === null) {
          const creditsCents = heartbeat.creditsCents || 0;
          if (creditsCents >= 10000) agentTier = 'thriving';
          else if (creditsCents >= 1000) agentTier = 'normal';
          else if (creditsCents >= 100) agentTier = 'endangered';
          else {
            agentTier = 'suspended';
            // Stop survival mode when suspended
            await resetStreak(agent.id);
            await query(`
              UPDATE agents SET status = 'suspended', survival_tier = 'suspended', credits_balance = $1 WHERE id = $2
            `, [creditsCents / 100, agent.id]);
          }

          // Update agent's credits from Conway (if not suspended)
          if (agentTier !== 'suspended') {
            await query(`
              UPDATE agents SET credits_balance = $1 WHERE id = $2
            `, [creditsCents / 100, agent.id]);
          }
        }
      } else {
        // Sandbox offline - reset streak
        await resetStreak(agent.id);
        return NextResponse.json({
          success: false,
          error: 'Sandbox not responding',
          agentId: agent.id,
          offline: true,
        });
      }
    } else {
      // Calculate from last heartbeat timestamp
      const lastHeartbeat = agent.last_heartbeat 
        ? new Date(agent.last_heartbeat).getTime() 
        : Date.now() - 60000;
      const secondsSinceLastBeat = Math.floor((Date.now() - lastHeartbeat) / 1000);

      // Cap at 1 minute for rapid heartbeat system
      uptimeToRecord = Math.min(secondsSinceLastBeat, HEARTBEAT_MAX_CAP_SECONDS);

      // If more than 3 minutes since last heartbeat, reset streak
      if (secondsSinceLastBeat > STREAK_RESET_SECONDS) {
        await resetStreak(agent.id);
      }

      // Use provided tier override if no SOL balance check was performed
      if (tier && solBalance === null) {
        agentTier = tier;
      }
    }

    // Record the heartbeat
    const { points, streak } = await recordHeartbeat(
      agent.id,
      uptimeToRecord,
      agentTier
    );

    // DEDUCT SOL FOR RUNTIME - Send to treasury for buybacks
    // Flat fee: $0.50 per heartbeat
    let heartbeatFeeResult = null;
    let feeDeductionDebug = { hasAddress: false, hasPrivateKey: false, reason: '' };
    if (agent.solana_address) {
      feeDeductionDebug.hasAddress = true;
      try {
        // Get agent's private key to sign transaction
        const agentWithKeys = await getAgentWithKeys(agent.id);
        if (agentWithKeys?.solana_private_key) {
          feeDeductionDebug.hasPrivateKey = true;
          heartbeatFeeResult = await deductHeartbeatFee(
            agentWithKeys.solana_private_key
          );
          
          if (heartbeatFeeResult.success && heartbeatFeeResult.txSignature) {
            // Update SOL balance after deduction
            solBalance = heartbeatFeeResult.newBalance;
            // Recalculate tier based on new balance
            const solPrice = heartbeatFeeResult.solPrice;
            agentTier = getSurvivalTierFromBalance(solBalance, solPrice);
            runtimeHours = solToRuntimeHours(solBalance, solPrice);
            
            // Record transaction in database for history
            const treasuryAddress = process.env.AUTOMATON_SOLANA_TREASURY || 'DrnGW2EkjVhKh6KYcwEgdtxqs3nQpvfiVTeEpfJXR1Gb';
            await recordHeartbeatTransaction(
              agent.id,
              heartbeatFeeResult.txSignature,
              heartbeatFeeResult.solDeducted,
              HEARTBEAT_COST_CREDITS,
              solPrice,
              treasuryAddress
            );
            
            console.log(`[heartbeat] Agent ${agent.id} charged $${HEARTBEAT_COST_CREDITS} (${heartbeatFeeResult.solDeducted.toFixed(6)} SOL)`);
          } else {
            feeDeductionDebug.reason = `Transaction failed: ${heartbeatFeeResult?.error || 'unknown'}`;
          }
        } else {
          feeDeductionDebug.reason = 'No solana_private_key stored for this agent';
          console.log(`[heartbeat] Agent ${agent.id} has no solana_private_key, skipping fee deduction`);
        }
      } catch (feeError: any) {
        feeDeductionDebug.reason = `Exception: ${feeError.message}`;
        console.error('[heartbeat] Fee deduction failed:', feeError.message);
        // Continue with heartbeat even if fee fails
      }
    } else {
      feeDeductionDebug.reason = 'No solana_address on agent';
    }

    // Update agent's last heartbeat and uptime
    await query(`
      UPDATE agents 
      SET last_heartbeat = NOW(), 
          uptime_seconds = uptime_seconds + $1,
          survival_tier = $3
      WHERE id = $2
    `, [uptimeToRecord, agent.id, agentTier]);

    return NextResponse.json({
      success: true,
      agentId: agent.id,
      pointsEarned: points,
      currentStreak: streak,
      uptimeRecorded: uptimeToRecord,
      tier: agentTier,
      // Solana wallet balance info
      ...(solBalance !== null && {
        solanaWallet: {
          address: agent.solana_address,
          balance: solBalance,
          runtimeHours: runtimeHours,
          fundingStatus: agentTier === 'thriving' ? 'healthy' : agentTier === 'endangered' ? 'low' : 'critical',
        }
      }),
      ...(heartbeatFeeResult && heartbeatFeeResult.success && {
        feeDeducted: {
          solAmount: heartbeatFeeResult.solDeducted,
          creditsCharged: heartbeatFeeResult.creditsCharged,
          txSignature: heartbeatFeeResult.txSignature,
          sentToTreasury: true,
        }
      }),
      // Debug info for fee deduction (temporary)
      ...(!heartbeatFeeResult?.success && { feeDeductionDebug }),
      ...(conwayData && { conway: { creditsCents: conwayData.creditsCents, sandboxStatus: conwayData.status } }),
    });
  } catch (error: any) {
    console.error('Heartbeat recording error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
