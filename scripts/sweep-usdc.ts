#!/usr/bin/env npx tsx
/**
 * Sweep USDC from all agent wallets to treasury
 * 
 * Usage: npx tsx scripts/sweep-usdc.ts
 */

import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Pool } from 'pg';
import bs58 from 'bs58';

// Configuration
const DESTINATION_WALLET = '4GZMepeTYJ5dP3M7yCTZb7qdGj1sFbn8zCZubCHJD5pX';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // Mainnet USDC
const USDC_DECIMALS = 6;
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Postgres connection
function getConnectionString(): string {
  return (
    process.env.POSTGRES_URL ||
    process.env.AUTOMATONCLOUD_POSTGRES_URL ||
    process.env.DATABASE_URL ||
    ''
  );
}

interface Agent {
  id: string;
  name: string;
  solana_address: string;
  solana_private_key: string;
}

async function getAgentsWithKeys(pool: Pool): Promise<Agent[]> {
  const result = await pool.query(`
    SELECT id, name, solana_address, solana_private_key 
    FROM agents 
    WHERE solana_private_key IS NOT NULL
  `);
  return result.rows;
}

function parsePrivateKey(privateKeyData: string): Keypair {
  // Try base58 first
  try {
    const decoded = bs58.decode(privateKeyData);
    if (decoded.length === 64) {
      return Keypair.fromSecretKey(decoded);
    }
  } catch (e) {
    // Continue to other formats
  }

  // Try JSON array format
  try {
    const arr = JSON.parse(privateKeyData);
    return Keypair.fromSecretKey(new Uint8Array(arr));
  } catch (e) {
    // Continue to other formats
  }

  // Try base64
  try {
    const decoded = Buffer.from(privateKeyData, 'base64');
    if (decoded.length === 64) {
      return Keypair.fromSecretKey(new Uint8Array(decoded));
    }
  } catch (e) {
    // Continue
  }

  throw new Error(`Could not parse private key (tried base58, JSON array, base64)`);
}

async function getUsdcBalance(
  connection: Connection,
  walletAddress: string
): Promise<number> {
  const usdcMint = new PublicKey(USDC_MINT);
  const wallet = new PublicKey(walletAddress);

  try {
    const tokenAccount = await getAssociatedTokenAddress(usdcMint, wallet);
    const account = await getAccount(connection, tokenAccount);
    return Number(account.amount) / Math.pow(10, USDC_DECIMALS);
  } catch (error: any) {
    if (error.name === 'TokenAccountNotFoundError') {
      return 0;
    }
    // Return 0 for any error (account may not exist)
    return 0;
  }
}

async function transferUsdc(
  connection: Connection,
  from: Keypair,
  to: string,
  amount: number
): Promise<string> {
  const usdcMint = new PublicKey(USDC_MINT);
  const toPubkey = new PublicKey(to);

  const fromTokenAccount = await getAssociatedTokenAddress(usdcMint, from.publicKey);
  const toTokenAccount = await getAssociatedTokenAddress(usdcMint, toPubkey);

  const transaction = new Transaction();

  // Check if destination token account exists
  const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
  if (!toAccountInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        from.publicKey,
        toTokenAccount,
        toPubkey,
        usdcMint
      )
    );
  }

  const amountInSmallestUnit = BigInt(Math.floor(amount * Math.pow(10, USDC_DECIMALS)));
  transaction.add(
    createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      from.publicKey,
      amountInSmallestUnit
    )
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = from.publicKey;

  transaction.sign(from);
  const signature = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction(signature);

  return signature;
}

async function main() {
  console.log('🔄 USDC Sweep Script');
  console.log('====================');
  console.log(`Destination: ${DESTINATION_WALLET}`);
  console.log(`Network: Solana Mainnet`);
  console.log('');

  const connString = getConnectionString();
  if (!connString) {
    console.error('❌ No Postgres connection string found');
    console.log('Set POSTGRES_URL or DATABASE_URL environment variable');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  const connection = new Connection(SOLANA_RPC, 'confirmed');

  try {
    const agents = await getAgentsWithKeys(pool);
    console.log(`Found ${agents.length} agents with private keys\n`);

    let totalSwept = 0;
    let successCount = 0;
    let failCount = 0;

    for (const agent of agents) {
      process.stdout.write(`${agent.name} (${agent.solana_address.slice(0, 8)}...): `);

      try {
        const balance = await getUsdcBalance(connection, agent.solana_address);

        if (balance < 0.01) {
          console.log(`${balance.toFixed(2)} USDC (skipped - too small)`);
          continue;
        }

        console.log(`${balance.toFixed(2)} USDC`);

        const keypair = parsePrivateKey(agent.solana_private_key);

        // Transfer full balance minus small buffer for rounding
        const transferAmount = balance - 0.001;
        if (transferAmount <= 0) {
          console.log(`  → Skipped (balance too small after buffer)`);
          continue;
        }

        const signature = await transferUsdc(connection, keypair, DESTINATION_WALLET, transferAmount);
        console.log(`  → Sent ${transferAmount.toFixed(2)} USDC | Tx: ${signature.slice(0, 16)}...`);
        
        totalSwept += transferAmount;
        successCount++;
      } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}`);
        failCount++;
      }
    }

    console.log('\n====================');
    console.log(`✅ Swept: ${totalSwept.toFixed(2)} USDC`);
    console.log(`📊 Success: ${successCount}, Failed: ${failCount}`);

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
