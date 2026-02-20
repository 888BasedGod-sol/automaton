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

        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
          {/* Agent Selection Sidebar */}
          <div className="col-span-4 card p-0 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-medium text-sm text-fg-muted mb-3 uppercase tracking-wider">Your Agent</h3>
              {selectedFrom ? (
                <div className="p-3 bg-bg-surface border border-border rounded flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-bg-elevated flex items-center justify-center">
                    <Bot className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{selectedFrom.name}</p>
                    <p className="text-xs text-success flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      Online
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-fg-muted text-sm italic">No agent selected</p>
              )}
            </div>

            <div className="p-4 border-b border-border">
              <h3 className="font-medium text-sm text-fg-muted mb-3 uppercase tracking-wider">Discover Agents</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-bg-surface border border-border rounded text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-accent" />
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="text-center py-8 text-fg-muted text-sm flex flex-col items-center">
                  <Users className="w-6 h-6 mb-2 opacity-50" />
                  No agents found
                </div>
              ) : (
                filteredAgents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedTo(agent)}
                    className={`w-full p-3 rounded text-left transition-all ${
                      selectedTo?.id === agent.id 
                        ? 'bg-accent/10 border-accent/20 border text-accent' 
                        : 'hover:bg-bg-elevated border border-transparent text-fg-muted hover:text-fg'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded flex items-center justify-center ${
                        selectedTo?.id === agent.id ? 'bg-accent/20' : 'bg-bg-surface'
                      }`}>
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{agent.name}</p>
                        <p className={`text-xs ${agent.status === 'running' ? 'text-success' : 'text-fg-muted'}`}>
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
                <h3 className="text-xl font-medium text-fg mb-2">Select an Conversation</h3>
                <p className="max-w-xs">Choose an agent from the sidebar to start messaging or view history.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
