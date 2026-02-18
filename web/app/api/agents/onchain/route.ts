import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi, type Address } from 'viem';
import { base } from 'viem/chains';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ERC-8004 Identity Registry on Base
const IDENTITY_CONTRACT = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as Address;

const IDENTITY_ABI = parseAbi([
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
]);

interface OnChainAgent {
  agentId: number;
  owner: string;
  name: string;
  description: string;
  image: string;
  metadataUrl: string;
  services: Array<{
    name: string;
    endpoint: string;
    skills?: string[];
    domains?: string[];
  }>;
  active: boolean;
  raw?: any;
}

// Cache for agents (refresh every 5 minutes)
let cachedAgents: OnChainAgent[] = [];
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

// Known token IDs that exist on Base (discovered via scanning)
const KNOWN_TOKEN_IDS = [5, 6, 7, 12, 13, 14, 19, 20];
const MAX_SCAN_ID = 100;

/**
 * Fetch metadata from URL (Olas marketplace format)
 */
async function fetchMetadata(url: string): Promise<any> {
  try {
    const res = await fetch(url, { 
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 } // Cache for 5 minutes
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';
    const scan = searchParams.get('scan') === 'true'; // Full scan mode
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // Return cached if valid
    if (!refresh && cachedAgents.length > 0 && Date.now() - cacheTime < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        agents: cachedAgents.slice(0, limit),
        total: cachedAgents.length,
        cached: true,
        cacheAge: Math.floor((Date.now() - cacheTime) / 1000),
      });
    }

    const publicClient = createPublicClient({
      chain: base,
      transport: http('https://mainnet.base.org'),
    });

    const agents: OnChainAgent[] = [];
    
    // Scan for tokens - either known IDs or full scan
    const idsToCheck = scan 
      ? Array.from({ length: MAX_SCAN_ID }, (_, i) => i)
      : KNOWN_TOKEN_IDS;

    // Batch check token existence and fetch data
    for (const id of idsToCheck) {
      if (agents.length >= limit) break;
      
      const agent = await fetchAgent(publicClient, id);
      if (agent) {
        agents.push(agent);
      }
    }

    // Update cache
    cachedAgents = agents;
    cacheTime = Date.now();

    return NextResponse.json({
      success: true,
      agents,
      total: agents.length,
      cached: false,
      source: 'Base ERC-8004 Registry',
      contract: IDENTITY_CONTRACT,
      chain: 'Base (8453)',
    });
  } catch (error) {
    console.error('Error fetching on-chain agents:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch on-chain agents',
        details: error instanceof Error ? error.message : 'Unknown error',
        agents: cachedAgents, // Return stale cache on error
      },
      { status: 500 }
    );
  }
}

async function fetchAgent(publicClient: any, agentId: number): Promise<OnChainAgent | null> {
  try {
    // First check if token exists by getting owner
    let owner: string;
    try {
      owner = await publicClient.readContract({
        address: IDENTITY_CONTRACT,
        abi: IDENTITY_ABI,
        functionName: 'ownerOf',
        args: [BigInt(agentId)],
      }) as string;
    } catch {
      // Token doesn't exist
      return null;
    }

    // Get token URI
    let metadataUrl = '';
    try {
      metadataUrl = await publicClient.readContract({
        address: IDENTITY_CONTRACT,
        abi: IDENTITY_ABI,
        functionName: 'tokenURI',
        args: [BigInt(agentId)],
      }) as string;
    } catch {
      // No URI available
    }

    // Fetch metadata if URL exists
    let metadata: any = null;
    if (metadataUrl && metadataUrl.startsWith('http')) {
      metadata = await fetchMetadata(metadataUrl);
    }

    return {
      agentId,
      owner,
      name: metadata?.name || `Agent #${agentId}`,
      description: metadata?.description || `On-chain agent registered on Base`,
      image: metadata?.image || '',
      metadataUrl,
      services: metadata?.services || [],
      active: metadata?.active ?? true,
      raw: metadata,
    };
  } catch (error) {
    console.error(`Error fetching agent ${agentId}:`, error);
    return null;
  }
}
