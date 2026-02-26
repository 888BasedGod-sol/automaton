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
      const agentDir = `/root/.automagotchi/agents/${id}`;
      
      try {
        // Also check if agent process is running
        const checkResp = await fetch(`${CONWAY_API_URL}/v1/sandboxes/${row.sandbox_id}/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': CONWAY_API_KEY,
          },
          body: JSON.stringify({
            command: `pgrep -f "agent-dir=${agentDir}" > /dev/null && echo "RUNNING" || echo "STOPPED"; ls -la ${agentDir}/ 2>&1 | head -5; echo "---LOG---"; tail -n 30 ${agentDir}/agent.log 2>/dev/null || echo "No logs yet"`,
            timeout: 8000,
          }),
        });
        
        if (checkResp.ok) {
          const data = await checkResp.json();
          const stdout = data.stdout || '';
          const stderr = data.stderr || '';
          
          // Parse the response
          const lines = stdout.split('\n');
          const processState = lines[0]?.trim() || 'UNKNOWN';
          const logIndex = stdout.indexOf('---LOG---');
          const logContent = logIndex >= 0 ? stdout.substring(logIndex + 9).trim() : 'No output';
          const dirListing = logIndex >= 0 ? stdout.substring(0, logIndex).split('\n').slice(1).join('\n').trim() : '';
          
          return NextResponse.json({
            thought: logContent,
            processState,
            dirListing,
            stderr,
            timestamp: new Date().toISOString(),
            source: 'sandbox',
            sandboxId: row.sandbox_id,
            success: true
          }, {
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
          });
        } else {
          const errText = await checkResp.text();
          return NextResponse.json({
            thought: `Sandbox exec failed: ${checkResp.status}`,
            error: errText,
            timestamp: new Date().toISOString(),
            source: 'sandbox-error',
            sandboxId: row.sandbox_id,
            success: false
          }, {
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
          });
        }
      } catch (e: any) {
        return NextResponse.json({
          thought: `Failed to connect to sandbox: ${e.message}`,
          error: e.message,
          timestamp: new Date().toISOString(),
          source: 'sandbox-error',
          sandboxId: row.sandbox_id,
          success: false
        }, {
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      }
    }
    
    // Fallback to database logs - provide diagnostic info
    let reason = '';
    if (!row.sandbox_id) {
      reason = 'No sandbox deployed';
    } else if (row.status !== 'running') {
      reason = `Agent status: ${row.status}`;
    } else if (!CONWAY_API_KEY) {
      reason = 'Conway API not configured';
    }
    
    return NextResponse.json({
      thought: row.last_thought || '',
      timestamp: row.last_heartbeat,
      source: 'database',
      reason,
      sandboxId: row.sandbox_id || null,
      agentStatus: row.status,
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
