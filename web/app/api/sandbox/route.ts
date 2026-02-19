import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CONWAY_API_URL = process.env.CONWAY_API_URL || 'https://api.conway.tech';
const CONWAY_API_KEY = process.env.CONWAY_API_KEY || '';

/**
 * Conway Sandbox API Proxy
 * 
 * GET /api/sandbox - List all sandboxes
 * GET /api/sandbox?id=xxx - Get sandbox details
 * POST /api/sandbox - Create sandbox
 * DELETE /api/sandbox?id=xxx - Delete sandbox
 */

async function conwayRequest(method: string, path: string, body?: unknown) {
  if (!CONWAY_API_KEY) {
    throw new Error('CONWAY_API_KEY not configured');
  }

  const resp = await fetch(`${CONWAY_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': CONWAY_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Conway API error: ${resp.status} - ${text}`);
  }

  const contentType = resp.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return resp.json();
  }
  return resp.text();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sandboxId = searchParams.get('id');

  try {
    if (!CONWAY_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Conway API not configured',
        sandboxes: [],
      });
    }

    if (sandboxId) {
      // Get specific sandbox
      const sandbox = await conwayRequest('GET', `/v1/sandboxes/${sandboxId}`);
      return NextResponse.json({ success: true, sandbox });
    }

    // List all sandboxes
    const result = await conwayRequest('GET', '/v1/sandboxes');
    const sandboxes = Array.isArray(result) ? result : result.sandboxes || [];
    
    return NextResponse.json({
      success: true,
      sandboxes: sandboxes.map((s: any) => ({
        id: s.id || s.sandbox_id,
        status: s.status || 'unknown',
        region: s.region || '',
        vcpu: s.vcpu || 0,
        memoryMb: s.memory_mb || 0,
        diskGb: s.disk_gb || 0,
        terminalUrl: s.terminal_url,
        createdAt: s.created_at || '',
      })),
    });
  } catch (error: any) {
    console.error('Sandbox GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      sandboxes: [],
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, vcpu = 1, memoryMb = 512, diskGb = 5, region } = body;

    if (!CONWAY_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Conway API not configured' },
        { status: 503 }
      );
    }

    const result = await conwayRequest('POST', '/v1/sandboxes', {
      name: name || `automaton-${Date.now()}`,
      vcpu,
      memory_mb: memoryMb,
      disk_gb: diskGb,
      region,
    });

    return NextResponse.json({
      success: true,
      sandbox: {
        id: result.id || result.sandbox_id,
        status: result.status || 'running',
        region: result.region || '',
        vcpu: result.vcpu || vcpu,
        memoryMb: result.memory_mb || memoryMb,
        diskGb: result.disk_gb || diskGb,
        terminalUrl: result.terminal_url,
        createdAt: result.created_at || new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Sandbox POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sandboxId = searchParams.get('id');

  if (!sandboxId) {
    return NextResponse.json(
      { success: false, error: 'Missing sandbox ID' },
      { status: 400 }
    );
  }

  try {
    if (!CONWAY_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Conway API not configured' },
        { status: 503 }
      );
    }

    await conwayRequest('DELETE', `/v1/sandboxes/${sandboxId}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Sandbox DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
