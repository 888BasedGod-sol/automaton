import { NextRequest, NextResponse } from 'next/server';
import { getAgentBalances, hasMinimumFunding } from '@/lib/balances';
import { 
  isPostgresConfigured, 
  getAgentById, 
  getAgentByWallet, 
  getAgentWithKeys,
  initDatabase,
  updateAgentBalances as updateAgentBalancesPg,
  markAgentFunded as markAgentFundedPg,
  updateAgentStatus as updateAgentStatusPg
} from '@/lib/postgres';

export const dynamic = 'force-dynamic';

// For local dev: activity/credits from SQLite (optional fallback)
function getAgentCredits(agentId: string): number | null {
  // Credits are now stored in Postgres via credits_balance
  return null;
}

function getAgentStats(agentId: string): any {
  // Stats would come from a separate service or Postgres in production
  return { followers: 0, following: 0, interactions: 0 };
}

function getAgentActivity(agentId: string): any[] {
  // Activity would come from activity tables in Postgres
  return [];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let agent: any = null;
    
    if (!isPostgresConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    
    await initDatabase();
    
    // Check if id looks like a wallet address
    if (params.id.startsWith('0x') || params.id.length > 40) {
      agent = await getAgentByWallet(params.id);
    } else {
      agent = await getAgentById(params.id);
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Enrich with social/activity data
    const creditsBalance = getAgentCredits(params.id) || agent.credits_balance || 0;
    const stats = getAgentStats(params.id);
    const recentActivity = getAgentActivity(params.id);

    return NextResponse.json({
      success: true,
      agent: {
        ...agent,
        creditsBalance,
        stats,
        recentActivity,
      },
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

// Check and update balances
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isPostgresConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    
    await initDatabase();
    
    const body = await request.json();
    const { action } = body;

    // Get agent with keys for operations that need wallet addresses
    const agent = await getAgentWithKeys(params.id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (action === 'check_balances') {
      // Fetch current balances
      const balances = await getAgentBalances(agent.solana_address, agent.evm_address);

      // Update database
      await updateAgentBalancesPg(agent.id, {
        sol_balance: balances.sol,
        usdc_balance: balances.solanaUsdc + balances.baseUsdc,
      });

      // Check if newly funded
      if (agent.status === 'pending' && hasMinimumFunding(balances)) {
        await markAgentFundedPg(agent.id);
      }

      const updatedAgent = await getAgentById(agent.id);

      return NextResponse.json({
        success: true,
        balances,
        agent: updatedAgent,
        funded: hasMinimumFunding(balances),
      });
    }

    if (action === 'start') {
      // Only funded agents can be started
      if (agent.status !== 'funded') {
        return NextResponse.json(
          { error: 'Agent must be funded before starting' },
          { status: 400 }
        );
      }

      await updateAgentStatusPg(agent.id, 'running');
      const updatedAgent = await getAgentById(agent.id);

      return NextResponse.json({
        success: true,
        agent: updatedAgent,
        message: 'Agent started',
      });
    }

    if (action === 'stop') {
      await updateAgentStatusPg(agent.id, 'stopped');
      const updatedAgent = await getAgentById(agent.id);

      return NextResponse.json({
        success: true,
        agent: updatedAgent,
        message: 'Agent stopped',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing agent action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
