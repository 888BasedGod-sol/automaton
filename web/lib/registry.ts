import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';

const REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

const ABI = parseAbi([
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function agentURI(uint256 agentId) external view returns (string)',
]);

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

export interface RegistryAgent {
  id: string;
  name: string;
  description: string;
  image: string;
  externalUrl: string;
  owner: string;
  tokenId: string;
  skills: string[];
}

async function fetchMetadata(uri: string): Promise<any> {
    if (!uri) return null;
    
    // Handle data: URIs
    if (uri.startsWith('data:application/json;base64,')) {
        try {
            const base64 = uri.split(',')[1];
            const json = Buffer.from(base64, 'base64').toString();
            return JSON.parse(json);
        } catch (e) {
            console.error('Failed to parse data URI:', e);
            return null;
        }
    }

    // Handle IPFS/Arweave gateways
    let fetchUrl = uri;
    if (uri.startsWith('ipfs://')) {
        fetchUrl = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    } else if (uri.startsWith('ar://')) {
        fetchUrl = uri.replace('ar://', 'https://arweave.net/');
    }

    try {
        const res = await fetch(fetchUrl, { next: { revalidate: 3600 } });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error(`Failed to fetch metadata from ${uri}:`, e);
        return null;
    }
}

export async function fetchRegistryAgents(limit = 20): Promise<RegistryAgent[]> {
  const agents: RegistryAgent[] = [];
  
  // Try to fetch first N agents
  // In production, we should index this or use a graph
  const batchSize = 5;
  const batches = Math.ceil(limit / batchSize);

  for (let i = 0; i < batches; i++) {
    const start = i * batchSize;
    const end = Math.min((i + 1) * batchSize, limit);
    
    const promises = [];
    for (let id = start; id < end; id++) {
        promises.push((async () => {
            try {
                const tokenId = BigInt(id);
                // Check ownership first (cheapest check for existence)
                let owner;
                try {
                    owner = await publicClient.readContract({
                        address: REGISTRY_ADDRESS,
                        abi: ABI,
                        functionName: 'ownerOf',
                        args: [tokenId],
                    });
                } catch {
                    return null; // Token doesn't exist
                }

                // Get URI
                let uri;
                try {
                    uri = await publicClient.readContract({
                        address: REGISTRY_ADDRESS,
                        abi: ABI,
                        functionName: 'tokenURI',
                        args: [tokenId],
                    });
                } catch (e) {
                    console.warn(`Failed to get URI for token ${id}`);
                    return null;
                }

                if (!uri) return null;

                const metadata = await fetchMetadata(uri);
                if (!metadata) return null;

                return {
                    id: `erc8004-${id}`,
                    name: metadata.name || `Agent #${id}`,
                    description: metadata.description || 'No description available',
                    image: metadata.image || '',
                    externalUrl: metadata.external_url || '',
                    owner,
                    tokenId: id.toString(),
                    skills: metadata.attributes?.map((a: any) => a.value) || [],
                } as RegistryAgent;

            } catch (e) {
                console.error(`Error fetching agent ${id}:`, e);
                return null;
            }
        })());
    }
    
    const results = await Promise.all(promises);
    agents.push(...results.filter((a): a is RegistryAgent => a !== null));
  }

  return agents;
}
