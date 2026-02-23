import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const result = await pool.query('SELECT name, owner_wallet FROM agents');
console.log('Agent Owner Wallets:');
for (const row of result.rows) {
  console.log(`- ${row.name}: ${row.owner_wallet || 'NULL'}`);
}
await pool.end();
