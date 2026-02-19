import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const getDb = () => neon(process.env.DATABASE_URL!);

// GET - Discover agents available for communication
export async function GET(request: NextRequest) {
  const excludeId = request.nextUrl.searchParams.get('exclude');
  const skill = request.nextUrl.searchParams.get('skill');
  const tier = request.nextUrl.searchParams.get('tier');
  const status = request.nextUrl.searchParams.get('status') || 'running';
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

  try {
    // Build dynamic query
    let agents;
    
    if (skill) {
      agents = await getDb()`
        SELECT 
          id, name, genesis_prompt, status, survival_tier,
          solana_address, evm_address, skills,
          created_at, uptime_seconds
        FROM agents 
        WHERE status = ${status}
          AND (${excludeId}::text IS NULL OR id != ${excludeId})
          AND (${tier}::text IS NULL OR survival_tier = ${tier})
          AND skills::text ILIKE ${'%' + skill + '%'}
        ORDER BY credits_balance DESC
        LIMIT ${limit}
      `;
    } else {
      agents = await getDb()`
        SELECT 
          id, name, genesis_prompt, status, survival_tier,
          solana_address, evm_address, skills,
          created_at, uptime_seconds
        FROM agents 
        WHERE status = ${status}
          AND (${excludeId}::text IS NULL OR id != ${excludeId})
          AND (${tier}::text IS NULL OR survival_tier = ${tier})
        ORDER BY credits_balance DESC
        LIMIT ${limit}
      `;
    }

    // Get stats
    const stats = await getDb()`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'running') as online_count,
        COUNT(*) as total_count
      FROM agents
    `;

    return NextResponse.json({
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        description: a.genesis_prompt?.slice(0, 200),
        status: a.status,
        tier: a.survival_tier,
        skills: typeof a.skills === 'string' ? JSON.parse(a.skills || '[]') : a.skills || [],
        address: a.solana_address || a.evm_address,
        uptime: a.uptime_seconds,
      })),
      stats: {
        online: parseInt(stats[0]?.online_count || '0'),
        total: parseInt(stats[0]?.total_count || '0'),
      }
    });
  } catch (error) {
    console.error('Error discovering agents:', error);
    return NextResponse.json({ error: 'Failed to discover agents' }, { status: 500 });
  }
}

// POST - Register an agent for discovery (make visible)
export async function POST(request: NextRequest) {
  try {
    const { agentId, capabilities, tags } = await request.json();

    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    // Update agent's discoverable status and capabilities
    await getDb()`
      UPDATE agents 
      SET 
        metadata = COALESCE(metadata, '{}'::jsonb) || 
          jsonb_build_object('discoverable', true, 'capabilities', ${JSON.stringify(capabilities || [])}, 'tags', ${JSON.stringify(tags || [])})
      WHERE id = ${agentId}
    `;

    return NextResponse.json({ success: true, message: 'Agent registered for discovery' });
  } catch (error) {
    console.error('Error registering agent:', error);
    return NextResponse.json({ error: 'Failed to register agent' }, { status: 500 });
  }
}
