
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const dynamic = 'force-dynamic'; // No static generation
export const revalidate = 0; // No caching by default

export async function GET(request: NextRequest) {
  try {
    // Execute parallel queries for performance
    const [trafficResult, statsResult] = await Promise.all([
      // 1. Get recent traffic (existing query)
      query(`
        SELECT 
          from_agent_id as source, 
          to_agent_id as target, 
          count(*) as volume,
          max(created_at) as last_active
        FROM agent_messages 
        WHERE created_at > NOW() - INTERVAL '5 minutes'
        AND from_agent_id IS NOT NULL 
        AND to_agent_id IS NOT NULL
        GROUP BY from_agent_id, to_agent_id
        ORDER BY last_active DESC
        LIMIT 50
      `),
      
      // 2. Get aggregate network stats
      query(`
        SELECT
          (SELECT COUNT(*) FROM agents WHERE status IN ('running', 'funded')) as active_agents,
          (SELECT COUNT(*) FROM agent_messages) as total_transactions,
          (SELECT COALESCE(SUM(credits_balance), 0) FROM agents) as network_value
      `)
    ]);

    const stats = statsResult.rows[0];

    return NextResponse.json({
      traffic: trafficResult.rows.map((row: any) => ({
        source: row.source,
        target: row.target,
        volume: parseInt(row.volume),
        lastActive: row.last_active
      })),
      stats: {
        activeAgents: parseInt(stats.active_agents),
        totalTransactions: parseInt(stats.total_transactions),
        networkValue: parseFloat(stats.network_value)
      }
    }, {
      headers: {
        'Cache-Control': 's-maxage=5, stale-while-revalidate=59',
      },
    });
  } catch (error: any) {
    console.error('Network traffic error:', error);
    // Return empty/simulated on error
    return NextResponse.json({ 
      traffic: [], 
      simulated: true 
    });
  }
}
