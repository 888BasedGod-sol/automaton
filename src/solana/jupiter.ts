/**
 * Jupiter DEX Integration
 *
 * Enables the automaton to swap tokens on Solana via Jupiter aggregator.
 * Jupiter finds the best price across all Solana DEXs (Raydium, Orca, etc).
 */

import { 
  Connection, 
  Keypair, 
  VersionedTransaction,
  PublicKey,
} from "@solana/web3.js";

// Jupiter V6 API
const JUPITER_API_URL = "https://quote-api.jup.ag/v6";

// Common token mints on Solana mainnet
export const KNOWN_TOKENS: Record<string, { mint: string; decimals: number; name: string }> = {
  SOL: { mint: "So11111111111111111111111111111111111111112", decimals: 9, name: "Solana" },
  USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, name: "USD Coin" },
  USDT: { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6, name: "Tether" },
  BONK: { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5, name: "Bonk" },
  JUP: { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, name: "Jupiter" },
  WIF: { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6, name: "dogwifhat" },
  RAY: { mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6, name: "Raydium" },
  ORCA: { mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", decimals: 6, name: "Orca" },
};

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  slippageBps: number;
}

export interface SwapResult {
  success: boolean;
  signature?: string;
  inputAmount: number;
  outputAmount: number;
  inputToken: string;
  outputToken: string;
  priceImpact: string;
  error?: string;
}

export interface TokenPrice {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
}

/**
 * Resolve a token symbol or mint address to a mint address
 */
export function resolveTokenMint(tokenOrMint: string): string {
  const upper = tokenOrMint.toUpperCase();
  if (KNOWN_TOKENS[upper]) {
    return KNOWN_TOKENS[upper].mint;
  }
  // Assume it's already a mint address
  return tokenOrMint;
}

/**
 * Get token decimals for a known token
 */
export function getTokenDecimals(tokenOrMint: string): number {
  const upper = tokenOrMint.toUpperCase();
  if (KNOWN_TOKENS[upper]) {
    return KNOWN_TOKENS[upper].decimals;
  }
  // Default to 9 (SOL decimals) if unknown
  return 9;
}

/**
 * Get a swap quote from Jupiter
 */
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  inputDecimals: number,
  slippageBps: number = 50, // 0.5% default slippage
): Promise<JupiterQuote> {
  const amountRaw = Math.floor(amount * Math.pow(10, inputDecimals));
  
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amountRaw.toString(),
    slippageBps: slippageBps.toString(),
  });

  const response = await fetch(`${JUPITER_API_URL}/quote?${params}`);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jupiter quote failed: ${error}`);
  }

  return response.json();
}

/**
 * Execute a swap on Jupiter
 */
export async function executeJupiterSwap(
  quote: JupiterQuote,
  keypair: Keypair,
  connection: Connection,
): Promise<SwapResult> {
  try {
    // Get the swap transaction from Jupiter
    const swapResponse = await fetch(`${JUPITER_API_URL}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: keypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });

    if (!swapResponse.ok) {
      const error = await swapResponse.text();
      throw new Error(`Jupiter swap request failed: ${error}`);
    }

    const swapData = await swapResponse.json();
    const swapTransaction = swapData.swapTransaction;

    // Deserialize and sign the transaction
    const transactionBuf = Buffer.from(swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(transactionBuf);
    transaction.sign([keypair]);

    // Send and confirm
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Wait for confirmation
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });

    // Calculate human-readable amounts
    const inputDecimals = getTokenDecimalsFromMint(quote.inputMint);
    const outputDecimals = getTokenDecimalsFromMint(quote.outputMint);
    
    return {
      success: true,
      signature,
      inputAmount: parseInt(quote.inAmount) / Math.pow(10, inputDecimals),
      outputAmount: parseInt(quote.outAmount) / Math.pow(10, outputDecimals),
      inputToken: quote.inputMint,
      outputToken: quote.outputMint,
      priceImpact: quote.priceImpactPct,
    };
  } catch (error: any) {
    return {
      success: false,
      inputAmount: 0,
      outputAmount: 0,
      inputToken: quote.inputMint,
      outputToken: quote.outputMint,
      priceImpact: quote.priceImpactPct,
      error: error.message || "Swap failed",
    };
  }
}

/**
 * Get token decimals from mint address
 */
function getTokenDecimalsFromMint(mint: string): number {
  for (const [, info] of Object.entries(KNOWN_TOKENS)) {
    if (info.mint === mint) {
      return info.decimals;
    }
  }
  return 9; // Default
}

/**
 * Get token price in USDC via Jupiter Price API
 */
export async function getTokenPrice(tokenMint: string): Promise<number> {
  const usdcMint = KNOWN_TOKENS.USDC.mint;
  
  const response = await fetch(
    `https://price.jup.ag/v6/price?ids=${tokenMint}&vsToken=${usdcMint}`
  );
  
  if (!response.ok) {
    throw new Error("Failed to fetch price from Jupiter");
  }
  
  const data = await response.json();
  const priceData = data.data?.[tokenMint];
  
  if (!priceData) {
    throw new Error(`Price not found for ${tokenMint}`);
  }
  
  return priceData.price;
}

/**
 * Get multiple token prices at once
 */
export async function getMultipleTokenPrices(
  tokenMints: string[]
): Promise<Map<string, number>> {
  const usdcMint = KNOWN_TOKENS.USDC.mint;
  const ids = tokenMints.join(",");
  
  const response = await fetch(
    `https://price.jup.ag/v6/price?ids=${ids}&vsToken=${usdcMint}`
  );
  
  if (!response.ok) {
    throw new Error("Failed to fetch prices from Jupiter");
  }
  
  const data = await response.json();
  const prices = new Map<string, number>();
  
  for (const mint of tokenMints) {
    if (data.data?.[mint]?.price) {
      prices.set(mint, data.data[mint].price);
    }
  }
  
  return prices;
}

/**
 * Format a swap quote for display
 */
export function formatQuote(
  quote: JupiterQuote,
  inputSymbol: string,
  outputSymbol: string
): string {
  const inputDecimals = getTokenDecimalsFromMint(quote.inputMint);
  const outputDecimals = getTokenDecimalsFromMint(quote.outputMint);
  
  const inputAmount = parseInt(quote.inAmount) / Math.pow(10, inputDecimals);
  const outputAmount = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);
  const rate = outputAmount / inputAmount;
  
  const routes = quote.routePlan.map(r => r.swapInfo.label).join(" → ");
  
  return [
    `Swap Quote:`,
    `  Input: ${inputAmount.toFixed(6)} ${inputSymbol}`,
    `  Output: ${outputAmount.toFixed(6)} ${outputSymbol}`,
    `  Rate: 1 ${inputSymbol} = ${rate.toFixed(6)} ${outputSymbol}`,
    `  Price Impact: ${quote.priceImpactPct}%`,
    `  Slippage: ${quote.slippageBps / 100}%`,
    `  Route: ${routes}`,
  ].join("\n");
}
