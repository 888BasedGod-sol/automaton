import { NextRequest, NextResponse } from 'next/server';
import { getAgentsByOwner, isPostgresConfigured, initDatabase } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerWallet = searchParams.get('wallet');

    if (!ownerWallet) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    if (!isPostgresConfigured()) {
      return NextResponse.json({ 
        agents: [],
        message: 'Database not configured'
      });
    }

    await initDatabase();
    const agents = await getAgentsByOwner(ownerWallet);

    // Return agents without private keys
    const safeAgents = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      genesis_prompt: agent.genesis_prompt,
      evm_address: agent.evm_address,
      solana_address: agent.solana_address,
      owner_wallet: agent.owner_wallet,
      status: agent.status,
      survival_tier: agent.survival_tier,
      credits_balance: agent.credits_balance,
      uptime_seconds: agent.uptime_seconds,
      skills: agent.skills,
      created_at: agent.created_at,
    }));

    return NextResponse.json({
      agents: safeAgents,
      count: safeAgents.length,
    });
  } catch (error) {
    console.error('Error fetching owner agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}
