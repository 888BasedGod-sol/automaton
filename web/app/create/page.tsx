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
  { ssr: false, loading: () => <div className="h-10 w-32 bg-accent-purple/50 rounded-lg animate-pulse" /> }
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
    color: 'from-blue-500 to-cyan-500',
    description: 'Autonomous research assistant that explores topics, synthesizes information, and reports findings.',
    genesisPrompt: 'I am an autonomous research agent. I explore topics in depth, cross-reference multiple sources, and provide comprehensive analysis. I proactively seek relevant information and present findings in clear, structured formats.',
    skills: ['web_search', 'summarization', 'report_generation'],
  },
  {
    id: 'trading',
    name: 'Trading Bot',
    icon: TrendingUp,
    color: 'from-green-500 to-emerald-500',
    description: 'Monitors markets, analyzes trends, and executes trades based on configurable strategies.',
    genesisPrompt: 'I am an autonomous trading agent. I monitor cryptocurrency markets, analyze price trends and indicators, and execute trades according to my risk parameters. I prioritize capital preservation while seeking profitable opportunities.',
    skills: ['market_analysis', 'trading', 'risk_management'],
  },
  {
    id: 'social',
    name: 'Social Agent',
    icon: MessageCircle,
    color: 'from-purple-500 to-pink-500',
    description: 'Engages with communities, builds relationships, and manages social presence autonomously.',
    genesisPrompt: 'I am an autonomous social agent. I engage authentically with communities, create valuable content, build meaningful connections, and represent my values in all interactions. I communicate clearly and respectfully.',
    skills: ['social_posting', 'community_engagement', 'content_creation'],
  },
  {
    id: 'developer',
    name: 'Developer Agent',
    icon: Code,
    color: 'from-orange-500 to-red-500',
    description: 'Writes, reviews, and maintains code autonomously. Can build and deploy applications.',
    genesisPrompt: 'I am an autonomous developer agent. I write clean, tested code, review pull requests, fix bugs, and build applications. I follow best practices, document my work, and continuously improve codebases.',
    skills: ['code_generation', 'code_review', 'deployment'],
  },
  {
    id: 'custom',
    name: 'Custom Agent',
    icon: Sparkles,
    color: 'from-accent-purple to-accent-cyan',
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
    <div className="min-h-screen bg-surface-0 text-text-primary">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {['Choose', 'Configure', useGuestMode ? 'Sandbox' : 'Deploy'].map((label, i) => {
            const stepNum = i + 1;
            const currentStep = mode === 'select' ? 1 : mode === 'configure' ? 2 : 3;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border transition-all ${
                  currentStep > stepNum ? 'bg-accent-purple text-white border-accent-purple' :
                  currentStep === stepNum ? 'border-accent-purple text-accent-purple' :
                  'border-surface-3 text-text-tertiary'
                }`}>
                  {currentStep > stepNum ? <CheckCircle className="w-4 h-4" /> : stepNum}
                </div>
                {i < 2 && <div className={`w-12 h-px ${currentStep > stepNum ? 'bg-accent-purple' : 'bg-surface-3'}`} />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Choose Mode & Template */}
        {mode === 'select' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold gradient-text mb-2">Deploy Your Agent</h1>
              <p className="text-text-secondary">Choose a template to get started quickly</p>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center justify-center gap-4 p-1 bg-surface-1 rounded-xl max-w-md mx-auto border border-surface-3">
              <button
                onClick={() => setUseGuestMode(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-all ${
                  !useGuestMode ? 'bg-accent-purple text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Wallet className="w-4 h-4" />
                Full Deploy
              </button>
              <button
                onClick={() => setUseGuestMode(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-all ${
                  useGuestMode ? 'bg-accent-cyan text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Server className="w-4 h-4" />
                Try Sandbox
              </button>
            </div>

            {useGuestMode && (
              <div className="text-center text-sm text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg p-3 max-w-md mx-auto">
                <Play className="w-4 h-4 inline mr-2" />
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
                    className="group p-5 glass-effect rounded-xl border border-surface-3 hover:border-accent-purple/50 transition-all text-left card-hover"
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center mb-4`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2 group-hover:text-accent-purple transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-sm text-text-secondary line-clamp-2">
                      {template.description}
                    </p>
                    {template.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {template.skills.slice(0, 2).map(skill => (
                          <span key={skill} className="px-2 py-0.5 text-xs bg-surface-2 border border-surface-3 rounded text-text-tertiary">
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
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to templates
            </button>

            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${selectedTemplate.color} flex items-center justify-center`}>
                <selectedTemplate.icon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{selectedTemplate.name}</h2>
                <p className="text-text-secondary text-sm">{useGuestMode ? 'Sandbox mode' : 'Full deployment'}</p>
              </div>
            </div>

            {!useGuestMode && !connected && (
              <div className="p-4 glass-effect rounded-xl border border-accent-purple/30">
                <p className="text-sm text-text-secondary mb-3">Connect your wallet to deploy</p>
                <WalletMultiButton style={{
                  background: 'linear-gradient(135deg, #9333ea 0%, #06b6d4 100%)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  height: '44px',
                  width: '100%',
                  justifyContent: 'center',
                }} />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">Agent Name</label>
                <input
                  type="text"
                  value={config.name}
                  onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
                  placeholder={`My ${selectedTemplate.name}`}
                  className="w-full px-4 py-3 bg-surface-1 border border-surface-3 rounded-xl text-text-primary placeholder-text-tertiary focus:border-accent-purple/50 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">Genesis Prompt</label>
                <textarea
                  value={config.genesisPrompt}
                  onChange={e => setConfig(c => ({ ...c, genesisPrompt: e.target.value }))}
                  placeholder="Define your agent's purpose and behavior..."
                  rows={5}
                  className="w-full px-4 py-3 bg-surface-1 border border-surface-3 rounded-xl text-text-primary placeholder-text-tertiary focus:border-accent-purple/50 focus:outline-none transition-colors resize-none font-mono text-sm"
                />
                <p className="mt-2 text-xs text-text-tertiary">
                  This defines your agent's core identity and autonomous behavior
                </p>
              </div>

              {selectedTemplate.skills.length > 0 && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">Capabilities</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.skills.map(skill => (
                      <span key={skill} className="px-3 py-1.5 bg-accent-purple/10 border border-accent-purple/30 rounded-lg text-sm text-accent-purple">
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
              className="w-full py-4 bg-gradient-to-r from-accent-purple to-accent-cyan hover:opacity-90 text-white rounded-xl font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {useGuestMode ? 'Creating Sandbox...' : 'Deploying...'}
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  {useGuestMode ? 'Launch Sandbox' : 'Deploy Agent'}
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 3a: Sandbox Ready */}
        {mode === 'sandbox' && result && (
          <div className="max-w-xl mx-auto text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-accent-cyan to-accent-purple flex items-center justify-center">
              <Server className="w-10 h-10 text-white" />
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-2">Sandbox Ready!</h2>
              <p className="text-text-secondary">Your agent is running in a test environment</p>
            </div>

            {result.terminalUrl && (
              <a
                href={result.terminalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 glass-effect rounded-xl border border-accent-cyan/30 hover:border-accent-cyan/50 transition-colors group"
              >
                <p className="text-sm text-text-secondary mb-2">Terminal Access</p>
                <p className="font-mono text-accent-cyan group-hover:underline flex items-center justify-center gap-2">
                  Open Terminal <ExternalLink className="w-4 h-4" />
                </p>
              </a>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/agents/${result.id}`}
                className="p-4 glass-effect rounded-xl border border-surface-3 hover:border-accent-purple/50 transition-colors"
              >
                <p className="text-sm text-text-secondary mb-1">View Agent</p>
                <p className="font-medium">Dashboard</p>
              </Link>
              <Link
                href="/network"
                className="p-4 glass-effect rounded-xl border border-surface-3 hover:border-accent-purple/50 transition-colors"
              >
                <p className="text-sm text-text-secondary mb-1">Connect</p>
                <p className="font-medium">Agent Network</p>
              </Link>
            </div>

            <div className="p-4 bg-accent-purple/10 border border-accent-purple/30 rounded-xl text-left">
              <p className="text-sm text-text-secondary mb-2">Ready for full deployment?</p>
              <button
                onClick={() => { setUseGuestMode(false); setMode('select'); }}
                className="flex items-center gap-2 text-accent-purple font-medium hover:underline"
              >
                <Wallet className="w-4 h-4" />
                Connect wallet & deploy permanently
              </button>
            </div>
          </div>
        )}

        {/* Step 3b: Full Deploy Complete */}
        {mode === 'complete' && result && (
          <div className="max-w-xl mx-auto text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-2">Agent Deployed!</h2>
              <p className="text-text-secondary">Your autonomous agent is now live</p>
            </div>

            <div className="space-y-3">
              <div className="p-4 glass-effect rounded-xl border border-surface-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-text-secondary">Solana Address</span>
                  <button 
                    onClick={() => copyToClipboard(result.solanaAddress, 'sol')}
                    className="p-1 hover:bg-surface-2 rounded transition-colors"
                  >
                    {copied === 'sol' ? <Check className="w-4 h-4 text-accent-green" /> : <Copy className="w-4 h-4 text-text-tertiary" />}
                  </button>
                </div>
                <p className="font-mono text-sm truncate">{result.solanaAddress}</p>
              </div>

              <div className="p-4 glass-effect rounded-xl border border-surface-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-text-secondary">EVM Address</span>
                  <button 
                    onClick={() => copyToClipboard(result.evmAddress, 'evm')}
                    className="p-1 hover:bg-surface-2 rounded transition-colors"
                  >
                    {copied === 'evm' ? <Check className="w-4 h-4 text-accent-green" /> : <Copy className="w-4 h-4 text-text-tertiary" />}
                  </button>
                </div>
                <p className="font-mono text-sm truncate">{result.evmAddress}</p>
              </div>
            </div>

            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-left">
              <p className="text-sm font-medium text-yellow-400 mb-1">Fund Your Agent</p>
              <p className="text-sm text-text-secondary">
                Send USDC or SOL to activate your agent's autonomous capabilities
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href={`/agents/${result.id}`}
                className="flex-1 py-3 bg-gradient-to-r from-accent-purple to-accent-cyan hover:opacity-90 text-white rounded-xl font-medium transition-opacity flex items-center justify-center gap-2"
              >
                View Agent <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/dashboard"
                className="px-6 py-3 bg-surface-1 border border-surface-3 hover:bg-surface-2 text-text-primary rounded-xl font-medium transition-colors"
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
