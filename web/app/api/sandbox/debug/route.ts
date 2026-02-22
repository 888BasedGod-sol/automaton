import { NextRequest, NextResponse } from 'next/server';
import { query, isPostgresConfigured } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

const CONWAY_API_URL = process.env.CONWAY_API_URL || 'https://api.conway.tech';
const CONWAY_API_KEY = process.env.CONWAY_API_KEY || '';

export async function GET() {
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

    await query(
      `UPDATE agents SET sandbox_id = $1 WHERE id = $2::uuid`,
      [sandboxId, agentId]
    );

    return NextResponse.json({
      success: true,
      message: `Agent ${agentId} assigned to sandbox ${sandboxId}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
