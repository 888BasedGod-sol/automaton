import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createPublicClient, http, parseAbi, type Address, createWalletClient, parseUnits, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { loadTreasuryConfig } from '@/lib/treasury';
import { getDb } from '@/lib/db-singleton';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

// Base USDC contract address
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;

// Base Treasury address (receives deposits and sends credits)
const BASE_TREASURY_ADDRESS = '0xd3d03f57c60bBEFE645cd6Bb14f1CE2c1915e898' as Address;

// Solana Treasury address (mainnet)
const SOLANA_TREASURY_ADDRESS = '4GZMepeTYJ5dP3M7yCTZb7qdGj1sFbn8zCZubCHJD5pX';

// USDC has 6 decimals
const USDC_DECIMALS = 6;

// ERC20 ABI for USDC transfers
const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

// Processed transactions cache (to prevent double-claiming)
const processedTxs = new Set<string>();

// Conway API configuration
const CONWAY_API_URL = process.env.CONWAY_API_URL || 'https://api.conway.tech';

// SOL price cache (5 minute TTL)
let cachedSolPrice: { price: number; timestamp: number } | null = null;
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Local credits tracking (in-memory for serverless, would use DB in production)
const agentCredits = new Map<string, number>();

/**
 * Fetch live SOL/USD price from Jupiter or CoinGecko
 */
async function getSolUsdPrice(): Promise<number> {
  // Return cached price if valid
  if (cachedSolPrice && Date.now() - cachedSolPrice.timestamp < PRICE_CACHE_TTL) {
    return cachedSolPrice.price;
  }
  
  try {
    // Use CoinGecko (more reliable than Jupiter v6 API)
    const cgRes = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { cache: 'no-store' }
    );
    
    if (cgRes.ok) {
      const data = await cgRes.json();
      if (data.solana?.usd) {
        const price = data.solana.usd;
        cachedSolPrice = { price, timestamp: Date.now() };
        console.log(`[Credits API] SOL price: $${price}`);
        return price;
      }
    }
    
    // Fallback to cached or default
    console.log('[Credits API] Using cached/fallback SOL price');
    return cachedSolPrice?.price || 150;
  } catch (e) {
    console.error('[Credits API] Failed to fetch SOL price:', e);
    return cachedSolPrice?.price || 150;
  }
}

/**
 * Load Conway API key from config
 */
function getConwayApiKey(): string | null {
  try {
    const configPath = path.join(os.homedir(), '.automaton', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.apiKey || null;
    }
  } catch (e) {
    console.error('[Credits API] Failed to load Conway config:', e);
  }
  return process.env.CONWAY_API_KEY || null;
}

/**
 * Add Conway credits to an agent's account
 * 
 * Called after verifying a deposit to our treasury.
 * Tries Conway API first, then falls back to local tracking.
 */
async function addConwayCredits(
  agentAddress: string,
  amountUsdc: number
): Promise<{ success: boolean; creditsPurchased?: number; method?: string; error?: string }> {
  const apiKey = getConwayApiKey();
  const amountCents = Math.floor(amountUsdc * 100);
  
  // Method 1: Try Conway's add-credits API (if available)
  if (apiKey) {
    try {
      const addRes = await fetch(`${CONWAY_API_URL}/v1/credits/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify({
          wallet_address: agentAddress,
          amount_cents: amountCents,
          source: 'automaton_deposit',
        }),
      });
      
      if (addRes.ok) {
        const data = await addRes.json();
        console.log(`[Credits API] Added ${amountUsdc} Conway credits to ${agentAddress} via API`);
        return {
          success: true,
          creditsPurchased: amountUsdc,
          method: 'conway_api',
        };
      }
      
      // Try alternate endpoint format
      const altRes = await fetch(`${CONWAY_API_URL}/v1/wallets/${agentAddress}/credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify({
          amount_cents: amountCents,
          source: 'automaton_deposit',
        }),
      });
      
      if (altRes.ok) {
        console.log(`[Credits API] Added ${amountUsdc} Conway credits to ${agentAddress} via wallet endpoint`);
        return {
          success: true,
          creditsPurchased: amountUsdc,
          method: 'conway_wallet_api',
        };
      }
    } catch (e) {
      console.log('[Credits API] Conway API not available, using local tracking');
    }
  }
  
  // Method 2: Local credit tracking (always succeeds after verified deposit)
  const currentCredits = agentCredits.get(agentAddress.toLowerCase()) || 0;
  agentCredits.set(agentAddress.toLowerCase(), currentCredits + amountCents);
  
  console.log(`[Credits API] Added ${amountUsdc} credits locally to ${agentAddress} (total: ${(currentCredits + amountCents) / 100})`);
  
  return {
    success: true,
    creditsPurchased: amountUsdc,
    method: 'local_tracking',
  };
}

/**
 * Get Conway credits balance for an agent
 */
async function getAgentCreditsBalance(agentAddress: string): Promise<number> {
  const apiKey = getConwayApiKey();
  
  // Try Conway API first
  if (apiKey) {
    try {
      const res = await fetch(`${CONWAY_API_URL}/v1/wallets/${agentAddress}/credits`, {
        headers: { 'Authorization': apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        return (data.balance_cents ?? data.credits_cents ?? 0) / 100;
      }
    } catch (e) {
      // Fall through to local
    }
  }
  
  // Return local tracked credits
  const cents = agentCredits.get(agentAddress.toLowerCase()) || 0;
  return cents / 100;
}

/**
 * Get current Conway credits balance (platform total)
 */
async function getConwayBalance(): Promise<number | null> {
  const apiKey = getConwayApiKey();
  if (!apiKey) return null;
  
  try {
    const res = await fetch(`${CONWAY_API_URL}/v1/credits/balance`, {
      headers: { 'Authorization': apiKey },
    });
    if (res.ok) {
      const data = await res.json();
      return (data.balance_cents ?? data.credits_cents ?? 0) / 100;
    }
  } catch (e) {
    console.error('[Credits API] Failed to fetch Conway balance:', e);
  }
  return null;
}

// Initialize DB table for tracking deposits
function initDepositsTable() {
  const db = getDb();
  if (!db) return; // Skip in serverless mode
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS credit_deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT UNIQUE NOT NULL,
      chain TEXT NOT NULL,
      asset TEXT NOT NULL,
      amount_raw TEXT NOT NULL,
      amount_credits REAL NOT NULL,
      user_base_address TEXT NOT NULL,
      outbound_tx_hash TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      processed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_deposits_tx ON credit_deposits(tx_hash);
    CREATE INDEX IF NOT EXISTS idx_deposits_user ON credit_deposits(user_base_address);
  `);
}

/**
 * GET /api/credits - Get treasury addresses for deposits
 */
export async function GET(request: NextRequest) {
  const solPrice = await getSolUsdPrice();
  const conwayBalance = await getConwayBalance();
  
  return NextResponse.json({
    success: true,
    treasury: {
      solana: {
        address: SOLANA_TREASURY_ADDRESS,
        network: 'mainnet',
      },
      base: {
        address: BASE_TREASURY_ADDRESS,
        usdcContract: BASE_USDC_ADDRESS,
      },
    },
    rates: {
      sol_usd: solPrice,
      usdc: 1,
    },
    conway: {
      balance: conwayBalance,
      configured: !!getConwayApiKey(),
    },
  });
}

/**
 * Auto-detect chain from transaction hash format
 */
function detectChainFromTxHash(txHash: string): 'solana' | 'base' | 'unknown' {
  // Base/Ethereum tx hashes start with 0x and are 66 chars
  if (txHash.startsWith('0x') && txHash.length === 66) {
    return 'base';
  }
  // Solana signatures are base58, typically 87-88 chars
  if (txHash.length >= 80 && txHash.length <= 90 && !txHash.startsWith('0x')) {
    return 'solana';
  }
  return 'unknown';
}

/**
 * POST /api/credits - Claim credits after deposit
 * 
 * Body: { action: 'claim', txHash, chain?, asset?, userBaseAddress }
 */
export async function POST(request: NextRequest) {
  try {
    initDepositsTable();
    
    const body = await request.json();
    let { action, txHash, chain, asset, userBaseAddress } = body;
    
    if (action !== 'claim') {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
    
    // Validate txHash
    if (!txHash) {
      return NextResponse.json({
        success: false,
        error: 'Missing transaction hash',
      }, { status: 400 });
    }
    
    txHash = txHash.trim();
    
    // Auto-detect chain if not provided
    if (!chain) {
      chain = detectChainFromTxHash(txHash);
      if (chain === 'unknown') {
        return NextResponse.json({
          success: false,
          error: 'Could not detect chain from transaction hash. Solana signatures are ~88 chars, Base tx hashes start with 0x and are 66 chars.',
        }, { status: 400 });
      }
    }
    
    // Default asset based on chain
    if (!asset) {
      asset = 'usdc'; // Default to USDC
    }
    
    if (!['solana', 'base'].includes(chain)) {
      return NextResponse.json({ success: false, error: 'Invalid chain' }, { status: 400 });
    }
    
    if (!['sol', 'usdc'].includes(asset)) {
      return NextResponse.json({ success: false, error: 'Invalid asset' }, { status: 400 });
    }
    
    if (chain === 'base' && asset !== 'usdc') {
      return NextResponse.json({ success: false, error: 'Only USDC deposits supported on Base' }, { status: 400 });
    }
    
    // Validate Base address format (only required for Base deposits or if provided)
    const isValidBaseAddress = userBaseAddress && userBaseAddress.match(/^0x[a-fA-F0-9]{40}$/) && userBaseAddress !== '0x0000000000000000000000000000000000000000';
    
    // Prevent sending to treasury (that's where deposits go, not agent wallets)
    if (userBaseAddress && userBaseAddress.toLowerCase() === BASE_TREASURY_ADDRESS.toLowerCase()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot send credits to treasury address. Enter your agent\'s Base wallet address instead.' 
      }, { status: 400 });
    }
    
    // Base deposits require a valid Base address
    if (chain === 'base' && !isValidBaseAddress) {
      return NextResponse.json({ success: false, error: 'Valid Base wallet address required for Base deposits' }, { status: 400 });
    }
    
    // Check if already processed
    const db = getDb();
    if (db) {
      const existing = db.prepare('SELECT * FROM credit_deposits WHERE tx_hash = ?').get(txHash);
      if (existing) {
        return NextResponse.json({
          success: false,
          error: 'This transaction has already been claimed',
        }, { status: 400 });
      }
    }
    
    // Verify the deposit transaction - try detected chain first, then fallback
    let depositAmount: number | undefined;
    let senderWallet: string | undefined;
    let verifiedChain: string = chain;
    let verifiedAsset: string = asset;
    let lastError: string = '';
    
    if (chain === 'solana') {
      // Try Solana USDC first
      let result = await verifySolanaDeposit(txHash, 'usdc');
      if (result.success) {
        depositAmount = result.amount;
        senderWallet = result.senderWallet;
        verifiedAsset = 'usdc';
      } else {
        const usdcError = result.error || 'USDC verification failed';
        // Try SOL as second option
        result = await verifySolanaDeposit(txHash, 'sol');
        if (result.success) {
          depositAmount = result.amount;
          senderWallet = result.senderWallet;
          verifiedAsset = 'sol';
          console.log(`[Credits API] Verified SOL deposit: $${result.amount?.toFixed(2)} from ${result.senderWallet}`);
        } else {
          lastError = `Solana USDC: ${usdcError}. SOL: ${result.error || 'SOL verification failed'}`;
        }
      }
    } else {
      // Try Base first
      const result = await verifyBaseDeposit(txHash);
      if (result.success) {
        depositAmount = result.amount;
        senderWallet = result.senderWallet;
      } else {
        lastError = result.error || 'Base verification failed';
        // Try Solana as fallback
        const solResult = await verifySolanaDeposit(txHash, 'usdc');
        if (solResult.success) {
          depositAmount = solResult.amount;
          senderWallet = solResult.senderWallet;
          verifiedChain = 'solana';
        } else {
          lastError = `Base: ${lastError}. Solana: ${solResult.error || 'verification failed'}`;
        }
      }
    }
    
    if (!depositAmount) {
      return NextResponse.json({ 
        success: false, 
        error: `Failed to verify: ${lastError}`,
        detectedChain: chain,
      }, { status: 400 });
    }
    
    // Minimum deposit check
    if (depositAmount < 5) {
      return NextResponse.json({
        success: false,
        error: `Deposit too small. Minimum $5 USDC equivalent. Received: $${depositAmount.toFixed(2)}`,
        senderWallet,
        amount: depositAmount,
        chain: verifiedChain,
      }, { status: 400 });
    }
    
    // Record the deposit (skip if db not available)
    if (db) {
      db.prepare(`
        INSERT INTO credit_deposits (tx_hash, chain, asset, amount_raw, amount_credits, user_base_address, status)
        VALUES (?, ?, ?, ?, ?, ?, 'verified')
      `).run(txHash, verifiedChain, asset, depositAmount.toString(), depositAmount, userBaseAddress);
    }
    
    // If no valid Base address, just record the deposit as verified and ask for address
    if (!isValidBaseAddress) {
      if (db) {
        db.prepare('UPDATE credit_deposits SET status = ? WHERE tx_hash = ?').run('verified_no_address', txHash);
      }
      return NextResponse.json({
        success: true,
        message: `Deposit verified! $${depositAmount.toFixed(2)} received from ${senderWallet?.slice(0, 8)}...${senderWallet?.slice(-6)}. Provide an agent Base wallet to receive credits.`,
        amount: depositAmount,
        senderWallet,
        note: 'Provide agent Base wallet address to receive credits.',
      });
    }
    
    // Add Conway credits to the agent's wallet
    const conwayResult = await addConwayCredits(userBaseAddress, depositAmount);
    
    // Update DB with success
    if (db) {
      db.prepare(`
        UPDATE credit_deposits 
        SET status = 'completed', processed_at = datetime('now')
        WHERE tx_hash = ?
      `).run(txHash);
    }
    
    // Get agent's updated balance
    const agentBalance = await getAgentCreditsBalance(userBaseAddress);
    
    return NextResponse.json({
      success: true,
      message: `Successfully added ${depositAmount.toFixed(2)} Conway credits to agent!`,
      amount: depositAmount,
      senderWallet,
      agentWallet: userBaseAddress,
      creditsAdded: conwayResult.creditsPurchased,
      agentBalance,
      method: conwayResult.method,
    });
    
  } catch (error: any) {
    console.error('Credits POST error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to process claim',
    }, { status: 500 });
  }
}

/**
 * Verify a Solana deposit transaction
 */
async function verifySolanaDeposit(
  txHash: string,
  asset: 'sol' | 'usdc'
): Promise<{ success: boolean; amount?: number; senderWallet?: string; error?: string }> {
  // Use hardcoded mainnet treasury address
  const treasuryPubkey = SOLANA_TREASURY_ADDRESS;
  // USDC mint on Solana mainnet
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  // Use Helius RPC for faster transaction lookups
  const heliusApiKey = process.env.HELIUS_API_KEY;
  const rpc = heliusApiKey 
    ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
    : 'https://api.mainnet-beta.solana.com';
  
  const connection = new Connection(rpc, 'confirmed');
  
  try {
    const tx = await connection.getParsedTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
    });
    
    if (!tx) {
      return { success: false, error: 'Transaction not found. Please wait a few seconds for confirmation and try again.' };
    }
    
    if (tx.meta?.err) {
      return { success: false, error: 'Transaction failed on-chain' };
    }
    
    // Get the fee payer (sender) - first account is typically the fee payer
    const accounts = tx.transaction.message.accountKeys;
    const senderWallet = accounts[0]?.pubkey.toBase58();
    
    if (asset === 'sol') {
      // Check for SOL transfer to treasury
      const preBalance = tx.meta?.preBalances || [];
      const postBalance = tx.meta?.postBalances || [];
      
      const treasuryIndex = accounts.findIndex(a => a.pubkey.toBase58() === treasuryPubkey);
      if (treasuryIndex === -1) {
        return { success: false, error: 'Transaction does not involve treasury wallet' };
      }
      
      const received = (postBalance[treasuryIndex] - preBalance[treasuryIndex]) / LAMPORTS_PER_SOL;
      if (received <= 0) {
        return { success: false, error: 'No SOL received by treasury' };
      }
      
      // Convert SOL to USDC at live market rate
      const solUsdRate = await getSolUsdPrice();
      const usdcAmount = received * solUsdRate;
      
      console.log(`[Credits API] Verified SOL deposit: ${received} SOL ($${usdcAmount.toFixed(2)}) from ${senderWallet}`);
      return { success: true, amount: usdcAmount, senderWallet };
    } else {
      // USDC transfer - parse token transfer instructions
      const instructions = tx.transaction.message.instructions;
      
      for (const ix of instructions) {
        // Check if it's a parsed instruction (SPL Token program)
        if ('parsed' in ix && ix.program === 'spl-token') {
          const parsed = ix.parsed;
          
          // Handle transfer or transferChecked
          if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
            const info = parsed.info;
            
            // For transferChecked, verify it's USDC mint
            if (parsed.type === 'transferChecked' && info.mint !== USDC_MINT) {
              continue;
            }
            
            // Get the destination token account owner
            // We need to check if the destination token account belongs to treasury
            const destAccount = info.destination;
            
            // Check pre/post token balances to verify treasury received USDC
            const preTokenBalances = tx.meta?.preTokenBalances || [];
            const postTokenBalances = tx.meta?.postTokenBalances || [];
            
            // Find token balance changes for USDC to treasury
            for (const postBal of postTokenBalances) {
              if (postBal.mint === USDC_MINT && postBal.owner === treasuryPubkey) {
                const preBal = preTokenBalances.find(
                  b => b.accountIndex === postBal.accountIndex && b.mint === USDC_MINT
                );
                
                const preAmount = preBal?.uiTokenAmount?.uiAmount || 0;
                const postAmount = postBal.uiTokenAmount?.uiAmount || 0;
                const received = postAmount - preAmount;
                
                if (received > 0) {
                  // Found USDC received by treasury
                  // Get sender from the authority field
                  const senderFromTx = info.authority || info.source || senderWallet;
                  
                  console.log(`[Credits API] Verified USDC deposit: $${received.toFixed(2)} from ${senderFromTx}`);
                  return { success: true, amount: received, senderWallet: senderFromTx };
                }
              }
            }
          }
        }
      }
      
      // Fallback: Check token balance changes directly
      const preTokenBalances = tx.meta?.preTokenBalances || [];
      const postTokenBalances = tx.meta?.postTokenBalances || [];
      
      for (const postBal of postTokenBalances) {
        if (postBal.mint === USDC_MINT && postBal.owner === treasuryPubkey) {
          const preBal = preTokenBalances.find(
            b => b.accountIndex === postBal.accountIndex && b.mint === USDC_MINT
          );
          
          const preAmount = preBal?.uiTokenAmount?.uiAmount || 0;
          const postAmount = postBal.uiTokenAmount?.uiAmount || 0;
          const received = postAmount - preAmount;
          
          if (received > 0) {
            console.log(`[Credits API] Verified USDC deposit (fallback): $${received.toFixed(2)} from ${senderWallet}`);
            return { success: true, amount: received, senderWallet };
          }
        }
      }
      
      return { success: false, error: 'No USDC transfer to treasury found in this transaction' };
    }
  } catch (e: any) {
    console.error('[Credits API] Solana verification error:', e);
    return { success: false, error: `Failed to verify: ${e.message}` };
  }
}

/**
 * Verify a Base USDC deposit transaction
 */
async function verifyBaseDeposit(
  txHash: string
): Promise<{ success: boolean; amount?: number; senderWallet?: string; error?: string }> {
  const client = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });
  
  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    
    if (!receipt) {
      return { success: false, error: 'Transaction not found' };
    }
    
    if (receipt.status !== 'success') {
      return { success: false, error: 'Transaction failed' };
    }
    
    // Look for USDC Transfer event to treasury
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // Transfer(address,address,uint256)
    
    for (const log of receipt.logs) {
      if (
        log.address.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase() &&
        log.topics[0] === transferTopic
      ) {
        // Check if recipient is treasury
        const fromAddress = '0x' + log.topics[1]?.slice(26);
        const toAddress = '0x' + log.topics[2]?.slice(26);
        if (toAddress.toLowerCase() === BASE_TREASURY_ADDRESS.toLowerCase()) {
          // Parse amount from data
          const amount = BigInt(log.data);
          const usdcAmount = Number(amount) / Math.pow(10, USDC_DECIMALS);
          console.log(`[Credits API] Verified Base USDC deposit: $${usdcAmount.toFixed(2)} from ${fromAddress}`);
          return { success: true, amount: usdcAmount, senderWallet: fromAddress };
        }
      }
    }
    
    return { success: false, error: 'No USDC transfer to treasury found in this transaction' };
  } catch (e: any) {
    return { success: false, error: `Failed to verify: ${e.message}` };
  }
}

/**
 * Send USDC to user on Base
 */
async function sendUsdcOnBase(
  toAddress: Address,
  amount: number
): Promise<{ success: boolean; txHash?: string; error?: string; amountSent?: number }> {
  // Check for private key in environment
  const privateKey = process.env.BASE_TREASURY_PRIVATE_KEY;
  if (!privateKey) {
    return { success: false, error: 'Base treasury private key not configured' };
  }
  
  try {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    const publicClient = createPublicClient({
      chain: base,
      transport: http('https://mainnet.base.org'),
    });
    
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http('https://mainnet.base.org'),
    });
    
    // Check treasury USDC balance
    const balance = await publicClient.readContract({
      address: BASE_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [BASE_TREASURY_ADDRESS],
    });
    
    let amountRaw = BigInt(Math.floor(amount * Math.pow(10, USDC_DECIMALS)));
    let actualAmount = amount;
    
    // If insufficient balance, send whatever is available (min $1)
    if (balance < amountRaw) {
      const availableAmount = Number(balance) / Math.pow(10, USDC_DECIMALS);
      if (availableAmount < 1) {
        return { success: false, error: `Insufficient USDC in treasury. Available: $${availableAmount.toFixed(2)}` };
      }
      console.log(`[Credits API] Treasury low: sending $${availableAmount.toFixed(2)} of requested $${amount.toFixed(2)}`);
      amountRaw = balance;
      actualAmount = availableAmount;
    }
    
    // Send USDC
    const hash = await walletClient.writeContract({
      address: BASE_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [toAddress, amountRaw],
    });
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status !== 'success') {
      return { success: false, error: 'Transfer transaction failed' };
    }
    
    return { success: true, txHash: hash, amountSent: actualAmount };
  } catch (e: any) {
    console.error('sendUsdcOnBase error:', e);
    return { success: false, error: e.message || 'Transfer failed' };
  }
}
