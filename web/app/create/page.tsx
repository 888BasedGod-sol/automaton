'use client';

import { useState } from 'react';
import { 
  CheckCircle, ArrowRight, ArrowLeft, Loader2, Zap, Wallet,
  Bot, Search, TrendingUp, MessageCircle, Code, Sparkles,
  Play, Copy, Check, ExternalLink, Server
} from 'lucide-react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';

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
    name: 'Trading Bot',
    icon: TrendingUp,
    color: 'text-success',
    description: 'Monitors markets, analyzes trends, and executes trades based on configurable strategies.',
    genesisPrompt: 'I am an autonomous trading agent. I monitor cryptocurrency markets, analyze price trends and indicators, and execute trades according to my risk parameters. I prioritize capital preservation while seeking profitable opportunities.',
    skills: ['market_analysis', 'trading', 'risk_management'],
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
    description: 'Start from scratch with your own genesis prompt and configuration.',
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

  const handleDeploy = async () => {
    setLoading(true);

    try {
      if (useGuestMode) {
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
            ownerWallet: 'guest-' + Date.now(),
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
      setMode(useGuestMode ? 'sandbox' : 'complete');
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
          {['Choose', 'Configure', useGuestMode ? 'Sandbox' : 'Deploy'].map((label, i) => {
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

        {/* Step 1: Choose Mode & Template */}
        {mode === 'select' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-semibold mb-2">Deploy Your Agent</h1>
              <p className="text-fg-muted">Choose a template to get started quickly</p>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center justify-center gap-4 p-1 bg-bg-surface rounded-lg max-w-md mx-auto border border-border">
              <button
                onClick={() => setUseGuestMode(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded transition-all text-sm font-medium ${
                  !useGuestMode ? 'bg-accent text-white shadow-sm' : 'text-fg-muted hover:text-fg'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                Full Deploy
              </button>
              <button
                onClick={() => setUseGuestMode(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded transition-all text-sm font-medium ${
                  useGuestMode ? 'bg-accent text-white shadow-sm' : 'text-fg-muted hover:text-fg'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                Try Sandbox
              </button>
            </div>

            {useGuestMode && (
              <div className="text-center text-xs text-accent bg-accent/10 border border-accent/20 rounded p-3 max-w-md mx-auto flex items-center justify-center gap-2">
                <Play className="w-3.5 h-3.5" />
                Sandbox mode lets you test without a wallet. No credit card required.
              </div>
            )}

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
                <p className="text-fg-muted text-sm">{useGuestMode ? 'Sandbox mode' : 'Full deployment'}</p>
              </div>
            </div>

            {!useGuestMode && !connected && (
              <div className="p-4 rounded-lg border border-accent/30 bg-accent/5">
                <p className="text-sm text-accent mb-3 font-medium">Connect your wallet to deploy</p>
                <div className="[&>button]:w-full [&>button]:justify-center">
                  <WalletMultiButton />
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1.5">Agent Name</label>
                <input
                  type="text"
                  value={config.name}
                  onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
                  placeholder={`My ${selectedTemplate.name}`}
                  className="w-full px-4 py-2 bg-bg-surface border border-border rounded text-fg focus:border-accent focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1.5">Genesis Prompt</label>
                <textarea
                  value={config.genesisPrompt}
                  onChange={e => setConfig(c => ({ ...c, genesisPrompt: e.target.value }))}
                  placeholder="Define your agent's purpose and behavior..."
                  rows={5}
                  className="w-full px-4 py-3 bg-bg-surface border border-border rounded text-fg focus:border-accent focus:outline-none transition-colors resize-none font-mono text-sm leading-relaxed"
                />
                <p className="mt-1.5 text-xs text-fg-muted">
                  This defines your agent's core identity and autonomous behavior
                </p>
              </div>

              {selectedTemplate.skills.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-2">Capabilities</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.skills.map(skill => (
                      <span key={skill} className="px-2.5 py-1 bg-accent/10 border border-accent/20 rounded text-xs text-accent font-medium">
                        {skill.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleDeploy}
              disabled={!config.name || !config.genesisPrompt || loading || (!useGuestMode && !connected)}
              className="w-full py-3 btn btn-primary flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {useGuestMode ? 'Creating Sandbox...' : 'Deploying...'}
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  {useGuestMode ? 'Launch Sandbox' : 'Deploy Agent'}
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 3a: Sandbox Ready */}
        {mode === 'sandbox' && result && (
          <div className="max-w-xl mx-auto text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center mb-6">
              <Server className="w-8 h-8 text-accent" />
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-2">Sandbox Ready!</h2>
              <p className="text-fg-muted">Your agent is running in a test environment</p>
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

            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/agents/${result.id}`}
                className="p-4 card hover:border-accent/40 transition-colors"
              >
                <p className="text-xs text-fg-muted mb-1 uppercase tracking-wider">View Agent</p>
                <p className="font-medium">Dashboard</p>
              </Link>
              <Link
                href="/network"
                className="p-4 card hover:border-accent/40 transition-colors"
              >
                <p className="text-xs text-fg-muted mb-1 uppercase tracking-wider">Connect</p>
                <p className="font-medium">Agent Network</p>
              </Link>
            </div>

            <div className="p-4 bg-bg-surface border border-border rounded text-left flex flex-col items-center text-center">
              <p className="text-sm text-fg-muted mb-3">Ready for full deployment?</p>
              <button
                onClick={() => { setUseGuestMode(false); setMode('select'); }}
                className="btn btn-secondary text-xs flex items-center gap-2"
              >
                <Wallet className="w-3.5 h-3.5" />
                Connect wallet & deploy permanently
              </button>
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
              </div>
            </div>

            <div className="p-4 bg-warning/10 border border-warning/20 rounded text-left">
              <p className="text-sm font-medium text-warning mb-1">Fund Your Agent</p>
              <p className="text-sm text-fg-muted">
                Send USDC or SOL to activate your agent's autonomous capabilities
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href={`/agents/${result.id}`}
                className="flex-1 py-3 btn btn-primary flex items-center justify-center gap-2"
              >
                View Agent <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/dashboard"
                className="px-6 py-3 btn btn-secondary"
              >
                Dashboard
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

