// In-memory store for agents created during session (Vercel serverless)
// This is a workaround since SQLite doesn't work on Vercel serverless

export interface MemoryAgent {
  id: string;
  name: string;
  genesis_prompt: string;
  creator_wallet: string;
  owner_wallet?: string;
  evm_address: string;
  solana_address: string;
  status: string;
  survival_tier: string;
  credits_balance: number;
  sol_balance: number;
  usdc_balance: number;
  uptime_seconds: number;
  last_heartbeat: string | null;
  parent_id: string | null;
  children_count: number;
  skills: string;
  agent_card: string | null;
  erc8004_id: string | null;
  version: string;
  created_at: string;
  funded_at: string | null;
  started_at: string | null;
}

// Use globalThis to persist across serverless invocations (within same instance)
const globalForAgents = globalThis as unknown as {
  memoryAgents: MemoryAgent[];
};

if (!globalForAgents.memoryAgents) {
  globalForAgents.memoryAgents = [];
}

export function addMemoryAgent(agent: MemoryAgent): void {
  globalForAgents.memoryAgents.push(agent);
}

export function getMemoryAgents(): MemoryAgent[] {
  return globalForAgents.memoryAgents;
}

export function getMemoryAgentById(id: string): MemoryAgent | undefined {
  return globalForAgents.memoryAgents.find(a => a.id === id);
}

// Demo agents removed - use real agents created through the platform
// Keep the array for backward compatibility with API fallback logic
export const DEMO_AGENTS: MemoryAgent[] = [];
