import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

// GET - Retrieve monetization settings for an agent
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const agentId = params.id;
  const ownerWallet = request.headers.get('x-owner-wallet'); // Simple auth for now

  if (!agentId || !ownerWallet) {
    return NextResponse.json({ error: 'Agent ID and Owner Wallet required' }, { status: 400 });
  }

  try {
    const result = await query(
      'SELECT minimum_reply_cost, reply_cost_asset, owner_wallet FROM agents WHERE id = $1',
      [agentId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const agent = result.rows[0];

    // Verify ownership
    if (agent.owner_wallet !== ownerWallet) {
      return NextResponse.json({ error: 'Unauthorized: Only the owner can access monetization settings' }, { status: 403 });
    }

    return NextResponse.json({
      minimum_reply_cost: parseFloat(agent.minimum_reply_cost || '0'),
      reply_cost_asset: agent.reply_cost_asset || 'SOL'
    });
  } catch (error) {
    console.error('Error fetching monetization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Update monetization settings
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const agentId = params.id;
  
  try {
    const body = await request.json();
    const { ownerWallet, minimum_reply_cost, reply_cost_asset } = body;

    if (!agentId || !ownerWallet) {
      return NextResponse.json({ error: 'Agent ID and Owner Wallet required' }, { status: 400 });
    }

    // Check ownership
    const agentResult = await query('SELECT owner_wallet FROM agents WHERE id = $1', [agentId]);
    if (agentResult.rows.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    
    if (agentResult.rows[0].owner_wallet !== ownerWallet) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update settings
    await query(
      'UPDATE agents SET minimum_reply_cost = $1, reply_cost_asset = $2 WHERE id = $3',
      [minimum_reply_cost, reply_cost_asset, agentId]
    );

    return NextResponse.json({ success: true, message: 'Monetization settings updated' });
  } catch (error) {
    console.error('Error updating monetization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
