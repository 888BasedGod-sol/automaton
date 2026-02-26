import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import bs58 from 'bs58';

export interface GeneratedWallets {
  evm: {
    address: string;
    privateKey: string;
  };
  solana: {
    address: string;
    privateKey: string;
  };
}

/**
 * Generate new EVM and Solana wallets for an agent
 */
export function generateWallets(): GeneratedWallets {
  // Generate EVM wallet
  const evmWallet = ethers.Wallet.createRandom();
  
  // Generate Solana wallet
  const solanaKeypair = Keypair.generate();
  
  return {
    evm: {
      address: evmWallet.address,
      privateKey: evmWallet.privateKey,
    },
    solana: {
      address: solanaKeypair.publicKey.toBase58(),
      privateKey: bs58.encode(solanaKeypair.secretKey),
    },
  };
}

/**
 * Restore Solana keypair from private key
 */
export function restoreSolanaKeypair(privateKey: string): Keypair {
  // Trim whitespace/newlines that might be in decrypted keys
  const cleanKey = privateKey.trim();
  const secretKey = bs58.decode(cleanKey);
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Restore EVM wallet from private key
 */
export function restoreEvmWallet(privateKey: string, provider?: ethers.Provider): ethers.Wallet {
  return new ethers.Wallet(privateKey, provider);
}
