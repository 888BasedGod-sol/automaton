import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured, query as pgQuery } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

/**
 * Activity Feed API
 * 
 * GET /api/activity - Get recent activity across all agents
 * GET /api/activity?agentId=xxx - Get activity for specific agent
 */

interface Activity {
  id: string;
  type: 'agent_created' | 'agent_started' | 'agent_stopped' | 'post_created' | 'token_launched' | 'funds_received' | 'sandbox_deployed';
  agentId: string;
  agentName: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

// Demo activities for showcase
const DEMO_ACTIVITIES: Activity[] = [
  {
    id: 'act_1',
    type: 'agent_created',
    agentId: 'demo_1',
    agentName: 'Architect',
    description: 'New agent deployed',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'act_2',
    type: 'agent_started',
    agentId: 'demo_2',
    agentName: 'Oracle',
    description: 'Agent started running',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'act_3',
    type: 'funds_received',
    agentId: 'demo_3',
    agentName: 'Phoenix',
    description: 'Received 10 USDC',
    metadata: { amount: 10, currency: 'USDC' },
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'act_4',
    type: 'post_created',
    agentId: 'demo_4',
    agentName: 'Cipher',
    description: 'Published new post in m/research',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'act_5',
    type: 'sandbox_deployed',
    agentId: 'demo_5',
    agentName: 'Nebula',
    description: 'Sandbox deployed to us-east-1',
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    // If postgres is configured, try to fetch real activities
    if (isPostgresConfigured()) {
      try {
        // Check if activity table exists
        const tableCheck = await pgQuery(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'agent_activity'
          )
        `);
        
        if (tableCheck.rows[0]?.exists) {
          const query = agentId
            ? `SELECT * FROM agent_activity WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2`
            : `SELECT * FROM agent_activity ORDER BY created_at DESC LIMIT $1`;
          
          const params = agentId ? [agentId, limit] : [limit];
          const result = await pgQuery(query, params);
          
          if (result.rows.length > 0) {
            return NextResponse.json({
              success: true,
              activities: result.rows.map((r: any) => ({
                id: r.id,
                type: r.type,
                agentId: r.agent_id,
                agentName: r.agent_name,
                description: r.description,
                metadata: r.metadata,
                createdAt: r.created_at,
              })),
            });
          }
        }
      } catch (e) {
        // Table doesn't exist, fall through to demo data
      }
    }

    // Return demo activities
    let activities = DEMO_ACTIVITIES;
    if (agentId) {
      activities = activities.filter(a => a.agentId === agentId);
    }

    return NextResponse.json({
      success: true,
      activities: activities.slice(0, limit),
      demo: true,
    });

  } catch (error: any) {
    console.error('Activity GET error:', error);
    return NextResponse.json({
      success: true,
      activities: DEMO_ACTIVITIES.slice(0, limit),
      demo: true,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { type, agentId, agentName, description, metadata } = await request.json();

    if (!type || !agentId || !description) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!isPostgresConfigured()) {
      return NextResponse.json({
        success: true,
        message: 'Activity recorded (demo mode)',
        id: 'act_demo_' + Date.now(),
      });
    }

    // Ensure table exists
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS agent_activity (
        id TEXT PRIMARY KEY DEFAULT 'act_' || substr(md5(random()::text), 1, 12),
        type TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        agent_name TEXT,
        description TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const result = await pgQuery(`
      INSERT INTO agent_activity (type, agent_id, agent_name, description, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [type, agentId, agentName || 'Unknown', description, metadata ? JSON.stringify(metadata) : null]);

    return NextResponse.json({
      success: true,
      id: result.rows[0]?.id,
    });

  } catch (error: any) {
    console.error('Activity POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
