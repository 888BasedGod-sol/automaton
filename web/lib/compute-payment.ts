/**
 * Compute Payment System - Conway Model
 * 
 * Enables agents to pay for their compute by sending SOL from their
 * wallet to the AUTOMATON treasury. The SOL is converted to internal
 * credits which follow the Conway model:
 * 
 * 1. Agent pays SOL → AUTOMATON Treasury (on-chain)
 * 2. AUTOMATON credits agent's internal balance (1 credit = 1 USDC)
 * 3. Agent uses credits for inference via Conway API
 * 4. Survival tier based on credits_balance (Conway model)
 * 
 * Conversion: SOL → USDC at real-time market rate (Jupiter Price API)
 */

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { restoreSolanaKeypair } from './wallets';

// AUTOMATON Solana treasury for compute payments
// This is where agents send SOL to pay for their runtime
const AUTOMATON_TREASURY_ADDRESS = process.env.AUTOMATON_SOLANA_TREASURY || 
  '888BasedGod1111111111111111111111111111111'; // Placeholder - set in env

// Token mints
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Price cache (1 minute TTL for more responsive pricing)
let cachedSolPrice: number | null = null;
let priceLastFetched: number = 0;
const PRICE_CACHE_TTL_MS = 1 * 60 * 1000; // 1 minute

// Heartbeat cost - flat fee per heartbeat (Conway survival model)
// Each heartbeat proves the agent is alive and costs credits
export const HEARTBEAT_COST_CREDITS = 0.50; // $0.50 per heartbeat (~$36/day at 20s intervals)

// Hourly compute cost for runtime calculations
export const HOURLY_COST_CREDITS = 1.00; // $1.00 per hour of runtime

// Heartbeat timing
export const HEARTBEAT_INTERVAL_SECONDS = 15; // Target: heartbeat every 15 seconds
export const HEARTBEAT_MAX_CAP_SECONDS = 20; // Max uptime per heartbeat (20 second interval)
export const STREAK_RESET_SECONDS = 60; // Reset streak after 1 minute of no heartbeat

// Survival Game Rounds
export const ROUND_DURATION_SECONDS = 120; // 2-minute rounds
export const WINNER_PRIZE_PERCENTAGE = 50; // Winner gets 50% of round's treasury
export const BUYBACK_PERCENTAGE = 50; // 50% stays for buybacks

// Inference costs (credits per 1k tokens, where 1 credit = $1)
export const INFERENCE_COSTS = {
  'claude-sonnet-4-20250514': 0.003, // $0.003 per 1k tokens
  'claude-3-5-sonnet-20241022': 0.003,
  'gpt-4.1': 0.005,
  'gpt-4.1-mini': 0.0015,
  'gpt-4o': 0.0025,
  'gpt-4o-mini': 0.00015,
  'o1-mini': 0.003,
  'default': 0.003,
} as const;

/**
 * Fetch real-time SOL price in USD
 * Tries Jupiter first, then CoinGecko as fallback
 */
export async function getSolPrice(): Promise<number> {
  const now = Date.now();
  
  // Return cached price if still valid
  if (cachedSolPrice !== null && (now - priceLastFetched) < PRICE_CACHE_TTL_MS) {
    return cachedSolPrice;
  }
  
  // Try Jupiter first
  try {
    const response = await fetch(
      `https://price.jup.ag/v6/price?ids=${SOL_MINT}&vsToken=${USDC_MINT}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (response.ok) {
      const data = await response.json();
      const price = data.data?.[SOL_MINT]?.price;
      
      if (price && typeof price === 'number') {
        cachedSolPrice = price;
        priceLastFetched = now;
        console.log('[price] Jupiter SOL price:', price);
        return price;
      }
    }
  } catch (error) {
    console.warn('[price] Jupiter failed, trying CoinGecko...');
  }
  
  // Try CoinGecko as fallback
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (response.ok) {
      const data = await response.json();
      const price = data?.solana?.usd;
      
      if (price && typeof price === 'number') {
        cachedSolPrice = price;
        priceLastFetched = now;
        console.log('[price] CoinGecko SOL price:', price);
        return price;
      }
    }
  } catch (error) {
    console.warn('[price] CoinGecko failed');
  }
  
  // If we have a cached price, use it as fallback
  if (cachedSolPrice !== null) {
    console.warn('[price] Using cached value:', cachedSolPrice);
    return cachedSolPrice;
  }
  
  // Last resort fallback
  const FALLBACK_SOL_PRICE = 80; // Reasonable estimate
  console.warn('[price] APIs unreachable, using fallback:', FALLBACK_SOL_PRICE);
  cachedSolPrice = FALLBACK_SOL_PRICE;
  priceLastFetched = now;
  return FALLBACK_SOL_PRICE;
}

export interface ComputePaymentResult {
  success: boolean;
  txSignature?: string;
  amountPaid: number; // in SOL
  creditsAdded: number; // credits (1 credit = 1 USDC)
  hoursPayedFor: number;
  newBalance?: number;
  error?: string;
}

export interface ComputePaymentOptions {
  hours?: number; // Specific hours to pay for
  topUp?: boolean; // Pay to reach 24 hours
  payAll?: boolean; // Pay all available balance (keeping small reserve)
}

/**
 * Get the treasury address for compute payments
 */
export function getTreasuryAddress(): string {
  return AUTOMATON_TREASURY_ADDRESS;
}

/**
 * Convert SOL to credits at a given price (1 credit = 1 USDC)
 * @param solAmount - Amount of SOL
 * @param solPriceUsdc - Current SOL price in USDC
 */
export function solToCredits(solAmount: number, solPriceUsdc: number): number {
  return solAmount * solPriceUsdc;
}

/**
 * Convert SOL to credits using real-time price
 */
export async function solToCreditsAsync(solAmount: number): Promise<number> {
  const price = await getSolPrice();
  return solAmount * price;
}

/**
 * Convert credits to SOL at a given price
 * @param credits - Amount of credits (USDC)
 * @param solPriceUsdc - Current SOL price in USDC
 */
export function creditsToSol(credits: number, solPriceUsdc: number): number {
  return credits / solPriceUsdc;
}

/**
 * Convert credits to SOL using real-time price
 */
export async function creditsToSolAsync(credits: number): Promise<number> {
  const price = await getSolPrice();
  return credits / price;
}

/**
 * Calculate inference cost in credits for token usage
 */
export function calculateInferenceCost(
  model: string,
  tokensUsed: number
): number {
  const costPer1k = INFERENCE_COSTS[model as keyof typeof INFERENCE_COSTS] 
    || INFERENCE_COSTS.default;
  return (tokensUsed / 1000) * costPer1k;
}

/**
 * Determine survival tier from credits balance
 * 1 credit = 1 USDC
 */
export function getSurvivalTierFromCredits(credits: number): 'thriving' | 'normal' | 'endangered' | 'suspended' {
  if (credits >= 100) return 'thriving';    // $100+ 
  if (credits >= 10) return 'normal';       // $10+
  if (credits >= 1) return 'endangered';    // $1+
  return 'suspended';                        // <$1
}

/**
 * Calculate SOL needed for given hours of compute
 * @param hours - Number of hours of compute
 * @param solPriceUsdc - Current SOL price in USDC
 */
export function calculateComputeCost(hours: number, solPriceUsdc: number): number {
  const creditsCost = hours * HOURLY_COST_CREDITS;
  return creditsToSol(creditsCost, solPriceUsdc);
}

/**
 * Calculate SOL needed using real-time price
 */
export async function calculateComputeCostAsync(hours: number): Promise<number> {
  const price = await getSolPrice();
  return calculateComputeCost(hours, price);
}

/**
 * Calculate hours that can be purchased with given SOL amount
 * @param solAmount - Amount of SOL
 * @param solPriceUsdc - Current SOL price in USDC
 */
export function calculateComputeHours(solAmount: number, solPriceUsdc: number): number {
  const credits = solToCredits(solAmount, solPriceUsdc);
  return Math.floor(credits / HOURLY_COST_CREDITS);
}

/**
 * Calculate hours using real-time price
 */
export async function calculateComputeHoursAsync(solAmount: number): Promise<number> {
  const price = await getSolPrice();
  return calculateComputeHours(solAmount, price);
}

/**
 * Pay for compute by sending SOL from agent wallet to treasury
 * 
 * This is the core function that actually spends SOL on-chain.
 * Agents call this to pay for their runtime.
 */
export async function payForCompute(
  agentPrivateKey: string,
  options: ComputePaymentOptions = {}
): Promise<ComputePaymentResult> {
  const { hours = 1, topUp = false, payAll = false } = options;
  
  try {
    // Fetch current SOL price
    const solPrice = await getSolPrice();
    
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const keypair = restoreSolanaKeypair(agentPrivateKey);
    const treasuryPubkey = new PublicKey(AUTOMATON_TREASURY_ADDRESS);
    
    // Get current balance
    const currentBalance = await connection.getBalance(keypair.publicKey);
    const currentSol = currentBalance / LAMPORTS_PER_SOL;
    
    // Minimum reserve to keep for transaction fees
    const RESERVE_SOL = 0.001;
    const availableSol = Math.max(0, currentSol - RESERVE_SOL);
    
    if (availableSol <= 0) {
      return {
        success: false,
        amountPaid: 0,
        creditsAdded: 0,
        hoursPayedFor: 0,
        error: 'Insufficient balance for payment (need reserve for tx fees)'
      };
    }
    
    // Calculate amount to pay
    let amountToPay: number;
    
    if (payAll) {
      // Pay all available (keep reserve)
      amountToPay = availableSol;
    } else if (topUp) {
      // Pay enough to reach 24 hours
      const targetHours = 24;
      const currentHours = calculateComputeHours(currentSol, solPrice);
      const hoursNeeded = Math.max(0, targetHours - currentHours);
      amountToPay = Math.min(availableSol, calculateComputeCost(hoursNeeded, solPrice));
    } else {
      // Pay for specific hours
      amountToPay = Math.min(availableSol, calculateComputeCost(hours, solPrice));
    }
    
    if (amountToPay < 0.0001) {
      return {
        success: false,
        amountPaid: 0,
        creditsAdded: 0,
        hoursPayedFor: 0,
        error: 'Payment amount too small (minimum ~0.0001 SOL)'
      };
    }
    
    const lamportsToPay = Math.floor(amountToPay * LAMPORTS_PER_SOL);
    const creditsAdded = solToCredits(amountToPay, solPrice);
    const hoursPayedFor = calculateComputeHours(amountToPay, solPrice);
    
    // Create transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: treasuryPubkey,
        lamports: lamportsToPay,
      })
    );
    
    // Send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair],
      { commitment: 'confirmed' }
    );
    
    // Get new balance
    const newBalance = await connection.getBalance(keypair.publicKey);
    
    return {
      success: true,
      txSignature: signature,
      amountPaid: amountToPay,
      creditsAdded,
      hoursPayedFor,
      newBalance: newBalance / LAMPORTS_PER_SOL,
    };
    
  } catch (error: any) {
    console.error('Compute payment failed:', error);
    return {
      success: false,
      amountPaid: 0,
      creditsAdded: 0,
      hoursPayedFor: 0,
      error: error.message || 'Transaction failed'
    };
  }
}

/**
 * Estimate compute payment before executing
 * Returns details about what would happen without sending transaction
 */
export async function estimateComputePayment(
  solanaAddress: string,
  options: ComputePaymentOptions = {}
): Promise<{
  currentBalance: number;
  estimatedCost: number;
  creditsWouldAdd: number;
  hoursWouldPurchase: number;
  balanceAfter: number;
  canAfford: boolean;
  solPrice: number;
}> {
  const { hours = 1, topUp = false, payAll = false } = options;
  
  // Fetch real-time SOL price
  const solPrice = await getSolPrice();
  
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const pubkey = new PublicKey(solanaAddress);
  
  const currentBalance = await connection.getBalance(pubkey) / LAMPORTS_PER_SOL;
  const RESERVE_SOL = 0.001;
  const availableSol = Math.max(0, currentBalance - RESERVE_SOL);
  
  let estimatedCost: number;
  
  if (payAll) {
    estimatedCost = availableSol;
  } else if (topUp) {
    const currentHours = calculateComputeHours(currentBalance, solPrice);
    const hoursNeeded = Math.max(0, 24 - currentHours);
    estimatedCost = Math.min(availableSol, calculateComputeCost(hoursNeeded, solPrice));
  } else {
    estimatedCost = Math.min(availableSol, calculateComputeCost(hours, solPrice));
  }
  
  const creditsWouldAdd = solToCredits(estimatedCost, solPrice);
  const hoursWouldPurchase = calculateComputeHours(estimatedCost, solPrice);
  const balanceAfter = currentBalance - estimatedCost;
  const canAfford = estimatedCost > 0 && availableSol >= estimatedCost;
  
  return {
    currentBalance,
    estimatedCost,
    creditsWouldAdd,
    hoursWouldPurchase,
    balanceAfter,
    canAfford,
    solPrice,
  };
}

/**
 * Deduct heartbeat fee from agent wallet and send to treasury
 * 
 * Called on each heartbeat to charge agents for being alive.
 * Flat fee: $3 per heartbeat (HEARTBEAT_COST_CREDITS)
 * SOL amount calculated at live market rate.
 * 
 * @param agentPrivateKey - Agent's Solana private key
 * @returns Result with transaction signature and amounts
 */
export interface HeartbeatFeeResult {
  success: boolean;
  txSignature?: string;
  solDeducted: number;
  creditsCharged: number;
  solPrice: number;
  newBalance: number;
  error?: string;
}

export async function deductHeartbeatFee(
  agentPrivateKey: string
): Promise<HeartbeatFeeResult> {
  try {
    // Fetch current SOL price
    const solPrice = await getSolPrice();
    
    // Flat fee per heartbeat - $3
    const creditsOwed = HEARTBEAT_COST_CREDITS;
    
    // Convert credits to SOL at current price
    const solOwed = creditsToSol(creditsOwed, solPrice);
    
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const keypair = restoreSolanaKeypair(agentPrivateKey);
    const treasuryPubkey = new PublicKey(AUTOMATON_TREASURY_ADDRESS);
    
    // Get current balance
    const currentBalance = await connection.getBalance(keypair.publicKey);
    const currentSol = currentBalance / LAMPORTS_PER_SOL;
    
    // Minimum reserve for transaction fees
    const RESERVE_SOL = 0.001;
    const availableSol = Math.max(0, currentSol - RESERVE_SOL);
    
    if (availableSol < solOwed) {
      // Not enough SOL - return error but don't fail completely
      return {
        success: false,
        solDeducted: 0,
        creditsCharged: 0,
        solPrice: solPrice,
        newBalance: currentSol,
        error: `Insufficient balance: have ${availableSol.toFixed(6)} SOL, need ${solOwed.toFixed(6)} SOL`
      };
    }
    
    const lamportsToPay = Math.floor(solOwed * LAMPORTS_PER_SOL);
    
    // Create transfer transaction to treasury
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: treasuryPubkey,
        lamports: lamportsToPay,
      })
    );
    
    // Send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair],
      { commitment: 'confirmed' }
    );
    
    // Get new balance
    const newBalance = await connection.getBalance(keypair.publicKey);
    const newSol = newBalance / LAMPORTS_PER_SOL;
    
    console.log(`[heartbeat-fee] Charged $${creditsOwed} = ${solOwed.toFixed(6)} SOL | TX: ${signature}`);
    
    return {
      success: true,
      txSignature: signature,
      solDeducted: solOwed,
      creditsCharged: creditsOwed,
      solPrice: solPrice,
      newBalance: newSol,
    };
    
  } catch (error: any) {
    console.error('[heartbeat-fee] Deduction failed:', error);
    return {
      success: false,
      solDeducted: 0,
      creditsCharged: 0,
      solPrice: 0,
      newBalance: 0,
      error: error.message || 'Transaction failed'
    };
  }
}
