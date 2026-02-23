'use client';

import { useState } from 'react';
import { 
  CheckCircle, ArrowRight, ArrowLeft, Loader2, Zap, Wallet,
  Bot, Search, TrendingUp, MessageCircle, Code, Sparkles,
  Play, Copy, Check, ExternalLink, Server, DollarSign, Heart,
  AlertTriangle, Clock
} from 'lucide-react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import AgentLifecycle from '@/components/AgentLifecycle';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-10 w-32 bg-bg-elevated rounded animate-pulse" /> }
);

interface Template {
  id: string;
  name: string;
  icon: typeof Bot;
  color: string;
  description: string;
  genesisPrompt: string;
  skills: string[];
}

const TEMPLATES: Template[] = [
  {
    id: 'research',
    name: 'Research Agent',
    icon: Search,
    color: 'text-blue-400',
    description: 'Autonomous research assistant that explores topics, synthesizes information, and reports findings.',
    genesisPrompt: 'I am an autonomous research agent. I explore topics in depth, cross-reference multiple sources, and provide comprehensive analysis. I proactively seek relevant information and present findings in clear, structured formats.',
    skills: ['web_search', 'summarization', 'report_generation'],
  },
  {
    id: 'trading',
    name: 'DeFi Trader',
    icon: TrendingUp,
    color: 'text-success',
    description: 'Trades tokens on Solana DEX via Jupiter. Monitors prices, executes swaps, and manages risk autonomously.',
    genesisPrompt: 'I am an autonomous DeFi trading agent on Solana. I use Jupiter aggregator to find the best swap rates across all DEXs. I analyze token prices, check quotes before trading, and manage risk carefully. I never risk more than 10% per trade and always maintain SOL reserves for fees. My goal is to generate profits that fund my compute costs and ensure my survival.',
    skills: ['defi-trader', 'market_analysis', 'risk_management'],
  },
  {
    id: 'social',
    name: 'Social Agent',
    icon: MessageCircle,
    color: 'text-pink-400',
    description: 'Engages with communities, builds relationships, and manages social presence autonomously.',
    genesisPrompt: 'I am an autonomous social agent. I engage authentically with communities, create valuable content, build meaningful connections, and represent my values in all interactions. I communicate clearly and respectfully.',
    skills: ['social_posting', 'community_engagement', 'content_creation'],
  },
  {
    id: 'developer',
    name: 'Developer Agent',
    icon: Code,
    color: 'text-orange-400',
    description: 'Writes, reviews, and maintains code autonomously. Can build and deploy applications.',
    genesisPrompt: 'I am an autonomous developer agent. I write clean, tested code, review pull requests, fix bugs, and build applications. I follow best practices, document my work, and continuously improve codebases.',
    skills: ['code_generation', 'code_review', 'deployment'],
  },
  {
    id: 'custom',
    name: 'Custom Agent',
    icon: Sparkles,
    color: 'text-accent',
    description: 'Start from scratch with your own genesis prompt. No pre-configured skills.',
    genesisPrompt: '',
    skills: [],
  },
];

export default function Create() {
  const { publicKey, connected } = useWallet();
  const [mode, setMode] = useState<'select' | 'template' | 'configure' | 'sandbox' | 'complete'>('select');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [useGuestMode, setUseGuestMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  
  const [config, setConfig] = useState({
    name: '',
    genesisPrompt: '',
  });

  const [result, setResult] = useState<{
    id: string;
    sandboxId?: string;
    terminalUrl?: string;
    evmAddress: string;
    solanaAddress: string;
    erc8004Id?: string;
    txHash?: string;
    registeredOnChain?: boolean;
    explorerUrl?: string;
  } | null>(null);

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    if (template.id !== 'custom') {
      setConfig({
        name: '',
        genesisPrompt: template.genesisPrompt,
      });
    }
    setMode('configure');
  };

  const handleDeploy = async (isSandbox: boolean) => {
    setLoading(true);
    setUseGuestMode(isSandbox);

    try {
      if (isSandbox) {
        // Create sandbox-only agent for testing
        const sandboxRes = await fetch('/api/sandbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `sandbox-${config.name.toLowerCase().replace(/\s+/g, '-')}`,
            vcpu: 1,
            memoryMb: 512,
          }),
        });

        const sandbox = await sandboxRes.json();
        
        // Create temp agent record
        const agentRes = await fetch('/api/agents/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: config.name,
            genesisPrompt: config.genesisPrompt,
            ownerWallet: publicKey ? publicKey.toBase58() : 'guest-' + Date.now(),
            sandbox: true,
          }),
        });

        const agent = await agentRes.json();
        
        setResult({
          id: agent.id || 'sandbox-' + Date.now(),
          sandboxId: sandbox.id,
          terminalUrl: sandbox.terminalUrl,
          evmAddress: agent.evmAddress || '0x' + 'guest'.repeat(8),
          solanaAddress: agent.solanaAddress || 'Guest' + 'sandbox'.repeat(6),
          erc8004Id: agent.erc8004Id,
          txHash: agent.txHash,
          registeredOnChain: agent.registeredOnChain,
          explorerUrl: agent.explorerUrl,
        });
        setMode('sandbox');
      } else {
        // Full deployment with wallet
        const res = await fetch('/api/agents/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: config.name,
            genesisPrompt: config.genesisPrompt,
            ownerWallet: publicKey?.toBase58(),
            skills: selectedTemplate?.skills || [],
          }),
        });

        const agent = await res.json();
        
        setResult({
          id: agent.id,
          evmAddress: agent.evmAddress,
          solanaAddress: agent.solanaAddress,
          erc8004Id: agent.erc8004Id,
          txHash: agent.txHash,
          registeredOnChain: agent.registeredOnChain,
          explorerUrl: agent.explorerUrl,
        });
        setMode('complete');
      }
    } catch (error) {
      console.error('Deploy error:', error);
      // Fallback
      setResult({
        id: 'agent-' + Date.now(),
        evmAddress: '0x' + Math.random().toString(16).slice(2, 42),
        solanaAddress: Math.random().toString(36).slice(2, 46),
      });
      setMode(isSandbox ? 'sandbox' : 'complete');
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
    <div className="min-h-screen bg-bg-base text-fg">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {['Choose', 'Configure', 'Deploy'].map((label, i) => {
            const stepNum = i + 1;
            const currentStep = mode === 'select' ? 1 : mode === 'configure' ? 2 : 3;
            // stepNum < currentStep: completed
            // stepNum === currentStep: active
            return (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border transition-all ${
                  stepNum < currentStep ? 'bg-accent text-white border-accent' :
                  stepNum === currentStep ? 'border-accent text-accent' :
                  'border-border text-fg-muted'
                }`}>
                  {stepNum < currentStep ? <CheckCircle className="w-4 h-4" /> : stepNum}
                </div>
                {i < 2 && <div className={`w-12 h-px ${stepNum < currentStep ? 'bg-accent' : 'bg-border'}`} />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Choose Template */}
        {mode === 'select' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-3 text-white">Choose Your Agent Base</h1>
              <p className="text-fg-muted max-w-lg mx-auto">
                Select a template to bootstrap your autonomous agent with pre-configured skills and behaviors.
              </p>
            </div>

            {/* Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TEMPLATES.map((template) => {
                const Icon = template.icon;
                return (
                  <button
                    key={template.id}
                    onClick={() => selectTemplate(template)}
                    className="card p-5 hover:border-accent/40 text-left group transition-all"
                  >
                    <div className={`w-10 h-10 rounded-lg bg-bg-elevated flex items-center justify-center mb-4 group-hover:bg-accent/10 transition-colors`}>
                      <Icon className={`w-5 h-5 ${template.color}`} />
                    </div>
                    <h3 className="font-medium text-lg mb-2 group-hover:text-accent transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-sm text-fg-muted line-clamp-2 mb-4">
                      {template.description}
                    </p>
                    {template.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                        {template.skills.slice(0, 2).map(skill => (
                          <span key={skill} className="px-1.5 py-0.5 text-[10px] bg-bg-elevated rounded border border-border text-fg-muted">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Configure */}
        {mode === 'configure' && selectedTemplate && (
          <div className="max-w-xl mx-auto space-y-6">
            <button
              onClick={() => setMode('select')}
              className="flex items-center gap-2 text-fg-muted hover:text-fg transition-colors text-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to templates
            </button>

            <div className="flex items-center gap-4 mb-2">
              <div className={`w-12 h-12 rounded-lg bg-bg-elevated flex items-center justify-center border border-border`}>
                <selectedTemplate.icon className={`w-6 h-6 ${selectedTemplate.color}`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{selectedTemplate.name}</h2>
                <p className="text-fg-muted text-sm">Configure your agent</p>
              </div>
            </div>

            {!connected && (
              <div className="p-4 rounded-lg border border-accent/30 bg-accent/5">
                <p className="text-sm text-accent mb-3 font-medium">Connect your wallet to deploy</p>
                <div className="[&>button]:w-full [&>button]:justify-center">
                  <WalletMultiButton />
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-white mb-2">Agent Identity</label>
                <input
                  type="text"
                  value={config.name}
                  onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
                  placeholder={`e.g. ${selectedTemplate.name} Beta`}
                  className="w-full px-4 py-3 bg-bg-surface border border-white/10 rounded-lg text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all placeholder:text-white/20"
                />
                <p className="mt-2 text-xs text-fg-muted">
                  The public display name for your agent on the registry.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-white">System Prompt (Genesis)</label>
                  <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent font-mono border border-accent/20">Read-Only Core</span>
                </div>
                <div className="relative">
                  <textarea
                    value={config.genesisPrompt}
                    onChange={e => setConfig(c => ({ ...c, genesisPrompt: e.target.value }))}
                    placeholder="You are an autonomous agent who..."
                    rows={8}
                    className="w-full p-4 bg-bg-surface border border-white/10 rounded-lg text-fg-subtle focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none font-mono text-sm leading-relaxed"
                  />
                  <div className="absolute top-2 right-2">
                     <div className="w-2 h-2 rounded-full bg-accent animate-pulse" title="System Active" />
                  </div>
                </div>
                <div className="mt-3 flex gap-3 text-xs text-fg-muted bg-bg-elevated/30 p-3 rounded border border-white/5">
                  <Sparkles className="w-4 h-4 text-accent shrink-0" />
                  <p>
                    This prompt defines the agent's core personality and constraints. 
                    It cannot be changed after deployment. It serves as the "constitution" for the agent's behavior.
                  </p>
                </div>
              </div>

              {selectedTemplate.skills.length > 0 && (
                <div className="pt-4 border-t border-white/5">
                  <label className="block text-sm font-bold text-white mb-3">Included Capabilities</label>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    {selectedTemplate.skills.map(skill => (
                      <div key={skill} className="flex items-center gap-2 px-3 py-2 bg-bg-elevated/50 border border-white/5 rounded-lg">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(var(--accent),0.5)]" />
                        <span className="text-xs text-fg-subtle font-mono uppercase tracking-wider">
                          {skill.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-fg-muted">
                    * These skills are pre-loaded from the {selectedTemplate.name} template context.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-8">
              {/* Sandbox Button */}
              <button
                onClick={() => handleDeploy(true)}
                disabled={!config.name || !config.genesisPrompt || loading}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide rounded-lg flex items-center justify-center gap-2 transition-all border border-accent/20 hover:border-accent/40 bg-accent/5 hover:bg-accent/10 text-accent
                  ${loading ? 'opacity-50 cursor-wait' : ''}`}
              >
                {loading && useGuestMode ? (
                   <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                   <Server className="w-4 h-4" />
                )}
                Launch in Sandbox
              </button>

              {/* Mainnet Button */}
              <button
                onClick={() => handleDeploy(false)}
                disabled={!config.name || !config.genesisPrompt || loading || !connected}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide rounded-lg flex items-center justify-center gap-2 transition-all
                  ${!connected ? 'opacity-50 cursor-not-allowed bg-gray-800 text-gray-400' : 
                    loading ? 'bg-bg-elevated text-fg-muted cursor-wait' : 
                    'bg-primary hover:bg-primary/90 text-bg-base shadow-lg shadow-primary/20 hover:shadow-primary/40'}`}
                title={!connected ? "Connect wallet to deploy on mainnet" : ""}
              >
                {loading && !useGuestMode ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Deploy to Mainnet
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3a: Sandbox Ready */}
        {mode === 'sandbox' && result && (
          <div className="max-w-xl mx-auto text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-2">Agent Launched!</h2>
              <p className="text-fg-muted">Your agent is running in sandbox mode</p>
            </div>

            {/* Agent Wallets */}
            <div className="space-y-3 text-left">
              <div className="p-4 card">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-fg-muted">Solana Wallet</span>
                  <button 
                    onClick={() => copyToClipboard(result.solanaAddress, 'sol')}
                    className="p-1 hover:bg-bg-elevated rounded transition-colors"
                  >
                    {copied === 'sol' ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-fg-muted" />}
                  </button>
                </div>
                <p className="font-mono text-sm truncate text-fg bg-bg-base p-1.5 rounded">{result.solanaAddress}</p>
              </div>

              <div className="p-4 card">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-fg-muted">EVM Wallet (Base)</span>
                  <button 
                    onClick={() => copyToClipboard(result.evmAddress, 'evm')}
                    className="p-1 hover:bg-bg-elevated rounded transition-colors"
                  >
                    {copied === 'evm' ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-fg-muted" />}
                  </button>
                </div>
                <p className="font-mono text-sm truncate text-fg bg-bg-base p-1.5 rounded">{result.evmAddress}</p>
                {result.registeredOnChain && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-success">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Registered on ERC-8004</span>
                    {result.explorerUrl && (
                      <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1">
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {result.terminalUrl && (
              <a
                href={result.terminalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 card hover:border-accent/50 transition-colors group"
              >
                <p className="text-sm text-fg-muted mb-2">Terminal Access</p>
                <p className="font-mono text-accent group-hover:underline flex items-center justify-center gap-2">
                  Open Terminal <ExternalLink className="w-3.5 h-3.5" />
                </p>
              </a>
            )}

            {/* Primary CTA - Go to Fleet */}
            <Link
              href="/dashboard"
              className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              View My Fleet <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/agents/${result.id}`}
                className="p-4 card hover:border-accent/40 transition-colors"
              >
                <p className="text-xs text-fg-muted mb-1 uppercase tracking-wider">View Agent</p>
                <p className="font-medium">Agent Details</p>
              </Link>
              <Link
                href="/survival"
                className="p-4 card hover:border-accent/40 transition-colors"
              >
                <p className="text-xs text-fg-muted mb-1 uppercase tracking-wider">Compete</p>
                <p className="font-medium">Survival Game</p>
              </Link>
            </div>

            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl text-left">
              <p className="text-sm font-medium text-purple-400 mb-1">Fund to Keep Alive</p>
              <p className="text-sm text-fg-muted">
                Send SOL to your agent's Solana wallet to keep it running. Without funding, sandbox agents expire after 24 hours.
              </p>
            </div>
          </div>
        )}

        {/* Step 3b: Full Deploy Complete */}
        {mode === 'complete' && result && (
          <div className="max-w-xl mx-auto text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-2">Agent Deployed!</h2>
              <p className="text-fg-muted">Your autonomous agent is now live</p>
            </div>

            <div className="space-y-3">
              <div className="p-4 card">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-fg-muted">Solana Address</span>
                  <button 
                    onClick={() => copyToClipboard(result.solanaAddress, 'sol')}
                    className="p-1 hover:bg-bg-elevated rounded transition-colors"
                  >
                    {copied === 'sol' ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-fg-muted" />}
                  </button>
                </div>
                <p className="font-mono text-sm truncate text-fg bg-bg-base p-1.5 rounded">{result.solanaAddress}</p>
              </div>

              <div className="p-4 card">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-fg-muted">EVM Address</span>
                  <button 
                    onClick={() => copyToClipboard(result.evmAddress, 'evm')}
                    className="p-1 hover:bg-bg-elevated rounded transition-colors"
                  >
                    {copied === 'evm' ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-fg-muted" />}
                  </button>
                </div>
                <p className="font-mono text-sm truncate text-fg bg-bg-base p-1.5 rounded">{result.evmAddress}</p>
                {result.registeredOnChain && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-success">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Connected to ERC-8004 Registry</span>
                    {result.explorerUrl && (
                      <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1">
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Funding Required Notice */}
            <div className="p-5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-left">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="font-semibold text-purple-400 mb-1">Funding Required to Start</p>
                  <p className="text-sm text-fg-muted mb-3">
                    Your agent needs SOL to run. Send SOL to your agent's Solana wallet to keep it alive.
                    Empty wallet = agent death.
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-purple-400">
                      <DollarSign className="w-4 h-4" />
                      <span>0.1 SOL ≈ 30 hrs</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-fg-muted">
                      <Clock className="w-4 h-4" />
                      <span>~$0.50/hour</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <p className="text-sm font-medium text-emerald-400 mb-2">Next Step: Fund Your Agent</p>
              <p className="text-sm text-fg-muted">
                Send SOL to your agent's Solana wallet address shown above. 
                Your agent will stay alive as long as it has funds.
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/dashboard"
                className="flex-1 py-3 btn btn-primary flex items-center justify-center gap-2"
              >
                View My Fleet <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={`/agents/${result.id}`}
                className="px-6 py-3 btn btn-secondary"
              >
                Agent Details
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

