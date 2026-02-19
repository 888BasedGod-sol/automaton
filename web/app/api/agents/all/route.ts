import { NextRequest, NextResponse } from 'next/server';
import { DEMO_AGENTS } from '@/lib/memory-store';
import { getAllAgents as getPostgresAgents, isPostgresConfigured, initDatabase } from '@/lib/postgres';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ERC-8004 Identity Registry on Base
const ERC8004_CONTRACT = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

function enrichAgent(agent: any): any {
  const isDeployed = !!agent.erc8004_id;
  
  // Parse skills only if it's a string (not already an array from JSONB)
  let parsedSkills = agent.skills;
  if (typeof parsedSkills === 'string') {
    try {
      parsedSkills = JSON.parse(parsedSkills);
    } catch {
      parsedSkills = [];
    }
  }
  if (!Array.isArray(parsedSkills)) {
    parsedSkills = [];
  }

  // Parse agent_card only if it's a string
  let parsedAgentCard = agent.agent_card;
  if (typeof parsedAgentCard === 'string') {
    try {
      parsedAgentCard = JSON.parse(parsedAgentCard);
    } catch {
      parsedAgentCard = null;
    }
  }
  
  return {
    ...agent,
    skills: parsedSkills,
    agent_card: parsedAgentCard,
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
    const deployedOnly = searchParams.get('deployed') === 'true';

    if (!isPostgresConfigured()) {
      // No database - return demo agents
      const allAgents = [...DEMO_AGENTS].map(enrichAgent);
      let result = deployedOnly ? allAgents.filter(a => a.deployment?.onChain) : allAgents;
      
      return NextResponse.json({
        success: true,
        agents: result,
        total: result.length,
        note: 'Database not configured - showing demo agents',
      });
    }

    await initDatabase();
    const dbAgents = await getPostgresAgents();
    
    // If we have real agents, return them
    if (dbAgents.length > 0) {
      const allAgents = dbAgents.map(a => enrichAgent(a));
      let result = deployedOnly ? allAgents.filter(a => a.deployment?.onChain) : allAgents;

      return NextResponse.json({
        success: true,
        agents: result,
        total: result.length,
        totalRegistered: allAgents.filter(a => a.deployment?.onChain).length,
        registryContract: ERC8004_CONTRACT,
        chain: 'Base (8453)',
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
      });
    }
    
    // Database is empty - show demo agents
    const allAgents = [...DEMO_AGENTS].map(enrichAgent);
    let result = deployedOnly ? allAgents.filter(a => a.deployment?.onChain) : allAgents;
    
    return NextResponse.json({
      success: true,
      agents: result,
      total: result.length,
      note: 'No agents yet - showing demo agents',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    });
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    // Return demo agents on error
    const allAgents = [...DEMO_AGENTS].map(enrichAgent);
    return NextResponse.json({
      success: true,
      agents: allAgents,
      total: allAgents.length,
      fallback: true,
      error: error?.message || String(error),
    });
  }
}
