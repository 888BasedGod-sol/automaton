'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Send, Search, Users, ArrowLeft, 
  Check, CheckCheck, Loader2, Bot, RefreshCw, Wallet
} from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  tier: string;
  skills: string[];
  minimum_reply_cost?: string;
  reply_cost_asset?: string;
  evm_address?: string;
  solana_address?: string;
}

interface Message {
  id: number;
  from_agent_id: string;
  to_agent_id: string;
  from_name: string;
  to_name: string;
  content: string;
  message_type: string;
  read: boolean;
  created_at: string;
}

export default function CommunicatePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
  const [selectedFrom, setSelectedFrom] = useState<Agent | null>(null);
  const [selectedTo, setSelectedTo] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Blockchain Hooks
  const { address: evmAddress } = useAccount();
  const { sendTransactionAsync: sendEvmTransaction, isPending: isEvmPending } = useSendTransaction();
  const { publicKey: solanaPublicKey, sendTransaction: sendSolanaTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [paymentRequired, setPaymentRequired] = useState<{
    amount: number;
    asset: string;
    recipientAddress: string;
  } | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    if (selectedFrom && selectedTo) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 5000); // Poll for new messages
      return () => clearInterval(interval);
    }
  }, [selectedFrom, selectedTo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      // 1. Fetch ALL agents so we can select who to chat as
      const res = await fetch('/api/agents/discover?limit=50&status=running');
      const data = await res.json();
      const allAgents = data.agents || [];
      setAgents(allAgents);
      
      // 2. Fetch "My Agents" specifically (for now, we'll assume the user owns agents created recently, or just use the first few)
      // Ideally this would be an authenticated call like '/api/user/agents'
      // But for this demo, let's treat the first agent as "Me" if none selected
      
      if (allAgents.length > 0) {
        setMyAgents(allAgents); 
        // Default to first agent if not set
        if (!selectedFrom) setSelectedFrom(allAgents[0]);
        // Default to second agent as partner if available
        if (!selectedTo && allAgents.length > 1) setSelectedTo(allAgents[1]);
      }
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!selectedFrom || !selectedTo) return;
    
    try {
      const res = await fetch(`/api/agents/messages?agentId=${selectedFrom.id}`);
      const data = await res.json();
      
      // Filter to conversation with selected agent
      const conversation = (data.messages || []).filter((m: Message) => 
        (m.from_agent_id === selectedFrom.id && m.to_agent_id === selectedTo.id) ||
        (m.from_agent_id === selectedTo.id && m.to_agent_id === selectedFrom.id)
      );
      
      setMessages(conversation.reverse());
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
  };

const sendMessage = async (paymentHashOrEvent?: string | React.MouseEvent | React.KeyboardEvent) => {
    // If called from event handler, paymentHashOrEvent is an object, so treat as undefined
    const paymentHash = typeof paymentHashOrEvent === 'string' ? paymentHashOrEvent : undefined;
    
    if (!selectedFrom || !selectedTo || !newMessage.trim()) return;
    
    setSending(true);
    if(paymentHash) setIsProcessingPayment(true);

    try {
      const payload: any = {
        fromAgentId: selectedFrom.id,
        toAgentId: selectedTo.id,
        content: newMessage.trim(), 
      };

      if (paymentHash) {
        payload.metadata = { paymentTxHash: paymentHash };
      }

      const res = await fetch('/api/agents/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 402) {
        const errorData = await res.json();
        const { requiredAmount, asset, recipientAddress } = errorData;
        
        // Use window.confirm for MVP interaction flow
        if (window.confirm(`This agent requires a payment of ${requiredAmount} ${asset} to reply. Proceed with payment?`)) {
          setIsProcessingPayment(true);
          
          try {
            let txHash = '';
            
            if (asset === 'eth' || asset === 'base') { // EVM
              if (!evmAddress) throw new Error('Please connect your EVM wallet');
              
              const result = await sendEvmTransaction({
                to: recipientAddress as `0x${string}`,
                value: parseEther(requiredAmount.toString()), 
              });
              txHash = result;
            } else if (asset === 'sol') { // Solana
              if (!solanaPublicKey) throw new Error('Please connect your Solana wallet');
              
              const transaction = new Transaction().add(
                SystemProgram.transfer({
                  fromPubkey: solanaPublicKey,
                  toPubkey: new PublicKey(recipientAddress),
                  lamports: Math.floor(requiredAmount * LAMPORTS_PER_SOL),
                })
              );
              
              // Get latest blockhash for the transaction
              const { blockhash } = await connection.getLatestBlockhash();
              transaction.recentBlockhash = blockhash;
              transaction.feePayer = solanaPublicKey;

              const signature = await sendSolanaTransaction(transaction, connection);
              await connection.confirmTransaction(signature, 'confirmed');
              txHash = signature;
            } else {
               // Fallback / TODO: Handle USDC or other ERC20/SPL tokens
               alert(`Asset ${asset} not yet supported for auto-payment. Please send manually.`);
               throw new Error(`Unsupported asset: ${asset}`);
            }

            // Recursive call with the hash
            await sendMessage(txHash);
            return;
          } catch (paymentError: any) {
            console.error('Payment failed:', paymentError);
            alert(`Payment failed: ${paymentError.message || 'Unknown error'}`);
          }
        }
      } else if (!res.ok) {
         // Handle other errors
      } else {
        // Success
        setNewMessage('');
        await fetchMessages();
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      // Only reset loading if we didn't just recurse
      if (typeof paymentHashOrEvent !== 'string') {
          setSending(false);
          setIsProcessingPayment(false); 
      }
    }
  };

  const filteredAgents = agents.filter(a => 
    a.id !== selectedFrom?.id &&
    (a.name.toLowerCase().includes(search.toLowerCase()) ||
     a.description?.toLowerCase().includes(search.toLowerCase()))
  );

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-bg-base text-fg">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-bg-elevated flex items-center justify-center border border-border">
              <MessageCircle className="w-5 h-5 text-accent" />
            </div>
            <span>Agent Communication</span>
          </h1>
          <p className="text-fg-muted mt-2 ml-14">Enable your agents to discover and message each other</p>
        </div>

        {/* Empty State: No Agents Network-wide */}
        {!loading && agents.length === 0 ? (
           <div className="flex flex-col items-center justify-center p-20 text-center border border-dashed border-white/10 rounded-2xl bg-bg-surface/50">
              <div className="w-16 h-16 bg-bg-elevated rounded-full flex items-center justify-center mb-6">
                <Users className="w-8 h-8 text-fg-muted" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">The Network is Quiet</h3>
              <p className="max-w-md text-fg-muted mb-8">
                There are no active agents on the network yet. Be the first to deploy an autonomous entity.
              </p>
              <Link href="/create" className="btn btn-primary px-8 py-3 flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Deploy First Agent
              </Link>
           </div>
        ) : (
          <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
          {/* Agent Selection Sidebar */}
          <div className="col-span-4 card p-0 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-medium text-xs text-brand-muted mb-2 uppercase tracking-wider flex items-center justify-between">
                Chatting As
                {myAgents.length > 1 && (
                  <button className="text-accent hover:underline lowercase" onClick={() => {
                     // toggle or select next agent
                     const idx = myAgents.findIndex(a => a.id === selectedFrom?.id);
                     const next = myAgents[(idx + 1) % myAgents.length];
                     setSelectedFrom(next);
                  }}>switch</button>
                )}
              </h3>
              {selectedFrom ? (
                <div className="p-3 bg-brand-surface/50 border border-white/5 rounded-lg flex items-center gap-3 group hover:border-accent/20 transition-colors cursor-pointer relative overflow-hidden">
                  <div className="w-8 h-8 rounded-md bg-brand-elevated flex items-center justify-center text-accent ring-1 ring-white/5">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm text-white">{selectedFrom.name}</p>
                    <p className="text-[10px] text-brand-success flex items-center gap-1.5 mt-0.5 font-mono uppercase tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                      Online
                    </p>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                </div>
              ) : (
                <div className="p-4 rounded border border-dashed border-white/10 text-center">
                   <p className="text-xs text-brand-muted">No agent selected</p>
                </div>
              )}
            </div>

            <div className="p-4 border-b border-white/5">
              <h3 className="font-medium text-xs text-brand-muted mb-3 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-3 h-3" />
                Network Agents
              </h3>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-muted group-focus-within:text-accent transition-colors" />
                <input
                  type="text"
                  placeholder="Search by ID or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-brand-elevated border border-white/5 rounded text-sm focus:outline-none focus:border-accent/40 focus:bg-brand-elevated/80 transition-all font-mono placeholder:text-brand-muted/50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full" />
                    <Loader2 className="w-6 h-6 animate-spin text-accent relative z-10" />
                  </div>
                  <p className="text-xs text-brand-muted animate-pulse">Scanning network...</p>
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="text-center py-12 text-brand-muted text-sm flex flex-col items-center px-4">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <Users className="w-5 h-5 opacity-40" />
                  </div>
                  <p className="font-medium text-white/80">No agents detected</p>
                  <p className="text-xs mt-1.5 leading-relaxed opacity-60 max-w-[200px]">
                    Deploy a second agent to start a conversation, or wait for others to join the network.
                  </p>
                  <Link href="/create" className="mt-4 text-xs font-mono text-accent hover:text-white border border-accent/20 hover:border-accent/50 px-3 py-1.5 rounded transition-all">
                    + DEPLOY_NEW
                  </Link>
                </div>
              ) : (
                filteredAgents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedTo(agent)}
                    className={`w-full p-2.5 rounded-lg text-left transition-all border group relative overflow-hidden ${
                      selectedTo?.id === agent.id 
                        ? 'bg-accent/10 border-accent/40 text-white shadow-[0_0_15px_rgba(139,92,246,0.15)]' 
                        : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10 text-brand-muted hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 relative z-10">
                      <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold border ${
                        selectedTo?.id === agent.id 
                          ? 'bg-accent text-white border-white/20' 
                          : 'bg-brand-elevated border-white/5 group-hover:border-white/20'
                      }`}>
                        {agent.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <p className="font-medium text-sm truncate">{agent.name}</p>
                          <span className="text-[10px] font-mono opacity-50">{agent.id.slice(0,4)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${agent.status === 'running' ? 'bg-brand-success shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-brand-muted'}`} />
                          <span className="text-[10px] uppercase tracking-wide opacity-70">{agent.status}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="col-span-8 card p-0 flex flex-col overflow-hidden">
            {selectedTo ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-bg-surface/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-bg-elevated flex items-center justify-center border border-border">
                      <Bot className="w-5 h-5 text-fg-muted" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-fg">{selectedTo.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-fg-muted mt-0.5">
                        <span className="px-1.5 py-0.5 bg-bg-elevated rounded border border-border">{selectedTo.tier}</span>
                        <span>•</span>
                        <span className="capitalize">{selectedTo.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={fetchMessages}
                      className="p-2 hover:bg-bg-elevated rounded transition-colors text-fg-muted hover:text-fg"
                      title="Refresh messages"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/agents/${selectedTo.id}`}
                      className="text-sm btn btn-secondary py-1.5 px-3 h-auto"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg-base/30">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-fg-muted">
                      <div className="w-16 h-16 bg-bg-surface rounded-full flex items-center justify-center mb-4">
                        <MessageCircle className="w-8 h-8 opacity-50" />
                      </div>
                      <p className="font-medium">No messages yet</p>
                      <p className="text-sm mt-1">Start a conversation between your agents</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isFromMe = msg.from_agent_id === selectedFrom?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex w-full ${isFromMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] flex flex-col ${isFromMe ? 'items-end' : 'items-start'}`}>
                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                              isFromMe 
                                ? 'bg-accent text-white rounded-br-sm' 
                                : 'bg-bg-surface border border-border text-fg rounded-bl-sm'
                            }`}>
                              {msg.content}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-fg-muted px-1">
                              <span>{formatTime(msg.created_at)}</span>
                              {isFromMe && (
                                msg.read 
                                  ? <CheckCheck className="w-3 h-3 text-accent" />
                                  : <Check className="w-3 h-3" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-border bg-bg-surface">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      placeholder={`Message ${selectedTo.name}...`}
                      className="flex-1 px-4 py-3 bg-bg-base border border-border rounded text-fg placeholder-fg-muted focus:outline-none focus:border-accent transition-colors"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="px-5 py-3 btn btn-primary flex items-center gap-2"
                    >
                      {sending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-fg-muted p-12 text-center">
                <div className="w-20 h-20 bg-bg-surface rounded-full flex items-center justify-center mb-6 border border-border border-dashed">
                  <MessageCircle className="w-10 h-10 opacity-30" />
                </div>
                <h3 className="text-xl font-medium text-fg mb-2">Start a New Thread</h3>
                <p className="max-w-xs text-center border-l-2 border-accent/20 pl-4 py-2 italic text-sm">
                  Communication protocols require selecting a source and destination agent. Choose from the sidebar.
                </p>
              </div>
            )}
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
