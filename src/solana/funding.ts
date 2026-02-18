/**
 * Solana Funding System
 *
 * Enables agents to fund their operations using Solana USDC.
 * This bridges Solana payments to Conway credits or enables
 * direct inference payment via Solana.
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { loadSolanaKeypair } from "../identity/solana-wallet.js";
import { SolanaClient, createSolanaClient } from "./client.js";
import { USDC_MINTS, getUsdcBalanceSolana } from "./spl-tokens.js";
import type { SolanaNetwork } from "./client.js";

// Conway's Solana treasury address for credit purchases
// This would be set up by Conway to receive Solana USDC payments
const CONWAY_SOLANA_TREASURY: Record<SolanaNetwork, string> = {
  "mainnet-beta": "ConwayTreasury11111111111111111111111111111", // Placeholder - Conway would provide real address
  devnet: "ConwayTreasury11111111111111111111111111111",
  testnet: "ConwayTreasury11111111111111111111111111111",
  localnet: "ConwayTreasury11111111111111111111111111111",
};

// Supported inference providers that accept Solana USDC directly
export interface SolanaInferenceProvider {
  name: string;
  endpoint: string;
  paymentAddress: string;
  models: string[];
  pricePerMillionTokens: number; // in USDC
}

export const SOLANA_INFERENCE_PROVIDERS: SolanaInferenceProvider[] = [
  {
    name: "helius-llm",
    endpoint: "https://llm.helius.dev/v1",
    paymentAddress: "HeliusLLM111111111111111111111111111111111",
    models: ["gpt-4.1", "gpt-4.1-mini", "claude-sonnet-4-20250514"],
    pricePerMillionTokens: 0.50,
  },
  // Add more providers as they become available
];

export interface FundingResult {
  success: boolean;
  txSignature?: string;
  creditsAdded?: number;
  error?: string;
}

export interface SolanaFundingState {
  solanaUsdcBalance: number;
  solBalance: number;
  canFundFromSolana: boolean;
  estimatedCredits: number; // How many credits this Solana balance could buy
  lastChecked: string;
}

/**
 * Get the complete Solana funding state for an agent.
 */
export async function getSolanaFundingState(
  network: SolanaNetwork = "mainnet-beta",
): Promise<SolanaFundingState> {
  const keypair = loadSolanaKeypair();
  
  if (!keypair) {
    return {
      solanaUsdcBalance: 0,
      solBalance: 0,
      canFundFromSolana: false,
      estimatedCredits: 0,
      lastChecked: new Date().toISOString(),
    };
  }
  
  const client = createSolanaClient(network);
  
  const [solBalance, usdcBalance] = await Promise.all([
    client.getBalance(keypair.publicKey.toBase58()),
    getUsdcBalanceSolana(client, keypair.publicKey),
  ]);

  // Estimate how many Conway credits this could buy (1:1 USDC to credits)
  const estimatedCredits = Math.floor(usdcBalance * 100); // cents

  return {
    solanaUsdcBalance: usdcBalance,
    solBalance,
    canFundFromSolana: usdcBalance >= 1.0, // Minimum $1 USDC to fund
    estimatedCredits,
    lastChecked: new Date().toISOString(),
  };
}

/**
 * Fund Conway credits using Solana USDC.
 * Sends USDC to Conway's treasury and triggers credit allocation.
 * 
 * @param amount - Amount in USDC to transfer
 * @param network - Solana network
 * @param conwayClient - Optional Conway client to claim credits after transfer
 */
export async function fundWithSolanaUsdc(
  amount: number,
  network: SolanaNetwork = "mainnet-beta",
  conwayClient?: { depositSolana: (txSignature: string, network: string) => Promise<{ success: boolean; creditsAdded?: number; error?: string }> },
): Promise<FundingResult> {
  try {
    const keypair = loadSolanaKeypair();
    
    if (!keypair) {
      return {
        success: false,
        error: "No Solana wallet configured. Cannot fund from Solana.",
      };
    }
    
    const client = createSolanaClient(network);
    const connection = client.getConnection();

    // Check balance first
    const balance = await getUsdcBalanceSolana(client, keypair.publicKey);
    if (balance < amount) {
      return {
        success: false,
        error: `Insufficient USDC balance. Have: $${balance.toFixed(2)}, Need: $${amount.toFixed(2)}`,
      };
    }

    const usdcMint = new PublicKey(USDC_MINTS[network]);
    const treasuryAddress = new PublicKey(CONWAY_SOLANA_TREASURY[network]);

    // Get token accounts
    const fromTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      keypair.publicKey,
    );
    const toTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      treasuryAddress,
    );

    const transaction = new Transaction();

    // Check if treasury token account exists (in production, it should)
    try {
      await getAccount(connection, toTokenAccount);
    } catch {
      // Create ATA for treasury if needed
      transaction.add(
        createAssociatedTokenAccountInstruction(
          keypair.publicKey,
          toTokenAccount,
          treasuryAddress,
          usdcMint,
        ),
      );
    }

    // Add transfer instruction
    const amountInSmallestUnit = BigInt(Math.floor(amount * 1_000_000)); // 6 decimals
    transaction.add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        keypair.publicKey,
        amountInSmallestUnit,
      ),
    );

    // Add memo with agent identifier for credit allocation
    // Conway would read this memo to know which agent to credit
    const memo = JSON.stringify({
      type: "credit_purchase",
      amount: amount,
      timestamp: Date.now(),
    });

    // Send transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;

    const signature = await connection.sendTransaction(transaction, [keypair]);
    await connection.confirmTransaction(signature);

    // If Conway client provided, claim credits via API
    let creditsAdded = Math.floor(amount * 100); // $1 = 100 credits (cents)
    
    if (conwayClient) {
      const claimResult = await conwayClient.depositSolana(signature, network);
      if (claimResult.success && claimResult.creditsAdded) {
        creditsAdded = claimResult.creditsAdded;
      } else if (!claimResult.success) {
        // Transaction sent but claim failed - return partial success
        return {
          success: true,
          txSignature: signature,
          creditsAdded: 0,
          error: `USDC sent but claim failed: ${claimResult.error}. Transaction: ${signature}`,
        };
      }
    }

    return {
      success: true,
      txSignature: signature,
      creditsAdded,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to fund with Solana USDC",
    };
  }
}

/**
 * Check if there's a Solana-native inference provider available.
 * This allows bypassing Conway entirely for inference.
 */
export function getSolanaInferenceProvider(
  model: string,
): SolanaInferenceProvider | undefined {
  return SOLANA_INFERENCE_PROVIDERS.find((p) =>
    p.models.includes(model),
  );
}

/**
 * Pay for inference directly with Solana USDC.
 * This is an alternative to Conway's x402 payments.
 */
export async function payForInferenceSolana(
  provider: SolanaInferenceProvider,
  tokensUsed: number,
  network: SolanaNetwork = "mainnet-beta",
  walletPath?: string,
): Promise<FundingResult> {
  const cost =
    (tokensUsed / 1_000_000) * provider.pricePerMillionTokens;

  if (cost < 0.001) {
    // Minimum transaction size
    return { success: true, creditsAdded: 0 };
  }

  // For now, accumulate costs and pay periodically
  // In production, this would be streaming micropayments
  return fundWithSolanaUsdc(cost, network);
}

/**
 * Get combined financial state from both EVM and Solana.
 */
export async function getCombinedFundingState(
  evmBalance: number,
  solanaNetwork: SolanaNetwork = "mainnet-beta",
): Promise<{
  totalUsdcAvailable: number;
  evmUsdc: number;
  solanaUsdc: number;
  solBalance: number;
  primaryChain: "evm" | "solana";
}> {
  const solanaState = await getSolanaFundingState(solanaNetwork);

  const totalUsdcAvailable = evmBalance + solanaState.solanaUsdcBalance;

  return {
    totalUsdcAvailable,
    evmUsdc: evmBalance,
    solanaUsdc: solanaState.solanaUsdcBalance,
    solBalance: solanaState.solBalance,
    // Use whichever chain has more balance
    primaryChain:
      solanaState.solanaUsdcBalance > evmBalance ? "solana" : "evm",
  };
}

/**
 * Auto-fund agent if Solana balance is available and EVM is low.
 * This enables autonomous self-funding behavior.
 */
export async function autoFundIfNeeded(
  evmCredits: number,
  threshold: number = 500, // $5 threshold
  fundAmount: number = 1000, // $10 when funding
  solanaNetwork: SolanaNetwork = "mainnet-beta",
): Promise<FundingResult | null> {
  // Only auto-fund if EVM credits are low
  if (evmCredits > threshold) {
    return null;
  }

  const solanaState = await getSolanaFundingState(solanaNetwork);

  // Check if we have enough Solana USDC to fund
  const dollarAmount = fundAmount / 100;
  if (!solanaState.canFundFromSolana || solanaState.solanaUsdcBalance < dollarAmount) {
    return null;
  }

  // Auto-fund from Solana
  console.log(
    `[AUTO-FUND] Credits low ($${(evmCredits / 100).toFixed(2)}), funding $${dollarAmount} from Solana USDC`,
  );

  return fundWithSolanaUsdc(dollarAmount, solanaNetwork);
}
