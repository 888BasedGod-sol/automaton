import { NextRequest, NextResponse } from 'next/server';
import { getAllAgents as getPostgresAgents, isPostgresConfigured, initDatabase } from '@/lib/postgres';
import { fetchRegistryAgents, RegistryAgent } from '@/lib/registry';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ERC-8004 Identity Registry on Base
const ERC8004_CONTRACT = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

interface DeploymentInfo {
  onChain: boolean;
  erc8004Id: string | null;
  registryContract: string | null;
  chain: string | null;
  explorerUrl: string | null;
}

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

function convertRegistryAgent(regAgent: RegistryAgent): any {
    return {
        id: `erc8004-${regAgent.tokenId}`,
        name: regAgent.name,
        genesis_prompt: regAgent.description || 'On-chain agent from Base registry.',
        status: 'active', // Assume active if on-chain
        survival_tier: 'registering', // assume thriving
        credits_balance: 0, // Unknown
        uptime_seconds: 0,
        skills: regAgent.skills || [],
        created_at: new Date().toISOString(),
        deployment: {
            onChain: true,
            erc8004Id: regAgent.tokenId,
            registryContract: ERC8004_CONTRACT,
            chain: 'Base (8453)',
            explorerUrl: `https://basescan.org/token/${ERC8004_CONTRACT}?a=${regAgent.tokenId}`,
        },
        external: true, // Flag as external
        owner: regAgent.owner
    };
}

// Get all agents (public info only, with deployment status)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deployedOnly = searchParams.get('deployed') === 'true';

    // 1. Fetch from Postgres (if configured)
    let dbAgents: any[] = [];
    if (isPostgresConfigured()) {
        try {
            await initDatabase();
            const rawDbAgents = await getPostgresAgents();
            dbAgents = rawDbAgents.map(enrichAgent);
        } catch (e) {
            console.error('Failed to fetch DB agents:', e);
        }
    }

    // 2. Fetch from Chain (Base Registry)
    let onChainAgents: RegistryAgent[] = [];
    try {
        // Fetch last 20 agents
        // We use fetchRegistryAgents from our lib
        const agents = await fetchRegistryAgents(20);
        onChainAgents = agents || [];
    } catch (e) {
        console.error('Failed to fetch registry agents:', e);
    }

    // 3. Merge Strategies
    // Create a map of existing agents by erc8004_id from DB to avoid duplicates
    // We assume dbAgents contains ones we own or track locally
    const dbAgentMap = new Map();
    dbAgents.forEach(a => {
        if (a.deployment?.erc8004Id) {
            dbAgentMap.set(a.deployment.erc8004Id.toString(), a);
        }
    });

    const externalAgents = onChainAgents
        .filter(oa => !dbAgentMap.has(oa.tokenId)) // Filter out if already in DB
        .map(convertRegistryAgent);

    let allAgents = [...dbAgents, ...externalAgents];

    // No demo fallback - return actual agents only
    // Users can create agents through /create

    // Filter
    let result = deployedOnly ? allAgents.filter(a => a.deployment?.onChain) : allAgents;

    // Deduplicate by ID just in case
    // External agents use `erc8004-{id}`, DB use UUID.
    // If a collision happens (unlikely), we prefer DB.
    
    return NextResponse.json({
      success: true,
      agents: result,
      total: result.length,
      totalRegistered: result.filter((a: any) => a.deployment?.onChain).length,
      registryContract: ERC8004_CONTRACT,
      chain: 'Base (8453)',
      sources: {
          db: dbAgents.length,
          registry: externalAgents.length,
          demo: allAgents.length === 0
      }
    }, {
      headers: { 
          'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=59',
          'Access-Control-Allow-Origin': '*'
      },
    });

  } catch (error: any) {
    console.error('Error in GET /api/agents/all:', error);
    // Return empty on error - no fake demo data
    return NextResponse.json({
      success: false,
      agents: [],
      total: 0,
      error: error?.message || String(error),
    }, { status: 500 });
  }
}
