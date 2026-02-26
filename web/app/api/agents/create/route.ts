import { NextRequest, NextResponse } from 'next/server';
import { generateWallets } from '@/lib/wallets';
import { createAgent as createDbAgent, isPostgresConfigured, initDatabase, updateAgentDeployment } from '@/lib/postgres';
import { createDeployment, initDeploymentTables, updateDeploymentStage } from '@/lib/deployments';
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

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

function buildAgentCard(agent: any): AgentCard {
  const skills = Array.isArray(agent.skills) 
    ? agent.skills 
    : (typeof agent.skills === 'string' ? JSON.parse(agent.skills || '[]') : []);
  
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: agent.name,
    description: agent.genesis_prompt?.substring(0, 500) || `Autonomous agent: ${agent.name}`,
    image: `https://automagotchi.cloud/api/agents/${agent.id}/avatar`,
    services: [
      {
        name: 'web',
        endpoint: `https://automagotchi.cloud/agents/${agent.id}`,
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
        agentId: null,
        agentRegistry: 'eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      },
    ],
    active: true,
    x402Support: false,
    supportedTrust: ['reputation'],
  };
}

function createAgentURI(card: AgentCard): string {
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

  const txHash = await walletClient.writeContract({
    address: IDENTITY_CONTRACT,
    abi: IDENTITY_ABI,
    functionName: 'register',
    args: [agentURI],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  let agentId = BigInt(0);
  for (const log of receipt.logs) {
    if (log.topics.length >= 4) {
      agentId = BigInt(log.topics[3]!);
      break;
    }
  }

  return { agentId, txHash };
}

export async function POST(request: NextRequest) {
  let deploymentId: string | null = null;
  
  try {
    const body = await request.json();
    const { name, genesisPrompt, ownerWallet, skipRegistry } = body;

    // Validate inputs
    if (!name || typeof name !== 'string' || name.length < 1) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!genesisPrompt || typeof genesisPrompt !== 'string' || genesisPrompt.length < 10) {
      return NextResponse.json({ error: 'Genesis prompt must be at least 10 characters' }, { status: 400 });
    }
    if (!ownerWallet || typeof ownerWallet !== 'string') {
      return NextResponse.json({ error: 'Owner wallet is required. Please connect your Solana wallet.' }, { status: 400 });
    }

    if (!isPostgresConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Generate wallets for the agent
    const wallets = generateWallets();

    // Create agent in Postgres
    await initDatabase();
    await initDeploymentTables();
    
    const agent = await createDbAgent({
      name,
      genesis_prompt: genesisPrompt,
      creator_wallet: 'web-dashboard',
      owner_wallet: ownerWallet,
      evm_address: wallets.evm.address,
      evm_private_key: wallets.evm.privateKey,
      solana_address: wallets.solana.address,
      solana_private_key: wallets.solana.privateKey,
      skills: [],
    });

    if (!agent) {
      return NextResponse.json({ error: 'Failed to create agent in database' }, { status: 500 });
    }

    // Create deployment tracking record
    try {
      deploymentId = await createDeployment(agent.id);
    } catch (e) {
      console.error('Failed to create deployment record:', e);
    }

    // Auto-register to ERC-8004 if treasury key is configured
    const treasuryKey = process.env.BASE_TREASURY_PRIVATE_KEY;
    let erc8004Id: string | null = null;
    let txHash: string | null = null;
    let registrationError: string | null = null;

    if (treasuryKey && !skipRegistry) {
      try {
        // Update deployment stage
        if (deploymentId) {
          await updateDeploymentStage(deploymentId, 'registering', {
            message: 'Registering agent wallet on Base ERC-8004 registry',
          });
        }

        // Build agent card with wallet info
        const card = buildAgentCard({
          id: agent.id,
          name: agent.name,
          genesis_prompt: genesisPrompt,
          evm_address: wallets.evm.address,
          solana_address: wallets.solana.address,
          skills: [],
        });

        // Create metadata URI and register on-chain
        const agentURI = createAgentURI(card);
        const result = await registerOnChain(treasuryKey, agentURI);
        
        erc8004Id = result.agentId.toString();
        txHash = result.txHash;

        // Update agent in database with ERC-8004 ID
        await updateAgentDeployment(agent.id, erc8004Id, card);

        // Update deployment stage
        if (deploymentId) {
          await updateDeploymentStage(deploymentId, 'registered', {
            message: 'Agent wallet connected to ERC-8004 registry',
            txHash,
            erc8004Id,
          });
        }

        console.log(`[Create] Agent ${agent.id} registered to ERC-8004 with ID ${erc8004Id}`);
      } catch (regError) {
        console.error('[Create] Failed to register agent on ERC-8004:', regError);
        registrationError = regError instanceof Error ? regError.message : 'Registration failed';
        
        // Update deployment stage to show failure
        if (deploymentId) {
          await updateDeploymentStage(deploymentId, 'created', {
            message: 'Agent created but ERC-8004 registration failed',
            error: registrationError,
          });
        }
      }
    } else if (!treasuryKey) {
      console.log('[Create] BASE_TREASURY_PRIVATE_KEY not configured - skipping ERC-8004 registration');
    }

    return NextResponse.json({
      success: true,
      id: agent.id,
      deploymentId,
      evmAddress: agent.evm_address,
      solanaAddress: agent.solana_address,
      name: agent.name,
      status: agent.status,
      ownerWallet: agent.owner_wallet,
      // ERC-8004 registration info
      erc8004Id,
      txHash,
      registeredOnChain: !!erc8004Id,
      registrationError,
      explorerUrl: txHash ? `https://basescan.org/tx/${txHash}` : null,
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
