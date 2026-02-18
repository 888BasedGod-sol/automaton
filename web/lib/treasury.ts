import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Base58 encoding/decoding (Solana compatible)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58(bytes: Uint8Array): string {
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = '';
  for (const byte of bytes) {
    if (byte === 0) result += BASE58_ALPHABET[0];
    else break;
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

function decodeBase58(str: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of str) {
    let carry = BASE58_ALPHABET.indexOf(char);
    if (carry < 0) throw new Error('Invalid base58 character');
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of str) {
    if (char === BASE58_ALPHABET[0]) bytes.push(0);
    else break;
  }
  return new Uint8Array(bytes.reverse());
}

// Treasury config location
const AUTOMATON_DIR = process.env.AUTOMATON_DATA_DIR || path.join(os.homedir(), '.automaton');
const TREASURY_PATH = path.join(AUTOMATON_DIR, 'treasury.json');

// Solana RPC endpoints
const RPC_ENDPOINTS = {
  mainnet: process.env.SOLANA_RPC_MAINNET || 'https://api.mainnet-beta.solana.com',
  devnet: process.env.SOLANA_RPC_DEVNET || 'https://api.devnet.solana.com',
};

export interface TreasuryConfig {
  publicKey: string;
  privateKey: string;
  network: 'mainnet' | 'devnet';
  createdAt: string;
  label?: string;
}

export interface TreasuryBalance {
  sol: number;
  lamports: number;
  usd?: number;
}

/**
 * Generate a new treasury wallet
 */
export function generateTreasuryWallet(network: 'mainnet' | 'devnet' = 'devnet', label?: string): TreasuryConfig {
  const keypair = Keypair.generate();
  
  const config: TreasuryConfig = {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: encodeBase58(keypair.secretKey),
    network,
    createdAt: new Date().toISOString(),
    label: label || 'Automaton Treasury',
  };
  
  return config;
}

/**
 * Save treasury config to disk (encrypted in production)
 */
export function saveTreasuryConfig(config: TreasuryConfig): void {
  // Ensure directory exists
  if (!fs.existsSync(AUTOMATON_DIR)) {
    fs.mkdirSync(AUTOMATON_DIR, { recursive: true });
  }
  
  // Save config (WARNING: In production, encrypt this!)
  fs.writeFileSync(TREASURY_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
  console.log(`Treasury saved to ${TREASURY_PATH}`);
}

/**
 * Load treasury config from disk
 */
export function loadTreasuryConfig(): TreasuryConfig | null {
  if (!fs.existsSync(TREASURY_PATH)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(TREASURY_PATH, 'utf8');
    return JSON.parse(data) as TreasuryConfig;
  } catch (e) {
    console.error('Failed to load treasury config:', e);
    return null;
  }
}

/**
 * Get treasury keypair from config
 */
export function getTreasuryKeypair(): Keypair | null {
  const config = loadTreasuryConfig();
  if (!config) return null;
  
  try {
    const secretKey = decodeBase58(config.privateKey);
    return Keypair.fromSecretKey(secretKey);
  } catch (e) {
    console.error('Failed to restore treasury keypair:', e);
    return null;
  }
}

/**
 * Get Solana connection for treasury network
 */
export function getTreasuryConnection(): Connection | null {
  const config = loadTreasuryConfig();
  if (!config) return null;
  
  const rpc = RPC_ENDPOINTS[config.network];
  return new Connection(rpc, 'confirmed');
}

/**
 * Get treasury balance
 */
export async function getTreasuryBalance(): Promise<TreasuryBalance | null> {
  const config = loadTreasuryConfig();
  if (!config) return null;
  
  const connection = getTreasuryConnection();
  if (!connection) return null;
  
  try {
    const pubkey = new PublicKey(config.publicKey);
    const lamports = await connection.getBalance(pubkey);
    const sol = lamports / LAMPORTS_PER_SOL;
    
    return {
      sol,
      lamports,
      // Could fetch USD price here
    };
  } catch (e) {
    console.error('Failed to get treasury balance:', e);
    return null;
  }
}

/**
 * Fund an agent wallet from treasury
 */
export async function fundAgentFromTreasury(
  agentSolanaAddress: string,
  amountSol: number
): Promise<{ success: boolean; signature?: string; error?: string }> {
  const keypair = getTreasuryKeypair();
  const connection = getTreasuryConnection();
  
  if (!keypair || !connection) {
    return { success: false, error: 'Treasury not configured' };
  }
  
  try {
    const agentPubkey = new PublicKey(agentSolanaAddress);
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
    
    // Check treasury balance
    const treasuryBalance = await connection.getBalance(keypair.publicKey);
    if (treasuryBalance < lamports + 5000) { // 5000 lamports for fee
      return { success: false, error: 'Insufficient treasury balance' };
    }
    
    // Create transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: agentPubkey,
        lamports,
      })
    );
    
    // Send and confirm
    const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
    
    return { success: true, signature };
  } catch (e: any) {
    return { success: false, error: e.message || 'Transfer failed' };
  }
}

/**
 * Get treasury public info (safe to expose)
 */
export function getTreasuryPublicInfo(): { publicKey: string; network: string; label?: string } | null {
  const config = loadTreasuryConfig();
  if (!config) return null;
  
  return {
    publicKey: config.publicKey,
    network: config.network,
    label: config.label,
  };
}
