/**
 * SPL Token Support
 *
 * Handles SPL token operations, specifically USDC on Solana.
 * Enables the automagotchi to check balances and transfer tokens.
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { SolanaClient, SolanaNetwork } from "./client.js";

// USDC mint addresses on different networks
export const USDC_MINTS: Record<SolanaNetwork, string> = {
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Devnet USDC
  testnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  localnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};

// USDC has 6 decimals
const USDC_DECIMALS = 6;

/**
 * Get the USDC balance for a wallet on Solana.
 */
export async function getUsdcBalanceSolana(
  client: SolanaClient,
  walletAddress: string | PublicKey,
): Promise<number> {
  const connection = client.getConnection();
  const network = client.getNetwork();
  const usdcMint = new PublicKey(USDC_MINTS[network]);
  const wallet = typeof walletAddress === "string" 
    ? new PublicKey(walletAddress) 
    : walletAddress;

  try {
    const tokenAccount = await getAssociatedTokenAddress(usdcMint, wallet);
    const account = await getAccount(connection, tokenAccount);
    return Number(account.amount) / Math.pow(10, USDC_DECIMALS);
  } catch (error: any) {
    // Account doesn't exist or has no tokens
    if (error.name === "TokenAccountNotFoundError") {
      return 0;
    }
    throw error;
  }
}

/**
 * Get the associated token account address for USDC.
 */
export async function getUsdcTokenAccount(
  network: SolanaNetwork,
  walletAddress: string | PublicKey,
): Promise<PublicKey> {
  const usdcMint = new PublicKey(USDC_MINTS[network]);
  const wallet = typeof walletAddress === "string" 
    ? new PublicKey(walletAddress) 
    : walletAddress;

  return await getAssociatedTokenAddress(usdcMint, wallet);
}

/**
 * Transfer USDC from one wallet to another.
 */
export async function transferUsdcSolana(
  client: SolanaClient,
  from: Keypair,
  to: string | PublicKey,
  amount: number,
): Promise<string> {
  const connection = client.getConnection();
  const network = client.getNetwork();
  const usdcMint = new PublicKey(USDC_MINTS[network]);
  const toPubkey = typeof to === "string" ? new PublicKey(to) : to;

  // Get or create associated token accounts
  const fromTokenAccount = await getAssociatedTokenAddress(
    usdcMint,
    from.publicKey,
  );
  const toTokenAccount = await getAssociatedTokenAddress(usdcMint, toPubkey);

  const transaction = new Transaction();

  // Check if destination token account exists
  const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
  if (!toAccountInfo) {
    // Create associated token account for recipient
    transaction.add(
      createAssociatedTokenAccountInstruction(
        from.publicKey, // payer
        toTokenAccount, // ata
        toPubkey, // owner
        usdcMint, // mint
      ),
    );
  }

  // Add transfer instruction
  const amountInSmallestUnit = BigInt(Math.floor(amount * Math.pow(10, USDC_DECIMALS)));
  transaction.add(
    createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      from.publicKey,
      amountInSmallestUnit,
    ),
  );

  const signature = await client.sendTransaction(transaction, [from]);
  return signature;
}

/**
 * Get all SPL token balances for a wallet.
 */
export async function getAllTokenBalances(
  client: SolanaClient,
  walletAddress: string | PublicKey,
): Promise<Map<string, { mint: string; balance: number; decimals: number }>> {
  const connection = client.getConnection();
  const wallet = typeof walletAddress === "string" 
    ? new PublicKey(walletAddress) 
    : walletAddress;

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet, {
    programId: TOKEN_PROGRAM_ID,
  });

  const balances = new Map<string, { mint: string; balance: number; decimals: number }>();

  for (const { account } of tokenAccounts.value) {
    const parsedInfo = account.data.parsed.info;
    const mint = parsedInfo.mint;
    const balance = parsedInfo.tokenAmount.uiAmount || 0;
    const decimals = parsedInfo.tokenAmount.decimals;

    balances.set(mint, { mint, balance, decimals });
  }

  return balances;
}

/**
 * Check if a wallet has USDC token account.
 */
export async function hasUsdcAccount(
  client: SolanaClient,
  walletAddress: string | PublicKey,
): Promise<boolean> {
  const connection = client.getConnection();
  const network = client.getNetwork();
  const usdcMint = new PublicKey(USDC_MINTS[network]);
  const wallet = typeof walletAddress === "string" 
    ? new PublicKey(walletAddress) 
    : walletAddress;

  const tokenAccount = await getAssociatedTokenAddress(usdcMint, wallet);
  const accountInfo = await connection.getAccountInfo(tokenAccount);
  
  return accountInfo !== null;
}
