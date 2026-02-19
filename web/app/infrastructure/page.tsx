'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Server, Plus, Trash2, Play, Square, RefreshCw, 
  Terminal, Cpu, HardDrive, Activity, Globe, Loader2,
  ChevronRight, AlertCircle
} from 'lucide-react';
import Header from '@/components/Header';

interface Sandbox {
  id: string;
  status: string;
  region: string;
  vcpu: number;
  memoryMb: number;
  diskGb: number;
  terminalUrl?: string;
  createdAt: string;
}

export default function InfrastructurePage() {
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSandboxes();
  }, []);

  const fetchSandboxes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sandbox');
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      }
      setSandboxes(data.sandboxes || []);
    } catch (e) {
      setError('Failed to fetch sandboxes');
    } finally {
      setLoading(false);
    }
  };

  const createSandbox = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `sandbox-${Date.now()}`,
          vcpu: 1,
          memoryMb: 512,
          diskGb: 5,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSandboxes();
      } else {
        setError(data.error || 'Failed to create sandbox');
      }
    } catch (e) {
      setError('Failed to create sandbox');
    } finally {
      setCreating(false);
    }
  };

  const deleteSandbox = async (id: string) => {
    if (!confirm('Delete this sandbox?')) return;
    
    try {
      const res = await fetch(`/api/sandbox?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSandboxes(prev => prev.filter(s => s.id !== id));
      }
    } catch (e) {
      setError('Failed to delete sandbox');
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-surface-0">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Infrastructure</h1>
            <p className="text-text-secondary">Manage Conway Cloud sandboxes and compute resources</p>
          </div>
          <button
            onClick={createSandbox}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent-purple hover:bg-accent-purple/80 text-white rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            New Sandbox
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-accent-red/10 border border-accent-red/20 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-accent-red flex-shrink-0" />
            <div>
              <p className="text-sm text-accent-red font-medium">Connection Error</p>
              <p className="text-sm text-text-secondary">{error}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-surface-1 border border-white/5">
            <div className="flex items-center gap-2 text-text-muted text-sm mb-2">
              <Server className="w-4 h-4" />
              Active Sandboxes
            </div>
            <p className="text-2xl font-bold">{sandboxes.filter(s => s.status === 'running').length}</p>
          </div>
          <div className="p-4 rounded-2xl bg-surface-1 border border-white/5">
            <div className="flex items-center gap-2 text-text-muted text-sm mb-2">
              <Cpu className="w-4 h-4" />
              Total vCPUs
            </div>
            <p className="text-2xl font-bold">{sandboxes.reduce((acc, s) => acc + (s.vcpu || 0), 0)}</p>
          </div>
          <div className="p-4 rounded-2xl bg-surface-1 border border-white/5">
            <div className="flex items-center gap-2 text-text-muted text-sm mb-2">
              <HardDrive className="w-4 h-4" />
              Total Storage
            </div>
            <p className="text-2xl font-bold">{sandboxes.reduce((acc, s) => acc + (s.diskGb || 0), 0)} GB</p>
          </div>
          <div className="p-4 rounded-2xl bg-surface-1 border border-white/5">
            <div className="flex items-center gap-2 text-text-muted text-sm mb-2">
              <Globe className="w-4 h-4" />
              Regions
            </div>
            <p className="text-2xl font-bold">{new Set(sandboxes.map(s => s.region).filter(Boolean)).size || 1}</p>
          </div>
        </div>

        {/* Sandboxes Grid */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sandboxes</h2>
          <button 
            onClick={fetchSandboxes}
            className="text-sm text-text-muted hover:text-white flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-surface-1 animate-pulse" />
            ))}
          </div>
        ) : sandboxes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sandboxes.map((sandbox) => (
              <SandboxCard 
                key={sandbox.id} 
                sandbox={sandbox} 
                onDelete={deleteSandbox}
                formatDate={formatDate}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-surface-1 rounded-2xl border border-white/5">
            <Server className="w-16 h-16 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No sandboxes</h3>
            <p className="text-text-secondary mb-6">
              {error ? 'Connect your Conway API key to manage sandboxes' : 'Create your first sandbox to get started'}
            </p>
            <button
              onClick={createSandbox}
              disabled={creating || !!error}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-purple text-white rounded-lg text-sm disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Create Sandbox
            </button>
          </div>
        )}

        {/* API Config Note */}
        <div className="mt-8 p-4 rounded-xl bg-surface-1 border border-white/5">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-accent-cyan" />
            Configuration
          </h3>
          <p className="text-sm text-text-secondary mb-3">
            Set <code className="px-1.5 py-0.5 bg-surface-2 rounded text-xs">CONWAY_API_KEY</code> environment variable to enable sandbox management.
          </p>
          <pre className="p-3 bg-surface-0 rounded-lg text-xs text-text-muted overflow-x-auto">
            CONWAY_API_KEY=your_api_key_here
          </pre>
        </div>
      </main>
    </div>
  );
}

function SandboxCard({ 
  sandbox, 
  onDelete, 
  formatDate 
}: { 
  sandbox: Sandbox; 
  onDelete: (id: string) => void;
  formatDate: (iso: string) => string;
}) {
  const isRunning = sandbox.status === 'running';
  
  return (
    <div className="p-5 rounded-2xl bg-surface-1 border border-white/5 hover:border-accent-cyan/30 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isRunning ? 'bg-accent-green/10 text-accent-green' : 'bg-surface-2 text-text-muted'
          }`}>
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium font-mono text-sm">{sandbox.id.slice(0, 12)}...</p>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-accent-green' : 'bg-text-muted'}`} />
              <span className="text-xs text-text-muted capitalize">{sandbox.status}</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => onDelete(sandbox.id)}
          className="p-2 text-text-muted hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-2 rounded-lg bg-surface-0 text-center">
          <p className="text-xs text-text-muted mb-0.5">vCPU</p>
          <p className="text-sm font-medium">{sandbox.vcpu}</p>
        </div>
        <div className="p-2 rounded-lg bg-surface-0 text-center">
          <p className="text-xs text-text-muted mb-0.5">Memory</p>
          <p className="text-sm font-medium">{sandbox.memoryMb}MB</p>
        </div>
        <div className="p-2 rounded-lg bg-surface-0 text-center">
          <p className="text-xs text-text-muted mb-0.5">Disk</p>
          <p className="text-sm font-medium">{sandbox.diskGb}GB</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{sandbox.region || 'us-east-1'}</span>
        <span>{sandbox.createdAt ? formatDate(sandbox.createdAt) : 'Recently'}</span>
      </div>

      {sandbox.terminalUrl && (
        <a 
          href={sandbox.terminalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-surface-2 hover:bg-surface-3 text-sm rounded-lg transition-colors"
        >
          <Terminal className="w-4 h-4" />
          Open Terminal
        </a>
      )}
    </div>
  );
}
