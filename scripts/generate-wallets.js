import { Keypair } from '@solana/web3.js';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import bs58 from 'bs58';
import fs from 'fs';

// Ensure data directory exists
if (!fs.existsSync('data')) {
  fs.mkdirSync('data', { recursive: true });
}

// Generate EVM wallet
const evmPrivateKey = generatePrivateKey();
const evmAccount = privateKeyToAccount(evmPrivateKey);

// Generate Solana wallet
const solanaKeypair = Keypair.generate();
const solanaSecretKey = bs58.encode(solanaKeypair.secretKey);

// Save EVM wallet
fs.writeFileSync('data/wallet.json', JSON.stringify({
  address: evmAccount.address,
  privateKey: evmPrivateKey
}, null, 2));

// Save Solana wallet
fs.writeFileSync('data/solana-wallet.json', JSON.stringify({
  publicKey: solanaKeypair.publicKey.toBase58(),
  secretKey: solanaSecretKey
}, null, 2));

// Create identity
fs.writeFileSync('data/identity.json', JSON.stringify({
  address: evmAccount.address,
  sandboxId: 'local-' + Date.now(),
  createdAt: new Date().toISOString()
}, null, 2));

console.log('=== Agent Wallets Created ===\n');
console.log('EVM (Base) Address:');
console.log(evmAccount.address);
console.log('\nSolana Address:');
console.log(solanaKeypair.publicKey.toBase58());
console.log('\n=== Fund these addresses to activate your agent ===');
