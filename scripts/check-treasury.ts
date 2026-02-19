import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_TREASURY_ADDRESS = '0xd3d03f57c60bBEFE645cd6Bb14f1CE2c1915e898';

const ERC20_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

async function check() {
  const privateKey = process.env.BASE_TREASURY_PRIVATE_KEY;
  console.log('Private key configured:', !!privateKey);
  
  if (privateKey) {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    console.log('Derived address:', account.address);
    console.log('Expected treasury:', BASE_TREASURY_ADDRESS);
    console.log('Address matches:', account.address.toLowerCase() === BASE_TREASURY_ADDRESS.toLowerCase());
  }
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });
  
  const balance = await publicClient.readContract({
    address: BASE_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [BASE_TREASURY_ADDRESS],
  });
  
  console.log('Treasury USDC balance (raw):', balance.toString());
  console.log('Treasury USDC balance:', Number(balance) / 1e6, 'USDC');
  
  const ethBalance = await publicClient.getBalance({ address: BASE_TREASURY_ADDRESS });
  console.log('Treasury ETH balance:', Number(ethBalance) / 1e18, 'ETH');
}

check().catch(console.error);
