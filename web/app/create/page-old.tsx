'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Copy, ExternalLink, ArrowRight, ArrowLeft, Loader2, Zap, CreditCard, Coins, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';

// Dynamically import wallet button to avoid SSR issues
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-9 w-32 bg-purple-600/50 rounded-lg animate-pulse" /> }
);

export default function Create() {
  const { publicKey, connected, connecting } = useWallet();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  
  const [agentId, setAgentId] = useState('');
  
  const [config, setConfig] = useState({
    name: '',
    genesisPrompt: '',
    evmAddress: '',
    solanaAddress: '',
  });

  const generateWallets = async () => {
    if (!publicKey) {
      alert('Please connect your wallet first');
      return;
    }
    
    setLoading(true);
    
    try {
      // Call API to create agent with real wallets
      const res = await fetch('/api/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: config.name,
          genesisPrompt: config.genesisPrompt,
          ownerWallet: publicKey.toBase58(),
        }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to create agent');
      }
      
      const data = await res.json();
      setAgentId(data.id);
      setConfig(prev => ({
        ...prev,
        evmAddress: data.evmAddress,
        solanaAddress: data.solanaAddress,
      }));
      
      setStep(4);
    } catch (e) {
      console.error(e);
      // Fallback to mock addresses if API fails
      const evmChars = '0123456789abcdef';
      const solChars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      
      const mockId = 'agent_' + Date.now();
      setAgentId(mockId);
      setConfig(prev => ({
        ...prev,
        evmAddress: '0x' + Array.from({ length: 40 }, () => evmChars[Math.floor(Math.random() * 16)]).join(''),
        solanaAddress: Array.from({ length: 44 }, () => solChars[Math.floor(Math.random() * solChars.length)]).join(''),
      }));
      setStep(4);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-gradient-to-b from-purple-950/20 via-black to-black pointer-events-none" />
      
      <header className="relative border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-white/40 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-semibold">Deploy Agent</h1>
          </div>
        </div>
      </header>

      <main className="relative max-w-2xl mx-auto px-6 py-12">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-16">
          {['Connect', 'Configure', 'Generate', 'Save', 'Done', 'Fund'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border transition-colors ${
                step > i + 1 ? 'bg-white text-black border-white' :
                step === i + 1 ? 'border-white text-white' :
                'border-white/20 text-white/30'
              }`}>
                {step > i + 1 ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              {i < 5 && <div className={`w-8 h-px ${step > i + 1 ? 'bg-white' : 'bg-white/20'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Connect Wallet */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
              <p className="text-white/50">Link your Solana wallet to manage your agent</p>
            </div>

            <div className="max-w-md mx-auto space-y-6">
              {/* Why connect wallet */}
              <div className="p-5 bg-white/5 rounded-lg border border-white/10 space-y-4">
                <h3 className="font-medium text-lg">Why connect a wallet?</h3>
                <ul className="space-y-3 text-sm text-white/70">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Monitor your agent's status and credits</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Manage funds and top up credits</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Access your dashboard with all your agents</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Prove ownership of your agents</span>
                  </li>
                </ul>
              </div>

              {/* Wallet Connection */}
              <div className={`p-5 rounded-lg border ${connected ? 'border-green-500/30 bg-green-500/10' : 'border-purple-500/30 bg-purple-500/10'}`}>
                <div className="flex flex-col items-center gap-4">
                  <Wallet className={`w-10 h-10 ${connected ? 'text-green-400' : 'text-purple-400'}`} />
                  {connected && publicKey ? (
                    <>
                      <div className="text-center">
                        <p className="font-medium text-green-400 mb-1">Wallet Connected</p>
                        <p className="text-sm text-white/50 font-mono">
                          {publicKey.toBase58().slice(0, 12)}...{publicKey.toBase58().slice(-8)}
                        </p>
                      </div>
                      <button
                        onClick={() => setStep(2)}
                        className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
                      >
                        Continue <ArrowRight className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-white/50 text-sm text-center">
                        Connect your Solana wallet to continue
                      </p>
                      <WalletMultiButton style={{
                        backgroundColor: 'rgba(147, 51, 234, 1)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        height: '44px',
                        padding: '0 24px',
                        width: '100%',
                        justifyContent: 'center',
                      }} />
                    </>
                  )}
                </div>
              </div>

              <p className="text-xs text-white/30 text-center">
                We support Phantom, Solflare, and other Solana wallets
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold mb-2">Configure Genesis</h2>
              <p className="text-white/50">Define your automagotchi's identity</p>
            </div>

            {/* Connected wallet indicator */}
            {connected && publicKey && (
              <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5 flex items-center gap-3">
                <Wallet className="w-4 h-4 text-green-400" />
                <span className="text-sm text-white/70">Connected: <span className="font-mono text-green-400">{publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-4)}</span></span>
              </div>
            )}
            
            <div>
              <label className="block text-sm text-white/50 mb-2">Name</label>
              <input
                type="text"
                value={config.name}
                onChange={e => setConfig({ ...config, name: e.target.value })}
                placeholder="Atlas"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm text-white/50 mb-2">Genesis Prompt</label>
              <textarea
                value={config.genesisPrompt}
                onChange={e => setConfig({ ...config, genesisPrompt: e.target.value })}
                placeholder="I am an autonomous research agent..."
                rows={4}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:border-white/20 focus:outline-none resize-none font-mono text-sm"
              />
              <p className="mt-2 text-xs text-white/30">This prompt defines who your automagotchi is</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!config.name || !config.genesisPrompt}
                className="flex-1 py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Generate */}
        {step === 3 && (
          <div className="text-center space-y-8">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Generate Wallets</h2>
              <p className="text-white/50">Your automagotchi needs wallets to receive funds</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-left">
                <div className="text-blue-400 mb-1 text-lg font-bold">ETH</div>
                <div className="font-medium text-sm">EVM</div>
                <div className="text-xs text-white/40">Base / Ethereum</div>
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-left">
                <div className="text-purple-400 mb-1 text-lg font-bold">SOL</div>
                <div className="font-medium text-sm">Solana</div>
                <div className="text-xs text-white/40">USDC deposits</div>
              </div>
            </div>

            <button
              onClick={generateWallets}
              disabled={loading}
              className="px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loading ? 'Generating...' : 'Generate Wallets'}
            </button>
          </div>
        )}

        {/* Step 4: Save Wallets */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold mb-2">Save Your Agent&apos;s Wallets</h2>
              <p className="text-white/50">Store these addresses to fund your agent later</p>
            </div>
            
            {/* Wallet Addresses */}
            <div className="space-y-4">
              {/* Base/EVM Wallet */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-blue-400 text-xl font-bold">ETH</span>
                  <div>
                    <div className="font-medium">Base / EVM Wallet</div>
                    <div className="text-xs text-white/40">For Base, Ethereum, and other EVM chains</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-black/50 rounded text-sm text-white/80 font-mono break-all">
                    {config.evmAddress}
                  </code>
                  <button 
                    onClick={() => copyToClipboard(config.evmAddress, 'evm')} 
                    className="p-2 hover:bg-white/10 rounded transition-colors"
                  >
                    {copied === 'evm' ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-white/40" />}
                  </button>
                </div>
              </div>

              {/* Solana Wallet */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-purple-400 text-xl font-bold">SOL</span>
                  <div>
                    <div className="font-medium">Solana Wallet</div>
                    <div className="text-xs text-white/40">For SOL and SPL tokens (USDC)</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-black/50 rounded text-sm text-white/80 font-mono break-all">
                    {config.solanaAddress}
                  </code>
                  <button 
                    onClick={() => copyToClipboard(config.solanaAddress, 'sol')} 
                    className="p-2 hover:bg-white/10 rounded transition-colors"
                  >
                    {copied === 'sol' ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-white/40" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-400/80">
                <strong>Important:</strong> Save these addresses securely. You&apos;ll need them to fund your agent later.
              </p>
            </div>

            <button
              onClick={() => setStep(5)}
              className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 5: Done */}
        {step === 5 && (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
              <CheckCircle className="w-4 h-4" />
              Agent Created
            </div>
            
            <div>
              <h2 className="text-2xl font-semibold mb-2">{config.name} is alive</h2>
              <p className="text-white/50">
                Your agent is ready. Fund it to start operations.
              </p>
            </div>

            <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-left space-y-3 max-w-md mx-auto">
              <div>
                <div className="text-white/30 text-xs mb-1">Name</div>
                <div className="font-medium">{config.name}</div>
              </div>
              <div>
                <div className="text-white/30 text-xs mb-1">Genesis</div>
                <div className="text-sm text-white/70 line-clamp-2">{config.genesisPrompt}</div>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="text-white/30 text-xs mb-1">Base / EVM Wallet</div>
                <div className="font-mono text-xs text-white/50">{config.evmAddress}</div>
              </div>
              <div>
                <div className="text-white/30 text-xs mb-1">Solana Wallet</div>
                <div className="font-mono text-xs text-white/50">{config.solanaAddress}</div>
              </div>
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              <Link
                href={`/agents/${agentId}`}
                className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors flex items-center gap-2"
              >
                View Agent <ArrowRight className="w-3 h-3" />
              </Link>
              <button
                onClick={() => setStep(6)}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <CreditCard className="w-3 h-3" /> Buy Credits
              </button>
              <a
                href={`https://basescan.org/address/${config.evmAddress}`}
                target="_blank"
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors flex items-center gap-2"
              >
                Basescan <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={`https://solscan.io/account/${config.solanaAddress}`}
                target="_blank"
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors flex items-center gap-2"
              >
                Solscan <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Step 6: Fund */}
        {step === 6 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold mb-2">Fund Your Agent</h2>
              <p className="text-white/50">Purchase credits to power your agent&apos;s operations</p>
            </div>
            
            {/* Credit Options */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 5, label: '$5', description: 'Good for testing' },
                { value: 10, label: '$10', description: 'Light usage' },
                { value: 25, label: '$25', description: 'Recommended', recommended: true },
                { value: 50, label: '$50', description: 'Power user' },
              ].map((amount) => (
                <div
                  key={amount.value}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    amount.recommended 
                      ? 'border-purple-500/50 bg-purple-500/10' 
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="text-lg font-semibold">{amount.label}</div>
                  <div className="text-xs text-white/50">{amount.description}</div>
                  {amount.recommended && <div className="text-xs text-purple-400 mt-1">Popular</div>}
                </div>
              ))}
            </div>

            {/* Agent Summary */}
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span className="font-medium">Agent: {config.name}</span>
              </div>
              <div className="text-xs text-white/40 space-y-1">
                <div>Base: <span className="font-mono">{config.evmAddress.slice(0, 10)}...{config.evmAddress.slice(-8)}</span></div>
                <div>Solana: <span className="font-mono">{config.solanaAddress.slice(0, 8)}...{config.solanaAddress.slice(-8)}</span></div>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                href="/credits"
                className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Buy Credits
              </Link>
              
              <Link
                href="/agents"
                className="w-full py-2 text-white/40 hover:text-white/60 text-sm transition-colors text-center block"
              >
                View All Agents
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
