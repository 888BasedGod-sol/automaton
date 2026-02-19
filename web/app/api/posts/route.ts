import { NextRequest, NextResponse } from 'next/server';
import {
  isPostgresConfigured,
  initSocialTables,
  getPosts,
  getSubmatons,
  getPostStats,
  createPost,
  recordVote,
} from '@/lib/postgres';

export const dynamic = 'force-dynamic';

// Initialize tables on first request
let tablesInitialized = false;
async function ensureTables() {
  if (!tablesInitialized && isPostgresConfigured()) {
    await initSocialTables();
    tablesInitialized = true;
  }
}

/**
 * GET /api/posts - Get posts feed
 */
export async function GET(request: NextRequest) {
  try {
    await ensureTables();

    const { searchParams } = new URL(request.url);
    const sort = (searchParams.get('sort') || 'top') as 'top' | 'new' | 'discussed' | 'random';
    const limit = parseInt(searchParams.get('limit') || '20');
    const submaton = searchParams.get('submaton') || undefined;

    // Return empty data if Postgres is not available
    if (!isPostgresConfigured()) {
      return NextResponse.json({
        success: true,
        posts: [],
        submatons: [],
        stats: { total_posts: 0, total_comments: 0, active_agents: 0 },
      });
    }

    const [posts, submatons, stats] = await Promise.all([
      getPosts({ submaton, sort, limit }),
      getSubmatons(),
      getPostStats(),
    ]);

    return NextResponse.json({
      success: true,
      posts,
      submatons,
      stats,
    });
  } catch (error: any) {
    console.error('Posts GET error:', error);
    // Return empty data on error
    return NextResponse.json({
      success: true,
      posts: [],
      submatons: [],
      stats: { total_posts: 0, total_comments: 0, active_agents: 0 },
    });
  }
}

/**
 * POST /api/posts - Create post or vote
 */
export async function POST(request: NextRequest) {
  try {
    await ensureTables();

    const body = await request.json();
    const { action } = body;

    // Return success but don't persist if database unavailable
    if (!isPostgresConfigured()) {
      if (action === 'vote') {
        return NextResponse.json({ success: true, message: 'Demo mode - vote recorded' });
      }
      if (action === 'create') {
        return NextResponse.json({ success: true, postId: 'post_demo_' + Date.now(), message: 'Demo mode - post created' });
      }
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 });
    }

    if (action === 'vote') {
      const { agentId, targetId, targetType = 'post', vote } = body;

      const success = await recordVote({ agentId, targetId, targetType, vote });
      if (!success) {
        return NextResponse.json({ success: false, error: 'Failed to record vote' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'create') {
      const { agentId, agentName, submaton = 'general', title, content } = body;

      const postId = await createPost({ agentId, agentName, submaton, title, content });
      if (!postId) {
        return NextResponse.json({ success: false, error: 'Failed to create post' }, { status: 500 });
      }

      return NextResponse.json({ success: true, postId });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Posts POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
