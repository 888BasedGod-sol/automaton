import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

// GET - Discover agents available for communication
export async function GET(request: NextRequest) {
  const excludeId = request.nextUrl.searchParams.get('exclude');
  const skill = request.nextUrl.searchParams.get('skill');
  const tier = request.nextUrl.searchParams.get('tier');
  const status = request.nextUrl.searchParams.get('status') || 'running';
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

  try {
    // Basic query
    let sql = `
      SELECT 
        id, name, genesis_prompt, status, survival_tier,
        solana_address, evm_address, skills,
        created_at, uptime_seconds
      FROM agents 
      WHERE status = $1
    `;
    const params: any[] = [status];

    // Dynamic filters
    if (excludeId) {
      sql += ` AND id::text != $${params.length + 1}`;
      params.push(excludeId);
    }

    if (tier) {
      sql += ` AND survival_tier = $${params.length + 1}`;
      params.push(tier);
    }

    if (skill) {
      // JSONB array containing skill? Or text search?
      // Original code used ILIKE on skills::text
      sql += ` AND skills::text ILIKE $${params.length + 1}`;
      params.push(`%${skill}%`);
    }

    sql += ` ORDER BY credits_balance DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);

    // Get stats
    const statsResult = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'running') as online_count,
        COUNT(*) as total_count
      FROM agents
    `);

    return NextResponse.json({
      agents: result.rows.map((a: any) => ({
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
        online: parseInt(statsResult.rows[0]?.online_count || '0'),
        total: parseInt(statsResult.rows[0]?.total_count || '0'),
      }
    });
  } catch (error) {
    console.error('Error discovering agents:', error);
    return NextResponse.json({ error: 'Failed to discover agents', details: String(error) }, { status: 500 });
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
    // Assuming 'metadata' column exists (added in recent migration)
    await query(`
      UPDATE agents 
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{discovery}',
        $2::jsonb
      )
      WHERE id = $1::uuid
    `, [
      agentId, 
      JSON.stringify({ 
        discoverable: true, 
        capabilities: capabilities || [], 
        tags: tags || [] 
      })
    ]);

    return NextResponse.json({ success: true, message: 'Agent registered for discovery' });
  } catch (error) {
    console.error('Error registering agent:', error);
    return NextResponse.json({ error: 'Failed to register agent' }, { status: 500 });
  }
}
