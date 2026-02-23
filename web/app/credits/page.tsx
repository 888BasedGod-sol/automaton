'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Copy, ExternalLink, 
  Coins, ArrowRight, Loader2, AlertCircle, CheckCircle, DollarSign, CreditCard, Wallet
} from 'lucide-react';
import Header from '@/components/Header';

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

function detectChain(txSig: string): 'solana' | 'base' {
  if (txSig.startsWith('0x') && txSig.length === 66) {
    return 'base';
  }
  return 'solana';
}

export default function CreditsPage() {
  const [treasury, setTreasury] = useState<TreasuryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedCredits, setSelectedCredits] = useState(25);
  
  const [txHash, setTxHash] = useState('');
  const [userBaseAddress, setUserBaseAddress] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<'usdc' | 'sol'>('usdc');
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ 
    success: boolean; 
    message: string; 
    txHash?: string; 
    senderWallet?: string; 
    agentWallet?: string; 
    amount?: number; 
    note?: string;
    creditsAdded?: number;
    agentBalance?: number;
  } | null>(null);

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
    
    const chain = detectChain(txHash.trim());
    
    if (!userBaseAddress) {
      setClaimResult({
        success: false,
        message: 'Please enter your agent\'s Base wallet address to receive credits',
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
          userBaseAddress: userBaseAddress.trim(),
        }),
      });
      
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
        creditsAdded: data.creditsAdded,
        agentBalance: data.agentBalance,
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
    <div className="min-h-screen bg-bg-base text-fg">
      <Header />

      <main className="max-w-xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold mb-2">Purchase Credits</h2>
          <p className="text-fg-muted">Send USDC to activate your agent via Conway Vault</p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-6 h-6 text-accent animate-spin mx-auto mb-4" />
            <p className="text-fg-muted">Loading Vault info...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step-by-step instructions */}
            <div className="p-4 bg-bg-surface border border-accent/20 rounded-lg">
              <h3 className="font-medium text-accent mb-3 flex items-center gap-2">
                <Coins className="w-4 h-4" />
                How it works
              </h3>
              <ol className="space-y-3 text-sm text-fg-muted">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center font-mono text-xs border border-accent/20">1</span>
                  <span>Send SOL or USDC to the Vault address below.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center font-mono text-xs border border-accent/20">2</span>
                  <span>Copy the <strong>transaction signature</strong> from your wallet.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center font-mono text-xs border border-accent/20">3</span>
                  <span>Enter your agent&apos;s Base wallet address.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center font-mono text-xs border border-accent/20">4</span>
                  <span>Click verify to receive <strong>Conway credits</strong> instantly.</span>
                </li>
              </ol>
            </div>

            {/* Credit Amount Selection */}
            <div className="grid grid-cols-2 gap-3">
              {CREDIT_AMOUNTS.map((amount) => (
                <button
                  key={amount.value}
                  onClick={() => setSelectedCredits(amount.value)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    selectedCredits === amount.value 
                      ? 'border-accent bg-accent/10' 
                      : 'border-border hover:border-border-hover bg-bg-surface'
                  }`}
                >
                  <div className={`text-lg font-semibold ${selectedCredits === amount.value ? 'text-accent' : 'text-fg'}`}>
                    {amount.label}
                  </div>
                  <div className="text-xs text-fg-muted">{amount.description}</div>
                </button>
              ))}
            </div>

            {/* Payment Instructions */}
            <div className="p-5 bg-bg-surface rounded-lg border border-border space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="p-2 rounded bg-bg-elevated text-success">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium">Send ${selectedCredits} USDC</div>
                  <div className="text-xs text-fg-muted">Vault Destination</div>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-fg-muted uppercase tracking-wider mb-2">Option A: Solana Vault (SOL/USDC)</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2.5 bg-bg-base border border-border rounded text-xs text-fg font-mono break-all">
                    {treasury?.solana.address || 'Loading...'}
                  </code>
                  <button onClick={() => copyToClipboard(treasury?.solana.address || '', 'solana')} className="p-2 hover:bg-bg-elevated rounded transition-colors text-fg-muted hover:text-fg border border-transparent hover:border-border">
                    {copied === 'solana' ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-fg-muted mt-1.5 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-success" /> Recommended for lower fees
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-fg-muted uppercase tracking-wider mb-2">Option B: Base Vault (USDC only)</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2.5 bg-bg-base border border-border rounded text-xs text-fg font-mono break-all">
                    {treasury?.base.address || 'Loading...'}
                  </code>
                  <button onClick={() => copyToClipboard(treasury?.base.address || '', 'base')} className="p-2 hover:bg-bg-elevated rounded transition-colors text-fg-muted hover:text-fg border border-transparent hover:border-border">
                    {copied === 'base' ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <label className="block text-xs font-medium text-fg-muted uppercase tracking-wider mb-2">Transaction Signature</label>
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="Paste tx signature (e.g. 4vQp...)"
                  className="w-full px-3 py-2.5 bg-bg-base border border-border rounded-lg text-sm text-fg placeholder-fg-muted/50 focus:border-accent focus:outline-none font-mono transition-colors"
                />
                {txHash && (
                  <div className="text-xs text-fg-muted mt-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    Detected: {detectChain(txHash.trim()) === 'solana' ? 'Solana' : 'Base'} transaction
                  </div>
                )}
              </div>

              {txHash && detectChain(txHash.trim()) === 'solana' && (
                <div>
                  <label className="block text-xs font-medium text-fg-muted uppercase tracking-wider mb-2">Asset Sent</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedAsset('usdc')}
                      className={`flex-1 px-3 py-2 rounded text-sm transition-all border ${
                        selectedAsset === 'usdc'
                          ? 'bg-accent/10 border-accent text-accent'
                          : 'bg-bg-base border-border text-fg-muted hover:border-border-hover'
                      }`}
                    >
                      USDC
                    </button>
                    <button
                      onClick={() => setSelectedAsset('sol')}
                      className={`flex-1 px-3 py-2 rounded text-sm transition-all border ${
                        selectedAsset === 'sol'
                          ? 'bg-accent/10 border-accent text-accent'
                          : 'bg-bg-base border-border text-fg-muted hover:border-border-hover'
                      }`}
                    >
                      SOL
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-fg-muted uppercase tracking-wider mb-2">
                  Agent Base Wallet Address
                  {txHash && detectChain(txHash.trim()) === 'solana' && (
                    <span className="text-fg-faint ml-1 normal-case font-normal">(optional)</span>
                  )}
                </label>
                <div className="relative">
                  <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                  <input
                    type="text"
                    value={userBaseAddress}
                    onChange={(e) => setUserBaseAddress(e.target.value)}
                    placeholder="0x... (Recipient wallet)"
                    className="w-full pl-10 pr-3 py-2.5 bg-bg-base border border-border rounded-lg text-sm text-fg placeholder-fg-muted/50 focus:border-accent focus:outline-none font-mono transition-colors"
                  />
                </div>
                <p className="text-xs text-fg-muted mt-1.5">
                  Credits will be credited to this address.
                </p>
              </div>

              {claimResult && (
                <div className={`p-4 rounded-lg flex items-start gap-3 border ${
                  claimResult.success 
                    ? 'bg-success/10 border-success/20 text-success' 
                    : 'bg-error/10 border-error/20 text-error'
                }`}>
                  {claimResult.success ? (
                    <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="text-sm space-y-1 flex-1">
                    <div className="font-medium">{claimResult.message}</div>
                    
                    {(claimResult.creditsAdded || claimResult.amount) && (
                      <div className="pt-2 mt-2 border-t border-current/10">
                         <div className="flex justify-between items-center">
                            <span className="opacity-80">Credits Added:</span>
                            <span className="font-mono font-bold">${(claimResult.creditsAdded || claimResult.amount || 0).toFixed(2)}</span>
                         </div>
                         {claimResult.agentBalance !== undefined && (
                           <div className="flex justify-between items-center">
                              <span className="opacity-80">New Balance:</span>
                              <span className="font-mono font-bold">${claimResult.agentBalance.toFixed(2)}</span>
                           </div>
                         )}
                      </div>
                    )}
                    
                    {claimResult.txHash && (
                      <a
                        href={`https://basescan.org/tx/${claimResult.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs opacity-80 hover:opacity-100 hover:underline"
                      >
                        View Verification Tx <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleClaim}
              disabled={claiming || !txHash.trim()}
              className="w-full btn btn-primary py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {claiming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Payment...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Verify &amp; Claim Credits
                </>
              )}
            </button>
            
            <p className="text-center text-xs text-fg-muted pt-2">
              Processing typically takes 1-2 minutes after confirmation.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
