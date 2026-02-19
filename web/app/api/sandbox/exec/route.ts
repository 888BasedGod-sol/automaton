import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CONWAY_API_URL = process.env.CONWAY_API_URL || 'https://api.conway.tech';
const CONWAY_API_KEY = process.env.CONWAY_API_KEY || '';

/**
 * Execute commands in a Conway sandbox
 * 
 * POST /api/sandbox/exec
 * Body: { sandboxId, command, timeout? }
 */

export async function POST(request: NextRequest) {
  try {
    const { sandboxId, command, timeout = 30000 } = await request.json();

    if (!sandboxId || !command) {
      return NextResponse.json(
        { success: false, error: 'Missing sandboxId or command' },
        { status: 400 }
      );
    }

    if (!CONWAY_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Conway API not configured' },
        { status: 503 }
      );
    }

    const resp = await fetch(`${CONWAY_API_URL}/v1/sandboxes/${sandboxId}/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': CONWAY_API_KEY,
      },
      body: JSON.stringify({ command, timeout }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { success: false, error: `Exec failed: ${resp.status} - ${text}` },
        { status: resp.status }
      );
    }

    const result = await resp.json();

    return NextResponse.json({
      success: true,
      result: {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exit_code ?? result.exitCode ?? 0,
      },
    });
  } catch (error: any) {
    console.error('Sandbox exec error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
