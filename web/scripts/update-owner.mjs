import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Set this to your actual Solana wallet address
const NEW_OWNER_WALLET = process.argv[2];

if (!NEW_OWNER_WALLET) {
  console.error('Usage: node scripts/update-owner.mjs <YOUR_WALLET_ADDRESS>');
  console.error('Example: node scripts/update-owner.mjs 9Xj2kGp8KvV...');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const result = await pool.query(
  'UPDATE agents SET owner_wallet = $1 RETURNING name',
  [NEW_OWNER_WALLET]
);

console.log(`Updated ${result.rowCount} agents to owner wallet: ${NEW_OWNER_WALLET}`);
for (const row of result.rows) {
  console.log(`  - ${row.name}`);
}

await pool.end();
