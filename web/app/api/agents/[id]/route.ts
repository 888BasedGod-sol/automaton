import { NextRequest, NextResponse } from 'next/server';
import { getAgentPublic, getAgent, updateAgentBalances, markAgentFunded, updateAgentStatus } from '@/lib/db';
import { getAgentBalances, hasMinimumFunding } from '@/lib/balances';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = getAgentPublic(params.id);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      agent,
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
    const body = await request.json();
    const { action } = body;

    const agent = getAgent(params.id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (action === 'check_balances') {
      // Fetch current balances
      const balances = await getAgentBalances(agent.solana_address, agent.evm_address);

      // Update database
      updateAgentBalances(agent.id, {
        sol_balance: balances.sol,
        usdc_balance: balances.solanaUsdc + balances.baseUsdc,
      });

      // Check if newly funded
      if (agent.status === 'pending_funding' && hasMinimumFunding(balances)) {
        markAgentFunded(agent.id);
      }

      const updatedAgent = getAgentPublic(agent.id);

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

      updateAgentStatus(agent.id, 'running');
      const updatedAgent = getAgentPublic(agent.id);

      return NextResponse.json({
        success: true,
        agent: updatedAgent,
        message: 'Agent started',
      });
    }

    if (action === 'stop') {
      updateAgentStatus(agent.id, 'stopped');
      const updatedAgent = getAgentPublic(agent.id);

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
