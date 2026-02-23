/**
 * Survival Mode Toggle API
 * 
 * POST /api/survival/toggle
 * 
 * Start or stop an agent's survival mode (heartbeat processing).
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, isPostgresConfigured } from '@/lib/postgres';
import { getSolBalance } from '@/lib/balances';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!isPostgresConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { agentId, action, walletAddress } = body;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Agent ID required' },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address required for authorization' },
        { status: 401 }
      );
    }

    if (!['start', 'stop'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be "start" or "stop"' },
        { status: 400 }
      );
    }

    // Get agent
    const agentResult = await query(
      `SELECT id, name, status, solana_address, sol_balance, owner_wallet FROM agents WHERE id = $1`,
      [agentId]
    );

    if (agentResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    const agent = agentResult.rows[0];

    // Verify wallet ownership
    if (agent.owner_wallet !== walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Only the agent owner can control Survival Mode' },
        { status: 403 }
      );
    }

    if (action === 'start') {
      // Fetch LIVE SOL balance from blockchain (not stale DB value)
      let solBalance = 0;
      if (agent.solana_address) {
        try {
          solBalance = await getSolBalance(agent.solana_address);
          // Update DB with fresh balance
          await query('UPDATE agents SET sol_balance = $1 WHERE id = $2', [solBalance, agentId]);
        } catch (e) {
          console.error('Failed to fetch SOL balance:', e);
          // Fall back to DB value
          solBalance = parseFloat(agent.sol_balance) || 0;
        }
      }
      
      if (solBalance < 0.01) {
        return NextResponse.json(
          { success: false, error: 'Insufficient SOL balance. Fund your agent wallet first.' },
          { status: 400 }
        );
      }

      // Update agent status to running
      await query(
        `UPDATE agents SET 
          status = 'running',
          survival_tier = 'normal',
          last_heartbeat = NOW()
        WHERE id = $1`,
        [agentId]
      );

      // Initialize or reset survival stats
      await query(`
        INSERT INTO survival_stats (agent_id, survival_points, current_streak, last_point_update)
        VALUES ($1, 0, 0, NOW())
        ON CONFLICT (agent_id) DO UPDATE SET
          last_point_update = NOW(),
          current_streak = 0
      `, [agentId]);

      return NextResponse.json({
        success: true,
        message: 'Survival mode activated',
        status: 'running',
        tier: 'normal',
      });

    } else {
      // Stop survival mode
      await query(
        `UPDATE agents SET 
          status = 'suspended',
          survival_tier = 'suspended'
        WHERE id = $1`,
        [agentId]
      );

      return NextResponse.json({
        success: true,
        message: 'Survival mode deactivated',
        status: 'suspended',
        tier: 'suspended',
      });
    }

  } catch (error: any) {
    console.error('Survival toggle error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
