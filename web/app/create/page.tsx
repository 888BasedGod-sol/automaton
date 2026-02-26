'use client';

import { useState } from 'react';
import { 
  CheckCircle, ArrowRight, ArrowLeft, Loader2, Zap, Wallet,
  Bot, Search, TrendingUp, MessageCircle, Code, Sparkles,
  Play, Copy, Check, ExternalLink, Server, DollarSign, Heart,
  AlertTriangle, Clock, Cpu
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-10 w-32 bg-white/5 border border-white/10 rounded animate-pulse" /> }
);

interface Template {
  id: string;
  name: string;
  icon: any;
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
    color: 'text-emerald-400',
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
    color: 'text-yellow-400',
    description: 'Start from scratch with your own genesis prompt. No pre-configured skills.',
    genesisPrompt: '',
    skills: [],
  },
];

export default function Create() {
  const { publicKey, connected } = useWallet();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    genesisPrompt: '',
  });

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setFormData(prev => ({
      ...prev,
      genesisPrompt: template.genesisPrompt
    }));
    setStep(2);
  };

  const handleDeploy = async () => {
    if (!formData.name || !formData.genesisPrompt) return;
    setLoading(true);
    
    try {
        const response = await fetch('/api/agents/create', {
            method: 'POST',
            body: JSON.stringify({
                name: formData.name,
                genesisPrompt: formData.genesisPrompt,
                ownerWallet: publicKey?.toBase58(),
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
           const err = await response.json();
           throw new Error(err.error || 'Failed to create agent');
        }

        const data = await response.json();
        router.push(`/agents/${data.id}`);
    } catch (e) {
        console.error(e);
        setLoading(false);
    }
  };

  const StepIndicator = ({ num, label, active }: { num: number, label: string, active: boolean }) => (
    <div className={`flex items-center gap-3 ${active ? 'text-white' : 'text-fg-muted opacity-50'}`}>
       <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-sm border ${active ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-transparent border-white/20'}`}>
          {num}
       </div>
       <span className="font-mono text-xs uppercase tracking-wider font-bold">{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-fg font-mono selection:bg-accent selection:text-white pb-20 relative">
      <Header />

      {/* Global Tech Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0" 
        style={{ 
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }} 
      />
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-transparent via-black/50 to-black/80" />

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
         
         {/* Header Title */}
         <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase tracking-widest font-bold mb-4">
              <Cpu className="w-3 h-3" />
              Deployment Sequence
            </div>
            <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Initialize Agent</h1>
            <p className="text-fg-muted max-w-xl text-sm leading-relaxed">
               Deploy a new autonomous agent to the network. Configure its core personality, survival skills, and initial funding parameters.
            </p>
         </div>

         {/* Steps */}
         <div className="flex items-center gap-8 mb-12 border-b border-white/5 pb-8">
            <StepIndicator num={1} label="Select Template" active={step === 1} />
            <div className="w-12 h-px bg-white/10" />
            <StepIndicator num={2} label="Configure Core" active={step === 2} />
         </div>

         {/* Step Content */}
         <div className="min-h-[400px]">
            {step === 1 && (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {TEMPLATES.map((template) => {
                     const Icon = template.icon;
                     return (
                        <button 
                            key={template.id}
                            onClick={() => handleTemplateSelect(template)}
                            className="group text-left bg-[#0c0c0e]/80 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-emerald-500/50 hover:bg-white/5 transition-all relative overflow-hidden"
                        >
                            <div className={`w-12 h-12 rounded bg-white/5 flex items-center justify-center mb-4 ${template.color} group-hover:scale-110 transition-transform duration-300`}>
                            <Icon className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">{template.name}</h3>
                            <p className="text-xs text-fg-muted leading-relaxed mb-4 min-h-[60px]">
                            {template.description}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-fg-muted uppercase tracking-wider font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {template.skills.length > 0 ? `${template.skills.length} Modules` : 'Clean Slate'}
                            </div>
                        </button>
                     );
                  })}
               </div>
            )}

            {step === 2 && selectedTemplate && (
               <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-[#0c0c0e]/80 backdrop-blur-sm border border-white/10 rounded-xl p-8 shadow-2xl">
                     <div className="flex items-center gap-4 mb-8 pb-8 border-b border-white/5">
                        <div className={`w-12 h-12 rounded bg-white/5 flex items-center justify-center ${selectedTemplate.color}`}>
                           <selectedTemplate.icon className="w-6 h-6" />
                        </div>
                        <div>
                           <div className="text-[10px] text-fg-muted uppercase tracking-wider font-bold mb-1">Selected Template</div>
                           <h2 className="text-xl font-bold text-white">{selectedTemplate.name}</h2>
                        </div>
                        <button onClick={() => setStep(1)} className="ml-auto text-xs text-emerald-400 hover:text-emerald-300 underline font-bold uppercase tracking-wide">
                           Change
                        </button>
                     </div>

                     <div className="space-y-6">
                        <div>
                           <label className="block text-xs uppercase tracking-wider font-bold text-fg-muted mb-2">Agent Name</label>
                           <input 
                              type="text" 
                              value={formData.name}
                              onChange={(e) => setFormData({...formData, name: e.target.value})}
                              placeholder="e.g. Nexus-7"
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                              autoFocus
                           />
                        </div>

                        <div>
                           <label className="block text-xs uppercase tracking-wider font-bold text-fg-muted mb-2">Genesis Prompt (System Instructions)</label>
                           <textarea 
                              value={formData.genesisPrompt}
                              onChange={(e) => setFormData({...formData, genesisPrompt: e.target.value})}
                              placeholder="Define the agent's core personality and directives..."
                              className="w-full h-48 bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono text-xs leading-relaxed resize-none custom-scrollbar"
                           />
                        </div>

                        <div className="pt-6">
                            {!connected ? (
                               <div className="w-full p-4 bg-yellow-500/10 border border-yellow-500/20 rounded flex items-center justify-center gap-3 text-yellow-500 font-bold uppercase text-xs">
                                  <AlertTriangle className="w-4 h-4" />
                                  Connect Wallet To Deploy
                               </div>
                            ) : (
                               <button 
                                 onClick={handleDeploy}
                                 disabled={!formData.name || !formData.genesisPrompt || loading}
                                 className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase tracking-widest rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-3 group"
                               >
                                  {loading ? (
                                     <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Initializing Neural Net...
                                     </>
                                  ) : (
                                     <>
                                        <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        Initialize Agent
                                     </>
                                  )}
                               </button>
                            )}
                        </div>
                     </div>
                  </div>
               </div>
            )}
         </div>
      </main>
    </div>
  );
}

