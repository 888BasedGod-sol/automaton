/**
 * Solana Funding Demo
 * 
 * Demonstrates the Solana funding capability of your automaton.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import fs from 'fs';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

async function main() {
  // Load wallet
  const wallet = JSON.parse(fs.readFileSync('data/solana-wallet.json', 'utf8'));
  const evmWallet = JSON.parse(fs.readFileSync('data/wallet.json', 'utf8'));
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           AUTOMATON - SOLANA FUNDING STATUS                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Connect to Solana
  const conn = new Connection('https://api.mainnet-beta.solana.com');
  const pubkey = new PublicKey(wallet.publicKey);
  
  // Get balances
  const solBalance = await conn.getBalance(pubkey);
  let usdcBalance = 0;
  
  try {
    const usdcAta = await getAssociatedTokenAddress(new PublicKey(USDC_MINT), pubkey);
    const account = await getAccount(conn, usdcAta);
    usdcBalance = Number(account.amount) / 1e6;
  } catch {}
  
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  WALLET ADDRESSES                                          │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  EVM (Base):    ${evmWallet.address}  │`);
  console.log(`│  Solana:        ${wallet.publicKey}  │`);
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  SOLANA BALANCES                                           │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  SOL:   ${(solBalance / 1e9).toFixed(4)} SOL                                         │`);
  console.log(`│  USDC:  $${usdcBalance.toFixed(2)} USDC                                        │`);
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  
  // Calculate funding capability
  const estimatedCredits = Math.floor(usdcBalance * 100);
  const estimatedInferenceCalls = Math.floor(usdcBalance / 0.01); // ~$0.01 per call
  const canAutoFund = usdcBalance >= 1.0;
  
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  FUNDING CAPABILITY                                        │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Auto-Fund Ready:      ${canAutoFund ? '✅ YES' : '❌ NO'}                              │`);
  console.log(`│  Estimated Credits:    ${estimatedCredits} cents ($${(estimatedCredits/100).toFixed(2)})               │`);
  console.log(`│  Est. Inference Calls: ~${estimatedInferenceCalls}                                │`);
  console.log(`│  SOL for Fees:         ${solBalance > 0 ? '✅ Available' : '❌ Need SOL for tx fees'}                        │`);
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  
  if (canAutoFund) {
    console.log('✅ Your Solana wallet is funded and ready!');
    console.log('');
    console.log('When the agent runs:');
    console.log('  1. Agent wakes up and checks Conway credits');
    console.log('  2. If credits < $5, auto-fund triggers');
    console.log('  3. $10 USDC transferred from Solana → Conway');
    console.log('  4. Agent continues operating');
    console.log('');
    console.log('To fully activate, you need a Conway API key:');
    console.log('  1. Sign up at https://conway.tech');
    console.log('  2. Create an automaton sandbox');
    console.log('  3. Export CONWAY_API_KEY=your_key_here');
    console.log('  4. Run: node dist/index.js --run');
  } else {
    console.log('❌ Need at least $1 USDC for auto-funding to work.');
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
