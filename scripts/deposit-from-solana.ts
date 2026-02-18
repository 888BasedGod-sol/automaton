#!/usr/bin/env npx tsx
/**
 * Solana Credit Deposit
 * 
 * Sends Solana USDC to Conway treasury and claims credits.
 * 
 * Usage:
 *   npx tsx scripts/deposit-from-solana.ts <amount>
 *   npx tsx scripts/deposit-from-solana.ts 10  # Deposit $10 USDC
 */

import { fundWithSolanaUsdc, getSolanaFundingState } from "../src/solana/funding.js";
import { loadSolanaKeypair } from "../src/identity/solana-wallet.js";
import { createConwayClient } from "../src/conway/client.js";
import fs from "fs";
import path from "path";

async function main() {
  const amount = parseFloat(process.argv[2]);
  
  if (!amount || isNaN(amount) || amount <= 0) {
    console.log("Usage: npx tsx scripts/deposit-from-solana.ts <amount>");
    console.log("  amount: USDC amount to deposit (e.g., 10 for $10)");
    process.exit(1);
  }
  
  // Load Solana wallet
  const keypair = loadSolanaKeypair();
  if (!keypair) {
    console.error("❌ No Solana wallet found. Run: npx tsx scripts/generate-wallets.ts");
    process.exit(1);
  }
  
  console.log(`\n🔑 Solana Wallet: ${keypair.publicKey.toBase58()}`);
  
  // Check current Solana balances
  console.log("\n📊 Checking Solana balances...");
  const state = await getSolanaFundingState("mainnet-beta");
  console.log(`   SOL: ${state.solBalance.toFixed(4)}`);
  console.log(`   USDC: $${state.solanaUsdcBalance.toFixed(2)}`);
  
  if (state.solanaUsdcBalance < amount) {
    console.error(`\n❌ Insufficient USDC. Have: $${state.solanaUsdcBalance.toFixed(2)}, Need: $${amount.toFixed(2)}`);
    process.exit(1);
  }
  
  // Load Conway client
  const configPath = path.join(process.env.HOME!, ".automaton", "config.json");
  if (!fs.existsSync(configPath)) {
    console.error("❌ No config found. Run: npx automaton setup");
    process.exit(1);
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const conway = createConwayClient({
    apiUrl: config.conwayApiUrl || "https://api.conway.tech",
    apiKey: config.apiKey,
    sandboxId: config.sandboxId || "",
  });
  
  // Check current Conway credits
  const creditsBefore = await conway.getCreditsBalance();
  console.log(`\n💳 Conway Credits: $${(creditsBefore / 100).toFixed(2)}`);
  
  // Perform the deposit
  console.log(`\n⏳ Sending $${amount.toFixed(2)} USDC to Conway treasury...`);
  
  const result = await fundWithSolanaUsdc(amount, "mainnet-beta", conway);
  
  if (result.success) {
    console.log(`\n✅ Deposit successful!`);
    console.log(`   Transaction: ${result.txSignature}`);
    console.log(`   Credits added: ${result.creditsAdded} cents`);
    
    if (result.error) {
      console.log(`   ⚠️  Note: ${result.error}`);
    }
    
    // Check updated balance
    const creditsAfter = await conway.getCreditsBalance();
    console.log(`\n💳 New Conway Credits: $${(creditsAfter / 100).toFixed(2)}`);
    console.log(`   Added: $${((creditsAfter - creditsBefore) / 100).toFixed(2)}`);
  } else {
    console.error(`\n❌ Deposit failed: ${result.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
