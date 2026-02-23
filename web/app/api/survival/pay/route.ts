/**
 * Agent Compute Payment API - Conway Model
 * 
 * POST /api/survival/pay
 * 
 * Allows agents to pay for their compute by sending SOL to the treasury.
 * SOL is converted to internal credits at live market rate.
 * 1 credit = 1 Base USDC
 * 
 * Survival tier is based on credits_balance (Conway model).
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  payForCompute, 
  estimateComputePayment, 
  getTreasuryAddress, 
  getSurvivalTierFromCredits 
} from '@/lib/compute-payment';
import { getAgentWithKeys, updateAgentSurvival, updateAgentCredits, isPostgresConfigured } from '@/lib/postgres';
import { getSolBalance } from '@/lib/balances';

export const dynamic = 'force-dynamic';

interface PayComputeRequest {
  agentId: string;
  hours?: number; // Hours to pay for (default: 1)
  payAll?: boolean; // Pay all available balance
  dryRun?: boolean; // Just estimate, don't execute
}

/**
 * POST /api/survival/pay
 * 
 * Agent pays for compute by sending SOL to treasury
 */
export async function POST(request: NextRequest) {
  try {
    const body: PayComputeRequest = await request.json();
    const { agentId, hours = 1, payAll = false, dryRun = false } = body;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Missing agentId' },
        { status: 400 }
      );
    }

    if (!isPostgresConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Get agent with private keys
    const agent = await getAgentWithKeys(agentId);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (!agent.solana_address || !agent.solana_private_key) {
      return NextResponse.json(
        { success: false, error: 'Agent has no Solana wallet' },
        { status: 400 }
      );
    }

    // Dry run - just return estimate
    if (dryRun) {
      const estimate = await estimateComputePayment(agent.solana_address, { hours, payAll });
      return NextResponse.json({
        success: true,
        dryRun: true,
        estimate: {
          currentBalance: estimate.currentBalance,
          estimatedCost: estimate.estimatedCost,
          hoursWouldPurchase: estimate.hoursWouldPurchase,
          balanceAfter: estimate.balanceAfter,
          canAfford: estimate.canAfford,
          treasuryAddress: getTreasuryAddress(),
        }
      });
    }

    // Execute the payment
    const result = await payForCompute(agent.solana_private_key, { hours, payAll });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Conway Model: Credit the agent's internal balance
    const creditsAdded = result.creditsAdded;
    const newWalletBalance = result.newBalance || 0;
    
    // Add credits to agent's balance
    await updateAgentCredits(agentId, creditsAdded);
    
    // Get updated total credits balance
    const updatedAgent = await getAgentWithKeys(agentId);
    const newCreditsBalance = (updatedAgent?.credits_balance || 0) + creditsAdded;
    
    // Survival tier based on CREDITS (Conway model), not SOL balance
    const newTier = getSurvivalTierFromCredits(newCreditsBalance);
    const newRuntimeHours = Math.floor(newCreditsBalance / 50); // 50 cents/hour

    // Log the payment
    console.log(`[pay-compute] Agent ${agentId} paid ${result.amountPaid.toFixed(6)} SOL | +${creditsAdded} credits | Total: ${newCreditsBalance} credits | Tier: ${newTier}`);

    // Update agent status in DB
    await updateAgentSurvival(agentId, {
      survival_tier: newTier,
      sol_balance: newWalletBalance,
      last_payment_tx: result.txSignature,
    });

    return NextResponse.json({
      success: true,
      payment: {
        txSignature: result.txSignature,
        amountPaid: result.amountPaid,
        creditsAdded,
        treasuryAddress: getTreasuryAddress(),
      },
      credits: {
        added: creditsAdded,
        totalBalance: newCreditsBalance,
        survivalTier: newTier,
        runtimeHoursRemaining: newRuntimeHours,
      },
      wallet: {
        address: agent.solana_address,
        newBalance: newWalletBalance,
      },
      message: `Paid ${result.amountPaid.toFixed(6)} SOL → +${creditsAdded} credits (${newTier} tier)`
    });

  } catch (error: any) {
    console.error('[pay-compute] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Payment failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/survival/pay?agentId=xxx
 * 
 * Get payment estimate and current credits status (Conway model)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const hours = parseInt(searchParams.get('hours') || '1');

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Missing agentId parameter' },
        { status: 400 }
      );
    }

    if (!isPostgresConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 500 }
      );
    }

    const agent = await getAgentWithKeys(agentId);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (!agent.solana_address) {
      return NextResponse.json(
        { success: false, error: 'Agent has no Solana wallet' },
        { status: 400 }
      );
    }

    // Get current SOL balance for payment estimation
    const currentSolBalance = await getSolBalance(agent.solana_address);
    const estimate = await estimateComputePayment(agent.solana_address, { hours });
    
    // Credits-based status (Conway model)
    const creditsBalance = agent.credits_balance || 0;
    const currentTier = getSurvivalTierFromCredits(creditsBalance);
    const runtimeHours = Math.floor(creditsBalance / 50); // 50 cents/hour

    return NextResponse.json({
      success: true,
      agentId,
      credits: {
        balance: creditsBalance,
        survivalTier: currentTier,
        runtimeHoursRemaining: runtimeHours,
      },
      wallet: {
        address: agent.solana_address,
        solBalance: currentSolBalance,
      },
      paymentEstimate: {
        hours,
        costInSol: estimate.estimatedCost,
        creditsWouldAdd: estimate.creditsWouldAdd,
        canAfford: estimate.canAfford,
        solBalanceAfter: estimate.balanceAfter,
        solPrice: estimate.solPrice,
      },
      treasury: {
        address: getTreasuryAddress(),
      }
    });

  } catch (error: any) {
    console.error('[pay-compute] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get payment info' },
      { status: 500 }
    );
  }
}
