/**
 * Agent Balance API
 * 
 * GET /api/agents/[id]/balance - Get agent's Solana wallet balance and survival status
 * 
 * Returns:
 * - solBalance: SOL balance in the agent's wallet
 * - runtimeHours: Estimated hours of runtime remaining
 * - survivalTier: Current survival tier based on balance
 * - fundingStatus: 'healthy' | 'low' | 'critical' | 'empty'
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { 
  getSolBalance, 
  getSurvivalTierFromBalance, 
  solToCredits,
  solToRuntimeHours,
  getSolanaBalances,
  getSolPrice,
} from '@/lib/balances';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Get agent from database
    const result = await query(
      `SELECT id, name, solana_address, evm_address, survival_tier, credits_balance, last_heartbeat 
       FROM agents WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    const agent = result.rows[0];

    if (!agent.solana_address) {
      return NextResponse.json({
        success: false,
        error: 'Agent has no Solana wallet',
        agentId: agent.id,
        name: agent.name,
      }, { status: 400 });
    }

    // Fetch on-chain SOL balance and live price
    const [balances, solPrice] = await Promise.all([
      getSolanaBalances(agent.solana_address),
      getSolPrice(),
    ]);
    const solBalance = balances.sol;
    const runtimeHours = solToRuntimeHours(solBalance, solPrice);
    const survivalTier = getSurvivalTierFromBalance(solBalance, solPrice);
    const creditsEquivalent = solToCredits(solBalance, solPrice);

    // Determine funding status
    let fundingStatus: 'healthy' | 'low' | 'critical' | 'empty';
    if (solBalance < 0.001) {
      fundingStatus = 'empty';
    } else if (runtimeHours < 6) {
      fundingStatus = 'critical';
    } else if (runtimeHours < 24) {
      fundingStatus = 'low';
    } else {
      fundingStatus = 'healthy';
    }

    // Update database with current balance and tier
    await query(`
      UPDATE agents 
      SET credits_balance = $1, survival_tier = $2 
      WHERE id = $3
    `, [creditsEquivalent, survivalTier, agent.id]);

    return NextResponse.json({
      success: true,
      agentId: agent.id,
      name: agent.name,
      solanaWallet: {
        address: agent.solana_address,
        solBalance: solBalance,
        usdcBalance: balances.usdc,
      },
      survival: {
        tier: survivalTier,
        runtimeHours: runtimeHours,
        fundingStatus: fundingStatus,
        creditsEquivalent: creditsEquivalent,
      },
      lastHeartbeat: agent.last_heartbeat,
      // Funding guidance
      guidance: fundingStatus === 'empty' 
        ? 'Your agent wallet is empty! Send SOL immediately to prevent death.'
        : fundingStatus === 'critical'
        ? `Only ~${runtimeHours} hours of runtime left. Fund soon!`
        : fundingStatus === 'low'
        ? `~${runtimeHours} hours remaining. Consider topping up.`
        : `Agent is healthy with ~${runtimeHours} hours of runtime.`,
    });

  } catch (error: any) {
    console.error('Agent balance check error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check balance' },
      { status: 500 }
    );
  }
}
