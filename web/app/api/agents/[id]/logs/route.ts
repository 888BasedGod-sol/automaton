import { NextRequest, NextResponse } from 'next/server';
import { updateAgentThought, isPostgresConfigured, getAgentById, query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

const CONWAY_API_URL = process.env.CONWAY_API_URL || 'https://api.conway.tech';
const CONWAY_API_KEY = process.env.CONWAY_API_KEY || '';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Get agent with sandbox ID
    const agentResult = await query(
      'SELECT last_thought, last_heartbeat, sandbox_id, status FROM agents WHERE id = $1::uuid',
      [id]
    );

    if (agentResult.rows.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const row = agentResult.rows[0];
    
    // If agent has sandbox and is running, try to fetch live logs from Conway
    if (row.sandbox_id && row.status === 'running' && CONWAY_API_KEY) {
      try {
        // Use agent-specific log directory
        const agentDir = `/root/.automaton/agents/${id}`;
        const logResp = await fetch(`${CONWAY_API_URL}/v1/sandboxes/${row.sandbox_id}/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': CONWAY_API_KEY,
          },
          body: JSON.stringify({
            command: `tail -n 20 ${agentDir}/agent.log 2>/dev/null || echo "No logs yet"`,
            timeout: 5000,
          }),
        });
        
        if (logResp.ok) {
          const logData = await logResp.json();
          if (logData.stdout) {
            return NextResponse.json({
              thought: logData.stdout,
              timestamp: new Date().toISOString(),
              source: 'sandbox',
              success: true
            }, {
              headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
            });
          }
        }
      } catch (e) {
        // Fall through to database logs
        console.warn('Failed to fetch sandbox logs:', e);
      }
    }
    
    // Fallback to database logs
    return NextResponse.json({
      thought: row.last_thought,
      timestamp: row.last_heartbeat,
      source: 'database',
      success: true
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  } catch (error: any) {
    console.error('Error fetching agent log:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { thought } = await request.json();

    if (!thought) {
      return NextResponse.json(
        { success: false, error: 'Missing thought' },
        { status: 400 }
      );
    }

    if (!isPostgresConfigured()) {
       return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Verify agent exists
    const agent = await getAgentById(id);
    if (!agent) {
       return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    const updated = await updateAgentThought(id, thought);
    if (!updated) {
        return NextResponse.json(
        { success: false, error: 'Failed to update' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating agent log:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
