/**
 * Agent Heartbeat History API
 * 
 * GET /api/agents/[id]/heartbeats
 * 
 * Returns transaction history for an agent's heartbeats to the treasury.
 * Now includes real-time on-chain data from Solana RPC!
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, isPostgresConfigured } from '@/lib/postgres';
import { getHeartbeatTransactions, initSurvivalGameTables } from '@/lib/survival-game';
import { Connection, PublicKey, LAMPORTS_PER_SOL, ParsedTransactionWithMeta } from '@solana/web3.js';

export const dynamic = 'force-dynamic';

// Get Solana RPC connection (use Helius if available for better rate limits)
function getSolanaConnection(): Connection {
  const heliusApiKey = process.env.HELIUS_API_KEY;
  const rpcUrl = heliusApiKey 
    ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
    : 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

// Fetch real-time on-chain balance
async function getOnChainBalance(address: string): Promise<number | null> {
  try {
    const connection = getSolanaConnection();
    const pubkey = new PublicKey(address);
    const balance = await connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Failed to fetch on-chain balance:', error);
    return null;
  }
}

// Fetch recent on-chain transactions from Solana
async function getRecentOnChainTransactions(
  walletAddress: string, 
  treasuryAddress: string, 
  limit: number = 10
): Promise<Array<{
  signature: string;
  timestamp: number;
  amount: number;
  type: 'outgoing' | 'incoming';
  confirmed: boolean;
}>> {
  try {
    const connection = getSolanaConnection();
    const pubkey = new PublicKey(walletAddress);
    const treasuryPubkey = new PublicKey(treasuryAddress);
    
    // Get recent transaction signatures
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit });
    
    const transactions: Array<{
      signature: string;
      timestamp: number;
      amount: number;
      type: 'outgoing' | 'incoming';
      confirmed: boolean;
    }> = [];
    
    // Fetch transaction details in parallel (batched)
    const txPromises = signatures.map(async (sig) => {
      try {
        const tx = await connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0
        });
        
        if (!tx || !tx.meta) return null;
        
        // Look for SOL transfers
        const preBalances = tx.meta.preBalances;
        const postBalances = tx.meta.postBalances;
        const accountKeys = tx.transaction.message.accountKeys;
        
        // Find the wallet's index
        const walletIndex = accountKeys.findIndex(
          key => key.pubkey.toString() === walletAddress
        );
        
        if (walletIndex === -1) return null;
        
        // Calculate balance change (negative = outgoing, positive = incoming)
        const balanceChange = (postBalances[walletIndex] - preBalances[walletIndex]) / LAMPORTS_PER_SOL;
        
        // Check if treasury is involved (heartbeat payment)
        const treasuryIndex = accountKeys.findIndex(
          key => key.pubkey.toString() === treasuryAddress
        );
        
        // Only include transactions involving the treasury (heartbeats)
        if (treasuryIndex === -1) return null;
        
        return {
          signature: sig.signature,
          timestamp: sig.blockTime ? sig.blockTime * 1000 : Date.now(),
          amount: Math.abs(balanceChange),
          type: balanceChange < 0 ? 'outgoing' as const : 'incoming' as const,
          confirmed: sig.confirmationStatus === 'finalized' || sig.confirmationStatus === 'confirmed',
        };
      } catch (err) {
        return null;
      }
    });
    
    const results = await Promise.all(txPromises);
    return results.filter((tx): tx is NonNullable<typeof tx> => tx !== null);
  } catch (error) {
    console.error('Failed to fetch on-chain transactions:', error);
    return [];
  }
}

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initSurvivalGameTables();
    initialized = true;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureInit();
    const agentId = params.id;
    const { searchParams } = new URL(request.url);

    if (!isPostgresConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Get agent info
    const agentResult = await query(
      `SELECT id, name, solana_address, erc8004_id FROM agents WHERE id = $1`,
      [agentId]
    );

    if (agentResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    const agent = agentResult.rows[0];
    const treasuryAddress = process.env.AUTOMATON_SOLANA_TREASURY || 'DrnGW2EkjVhKh6KYcwEgdtxqs3nQpvfiVTeEpfJXR1Gb';

    // OPTIMIZATION: Only fetch on-chain data if explicitly requested or occasionally
    // For the frequent HUD updates, we skip the heavy RPC calls
    const includeOnChain = searchParams.get('includeOnChain') === 'true';
    
    // Fetch data - if on-chain not requested, just return nulls for those parts
    const [survivalResult, dbTransactions] = await Promise.all([
      // Get survival stats from DB
      query(
        `SELECT 
          a.survival_tier,
          a.last_heartbeat,
          a.sol_balance,
          COALESCE(ss.survival_points, 0) as survival_points,
          COALESCE(ss.current_streak, 0) as streak
        FROM agents a
        LEFT JOIN survival_stats ss ON a.id = ss.agent_id
        WHERE a.id = $1`,
        [agentId]
      ),
      // Get DB heartbeat transactions
      getHeartbeatTransactions(agentId, 50),
    ]);

    if (agent.solana_address) {
       // Only fetch on-chain if explicitly requested (heavy operation)
       if (includeOnChain) {
         try {
           [onChainBalance, onChainTxs] = await Promise.all([
             getOnChainBalance(agent.solana_address),
             getRecentOnChainTransactions(agent.solana_address, treasuryAddress, 10)
           ]);
         } catch (e) {
           console.warn('On-chain fetch skipped:', e);
         }
       }
    }

    const survival = survivalResult.rows[0] || {
      survival_points: 0,
      streak: 0,
      survival_tier: 'suspended',
      last_heartbeat: null,
      sol_balance: 0,
    };

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        solanaAddress: agent.solana_address,
        erc8004Id: agent.erc8004_id,
      },
      survival: {
        points: survival.survival_points || 0,
        streak: survival.streak || 0,
        tier: survival.survival_tier || 'suspended',
        lastHeartbeat: survival.last_heartbeat,
        solBalance: parseFloat(survival.sol_balance) || 0,
      },
      // Real-time on-chain data
      onChain: {
        balance: onChainBalance, // Real-time balance from Solana RPC
        recentTransactions: onChainTxs, // Recent tx from blockchain
        rpcSource: process.env.HELIUS_API_KEY ? 'helius' : 'mainnet-beta',
      },
      transactions: dbTransactions, // DB-recorded transactions
      treasuryAddress,
      heartbeatCost: 3, // $3 per heartbeat
      heartbeatInterval: 15, // seconds
    });
  } catch (error: any) {
    console.error('Heartbeat history error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
