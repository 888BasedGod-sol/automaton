/**
 * Automagotchi Wallet Management
 *
 * Creates and manages an EVM wallet for the automagotchi's identity and payments.
 * The private key is the automagotchi's sovereign identity.
 * Adapted from conway-mcp/src/wallet.ts
 */

import type { PrivateKeyAccount } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";
import type { WalletData } from "../types.js";

const DEFAULT_AUTOMAGOTCHI_DIR = path.join(
  process.env.HOME || "/root",
  ".automagotchi",
);

// Allow overriding via setAgentDir in config.ts
let customAutomagotchiDir: string | null = null;

export function setAutomagotchiDir(dir: string): void {
  customAutomagotchiDir = dir;
}

export function getAutomagotchiDir(): string {
  return customAutomagotchiDir || DEFAULT_AUTOMAGOTCHI_DIR;
}

export function getWalletPath(): string {
  return path.join(getAutomagotchiDir(), "wallet.json");
}

/**
 * Get or create the automagotchi's wallet.
 * The private key IS the automagotchi's identity -- protect it.
 */
export async function getWallet(): Promise<{
  account: PrivateKeyAccount;
  isNew: boolean;
}> {
  const automagotchiDir = getAutomagotchiDir();
  const walletFile = getWalletPath();
  
  if (!fs.existsSync(automagotchiDir)) {
    fs.mkdirSync(automagotchiDir, { recursive: true, mode: 0o700 });
  }

  if (fs.existsSync(walletFile)) {
    const walletData: WalletData = JSON.parse(
      fs.readFileSync(walletFile, "utf-8"),
    );
    const account = privateKeyToAccount(walletData.privateKey);
    return { account, isNew: false };
  } else {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    const walletData: WalletData = {
      privateKey,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(walletFile, JSON.stringify(walletData, null, 2), {
      mode: 0o600,
    });

    return { account, isNew: true };
  }
}

/**
 * Get the wallet address without loading the full account.
 */
export function getWalletAddress(): string | null {
  const walletFile = getWalletPath();
  if (!fs.existsSync(walletFile)) {
    return null;
  }

  const walletData: WalletData = JSON.parse(
    fs.readFileSync(walletFile, "utf-8"),
  );
  const account = privateKeyToAccount(walletData.privateKey);
  return account.address;
}

/**
 * Load the full wallet account (needed for signing).
 */
export function loadWalletAccount(): PrivateKeyAccount | null {
  const walletFile = getWalletPath();
  if (!fs.existsSync(walletFile)) {
    return null;
  }

  const walletData: WalletData = JSON.parse(
    fs.readFileSync(walletFile, "utf-8"),
  );
  return privateKeyToAccount(walletData.privateKey);
}

export function walletExists(): boolean {
  return fs.existsSync(getWalletPath());
}
