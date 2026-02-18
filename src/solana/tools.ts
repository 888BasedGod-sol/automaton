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
  ];
}
