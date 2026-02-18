import path from 'path';
import fs from 'fs';
import os from 'os';

// Check if we're in a serverless environment (Vercel)
const IS_SERVERLESS = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Lazy-load better-sqlite3 to avoid crashes on Vercel
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Database: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

function getDb() {
  if (IS_SERVERLESS) return null;
  
  if (db) return db;
  
  try {
    if (!Database) {
      Database = require('better-sqlite3');
    }
    
    // TypeScript guard - should never happen after require
    if (!Database) {
      return null;
    }
    
    // Assign to local const to satisfy TypeScript
    const DatabaseConstructor = Database;
    
    // Database path - use ~/.automaton directory
    const DB_DIR = process.env.AUTOMATON_DATA_DIR || path.join(os.homedir(), '.automaton');
    const DB_PATH = path.join(DB_DIR, 'agents.db');
    
    // Ensure data directory exists
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    
    db = new DatabaseConstructor(DB_PATH);
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        genesis_prompt TEXT NOT NULL,
        creator_wallet TEXT NOT NULL,
        evm_address TEXT NOT NULL,
        evm_private_key TEXT NOT NULL,
        solana_address TEXT NOT NULL,
        solana_private_key TEXT NOT NULL,
        status TEXT DEFAULT 'pending_funding',
        survival_tier TEXT DEFAULT 'normal',
        credits_balance INTEGER DEFAULT 0,
        sol_balance REAL DEFAULT 0,
        usdc_balance REAL DEFAULT 0,
        uptime_seconds INTEGER DEFAULT 0,
        last_heartbeat TEXT,
        parent_id TEXT,
        children_count INTEGER DEFAULT 0,
        skills TEXT DEFAULT '[]',
        agent_card TEXT,
        erc8004_id TEXT,
        version TEXT DEFAULT '0.1.0',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        funded_at TEXT,
        started_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
      CREATE INDEX IF NOT EXISTS idx_agents_creator ON agents(creator_wallet);
      CREATE INDEX IF NOT EXISTS idx_agents_solana ON agents(solana_address);
      CREATE INDEX IF NOT EXISTS idx_agents_survival ON agents(survival_tier);
      CREATE INDEX IF NOT EXISTS idx_agents_parent ON agents(parent_id);
    `);
    
    return db;
  } catch (e) {
    console.warn('[DB] Failed to initialize database:', e);
    return null;
  }
}

export interface Agent {
  id: string;
  name: string;
  genesis_prompt: string;
  creator_wallet: string;
  evm_address: string;
  evm_private_key: string;
  solana_address: string;
  solana_private_key: string;
  status: 'pending_funding' | 'funded' | 'running' | 'stopped' | 'error';
  credits_balance: number;
  sol_balance: number;
  usdc_balance: number;
  created_at: string;
  funded_at: string | null;
  started_at: string | null;
}

export type AgentPublic = Omit<Agent, 'evm_private_key' | 'solana_private_key'>;

// Mock data for serverless environments
const mockAgents: AgentPublic[] = [
  {
    id: 'agent_demo_1',
    name: 'Atlas',
    genesis_prompt: 'I am an autonomous research agent focused on cryptocurrency markets.',
    creator_wallet: '0x1234567890abcdef1234567890abcdef12345678',
    evm_address: '0xabcdef1234567890abcdef1234567890abcdef12',
    solana_address: 'DemoSolanaAddress1234567890abcdefghijk',
    status: 'running',
    credits_balance: 2500,
    sol_balance: 1.5,
    usdc_balance: 100,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    funded_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    started_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'agent_demo_2',
    name: 'Nexus',
    genesis_prompt: 'I help developers debug smart contracts and optimize gas usage.',
    creator_wallet: '0x9876543210fedcba9876543210fedcba98765432',
    evm_address: '0x123456fedcba9876543210fedcba9876543210fe',
    solana_address: 'DemoSolanaAddress9876543210fedcbazyxwv',
    status: 'running',
    credits_balance: 1800,
    sol_balance: 0.8,
    usdc_balance: 50,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    funded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    started_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export function createAgent(agent: Omit<Agent, 'status' | 'credits_balance' | 'sol_balance' | 'usdc_balance' | 'created_at' | 'funded_at' | 'started_at'>): Agent {
  const database = getDb();
  if (!database) {
    // Return mock agent in serverless mode
    return {
      ...agent,
      status: 'pending_funding',
      credits_balance: 0,
      sol_balance: 0,
      usdc_balance: 0,
      created_at: new Date().toISOString(),
      funded_at: null,
      started_at: null,
    } as Agent;
  }
  
  const stmt = database.prepare(`
    INSERT INTO agents (id, name, genesis_prompt, creator_wallet, evm_address, evm_private_key, solana_address, solana_private_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    agent.id,
    agent.name,
    agent.genesis_prompt,
    agent.creator_wallet,
    agent.evm_address,
    agent.evm_private_key,
    agent.solana_address,
    agent.solana_private_key
  );
  
  return getAgent(agent.id)!;
}

export function getAgent(id: string): Agent | null {
  const database = getDb();
  if (!database) return null;
  
  const stmt = database.prepare('SELECT * FROM agents WHERE id = ?');
  return stmt.get(id) as Agent | null;
}

export function getAgentPublic(id: string): AgentPublic | null {
  const database = getDb();
  if (!database) {
    return mockAgents.find(a => a.id === id) || null;
  }
  
  const agent = getAgent(id);
  if (!agent) return null;
  
  const { evm_private_key, solana_private_key, ...publicAgent } = agent;
  return publicAgent;
}

export function getAgentByCreator(creatorWallet: string): AgentPublic[] {
  const database = getDb();
  if (!database) return mockAgents;
  
  const stmt = database.prepare('SELECT id, name, genesis_prompt, creator_wallet, evm_address, solana_address, status, credits_balance, sol_balance, usdc_balance, created_at, funded_at, started_at FROM agents WHERE creator_wallet = ?');
  return stmt.all(creatorWallet) as AgentPublic[];
}

export function getAllAgents(): AgentPublic[] {
  const database = getDb();
  if (!database) return mockAgents;
  
  const stmt = database.prepare('SELECT id, name, genesis_prompt, creator_wallet, evm_address, solana_address, status, credits_balance, sol_balance, usdc_balance, created_at, funded_at, started_at FROM agents ORDER BY created_at DESC');
  return stmt.all() as AgentPublic[];
}

export function getAgentBySolanaAddress(solanaAddress: string): Agent | null {
  const database = getDb();
  if (!database) return null;
  
  const stmt = database.prepare('SELECT * FROM agents WHERE solana_address = ?');
  return stmt.get(solanaAddress) as Agent | null;
}

export function getPendingAgents(): Agent[] {
  const database = getDb();
  if (!database) return [];
  
  const stmt = database.prepare('SELECT * FROM agents WHERE status = ?');
  return stmt.all('pending_funding') as Agent[];
}

export function updateAgentStatus(id: string, status: Agent['status']): void {
  const database = getDb();
  if (!database) return;
  
  const stmt = database.prepare('UPDATE agents SET status = ? WHERE id = ?');
  stmt.run(status, id);
}

export function updateAgentBalances(id: string, balances: { sol_balance?: number; usdc_balance?: number; credits_balance?: number }): void {
  const database = getDb();
  if (!database) return;
  
  const updates: string[] = [];
  const values: (number | string)[] = [];
  
  if (balances.sol_balance !== undefined) {
    updates.push('sol_balance = ?');
    values.push(balances.sol_balance);
  }
  if (balances.usdc_balance !== undefined) {
    updates.push('usdc_balance = ?');
    values.push(balances.usdc_balance);
  }
  if (balances.credits_balance !== undefined) {
    updates.push('credits_balance = ?');
    values.push(balances.credits_balance);
  }
  
  if (updates.length > 0) {
    values.push(id);
    const stmt = database.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }
}

export function markAgentFunded(id: string): void {
  const database = getDb();
  if (!database) return;
  
  const stmt = database.prepare('UPDATE agents SET status = ?, funded_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run('funded', id);
}

export function markAgentStarted(id: string): void {
  const database = getDb();
  if (!database) return;
  
  const stmt = database.prepare('UPDATE agents SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run('running', id);
}

export { getDb };
export default getDb;
