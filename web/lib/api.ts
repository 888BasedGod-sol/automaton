/**
 * Automaton API Client
 * 
 * Connects to the local automaton runtime to fetch status,
 * control the agent, and manage configuration.
 */

export interface AgentStatus {
  name: string
  status: 'setup' | 'waking' | 'running' | 'sleeping' | 'low_compute' | 'critical' | 'dead'
  uptime: string
  credits: number
  evmAddress: string
  solanaAddress?: string
  usdcBalance: {
    evm: number
    solana: number
  }
  solBalance: number
  ethBalance: number
  genesisPrompt: string
  turnsCompleted: number
  lastActivity: string
  version: string
  heartbeatInterval: number
  inferenceModel: string
}

export interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  turnId?: string
}

export interface Turn {
  id: string
  timestamp: string
  state: string
  thinking: string
  toolCalls: {
    name: string
    arguments: Record<string, unknown>
    result: string
    durationMs: number
  }[]
  tokenUsage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  costCents: number
}

export interface WalletInfo {
  chain: 'evm' | 'solana'
  address: string
  network: string
  balances: {
    token: string
    amount: number
    usdValue?: number
  }[]
}

const API_BASE = process.env.NEXT_PUBLIC_AUTOMATON_API || 'http://localhost:8888'

class AutomatonClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl
  }

  async getStatus(): Promise<AgentStatus> {
    const res = await fetch(`${this.baseUrl}/api/status`)
    if (!res.ok) throw new Error('Failed to fetch status')
    return res.json()
  }

  async getLogs(limit: number = 100): Promise<LogEntry[]> {
    const res = await fetch(`${this.baseUrl}/api/logs?limit=${limit}`)
    if (!res.ok) throw new Error('Failed to fetch logs')
    return res.json()
  }

  async getTurns(limit: number = 20): Promise<Turn[]> {
    const res = await fetch(`${this.baseUrl}/api/turns?limit=${limit}`)
    if (!res.ok) throw new Error('Failed to fetch turns')
    return res.json()
  }

  async getWallets(): Promise<WalletInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/wallets`)
    if (!res.ok) throw new Error('Failed to fetch wallets')
    return res.json()
  }

  async wake(): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/control/wake`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to wake agent')
    return res.json()
  }

  async sleep(): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/control/sleep`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to sleep agent')
    return res.json()
  }

  async restart(): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/control/restart`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to restart agent')
    return res.json()
  }

  async updateConfig(config: Partial<AgentStatus>): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    if (!res.ok) throw new Error('Failed to update config')
    return res.json()
  }
}

export const automatonClient = new AutomatonClient()
export default AutomatonClient
