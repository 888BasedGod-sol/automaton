const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Base58 encoding
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

const treasuryPath = path.join(os.homedir(), '.automaton', 'treasury.json');

// Backup old config
if (fs.existsSync(treasuryPath)) {
  const backup = path.join(os.homedir(), '.automaton', 'treasury.devnet.backup.json');
  fs.copyFileSync(treasuryPath, backup);
  console.log('Backed up devnet config to:', backup);
}

// Generate new mainnet keypair
const keypair = Keypair.generate();
const config = {
  publicKey: keypair.publicKey.toBase58(),
  privateKey: encodeBase58(keypair.secretKey),
  network: 'mainnet',
  createdAt: new Date().toISOString(),
  label: 'Automagotchi Cloud Treasury (Mainnet)'
};

fs.writeFileSync(treasuryPath, JSON.stringify(config, null, 2));

console.log('\n=== NEW MAINNET SOLANA TREASURY ===');
console.log('Public Key:', config.publicKey);
console.log('Network: mainnet');
console.log('\nConfig saved to:', treasuryPath);
console.log('\n⚠️  IMPORTANT: Fund this wallet with SOL before use!');
