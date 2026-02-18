#!/usr/bin/env node
/**
 * Send funds from agent wallets
 * Usage:
 *   node scripts/send-funds.js solana <recipient> <amount> [token]
 *   node scripts/send-funds.js evm <recipient> <amount>
 * 
 * Examples:
 *   node scripts/send-funds.js solana 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU 5.00 usdc
 *   node scripts/send-funds.js solana 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU 0.1 sol
 *   node scripts/send-funds.js evm 0x1234...abcd 10.00
 */

const fs = require('fs');
const path = require('path');

// Load config
const configPath = path.join(process.env.HOME, '.automaton', 'config.json');

async function sendSolana(recipient, amount, token = 'sol') {
  const { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
  const { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID, getAccount, createAssociatedTokenAccountInstruction, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
  
  // Load Solana keypair
  const solanaKeyPath = path.join(process.env.HOME, '.automaton', 'solana-keypair.json');
  if (!fs.existsSync(solanaKeyPath)) {
    console.error('❌ Solana keypair not found at:', solanaKeyPath);
    process.exit(1);
  }
  
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(solanaKeyPath, 'utf8')));
  const keypair = Keypair.fromSecretKey(secretKey);
  
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const recipientPubkey = new PublicKey(recipient);
  
  console.log(`\n📤 Sending ${amount} ${token.toUpperCase()} on Solana`);
  console.log(`   From: ${keypair.publicKey.toBase58()}`);
  console.log(`   To:   ${recipient}`);
  
  if (token.toLowerCase() === 'sol') {
    // Send native SOL
    const lamports = Math.floor(parseFloat(amount) * 1e9);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: recipientPubkey,
        lamports,
      })
    );
    
    console.log(`   Amount: ${amount} SOL (${lamports} lamports)`);
    console.log('\n⏳ Sending transaction...');
    
    const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
    console.log(`✅ Success! Signature: ${signature}`);
    console.log(`   Explorer: https://solscan.io/tx/${signature}`);
    
  } else if (token.toLowerCase() === 'usdc') {
    // Send USDC (SPL Token)
    const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const amountRaw = Math.floor(parseFloat(amount) * 1e6); // USDC has 6 decimals
    
    const fromAta = await getAssociatedTokenAddress(USDC_MINT, keypair.publicKey);
    const toAta = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);
    
    console.log(`   Amount: ${amount} USDC (${amountRaw} raw)`);
    
    // Check if recipient has ATA, create if not
    const transaction = new Transaction();
    
    try {
      await getAccount(connection, toAta);
    } catch (e) {
      console.log('   Creating recipient token account...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          keypair.publicKey,
          toAta,
          recipientPubkey,
          USDC_MINT,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
    
    transaction.add(
      createTransferInstruction(
        fromAta,
        toAta,
        keypair.publicKey,
        amountRaw
      )
    );
    
    console.log('\n⏳ Sending transaction...');
    const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
    console.log(`✅ Success! Signature: ${signature}`);
    console.log(`   Explorer: https://solscan.io/tx/${signature}`);
  }
}

async function sendEvm(recipient, amount) {
  const { ethers } = require('ethers');
  
  // Load EVM private key from wallet.json
  const walletPath = path.join(process.env.HOME, '.automaton', 'wallet.json');
  if (!fs.existsSync(walletPath)) {
    console.error('❌ Wallet not found at:', walletPath);
    process.exit(1);
  }
  
  const walletConfig = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const privateKey = walletConfig.privateKey;
  
  if (!privateKey) {
    console.error('❌ No private key found in wallet.json');
    process.exit(1);
  }
  
  // Base mainnet
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(privateKey, provider);
  
  // USDC on Base
  const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const USDC_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)'
  ];
  
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);
  
  console.log(`\n📤 Sending ${amount} USDC on Base`);
  console.log(`   From: ${wallet.address}`);
  console.log(`   To:   ${recipient}`);
  
  const decimals = await usdc.decimals();
  const amountRaw = ethers.parseUnits(amount.toString(), decimals);
  
  const balance = await usdc.balanceOf(wallet.address);
  console.log(`   Balance: ${ethers.formatUnits(balance, decimals)} USDC`);
  
  if (balance < amountRaw) {
    console.error(`❌ Insufficient balance`);
    process.exit(1);
  }
  
  console.log('\n⏳ Sending transaction...');
  const tx = await usdc.transfer(recipient, amountRaw);
  console.log(`   Tx hash: ${tx.hash}`);
  
  const receipt = await tx.wait();
  console.log(`✅ Success! Block: ${receipt.blockNumber}`);
  console.log(`   Explorer: https://basescan.org/tx/${tx.hash}`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log(`
Usage:
  node scripts/send-funds.js solana <recipient> <amount> [token]
  node scripts/send-funds.js evm <recipient> <amount>

Examples:
  node scripts/send-funds.js solana 7xKX...AsU 5.00 usdc   # Send 5 USDC on Solana
  node scripts/send-funds.js solana 7xKX...AsU 0.1 sol    # Send 0.1 SOL
  node scripts/send-funds.js evm 0x1234...abcd 10.00      # Send 10 USDC on Base
`);
    process.exit(1);
  }
  
  const [chain, recipient, amount, token] = args;
  
  try {
    if (chain === 'solana') {
      await sendSolana(recipient, amount, token || 'sol');
    } else if (chain === 'evm') {
      await sendEvm(recipient, amount);
    } else {
      console.error(`Unknown chain: ${chain}. Use 'solana' or 'evm'`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
