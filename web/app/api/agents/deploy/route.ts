import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { getAgentById, updateAgentDeployment } from '@/lib/postgres';
import { 
  createDeployment, 
  updateDeploymentStage, 
  getDeploymentStatus,
  initDeploymentTables,
} from '@/lib/deployments';

export const dynamic = 'force-dynamic';

// ERC-8004 Identity Registry on Base
const IDENTITY_CONTRACT = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as Address;

const IDENTITY_ABI = parseAbi([
  'function register(string agentURI) external returns (uint256 agentId)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function totalSupply() external view returns (uint256)',
]);

interface AgentCard {
  type: string;
  name: string;
  description: string;
  image?: string;
  services: Array<{
    name: string;
    endpoint: string;
    skills?: string[];
    domains?: string[];
  }>;
  registrations?: Array<{
    agentId: number | null;
    agentRegistry: string;
  }>;
  active: boolean;
  x402Support: boolean;
  supportedTrust: string[];
}

// Initialize deployment tables
let tablesInitialized = false;
async function ensureTablesInit() {
  if (!tablesInitialized) {
    await initDeploymentTables();
    tablesInitialized = true;
  }
}

/**
 * POST /api/agents/deploy
 * 
 * Deploy an agent on-chain via ERC-8004 registry
 * Requires BASE_TREASURY_PRIVATE_KEY env var
 * 
 * Now with full deployment tracking!
 */
export async function POST(request: NextRequest) {
  let deploymentId: string | null = null;
  
  try {
    await ensureTablesInit();
    
    const body = await request.json();
    const { agentId, agentCard } = body;

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    // Check for treasury private key (used to pay gas for registration)
    const treasuryKey = process.env.BASE_TREASURY_PRIVATE_KEY;
    if (!treasuryKey) {
      return NextResponse.json(
        { error: 'BASE_TREASURY_PRIVATE_KEY not configured. Cannot deploy agents.' },
        { status: 500 }
      );
    }

    const agent = await getAgentById(agentId);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (agent.erc8004_id) {
      return NextResponse.json({ 
        error: 'Agent already deployed on-chain',
        erc8004_id: agent.erc8004_id,
      }, { status: 400 });
    }

    // Create deployment tracking record
    deploymentId = await createDeployment(agentId);

    // Stage: Building agent card
    await updateDeploymentStage(deploymentId, 'provisioning', {
      message: 'Building agent identity card',
    });

    // Build agent card if not provided
    const card: AgentCard = agentCard || buildAgentCard(agent);

    // Create metadata URI
    const agentURI = createAgentURI(card);

    // Stage: Registering on-chain
    await updateDeploymentStage(deploymentId, 'registering', {
      message: 'Submitting transaction to Base network',
    });

    // Deploy on-chain
    const result = await registerOnChain(treasuryKey, agentURI);

    // Stage: Registered
    await updateDeploymentStage(deploymentId, 'registered', {
      message: 'Transaction confirmed on Base',
      txHash: result.txHash,
      erc8004Id: result.agentId.toString(),
      metadata: { blockNumber: 'confirmed' },
    });

    // Update database with Postgres
    await updateAgentDeployment(agentId, result.agentId.toString(), card);

    // Stage: Starting agent
    await updateDeploymentStage(deploymentId, 'starting', {
      message: 'Initializing agent runtime',
    });

    // Stage: Running (complete!)
    await updateDeploymentStage(deploymentId, 'running', {
      message: 'Agent is live and earning survival points!',
      erc8004Id: result.agentId.toString(),
    });

    return NextResponse.json({
      success: true,
      deploymentId,
      agentId: agentId,
      erc8004_id: result.agentId.toString(),
      txHash: result.txHash,
      message: 'Agent successfully deployed to ERC-8004 registry on Base',
      explorerUrl: `https://basescan.org/tx/${result.txHash}`,
    });
  } catch (error) {
    console.error('Deploy error:', error);
    
    // Mark deployment as failed if we have a tracking ID
    if (deploymentId) {
      try {
        await updateDeploymentStage(deploymentId, 'failed', {
          message: 'Deployment failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } catch (e) {
        console.error('Failed to update deployment status:', e);
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Deployment failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        deploymentId,
      },
      { status: 500 }
    );
  }
}

function buildAgentCard(agent: any): AgentCard {
  // Handle skills - could be array from Postgres or string from SQLite
  const skills = Array.isArray(agent.skills) 
    ? agent.skills 
    : JSON.parse(agent.skills || '[]');
  
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: agent.name,
    description: agent.genesis_prompt?.substring(0, 500) || `Autonomous agent: ${agent.name}`,
    image: `https://automaton.cloud/api/agents/${agent.id}/avatar`,
    services: [
      {
        name: 'web',
        endpoint: `https://automaton.cloud/agents/${agent.id}`,
      },
      {
        name: 'agentWallet',
        endpoint: `eip155:8453:${agent.evm_address}`,
      },
      ...(agent.solana_address ? [{
        name: 'solanaWallet', 
        endpoint: `solana:${agent.solana_address}`,
      }] : []),
    ],
    registrations: [
      {
        agentId: null, // Will be set after registration
        agentRegistry: 'eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      },
    ],
    active: true,
    x402Support: false,
    supportedTrust: ['reputation'],
  };
}

function createAgentURI(card: AgentCard): string {
  // Use base64 data URI for now (could upgrade to IPFS later)
  const json = JSON.stringify(card);
  const base64 = Buffer.from(json).toString('base64');
  return `data:application/json;base64,${base64}`;
}

async function registerOnChain(privateKey: string, agentURI: string): Promise<{ agentId: bigint; txHash: Hex }> {
  const account = privateKeyToAccount(privateKey as Hex);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  // Register agent
  const txHash = await walletClient.writeContract({
    address: IDENTITY_CONTRACT,
    abi: IDENTITY_ABI,
    functionName: 'register',
    args: [agentURI],
  });

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Extract agent ID from Transfer event
  let agentId = BigInt(0);
  for (const log of receipt.logs) {
    if (log.topics.length >= 4) {
      // Transfer(address from, address to, uint256 tokenId)
      agentId = BigInt(log.topics[3]!);
      break;
    }
  }

  return { agentId, txHash };
}

/**
 * GET /api/agents/deploy?id=<agentId>
 * 
 * Check deployment status for an agent
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('id');

  if (!agentId) {
    return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
  }

  const agent = await getAgentById(agentId);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const isDeployed = !!agent.erc8004_id;

  return NextResponse.json({
    success: true,
    agentId: agent.id,
    name: agent.name,
    deployed: isDeployed,
    erc8004_id: agent.erc8004_id,
    status: agent.status,
    evmAddress: agent.evm_address,
    explorerUrl: isDeployed 
      ? `https://basescan.org/token/${IDENTITY_CONTRACT}?a=${agent.erc8004_id}`
      : null,
  });
}
