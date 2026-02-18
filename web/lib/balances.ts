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
