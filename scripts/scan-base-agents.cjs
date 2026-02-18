const { createPublicClient, http, parseAbi } = require('viem');
const { base } = require('viem/chains');

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

const IDENTITY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

// Extended ABI with more ERC-721 functions
const ABI = parseAbi([
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function tokenByIndex(uint256 index) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function agentURI(uint256 agentId) external view returns (string)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
]);

(async () => {
  try {
    console.log('=== ERC-8004 AgentIdentity Contract ===');
    console.log('Address:', IDENTITY);
    console.log('Chain: Base Mainnet (8453)\n');

    // Get contract info
    const name = await client.readContract({
      address: IDENTITY,
      abi: ABI,
      functionName: 'name',
    });
    console.log('Name:', name);

    const symbol = await client.readContract({
      address: IDENTITY,
      abi: ABI,
      functionName: 'symbol',
    });
    console.log('Symbol:', symbol);

    // Try tokenByIndex (ERC-721 Enumerable)
    console.log('\n=== Checking for registered agents ===');
    try {
      const firstToken = await client.readContract({
        address: IDENTITY,
        abi: ABI,
        functionName: 'tokenByIndex',
        args: [0n],
      });
      console.log('First token ID:', firstToken);
    } catch (e) {
      console.log('tokenByIndex(0) failed - no enumerable or empty');
    }

    // Try known agent addresses from our earlier testing
    // ClawNews owner was visible in earlier tests
    const knownAddresses = [
      '0x89E9E1ab11dD1B138b1dcE6d6A4a0926aaFD5029', // ClawNews
    ];

    for (const addr of knownAddresses) {
      try {
        const balance = await client.readContract({
          address: IDENTITY,
          abi: ABI,
          functionName: 'balanceOf',
          args: [addr],
        });
        console.log(`\nBalance of ${addr}: ${balance}`);
        if (balance > 0n) {
          const tokenId = await client.readContract({
            address: IDENTITY,
            abi: ABI,
            functionName: 'tokenOfOwnerByIndex',
            args: [addr, 0n],
          });
          console.log('Token ID:', tokenId);
        }
      } catch (e) {
        console.log(`Error checking ${addr}:`, e.message.substring(0, 100));
      }
    }

    // Scan for tokens by trying common IDs
    console.log('\n=== Scanning token IDs ===');
    const foundAgents = [];
    
    for (let id = 0; id <= 20; id++) {
      try {
        const owner = await client.readContract({
          address: IDENTITY,
          abi: ABI,
          functionName: 'ownerOf',
          args: [BigInt(id)],
        });
        console.log(`Token ${id}: exists, owner: ${owner.substring(0, 10)}...`);
        
        // Try to get metadata
        try {
          const uri = await client.readContract({
            address: IDENTITY,
            abi: ABI,
            functionName: 'tokenURI',
            args: [BigInt(id)],
          });
          console.log(`  URI (first 50 chars): ${uri.substring(0, 50)}`);
          foundAgents.push({ id, owner, uri });
        } catch {
          // Try agentURI instead
          try {
            const uri = await client.readContract({
              address: IDENTITY,
              abi: ABI,
              functionName: 'agentURI',
              args: [BigInt(id)],
            });
            console.log(`  AgentURI (first 50 chars): ${uri.substring(0, 50)}`);
            foundAgents.push({ id, owner, uri });
          } catch {
            console.log('  No URI available');
          }
        }
      } catch (e) {
        // Token doesn't exist
      }
    }

    console.log(`\nFound ${foundAgents.length} agents on-chain`);

  } catch (e) {
    console.error('Error:', e.message);
  }
})();
