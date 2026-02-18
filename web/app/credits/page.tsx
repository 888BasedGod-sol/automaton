'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Copy, ExternalLink, 
  Coins, ArrowRight, Loader2, AlertCircle, CheckCircle, DollarSign, CreditCard
} from 'lucide-react';

interface TreasuryInfo {
  solana: { address: string; network: string };
  base: { address: string; usdcContract: string };
}

const CREDIT_AMOUNTS = [
  { value: 5, label: '$5', description: 'Good for testing' },
  { value: 10, label: '$10', description: 'Light usage' },
  { value: 25, label: '$25', description: 'Recommended' },
  { value: 50, label: '$50', description: 'Power user' },
];

// Detect chain from transaction signature format
function detectChain(txSig: string): 'solana' | 'base' {
  // Base/Ethereum tx hashes start with 0x and are 66 chars
  if (txSig.startsWith('0x') && txSig.length === 66) {
    return 'base';
  }
  // Solana signatures are base58, typically 87-88 chars
  return 'solana';
}

export default function CreditsPage() {
  const [treasury, setTreasury] = useState<TreasuryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedCredits, setSelectedCredits] = useState(25);
  
  // Claim form state
  const [txHash, setTxHash] = useState('');
  const [userBaseAddress, setUserBaseAddress] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<'usdc' | 'sol'>('usdc');
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ success: boolean; message: string; txHash?: string; senderWallet?: string; agentWallet?: string; amount?: number; note?: string } | null>(null);

  useEffect(() => {
    fetchTreasury();
  }, []);

  const fetchTreasury = async () => {
    try {
      const res = await fetch('/api/credits');
      const data = await res.json();
      setTreasury(data.treasury);
    } catch (e) {
      console.error('Failed to fetch treasury:', e);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleClaim = async () => {
    if (!txHash) return;
    
    // Detect chain from tx signature format
    const chain = detectChain(txHash.trim());
    
    // For Base, require user address. For Solana, it's optional (we detect sender from tx)
    if (chain === 'base' && !userBaseAddress) {
      setClaimResult({
        success: false,
        message: 'Please enter your Base wallet address for Base transactions',
      });
      return;
    }
    
    setClaiming(true);
    setClaimResult(null);
    
    try {
      const res = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim',
          txHash: txHash.trim(),
          chain,
          asset: chain === 'base' ? 'usdc' : selectedAsset,
          userBaseAddress: userBaseAddress || '0x0000000000000000000000000000000000000000',
        }),
      });
      
      // Check if response is OK first
      if (!res.ok) {
        const text = await res.text();
        let errorMsg = 'Verification failed';
        try {
          const data = JSON.parse(text);
          errorMsg = data.error || data.message || errorMsg;
        } catch {
          errorMsg = text || `HTTP ${res.status}`;
        }
        setClaimResult({
          success: false,
          message: errorMsg,
        });
        return;
      }
      
      const data = await res.json();
      setClaimResult({
        success: data.success,
        message: data.message || data.error || 'Unknown result',
        txHash: data.txHash,
        senderWallet: data.senderWallet,
        agentWallet: data.agentWallet,
        amount: data.amount,
        note: data.note,
      });
      
      if (data.success) {
        setTxHash('');
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to claim credits';
      setClaimResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-gradient-to-b from-green-950/20 via-black to-black pointer-events-none" />

      {/* Header */}
      <header className="relative border-b border-white/10 backdrop-blur-sm sticky top-0 z-20 bg-black/90">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight flex items-center gap-1">
            AUTOMATON<span className="text-purple-400">CLOUD</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-white/60 hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="relative max-w-lg mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold mb-2">Purchase Credits</h2>
          <p className="text-white/50">Send USDC to activate your agent</p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-6 h-6 text-white/40 animate-spin mx-auto mb-4" />
            <p className="text-white/40">Loading treasury info...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step-by-step instructions */}
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <h3 className="font-medium text-purple-300 mb-3">How it works</h3>
              <ol className="space-y-2 text-sm text-white/70">
                <li className="flex gap-2">
                  <span className="text-purple-400 font-mono">1.</span>
                  <span>Choose amount and send USDC to treasury address below</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400 font-mono">2.</span>
                  <span>Copy the <strong>transaction signature</strong> from your wallet</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400 font-mono">3.</span>
                  <span>Paste signature below with your agent&apos;s Base wallet</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400 font-mono">4.</span>
                  <span>Click verify - credits will be sent to your agent</span>
                </li>
              </ol>
            </div>

            {/* Credit Amount Selection */}
            <div className="grid grid-cols-2 gap-3">
              {CREDIT_AMOUNTS.map((amount) => (
                <button
                  key={amount.value}
                  onClick={() => setSelectedCredits(amount.value)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedCredits === amount.value 
                      ? 'border-white bg-white/10' 
                      : 'border-white/10 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <div className="text-lg font-semibold">{amount.label}</div>
                  <div className="text-xs text-white/50">{amount.description}</div>
                </button>
              ))}
            </div>

            {/* Payment Instructions */}
            <div className="p-4 bg-white/5 rounded-lg border border-white/10 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                <span className="font-medium">Send ${selectedCredits} USDC</span>
              </div>
              
              <div>
                <label className="block text-xs text-white/40 mb-2">Step 1: Send to Solana Treasury (SOL or USDC)</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-black/50 rounded text-xs text-white/60 font-mono break-all">
                    {treasury?.solana.address || 'Loading...'}
                  </code>
                  <button onClick={() => copyToClipboard(treasury?.solana.address || '', 'solana')} className="p-2 hover:bg-white/5 rounded transition-colors">
                    {copied === 'solana' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/40" />}
                  </button>
                </div>
                <p className="text-xs text-green-400/60 mt-1">Copy this address and send USDC from your wallet</p>
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-2">Or: Base Treasury (USDC only)</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-black/50 rounded text-xs text-white/60 font-mono break-all">
                    {treasury?.base.address || 'Loading...'}
                  </code>
                  <button onClick={() => copyToClipboard(treasury?.base.address || '', 'base')} className="p-2 hover:bg-white/5 rounded transition-colors">
                    {copied === 'base' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/40" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-2">Transaction Signature (from your wallet)</label>
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="e.g. 4vQp7Z...abc (NOT the treasury address)"
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded text-sm text-white placeholder-white/30 focus:border-white/20 focus:outline-none font-mono"
                />
                {txHash && (
                  <div className="text-xs text-white/40 mt-1">
                    Detected: {detectChain(txHash.trim()) === 'solana' ? 'Solana' : 'Base'} transaction
                  </div>
                )}
              </div>

              {txHash && detectChain(txHash.trim()) === 'solana' && (
                <div>
                  <label className="block text-xs text-white/40 mb-2">Asset Sent</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedAsset('usdc')}
                      className={`flex-1 px-3 py-2 rounded text-sm transition-all ${
                        selectedAsset === 'usdc'
                          ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                          : 'bg-white/5 border border-white/10 text-white/60 hover:border-white/20'
                      }`}
                    >
                      USDC
                    </button>
                    <button
                      onClick={() => setSelectedAsset('sol')}
                      className={`flex-1 px-3 py-2 rounded text-sm transition-all ${
                        selectedAsset === 'sol'
                          ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                          : 'bg-white/5 border border-white/10 text-white/60 hover:border-white/20'
                      }`}
                    >
                      SOL
                    </button>
                  </div>
                </div>
              )}

              {/* Agent Base Wallet - always show for sending credits */}
              <div>
                <label className="block text-xs text-white/40 mb-2">
                  Agent Base Wallet Address
                  {txHash && detectChain(txHash.trim()) === 'solana' && (
                    <span className="text-white/30 ml-1">(optional)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={userBaseAddress}
                  onChange={(e) => setUserBaseAddress(e.target.value)}
                  placeholder="0x... (agent's Base wallet for credits)"
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded text-sm text-white placeholder-white/30 focus:border-white/20 focus:outline-none font-mono"
                />
                <p className="text-xs text-white/30 mt-1">
                  Credits will be sent to this agent wallet address on Base
                </p>
              </div>

              {claimResult && (
                <div className={`p-3 rounded flex items-start gap-2 ${
                  claimResult.success 
                    ? 'bg-green-500/20 text-green-300' 
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {claimResult.success ? (
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="text-xs space-y-1">
                    <div>{claimResult.message}</div>
                    {claimResult.senderWallet && (
                      <div className="text-white/50">
                        From: <span className="font-mono">{claimResult.senderWallet.slice(0, 8)}...{claimResult.senderWallet.slice(-6)}</span>
                      </div>
                    )}
                    {claimResult.agentWallet && (
                      <div className="text-white/50">
                        Agent: <span className="font-mono">{claimResult.agentWallet.slice(0, 8)}...{claimResult.agentWallet.slice(-6)}</span>
                      </div>
                    )}
                    {claimResult.amount && (
                      <div className="text-white/50">
                        Amount: ${claimResult.amount.toFixed(2)} USD
                      </div>
                    )}
                    {claimResult.note && (
                      <div className="text-yellow-400/70 mt-1">
                        {claimResult.note}
                      </div>
                    )}
                    {claimResult.txHash && (
                      <a
                        href={`https://basescan.org/tx/${claimResult.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1 mt-1"
                      >
                        View on BaseScan <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleClaim}
                disabled={claiming || !txHash.trim()}
                className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {claiming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Verify &amp; Claim Credits
                  </>
                )}
              </button>
            </div>

            {/* Note */}
            <div className="text-center text-xs text-white/30">
              <p>Credits are sent as USDC on Base to your specified wallet.</p>
              <p className="mt-1">Processing typically takes 1-2 minutes after confirmation.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
