import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createAgent } from '@/lib/db';
import { generateWallets } from '@/lib/wallets';
import { addMemoryAgent, MemoryAgent } from '@/lib/memory-store';
import { createAgent as createDbAgent, isPostgresConfigured, initDatabase } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

// Check if we're in serverless mode
const IS_SERVERLESS = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

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

    // Generate wallets for the agent
    const wallets = generateWallets();
    const agentId = uuidv4();
    const now = new Date().toISOString();

    // Try Vercel Postgres first (persistent storage)
    if (isPostgresConfigured()) {
      await initDatabase(); // Ensure tables exist
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

      if (agent) {
        return NextResponse.json({
          success: true,
          id: agent.id,
          evmAddress: agent.evm_address,
          solanaAddress: agent.solana_address,
          name: agent.name,
          status: agent.status,
          ownerWallet: agent.owner_wallet,
          storage: 'vercel-postgres',
        });
      }
      // Fall through to memory if Postgres insert failed
      console.log('[Create Agent] Postgres insert failed, falling back to memory');
    }

    if (IS_SERVERLESS) {
      // In serverless mode, store in memory (ephemeral)
      const memoryAgent: MemoryAgent = {
        id: agentId,
        name,
        genesis_prompt: genesisPrompt,
        creator_wallet: 'web-dashboard',
        owner_wallet: ownerWallet,
        evm_address: wallets.evm.address,
        solana_address: wallets.solana.address,
        status: 'pending_funding',
        survival_tier: 'normal',
        credits_balance: 0,
        sol_balance: 0,
        usdc_balance: 0,
        uptime_seconds: 0,
        last_heartbeat: null,
        parent_id: null,
        children_count: 0,
        skills: '[]',
        agent_card: null,
        erc8004_id: null,
        version: '0.1.0',
        created_at: now,
        funded_at: null,
        started_at: null,
      };
      
      addMemoryAgent(memoryAgent);

      return NextResponse.json({
        success: true,
        id: agentId,
        evmAddress: wallets.evm.address,
        solanaAddress: wallets.solana.address,
        name,
        status: 'pending_funding',
      });
    }

    // Create agent in database (local mode)
    const agent = createAgent({
      id: agentId,
      name,
      genesis_prompt: genesisPrompt,
      creator_wallet: 'web-dashboard',
      evm_address: wallets.evm.address,
      evm_private_key: wallets.evm.privateKey,
      solana_address: wallets.solana.address,
      solana_private_key: wallets.solana.privateKey,
    });

    return NextResponse.json({
      success: true,
      id: agent.id,
      evmAddress: agent.evm_address,
      solanaAddress: agent.solana_address,
      name: agent.name,
      status: agent.status,
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
