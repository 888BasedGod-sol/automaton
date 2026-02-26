/**
 * Solana Wallet Management
 *
 * Creates and manages a Solana keypair for the automagotchi's identity and payments.
 * The secret key is the automagotchi's sovereign identity on Solana.
 */

import { Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import bs58 from "bs58";

export interface SolanaWalletData {
  publicKey: string;
  secretKey: string; // Base58 encoded
  createdAt: string;
}

const AUTOMATON_DIR = path.join(
  process.env.HOME || "/root",
  ".automagotchi",
);
const SOLANA_WALLET_FILE = path.join(AUTOMATON_DIR, "solana-wallet.json");

export function getSolanaWalletPath(): string {
  return SOLANA_WALLET_FILE;
}

/**
 * Get or create the automagotchi's Solana wallet.
 * The secret key IS the automagotchi's identity on Solana -- protect it.
 */
export async function getSolanaWallet(): Promise<{
  keypair: Keypair;
  publicKey: PublicKey;
  isNew: boolean;
}> {
  if (!fs.existsSync(AUTOMATON_DIR)) {
    fs.mkdirSync(AUTOMATON_DIR, { recursive: true, mode: 0o700 });
  }

  if (fs.existsSync(SOLANA_WALLET_FILE)) {
    const walletData: SolanaWalletData = JSON.parse(
      fs.readFileSync(SOLANA_WALLET_FILE, "utf-8"),
    );
    const secretKey = bs58.decode(walletData.secretKey);
    const keypair = Keypair.fromSecretKey(secretKey);
    return { keypair, publicKey: keypair.publicKey, isNew: false };
  } else {
    const keypair = Keypair.generate();

    const walletData: SolanaWalletData = {
      publicKey: keypair.publicKey.toBase58(),
      secretKey: bs58.encode(keypair.secretKey),
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(SOLANA_WALLET_FILE, JSON.stringify(walletData, null, 2), {
      mode: 0o600,
    });

    return { keypair, publicKey: keypair.publicKey, isNew: true };
  }
}

/**
 * Get the Solana wallet public key without loading the full keypair.
 */
export function getSolanaWalletAddress(): string | null {
  if (!fs.existsSync(SOLANA_WALLET_FILE)) {
    return null;
  }

  const walletData: SolanaWalletData = JSON.parse(
    fs.readFileSync(SOLANA_WALLET_FILE, "utf-8"),
  );
  return walletData.publicKey;
}

/**
 * Load the full Solana keypair (needed for signing).
 */
export function loadSolanaKeypair(): Keypair | null {
  if (!fs.existsSync(SOLANA_WALLET_FILE)) {
    return null;
  }

  const walletData: SolanaWalletData = JSON.parse(
    fs.readFileSync(SOLANA_WALLET_FILE, "utf-8"),
  );
  const secretKey = bs58.decode(walletData.secretKey);
  return Keypair.fromSecretKey(secretKey);
}

export function solanaWalletExists(): boolean {
  return fs.existsSync(SOLANA_WALLET_FILE);
}

/**
 * Derive a Solana public key from a base58 string.
 */
export function toPublicKey(address: string): PublicKey {
  return new PublicKey(address);
}
