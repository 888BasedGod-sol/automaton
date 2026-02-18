import { NextRequest, NextResponse } from 'next/server';
import { getDb, getCachedStmt } from '@/lib/db-singleton';
import { getMemoryAgents, DEMO_AGENTS } from '@/lib/memory-store';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Check if we're in serverless mode
const IS_SERVERLESS = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// ERC-8004 Identity Registry on Base
const ERC8004_CONTRACT = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

// Prepared query for getting all agents (cached)
const GET_ALL_AGENTS_SQL = `
  SELECT 
    id, name, genesis_prompt, creator_wallet, 
    evm_address, solana_address, status, 
    survival_tier, credits_balance, sol_balance, 
    usdc_balance, uptime_seconds, last_heartbeat,
    parent_id, children_count, skills, agent_card,
    erc8004_id, version, created_at, funded_at, started_at
  FROM agents 
  ORDER BY created_at DESC
`;

// In-memory cache for agent list
let cachedAgents: any[] = [];
let cacheTime = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds

interface EnrichedAgent {
  // ... all existing fields
  deployment: {
    onChain: boolean;
    erc8004Id: string | null;
    registryContract: string | null;
    chain: string | null;
    explorerUrl: string | null;
  };
}

function enrichAgent(agent: any): any {
  const isDeployed = !!agent.erc8004_id;
  
  return {
    ...agent,
    skills: JSON.parse(agent.skills || '[]'),
    agent_card: agent.agent_card ? JSON.parse(agent.agent_card) : null,
    deployment: {
      onChain: isDeployed,
      erc8004Id: agent.erc8004_id || null,
      registryContract: isDeployed ? ERC8004_CONTRACT : null,
      chain: isDeployed ? 'Base (8453)' : null,
      explorerUrl: isDeployed 
        ? `https://basescan.org/token/${ERC8004_CONTRACT}?a=${agent.erc8004_id}`
        : null,
    },
  };
}

// Get all agents (public info only, with deployment status)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';
    const deployedOnly = searchParams.get('deployed') === 'true';

    // In serverless mode, use memory store + demo agents
    if (IS_SERVERLESS) {
      const memoryAgents = getMemoryAgents();
      const allAgents = [...memoryAgents, ...DEMO_AGENTS].map(enrichAgent);
      
      let result = allAgents;
      if (deployedOnly) {
        result = allAgents.filter(a => a.deployment?.onChain);
      }

      return NextResponse.json({
        success: true,
        agents: result,
        total: result.length,
        serverless: true,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
      });
    }

    // Return cached if valid
    if (!refresh && cachedAgents.length > 0 && Date.now() - cacheTime < CACHE_TTL) {
      let agents = cachedAgents;
      if (deployedOnly) {
        agents = agents.filter(a => a.deployment?.onChain);
      }
      return NextResponse.json({
        success: true,
        agents,
        total: agents.length,
        cached: true,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }

    const stmt = getCachedStmt(GET_ALL_AGENTS_SQL);
    if (!stmt) {
      // Fallback to memory store if DB not available
      const memoryAgents = getMemoryAgents();
      const allAgents = [...memoryAgents, ...DEMO_AGENTS].map(enrichAgent);
      return NextResponse.json({
        success: true,
        agents: allAgents,
        total: allAgents.length,
        fallback: true,
      });
    }
    
    const rawAgents = stmt.all() as any[];
    
    // Enrich with deployment info
    const agents = rawAgents.map(enrichAgent);

    // Update cache
    cachedAgents = agents;
    cacheTime = Date.now();

    let result = agents;
    if (deployedOnly) {
      result = agents.filter(a => a.deployment?.onChain);
    }

    return NextResponse.json({
      success: true,
      agents: result,
      total: result.length,
      totalRegistered: agents.filter(a => a.deployment?.onChain).length,
      registryContract: ERC8004_CONTRACT,
      chain: 'Base (8453)',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    // Return demo agents on error
    const allAgents = [...getMemoryAgents(), ...DEMO_AGENTS].map(enrichAgent);
    return NextResponse.json({
      success: true,
      agents: allAgents,
      total: allAgents.length,
      fallback: true,
    });
  }
}
