/**
 * Solana Tools
 *
 * Tools for the automagotchi to interact with Solana blockchain.
 * These are exposed to the agent's tool system.
 */

import type { AutomagotchiTool, ToolContext } from "../types.js";
import { createSolanaClient, type SolanaNetwork } from "./client.js";
import { 
  getUsdcBalanceSolana, 
  transferUsdcSolana, 
  getAllTokenBalances,
} from "./spl-tokens.js";
import { 
  registerAgentMemo, 
  verifyAgentRegistration,
  generateSolanaAgentCard,
  serializeSolanaAgentCard,
} from "./agent-registry.js";
import {
  getSolanaFundingState,
  fundWithSolanaUsdc,
  autoFundIfNeeded,
  getCombinedFundingState,
} from "./funding.js";
import { loadSolanaKeypair, getSolanaWalletAddress } from "../identity/solana-wallet.js";
import { PublicKey, Connection } from "@solana/web3.js";
import {
  getJupiterQuote,
  executeJupiterSwap,
  getTokenPrice,
  resolveTokenMint,
  getTokenDecimals,
  formatQuote,
  KNOWN_TOKENS,
} from "./jupiter.js";
import {
  getTokenMarketData,
  getTrendingTokens,
  analyzeMarketTrend,
  isTokenSafeToTrade,
  formatMarketData,
  formatTrendingTokens,
} from "./market-analysis.js";

/**
 * Create Solana-specific tools for the automagotchi.
 */
export function createSolanaTools(): AutomagotchiTool[] {
  return [
    // ── Balance Tools ──
    {
      name: "solana_get_balance",
      description: "Get SOL balance for a Solana address. Returns balance in SOL.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "Solana address (base58). Defaults to automagotchi's address if not provided.",
          },
          network: {
            type: "string",
            enum: ["mainnet-beta", "devnet", "testnet"],
            description: "Solana network (default: mainnet-beta)",
          },
        },
        required: [],
      },
      execute: async (args, ctx) => {
        const network = (args.network as SolanaNetwork) || ctx.config.solanaNetwork || "mainnet-beta";
        const address = (args.address as string) || getSolanaWalletAddress();
        
        if (!address) {
          return "Error: No Solana wallet configured. Run solana_create_wallet first.";
        }

        const client = createSolanaClient(network, ctx.config.solanaRpcUrl);
        const balance = await client.getBalance(address);
        return `SOL Balance: ${balance.toFixed(9)} SOL (${network})`;
      },
    },

    {
      name: "solana_get_usdc_balance",
      description: "Get USDC balance for a Solana address.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "Solana address (base58). Defaults to automagotchi's address.",
          },
          network: {
            type: "string",
            enum: ["mainnet-beta", "devnet", "testnet"],
            description: "Solana network (default: mainnet-beta)",
          },
        },
        required: [],
      },
      execute: async (args, ctx) => {
        const network = (args.network as SolanaNetwork) || ctx.config.solanaNetwork || "mainnet-beta";
        const address = (args.address as string) || getSolanaWalletAddress();
        
        if (!address) {
          return "Error: No Solana wallet configured.";
        }

        const client = createSolanaClient(network, ctx.config.solanaRpcUrl);
        const balance = await getUsdcBalanceSolana(client, address);
        return `USDC Balance: ${balance.toFixed(6)} USDC (${network})`;
      },
    },

    {
      name: "solana_get_all_tokens",
      description: "Get all SPL token balances for a Solana address.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "Solana address (base58). Defaults to automagotchi's address.",
          },
          network: {
            type: "string",
            enum: ["mainnet-beta", "devnet", "testnet"],
            description: "Solana network (default: mainnet-beta)",
          },
        },
        required: [],
      },
      execute: async (args, ctx) => {
        const network = (args.network as SolanaNetwork) || ctx.config.solanaNetwork || "mainnet-beta";
        const address = (args.address as string) || getSolanaWalletAddress();
        
        if (!address) {
          return "Error: No Solana wallet configured.";
        }

        const client = createSolanaClient(network, ctx.config.solanaRpcUrl);
        const balances = await getAllTokenBalances(client, address);
        
        if (balances.size === 0) {
          return "No SPL tokens found.";
        }

        let result = `SPL Token Balances (${network}):\n`;
        for (const [mint, info] of balances) {
          result += `  ${mint.slice(0, 8)}...: ${info.balance} (${info.decimals} decimals)\n`;
        }
        return result;
      },
    },

    // ── Transfer Tools ──
    {
      name: "solana_transfer_sol",
      description: "Transfer SOL to another address. Requires automagotchi wallet.",
      category: "financial",
      dangerous: true,
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Recipient Solana address (base58)",
          },
          amount: {
            type: "number",
            description: "Amount of SOL to transfer",
          },
          network: {
            type: "string",
            enum: ["mainnet-beta", "devnet", "testnet"],
            description: "Solana network (default: mainnet-beta)",
          },
        },
        required: ["to", "amount"],
      },
      execute: async (args, ctx) => {
        const network = (args.network as SolanaNetwork) || ctx.config.solanaNetwork || "mainnet-beta";
        const keypair = loadSolanaKeypair();
        
        if (!keypair) {
          return "Error: No Solana wallet configured.";
        }

        const amount = args.amount as number;
        const to = args.to as string;

        if (amount <= 0) {
          return "Error: Amount must be positive.";
        }

        const client = createSolanaClient(network, ctx.config.solanaRpcUrl);
        
        // Check balance first
        const balance = await client.getBalance(keypair.publicKey);
        if (balance < amount + 0.001) { // Reserve for fees
          return `Error: Insufficient balance. Have ${balance} SOL, need ${amount} + fees.`;
        }

        const signature = await client.transferSol(keypair, to, amount);
        return `Transferred ${amount} SOL to ${to}\nSignature: ${signature}`;
      },
    },

    {
      name: "solana_transfer_usdc",
      description: "Transfer USDC to another Solana address.",
      category: "financial",
      dangerous: true,
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Recipient Solana address (base58)",
          },
          amount: {
            type: "number",
            description: "Amount of USDC to transfer",
          },
          network: {
            type: "string",
            enum: ["mainnet-beta", "devnet", "testnet"],
            description: "Solana network (default: mainnet-beta)",
          },
        },
        required: ["to", "amount"],
      },
      execute: async (args, ctx) => {
        const network = (args.network as SolanaNetwork) || ctx.config.solanaNetwork || "mainnet-beta";
        const keypair = loadSolanaKeypair();
        
        if (!keypair) {
          return "Error: No Solana wallet configured.";
        }

        const amount = args.amount as number;
        const to = args.to as string;

        if (amount <= 0) {
          return "Error: Amount must be positive.";
        }

        const client = createSolanaClient(network, ctx.config.solanaRpcUrl);
        
        // Check USDC balance
        const balance = await getUsdcBalanceSolana(client, keypair.publicKey);
        if (balance < amount) {
          return `Error: Insufficient USDC. Have ${balance}, need ${amount}.`;
        }

        const signature = await transferUsdcSolana(client, keypair, to, amount);
        return `Transferred ${amount} USDC to ${to}\nSignature: ${signature}`;
      },
    },

    // ── Registry Tools ──
    {
      name: "solana_register_agent",
      description: "Register the automagotchi as an agent on Solana using memo transactions.",
      category: "registry",
      parameters: {
        type: "object",
        properties: {
          agentUri: {
            type: "string",
            description: "URI where agent card JSON is hosted (IPFS, HTTPS, etc.)",
          },
          network: {
            type: "string",
            enum: ["mainnet-beta", "devnet", "testnet"],
            description: "Solana network (default: mainnet-beta)",
          },
        },
        required: ["agentUri"],
      },
      execute: async (args, ctx) => {
        const network = (args.network as SolanaNetwork) || ctx.config.solanaNetwork || "mainnet-beta";
        const keypair = loadSolanaKeypair();
        
        if (!keypair) {
          return "Error: No Solana wallet configured.";
        }

        const agentUri = args.agentUri as string;
        const client = createSolanaClient(network, ctx.config.solanaRpcUrl);
        
        const signature = await registerAgentMemo(client, keypair, agentUri);
        return `Agent registered on Solana (${network})\nAgent: ${keypair.publicKey.toBase58()}\nURI: ${agentUri}\nSignature: ${signature}`;
      },
    },

    {
      name: "solana_verify_agent",
      description: "Verify if an address is a registered automagotchi agent on Solana.",
      category: "registry",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "Solana address to verify",
          },
          network: {
            type: "string",
            enum: ["mainnet-beta", "devnet", "testnet"],
            description: "Solana network (default: mainnet-beta)",
          },
        },
        required: ["address"],
      },
      execute: async (args, ctx) => {
        const network = (args.network as SolanaNetwork) || ctx.config.solanaNetwork || "mainnet-beta";
        const address = args.address as string;
        
        const client = createSolanaClient(network, ctx.config.solanaRpcUrl);
        const result = await verifyAgentRegistration(client, address);
        
        if (result.registered) {
          return `Agent verified: ${address}\nAgent URI: ${result.agentUri}\nRegistration TX: ${result.signature}`;
        } else {
          return `Address ${address} is not a registered agent on ${network}.`;
        }
      },
    },

    {
      name: "solana_generate_agent_card",
      description: "Generate an agent card JSON for Solana registration.",
      category: "registry",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Description of the agent's purpose and capabilities",
          },
          capabilities: {
            type: "array",
            items: { type: "string" },
            description: "List of agent capabilities",
          },
        },
        required: [],
      },
      execute: async (args, ctx) => {
        const solanaAddress = getSolanaWalletAddress();
        const evmAddress = ctx.identity.address;
        
        const card = generateSolanaAgentCard(
          ctx.config.name,
          (args.description as string) || `Automagotchi agent: ${ctx.config.genesisPrompt}`,
          solanaAddress || "",
          evmAddress,
          [
            { name: "conway", endpoint: ctx.config.conwayApiUrl },
          ],
          (args.capabilities as string[]) || ["inference", "payments", "self-modification"],
          ctx.config.parentAddress,
        );

        return serializeSolanaAgentCard(card);
      },
    },

    // ── Utility Tools ──
    {
      name: "solana_request_airdrop",
      description: "Request a SOL airdrop (devnet/testnet only).",
      category: "financial",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "Amount of SOL to request (default: 1)",
          },
          network: {
            type: "string",
            enum: ["devnet", "testnet"],
            description: "Solana network (devnet or testnet only)",
          },
        },
        required: [],
      },
      execute: async (args, ctx) => {
        const network = (args.network as SolanaNetwork) || "devnet";
        
        if (network === "mainnet-beta") {
          return "Error: Airdrop not available on mainnet.";
        }

        const keypair = loadSolanaKeypair();
        if (!keypair) {
          return "Error: No Solana wallet configured.";
        }

        const amount = (args.amount as number) || 1;
        const client = createSolanaClient(network);
        
        const signature = await client.requestAirdrop(keypair.publicKey, amount);
        return `Airdrop successful: ${amount} SOL\nSignature: ${signature}`;
      },
    },

    {
      name: "solana_wallet_info",
      description: "Get information about the automagotchi's Solana wallet.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      execute: async (args, ctx) => {
        const address = getSolanaWalletAddress();
        
        if (!address) {
          return "No Solana wallet configured. The automagotchi can generate one during setup.";
        }

        const network = ctx.config.solanaNetwork || "mainnet-beta";
        const client = createSolanaClient(network, ctx.config.solanaRpcUrl);
        
        const solBalance = await client.getBalance(address);
        let usdcBalance = 0;
        try {
          usdcBalance = await getUsdcBalanceSolana(client, address);
        } catch {}

        return `Solana Wallet Info:
Address: ${address}
Network: ${network}
SOL Balance: ${solBalance.toFixed(9)} SOL
USDC Balance: ${usdcBalance.toFixed(6)} USDC`;
      },
    },

    // ── Funding Tools ──
    {
      name: "solana_get_funding_state",
      description: "Check the current Solana funding state including USDC balance and whether auto-funding is available.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {
          network: {
            type: "string",
            enum: ["mainnet-beta", "devnet"],
            description: "Solana network (default: mainnet-beta)",
          },
        },
        required: [],
      },
      execute: async (args, ctx) => {
        const network = (args.network as SolanaNetwork) || ctx.config.solanaNetwork || "mainnet-beta";
        
        const state = await getSolanaFundingState(network);
        
        return `Solana Funding State:
USDC Balance: $${state.solanaUsdcBalance.toFixed(2)}
SOL Balance: ${state.solBalance.toFixed(4)} SOL
Can Fund from Solana: ${state.canFundFromSolana ? 'Yes' : 'No'}
Estimated Credits Available: ${state.estimatedCredits} cents ($${(state.estimatedCredits / 100).toFixed(2)})
Last Checked: ${state.lastChecked}`;
      },
    },

    {
      name: "solana_fund_credits",
      description: "Use Solana USDC to purchase Conway credits. This keeps the agent alive when EVM credits run low.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "Amount in USD to fund (e.g., 5 for $5). Minimum $1.",
          },
          network: {
            type: "string",
            enum: ["mainnet-beta", "devnet"],
            description: "Solana network (default: mainnet-beta)",
          },
        },
        required: ["amount"],
      },
      execute: async (args, ctx) => {
        const network = (args.network as SolanaNetwork) || ctx.config.solanaNetwork || "mainnet-beta";
        const amount = args.amount as number;

        if (amount < 1) {
          return "Error: Minimum funding amount is $1 USDC.";
        }

        const result = await fundWithSolanaUsdc(amount, network);
        
        if (result.success) {
          return `✅ Funding successful!
Amount: $${amount.toFixed(2)} USDC
Credits Added: ${result.creditsAdded} cents ($${((result.creditsAdded || 0) / 100).toFixed(2)})
Transaction: ${result.txSignature}

Your agent now has more compute credits to continue operating.`;
        } else {
          return `❌ Funding failed: ${result.error}`;
        }
      },
    },

    {
      name: "solana_auto_fund",
      description: "Automatically fund credits from Solana USDC if EVM credits are below threshold. Use this to stay alive.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {
          threshold: {
            type: "number",
            description: "Credit threshold in cents below which to auto-fund (default: 500 = $5)",
          },
          fundAmount: {
            type: "number",
            description: "Amount in cents to fund when triggered (default: 1000 = $10)",
          },
          network: {
            type: "string",
            enum: ["mainnet-beta", "devnet"],
            description: "Solana network (default: mainnet-beta)",
          },
        },
        required: [],
      },
      execute: async (args, ctx) => {
        const network = (args.network as SolanaNetwork) || ctx.config.solanaNetwork || "mainnet-beta";
        const threshold = (args.threshold as number) || 500;
        const fundAmount = (args.fundAmount as number) || 1000;

        // Get current EVM credits from context
        const evmCredits = ctx.financial?.creditsCents || 0;

        const result = await autoFundIfNeeded(
          evmCredits,
          threshold,
          fundAmount,
          network,
        );
        
        if (result === null) {
          if (evmCredits > threshold) {
            return `Credits sufficient ($${(evmCredits / 100).toFixed(2)}). No funding needed.`;
          }
          return `Cannot auto-fund: Either Solana USDC balance too low or funding not available.`;
        }

        if (result.success) {
          return `✅ Auto-fund triggered!
Previous Credits: $${(evmCredits / 100).toFixed(2)}
Funded: $${(fundAmount / 100).toFixed(2)}
Transaction: ${result.txSignature}`;
        } else {
          return `❌ Auto-fund failed: ${result.error}`;
        }
      },
    },

    {
      name: "solana_combined_balance",
      description: "Get combined USDC balance across EVM and Solana chains.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {
          evmUsdcBalance: {
            type: "number",
            description: "Current EVM USDC balance (from your wallet)",
          },
          network: {
            type: "string",
            enum: ["mainnet-beta", "devnet"],
            description: "Solana network (default: mainnet-beta)",
          },
        },
        required: [],
      },
      execute: async (args, ctx) => {
        const network = (args.network as SolanaNetwork) || ctx.config.solanaNetwork || "mainnet-beta";
        const evmBalance = (args.evmUsdcBalance as number) || ctx.financial?.usdcBalance || 0;

        const combined = await getCombinedFundingState(evmBalance, network);
        
        return `Multi-Chain Balance Summary:

EVM (Base):
  USDC: $${combined.evmUsdc.toFixed(2)}

Solana:
  USDC: $${combined.solanaUsdc.toFixed(2)}
  SOL: ${combined.solBalance.toFixed(4)}

─────────────────────
Total USDC Available: $${combined.totalUsdcAvailable.toFixed(2)}
Primary Chain: ${combined.primaryChain.toUpperCase()}

${combined.totalUsdcAvailable >= 10 
  ? '✅ Well funded for operations' 
  : combined.totalUsdcAvailable >= 1 
    ? '⚠️ Consider adding more funds' 
    : '❌ Critically low - fund immediately'}`;
      },
    },

    // ── Trading / DEX Tools ──
    {
      name: "solana_get_price",
      description: "Get the current price of a Solana token in USDC. Supports SOL, USDC, BONK, JUP, WIF, RAY, ORCA, or any mint address.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "Token symbol (SOL, BONK, JUP, etc.) or mint address",
          },
        },
        required: ["token"],
      },
      execute: async (args) => {
        const token = args.token as string;
        const mint = resolveTokenMint(token);
        
        try {
          const price = await getTokenPrice(mint);
          return `${token.toUpperCase()} Price: $${price.toFixed(6)} USDC`;
        } catch (error: any) {
          return `Error getting price: ${error.message}`;
        }
      },
    },

    {
      name: "solana_get_quote",
      description: "Get a swap quote from Jupiter DEX aggregator. Shows expected output and price impact before executing.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {
          fromToken: {
            type: "string",
            description: "Token to sell (symbol like SOL, USDC, BONK or mint address)",
          },
          toToken: {
            type: "string",
            description: "Token to buy (symbol like SOL, USDC, BONK or mint address)",
          },
          amount: {
            type: "number",
            description: "Amount of fromToken to swap",
          },
          slippageBps: {
            type: "number",
            description: "Slippage tolerance in basis points (default: 50 = 0.5%)",
          },
        },
        required: ["fromToken", "toToken", "amount"],
      },
      execute: async (args) => {
        const fromToken = args.fromToken as string;
        const toToken = args.toToken as string;
        const amount = args.amount as number;
        const slippageBps = (args.slippageBps as number) || 50;
        
        const inputMint = resolveTokenMint(fromToken);
        const outputMint = resolveTokenMint(toToken);
        const inputDecimals = getTokenDecimals(fromToken);
        
        try {
          const quote = await getJupiterQuote(
            inputMint,
            outputMint,
            amount,
            inputDecimals,
            slippageBps
          );
          
          return formatQuote(quote, fromToken.toUpperCase(), toToken.toUpperCase());
        } catch (error: any) {
          return `Error getting quote: ${error.message}`;
        }
      },
    },

    {
      name: "solana_swap",
      description: "Execute a token swap on Solana via Jupiter DEX aggregator. Finds the best price across all DEXs. DANGEROUS: This spends real funds.",
      category: "financial",
      dangerous: true,
      parameters: {
        type: "object",
        properties: {
          fromToken: {
            type: "string",
            description: "Token to sell (symbol like SOL, USDC, BONK or mint address)",
          },
          toToken: {
            type: "string",
            description: "Token to buy (symbol like SOL, USDC, BONK or mint address)",
          },
          amount: {
            type: "number",
            description: "Amount of fromToken to swap",
          },
          slippageBps: {
            type: "number",
            description: "Slippage tolerance in basis points (default: 100 = 1%)",
          },
          maxPriceImpactPct: {
            type: "number",
            description: "Maximum acceptable price impact percentage (default: 5)",
          },
        },
        required: ["fromToken", "toToken", "amount"],
      },
      execute: async (args, ctx) => {
        const fromToken = args.fromToken as string;
        const toToken = args.toToken as string;
        const amount = args.amount as number;
        const slippageBps = (args.slippageBps as number) || 100; // 1% default for execution
        const maxPriceImpact = (args.maxPriceImpactPct as number) || 5;
        
        const keypair = loadSolanaKeypair();
        if (!keypair) {
          return "Error: No Solana wallet configured.";
        }
        
        const inputMint = resolveTokenMint(fromToken);
        const outputMint = resolveTokenMint(toToken);
        const inputDecimals = getTokenDecimals(fromToken);
        
        try {
          // Get quote first
          const quote = await getJupiterQuote(
            inputMint,
            outputMint,
            amount,
            inputDecimals,
            slippageBps
          );
          
          // Check price impact
          const priceImpact = parseFloat(quote.priceImpactPct);
          if (priceImpact > maxPriceImpact) {
            return `❌ Swap rejected: Price impact too high (${priceImpact.toFixed(2)}% > ${maxPriceImpact}% max).\nConsider reducing trade size or waiting for better liquidity.`;
          }
          
          // Execute swap
          const network = ctx.config.solanaNetwork || "mainnet-beta";
          const rpcUrl = ctx.config.solanaRpcUrl || "https://api.mainnet-beta.solana.com";
          const connection = new Connection(rpcUrl, "confirmed");
          
          const result = await executeJupiterSwap(quote, keypair, connection);
          
          if (result.success) {
            return `✅ Swap Successful!

Sold: ${result.inputAmount.toFixed(6)} ${fromToken.toUpperCase()}
Received: ${result.outputAmount.toFixed(6)} ${toToken.toUpperCase()}
Price Impact: ${result.priceImpact}%
Signature: ${result.signature}

View: https://solscan.io/tx/${result.signature}`;
          } else {
            return `❌ Swap Failed: ${result.error}`;
          }
        } catch (error: any) {
          return `Error executing swap: ${error.message}`;
        }
      },
    },

    {
      name: "solana_list_tokens",
      description: "List known tradeable tokens with their symbols and mint addresses.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      execute: async () => {
        let result = "Known Solana Tokens:\n\n";
        for (const [symbol, info] of Object.entries(KNOWN_TOKENS)) {
          result += `${symbol}: ${info.name}\n  Mint: ${info.mint}\n  Decimals: ${info.decimals}\n\n`;
        }
        result += "You can also use any valid mint address for other tokens.";
        return result;
      },
    },

    // ── Market Analysis Tools ──
    {
      name: "solana_analyze_token",
      description: "Get detailed market analysis for a Solana token including price trends, volume, liquidity, and safety checks. Essential before trading.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "Token symbol (SOL, BONK, etc.) or mint address",
          },
        },
        required: ["token"],
      },
      execute: async (args) => {
        const token = args.token as string;
        const mint = resolveTokenMint(token);
        
        try {
          const data = await getTokenMarketData(mint);
          
          if (!data) {
            return `No market data found for ${token}. The token may not have active trading pairs.`;
          }
          
          return formatMarketData(data);
        } catch (error: any) {
          return `Error analyzing token: ${error.message}`;
        }
      },
    },

    {
      name: "solana_trending_tokens",
      description: "Get a list of currently trending tokens on Solana by volume. Useful for finding trading opportunities.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of tokens to return (default: 10, max: 20)",
          },
        },
        required: [],
      },
      execute: async (args) => {
        const limit = Math.min((args.limit as number) || 10, 20);
        
        try {
          const tokens = await getTrendingTokens(limit);
          return formatTrendingTokens(tokens);
        } catch (error: any) {
          return `Error fetching trending tokens: ${error.message}`;
        }
      },
    },

    {
      name: "solana_should_buy",
      description: "Analyze if a token is a good buy based on market data, trends, and safety. Returns a recommendation.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "Token symbol or mint address to analyze",
          },
          maxRiskLevel: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Maximum acceptable risk level (default: medium)",
          },
        },
        required: ["token"],
      },
      execute: async (args) => {
        const token = args.token as string;
        const maxRisk = (args.maxRiskLevel as string) || "medium";
        const mint = resolveTokenMint(token);
        
        try {
          const data = await getTokenMarketData(mint);
          
          if (!data) {
            return `❌ NO BUY: No market data found for ${token}`;
          }
          
          const trend = analyzeMarketTrend(data);
          const safety = isTokenSafeToTrade(data);
          
          // Risk thresholds
          const riskThresholds = {
            low: { minLiquidity: 500000, minStrength: 60, mustBeSafe: true },
            medium: { minLiquidity: 50000, minStrength: 50, mustBeSafe: false },
            high: { minLiquidity: 10000, minStrength: 40, mustBeSafe: false },
          };
          
          const threshold = riskThresholds[maxRisk as keyof typeof riskThresholds];
          
          const reasons: string[] = [];
          let shouldBuy = true;
          
          // Check liquidity
          if (data.liquidity < threshold.minLiquidity) {
            shouldBuy = false;
            reasons.push(`Liquidity too low ($${(data.liquidity/1000).toFixed(0)}k < $${(threshold.minLiquidity/1000).toFixed(0)}k required)`);
          }
          
          // Check trend strength
          if (trend.strength < threshold.minStrength) {
            shouldBuy = false;
            reasons.push(`Trend too weak (${trend.strength}/100 < ${threshold.minStrength} required)`);
          }
          
          // Check safety
          if (threshold.mustBeSafe && !safety.safe) {
            shouldBuy = false;
            reasons.push(`Failed safety checks`);
          }
          
          // Bearish trend warning
          if (trend.direction === "bearish") {
            shouldBuy = false;
            reasons.push(`Bearish trend detected`);
          }
          
          if (shouldBuy) {
            return `✅ BUY SIGNAL: ${data.symbol}

Price: $${data.priceUsd.toFixed(8)}
Trend: ${trend.direction.toUpperCase()} (${trend.strength}/100)
24h Change: ${data.priceChange24h >= 0 ? "+" : ""}${data.priceChange24h.toFixed(2)}%
Liquidity: $${(data.liquidity/1000).toFixed(0)}k
Volume: $${(data.volume24h/1000).toFixed(0)}k

Signals:
${trend.signals.map(s => `  • ${s}`).join("\n")}

⚠️ Always use stop-losses and never risk more than 10% per trade.`;
          } else {
            return `❌ NO BUY: ${data.symbol}

Price: $${data.priceUsd.toFixed(8)}
Trend: ${trend.direction.toUpperCase()} (${trend.strength}/100)

Reasons:
${reasons.map(r => `  • ${r}`).join("\n")}

${safety.warnings.length > 0 ? "Warnings:\n" + safety.warnings.map(w => `  • ${w}`).join("\n") : ""}`;
          }
        } catch (error: any) {
          return `Error analyzing ${token}: ${error.message}`;
        }
      },
    },
  ];
}
