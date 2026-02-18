import { NextRequest, NextResponse } from 'next/server';
import { 
  loadTreasuryConfig, 
  getTreasuryBalance, 
  fundAgentFromTreasury,
  getTreasuryPublicInfo 
} from '@/lib/treasury';
import { getDb, getCachedStmt } from '@/lib/db-singleton';

export const dynamic = 'force-dynamic';

/**
 * GET /api/treasury - Get treasury public info and balance
 */
export async function GET(request: NextRequest) {
  try {
    const info = getTreasuryPublicInfo();
    
    if (!info) {
      return NextResponse.json({
        success: false,
        error: 'Treasury not configured',
        configured: false,
      }, { status: 404 });
    }
    
    const balance = await getTreasuryBalance();
    
    return NextResponse.json({
      success: true,
      configured: true,
      treasury: {
        publicKey: info.publicKey,
        network: info.network,
        label: info.label,
        balance: balance ? {
          sol: balance.sol,
          lamports: balance.lamports,
        } : null,
      },
    });
  } catch (error: any) {
    console.error('Treasury GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get treasury info',
    }, { status: 500 });
  }
}

/**
 * POST /api/treasury - Fund an agent from treasury
 * 
 * Body: { action: 'fund', agentId: string, amountSol: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, agentId, amountSol } = body;
    
    if (action !== 'fund') {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use "fund".',
      }, { status: 400 });
    }
    
    if (!agentId || typeof amountSol !== 'number' || amountSol <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Missing agentId or invalid amountSol',
      }, { status: 400 });
    }
    
    // Limit funding amount
    const MAX_FUND_SOL = 1.0;
    if (amountSol > MAX_FUND_SOL) {
      return NextResponse.json({
        success: false,
        error: `Amount exceeds maximum of ${MAX_FUND_SOL} SOL`,
      }, { status: 400 });
    }
    
    // Get agent's Solana address
    const db = getDb();
    const agent = db.prepare('SELECT id, name, solana_address, status FROM agents WHERE id = ?').get(agentId) as any;
    
    if (!agent) {
      return NextResponse.json({
        success: false,
        error: 'Agent not found',
      }, { status: 404 });
    }
    
    if (!agent.solana_address) {
      return NextResponse.json({
        success: false,
        error: 'Agent has no Solana address',
      }, { status: 400 });
    }
    
    // Fund the agent
    const result = await fundAgentFromTreasury(agent.solana_address, amountSol);
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }
    
    // Update agent balance in database
    const updateStmt = db.prepare(`
      UPDATE agents 
      SET sol_balance = sol_balance + ?, 
          status = CASE WHEN status = 'pending_funding' THEN 'funded' ELSE status END,
          funded_at = CASE WHEN funded_at IS NULL THEN datetime('now') ELSE funded_at END
      WHERE id = ?
    `);
    updateStmt.run(amountSol, agentId);
    
    return NextResponse.json({
      success: true,
      funded: {
        agentId,
        agentName: agent.name,
        amountSol,
        signature: result.signature,
        solanaAddress: agent.solana_address,
      },
    });
  } catch (error: any) {
    console.error('Treasury POST error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fund agent',
    }, { status: 500 });
  }
}
