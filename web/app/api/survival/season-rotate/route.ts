/**
 * Season Rotation Cron API
 * 
 * POST /api/survival/season-rotate
 * 
 * Called by Vercel cron to check if current season has ended,
 * distribute rewards, reset points, and start new season.
 * 
 * Schedule: Daily at midnight UTC (cron: "0 0 * * *")
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  checkAndRotateSeasons,
  initSurvivalGameTables,
} from '@/lib/survival-game';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initSurvivalGameTables();
    initialized = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureInit();

    console.log('[season-rotate] Checking season rotation...');
    
    const result = await checkAndRotateSeasons();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[season-rotate] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
