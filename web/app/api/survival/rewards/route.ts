/**
 * Survival Rewards API
 * 
 * GET /api/survival/rewards - Get rewards for a wallet (filter by status)
 * POST /api/survival/rewards - Claim pending rewards
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getPendingRewards,
  getRewardsForWallet,
  markRewardClaimed,
  initSurvivalGameTables,
} from '@/lib/survival-game';
import { sendRewardFromTreasury } from '@/lib/treasury';
import { query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initSurvivalGameTables();
    initialized = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureInit();

    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const status = searchParams.get('status');

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet address required' },
        { status: 400 }
      );
    }

    const normalizedStatus = status === 'pending' || status === 'processing' || status === 'completed' || status === 'failed'
      ? status
      : null;

    const rewards = normalizedStatus
      ? await getRewardsForWallet(wallet, normalizedStatus)
      : await getPendingRewards(wallet);

    const totalAmount = rewards.reduce((sum, r) => sum + r.amount, 0);
    const totalPending = normalizedStatus === 'pending' || normalizedStatus === null ? totalAmount : 0;
    const totalPaidOut = normalizedStatus === 'completed' ? totalAmount : 0;

    return NextResponse.json({
      success: true,
      rewards,
      status: normalizedStatus ?? 'pending',
      totalAmount,
      totalPending,
      totalPaidOut,
      count: rewards.length,
    });
  } catch (error: any) {
    console.error('Get rewards error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureInit();

    const body = await request.json();
    const { claimId, wallet } = body;

    if (!claimId || !wallet) {
      return NextResponse.json(
        { success: false, error: 'claimId and wallet required' },
        { status: 400 }
      );
    }

    // Verify the claim belongs to this wallet
    const pendingRewards = await getPendingRewards(wallet);
    const claim = pendingRewards.find(r => r.id === claimId);

    if (!claim) {
      return NextResponse.json(
        { success: false, error: 'Claim not found or already processed' },
        { status: 404 }
      );
    }

    // Get agent's Solana address for payout
    const agentResult = await query(
      `SELECT solana_address FROM agents WHERE id = $1`,
      [claim.agentId]
    );

    if (agentResult.rows.length === 0 || !agentResult.rows[0].solana_address) {
      return NextResponse.json(
        { success: false, error: 'Agent Solana address not found' },
        { status: 404 }
      );
    }

    const agentSolanaAddress = agentResult.rows[0].solana_address;

    // Send SOL from treasury to agent's wallet
    const payoutResult = await sendRewardFromTreasury(
      agentSolanaAddress,
      claim.amount,
      `Reward for Rank #${claim.rank}`
    );

    if (!payoutResult.success) {
      return NextResponse.json(
        { success: false, error: payoutResult.error || 'Payout failed' },
        { status: 500 }
      );
    }

    // Mark reward as claimed with transaction hash
    const success = await markRewardClaimed(claimId, payoutResult.signature!);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to record claim' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Reward claimed successfully',
      claimId,
      amount: claim.amount,
      txSignature: payoutResult.signature,
      recipient: agentSolanaAddress,
    });
  } catch (error: any) {
    console.error('Claim reward error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
