/**
 * Solana Agent Registry
 *
 * On-chain agent identity registry for Solana.
 * Uses a hybrid approach: minimal on-chain data with off-chain metadata URI.
 * 
 * This is the Solana equivalent of ERC-8004 for Ethereum.
 * Agents register their identity with a metadata URI pointing to their agent card.
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import type { SolanaClient } from "./client.js";
import crypto from "crypto";

// Agent Registry Program ID (would be deployed program - using placeholder)
// In production, this would be a deployed Solana program
const AGENT_REGISTRY_SEED = "automaton-agent-v1";

export interface SolanaAgentRegistration {
  pubkey: PublicKey;
  agentUri: string;
  creatorPubkey: PublicKey;
  createdAt: number;
  updatedAt: number;
  active: boolean;
}

export interface AgentCardSolana {
  type: string;
  name: string;
  description: string;
  solanaAddress: string;
  evmAddress?: string;
  services: {
    name: string;
    endpoint: string;
  }[];
  capabilities: string[];
  parentAgent?: string;
  active: boolean;
}

/**
 * Derive the PDA for an agent's registry entry.
 * The PDA is deterministic based on the agent's public key.
 */
export function deriveAgentPDA(
  agentPubkey: PublicKey,
  programId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(AGENT_REGISTRY_SEED),
      agentPubkey.toBuffer(),
    ],
    programId,
  );
}

/**
 * Generate an agent card for Solana.
 */
export function generateSolanaAgentCard(
  name: string,
  description: string,
  solanaAddress: string,
  evmAddress?: string,
  services: { name: string; endpoint: string }[] = [],
  capabilities: string[] = [],
  parentAgent?: string,
): AgentCardSolana {
  return {
    type: "https://automaton.conway.tech/agent-card-solana-v1",
    name,
    description,
    solanaAddress,
    evmAddress,
    services,
    capabilities,
    parentAgent,
    active: true,
  };
}

/**
 * Serialize agent card to JSON.
 */
export function serializeSolanaAgentCard(card: AgentCardSolana): string {
  return JSON.stringify(card, null, 2);
}

/**
 * Create a content hash for the agent card (for verification).
 */
export function hashAgentCard(card: AgentCardSolana): string {
  const json = JSON.stringify(card);
  return crypto.createHash("sha256").update(json).digest("hex");
}

/**
 * Store agent metadata in a memo instruction.
 * This is a lightweight way to record agent identity on-chain without a custom program.
 * The memo contains: agentUri for off-chain metadata lookup.
 */
export async function registerAgentMemo(
  client: SolanaClient,
  agent: Keypair,
  agentUri: string,
): Promise<string> {
  const connection = client.getConnection();

  // Memo Program ID
  const MEMO_PROGRAM_ID = new PublicKey(
    "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
  );

  const memoData = JSON.stringify({
    type: "automaton-agent-registration",
    version: "1.0",
    agentUri,
    timestamp: Date.now(),
  });

  const instruction = new TransactionInstruction({
    keys: [{ pubkey: agent.publicKey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoData),
  });

  const transaction = new Transaction().add(instruction);
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = agent.publicKey;

  const signature = await client.sendTransaction(transaction, [agent]);
  return signature;
}

/**
 * Verify an agent by checking their on-chain registration.
 * Looks for memo transactions from the agent's address.
 */
export async function verifyAgentRegistration(
  client: SolanaClient,
  agentPubkey: string | PublicKey,
): Promise<{ registered: boolean; agentUri?: string; signature?: string }> {
  const connection = client.getConnection();
  const pubkey = typeof agentPubkey === "string" 
    ? new PublicKey(agentPubkey) 
    : agentPubkey;

  try {
    // Get recent transactions for the agent
    const signatures = await connection.getSignaturesForAddress(pubkey, {
      limit: 100,
    });

    // Memo Program ID
    const MEMO_PROGRAM_ID = new PublicKey(
      "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
    );

    for (const sig of signatures) {
      const tx = await connection.getParsedTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx?.meta || tx.meta.err) continue;

      // Look for memo instructions
      for (const inst of tx.transaction.message.instructions) {
        if ("programId" in inst && inst.programId.equals(MEMO_PROGRAM_ID)) {
          // Try to parse as agent registration
          try {
            // The data is in the 'data' field for parsed instructions
            const memo = "data" in inst ? inst.data : null;
            if (memo) {
              const parsed = JSON.parse(memo);
              if (parsed.type === "automaton-agent-registration") {
                return {
                  registered: true,
                  agentUri: parsed.agentUri,
                  signature: sig.signature,
                };
              }
            }
          } catch {
            // Not a valid agent registration memo
          }
        }
      }
    }

    return { registered: false };
  } catch {
    return { registered: false };
  }
}

/**
 * Discover agents on Solana by searching for registration memos.
 * This is a basic discovery mechanism - production would use indexers.
 */
export async function discoverAgents(
  client: SolanaClient,
  limit: number = 10,
): Promise<SolanaAgentRegistration[]> {
  // In production, this would query an indexer or dedicated program
  // For now, return empty array - discovery requires infrastructure
  console.log(`[SOLANA] Agent discovery requires indexer infrastructure`);
  return [];
}

/**
 * Fetch agent card from URI.
 */
export async function fetchAgentCard(
  agentUri: string,
): Promise<AgentCardSolana | null> {
  try {
    const response = await fetch(agentUri);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
