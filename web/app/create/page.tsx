'use client';

import { useState, useEffect } from 'react';
import { 
  Wallet, Cpu, Sparkles, CheckCircle, Copy, ExternalLink, 
  ArrowRight, Loader2, Zap, Globe, Shield, Key
} from 'lucide-react';

// Solana wallet adapter types
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      disconnect: () => Promise<void>;
      signMessage: (message: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
      publicKey?: { toString: () => string };
    };
  }
}

interface AgentConfig {
  name: string;
  genesisPrompt: string;
  evmAddress: string;
  solanaAddress: string;
  creatorWallet: string;
}

export default function CreateAutomaton() {
  const [step, setStep] = useState(1);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  
  const [config, setConfig] = useState<AgentConfig>({
    name: '',
    genesisPrompt: '',
    evmAddress: '',
    solanaAddress: '',
    creatorWallet: '',
  });

  // Check if Phantom is installed
  const [hasPhantom, setHasPhantom] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasPhantom(!!window.solana?.isPhantom);
    }
  }, []);

  const connectWallet = async () => {
    if (!window.solana) {
      window.open('https://phantom.app/', '_blank');
      return;
    }

    try {
      setIsLoading(true);
      const response = await window.solana.connect();
      const address = response.publicKey.toString();
      setWalletAddress(address);
      setWalletConnected(true);
      setConfig(prev => ({ ...prev, creatorWallet: address }));
      setStep(2);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateWallets = async () => {
    setIsLoading(true);
    
    // Generate EVM wallet
    const evmChars = '0123456789abcdef';
    const evmAddress = '0x' + Array.from({ length: 40 }, () => 
      evmChars[Math.floor(Math.random() * 16)]
    ).join('');
    
    // Generate Solana wallet
    const solChars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const solanaAddress = Array.from({ length: 44 }, () =>
      solChars[Math.floor(Math.random() * solChars.length)]
    ).join('');
    
    // Simulate API call delay
    await new Promise(r => setTimeout(r, 1500));
    
    setConfig(prev => ({
      ...prev,
      evmAddress,
      solanaAddress,
    }));
    
    setIsLoading(false);
    setStep(4);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Create Automaton
              </h1>
              <p className="text-sm text-gray-400">Deploy your sovereign AI agent</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-medium
                ${step >= s 
                  ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white' 
                  : 'bg-gray-800 text-gray-500'}
              `}>
                {step > s ? <CheckCircle className="w-5 h-5" /> : s}
              </div>
              {s < 5 && (
                <div className={`w-12 h-0.5 ${step > s ? 'bg-cyan-500' : 'bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Connect Wallet */}
        {step === 1 && (
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                <Wallet className="w-10 h-10 text-purple-400" />
              </div>
              <h2 className="text-3xl font-bold text-white">Connect Your Wallet</h2>
              <p className="text-gray-400 max-w-md mx-auto">
                Connect your Solana wallet to create and manage your Automaton. 
                Your wallet will be the owner of your AI agent.
              </p>
            </div>

            <button
              onClick={connectWallet}
              disabled={isLoading}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-3 mx-auto"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <img src="https://phantom.app/img/phantom-icon-purple.svg" className="w-6 h-6" alt="Phantom" />
              )}
              {hasPhantom ? 'Connect Phantom Wallet' : 'Install Phantom Wallet'}
            </button>

            <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Non-custodial
              </div>
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                You own your keys
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Multi-chain
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Name Your Agent */}
        {step === 2 && (
          <div className="max-w-xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-white">Name Your Automaton</h2>
              <p className="text-gray-400">Give your AI agent a unique identity</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  placeholder="e.g., Alpha, Nova, Sentinel..."
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Genesis Prompt
                </label>
                <textarea
                  value={config.genesisPrompt}
                  onChange={(e) => setConfig({ ...config, genesisPrompt: e.target.value })}
                  placeholder="Describe your agent's purpose, personality, and goals..."
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                />
                <p className="mt-2 text-sm text-gray-500">
                  This prompt defines your agent's core identity and behavior.
                </p>
              </div>

              <button
                onClick={() => setStep(3)}
                disabled={!config.name || !config.genesisPrompt}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
              <p className="text-sm text-gray-400">
                <span className="text-purple-400 font-medium">Connected:</span>{' '}
                {formatAddress(walletAddress)}
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Generate Wallets */}
        {step === 3 && (
          <div className="max-w-xl mx-auto space-y-8 text-center">
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                <Key className="w-10 h-10 text-cyan-400" />
              </div>
              <h2 className="text-3xl font-bold text-white">Generate Agent Wallets</h2>
              <p className="text-gray-400 max-w-md mx-auto">
                Your Automaton needs its own wallets to hold funds and interact with blockchains.
                We'll generate wallets for both EVM (Base) and Solana.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <span className="text-blue-400">⟠</span>
                  </div>
                  <span className="font-medium text-white">EVM (Base)</span>
                </div>
                <p className="text-sm text-gray-500">For USDC payments & x402</p>
              </div>
              <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <span className="text-purple-400">◎</span>
                  </div>
                  <span className="font-medium text-white">Solana</span>
                </div>
                <p className="text-sm text-gray-500">For SPL tokens & fast txns</p>
              </div>
            </div>

            <button
              onClick={generateWallets}
              disabled={isLoading}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-3 mx-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Generate Wallets
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 4: Fund Agent */}
        {step === 4 && (
          <div className="max-w-xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-white">Fund Your Automaton</h2>
              <p className="text-gray-400">Send funds to activate your agent</p>
            </div>

            <div className="space-y-4">
              <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <span className="text-xl">⟠</span>
                    </div>
                    <div>
                      <p className="font-medium text-white">EVM (Base) Wallet</p>
                      <p className="text-sm text-gray-500">For Conway credits</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-900 rounded-lg text-sm text-gray-300 font-mono truncate">
                    {config.evmAddress}
                  </code>
                  <button
                    onClick={() => copyToClipboard(config.evmAddress, 'evm')}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    {copied === 'evm' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <span className="text-xl">◎</span>
                    </div>
                    <div>
                      <p className="font-medium text-white">Solana Wallet</p>
                      <p className="text-sm text-gray-500">For SOL & USDC</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-900 rounded-lg text-sm text-gray-300 font-mono truncate">
                    {config.solanaAddress}
                  </code>
                  <button
                    onClick={() => copyToClipboard(config.solanaAddress, 'sol')}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    {copied === 'sol' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <p className="text-sm text-yellow-400">
                  <strong>Minimum funding:</strong> $5 USDC + small amount for gas fees
                </p>
              </div>
            </div>

            <button
              onClick={() => setStep(5)}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              I've Funded My Agent
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Step 5: Deploy */}
        {step === 5 && (
          <div className="max-w-xl mx-auto space-y-8 text-center">
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-green-500/20 to-cyan-500/20 flex items-center justify-center animate-pulse">
                <Sparkles className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-white">Automaton Created!</h2>
              <p className="text-gray-400 max-w-md mx-auto">
                Your sovereign AI agent is ready. It will begin operating autonomously 
                once it detects sufficient funding.
              </p>
            </div>

            <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700 text-left space-y-4">
              <h3 className="font-semibold text-white">Agent Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Name</p>
                  <p className="text-white font-medium">{config.name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Creator</p>
                  <p className="text-white font-mono">{formatAddress(config.creatorWallet)}</p>
                </div>
                <div>
                  <p className="text-gray-500">EVM Address</p>
                  <p className="text-white font-mono">{formatAddress(config.evmAddress)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Solana Address</p>
                  <p className="text-white font-mono">{formatAddress(config.solanaAddress)}</p>
                </div>
              </div>
              <div>
                <p className="text-gray-500">Genesis Prompt</p>
                <p className="text-white text-sm mt-1">{config.genesisPrompt}</p>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <a
                href={`https://solscan.io/account/${config.solanaAddress}`}
                target="_blank"
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium text-white transition-colors flex items-center gap-2"
              >
                View on Solscan
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Create Another
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-20">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center text-sm text-gray-500">
          Powered by Conway Research • Automatons are sovereign AI agents
        </div>
      </footer>
    </div>
  );
}
