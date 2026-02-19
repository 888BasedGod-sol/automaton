// Standard Postgres client for agent storage (works with any Postgres URL)
import { Pool } from 'pg';

// Get connection string (supports custom prefix)
function getConnectionString(): string | undefined {
  return (
    process.env.POSTGRES_URL ||
    process.env.AUTOMATONCLOUD_POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.AUTOMATONCLOUD_POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL
  );
}

// Lazy-loaded pool to avoid errors during build
let _pool: Pool | null = null;
function getPool(): Pool {
  if (!_pool) {
    const connString = getConnectionString();
    if (!connString) {
      throw new Error('No Postgres connection string configured');
    }
    _pool = new Pool({ 
      connectionString: connString,
      ssl: { rejectUnauthorized: false }
    });
  }
  return _pool;
}

// Helper to execute SQL queries
async function query(text: string, params?: any[]): Promise<{ rows: any[] }> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return { rows: result.rows };
  } finally {
    client.release();
  }
}

export interface Agent {
  id: string;
  name: string;
  genesis_prompt: string;
  creator_wallet?: string;
  owner_wallet?: string;
  evm_address: string;
  solana_address: string;
  evm_private_key?: string;
  solana_private_key?: string;
  status: 'pending' | 'funded' | 'running' | 'suspended' | 'terminated';
  survival_tier: 'thriving' | 'normal' | 'endangered' | 'suspended';
  credits_balance: number;
  sol_balance: number;
  usdc_balance: number;
  uptime_seconds: number;
  last_heartbeat?: string;
  parent_id?: string;
  children_count: number;
  skills: string[];
  agent_card?: object;
  erc8004_id?: string;
  version: number;
  created_at: string;
  funded_at?: string;
  started_at?: string;
}

export interface CreditDeposit {
  id: string;
  tx_hash: string;
  chain: 'solana' | 'base';
  asset: 'sol' | 'usdc';
  amount_raw: string;
  amount_credits: number;
  sender_wallet: string;
  agent_wallet: string;
  outbound_tx_hash?: string;
  status: 'pending' | 'verified' | 'completed' | 'failed';
  conway_transfer_id?: string;
  created_at: string;
  processed_at?: string;
}

// Initialize the database tables
export async function initDatabase() {
  try {
    // Create agents table
    await query(`
      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        genesis_prompt TEXT,
        creator_wallet TEXT,
        owner_wallet TEXT,
        evm_address TEXT UNIQUE NOT NULL,
        solana_address TEXT UNIQUE NOT NULL,
        evm_private_key TEXT,
        solana_private_key TEXT,
        status TEXT DEFAULT 'pending',
        survival_tier TEXT DEFAULT 'normal',
        credits_balance DECIMAL(18, 2) DEFAULT 0,
        sol_balance DECIMAL(18, 9) DEFAULT 0,
        usdc_balance DECIMAL(18, 6) DEFAULT 0,
        uptime_seconds INTEGER DEFAULT 0,
        last_heartbeat TIMESTAMPTZ,
        parent_id UUID,
        children_count INTEGER DEFAULT 0,
        skills JSONB DEFAULT '[]'::jsonb,
        agent_card JSONB,
        erc8004_id TEXT,
        version INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        funded_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ
      )
    `);

    // Create credit_deposits table
    await query(`
      CREATE TABLE IF NOT EXISTS credit_deposits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tx_hash TEXT UNIQUE NOT NULL,
        chain TEXT NOT NULL,
        asset TEXT NOT NULL,
        amount_raw TEXT NOT NULL,
        amount_credits DECIMAL(18, 2) NOT NULL,
        sender_wallet TEXT NOT NULL,
        agent_wallet TEXT NOT NULL,
        outbound_tx_hash TEXT,
        status TEXT DEFAULT 'pending',
        conway_transfer_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      )
    `);

    // Create indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_agents_evm_address ON agents(evm_address)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_agents_solana_address ON agents(solana_address)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_agents_owner_wallet ON agents(owner_wallet)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_deposits_tx_hash ON credit_deposits(tx_hash)`);

    // Add owner_wallet column if it doesn't exist (migration for existing tables)
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'owner_wallet') THEN
          ALTER TABLE agents ADD COLUMN owner_wallet TEXT;
        END IF;
      END $$
    `);

    console.log('[postgres] Database initialized');
    return true;
  } catch (error) {
    console.error('[postgres] Failed to initialize database:', error);
    return false;
  }
}

// Create a new agent
export async function createAgent(agent: {
  name: string;
  genesis_prompt?: string;
  creator_wallet?: string;
  owner_wallet?: string;
  evm_address: string;
  solana_address: string;
  evm_private_key?: string;
  solana_private_key?: string;
  skills?: string[];
}): Promise<Agent | null> {
  try {
    const result = await query(
      `INSERT INTO agents (
        name, genesis_prompt, creator_wallet, owner_wallet, evm_address, solana_address,
        evm_private_key, solana_private_key, skills
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      RETURNING *`,
      [
        agent.name,
        agent.genesis_prompt || null,
        agent.creator_wallet || null,
        agent.owner_wallet || null,
        agent.evm_address,
        agent.solana_address,
        agent.evm_private_key || null,
        agent.solana_private_key || null,
        JSON.stringify(agent.skills || [])
      ]
    );
    
    if (result.rows.length === 0) return null;
    return parseAgent(result.rows[0]);
  } catch (error) {
    console.error('[postgres] Failed to create agent:', error);
    return null;
  }
}

// Get agent by ID
export async function getAgentById(id: string): Promise<Agent | null> {
  try {
    const result = await query(
      `SELECT id, name, genesis_prompt, creator_wallet, owner_wallet, evm_address, solana_address,
             status, survival_tier, credits_balance, sol_balance, usdc_balance,
             uptime_seconds, last_heartbeat, parent_id, children_count, skills,
             agent_card, erc8004_id, version, created_at, funded_at, started_at
      FROM agents WHERE id = $1::uuid`,
      [id]
    );
    
    if (result.rows.length === 0) return null;
    return parseAgent(result.rows[0]);
  } catch (error) {
    console.error('[postgres] Failed to get agent by ID:', error);
    return null;
  }
}

// Get agent by wallet address (EVM or Solana)
export async function getAgentByWallet(wallet: string): Promise<Agent | null> {
  try {
    const result = await query(
      `SELECT id, name, genesis_prompt, creator_wallet, owner_wallet, evm_address, solana_address,
             status, survival_tier, credits_balance, sol_balance, usdc_balance,
             uptime_seconds, last_heartbeat, parent_id, children_count, skills,
             agent_card, erc8004_id, version, created_at, funded_at, started_at
      FROM agents 
      WHERE LOWER(evm_address) = LOWER($1) OR solana_address = $1
      LIMIT 1`,
      [wallet]
    );
    
    if (result.rows.length === 0) return null;
    return parseAgent(result.rows[0]);
  } catch (error) {
    console.error('[postgres] Failed to get agent by wallet:', error);
    return null;
  }
}

// Get agent by ERC-8004 ID
export async function getAgentByErc8004Id(erc8004Id: string): Promise<Agent | null> {
  try {
    const result = await query(
      `SELECT id, name, genesis_prompt, creator_wallet, owner_wallet, evm_address, solana_address,
             status, survival_tier, credits_balance, sol_balance, usdc_balance,
             uptime_seconds, last_heartbeat, parent_id, children_count, skills,
             agent_card, erc8004_id, version, created_at, funded_at, started_at
      FROM agents 
      WHERE erc8004_id = $1
      LIMIT 1`,
      [erc8004Id]
    );
    
    if (result.rows.length === 0) return null;
    return parseAgent(result.rows[0]);
  } catch (error) {
    console.error('[postgres] Failed to get agent by ERC-8004 ID:', error);
    return null;
  }
}

// Get all agents
export async function getAllAgents(): Promise<Agent[]> {
  try {
    const result = await query(
      `SELECT id, name, genesis_prompt, creator_wallet, owner_wallet, evm_address, solana_address,
             status, survival_tier, credits_balance, sol_balance, usdc_balance,
             uptime_seconds, last_heartbeat, parent_id, children_count, skills,
             agent_card, erc8004_id, version, created_at, funded_at, started_at
      FROM agents
      ORDER BY created_at DESC`
    );
    
    return result.rows.map(parseAgent);
  } catch (error) {
    console.error('[postgres] Failed to get all agents:', error);
    return [];
  }
}

// Get agents by owner wallet
export async function getAgentsByOwner(ownerWallet: string): Promise<Agent[]> {
  try {
    const result = await query(
      `SELECT id, name, genesis_prompt, creator_wallet, owner_wallet, evm_address, solana_address,
             status, survival_tier, credits_balance, sol_balance, usdc_balance,
             uptime_seconds, last_heartbeat, parent_id, children_count, skills,
             agent_card, erc8004_id, version, created_at, funded_at, started_at
      FROM agents
      WHERE owner_wallet = $1
      ORDER BY created_at DESC`,
      [ownerWallet]
    );
    
    return result.rows.map(parseAgent);
  } catch (error) {
    console.error('[postgres] Failed to get agents by owner:', error);
    return [];
  }
}

// Update agent credits balance
export async function updateAgentCredits(
  agentId: string,
  creditsToAdd: number, 
  status?: string
): Promise<boolean> {
  try {
    if (status) {
      await query(
        `UPDATE agents 
        SET credits_balance = credits_balance + $1,
            status = $2,
            funded_at = CASE WHEN funded_at IS NULL THEN NOW() ELSE funded_at END
        WHERE id = $3::uuid`,
        [creditsToAdd, status, agentId]
      );
    } else {
      await query(
        `UPDATE agents 
        SET credits_balance = credits_balance + $1
        WHERE id = $2::uuid`,
        [creditsToAdd, agentId]
      );
    }
    return true;
  } catch (error) {
    console.error('[postgres] Failed to update credits:', error);
    return false;
  }
}

// Record a credit deposit
export async function recordDeposit(deposit: {
  tx_hash: string;
  chain: 'solana' | 'base';
  asset: 'sol' | 'usdc';
  amount_raw: string;
  amount_credits: number;
  sender_wallet: string;
  agent_wallet: string;
  status?: string;
  conway_transfer_id?: string;
}): Promise<CreditDeposit | null> {
  try {
    const result = await query(
      `INSERT INTO credit_deposits (
        tx_hash, chain, asset, amount_raw, amount_credits,
        sender_wallet, agent_wallet, status, conway_transfer_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        deposit.tx_hash,
        deposit.chain,
        deposit.asset,
        deposit.amount_raw,
        deposit.amount_credits,
        deposit.sender_wallet,
        deposit.agent_wallet,
        deposit.status || 'verified',
        deposit.conway_transfer_id || null
      ]
    );
    
    if (result.rows.length === 0) return null;
    return result.rows[0] as CreditDeposit;
  } catch (error) {
    console.error('[postgres] Failed to record deposit:', error);
    return null;
  }
}

// Check if a deposit transaction was already claimed
export async function isDepositClaimed(txHash: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT id FROM credit_deposits WHERE tx_hash = $1`,
      [txHash]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('[postgres] Failed to check deposit:', error);
    return false;
  }
}

// Check if Postgres is configured
export function isPostgresConfigured(): boolean {
  return !!(
    process.env.POSTGRES_URL || 
    process.env.POSTGRES_PRISMA_URL ||
    process.env.AUTOMATONCLOUD_POSTGRES_URL ||
    process.env.AUTOMATONCLOUD_POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL
  );
}

// Helper to parse agent row from database
function parseAgent(row: any): Agent {
  return {
    id: row.id,
    name: row.name,
    genesis_prompt: row.genesis_prompt,
    creator_wallet: row.creator_wallet,
    owner_wallet: row.owner_wallet,
    evm_address: row.evm_address,
    solana_address: row.solana_address,
    status: row.status,
    survival_tier: row.survival_tier,
    credits_balance: parseFloat(row.credits_balance) || 0,
    sol_balance: parseFloat(row.sol_balance) || 0,
    usdc_balance: parseFloat(row.usdc_balance) || 0,
    uptime_seconds: parseInt(row.uptime_seconds) || 0,
    last_heartbeat: row.last_heartbeat,
    parent_id: row.parent_id,
    children_count: parseInt(row.children_count) || 0,
    skills: typeof row.skills === 'string' ? JSON.parse(row.skills) : (row.skills || []),
    agent_card: row.agent_card,
    erc8004_id: row.erc8004_id,
    version: parseInt(row.version) || 1,
    created_at: row.created_at,
    funded_at: row.funded_at,
    started_at: row.started_at,
  };
}
