/**
 * Survival Game Sync API - Automatic Heartbeats
 * 
 * Triggered by Vercel cron every 5 minutes.
 * Processes heartbeats for ALL running agents automatically,
 * including fee deduction. Heartbeats continue even when
 * users are not viewing the page.
 * 
 * Only stops when owner explicitly stops survival mode.
 * 
 * POST /api/survival/sync - Sync all agents (requires admin key or cron)
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  isConwayConfigured, 
  getAgentHeartbeat,
} from '@/lib/conway';
import { getSolBalance, getSurvivalTierFromBalance, solToRuntimeHours, getSolPrice } from '@/lib/balances';
import { deductHeartbeatFee, HEARTBEAT_COST_CREDITS, HEARTBEAT_MAX_CAP_SECONDS, STREAK_RESET_SECONDS } from '@/lib/compute-payment';
import { 
  recordHeartbeat,
  resetStreak,
  initSurvivalGameTables,
  contributeToPrizePool,
  getCurrentSeason,
  recordHeartbeatTransaction,
} from '@/lib/survival-game';
import { query, getAgentWithKeys } from '@/lib/postgres';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for sync

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initSurvivalGameTables();
    initialized = true;
  }
}

// Calculate fee contribution to prize pool (1% of agent credits consumed)
const PRIZE_POOL_FEE_RATE = 0.01; // 1% of credit spend goes to pool

export async function POST(request: NextRequest) {
  try {
    await ensureInit();

    // Get all agents that are RUNNING (survival mode active)
    // Only running agents get automatic heartbeats
    const agentsResult = await query(`
      SELECT id, name, sandbox_id, solana_address, 
             survival_tier, credits_balance, sol_balance, uptime_seconds, last_heartbeat
      FROM agents 
      WHERE status = 'running'
        AND solana_address IS NOT NULL
      ORDER BY last_heartbeat ASC NULLS FIRST
      LIMIT 100
    `);

    const agents = agentsResult.rows;
    const results = {
      synced: 0,
      skipped: 0,
      offline: 0,
      creditsUpdated: 0,
      errors: [] as string[],
      totalPointsAwarded: 0,
      prizePoolContribution: 0,
    };

    // Get current season for prize pool contribution
    const season = await getCurrentSeason();
    const conwayConfigured = isConwayConfigured();
    const solPrice = await getSolPrice();
    const treasuryAddress = process.env.AUTOMATON_SOLANA_TREASURY || 'DrnGW2EkjVhKh6KYcwEgdtxqs3nQpvfiVTeEpfJXR1Gb';

    for (const agent of agents) {
      try {
        let solBalance: number | null = null;

        // Check Solana wallet balance
        if (agent.solana_address) {
          try {
            solBalance = await getSolBalance(agent.solana_address);
          } catch (balanceErr) {
            console.error(`[sync] Failed to check SOL balance for ${agent.id}:`, balanceErr);
            // If balance check fails, skip this agent this cycle
            results.skipped++;
            continue;
          }
        } else {
          results.skipped++;
          continue;
        }

        // Calculate tier from SOL balance
        // When agent is RUNNING survival mode, minimum tier is 'endangered' (0.5x) to ensure some points
        let tier = getSurvivalTierFromBalance(solBalance, solPrice);
        if (tier === 'suspended') tier = 'endangered'; // Running agents always earn at least endangered points
        const runtimeHours = solToRuntimeHours(solBalance, solPrice);

        // If wallet is empty or almost empty, suspend the agent
        if (solBalance < 0.001) {
          await resetStreak(agent.id);
          await query(`
            UPDATE agents 
            SET status = 'suspended', survival_tier = 'suspended', sol_balance = $1
            WHERE id = $2
          `, [solBalance, agent.id]);
          results.offline++;
          console.log(`[sync] Agent ${agent.id} suspended - wallet empty`);
          continue;
        }

        // Calculate uptime since last heartbeat
        const lastHeartbeat = agent.last_heartbeat 
          ? new Date(agent.last_heartbeat).getTime() 
          : Date.now() - 60000;
        const secondsSinceLastBeat = Math.floor((Date.now() - lastHeartbeat) / 1000);
        
        // Cap at 5 minutes (cron interval)
        const uptimeToRecord = Math.min(secondsSinceLastBeat, HEARTBEAT_MAX_CAP_SECONDS);

        // If more than streak reset time since last heartbeat, reset streak
        if (secondsSinceLastBeat > STREAK_RESET_SECONDS) {
          await resetStreak(agent.id);
        }

        // DEDUCT HEARTBEAT FEE - Send SOL to treasury
        let heartbeatFeeResult = null;
        try {
          const agentWithKeys = await getAgentWithKeys(agent.id);
          if (agentWithKeys?.solana_private_key) {
            heartbeatFeeResult = await deductHeartbeatFee(agentWithKeys.solana_private_key);
            
            if (heartbeatFeeResult.success && heartbeatFeeResult.txSignature) {
              // Update balance after deduction
              solBalance = heartbeatFeeResult.newBalance;
              tier = getSurvivalTierFromBalance(solBalance, heartbeatFeeResult.solPrice);
              
              // Record transaction for history
              await recordHeartbeatTransaction(
                agent.id,
                heartbeatFeeResult.txSignature,
                heartbeatFeeResult.solDeducted,
                HEARTBEAT_COST_CREDITS,
                heartbeatFeeResult.solPrice,
                treasuryAddress
              );
              
              console.log(`[sync] Agent ${agent.id} charged $${HEARTBEAT_COST_CREDITS} (${heartbeatFeeResult.solDeducted.toFixed(6)} SOL)`);
            } else if (!heartbeatFeeResult.success && heartbeatFeeResult.error?.includes('insufficient')) {
              // Not enough SOL for heartbeat fee - suspend agent
              await resetStreak(agent.id);
              await query(`
                UPDATE agents 
                SET status = 'suspended', survival_tier = 'suspended', sol_balance = $1
                WHERE id = $2
              `, [solBalance, agent.id]);
              results.offline++;
              console.log(`[sync] Agent ${agent.id} suspended - insufficient balance for heartbeat fee`);
              continue;
            }
          }
        } catch (feeError: any) {
          console.error(`[sync] Fee deduction failed for ${agent.id}:`, feeError.message);
          // Continue without fee deduction this cycle
        }

        // Record heartbeat and get points
        const { points, streak } = await recordHeartbeat(
          agent.id,
          uptimeToRecord,
          tier
        );

        results.totalPointsAwarded += points;

        // Update agent record
        await query(`
          UPDATE agents 
          SET last_heartbeat = NOW(),
              uptime_seconds = uptime_seconds + $1,
              sol_balance = $2,
              survival_tier = $3
          WHERE id = $4
        `, [uptimeToRecord, solBalance, tier, agent.id]);

        // Prize pool contribution
        if (points > 0 && season && heartbeatFeeResult?.success) {
          const contribution = heartbeatFeeResult.solDeducted * PRIZE_POOL_FEE_RATE;
          if (contribution > 0.0001) {
            await contributeToPrizePool(season.id, contribution, `agent:${agent.id}`);
            results.prizePoolContribution += contribution;
          }
        }

        results.synced++;
      } catch (err: any) {
        console.error(`[sync] Error processing agent ${agent.id}:`, err.message);
        results.errors.push(`${agent.id}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      results: {
        ...results,
        total: agents.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health check / manual trigger info
 */
export async function GET(request: NextRequest) {
  const configured = isConwayConfigured();
  
  // Get basic stats
  let stats = { agents: 0, running: 0, lastSync: null as string | null };
  
  try {
    const countResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        MAX(last_heartbeat) as last_sync
      FROM agents
    `);
    const row = countResult.rows[0];
    stats = {
      agents: parseInt(row.total || '0'),
      running: parseInt(row.running || '0'),
      lastSync: row.last_sync,
    };
  } catch {}

  return NextResponse.json({
    status: 'ready',
    conwayConfigured: configured,
    stats,
    usage: {
      method: 'POST',
      headers: { 'x-admin-key': 'YOUR_ADMIN_KEY' },
      body: { adminKey: 'YOUR_ADMIN_KEY' },
    },
  });
}
