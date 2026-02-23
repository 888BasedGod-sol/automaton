/**
 * Survival Season API
 * 
 * GET /api/survival/season - Get current and upcoming seasons
 * POST /api/survival/season - Admin: create a new season
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getCurrentSeason, 
  createSeason,
  contributeToPrizePool,
  distributeSeasonRewards,
  checkAndRotateSeasons,
  initSurvivalGameTables,
} from '@/lib/survival-game';
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

    const current = await getCurrentSeason();

    // Also get upcoming and past seasons
    const upcomingResult = await query(`
      SELECT * FROM survival_seasons 
      WHERE status = 'upcoming' AND start_at > NOW()
      ORDER BY start_at ASC
      LIMIT 5
    `);

    const pastResult = await query(`
      SELECT * FROM survival_seasons 
      WHERE status = 'completed'
      ORDER BY end_at DESC
      LIMIT 10
    `);

    return NextResponse.json({
      success: true,
      current,
      upcoming: upcomingResult.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        startsAt: r.start_at,
        endsAt: r.end_at,
        prizePool: parseFloat(r.prize_pool),
      })),
      past: pastResult.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        endedAt: r.end_at,
        prizePool: parseFloat(r.prize_pool),
        participants: r.total_participants,
      })),
    });
  } catch (error: any) {
    console.error('Season error:', error);
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
    const { action, adminKey } = body;

    // Simple admin key check (in production, use proper auth)
    const expectedKey = process.env.SURVIVAL_ADMIN_KEY || 'automaton-survival-admin';
    if (adminKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (action === 'create') {
      const { name, startAt, endAt, prizePool } = body;
      
      if (!name || !startAt || !endAt) {
        return NextResponse.json(
          { success: false, error: 'name, startAt, and endAt required' },
          { status: 400 }
        );
      }

      const season = await createSeason(
        name,
        new Date(startAt),
        new Date(endAt),
        prizePool || 0
      );

      return NextResponse.json({ success: true, season });
    }

    if (action === 'contribute') {
      const { seasonId, amount, source, txHash } = body;
      
      if (!seasonId || !amount || !source) {
        return NextResponse.json(
          { success: false, error: 'seasonId, amount, and source required' },
          { status: 400 }
        );
      }

      const success = await contributeToPrizePool(seasonId, amount, source, txHash);
      return NextResponse.json({ success });
    }

    if (action === 'distribute') {
      const { seasonId } = body;
      
      if (!seasonId) {
        return NextResponse.json(
          { success: false, error: 'seasonId required' },
          { status: 400 }
        );
      }

      const success = await distributeSeasonRewards(seasonId);
      return NextResponse.json({ success });
    }

    if (action === 'activate') {
      const { seasonId } = body;
      
      if (!seasonId) {
        return NextResponse.json(
          { success: false, error: 'seasonId required' },
          { status: 400 }
        );
      }

      await query(
        `UPDATE survival_seasons SET status = 'active' WHERE id = $1`,
        [seasonId]
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'force-rotate') {
      // Force end current season and start a new one
      // First, expire the current season by setting end_at to now
      await query(`
        UPDATE survival_seasons 
        SET end_at = NOW() - INTERVAL '1 minute'
        WHERE status = 'active'
      `);
      
      // Now run rotation
      const result = await checkAndRotateSeasons();
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Season admin error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
