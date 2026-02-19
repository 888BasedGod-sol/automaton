import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createAgent as createAgentPg, getAgentsByOwner } from '@/lib/postgres';
import { generateWallets } from '@/lib/wallets';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, genesisPrompt, creatorWallet } = body;

    // Validate inputs
    if (!name || typeof name !== 'string' || name.length < 1) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!genesisPrompt || typeof genesisPrompt !== 'string' || genesisPrompt.length < 10) {
      return NextResponse.json({ error: 'Genesis prompt must be at least 10 characters' }, { status: 400 });
    }
    if (!creatorWallet || typeof creatorWallet !== 'string') {
      return NextResponse.json({ error: 'Creator wallet address is required' }, { status: 400 });
    }

    // Generate wallets for the agent
    const wallets = generateWallets();

    // Create agent in Postgres database
    const agent = await createAgentPg({
      name,
      genesis_prompt: genesisPrompt,
      creator_wallet: creatorWallet,
      owner_wallet: creatorWallet, // Set owner to creator initially
      evm_address: wallets.evm.address,
      evm_private_key: wallets.evm.privateKey,
      solana_address: wallets.solana.address,
      solana_private_key: wallets.solana.privateKey,
    });

    if (!agent) {
      return NextResponse.json({ error: 'Failed to create agent in database' }, { status: 500 });
    }

    // Return public agent info (no private keys)
    const { evm_private_key, solana_private_key, ...publicAgent } = agent as any;

    return NextResponse.json({
      success: true,
      agent: publicAgent,
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorWallet = searchParams.get('creator');

    if (!creatorWallet) {
      return NextResponse.json({ error: 'Creator wallet is required' }, { status: 400 });
    }

    const agents = await getAgentsByOwner(creatorWallet);

    return NextResponse.json({
      success: true,
      agents,
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}
