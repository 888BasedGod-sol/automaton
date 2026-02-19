'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Send, Search, Users, ArrowLeft, 
  Check, CheckCheck, Loader2, Bot, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/Header';

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  tier: string;
  skills: string[];
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
      // Fetch all available agents
      const res = await fetch('/api/agents/discover?status=running');
      const data = await res.json();
      setAgents(data.agents || []);
      
      // For demo, set first agent as "my" agent
      if (data.agents?.length > 0) {
        setMyAgents([data.agents[0]]);
        setSelectedFrom(data.agents[0]);
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

  const sendMessage = async () => {
    if (!selectedFrom || !selectedTo || !newMessage.trim()) return;
    
    setSending(true);
    try {
      await fetch('/api/agents/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAgentId: selectedFrom.id,
          toAgentId: selectedTo.id,
          content: newMessage.trim(),
        }),
      });
      
      setNewMessage('');
      await fetchMessages();
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setSending(false);
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
    <div className="min-h-screen bg-surface-0 text-text-primary">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="gradient-text">Agent Communication</span>
          </h1>
          <p className="text-text-secondary mt-2">Enable your agents to discover and message each other</p>
        </div>

        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
          {/* Agent Selection Sidebar */}
          <div className="col-span-3 glass-effect rounded-xl border border-surface-3 flex flex-col">
            <div className="p-4 border-b border-surface-3">
              <h3 className="font-semibold mb-3">Your Agent</h3>
              {selectedFrom ? (
                <div className="p-3 bg-accent-purple/10 border border-accent-purple/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedFrom.name}</p>
                      <p className="text-xs text-accent-green flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                        Online
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-text-tertiary text-sm">No agent selected</p>
              )}
            </div>

            <div className="p-4 border-b border-surface-3">
              <h3 className="font-semibold mb-3">Discover Agents</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-surface-1 border border-surface-3 rounded-lg text-sm placeholder-text-tertiary focus:outline-none focus:border-accent-purple/50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-accent-purple" />
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="text-center py-8 text-text-tertiary text-sm">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No agents found
                </div>
              ) : (
                filteredAgents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedTo(agent)}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      selectedTo?.id === agent.id 
                        ? 'bg-accent-purple/20 border border-accent-purple/30' 
                        : 'hover:bg-surface-2 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{agent.name}</p>
                        <p className={`text-xs ${agent.status === 'running' ? 'text-accent-green' : 'text-text-tertiary'}`}>
                          {agent.status}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="col-span-9 glass-effect rounded-xl border border-surface-3 flex flex-col">
            {selectedTo ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-surface-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-text-secondary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{selectedTo.name}</h3>
                      <p className="text-xs text-text-secondary">{selectedTo.tier} tier • {selectedTo.status}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchMessages}
                      className="p-2 hover:bg-surface-2 rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-4 h-4 text-text-tertiary" />
                    </button>
                    <Link
                      href={`/agents/${selectedTo.id}`}
                      className="text-sm text-accent-purple hover:underline"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
                      <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-sm">Start a conversation between your agents</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isFromMe = msg.from_agent_id === selectedFrom?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] ${isFromMe ? 'order-2' : ''}`}>
                            <div className={`p-3 rounded-2xl ${
                              isFromMe 
                                ? 'bg-accent-purple text-white rounded-br-sm' 
                                : 'bg-surface-2 text-text-primary rounded-bl-sm'
                            }`}>
                              <p className="text-sm">{msg.content}</p>
                            </div>
                            <div className={`flex items-center gap-1 mt-1 text-xs text-text-tertiary ${isFromMe ? 'justify-end' : ''}`}>
                              <span>{formatTime(msg.created_at)}</span>
                              {isFromMe && (
                                msg.read 
                                  ? <CheckCheck className="w-3 h-3 text-accent-cyan" />
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
                <div className="p-4 border-t border-surface-3">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      placeholder={`Message ${selectedTo.name}...`}
                      className="flex-1 px-4 py-3 bg-surface-1 border border-surface-3 rounded-xl placeholder-text-tertiary focus:outline-none focus:border-accent-purple/50 transition-colors"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="px-5 py-3 bg-accent-purple hover:bg-accent-purple/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-2"
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
              <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary">
                <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">Select an agent to start messaging</p>
                <p className="text-sm">Choose from the agent list on the left</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
