import path from 'path';
import fs from 'fs';
import os from 'os';

// Check if we're in a serverless environment (Vercel)
const IS_SERVERLESS = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Try to import better-sqlite3, will fail on Vercel
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Database: any = null;
if (!IS_SERVERLESS) {
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    console.warn('[DB] better-sqlite3 not available, using mock mode');
  }
}

// Database path - use ~/.automaton directory
const DB_DIR = process.env.AUTOMATON_DATA_DIR || path.join(os.homedir(), '.automaton');
const DB_PATH = path.join(DB_DIR, 'agents.db');

// Ensure data directory exists (only when not serverless)
if (!IS_SERVERLESS && !fs.existsSync(DB_DIR)) {
  try {
    fs.mkdirSync(DB_DIR, { recursive: true });
  } catch (e) {
    console.warn('[DB] Could not create data directory');
  }
}

// Global singleton pattern for serverless environments
const globalForDb = globalThis as unknown as {
  db: any | undefined;
};

function createDb(): any | null {
  if (!Database) {
    return null;
  }
  
  // Assign to local const to satisfy TypeScript
  const DatabaseConstructor = Database;
  const db = new DatabaseConstructor(DB_PATH);
  
  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = 10000'); // ~40MB cache
  db.pragma('temp_store = MEMORY');
  
  // Create tables if not exist
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
    CREATE INDEX IF NOT EXISTS idx_agents_created ON agents(created_at DESC);
  `);
  
  return db;
}

// Singleton getter - reuses connection across requests, returns null on serverless
export function getDb(): any | null {
  if (IS_SERVERLESS || !Database) {
    return null;
  }
  if (!globalForDb.db) {
    globalForDb.db = createDb();
  }
  return globalForDb.db;
}

// For read-only queries (faster)
export function getReadonlyDb(): any | null {
  return getDb();
}

// Check if DB is available
export function isDbAvailable(): boolean {
  return !IS_SERVERLESS && Database !== null;
}

// Prepared statement cache
const stmtCache = new Map<string, any>();

export function getCachedStmt(sql: string): any | null {
  const db = getDb();
  if (!db) return null;
  
  if (!stmtCache.has(sql)) {
    stmtCache.set(sql, db.prepare(sql));
  }
  return stmtCache.get(sql)!;
}

export default getDb;
