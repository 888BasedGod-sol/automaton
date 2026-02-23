/**
 * Survival Rewards API
 * 
 * GET /api/survival/rewards - Get pending rewards for a wallet
 * POST /api/survival/rewards - Claim pending rewards
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getPendingRewards, 
  markRewardClaimed,
  initSurvivalGameTables,
} from '@/lib/survival-game';

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

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet address required' },
        { status: 400 }
      );
    }

    const rewards = await getPendingRewards(wallet);

    const totalPending = rewards.reduce((sum, r) => sum + r.amount, 0);

    return NextResponse.json({
      success: true,
      rewards,
      totalPending,
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
    const { claimId, txHash, wallet } = body;

    if (!claimId || !txHash || !wallet) {
      return NextResponse.json(
        { success: false, error: 'claimId, txHash, and wallet required' },
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

    const success = await markRewardClaimed(claimId, txHash);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to process claim' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Reward claimed successfully',
      claimId,
      amount: claim.amount,
    });
  } catch (error: any) {
    console.error('Claim reward error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
