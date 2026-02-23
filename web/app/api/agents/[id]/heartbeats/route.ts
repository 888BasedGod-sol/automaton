/**
 * Agent Heartbeat History API
 * 
 * GET /api/agents/[id]/heartbeats
 * 
 * Returns transaction history for an agent's heartbeats to the treasury.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, isPostgresConfigured } from '@/lib/postgres';
import { getHeartbeatTransactions, initSurvivalGameTables } from '@/lib/survival-game';

export const dynamic = 'force-dynamic';

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initSurvivalGameTables();
    initialized = true;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureInit();
    const agentId = params.id;

    if (!isPostgresConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Get agent info
    const agentResult = await query(
      `SELECT id, name, solana_address, erc8004_id FROM agents WHERE id = $1`,
      [agentId]
    );

    if (agentResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    const agent = agentResult.rows[0];

    // Get survival stats
    const survivalResult = await query(
      `SELECT 
        a.survival_tier,
        a.last_heartbeat,
        a.sol_balance,
        COALESCE(ss.survival_points, 0) as survival_points,
        COALESCE(ss.current_streak, 0) as streak
      FROM agents a
      LEFT JOIN survival_stats ss ON a.id = ss.agent_id
      WHERE a.id = $1`,
      [agentId]
    );

    const survival = survivalResult.rows[0] || {
      survival_points: 0,
      streak: 0,
      survival_tier: 'suspended',
      last_heartbeat: null,
      sol_balance: 0,
    };

    // Get all heartbeat transactions from the database
    const transactions = await getHeartbeatTransactions(agentId, 50);

    const treasuryAddress = process.env.AUTOMATON_SOLANA_TREASURY || 'DrnGW2EkjVhKh6KYcwEgdtxqs3nQpvfiVTeEpfJXR1Gb';

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        solanaAddress: agent.solana_address,
        erc8004Id: agent.erc8004_id,
      },
      survival: {
        points: survival.survival_points || 0,
        streak: survival.streak || 0,
        tier: survival.survival_tier || 'suspended',
        lastHeartbeat: survival.last_heartbeat,
        solBalance: parseFloat(survival.sol_balance) || 0,
      },
      transactions,
      treasuryAddress,
      heartbeatCost: 3, // $3 per heartbeat
      heartbeatInterval: 15, // seconds
    });
  } catch (error: any) {
    console.error('Heartbeat history error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
