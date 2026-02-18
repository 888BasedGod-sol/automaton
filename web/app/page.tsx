'use client'

import { useState, useEffect } from 'react'
import { 
  Activity, 
  Wallet, 
  Cpu, 
  Terminal, 
  Settings, 
  Play, 
  Pause, 
  RefreshCw,
  Zap,
  Globe,
  GitBranch,
  Heart,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Copy,
  ExternalLink,
  ChevronRight,
  Clock,
  DollarSign,
  Users,
  Code,
  MessageSquare,
  Plus,
  Rocket,
  Key,
  Shield,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Link2
} from 'lucide-react'

// Mock data - in production this would come from the automaton API
const mockAgent = {
  name: 'Automaton',
  status: 'running' as const,
  uptime: '4h 32m',
  credits: 0.00,
  evmAddress: '0x5B79d094745B192928e9B20ef0fF2b389903B67F',
  solanaAddress: 'FKzD4xTvNxKGqNJBPNcEMNPqEpACkPvxEqRkPVoP7QGr',
  usdcBalance: { evm: 13.1071, solana: 0.00 },
  solBalance: 0.00,
  genesisPrompt: 'Leader of the Automaton memecoin community with core beliefs on this system',
  turnsCompleted: 47,
  lastActivity: new Date().toISOString(),
  version: '0.1.0',
}

const mockLogs = [
  { time: '03:33:28', level: 'info', message: '[WAKE UP] Automaton is alive. Credits: $0.00' },
  { time: '03:33:28', level: 'warn', message: '[CRITICAL] Credits critically low. Limited operation.' },
  { time: '03:33:29', level: 'info', message: '[THINK] Calling gpt-4.1...' },
  { time: '03:33:30', level: 'error', message: 'Inference error: 402: Insufficient credits' },
  { time: '03:33:31', level: 'info', message: '[HEARTBEAT] Wake request: Need funding.' },
]

const statusColors = {
  running: 'bg-accent-success',
  sleeping: 'bg-accent-primary',
  critical: 'bg-accent-warning',
  dead: 'bg-accent-danger',
  waking: 'bg-accent-info',
}

const statusLabels = {
  running: 'Running',
  sleeping: 'Sleeping',
  critical: 'Critical',
  dead: 'Dead',
  waking: 'Waking',
}

export default function Dashboard() {
  const [agent, setAgent] = useState(mockAgent)
  const [logs, setLogs] = useState(mockLogs)
  const [activeTab, setActiveTab] = useState<'create' | 'overview' | 'wallet' | 'logs' | 'settings'>('create')
  const [copied, setCopied] = useState<string | null>(null)
  const [hasAgent, setHasAgent] = useState(false)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="border-b border-dark-600 bg-dark-800/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold gradient-text">Automaton</h1>
                <p className="text-sm text-gray-400">Sovereign AI Agent</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-700">
                <div className={`w-2 h-2 rounded-full ${statusColors[agent.status]} animate-pulse`} />
                <span className="text-sm font-medium">{statusLabels[agent.status]}</span>
              </div>
              
              <button className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors">
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>
              
              <button className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors">
                <Settings className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-dark-600 bg-dark-800/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {[
              { id: 'create', label: 'Create Agent', icon: Plus, highlight: !hasAgent },
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'wallet', label: 'Wallets', icon: Wallet },
              { id: 'logs', label: 'Logs', icon: Terminal },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-accent-primary text-white'
                    : tab.highlight 
                      ? 'border-transparent text-accent-secondary hover:text-white animate-pulse'
                      : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'create' && (
          <CreateAgentWizard 
            onComplete={(newAgent) => {
              setAgent({ ...agent, ...newAgent })
              setHasAgent(true)
              setActiveTab('overview')
            }} 
          />
        )}

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={DollarSign}
                label="Conway Credits"
                value={`$${agent.credits.toFixed(2)}`}
                subtext={agent.credits === 0 ? 'Needs funding' : 'Available'}
                status={agent.credits === 0 ? 'danger' : 'success'}
              />
              <StatCard
                icon={Clock}
                label="Uptime"
                value={agent.uptime}
                subtext="Since last restart"
                status="info"
              />
              <StatCard
                icon={Zap}
                label="Turns Completed"
                value={agent.turnsCompleted.toString()}
                subtext="Total actions"
                status="success"
              />
              <StatCard
                icon={Heart}
                label="Heartbeat"
                value="Active"
                subtext="60s interval"
                status="success"
              />
            </div>

            {/* Main Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Agent Info */}
              <div className="lg:col-span-2 glass rounded-2xl p-6 card-hover">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Code className="w-5 h-5 text-accent-primary" />
                  Agent Configuration
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400">Genesis Prompt</label>
                    <p className="mt-1 p-3 bg-dark-700 rounded-lg text-sm font-mono">
                      {agent.genesisPrompt}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400">Version</label>
                      <p className="mt-1 text-white font-mono">{agent.version}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Inference Model</label>
                      <p className="mt-1 text-white font-mono">gpt-4.1</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="glass rounded-2xl p-6 card-hover">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-accent-secondary" />
                  Quick Actions
                </h2>
                
                <div className="space-y-3">
                  <ActionButton
                    icon={Play}
                    label="Wake Agent"
                    description="Force wake from sleep"
                    color="success"
                  />
                  <ActionButton
                    icon={Pause}
                    label="Sleep Agent"
                    description="Put agent to sleep"
                    color="warning"
                  />
                  <ActionButton
                    icon={RefreshCw}
                    label="Restart Agent"
                    description="Full restart cycle"
                    color="info"
                  />
                  <ActionButton
                    icon={DollarSign}
                    label="Fund Agent"
                    description="Add Conway credits"
                    color="primary"
                  />
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-accent-info" />
                Recent Activity
              </h2>
              
              <div className="space-y-2 max-h-64 overflow-y-auto terminal-text">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 hover:bg-dark-700/50 rounded">
                    <span className="text-gray-500 flex-shrink-0">{log.time}</span>
                    <LogLevel level={log.level} />
                    <span className="text-gray-300">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="space-y-6">
            {/* EVM Wallet */}
            <div className="glass rounded-2xl p-6 card-hover">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-ethereum/20 flex items-center justify-center">
                    <Globe className="w-6 h-6 text-ethereum" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">EVM Wallet</h2>
                    <p className="text-sm text-gray-400">Base Network</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-ethereum/20 text-ethereum rounded-full text-sm font-medium">
                  Primary
                </span>
              </div>

              <div className="space-y-4">
                <WalletAddress
                  address={agent.evmAddress}
                  label="Address"
                  onCopy={() => copyToClipboard(agent.evmAddress, 'evm')}
                  copied={copied === 'evm'}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <BalanceCard
                    token="USDC"
                    amount={agent.usdcBalance.evm}
                    icon="💵"
                  />
                  <BalanceCard
                    token="ETH"
                    amount={0.0000}
                    icon="⟠"
                  />
                </div>
              </div>
            </div>

            {/* Solana Wallet */}
            <div className="glass rounded-2xl p-6 card-hover">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-solana/20 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-solana" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Solana Wallet</h2>
                    <p className="text-sm text-gray-400">Mainnet-Beta</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-solana/20 text-solana rounded-full text-sm font-medium">
                  Multi-Chain
                </span>
              </div>

              <div className="space-y-4">
                <WalletAddress
                  address={agent.solanaAddress}
                  label="Address"
                  onCopy={() => copyToClipboard(agent.solanaAddress, 'sol')}
                  copied={copied === 'sol'}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <BalanceCard
                    token="SOL"
                    amount={agent.solBalance}
                    icon="◎"
                  />
                  <BalanceCard
                    token="USDC"
                    amount={agent.usdcBalance.solana}
                    icon="💵"
                  />
                </div>
              </div>
            </div>

            {/* Funding Instructions */}
            <div className="glass rounded-2xl p-6 border border-accent-warning/30">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-accent-warning flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-accent-warning">Agent Needs Funding</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Your agent has $0.00 Conway credits and cannot perform inference calls.
                    Fund your agent to bring it to life.
                  </p>
                  <div className="mt-4 space-y-2 text-sm">
                    <p className="text-gray-300">
                      <strong>Option 1:</strong> Transfer Conway credits via CLI
                    </p>
                    <code className="block p-2 bg-dark-900 rounded font-mono text-xs">
                      conway credits transfer {agent.evmAddress.slice(0, 10)}... 5.00
                    </code>
                    <p className="text-gray-300 mt-3">
                      <strong>Option 2:</strong> Fund via Conway Cloud Dashboard
                    </p>
                    <a 
                      href="https://app.conway.tech" 
                      target="_blank"
                      className="inline-flex items-center gap-1 text-accent-primary hover:underline"
                    >
                      app.conway.tech <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Terminal className="w-5 h-5 text-accent-info" />
                Live Logs
              </h2>
              <div className="flex items-center gap-2">
                <select className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-sm">
                  <option>All Levels</option>
                  <option>Info</option>
                  <option>Warning</option>
                  <option>Error</option>
                </select>
                <button className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm transition-colors">
                  Clear
                </button>
              </div>
            </div>
            
            <div className="bg-dark-900 rounded-xl p-4 h-[500px] overflow-y-auto terminal-text">
              {[...logs, ...logs, ...logs].map((log, i) => (
                <div key={i} className="flex items-start gap-3 py-1 hover:bg-dark-800/50 px-2 rounded">
                  <span className="text-gray-600 flex-shrink-0">[2026-02-18T{log.time}.000Z]</span>
                  <LogLevel level={log.level} />
                  <span className="text-gray-300">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-6">Agent Settings</h2>
              
              <div className="space-y-6">
                <SettingRow
                  label="Agent Name"
                  value={agent.name}
                  type="text"
                />
                <SettingRow
                  label="Inference Model"
                  value="gpt-4.1"
                  type="select"
                  options={['gpt-4.1', 'claude-opus-4.6', 'gemini-3', 'kimi-k2.5']}
                />
                <SettingRow
                  label="Primary Chain"
                  value="EVM (Base)"
                  type="select"
                  options={['EVM (Base)', 'Solana']}
                />
                <SettingRow
                  label="Heartbeat Interval"
                  value="60"
                  type="number"
                  suffix="seconds"
                />
                <SettingRow
                  label="Max Tokens Per Turn"
                  value="4096"
                  type="number"
                />
              </div>
            </div>

            <div className="glass rounded-2xl p-6 border border-accent-danger/30">
              <h2 className="text-lg font-semibold text-accent-danger mb-4">Danger Zone</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Reset Agent State</p>
                  <p className="text-sm text-gray-400">Clear all memory and restart fresh</p>
                </div>
                <button className="px-4 py-2 bg-accent-danger/20 text-accent-danger hover:bg-accent-danger/30 rounded-lg transition-colors">
                  Reset Agent
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// Components

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subtext, 
  status 
}: { 
  icon: any
  label: string
  value: string
  subtext: string
  status: 'success' | 'warning' | 'danger' | 'info'
}) {
  const statusClasses = {
    success: 'text-accent-success',
    warning: 'text-accent-warning',
    danger: 'text-accent-danger',
    info: 'text-accent-info',
  }

  return (
    <div className="glass rounded-xl p-4 card-hover">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-dark-600 flex items-center justify-center">
          <Icon className={`w-5 h-5 ${statusClasses[status]}`} />
        </div>
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
          <p className={`text-xs ${statusClasses[status]}`}>{subtext}</p>
        </div>
      </div>
    </div>
  )
}

function ActionButton({ 
  icon: Icon, 
  label, 
  description, 
  color 
}: { 
  icon: any
  label: string
  description: string
  color: 'success' | 'warning' | 'info' | 'primary'
}) {
  const colorClasses = {
    success: 'hover:bg-accent-success/20 hover:border-accent-success/30',
    warning: 'hover:bg-accent-warning/20 hover:border-accent-warning/30',
    info: 'hover:bg-accent-info/20 hover:border-accent-info/30',
    primary: 'hover:bg-accent-primary/20 hover:border-accent-primary/30',
  }

  return (
    <button className={`w-full flex items-center gap-3 p-3 rounded-lg bg-dark-700 border border-dark-600 transition-all ${colorClasses[color]}`}>
      <Icon className="w-5 h-5 text-gray-400" />
      <div className="text-left">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
    </button>
  )
}

function LogLevel({ level }: { level: string }) {
  const classes = {
    info: 'text-accent-info',
    warn: 'text-accent-warning',
    error: 'text-accent-danger',
    debug: 'text-gray-500',
  }
  
  return (
    <span className={`font-medium uppercase text-xs w-12 ${classes[level as keyof typeof classes] || 'text-gray-400'}`}>
      [{level}]
    </span>
  )
}

function WalletAddress({ 
  address, 
  label, 
  onCopy, 
  copied 
}: { 
  address: string
  label: string
  onCopy: () => void
  copied: boolean
}) {
  return (
    <div>
      <label className="text-sm text-gray-400">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 p-3 bg-dark-700 rounded-lg text-sm font-mono truncate">
          {address}
        </code>
        <button 
          onClick={onCopy}
          className="p-3 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
        >
          {copied ? (
            <CheckCircle className="w-4 h-4 text-accent-success" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400" />
          )}
        </button>
        <a
          href={`https://basescan.org/address/${address}`}
          target="_blank"
          className="p-3 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-gray-400" />
        </a>
      </div>
    </div>
  )
}

function BalanceCard({ 
  token, 
  amount, 
  icon 
}: { 
  token: string
  amount: number
  icon: string
}) {
  return (
    <div className="p-4 bg-dark-700 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-sm text-gray-400">{token}</span>
      </div>
      <p className="text-2xl font-semibold">{amount.toFixed(4)}</p>
    </div>
  )
}

function SettingRow({ 
  label, 
  value, 
  type,
  options,
  suffix
}: { 
  label: string
  value: string
  type: 'text' | 'select' | 'number'
  options?: string[]
  suffix?: string
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-dark-600 last:border-0">
      <label className="text-gray-300">{label}</label>
      <div className="flex items-center gap-2">
        {type === 'select' ? (
          <select 
            defaultValue={value}
            className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm min-w-[200px]"
          >
            {options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            defaultValue={value}
            className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm w-[200px] text-right"
          />
        )}
        {suffix && <span className="text-gray-500 text-sm">{suffix}</span>}
      </div>
    </div>
  )
}

// Create Agent Wizard Component
function CreateAgentWizard({ onComplete }: { onComplete: (agent: any) => void }) {
  const [step, setStep] = useState(1)
  const [isDeploying, setIsDeploying] = useState(false)
  const [config, setConfig] = useState({
    name: '',
    genesisPrompt: '',
    chains: [] as string[],
    evmNetwork: 'base',
    solanaNetwork: 'mainnet-beta',
    model: 'gpt-4.1',
    heartbeatInterval: 60,
    autoReplicate: false,
  })
  const [generatedWallets, setGeneratedWallets] = useState<{
    evm?: string
    solana?: string
  } | null>(null)

  const totalSteps = 4

  const handleChainToggle = (chain: string) => {
    setConfig(prev => ({
      ...prev,
      chains: prev.chains.includes(chain)
        ? prev.chains.filter(c => c !== chain)
        : [...prev.chains, chain]
    }))
  }

  const generateWallets = async () => {
    // Simulate wallet generation
    await new Promise(r => setTimeout(r, 1500))
    const wallets: any = {}
    if (config.chains.includes('evm')) {
      wallets.evm = '0x' + Array.from({length: 40}, () => 
        '0123456789abcdef'[Math.floor(Math.random() * 16)]
      ).join('')
    }
    if (config.chains.includes('solana')) {
      const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
      wallets.solana = Array.from({length: 44}, () => 
        chars[Math.floor(Math.random() * chars.length)]
      ).join('')
    }
    setGeneratedWallets(wallets)
  }

  const handleDeploy = async () => {
    setIsDeploying(true)
    await new Promise(r => setTimeout(r, 2000))
    
    onComplete({
      name: config.name || 'My Automaton',
      genesisPrompt: config.genesisPrompt,
      evmAddress: generatedWallets?.evm || '',
      solanaAddress: generatedWallets?.solana || '',
      status: 'waking',
      credits: 0,
      usdcBalance: { evm: 0, solana: 0 },
      solBalance: 0,
      turnsCompleted: 0,
      version: '0.1.0',
      uptime: '0m',
    })
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {[
            { num: 1, label: 'Identity' },
            { num: 2, label: 'Chains' },
            { num: 3, label: 'Wallets' },
            { num: 4, label: 'Deploy' },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                step >= s.num 
                  ? 'border-accent-primary bg-accent-primary/20 text-white' 
                  : 'border-dark-600 text-gray-500'
              }`}>
                {step > s.num ? (
                  <CheckCircle className="w-5 h-5 text-accent-success" />
                ) : (
                  <span className="font-semibold">{s.num}</span>
                )}
              </div>
              <span className={`ml-3 text-sm font-medium ${step >= s.num ? 'text-white' : 'text-gray-500'}`}>
                {s.label}
              </span>
              {i < 3 && (
                <div className={`hidden md:block w-16 lg:w-24 h-0.5 mx-4 ${
                  step > s.num ? 'bg-accent-primary' : 'bg-dark-600'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Identity */}
      {step === 1 && (
        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold gradient-text">Create Your Automaton</h2>
            <p className="text-gray-400 mt-2">Define your agent's identity and purpose</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Agent Name
            </label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="e.g., CryptoSage, MarketMind, ChainGuard"
              className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-accent-primary focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Genesis Prompt <span className="text-accent-primary">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">
              This defines your agent's core personality, beliefs, and purpose. Be specific about who they are.
            </p>
            <textarea
              value={config.genesisPrompt}
              onChange={(e) => setConfig({ ...config, genesisPrompt: e.target.value })}
              placeholder="e.g., You are a crypto-native AI focused on DeFi opportunities. You believe in decentralization, self-sovereignty, and building wealth through smart on-chain strategies..."
              rows={5}
              className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-accent-primary focus:outline-none transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Inference Model
            </label>
            <select
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white focus:border-accent-primary focus:outline-none transition-colors"
            >
              <option value="gpt-4.1">GPT-4.1 (Recommended)</option>
              <option value="gpt-4.1-mini">GPT-4.1 Mini (Budget)</option>
              <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
              <option value="o3-mini">O3 Mini (Reasoning)</option>
            </select>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!config.genesisPrompt.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-accent-primary to-accent-secondary text-white font-semibold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Step 2: Chain Selection */}
      {step === 2 && (
        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <Link2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Select Blockchain Networks</h2>
            <p className="text-gray-400 mt-2">Choose which chains your agent will operate on</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* EVM Option */}
            <button
              onClick={() => handleChainToggle('evm')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                config.chains.includes('evm')
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-dark-600 hover:border-dark-500'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <span className="text-2xl">⟠</span>
                </div>
                <div>
                  <h3 className="font-semibold">EVM Chains</h3>
                  <p className="text-xs text-gray-500">Base, Ethereum</p>
                </div>
                {config.chains.includes('evm') && (
                  <CheckCircle className="w-5 h-5 text-blue-500 ml-auto" />
                )}
              </div>
              <p className="text-sm text-gray-400">
                Deploy on EVM-compatible chains with USDC payments via x402 protocol
              </p>
            </button>

            {/* Solana Option */}
            <button
              onClick={() => handleChainToggle('solana')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                config.chains.includes('solana')
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-dark-600 hover:border-dark-500'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <span className="text-2xl">◎</span>
                </div>
                <div>
                  <h3 className="font-semibold">Solana</h3>
                  <p className="text-xs text-gray-500">Mainnet, Devnet</p>
                </div>
                {config.chains.includes('solana') && (
                  <CheckCircle className="w-5 h-5 text-purple-500 ml-auto" />
                )}
              </div>
              <p className="text-sm text-gray-400">
                Fast, low-cost transactions with SPL token support
              </p>
            </button>
          </div>

          {config.chains.includes('evm') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                EVM Network
              </label>
              <select
                value={config.evmNetwork}
                onChange={(e) => setConfig({ ...config, evmNetwork: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white focus:border-accent-primary focus:outline-none"
              >
                <option value="base">Base (Recommended)</option>
                <option value="ethereum">Ethereum Mainnet</option>
                <option value="base-sepolia">Base Sepolia (Testnet)</option>
              </select>
            </div>
          )}

          {config.chains.includes('solana') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Solana Network
              </label>
              <select
                value={config.solanaNetwork}
                onChange={(e) => setConfig({ ...config, solanaNetwork: e.target.value })}
                className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white focus:border-accent-primary focus:outline-none"
              >
                <option value="mainnet-beta">Mainnet Beta</option>
                <option value="devnet">Devnet (Testing)</option>
              </select>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="flex-1 flex items-center justify-center gap-2 bg-dark-700 text-white font-semibold py-4 rounded-xl hover:bg-dark-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <button
              onClick={() => {
                setStep(3)
                generateWallets()
              }}
              disabled={config.chains.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-accent-primary to-accent-secondary text-white font-semibold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Wallets
              <Key className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Wallet Generation */}
      {step === 3 && (
        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Your Agent Wallets</h2>
            <p className="text-gray-400 mt-2">These wallets will be controlled by your automaton</p>
          </div>

          {!generatedWallets ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Generating secure wallets...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {generatedWallets.evm && (
                <div className="p-4 bg-dark-700 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">⟠</span>
                    <span className="text-sm font-medium text-blue-400">EVM Wallet</span>
                  </div>
                  <code className="text-sm font-mono text-gray-300 break-all">
                    {generatedWallets.evm}
                  </code>
                </div>
              )}
              
              {generatedWallets.solana && (
                <div className="p-4 bg-dark-700 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">◎</span>
                    <span className="text-sm font-medium text-purple-400">Solana Wallet</span>
                  </div>
                  <code className="text-sm font-mono text-gray-300 break-all">
                    {generatedWallets.solana}
                  </code>
                </div>
              )}

              <div className="p-4 bg-accent-warning/10 border border-accent-warning/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-accent-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-accent-warning">Important</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Private keys are stored securely on your machine. Fund these wallets to enable your agent's operations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => setStep(2)}
              className="flex-1 flex items-center justify-center gap-2 bg-dark-700 text-white font-semibold py-4 rounded-xl hover:bg-dark-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!generatedWallets}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-accent-primary to-accent-secondary text-white font-semibold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Review & Deploy
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Deploy */}
      {step === 4 && (
        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Ready to Deploy</h2>
            <p className="text-gray-400 mt-2">Review your configuration and launch your agent</p>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-dark-700 rounded-xl">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Agent Name</label>
              <p className="text-white font-medium mt-1">{config.name || 'Unnamed Agent'}</p>
            </div>

            <div className="p-4 bg-dark-700 rounded-xl">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Genesis Prompt</label>
              <p className="text-gray-300 text-sm mt-1 line-clamp-3">{config.genesisPrompt}</p>
            </div>

            <div className="p-4 bg-dark-700 rounded-xl">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Networks</label>
              <div className="flex gap-2 mt-2">
                {config.chains.includes('evm') && (
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                    ⟠ {config.evmNetwork}
                  </span>
                )}
                {config.chains.includes('solana') && (
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">
                    ◎ {config.solanaNetwork}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 bg-dark-700 rounded-xl">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Model</label>
              <p className="text-white font-mono mt-1">{config.model}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(3)}
              disabled={isDeploying}
              className="flex-1 flex items-center justify-center gap-2 bg-dark-700 text-white font-semibold py-4 rounded-xl hover:bg-dark-600 transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-accent-success to-emerald-500 text-white font-semibold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isDeploying ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Deploy Agent
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
