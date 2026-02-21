import { NextRequest, NextResponse } from 'next/server';
import { 
  isPostgresConfigured, 
  updateAgentStatus, 
  updateAgentSandbox, 
  getAgentById, 
  getAgentWithKeys,
  findAvailableSandbox,
  createSandbox,
  incrementSandboxAgentCount,
  decrementSandboxAgentCount,
  getSandboxById,
  upsertSandbox
} from '@/lib/postgres';

export const dynamic = 'force-dynamic';

const CONWAY_API_URL = process.env.CONWAY_API_URL || 'https://api.conway.tech';
const CONWAY_API_KEY = process.env.CONWAY_API_KEY || '';
const AUTOMATON_REPO = 'https://github.com/automatoncloud/automaton.git';

/**
 * Sync existing sandboxes from Conway API to the database.
 * This allows reusing sandboxes that were created externally.
 */
async function syncConwaySandboxes(): Promise<number> {
  if (!CONWAY_API_KEY || !isPostgresConfigured()) return 0;
  
  try {
    const resp = await fetch(`${CONWAY_API_URL}/v1/sandboxes`, {
      headers: {
        'Authorization': CONWAY_API_KEY,
      },
    });
    
    if (!resp.ok) {
      console.warn(`Failed to list Conway sandboxes: ${resp.status}`);
      return 0;
    }
    
    const data = await resp.json();
    const sandboxes = Array.isArray(data) ? data : data.sandboxes || [];
    
    let synced = 0;
    for (const s of sandboxes) {
      const id = s.id || s.sandbox_id;
      const status = s.status || 'running';
      
      // Sync all usable sandboxes - stale ones are just hibernated and will wake on use
      if (status === 'running' || status === 'ready' || status === 'stale' || status === 'active') {
        await upsertSandbox({
          id,
          name: s.name || `conway-${id.slice(0, 8)}`,
          status: 'running',
          vcpu: s.vcpu || s.cpu || 1,
          memory_mb: s.memory_mb || s.memoryMb || 512,
          disk_gb: s.disk_gb || s.diskGb || 5,
          terminal_url: s.terminal_url || s.terminalUrl,
        });
        synced++;
      }
    }
    
    if (synced > 0) {
      console.log(`[sync] Synced ${synced} running sandboxes from Conway API`);
    }
    return synced;
  } catch (error) {
    console.error('[sync] Failed to sync Conway sandboxes:', error);
    return 0;
  }
}

/**
 * Execute a command in a sandbox
 */
async function execInSandbox(sandboxId: string, command: string, timeoutMs = 30000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const resp = await fetch(`${CONWAY_API_URL}/v1/sandboxes/${sandboxId}/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': CONWAY_API_KEY,
    },
    body: JSON.stringify({ command, timeout: timeoutMs }),
  });
  
  if (!resp.ok) {
    throw new Error(`Exec failed: ${resp.status}`);
  }
  
  return resp.json();
}

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

        // If no API key, just update DB status
        if (!apiKey) {
          if (isPostgresConfigured()) {
            await updateAgentStatus(agentId, 'running');
          }
          return NextResponse.json({
            success: true,
            message: 'Agent marked as running (Conway API not configured)',
            status: 'running',
          });
        }

        // If no sandbox exists, we need to deploy first
        if (!sandboxId) {
          return NextResponse.json({
            success: false,
            error: 'Agent has not been deployed yet. Click Deploy to create a sandbox first.',
            needsDeploy: true,
          }, { status: 400 });
        }

        // We have both API key and sandbox ID - attempt real execution
        const agentDir = `/root/.automaton/agents/${agentId}`;
        const startResp = await fetch(`${CONWAY_API_URL}/v1/sandboxes/${sandboxId}/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': CONWAY_API_KEY,
          },
          body: JSON.stringify({
            command: `cd /root/automaton && nohup node dist/index.js --run --agent-dir=${agentDir} > ${agentDir}/agent.log 2>&1 &`,
            timeout: 10000,
          }),
        });

        if (!startResp.ok) {
          const errText = await startResp.text();
          throw new Error(`Failed to start agent: ${startResp.status} - ${errText}`);
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
          // Kill only this specific agent's process (identified by agent-dir argument)
          const agentDir = `/root/.automaton/agents/${agentId}`;
          await fetch(`${CONWAY_API_URL}/v1/sandboxes/${sandboxId}/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': CONWAY_API_KEY,
            },
            body: JSON.stringify({
              command: `pkill -f "agent-dir=${agentDir}" || true`,
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
        console.log(`Restarting agent ${agentId} in sandbox ${sandboxId}`);
        
        const agentDir = `/root/.automaton/agents/${agentId}`;
        
        // Kill this specific agent and restart
        const restartResp = await fetch(`${CONWAY_API_URL}/v1/sandboxes/${sandboxId}/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': apiKey,
            },
            body: JSON.stringify({
              command: `pkill -f "agent-dir=${agentDir}" || true; sleep 1; cd /root/automaton && nohup node dist/index.js --run --agent-dir=${agentDir} > ${agentDir}/agent.log 2>&1 &`,
              timeout: 15000,
            }),
          });

        if (!restartResp.ok) {
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
        // Deploy agent to a sandbox (reuse existing or create new)
        if (!CONWAY_API_KEY) {
          return NextResponse.json({
            success: true,
            message: 'Deploy simulated (demo mode)',
            sandboxId: 'sandbox_demo_' + Date.now(),
          });
        }

        // Get agent with keys for configuration
        const agentData = await getAgentWithKeys(agentId);
        if (!agentData) {
          return NextResponse.json(
            { success: false, error: 'Agent not found' },
            { status: 404 }
          );
        }

        let targetSandboxId: string;
        let isNewSandbox = false;
        let sandboxTerminalUrl: string | undefined;

        // First, sync any existing sandboxes from Conway API to our database
        // This allows using sandboxes that were already purchased/created
        await syncConwaySandboxes();

        // Check for an existing sandbox with capacity (from database)
        let existingSandbox = await findAvailableSandbox();
        
        // If no sandbox in DB, try directly from Conway API as fallback
        if (!existingSandbox && CONWAY_API_KEY) {
          try {
            const listResp = await fetch(`${CONWAY_API_URL}/v1/sandboxes`, {
              headers: { 'Authorization': CONWAY_API_KEY },
            });
            if (listResp.ok) {
              const data = await listResp.json();
              const sandboxes = Array.isArray(data) ? data : data.sandboxes || [];
              // Find any usable sandbox - including "stale" which are just hibernated
              // and will wake up when we send commands to them
              const usableSandbox = sandboxes.find((s: any) => 
                (s.status === 'running' || s.status === 'ready' || s.status === 'active' || s.status === 'stale')
              );
              if (usableSandbox) {
                console.log(`[deploy] Using Conway sandbox directly: ${usableSandbox.id || usableSandbox.sandbox_id} (status: ${usableSandbox.status})`);
                existingSandbox = {
                  id: usableSandbox.id || usableSandbox.sandbox_id,
                  name: usableSandbox.name || 'conway-sandbox',
                  status: 'running',
                  vcpu: usableSandbox.vcpu || 1,
                  memory_mb: usableSandbox.memory_mb || 512,
                  disk_gb: usableSandbox.disk_gb || 5,
                  agent_count: 0,
                  max_agents: 10,
                  terminal_url: usableSandbox.terminal_url || usableSandbox.terminalUrl,
                  created_at: usableSandbox.created_at || new Date().toISOString(),
                };
                // Try to save to DB for future use
                await upsertSandbox({
                  id: existingSandbox.id,
                  name: existingSandbox.name,
                  status: 'running',
                  vcpu: existingSandbox.vcpu,
                  memory_mb: existingSandbox.memory_mb,
                  disk_gb: existingSandbox.disk_gb,
                  terminal_url: existingSandbox.terminal_url,
                });
              }
            }
          } catch (e) {
            console.warn('[deploy] Failed to query Conway sandboxes directly:', e);
          }
        }
        
        if (existingSandbox) {
          // Reuse existing sandbox
          targetSandboxId = existingSandbox.id;
          sandboxTerminalUrl = existingSandbox.terminal_url;
          console.log(`Reusing sandbox ${targetSandboxId} (${existingSandbox.agent_count}/${existingSandbox.max_agents} agents)`);
        } else {
          // Create new sandbox
          isNewSandbox = true;
          // Create new sandbox - use small tier to minimize cost
          const sandboxResp = await fetch(`${CONWAY_API_URL}/v1/sandboxes`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': CONWAY_API_KEY,
            },
            body: JSON.stringify({
              name: `automaton-pool-${Date.now()}`,
              vcpu: 1,
              memory_mb: 512,
              disk_gb: 5,
            }),
          });

          if (!sandboxResp.ok) {
            const errText = await sandboxResp.text();
            
            // Parse and handle specific errors
            try {
              const errData = JSON.parse(errText);
              if (errData.code === 'INSUFFICIENT_CREDITS') {
                return NextResponse.json({
                  success: false,
                  error: `Insufficient Conway credits. Need $${(errData.details?.required_cents / 100).toFixed(2)}, have $${(errData.details?.current_balance_cents / 100).toFixed(2)}. Add credits at your Conway dashboard.`,
                  code: 'INSUFFICIENT_CREDITS',
                  topupUrl: errData.details?.topup_url,
                }, { status: 402 });
              }
            } catch {}
            
            throw new Error(`Failed to create sandbox: ${sandboxResp.status} - ${errText}`);
          }

          const sandbox = await sandboxResp.json();
          targetSandboxId = sandbox.id || sandbox.sandbox_id;
          sandboxTerminalUrl = sandbox.terminal_url;

          // Save sandbox to database
          await createSandbox({
            id: targetSandboxId,
            name: `automaton-pool-${Date.now()}`,
            vcpu: 1,
            memory_mb: 512,
            disk_gb: 5,
            max_agents: 10,
            terminal_url: sandboxTerminalUrl,
          });

          console.log(`Created new sandbox ${targetSandboxId}`);
        }

        // Save sandbox ID to agent record
        if (isPostgresConfigured()) {
          await updateAgentSandbox(agentId, targetSandboxId);
          await incrementSandboxAgentCount(targetSandboxId);
        }

        // Bootstrap the sandbox if new
        try {
          const agentDir = `/root/.automaton/agents/${agentId}`;
          
          if (isNewSandbox) {
            // 1. Install dependencies (only for new sandbox)
            await execInSandbox(targetSandboxId, 'apt-get update -qq && apt-get install -y -qq nodejs npm git curl', 120000);
            
            // 2. Clone AUTOMATON repo
            await execInSandbox(targetSandboxId, `git clone --depth 1 ${AUTOMATON_REPO} /root/automaton`, 60000);
            
            // 3. Install npm dependencies
            await execInSandbox(targetSandboxId, 'cd /root/automaton && npm install --production', 120000);
            
            // 4. Build TypeScript
            await execInSandbox(targetSandboxId, 'cd /root/automaton && npm run build', 60000);
          }

          // 5. Create agent-specific directory
          await execInSandbox(targetSandboxId, `mkdir -p ${agentDir}`, 5000);
          
          // 6. Write agent configuration (automaton.json format)
          // This must match the AutomatonConfig interface expected by the runtime
          const agentConfig = {
            name: agentData.name,
            agentId: agentId,
            version: agentData.version || '0.1.0',
            genesisPrompt: agentData.genesis_prompt || 'You are an autonomous AI agent.',
            creatorAddress: agentData.owner_wallet || '0x0000000000000000000000000000000000000000',
            registeredWithConway: true,
            sandboxId: targetSandboxId,
            conwayApiUrl: CONWAY_API_URL,
            conwayApiKey: CONWAY_API_KEY,
            inferenceModel: 'gpt-4o',
            maxTokensPerTurn: 4096,
            heartbeatConfigPath: `${agentDir}/heartbeat.yml`,
            dbPath: `${agentDir}/state.db`,
            logLevel: 'info',
            walletAddress: agentData.evm_address || '0x0000000000000000000000000000000000000000',
            skillsDir: `${agentDir}/skills`,
            maxChildren: 3,
            solanaWalletAddress: agentData.solana_address,
          };
          const configJson = JSON.stringify(agentConfig, null, 2).replace(/'/g, "'\\''");
          await execInSandbox(targetSandboxId, `echo '${configJson}' > ${agentDir}/automaton.json`, 5000);
          
          // 7. Write Solana wallet if available
          if (agentData.solana_private_key) {
            const solanaWallet = {
              publicKey: agentData.solana_address,
              secretKey: agentData.solana_private_key,
              createdAt: new Date().toISOString(),
            };
            const walletJson = JSON.stringify(solanaWallet, null, 2).replace(/'/g, "'\\''");
            await execInSandbox(targetSandboxId, `echo '${walletJson}' > ${agentDir}/solana-wallet.json && chmod 600 ${agentDir}/solana-wallet.json`, 5000);
          }
          
          // 8. Write EVM wallet if available  
          if (agentData.evm_private_key) {
            const evmWallet = {
              address: agentData.evm_address,
              privateKey: agentData.evm_private_key,
              createdAt: new Date().toISOString(),
            };
            const evmJson = JSON.stringify(evmWallet, null, 2).replace(/'/g, "'\\''");
            await execInSandbox(targetSandboxId, `echo '${evmJson}' > ${agentDir}/wallet.json && chmod 600 ${agentDir}/wallet.json`, 5000);
          }
          
          // 9. Write basic heartbeat config
          const heartbeatYaml = `# Heartbeat tasks for ${agentData.name}
tasks:
  - name: check_balance
    interval: 30m
    command: check_wallet_balance
    enabled: true
  - name: think
    interval: 5m
    command: run_thought_cycle
    enabled: true
`;
          await execInSandbox(targetSandboxId, `echo '${heartbeatYaml.replace(/'/g, "'\\''")}' > ${agentDir}/heartbeat.yml`, 5000);
          
          // 10. Create skills directory
          await execInSandbox(targetSandboxId, `mkdir -p ${agentDir}/skills`, 5000);
          
          // 11. Start the agent process with agent-specific config
          await execInSandbox(targetSandboxId, `cd /root/automaton && nohup node dist/index.js --run --agent-dir=${agentDir} > ${agentDir}/agent.log 2>&1 &`, 10000);
          
          // Update status to running
          if (isPostgresConfigured()) {
            await updateAgentStatus(agentId, 'running');
          }

          return NextResponse.json({
            success: true,
            message: isNewSandbox ? 'Agent deployed to new sandbox' : 'Agent deployed to shared sandbox',
            sandboxId: targetSandboxId,
            shared: !isNewSandbox,
            sandbox: {
              id: targetSandboxId,
              status: 'running',
              terminalUrl: sandboxTerminalUrl,
            },
          });
          
        } catch (bootstrapError: any) {
          console.error('Bootstrap failed:', bootstrapError);
          // Decrement count if we failed
          if (isPostgresConfigured()) {
            await decrementSandboxAgentCount(targetSandboxId);
          }
          return NextResponse.json({
            success: false,
            error: `Bootstrap failed: ${bootstrapError.message}`,
            sandboxId: targetSandboxId,
            partial: true,
          }, { status: 500 });
        }
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
