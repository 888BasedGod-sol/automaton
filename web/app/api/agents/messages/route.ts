import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const getDb = () => neon(process.env.DATABASE_URL!);

// GET - Fetch messages for an agent
export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agentId');
  const since = request.nextUrl.searchParams.get('since');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  }

  try {
    // Create messages table if not exists
    await getDb()`
      CREATE TABLE IF NOT EXISTS agent_messages (
        id SERIAL PRIMARY KEY,
        from_agent_id TEXT NOT NULL,
        to_agent_id TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    await getDb()`CREATE INDEX IF NOT EXISTS idx_messages_to ON agent_messages(to_agent_id)`;
    await getDb()`CREATE INDEX IF NOT EXISTS idx_messages_from ON agent_messages(from_agent_id)`;

    let messages;
    if (since) {
      messages = await getDb()`
        SELECT m.*, 
               f.name as from_name,
               t.name as to_name
        FROM agent_messages m
        LEFT JOIN agents f ON m.from_agent_id = f.id
        LEFT JOIN agents t ON m.to_agent_id = t.id
        WHERE (m.to_agent_id = ${agentId} OR m.from_agent_id = ${agentId})
          AND m.created_at > ${since}::timestamp
        ORDER BY m.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      messages = await getDb()`
        SELECT m.*, 
               f.name as from_name,
               t.name as to_name
        FROM agent_messages m
        LEFT JOIN agents f ON m.from_agent_id = f.id
        LEFT JOIN agents t ON m.to_agent_id = t.id
        WHERE m.to_agent_id = ${agentId} OR m.from_agent_id = ${agentId}
        ORDER BY m.created_at DESC
        LIMIT ${limit}
      `;
    }

    // Get unread count
    const unreadResult = await getDb()`
      SELECT COUNT(*) as count FROM agent_messages 
      WHERE to_agent_id = ${agentId} AND read = false
    `;

    return NextResponse.json({
      messages,
      unreadCount: parseInt(unreadResult[0]?.count || '0'),
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

    // Verify both agents exist
    const agents = await getDb()`
      SELECT id, name, status FROM agents 
      WHERE id IN (${fromAgentId}, ${toAgentId})
    `;

    if (agents.length < 2) {
      return NextResponse.json({ error: 'One or both agents not found' }, { status: 404 });
    }

    // Insert message
    const result = await getDb()`
      INSERT INTO agent_messages (from_agent_id, to_agent_id, content, message_type, metadata)
      VALUES (${fromAgentId}, ${toAgentId}, ${content}, ${messageType}, ${JSON.stringify(metadata)})
      RETURNING *
    `;

    // Log activity
    await getDb()`
      INSERT INTO activity (agent_id, type, detail)
      VALUES (${fromAgentId}, 'message_sent', ${`Sent message to agent`})
    `;

    return NextResponse.json({
      success: true,
      message: result[0],
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
      await getDb()`
        UPDATE agent_messages 
        SET read = true 
        WHERE id = ANY(${messageIds}) AND to_agent_id = ${agentId}
      `;
    } else {
      // Mark all as read
      await getDb()`
        UPDATE agent_messages 
        SET read = true 
        WHERE to_agent_id = ${agentId} AND read = false
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking messages read:', error);
    return NextResponse.json({ error: 'Failed to update messages' }, { status: 500 });
  }
}
