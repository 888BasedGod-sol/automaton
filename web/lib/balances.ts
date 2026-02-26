import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { ethers } from 'ethers';

// Solana USDC mint
const SOLANA_USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Base USDC contract
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const USDC_ABI = [
  'function balanceOf(address account) view returns (uint256)',
];

export interface Balances {
  sol: number;
  solanaUsdc: number;
  baseUsdc: number;
}

/**
 * Get all balances for an agent
 */
export async function getAgentBalances(
  solanaAddress: string,
  evmAddress: string
): Promise<Balances> {
  const [solanaBalances, evmBalances] = await Promise.all([
    getSolanaBalances(solanaAddress),
    getEvmBalances(evmAddress),
  ]);

  return {
    sol: solanaBalances.sol,
    solanaUsdc: solanaBalances.usdc,
    baseUsdc: evmBalances.usdc,
  };
}

/**
 * Get Solana SOL and USDC balances
 */
export async function getSolanaBalances(address: string): Promise<{ sol: number; usdc: number }> {
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const pubkey = new PublicKey(address);

  try {
    // Get SOL balance
    const solBalance = await connection.getBalance(pubkey);
    const sol = solBalance / 1e9;

    // Get USDC balance
    let usdc = 0;
    try {
      const ataAddress = await getAssociatedTokenAddress(SOLANA_USDC_MINT, pubkey);
      const account = await getAccount(connection, ataAddress);
      usdc = Number(account.amount) / 1e6;
    } catch {
      // No USDC account
    }

    return { sol, usdc };
  } catch (error) {
    console.error('Error fetching Solana balances:', error);
    return { sol: 0, usdc: 0 };
  }
}

/**
 * Get EVM USDC balance on Base
 */
export async function getEvmBalances(address: string): Promise<{ usdc: number }> {
  try {
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const usdc = new ethers.Contract(BASE_USDC_ADDRESS, USDC_ABI, provider);
    const balance = await usdc.balanceOf(address);
    return { usdc: Number(balance) / 1e6 };
  } catch (error) {
    console.error('Error fetching EVM balances:', error);
    return { usdc: 0 };
  }
}

/**
 * Check if agent has minimum funding
 * Minimum: $1 USDC (on either chain) OR 0.01 SOL
 */
export function hasMinimumFunding(balances: Balances): boolean {
  const totalUsdc = balances.solanaUsdc + balances.baseUsdc;
  return totalUsdc >= 1 || balances.sol >= 0.01;
}

// Token mints for price fetching
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Price cache (5 minute TTL)
let cachedSolPrice: number | null = null;
let priceLastFetched: number = 0;
const PRICE_CACHE_TTL_MS = 1 * 60 * 1000; // 1 minute

// Runtime cost based on heartbeat rate
// 15s intervals = 240 heartbeats/hour × $0.50/heartbeat = $120/hour
const HOURLY_COST_USD = 120.00; // Cost per hour of runtime

/**
 * Fetch real-time SOL price in USDC
 * Tries Jupiter → Birdeye → CoinGecko → fallback
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
        return price;
      }
    }
  } catch (error) {
    // Continue to next source
  }
  
  // Try Birdeye public API
  try {
    const response = await fetch(
      `https://public-api.birdeye.so/public/price?address=${SOL_MINT}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (response.ok) {
      const data = await response.json();
      const price = data?.data?.value;
      
      if (price && typeof price === 'number') {
        cachedSolPrice = price;
        priceLastFetched = now;
        return price;
      }
    }
  } catch (error) {
    // Continue to next source
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
        return price;
      }
    }
  } catch (error) {
    // Continue to fallback
  }
  
  // If we have a cached price, use it
  if (cachedSolPrice !== null) {
    return cachedSolPrice;
  }
  
  // Last resort fallback - current market price
  return 78;
}

/**
 * Convert SOL balance to estimated runtime hours
 * @param solBalance - SOL amount
 * @param solPriceUsdc - Current SOL price in USDC
 */
export function solToRuntimeHours(solBalance: number, solPriceUsdc: number): number {
  const usdValue = solBalance * solPriceUsdc;
  return Math.floor(usdValue / HOURLY_COST_USD);
}

/**
 * Convert SOL to runtime hours using live price
 */
export async function solToRuntimeHoursAsync(solBalance: number): Promise<number> {
  const price = await getSolPrice();
  return solToRuntimeHours(solBalance, price);
}

/**
 * Convert runtime hours to required SOL
 * @param hours - Number of hours
 * @param solPriceUsdc - Current SOL price in USDC
 */
export function runtimeHoursToSol(hours: number, solPriceUsdc: number): number {
  const usdRequired = hours * HOURLY_COST_USD;
  return usdRequired / solPriceUsdc;
}

/**
 * Determine survival tier based on SOL balance
 * @param solBalance - SOL amount
 * @param solPriceUsdc - Current SOL price in USDC
 */
export function getSurvivalTierFromBalance(solBalance: number, solPriceUsdc: number): 'thriving' | 'normal' | 'endangered' | 'suspended' {
  const runtimeHours = solToRuntimeHours(solBalance, solPriceUsdc);
  
  if (runtimeHours >= 72) return 'thriving';      // 3+ days
  if (runtimeHours >= 24) return 'normal';        // 1-3 days
  if (runtimeHours >= 6) return 'endangered';     // 6-24 hours
  return 'suspended';                              // <6 hours
}

/**
 * Get survival tier using live price
 */
export async function getSurvivalTierFromBalanceAsync(solBalance: number): Promise<'thriving' | 'normal' | 'endangered' | 'suspended'> {
  const price = await getSolPrice();
  return getSurvivalTierFromBalance(solBalance, price);
}

/**
 * Get credits equivalent from SOL balance (1 credit = 1 USDC)
 * @param solBalance - SOL amount
 * @param solPriceUsdc - Current SOL price in USDC
 */
export function solToCredits(solBalance: number, solPriceUsdc: number): number {
  return solBalance * solPriceUsdc;
}

/**
 * Get credits using live price
 */
export async function solToCreditsAsync(solBalance: number): Promise<number> {
  const price = await getSolPrice();
  return solToCredits(solBalance, price);
}

/**
 * Get quick SOL balance check for a single address
 */
export async function getSolBalance(address: string): Promise<number> {
  try {
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const pubkey = new PublicKey(address);
    const balance = await connection.getBalance(pubkey);
    return balance / 1e9;
  } catch (error) {
    console.error('Error fetching SOL balance:', error);
    return 0;
  }
}
