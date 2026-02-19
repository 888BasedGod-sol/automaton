import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi, type Address } from 'viem';
import { base } from 'viem/chains';
import { isPostgresConfigured, initDatabase, getAgentById, getAgentByWallet, getAgentByErc8004Id } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

// ERC-8004 Identity Registry on Base
const IDENTITY_CONTRACT = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as Address;

// Automaton Cloud Registry - tracks which agents are deployed through our platform
const AUTOMATON_REGISTRY_OWNER = '0xd3d03f57c60bBEFE645cd6Bb14f1CE2c1915e898' as Address;

const IDENTITY_ABI = parseAbi([
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
]);

interface VerificationResult {
  verified: boolean;
  agentId: string | null;
  onChain: {
    exists: boolean;
    owner: string | null;
    metadataUrl: string | null;
    isAutomatonDeployed: boolean;
  };
  database: {
    exists: boolean;
    erc8004Id: string | null;
    status: string | null;
  };
  message: string;
}

/**
 * GET /api/agents/verify?id=<agentId>&address=<evmAddress>
 * 
 * Verify if an agent is properly deployed on Automaton Cloud and registered on-chain
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('id');
  const evmAddress = searchParams.get('address');
  const erc8004Id = searchParams.get('erc8004_id');

  if (!agentId && !evmAddress && !erc8004Id) {
    return NextResponse.json(
      { error: 'Must provide id, address, or erc8004_id' },
      { status: 400 }
    );
  }

  try {
    const result = await verifyAgent({ agentId, evmAddress, erc8004Id });
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function verifyAgent(params: {
  agentId?: string | null;
  evmAddress?: string | null;
  erc8004Id?: string | null;
}): Promise<VerificationResult> {
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  let dbAgent: any = null;
  let onChainData: any = null;

  // Check database first (Postgres)
  if (!isPostgresConfigured()) {
    return {
      verified: false,
      agentId: null,
      onChain: { exists: false, owner: null, metadataUrl: null, isAutomatonDeployed: false },
      database: { exists: false, erc8004Id: null, status: null },
      message: 'Database not configured',
    };
  }

  await initDatabase();
  
  if (params.agentId) {
    dbAgent = await getAgentById(params.agentId);
  } else if (params.evmAddress) {
    dbAgent = await getAgentByWallet(params.evmAddress);
  } else if (params.erc8004Id) {
    dbAgent = await getAgentByErc8004Id(params.erc8004Id);
  }

  // Check on-chain if we have an ERC-8004 ID
  const tokenId = params.erc8004Id || dbAgent?.erc8004_id;
  
  if (tokenId) {
    try {
      const [owner, metadataUrl] = await Promise.all([
        publicClient.readContract({
          address: IDENTITY_CONTRACT,
          abi: IDENTITY_ABI,
          functionName: 'ownerOf',
          args: [BigInt(tokenId)],
        }).catch(() => null),
        publicClient.readContract({
          address: IDENTITY_CONTRACT,
          abi: IDENTITY_ABI,
          functionName: 'tokenURI',
          args: [BigInt(tokenId)],
        }).catch(() => null),
      ]);

      if (owner) {
        onChainData = {
          exists: true,
          owner: owner as string,
          metadataUrl: metadataUrl as string | null,
          isAutomatonDeployed: (owner as string).toLowerCase() === AUTOMATON_REGISTRY_OWNER.toLowerCase(),
        };
      }
    } catch (e) {
      // Token doesn't exist on-chain
      onChainData = { exists: false, owner: null, metadataUrl: null, isAutomatonDeployed: false };
    }
  }

  // Determine verification status
  const dbExists = !!dbAgent;
  const onChainExists = onChainData?.exists || false;
  const isAutomatonDeployed = onChainData?.isAutomatonDeployed || false;

  let verified = false;
  let message = '';

  if (dbExists && onChainExists && isAutomatonDeployed) {
    verified = true;
    message = 'Agent is fully verified: registered in database and deployed on-chain via Automaton';
  } else if (dbExists && onChainExists) {
    verified = true;
    message = 'Agent is registered on-chain but not deployed via Automaton Cloud';
  } else if (dbExists && !onChainExists) {
    message = 'Agent exists in database but not yet registered on-chain';
  } else if (!dbExists && onChainExists) {
    message = 'Agent exists on-chain but not in Automaton database';
  } else {
    message = 'Agent not found';
  }

  return {
    verified,
    agentId: dbAgent?.id || null,
    onChain: onChainData || { exists: false, owner: null, metadataUrl: null, isAutomatonDeployed: false },
    database: {
      exists: dbExists,
      erc8004Id: dbAgent?.erc8004_id || null,
      status: dbAgent?.status || null,
    },
    message,
  };
}

/**
 * POST /api/agents/verify
 * 
 * Batch verify multiple agents
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentIds, evmAddresses } = body;

    if (!agentIds && !evmAddresses) {
      return NextResponse.json(
        { error: 'Must provide agentIds or evmAddresses array' },
        { status: 400 }
      );
    }

    const results: Record<string, VerificationResult> = {};

    if (agentIds && Array.isArray(agentIds)) {
      for (const id of agentIds.slice(0, 50)) { // Limit to 50
        results[id] = await verifyAgent({ agentId: id });
      }
    }

    if (evmAddresses && Array.isArray(evmAddresses)) {
      for (const address of evmAddresses.slice(0, 50)) {
        results[address] = await verifyAgent({ evmAddress: address });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      total: Object.keys(results).length,
    });
  } catch (error) {
    console.error('Batch verification error:', error);
    return NextResponse.json(
      { error: 'Batch verification failed' },
      { status: 500 }
    );
  }
}
