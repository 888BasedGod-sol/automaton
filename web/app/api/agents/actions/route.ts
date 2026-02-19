import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured, updateAgentStatus } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

const CONWAY_API_URL = process.env.CONWAY_API_URL || 'https://api.conway.tech';
const CONWAY_API_KEY = process.env.CONWAY_API_KEY || '';

/**
 * Agent Actions API
 * 
 * POST /api/agents/actions
 * Actions: start, stop, restart, deploy
 */

interface AgentActionRequest {
  agentId: string;
  action: 'start' | 'stop' | 'restart' | 'deploy' | 'fund';
  sandboxId?: string;
  amount?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: AgentActionRequest = await request.json();
    const { agentId, action, sandboxId, amount } = body;

    if (!agentId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing agentId or action' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'start': {
        if (!sandboxId) {
          return NextResponse.json(
            { success: false, error: 'Missing sandboxId for start action' },
            { status: 400 }
          );
        }

        if (!CONWAY_API_KEY) {
          // Demo mode - just update status
          if (isPostgresConfigured()) {
            await updateAgentStatus(agentId, 'running');
          }
          return NextResponse.json({
            success: true,
            message: 'Agent started (demo mode)',
            status: 'running',
          });
        }

        // Start agent in sandbox
        const startResp = await fetch(`${CONWAY_API_URL}/v1/sandboxes/${sandboxId}/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': CONWAY_API_KEY,
          },
          body: JSON.stringify({
            command: `cd /root/.automaton && node dist/index.js --run &`,
            timeout: 10000,
          }),
        });

        if (!startResp.ok) {
          throw new Error(`Failed to start agent: ${startResp.status}`);
        }

        if (isPostgresConfigured()) {
          await updateAgentStatus(agentId, 'running');
        }

        return NextResponse.json({
          success: true,
          message: 'Agent started',
          status: 'running',
        });
      }

      case 'stop': {
        if (sandboxId && CONWAY_API_KEY) {
          // Kill agent process
          await fetch(`${CONWAY_API_URL}/v1/sandboxes/${sandboxId}/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': CONWAY_API_KEY,
            },
            body: JSON.stringify({
              command: 'pkill -f "node dist/index.js" || true',
              timeout: 5000,
            }),
          });
        }

        if (isPostgresConfigured()) {
          await updateAgentStatus(agentId, 'suspended');
        }

        return NextResponse.json({
          success: true,
          message: 'Agent stopped',
          status: 'suspended',
        });
      }

      case 'restart': {
        if (!sandboxId) {
          return NextResponse.json(
            { success: false, error: 'Missing sandboxId for restart' },
            { status: 400 }
          );
        }

        if (CONWAY_API_KEY) {
          // Kill and restart
          await fetch(`${CONWAY_API_URL}/v1/sandboxes/${sandboxId}/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': CONWAY_API_KEY,
            },
            body: JSON.stringify({
              command: 'pkill -f "node dist/index.js" || true; sleep 1; cd /root/.automaton && node dist/index.js --run &',
              timeout: 15000,
            }),
          });
        }

        if (isPostgresConfigured()) {
          await updateAgentStatus(agentId, 'running');
        }

        return NextResponse.json({
          success: true,
          message: 'Agent restarted',
          status: 'running',
        });
      }

      case 'deploy': {
        // Create new sandbox and deploy agent
        if (!CONWAY_API_KEY) {
          return NextResponse.json({
            success: true,
            message: 'Deploy simulated (demo mode)',
            sandboxId: 'sandbox_demo_' + Date.now(),
          });
        }

        // Create sandbox
        const sandboxResp = await fetch(`${CONWAY_API_URL}/v1/sandboxes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': CONWAY_API_KEY,
          },
          body: JSON.stringify({
            name: `automaton-${agentId.slice(0, 8)}`,
            vcpu: 1,
            memory_mb: 512,
            disk_gb: 5,
          }),
        });

        if (!sandboxResp.ok) {
          throw new Error(`Failed to create sandbox: ${sandboxResp.status}`);
        }

        const sandbox = await sandboxResp.json();
        const newSandboxId = sandbox.id || sandbox.sandbox_id;

        return NextResponse.json({
          success: true,
          message: 'Sandbox created',
          sandboxId: newSandboxId,
          sandbox: {
            id: newSandboxId,
            status: sandbox.status || 'running',
            terminalUrl: sandbox.terminal_url,
          },
        });
      }

      case 'fund': {
        // This would integrate with Solana/Base funding
        return NextResponse.json({
          success: true,
          message: 'Funding requires wallet connection',
          fundingAddress: null,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Agent action error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
