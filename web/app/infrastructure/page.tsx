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
    <div className="min-h-screen bg-bg-base text-fg">
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Infrastructure</h1>
            <p className="text-fg-muted">Manage Conway Cloud sandboxes and compute resources</p>
          </div>
          <button
            onClick={createSandbox}
            disabled={creating}
            className="btn btn-primary flex items-center gap-2"
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
          <div className="mb-6 p-4 rounded-lg bg-error/10 border border-error/20 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
            <div>
              <p className="text-sm text-error font-medium">Connection Error</p>
              <p className="text-sm text-fg-muted opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-fg-muted text-xs uppercase tracking-wider mb-2 font-medium">
              <Server className="w-3.5 h-3.5" />
              Active Sandboxes
            </div>
            <p className="text-2xl font-mono font-medium">{sandboxes.filter(s => s.status === 'running').length}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-fg-muted text-xs uppercase tracking-wider mb-2 font-medium">
              <Cpu className="w-3.5 h-3.5" />
              Total vCPUs
            </div>
            <p className="text-2xl font-mono font-medium">{sandboxes.reduce((acc, s) => acc + (s.vcpu || 0), 0)}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-fg-muted text-xs uppercase tracking-wider mb-2 font-medium">
              <HardDrive className="w-3.5 h-3.5" />
              Total Storage
            </div>
            <p className="text-2xl font-mono font-medium">{sandboxes.reduce((acc, s) => acc + (s.diskGb || 0), 0)} <span className="text-sm text-fg-muted font-sans">GB</span></p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-fg-muted text-xs uppercase tracking-wider mb-2 font-medium">
              <Globe className="w-3.5 h-3.5" />
              Regions
            </div>
            <p className="text-2xl font-mono font-medium">{new Set(sandboxes.map(s => s.region).filter(Boolean)).size || 1}</p>
          </div>
        </div>

        {/* Sandboxes Grid */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-medium">Sandboxes</h2>
          <button 
            onClick={fetchSandboxes}
            className="text-sm text-fg-muted hover:text-fg flex items-center gap-2 transition-colors px-3 py-1.5 rounded hover:bg-bg-elevated"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 rounded-lg bg-bg-surface animate-pulse" />
            ))}
          </div>
        ) : sandboxes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sandboxes.map((sandbox) => (
              <SandboxCard 
                key={sandbox.id} 
                sandbox={sandbox} 
                onDelete={() => deleteSandbox(sandbox.id)}
                formatDate={formatDate}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 card border-dashed">
            <Server className="w-12 h-12 text-fg-muted mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No sandboxes</h3>
            <p className="text-fg-muted mb-6 max-w-sm mx-auto">
              {error ? 'Connect your Conway API key to manage sandboxes' : 'Create your first sandbox to get started'}
            </p>
            <button
              onClick={createSandbox}
              disabled={creating || !!error}
              className="btn btn-secondary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Sandbox
            </button>
          </div>
        )}

        {/* API Config Note */}
        <div className="mt-8 p-4 rounded-lg bg-bg-surface border border-border">
          <h3 className="font-medium mb-2 flex items-center gap-2 text-sm">
            <Terminal className="w-4 h-4 text-accent" />
            Configuration
          </h3>
          <p className="text-sm text-fg-muted mb-3">
            Set <code className="px-1.5 py-0.5 bg-bg-base border border-border rounded text-xs text-fg font-mono">CONWAY_API_KEY</code> environment variable to enable sandbox management.
          </p>
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
  const status = sandbox.status || 'running';
  const isRunning = status === 'running';
  
  return (
    <div className="card p-5 group hover:border-accent/30 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border border-border ${
            isRunning ? 'bg-bg-elevated text-success' : 'bg-bg-base text-fg-muted'
          }`}>
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium font-mono text-sm">{sandbox.id.slice(0, 12)}...</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-success animate-pulse' : 'bg-fg-muted'}`} />
              <span className="text-xs text-fg-muted capitalize">{status}</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => onDelete(sandbox.id)}
          className="p-1.5 text-fg-muted hover:text-error hover:bg-error/10 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="Terminate"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-2 rounded bg-bg-base border border-border text-center">
          <p className="text-[10px] text-fg-muted mb-0.5 uppercase tracking-wide">vCPU</p>
          <p className="text-sm font-mono">{sandbox.vcpu}</p>
        </div>
        <div className="p-2 rounded bg-bg-base border border-border text-center">
          <p className="text-[10px] text-fg-muted mb-0.5 uppercase tracking-wide">Memory</p>
          <p className="text-sm font-mono">{sandbox.memoryMb}</p>
        </div>
        <div className="p-2 rounded bg-bg-base border border-border text-center">
          <p className="text-[10px] text-fg-muted mb-0.5 uppercase tracking-wide">Disk</p>
          <p className="text-sm font-mono">{sandbox.diskGb}GB</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-fg-muted pt-3 border-t border-border">
        <div className="flex items-center gap-1.5">
          <Globe className="w-3 h-3" />
          <span>{sandbox.region || 'us-east-1'}</span>
        </div>
        <span className="font-mono text-fg-faint">{sandbox.createdAt ? formatDate(sandbox.createdAt) : 'Recently'}</span>
      </div>

      {sandbox.terminalUrl && (
        <a 
          href={sandbox.terminalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 w-full py-2 btn btn-secondary text-xs"
        >
          <Terminal className="w-3.5 h-3.5" />
          Open Terminal
        </a>
      )}
    </div>
  );
}
