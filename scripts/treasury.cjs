#!/usr/bin/env node
/**
 * Treasury Management CLI
 * 
 * Usage:
 *   node scripts/treasury.cjs generate [--network mainnet|devnet] [--label "My Treasury"]
 *   node scripts/treasury.cjs info
 *   node scripts/treasury.cjs balance
 *   node scripts/treasury.cjs fund <agent-solana-address> <amount-sol>
 */

const { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Base58 alphabet for Solana
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58(bytes) {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = '';
  for (const byte of bytes) {
    if (byte === 0) result += BASE58_ALPHABET[0];
    else break;
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

function decodeBase58(str) {
  const bytes = [];
  for (const char of str) {
    let carry = BASE58_ALPHABET.indexOf(char);
    if (carry < 0) throw new Error('Invalid base58 character');
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of str) {
    if (char === BASE58_ALPHABET[0]) bytes.push(0);
    else break;
  }
  return new Uint8Array(bytes.reverse());
}

// Config paths
const AUTOMATON_DIR = process.env.AUTOMATON_DATA_DIR || path.join(os.homedir(), '.automaton');
const TREASURY_PATH = path.join(AUTOMATON_DIR, 'treasury.json');

// RPC endpoints
const RPC = {
  mainnet: process.env.SOLANA_RPC_MAINNET || 'https://api.mainnet-beta.solana.com',
  devnet: process.env.SOLANA_RPC_DEVNET || 'https://api.devnet.solana.com',
};

function loadConfig() {
  if (!fs.existsSync(TREASURY_PATH)) return null;
  return JSON.parse(fs.readFileSync(TREASURY_PATH, 'utf8'));
}

function saveConfig(config) {
  if (!fs.existsSync(AUTOMATON_DIR)) {
    fs.mkdirSync(AUTOMATON_DIR, { recursive: true });
  }
  fs.writeFileSync(TREASURY_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'generate': {
      // Parse flags
      let network = 'devnet';
      let label = 'Automaton Treasury';
      
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--network' && args[i + 1]) {
          network = args[++i];
        } else if (args[i] === '--label' && args[i + 1]) {
          label = args[++i];
        }
      }
      
      if (network !== 'mainnet' && network !== 'devnet') {
        console.error('Invalid network. Use mainnet or devnet.');
        process.exit(1);
      }
      
      // Check if treasury already exists
      const existing = loadConfig();
      if (existing) {
        console.log('⚠️  Treasury already exists!');
        console.log(`   Public Key: ${existing.publicKey}`);
        console.log(`   Network: ${existing.network}`);
        console.log('');
        console.log('To generate a new treasury, first backup and remove:');
        console.log(`   ${TREASURY_PATH}`);
        process.exit(1);
      }
      
      // Generate new keypair
      const keypair = Keypair.generate();
      
      const config = {
        publicKey: keypair.publicKey.toBase58(),
        privateKey: encodeBase58(keypair.secretKey),
        network,
        createdAt: new Date().toISOString(),
        label,
      };
      
      saveConfig(config);
      
      console.log('✅ Treasury wallet generated!');
      console.log('');
      console.log('📍 Network:', network);
      console.log('🔑 Public Key:', config.publicKey);
      console.log('📁 Saved to:', TREASURY_PATH);
      console.log('');
      console.log('⚠️  IMPORTANT: Back up your treasury.json file securely!');
      console.log('');
      
      if (network === 'devnet') {
        console.log('💧 To fund with devnet SOL:');
        console.log(`   solana airdrop 2 ${config.publicKey} --url devnet`);
      } else {
        console.log('💰 To fund with mainnet SOL:');
        console.log(`   Send SOL to: ${config.publicKey}`);
      }
      break;
    }

    case 'info': {
      const config = loadConfig();
      if (!config) {
        console.log('No treasury configured. Run: node scripts/treasury.cjs generate');
        process.exit(1);
      }
      
      console.log('📍 Treasury Info');
      console.log('================');
      console.log('Network:', config.network);
      console.log('Public Key:', config.publicKey);
      console.log('Label:', config.label || 'N/A');
      console.log('Created:', config.createdAt);
      console.log('Config:', TREASURY_PATH);
      break;
    }

    case 'balance': {
      const config = loadConfig();
      if (!config) {
        console.log('No treasury configured.');
        process.exit(1);
      }
      
      const connection = new Connection(RPC[config.network], 'confirmed');
      const pubkey = new PublicKey(config.publicKey);
      
      try {
        const lamports = await connection.getBalance(pubkey);
        const sol = lamports / LAMPORTS_PER_SOL;
        
        console.log('💰 Treasury Balance');
        console.log('===================');
        console.log('Network:', config.network);
        console.log('Address:', config.publicKey);
        console.log('Balance:', sol.toFixed(9), 'SOL');
        console.log('Lamports:', lamports.toLocaleString());
      } catch (e) {
        console.error('Failed to fetch balance:', e.message);
        process.exit(1);
      }
      break;
    }

    case 'fund': {
      const agentAddress = args[1];
      const amountSol = parseFloat(args[2]);
      
      if (!agentAddress || isNaN(amountSol) || amountSol <= 0) {
        console.log('Usage: node scripts/treasury.cjs fund <agent-solana-address> <amount-sol>');
        process.exit(1);
      }
      
      const config = loadConfig();
      if (!config) {
        console.log('No treasury configured.');
        process.exit(1);
      }
      
      console.log('🚀 Funding agent from treasury...');
      console.log('   To:', agentAddress);
      console.log('   Amount:', amountSol, 'SOL');
      console.log('   Network:', config.network);
      console.log('');
      
      const connection = new Connection(RPC[config.network], 'confirmed');
      const keypair = Keypair.fromSecretKey(decodeBase58(config.privateKey));
      
      try {
        // Check balance
        const balance = await connection.getBalance(keypair.publicKey);
        const lamportsNeeded = Math.floor(amountSol * LAMPORTS_PER_SOL) + 5000;
        
        if (balance < lamportsNeeded) {
          console.error('❌ Insufficient treasury balance');
          console.log('   Available:', (balance / LAMPORTS_PER_SOL).toFixed(9), 'SOL');
          console.log('   Needed:', (lamportsNeeded / LAMPORTS_PER_SOL).toFixed(9), 'SOL');
          process.exit(1);
        }
        
        // Create and send transaction
        const agentPubkey = new PublicKey(agentAddress);
        const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
        
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: agentPubkey,
            lamports,
          })
        );
        
        const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
        
        console.log('✅ Transfer successful!');
        console.log('   Signature:', signature);
        console.log('   Explorer:', `https://solscan.io/tx/${signature}${config.network === 'devnet' ? '?cluster=devnet' : ''}`);
      } catch (e) {
        console.error('❌ Transfer failed:', e.message);
        process.exit(1);
      }
      break;
    }

    default:
      console.log('Automaton Treasury CLI');
      console.log('');
      console.log('Commands:');
      console.log('  generate [--network mainnet|devnet] [--label "name"]  Generate new treasury');
      console.log('  info                                                   Show treasury info');
      console.log('  balance                                                Check SOL balance');
      console.log('  fund <address> <amount>                                Fund an agent');
      console.log('');
      console.log('Examples:');
      console.log('  node scripts/treasury.cjs generate --network devnet');
      console.log('  node scripts/treasury.cjs balance');
      console.log('  node scripts/treasury.cjs fund 8xH2...abc 0.1');
  }
}

main().catch(console.error);
