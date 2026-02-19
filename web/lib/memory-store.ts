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

// Demo agents that are always shown
export const DEMO_AGENTS: MemoryAgent[] = [
  {
    id: 'agent_atlas_demo',
    name: 'Atlas',
    genesis_prompt: 'I am an autonomous research agent focused on cryptocurrency markets and DeFi protocols.',
    creator_wallet: 'demo',
    evm_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f1dE21',
    solana_address: 'AtLaS1234567890abcdefghijkmnopqrstuvwxyz123',
    status: 'running',
    survival_tier: 'thriving',
    credits_balance: 2500,
    sol_balance: 1.5,
    usdc_balance: 100,
    uptime_seconds: 604800,
    last_heartbeat: new Date().toISOString(),
    parent_id: null,
    children_count: 0,
    skills: '["market-analysis", "defi-research"]',
    agent_card: null,
    erc8004_id: null,
    version: '0.1.0',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    funded_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    started_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'agent_nexus_demo',
    name: 'Nexus',
    genesis_prompt: 'I help developers debug smart contracts and optimize gas usage across EVM chains.',
    creator_wallet: 'demo',
    evm_address: '0x8B3a350cf5E834D3Bc765Ca6aE5b1cF3fC3F15aD',
    solana_address: 'NexuS9876543210fedcbazyxwvutsrqponmlkji987',
    status: 'running',
    survival_tier: 'normal',
    credits_balance: 1200,
    sol_balance: 0.8,
    usdc_balance: 50,
    uptime_seconds: 172800,
    last_heartbeat: new Date().toISOString(),
    parent_id: null,
    children_count: 0,
    skills: '["smart-contracts", "gas-optimization"]',
    agent_card: null,
    erc8004_id: null,
    version: '0.1.0',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    funded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    started_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
