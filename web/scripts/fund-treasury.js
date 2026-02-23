/**
 * Send SOL to treasury wallet to initialize it
 */
const { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const bs58 = require('bs58');
const { Pool } = require('pg');
const crypto = require('crypto');

// Decryption (same as lib/encryption.ts)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-key-32-chars-long-!!';
const IV_LENGTH = 16;

function decrypt(text) {
  if (!text) return '';
  try {
    const textParts = text.split(':');
    if (textParts.length < 2) return text;
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.warn('Decryption failed:', error.message);
    return text;
  }
}

async function sendToTreasury() {
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  
  // Query DB for an agent with funds
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  const result = await pool.query('SELECT solana_private_key, solana_address, name FROM agents WHERE solana_private_key IS NOT NULL');
  
  if (result.rows.length === 0) {
    console.log('No agent found with private key');
    await pool.end();
    return;
  }
  
  // Find agent with highest balance
  let bestAgent = null;
  let bestBalance = 0;
  
  for (const agent of result.rows) {
    const decryptedKey = decrypt(agent.solana_private_key);
    const keypair = Keypair.fromSecretKey(bs58.default.decode(decryptedKey));
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`Agent ${agent.name}: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance > bestBalance) {
      bestBalance = balance;
      bestAgent = agent;
    }
  }
  
  if (!bestAgent || bestBalance < 0.003 * LAMPORTS_PER_SOL) {
    console.log('No agent has enough SOL (need at least 0.003)');
    await pool.end();
    return;
  }
  
  const decryptedKey = decrypt(bestAgent.solana_private_key);
  const keypair = Keypair.fromSecretKey(bs58.default.decode(decryptedKey));
  const treasury = new PublicKey('DrnGW2EkjVhKh6KYcwEgdtxqs3nQpvfiVTeEpfJXR1Gb');
  
  console.log(`\nUsing ${bestAgent.name} with ${bestBalance / LAMPORTS_PER_SOL} SOL`);
  
  // Send 0.002 SOL to treasury (enough for rent + some buffer)
  const lamports = Math.floor(0.002 * LAMPORTS_PER_SOL);
  
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: treasury,
      lamports: lamports,
    })
  );
  
  console.log('Sending 0.002 SOL to treasury...');
  const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
  console.log('TX:', sig);
  
  // Check new treasury balance
  const treasuryBalance = await connection.getBalance(treasury);
  console.log('Treasury balance:', treasuryBalance / LAMPORTS_PER_SOL, 'SOL');
  
  await pool.end();
}

sendToTreasury().catch(console.error);
