/**
 * Survival Game Leaderboard API
 * 
 * GET /api/survival/leaderboard - Get the survival leaderboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard, getGameStats, getCurrentSeason, initSurvivalGameTables } from '@/lib/survival-game';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Initialize tables on first request (no-op if already exists)
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
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch leaderboard, stats, and current season in parallel
    const [leaderboard, stats, season] = await Promise.all([
      getLeaderboard(Math.min(limit, 500), offset),
      getGameStats(),
      getCurrentSeason(),
    ]);

    return NextResponse.json({
      success: true,
      leaderboard: leaderboard.entries,
      total: leaderboard.total,
      stats: {
        totalPlayers: stats.totalPlayers,
        totalPointsEarned: stats.totalPointsEarned,
        totalRewardsDistributed: stats.totalRewardsDistributed,
        topStreak: stats.topStreak,
      },
      season: season ? {
        id: season.id,
        name: season.name,
        prizePool: season.prizePool,
        endsAt: season.endAt,
        participants: season.totalParticipants,
      } : null,
    }, {
      headers: {
        'Cache-Control': 's-maxage=30, stale-while-revalidate=59',
      },
    });
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
