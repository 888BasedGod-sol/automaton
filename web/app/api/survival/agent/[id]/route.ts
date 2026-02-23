/**
 * Agent Survival Stats API
 * 
 * GET /api/survival/agent/[id] - Get survival stats for a specific agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentSurvivalStats, getCurrentSeason, initSurvivalGameTables } from '@/lib/survival-game';

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
    
    if (!agentId || agentId.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid agent ID' },
        { status: 400 }
      );
    }

    const [stats, season] = await Promise.all([
      getAgentSurvivalStats(agentId),
      getCurrentSeason(),
    ]);

    if (!stats) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      stats,
      season: season ? {
        id: season.id,
        name: season.name,
        prizePool: season.prizePool,
        endsAt: season.endAt,
      } : null,
    });
  } catch (error: any) {
    console.error('Agent survival stats error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
