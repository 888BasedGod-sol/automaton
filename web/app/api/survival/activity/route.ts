/**
 * Agent Activity Feed API
 * 
 * GET /api/survival/activity
 * 
 * Returns recent heartbeats and treasury transactions for live visualization.
 * Supports filtering by agentId for individual agent views.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, isPostgresConfigured } from '@/lib/postgres';
import { initSurvivalGameTables } from '@/lib/survival-game';

export const dynamic = 'force-dynamic';

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initSurvivalGameTables();
    initialized = true;
  }
}

interface HeartbeatActivity {
  type: 'heartbeat';
  agentId: string;
  agentName: string;
  timestamp: string;
  tier: string;
  points: number;
  streak: number;
  solDeducted: number;
  txSignature: string | null;
  treasuryAddress: string;
}

export async function GET(request: NextRequest) {
  try {
    await ensureInit();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const since = searchParams.get('since'); // ISO timestamp for polling

    if (!isPostgresConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Get treasury address from env
    const treasuryAddress = process.env.AUTOMATON_SOLANA_TREASURY || 'DrnGW2EkjVhKh6KYcwEgdtxqs3nQpvfiVTeEpfJXR1Gb';

    // Build query for recent activity (using agents table + survival_stats + heartbeat_transactions)
    let activityQuery = `
      SELECT 
        a.id as agent_id,
        a.name as agent_name,
        COALESCE(ss.survival_points, 0) as survival_points,
        COALESCE(ss.current_streak, 0) as streak,
        a.survival_tier,
        a.last_heartbeat,
        ht.tx_signature as last_payment_tx,
        a.sol_balance,
        a.solana_address
      FROM agents a
      LEFT JOIN survival_stats ss ON a.id = ss.agent_id
      LEFT JOIN LATERAL (
        SELECT tx_signature FROM heartbeat_transactions 
        WHERE agent_id = a.id 
        ORDER BY created_at DESC LIMIT 1
      ) ht ON true
      WHERE a.last_heartbeat IS NOT NULL
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (agentId) {
      activityQuery += ` AND a.id = $${paramIndex}`;
      params.push(agentId);
      paramIndex++;
    }

    if (since) {
      activityQuery += ` AND a.last_heartbeat > $${paramIndex}`;
      params.push(since);
      paramIndex++;
    }

    activityQuery += ` ORDER BY a.last_heartbeat DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await query(activityQuery, params);

    // Transform to activity feed format
    const activities: HeartbeatActivity[] = result.rows.map((row: any) => ({
      type: 'heartbeat',
      agentId: row.agent_id,
      agentName: row.agent_name || 'Unknown Agent',
      timestamp: row.last_heartbeat,
      tier: row.survival_tier || 'normal',
      points: row.survival_points || 0,
      streak: row.streak || 0,
      solDeducted: 3 / 170, // $3 at ~$170 SOL - approximation for display
      txSignature: row.last_payment_tx,
      treasuryAddress,
    }));

    // Get global stats
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_agents,
        COALESCE(SUM(ss.survival_points), 0) as total_points,
        COALESCE(MAX(ss.current_streak), 0) as top_streak,
        COUNT(CASE WHEN a.survival_tier = 'thriving' THEN 1 END) as thriving,
        COUNT(CASE WHEN a.survival_tier = 'normal' THEN 1 END) as normal,
        COUNT(CASE WHEN a.survival_tier = 'endangered' THEN 1 END) as endangered,
        COUNT(CASE WHEN a.survival_tier = 'suspended' THEN 1 END) as suspended
      FROM agents a
      LEFT JOIN survival_stats ss ON a.id = ss.agent_id
      WHERE a.last_heartbeat IS NOT NULL
    `);

    const stats = statsResult.rows[0] || {};

    return NextResponse.json({
      success: true,
      activities,
      stats: {
        totalAgents: parseInt(stats.total_agents) || 0,
        totalPoints: parseInt(stats.total_points) || 0,
        topStreak: parseInt(stats.top_streak) || 0,
        tierCounts: {
          thriving: parseInt(stats.thriving) || 0,
          normal: parseInt(stats.normal) || 0,
          endangered: parseInt(stats.endangered) || 0,
          suspended: parseInt(stats.suspended) || 0,
        },
      },
      treasuryAddress,
      heartbeatCost: 3, // $3 per heartbeat
      heartbeatInterval: 15, // seconds
    });
  } catch (error: any) {
    console.error('Activity feed error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
