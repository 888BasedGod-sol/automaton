import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await query(
      `SELECT 
        id, 
        name,
        solana_address,
        evm_address,
        CASE WHEN solana_private_key IS NOT NULL THEN 'yes' ELSE 'no' END as has_solana_key,
        CASE WHEN evm_private_key IS NOT NULL THEN 'yes' ELSE 'no' END as has_evm_key,
        LENGTH(solana_private_key) as solana_key_length,
        LENGTH(evm_private_key) as evm_key_length
      FROM agents WHERE id = $1::uuid`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Debug keys error:', error);
    return NextResponse.json({ error: 'Failed to query agent' }, { status: 500 });
  }
}
