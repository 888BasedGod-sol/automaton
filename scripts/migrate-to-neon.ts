#!/usr/bin/env npx tsx
/**
 * Migrate agents from local SQLite to Neon Postgres
 */

import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import path from 'path';

const SQLITE_PATH = path.join(process.env.HOME || '/tmp', '.automaton', 'agents.db');
const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!POSTGRES_URL) {
  console.error('Error: POSTGRES_URL or DATABASE_URL environment variable required');
  process.exit(1);
}

// Convert non-UUID IDs to valid UUIDs
function toValidUuid(id: string): string {
  // Check if it's already a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id;
  }
  // Generate a new UUID for non-UUID IDs
  return randomUUID();
}

// Convert version string to integer
function parseVersion(version: string | null): number {
  if (!version) return 1;
  // Handle "0.1.0" style versions - extract minor version
  const match = version.match(/^(\d+)\.(\d+)/);
  if (match) {
    return parseInt(match[1]) * 100 + parseInt(match[2]);
  }
  return 1;
}

async function migrate() {
  console.log('🔄 Starting migration from SQLite to Neon Postgres...\n');

  // Connect to SQLite
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  console.log(`📂 Opened SQLite: ${SQLITE_PATH}`);

  // Connect to Postgres
  const pool = new Pool({
    connectionString: POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });
  console.log('🐘 Connected to Postgres\n');

  // Get all agents from SQLite
  const agents = sqlite.prepare(`
    SELECT 
      id, name, genesis_prompt, creator_wallet, 
      evm_address, evm_private_key, solana_address, solana_private_key,
      status, survival_tier, credits_balance, sol_balance, usdc_balance,
      uptime_seconds, last_heartbeat, parent_id, children_count, skills,
      agent_card, erc8004_id, version, created_at, funded_at, started_at
    FROM agents
  `).all() as any[];

  console.log(`Found ${agents.length} agents in SQLite\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const agent of agents) {
    try {
      const newId = toValidUuid(agent.id);
      
      // Check if agent already exists by EVM or Solana address (not ID since we generate new ones)
      const existing = await pool.query(
        'SELECT id FROM agents WHERE LOWER(evm_address) = LOWER($1) OR solana_address = $2',
        [agent.evm_address, agent.solana_address]
      );
      
      if (existing.rows.length > 0) {
        console.log(`⏭️  Skipping ${agent.name} (already exists)`);
        skipped++;
        continue;
      }

      // Insert into Postgres
      await pool.query(`
        INSERT INTO agents (
          id, name, genesis_prompt, creator_wallet, owner_wallet,
          evm_address, evm_private_key, solana_address, solana_private_key,
          status, survival_tier, credits_balance, sol_balance, usdc_balance,
          uptime_seconds, last_heartbeat, parent_id, children_count, skills,
          agent_card, erc8004_id, version, created_at, funded_at, started_at
        ) VALUES (
          $1, $2, $3, $4, $4,
          $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15::timestamptz, $16, $17, $18::jsonb,
          $19::jsonb, $20, $21, $22::timestamptz, $23::timestamptz, $24::timestamptz
        )
        ON CONFLICT (evm_address) DO NOTHING
      `, [
        newId,
        agent.name,
        agent.genesis_prompt,
        agent.creator_wallet,
        agent.evm_address,
        agent.evm_private_key,
        agent.solana_address,
        agent.solana_private_key,
        agent.status || 'running',
        agent.survival_tier || 'normal',
        agent.credits_balance || 0,
        agent.sol_balance || 0,
        agent.usdc_balance || 0,
        agent.uptime_seconds || 0,
        agent.last_heartbeat || null,
        agent.parent_id ? toValidUuid(agent.parent_id) : null,
        agent.children_count || 0,
        agent.skills || '[]',
        agent.agent_card || null,
        agent.erc8004_id,
        parseVersion(agent.version),
        agent.created_at || new Date().toISOString(),
        agent.funded_at || null,
        agent.started_at || null,
      ]);

      console.log(`✅ Migrated: ${agent.name}`);
      migrated++;
    } catch (err: any) {
      console.error(`❌ Error migrating ${agent.name}:`, err.message);
      errors++;
    }
  }

  console.log(`\n📊 Migration complete!`);
  console.log(`   ✅ Migrated: ${migrated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);

  // Verify
  const count = await pool.query('SELECT COUNT(*) FROM agents');
  console.log(`\n🐘 Total agents in Postgres: ${count.rows[0].count}`);

  sqlite.close();
  await pool.end();
}

migrate().catch(console.error);
