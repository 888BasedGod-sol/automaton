import { NextRequest, NextResponse } from 'next/server';
import { generateWallets } from '@/lib/wallets';
import { createAgent as createDbAgent, isPostgresConfigured, initDatabase } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, genesisPrompt, ownerWallet } = body;

    // Validate inputs
    if (!name || typeof name !== 'string' || name.length < 1) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!genesisPrompt || typeof genesisPrompt !== 'string' || genesisPrompt.length < 10) {
      return NextResponse.json({ error: 'Genesis prompt must be at least 10 characters' }, { status: 400 });
    }
    if (!ownerWallet || typeof ownerWallet !== 'string') {
      return NextResponse.json({ error: 'Owner wallet is required. Please connect your Solana wallet.' }, { status: 400 });
    }

    if (!isPostgresConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Generate wallets for the agent
    const wallets = generateWallets();

    // Create agent in Postgres
    await initDatabase();
    const agent = await createDbAgent({
      name,
      genesis_prompt: genesisPrompt,
      creator_wallet: 'web-dashboard',
      owner_wallet: ownerWallet,
      evm_address: wallets.evm.address,
      evm_private_key: wallets.evm.privateKey,
      solana_address: wallets.solana.address,
      solana_private_key: wallets.solana.privateKey,
      skills: [],
    });

    if (!agent) {
      return NextResponse.json({ error: 'Failed to create agent in database' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      id: agent.id,
      evmAddress: agent.evm_address,
      solanaAddress: agent.solana_address,
      name: agent.name,
      status: agent.status,
      ownerWallet: agent.owner_wallet,
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
