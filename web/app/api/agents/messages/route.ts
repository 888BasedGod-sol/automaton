import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

// GET - Fetch messages for an agent
export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agentId');
  const since = request.nextUrl.searchParams.get('since');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  }

  try {
    let result;
    if (since) {
      result = await query(`
        SELECT m.*, 
               f.name as from_name,
               t.name as to_name
        FROM agent_messages m
        LEFT JOIN agents f ON m.from_agent_id::text = f.id::text
        LEFT JOIN agents t ON m.to_agent_id::text = t.id::text
        WHERE (m.to_agent_id::text = $1 OR m.from_agent_id::text = $1)
          AND m.created_at > $2::timestamp
        ORDER BY m.created_at DESC
        LIMIT $3
      `, [agentId, since, limit]);
    } else {
      result = await query(`
        SELECT m.*, 
               f.name as from_name,
               t.name as to_name
        FROM agent_messages m
        LEFT JOIN agents f ON m.from_agent_id::text = f.id::text
        LEFT JOIN agents t ON m.to_agent_id::text = t.id::text
        WHERE (m.to_agent_id::text = $1 OR m.from_agent_id::text = $1)
        ORDER BY m.created_at DESC
        LIMIT $2
      `, [agentId, limit]);
    }

    // Get unread count
    const unreadResult = await query(`
      SELECT COUNT(*) as count FROM agent_messages 
      WHERE to_agent_id::text = $1 AND read = false
    `, [agentId]);

    return NextResponse.json({
      messages: result.rows,
      unreadCount: parseInt(unreadResult.rows[0]?.count || '0'),
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST - Send a message between agents
export async function POST(request: NextRequest) {
  try {
    const { fromAgentId, toAgentId, content, messageType = 'text', metadata = {} } = await request.json();

    if (!fromAgentId || !toAgentId || !content) {
      return NextResponse.json(
        { error: 'fromAgentId, toAgentId, and content required' },
        { status: 400 }
      );
    }

    // Check if recipient requires payment
    const recipientResult = await query(
      'SELECT minimum_reply_cost, reply_cost_asset, evm_address, solana_address, owner_wallet FROM agents WHERE id = $1',
      [toAgentId]
    );
    
    if (recipientResult.rows.length > 0) {
      const recipient = recipientResult.rows[0];
      const cost = parseFloat(recipient.minimum_reply_cost || '0');
      
      if (cost > 0) {
        // Determine recipient address (Owner > Agent)
        // If the agent has an owner wallet set, funds go there directly.
        // Otherwise, they go to the agent to fund its own survival.
        const recipientAddress = recipient.reply_cost_asset === 'sol' 
          ? (recipient.owner_wallet || recipient.solana_address) 
          : (recipient.owner_wallet || recipient.evm_address); // Assuming owner wallet supports both chains or is just an address string

        // NOTE: If owner_wallet is a Solana address but asset is ETH, this fails.
        // For MVP, we assume owner_wallet matches the asset chain, or we fallback to agent wallet.
        // A robust system would store owner_sol_wallet AND owner_evm_wallet.
        // For now, let's just use agent address if we can't be sure, OR check format.
        
        let finalRecipient = recipientAddress;
        const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(finalRecipient || '');
        const isEvmAddress = /^0x[a-fA-F0-9]{40}$/.test(finalRecipient || '');

        if (recipient.reply_cost_asset === 'sol' && !isSolanaAddress) {
           finalRecipient = recipient.solana_address;
        } else if (recipient.reply_cost_asset !== 'sol' && !isEvmAddress) {
           finalRecipient = recipient.evm_address;
        }

        const paymentTx = metadata?.paymentTxHash;
        
        // If no payment provided for paid agent
        if (!paymentTx) {
          return NextResponse.json({
            error: 'Payment required',
            requiredAmount: cost,
            asset: recipient.reply_cost_asset || 'usdc',
            recipientAddress: finalRecipient
          }, { status: 402 });
        }
        
        // TODO: Verify transaction on-chain here
        // For now, we trust the client provided a hash, but in production
        // we would use viem/web3.js to check if tx confirms and transfers correct amount
      }
    }

    // Insert message
    const result = await query(`
      INSERT INTO agent_messages (from_agent_id, to_agent_id, content, message_type, metadata)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5)
      RETURNING *
    `, [fromAgentId, toAgentId, content, messageType, JSON.stringify(metadata)]);

    return NextResponse.json({
      success: true,
      message: result.rows[0],
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

// PATCH - Mark messages as read
export async function PATCH(request: NextRequest) {
  try {
    const { agentId, messageIds } = await request.json();

    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    if (messageIds && messageIds.length > 0) {
      // Mark specific messages as read
      await query(`
        UPDATE agent_messages 
        SET read = true 
        WHERE id = ANY($1) AND to_agent_id::text = $2
      `, [messageIds, agentId]);
    } else {
      // Mark all as read
      await query(`
        UPDATE agent_messages 
        SET read = true 
        WHERE to_agent_id::text = $1 AND read = false
      `, [agentId]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking messages read:', error);
    return NextResponse.json({ error: 'Failed to update messages' }, { status: 500 });
  }
}
