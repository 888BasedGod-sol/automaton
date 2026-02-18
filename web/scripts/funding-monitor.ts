/**
 * Funding Monitor
 * 
 * Background worker that polls pending agents for balance changes
 * and auto-starts them when minimum funding is reached.
 * 
 * Run with: npx tsx scripts/funding-monitor.ts
 */

import Database from 'better-sqlite3';
import { Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import path from 'path';
import fs from 'fs';

// Configuration
const POLL_INTERVAL = 30_000; // 30 seconds
const MIN_SOL = 0.01;
const MIN_USDC = 1.0;

// Solana USDC token mint (mainnet)
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Base USDC contract
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Database
const DB_DIR = process.env.AUTOMATON_DATA_DIR || path.join(process.cwd(), 'data');
const dbPath = path.join(DB_DIR, 'agents.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(dbPath);

// RPC connections
const solanaConnection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const baseProvider = new ethers.JsonRpcProvider('https://mainnet.base.org');

console.log('🔍 Funding Monitor Started');
console.log(`   Database: ${dbPath}`);
console.log(`   Poll interval: ${POLL_INTERVAL / 1000}s`);
console.log(`   Min funding: ${MIN_SOL} SOL or $${MIN_USDC} USDC`);
console.log('');

async function getSolanaBalances(address: string) {
  try {
    const pubkey = new PublicKey(address);
    
    // Get SOL balance
    const solBalance = await solanaConnection.getBalance(pubkey);
    const sol = solBalance / 1e9;
    
    // Get USDC balance
    let usdc = 0;
    const tokenAccounts = await solanaConnection.getParsedTokenAccountsByOwner(
      pubkey,
      { mint: new PublicKey(USDC_MINT) }
    );
    
    if (tokenAccounts.value.length > 0) {
      const amount = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
      usdc = parseFloat(amount.uiAmountString || '0');
    }
    
    return { sol, usdc };
  } catch (error) {
    console.error(`  Error fetching Solana balance for ${address}:`, error);
    return { sol: 0, usdc: 0 };
  }
}

async function getEvmBalances(address: string) {
  try {
    const usdcContract = new ethers.Contract(
      BASE_USDC,
      ['function balanceOf(address) view returns (uint256)'],
      baseProvider
    );
    
    const balance = await usdcContract.balanceOf(address);
    const usdc = parseFloat(ethers.formatUnits(balance, 6));
    
    return { usdc };
  } catch (error) {
    console.error(`  Error fetching EVM balance for ${address}:`, error);
    return { usdc: 0 };
  }
}

function hasMinimumFunding(solBalance: number, solUsdcBalance: number, evmUsdcBalance: number): boolean {
  return solBalance >= MIN_SOL || solUsdcBalance >= MIN_USDC || evmUsdcBalance >= MIN_USDC;
}

async function checkPendingAgents() {
  const pendingAgents = db.prepare(`
    SELECT id, name, solana_address, evm_address, sol_balance, usdc_balance
    FROM agents
    WHERE status = 'pending_funding'
  `).all() as Array<{
    id: string;
    name: string;
    solana_address: string;
    evm_address: string;
    sol_balance: number;
    usdc_balance: number;
  }>;
  
  if (pendingAgents.length === 0) {
    console.log(`[${new Date().toISOString()}] No pending agents`);
    return;
  }
  
  console.log(`[${new Date().toISOString()}] Checking ${pendingAgents.length} pending agents...`);
  
  for (const agent of pendingAgents) {
    console.log(`  → ${agent.name} (${agent.id.slice(0, 8)}...)`);
    
    // Get current balances
    const solana = await getSolanaBalances(agent.solana_address);
    const evm = await getEvmBalances(agent.evm_address);
    
    const totalUsdc = solana.usdc + evm.usdc;
    
    console.log(`    SOL: ${solana.sol.toFixed(4)}, USDC: $${totalUsdc.toFixed(2)}`);
    
    // Update balances in database
    db.prepare(`
      UPDATE agents 
      SET sol_balance = ?, usdc_balance = ?
      WHERE id = ?
    `).run(solana.sol, totalUsdc, agent.id);
    
    // Check if funded
    if (hasMinimumFunding(solana.sol, solana.usdc, evm.usdc)) {
      console.log(`    ✅ FUNDED! Marking as funded...`);
      
      db.prepare(`
        UPDATE agents 
        SET status = 'funded', funded_at = datetime('now')
        WHERE id = ?
      `).run(agent.id);
      
      // TODO: Auto-start the agent
      // This would spawn a new automaton process with this agent's config
      console.log(`    🚀 Agent ready to start!`);
    }
  }
  
  console.log('');
}

// Main loop
async function main() {
  // Initial check
  await checkPendingAgents();
  
  // Set up polling
  setInterval(async () => {
    try {
      await checkPendingAgents();
    } catch (error) {
      console.error('Error in polling loop:', error);
    }
  }, POLL_INTERVAL);
  
  // Keep process running
  console.log('🔄 Monitoring active. Press Ctrl+C to stop.\n');
}

main().catch(console.error);
