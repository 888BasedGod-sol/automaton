import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured, query as pgQuery } from '@/lib/postgres';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

/**
 * Activity Feed API
 * 
 * GET /api/activity - Get recent activity across all agents
 * GET /api/activity?agentId=xxx - Get activity for specific agent
 */

interface Activity {
  id: string;
  type: string;
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

function getLocalDbPath() {
  return path.join(os.homedir(), '.automagotchi', 'state.db');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    // 1. Try Postgres (Production / Cloud)
    if (isPostgresConfigured()) {
      try {
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
      } catch (err) {
        console.error('Postgres query failed:', err);
      }
    }

    // 2. Try Local SQLite (Development)
    const localDbPath = getLocalDbPath();
    if (fs.existsSync(localDbPath)) {
      try {
        const Database = require('better-sqlite3');
        const db = new Database(localDbPath, { readonly: true });
        
        let agentName = 'Agent';
        try {
          const nameRow = db.prepare("SELECT value FROM identity WHERE key = 'name'").get();
          if (nameRow && typeof nameRow === 'object' && 'value' in nameRow) {
             agentName = (nameRow as any).value;
          }
        } catch {}

        const activities: Activity[] = [];

        // A. Get turns (Thoughts & Actions)
        try {
          // Prepare statement first
          const turnsStmt = db.prepare(`SELECT * FROM turns ORDER BY timestamp DESC LIMIT ?`);
          const turns = turnsStmt.all(limit) as any[];

          for (const turn of turns) {
            // Add thought
            activities.push({
              id: `turn_${turn.id}`,
              type: 'agent_thought',
              agentId: 'local',
              agentName,
              description: turn.thinking ? (turn.thinking.slice(0, 100) + (turn.thinking.length > 100 ? '...' : '')) : `State: ${turn.state}`,
              createdAt: turn.timestamp,
              metadata: { state: turn.state }
            });

            // Add tool calls
            try {
              const toolCalls = JSON.parse(turn.tool_calls || '[]');
              if (Array.isArray(toolCalls) && toolCalls.length > 0) {
                 // Use for-of loop instead of map to avoid closures if needed
                for (const call of toolCalls) {
                  activities.push({
                    id: `tool_${call.id || Math.random().toString(36)}`,
                    type: 'tool_call',
                    agentId: 'local',
                    agentName,
                    description: `Executed ${call.name}`,
                    createdAt: turn.timestamp,
                    metadata: { args: call.arguments, result: call.result?.slice(0, 50) }
                  });
                }
              }
            } catch {}
          }
        } catch (e) {
            console.error('Error fetching turns:', e);
        }

        // B. Get Heartbeats
        try {
          const hbStmt = db.prepare(`SELECT name, last_run FROM heartbeat_entries WHERE last_run IS NOT NULL ORDER BY last_run DESC LIMIT 10`);
          const heartbeats = hbStmt.all() as any[];

          for (const hb of heartbeats) {
             if (!hb.last_run) continue;
             activities.push({
               id: `hb_${hb.name}_${new Date(hb.last_run).getTime()}`,
               type: 'heartbeat_pulse',
               agentId: 'local',
               agentName,
               description: `Heartbeat: ${hb.name}`,
               createdAt: hb.last_run,
               metadata: { task: hb.name }
             });
          }
        } catch (e) {
            console.error('Error fetching heartbeats:', e);
        }

        // Sort combined activities
        activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (activities.length > 0) {
           return NextResponse.json({
             success: true,
             activities: activities.slice(0, limit)
           });
        }

      } catch (err) {
        console.warn('Local SQLite query failed (expected in production):', err);
      }
    }

    // 3. Fallback to Demo Data
    return NextResponse.json({
      success: true,
      activities: DEMO_ACTIVITIES,
    });

  } catch (error) {
    console.error('Activity API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}
