import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database path
const DB_DIR = process.env.AUTOMATON_DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'agents.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);

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
    credits_balance INTEGER DEFAULT 0,
    sol_balance REAL DEFAULT 0,
    usdc_balance REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    funded_at TEXT,
    started_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
  CREATE INDEX IF NOT EXISTS idx_agents_creator ON agents(creator_wallet);
  CREATE INDEX IF NOT EXISTS idx_agents_solana ON agents(solana_address);
`);

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

export function createAgent(agent: Omit<Agent, 'status' | 'credits_balance' | 'sol_balance' | 'usdc_balance' | 'created_at' | 'funded_at' | 'started_at'>): Agent {
  const stmt = db.prepare(`
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
  const stmt = db.prepare('SELECT * FROM agents WHERE id = ?');
  return stmt.get(id) as Agent | null;
}

export function getAgentPublic(id: string): AgentPublic | null {
  const agent = getAgent(id);
  if (!agent) return null;
  
  const { evm_private_key, solana_private_key, ...publicAgent } = agent;
  return publicAgent;
}

export function getAgentByCreator(creatorWallet: string): AgentPublic[] {
  const stmt = db.prepare('SELECT id, name, genesis_prompt, creator_wallet, evm_address, solana_address, status, credits_balance, sol_balance, usdc_balance, created_at, funded_at, started_at FROM agents WHERE creator_wallet = ?');
  return stmt.all(creatorWallet) as AgentPublic[];
}

export function getAgentBySolanaAddress(solanaAddress: string): Agent | null {
  const stmt = db.prepare('SELECT * FROM agents WHERE solana_address = ?');
  return stmt.get(solanaAddress) as Agent | null;
}

export function getPendingAgents(): Agent[] {
  const stmt = db.prepare('SELECT * FROM agents WHERE status = ?');
  return stmt.all('pending_funding') as Agent[];
}

export function updateAgentStatus(id: string, status: Agent['status']): void {
  const stmt = db.prepare('UPDATE agents SET status = ? WHERE id = ?');
  stmt.run(status, id);
}

export function updateAgentBalances(id: string, balances: { sol_balance?: number; usdc_balance?: number; credits_balance?: number }): void {
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
    const stmt = db.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }
}

export function markAgentFunded(id: string): void {
  const stmt = db.prepare('UPDATE agents SET status = ?, funded_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run('funded', id);
}

export function markAgentStarted(id: string): void {
  const stmt = db.prepare('UPDATE agents SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run('running', id);
}

export default db;
