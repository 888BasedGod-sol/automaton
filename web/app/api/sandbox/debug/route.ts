import { NextRequest, NextResponse } from 'next/server';
import { query, isPostgresConfigured } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

const CONWAY_API_URL = process.env.CONWAY_API_URL || 'https://api.conway.tech';
const CONWAY_API_KEY = process.env.CONWAY_API_KEY || '';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const checkAgents = searchParams.get('agents');
  
  // If ?agents=true, query database for agents with sandbox_ids
  if (checkAgents && isPostgresConfigured()) {
    try {
      const result = await query(
        `SELECT id, name, status, sandbox_id FROM agents ORDER BY created_at DESC LIMIT 20`
      );
      return NextResponse.json({
        postgres_configured: true,
        agents: result.rows,
      });
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  
  const results: Record<string, unknown> = {
    conway_api_url: CONWAY_API_URL,
    api_key_set: !!CONWAY_API_KEY,
    api_key_length: CONWAY_API_KEY.length,
    api_key_prefix: CONWAY_API_KEY.slice(0, 10) + '...',
  };

  if (!CONWAY_API_KEY) {
    return NextResponse.json({
      ...results,
      error: 'CONWAY_API_KEY not configured',
    });
  }

  try {
    // List sandboxes
    const listResp = await fetch(`${CONWAY_API_URL}/v1/sandboxes`, {
      headers: {
        'Authorization': CONWAY_API_KEY,
        'X-API-Key': CONWAY_API_KEY,
      },
    });

    results.list_status = listResp.status;
    results.list_ok = listResp.ok;

    const text = await listResp.text();
    results.raw_response = text.slice(0, 500);

    if (listResp.ok) {
      try {
        const data = JSON.parse(text);
        const sandboxes = Array.isArray(data) ? data : data.sandboxes || [];
        results.sandbox_count = sandboxes.length;
        results.sandboxes = sandboxes.map((s: any) => ({
          id: s.id || s.sandbox_id,
          status: s.status,
          name: s.name,
          vcpu: s.vcpu,
          memory_mb: s.memory_mb,
        }));
      } catch (e) {
        results.parse_error = String(e);
      }
    }
  } catch (error) {
    results.fetch_error = String(error);
  }

  return NextResponse.json(results);
}

// POST: Execute command in a sandbox for debugging
export async function POST(request: NextRequest) {
  if (!CONWAY_API_KEY) {
    return NextResponse.json({ error: 'CONWAY_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { sandboxId, command, timeout = 30000 } = await request.json();
    
    if (!sandboxId || !command) {
      return NextResponse.json({ error: 'sandboxId and command required' }, { status: 400 });
    }

    const execResp = await fetch(`${CONWAY_API_URL}/v1/sandboxes/${sandboxId}/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': CONWAY_API_KEY,
      },
      body: JSON.stringify({ command, timeout }),
    });

    const execText = await execResp.text();
    let execData;
    try {
      execData = JSON.parse(execText);
    } catch {
      execData = { raw: execText };
    }

    return NextResponse.json({
      success: execResp.ok,
      status: execResp.status,
      ...execData,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Update agent's sandbox assignment
export async function PATCH(request: NextRequest) {
  if (!isPostgresConfigured()) {
    return NextResponse.json({ error: 'Postgres not configured' }, { status: 500 });
  }

  try {
    const { agentId, sandboxId } = await request.json();
    
    if (!agentId || !sandboxId) {
      return NextResponse.json({ error: 'agentId and sandboxId required' }, { status: 400 });
    }

    // First check if agent exists
    const checkResult = await query(
      `SELECT id, sandbox_id FROM agents WHERE id = $1::uuid`,
      [agentId]
    );
    
    if (checkResult.rows.length === 0) {
      return NextResponse.json({ error: `Agent ${agentId} not found` }, { status: 404 });
    }
    
    const beforeSandbox = checkResult.rows[0].sandbox_id;

    // Update sandbox_id
    const updateResult = await query(
      `UPDATE agents SET sandbox_id = $1 WHERE id = $2::uuid RETURNING id, sandbox_id`,
      [sandboxId, agentId]
    );

    const afterSandbox = updateResult.rows[0]?.sandbox_id;

    return NextResponse.json({
      success: true,
      message: `Agent ${agentId} assigned to sandbox ${sandboxId}`,
      before: beforeSandbox,
      after: afterSandbox,
      rowsAffected: updateResult.rows.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
