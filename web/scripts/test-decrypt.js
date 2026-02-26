const crypto = require('crypto');
const { Pool } = require('pg');
const bs58 = require('bs58');

const ENCRYPTION_KEY = 'your-secret-key-32-chars-long-!!';

function decrypt(text) {
  try {
    const textParts = text.split(':');
    if (textParts.length < 2) return text;
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts.join(':').slice(textParts[0].length + 1), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    console.error('Decrypt error:', e.message);
    return null;
  }
}

const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

pool.query("SELECT solana_private_key FROM agents WHERE id = 'dae520da-dd1b-48d4-9cf2-49d3c9c02896'")
  .then(r => {
    const encrypted = r.rows[0]?.solana_private_key;
    console.log('Encrypted key length:', encrypted?.length);
    console.log('Encrypted key sample:', encrypted?.slice(0, 50) + '...');
    const decrypted = decrypt(encrypted);
    if (decrypted) {
      console.log('Decryption SUCCESS');
      console.log('Decrypted key:', decrypted);
      console.log('Decrypted key length:', decrypted.length);
      // Try to decode as base58
      try {
        const secretKey = bs58.decode(decrypted);
        console.log('Base58 decode SUCCESS - key is', secretKey.length, 'bytes');
      } catch (e) {
        console.log('Base58 decode FAILED:', e.message);
      }
    } else {
      console.log('Decryption FAILED');
    }
    return pool.end();
  })
  .catch(e => { console.error(e.message); pool.end(); });
