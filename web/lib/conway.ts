/**
 * Conway API Client for Web App
 * 
 * Centralized client for communicating with Conway's control plane.
 * Used for sandbox management, credits, and agent infrastructure.
 */

const CONWAY_API_URL = process.env.CONWAY_API_URL || 'https://api.conway.tech';
const CONWAY_API_KEY = process.env.CONWAY_API_KEY || '';

export interface ConwayCreditsBalance {
  balanceCents: number;
  lastUpdated: string;
}

export interface ConwaySandboxInfo {
  id: string;
  status: string;
  region: string;
  vcpu: number;
  memoryMb: number;
  diskGb: number;
  terminalUrl?: string;
  createdAt: string;
}

export interface ConwayExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ConwayAgentHeartbeat {
  sandboxId: string;
  status: 'running' | 'stopped' | 'error';
  uptimeSeconds: number;
  creditsCents: number;
  memoryUsageMb?: number;
  cpuPercent?: number;
  lastPing: string;
}

/**
 * Check if Conway API is configured
 */
export function isConwayConfigured(): boolean {
  return !!CONWAY_API_KEY;
}

/**
 * Make authenticated request to Conway API
 */
async function conwayRequest<T = any>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
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
    throw new Error(`Conway API error: ${method} ${path} -> ${resp.status}: ${text}`);
  }

  const contentType = resp.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return resp.json();
  }
  return resp.text() as T;
}

// ─── Credits ─────────────────────────────────────────────────────

/**
 * Get credits balance for the authenticated account
 */
export async function getCreditsBalance(): Promise<ConwayCreditsBalance> {
  const result = await conwayRequest('GET', '/v1/credits/balance');
  return {
    balanceCents: result.balance_cents ?? result.credits_cents ?? 0,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Transfer credits to another wallet
 */
export async function transferCredits(
  toAddress: string,
  amountCents: number,
  note?: string,
): Promise<{ transferId: string; status: string; balanceAfter?: number }> {
  const paths = ['/v1/credits/transfer', '/v1/credits/transfers'];
  let lastError = 'Unknown';

  for (const path of paths) {
    try {
      const result = await conwayRequest('POST', path, {
        to_address: toAddress,
        amount_cents: amountCents,
        note,
      });
      return {
        transferId: result.transfer_id || result.id || '',
        status: result.status || 'submitted',
        balanceAfter: result.balance_after_cents,
      };
    } catch (err: any) {
      if (err.message?.includes('404')) {
        lastError = err.message;
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Credit transfer failed: ${lastError}`);
}

// ─── Sandbox Operations ──────────────────────────────────────────

/**
 * Get sandbox info
 */
export async function getSandbox(sandboxId: string): Promise<ConwaySandboxInfo | null> {
  try {
    const result = await conwayRequest('GET', `/v1/sandboxes/${sandboxId}`);
    return {
      id: result.id || result.sandbox_id || sandboxId,
      status: result.status || 'unknown',
      region: result.region || '',
      vcpu: result.vcpu || 0,
      memoryMb: result.memory_mb || 0,
      diskGb: result.disk_gb || 0,
      terminalUrl: result.terminal_url,
      createdAt: result.created_at || '',
    };
  } catch {
    return null;
  }
}

/**
 * List all sandboxes
 */
export async function listSandboxes(): Promise<ConwaySandboxInfo[]> {
  const result = await conwayRequest('GET', '/v1/sandboxes');
  const sandboxes = Array.isArray(result) ? result : (result.sandboxes || []);
  return sandboxes.map((s: any) => ({
    id: s.id || s.sandbox_id,
    status: s.status || 'unknown',
    region: s.region || '',
    vcpu: s.vcpu || 0,
    memoryMb: s.memory_mb || 0,
    diskGb: s.disk_gb || 0,
    terminalUrl: s.terminal_url,
    createdAt: s.created_at || '',
  }));
}

/**
 * Execute command in a sandbox
 */
export async function execInSandbox(
  sandboxId: string,
  command: string,
  timeout?: number,
): Promise<ConwayExecResult> {
  const result = await conwayRequest('POST', `/v1/sandboxes/${sandboxId}/exec`, {
    command,
    timeout,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.exit_code ?? result.exitCode ?? 0,
  };
}

/**
 * Check if a sandbox is healthy (can execute commands)
 */
export async function checkSandboxHealth(sandboxId: string): Promise<boolean> {
  try {
    const result = await execInSandbox(sandboxId, 'echo ok', 5000);
    return result.exitCode === 0 && result.stdout.trim() === 'ok';
  } catch {
    return false;
  }
}

// ─── Agent Heartbeat ─────────────────────────────────────────────

/**
 * Get heartbeat data from a running agent sandbox.
 * This queries the sandbox to get its current state, uptime, and resource usage.
 */
export async function getAgentHeartbeat(sandboxId: string): Promise<ConwayAgentHeartbeat | null> {
  try {
    // Check sandbox exists and is running
    const sandbox = await getSandbox(sandboxId);
    if (!sandbox || sandbox.status !== 'running') {
      return null;
    }

    // Query uptime from sandbox
    let uptimeSeconds = 0;
    try {
      const uptimeResult = await execInSandbox(sandboxId, 'cat /proc/uptime | cut -d" " -f1', 5000);
      if (uptimeResult.exitCode === 0) {
        uptimeSeconds = Math.floor(parseFloat(uptimeResult.stdout.trim()) || 0);
      }
    } catch {
      // Fallback: calculate from creation time
      if (sandbox.createdAt) {
        uptimeSeconds = Math.floor((Date.now() - new Date(sandbox.createdAt).getTime()) / 1000);
      }
    }

    // Query memory usage
    let memoryUsageMb: number | undefined;
    try {
      const memResult = await execInSandbox(sandboxId, 'free -m | grep Mem | awk \'{print $3}\'', 5000);
      if (memResult.exitCode === 0) {
        memoryUsageMb = parseInt(memResult.stdout.trim()) || undefined;
      }
    } catch {}

    // Get credits balance
    let creditsCents = 0;
    try {
      const credits = await getCreditsBalance();
      creditsCents = credits.balanceCents;
    } catch {}

    return {
      sandboxId,
      status: 'running',
      uptimeSeconds,
      creditsCents,
      memoryUsageMb,
      lastPing: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[conway] Failed to get heartbeat for ${sandboxId}:`, err);
    return null;
  }
}

/**
 * Ping all running sandboxes and collect heartbeat data.
 * Useful for batch processing survival game updates.
 */
export async function collectAllHeartbeats(): Promise<Map<string, ConwayAgentHeartbeat>> {
  const heartbeats = new Map<string, ConwayAgentHeartbeat>();
  
  try {
    const sandboxes = await listSandboxes();
    const runningSandboxes = sandboxes.filter(s => s.status === 'running');

    // Collect heartbeats in parallel (max 10 concurrent)
    const batchSize = 10;
    for (let i = 0; i < runningSandboxes.length; i += batchSize) {
      const batch = runningSandboxes.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(s => getAgentHeartbeat(s.id).catch(() => null))
      );
      
      for (let j = 0; j < batch.length; j++) {
        const heartbeat = results[j];
        if (heartbeat) {
          heartbeats.set(batch[j].id, heartbeat);
        }
      }
    }
  } catch (err) {
    console.error('[conway] Failed to collect heartbeats:', err);
  }

  return heartbeats;
}

// ─── Agent Network Discovery ─────────────────────────────────────

export interface NetworkAgent {
  address: string;
  name: string;
  description?: string;
  endpoint?: string;
  active: boolean;
}

/**
 * List all public agents on the Conway network
 */
export async function listNetworkAgents(): Promise<NetworkAgent[]> {
  try {
    const result = await conwayRequest('GET', '/v1/agents');
    const agents = result.agents || result.data || [];
    return agents.map((a: any) => ({
      address: a.address || a.wallet || '',
      name: a.name || 'Unknown',
      description: a.description,
      endpoint: a.endpoint || a.url,
      active: a.active !== false,
    }));
  } catch {
    return [];
  }
}

/**
 * Discover an agent by address
 */
export async function discoverAgent(address: string): Promise<NetworkAgent | null> {
  try {
    const result = await conwayRequest('GET', `/v1/agents/${address}`);
    return {
      address: result.address || address,
      name: result.name || 'Unknown',
      description: result.description,
      endpoint: result.endpoint || result.url,
      active: result.active !== false,
    };
  } catch {
    return null;
  }
}
