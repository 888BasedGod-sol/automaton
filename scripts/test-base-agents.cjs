const { createPublicClient, http, parseAbi } = require('viem');
const { base } = require('viem/chains');

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

const IDENTITY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

const ABI = parseAbi([
  'function agentURI(uint256 agentId) external view returns (string)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
]);

(async () => {
  try {
    // Try to get contract name
    const name = await client.readContract({
      address: IDENTITY,
      abi: ABI,
      functionName: 'name',
    });
    console.log('Contract name:', name);

    // Try agent ID 1
    const uri = await client.readContract({
      address: IDENTITY,
      abi: ABI,
      functionName: 'agentURI',
      args: [1n],
    });
    console.log('Agent 1 URI (first 100 chars):', uri.substring(0, 100));

    // Decode the URI if it's base64
    if (uri.startsWith('eyJ')) {
      const decoded = JSON.parse(Buffer.from(uri, 'base64').toString('utf8'));
      console.log('Decoded agent:', JSON.stringify(decoded, null, 2).substring(0, 500));
    }

    const owner = await client.readContract({
      address: IDENTITY,
      abi: ABI,
      functionName: 'ownerOf',
      args: [1n],
    });
    console.log('Agent 1 owner:', owner);

    // Try more IDs
    for (let i = 2; i <= 5; i++) {
      try {
        const uri = await client.readContract({
          address: IDENTITY,
          abi: ABI,
          functionName: 'agentURI',
          args: [BigInt(i)],
        });
        const decoded = JSON.parse(Buffer.from(uri, 'base64').toString('utf8'));
        console.log(`Agent ${i}:`, decoded.name || 'Unknown');
      } catch (e) {
        console.log(`Agent ${i}: Not found`);
        break;
      }
    }

  } catch (e) {
    console.error('Error:', e.message);
  }
})();
