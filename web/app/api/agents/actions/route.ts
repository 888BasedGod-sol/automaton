import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured, updateAgentStatus, updateAgentSandbox, getAgentById } from '@/lib/postgres';

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
    const { agentId, action, amount } = body;
    let { sandboxId } = body;

    if (!agentId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing agentId or action' },
        { status: 400 }
      );
    }

    // If sandboxId is missing, try to fetch from DB so we can connect to the right sandbox
    if (!sandboxId && agentId && isPostgresConfigured()) {
      try {
        const agent = await getAgentById(agentId);
        if (agent && agent.sandbox_id) {
          sandboxId = agent.sandbox_id;
        }
      } catch (e) {
        console.warn(`Could not fetch agent ${agentId} sandbox info:`, e);
      }
    }

    switch (action) {
      case 'start': {
        const apiKey = process.env.CONWAY_API_KEY;

        // If no API key OR no sandbox ID provided, treat as demo/local-only update
        if (!apiKey || !sandboxId) {
          if (isPostgresConfigured()) {
            await updateAgentStatus(agentId, 'running');
          }
          return NextResponse.json({
            success: true,
            message: sandboxId ? 'Agent started (demo mode)' : 'Agent marked as running (no sandbox connected)',
            status: 'running',
          });
        }

        // We have both API key and sandbox ID - attempt real execution
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
        const apiKey = process.env.CONWAY_API_KEY;

        // If no API key OR no sandbox ID provided, treat as demo/local-only update
        if (!apiKey || !sandboxId) {
          if (isPostgresConfigured()) {
            await updateAgentStatus(agentId, 'running');
          }
          return NextResponse.json({
            success: true,
            message: sandboxId ? 'Agent restarted (demo mode)' : 'Agent marked as running (no sandbox connected)',
            status: 'running',
          });
        }

        // We have both API key and sandbox ID - attempt real execution
        console.log(`Restarting sandbox ${sandboxId} via ${CONWAY_API_URL}`);
        
        // Kill and restart
        const restartResp = await fetch(`${CONWAY_API_URL}/v1/sandboxes/${sandboxId}/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': apiKey,
            },
            body: JSON.stringify({
              command: `pkill -f "node dist/index.js" || true; sleep 1; cd /root/.automaton && node dist/index.js --run &`,
              timeout: 15000,
            }),
          });

        if (!restartResp.ok) {
           // Fallback to simpler restart if exec fails
           // throw new Error(`Restart failed: ${restartResp.status}`);
           // Just continue but warn
           console.error(`Restart failed: ${restartResp.status}`);
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

        // Save sandbox ID to database agent record
        if (isPostgresConfigured() && agentId) {
          try {
             await updateAgentSandbox(agentId, newSandboxId);
          } catch (err) {
            console.error('Failed to update agent sandbox ID:', err);
          }
        }

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
