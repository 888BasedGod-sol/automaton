/**
 * Solana Client
 *
 * RPC client for Solana blockchain interactions.
 * Supports mainnet-beta, devnet, and custom RPC endpoints.
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";

export type SolanaNetwork = "mainnet-beta" | "devnet" | "testnet" | "localnet";

export interface SolanaClientConfig {
  network: SolanaNetwork;
  rpcUrl?: string;
  commitment?: "processed" | "confirmed" | "finalized";
}

const DEFAULT_RPC_URLS: Record<SolanaNetwork, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  localnet: "http://localhost:8899",
};

export class SolanaClient {
  private connection: Connection;
  private network: SolanaNetwork;

  constructor(config: SolanaClientConfig) {
    this.network = config.network;
    const rpcUrl = config.rpcUrl || DEFAULT_RPC_URLS[config.network];
    this.connection = new Connection(rpcUrl, config.commitment || "confirmed");
  }

  getConnection(): Connection {
    return this.connection;
  }

  getNetwork(): SolanaNetwork {
    return this.network;
  }

  /**
   * Get SOL balance for an address.
   */
  async getBalance(address: string | PublicKey): Promise<number> {
    const pubkey = typeof address === "string" ? new PublicKey(address) : address;
    const balance = await this.connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Get SOL balance in lamports.
   */
  async getBalanceLamports(address: string | PublicKey): Promise<number> {
    const pubkey = typeof address === "string" ? new PublicKey(address) : address;
    return await this.connection.getBalance(pubkey);
  }

  /**
   * Transfer SOL from one account to another.
   */
  async transferSol(
    from: Keypair,
    to: string | PublicKey,
    amountSol: number,
  ): Promise<string> {
    const toPubkey = typeof to === "string" ? new PublicKey(to) : to;
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey,
        lamports,
      }),
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [from],
    );

    return signature;
  }

  /**
   * Get recent blockhash for transaction building.
   */
  async getRecentBlockhash() {
    return await this.connection.getLatestBlockhash();
  }

  /**
   * Send and confirm a transaction.
   */
  async sendTransaction(
    transaction: Transaction,
    signers: Keypair[],
  ): Promise<string> {
    return await sendAndConfirmTransaction(
      this.connection,
      transaction,
      signers,
    );
  }

  /**
   * Get account info.
   */
  async getAccountInfo(address: string | PublicKey) {
    const pubkey = typeof address === "string" ? new PublicKey(address) : address;
    return await this.connection.getAccountInfo(pubkey);
  }

  /**
   * Request airdrop (devnet/testnet only).
   */
  async requestAirdrop(
    address: string | PublicKey,
    amountSol: number = 1,
  ): Promise<string> {
    if (this.network === "mainnet-beta") {
      throw new Error("Airdrop not available on mainnet");
    }

    const pubkey = typeof address === "string" ? new PublicKey(address) : address;
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
    
    const signature = await this.connection.requestAirdrop(pubkey, lamports);
    await this.connection.confirmTransaction(signature);
    
    return signature;
  }

  /**
   * Get minimum rent exemption for account size.
   */
  async getMinimumRentExemption(dataSize: number): Promise<number> {
    return await this.connection.getMinimumBalanceForRentExemption(dataSize);
  }
}

/**
 * Create a Solana client with default settings.
 */
export function createSolanaClient(
  network: SolanaNetwork = "mainnet-beta",
  rpcUrl?: string,
): SolanaClient {
  return new SolanaClient({ network, rpcUrl });
}
