/**
 * Solana Tools
 *
 * Tools for the automaton to interact with Solana blockchain.
 * These are exposed to the agent's tool system.
 */

import type { AutomatonTool, ToolContext } from "../types.js";
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
import { PublicKey } from "@solana/web3.js";

/**
 * Create Solana-specific tools for the automaton.
 */
export function createSolanaTools(): AutomatonTool[] {
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
            description: "Solana address (base58). Defaults to automaton's address if not provided.",
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
            description: "Solana address (base58). Defaults to automaton's address.",
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
            description: "Solana address (base58). Defaults to automaton's address.",
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
      description: "Transfer SOL to another address. Requires automaton wallet.",
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
      description: "Register the automaton as an agent on Solana using memo transactions.",
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
      description: "Verify if an address is a registered automaton agent on Solana.",
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
          (args.description as string) || `Automaton agent: ${ctx.config.genesisPrompt}`,
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
      description: "Get information about the automaton's Solana wallet.",
      category: "financial",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      execute: async (args, ctx) => {
        const address = getSolanaWalletAddress();
        
        if (!address) {
          return "No Solana wallet configured. The automaton can generate one during setup.";
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
  ];
}
