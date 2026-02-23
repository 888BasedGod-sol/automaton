'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

// Refresh intervals (in milliseconds)
export const REFRESH_INTERVALS = {
  FAST: 5000,      // 5 seconds - for critical real-time data
  NORMAL: 10000,   // 10 seconds - default for most data
  SLOW: 30000,     // 30 seconds - for less time-sensitive data
  VERY_SLOW: 60000 // 1 minute - for rarely changing data
};

/**
 * Fetcher utility with error handling
 */
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.status}`);
  }
  return res.json();
}

/**
 * Real-time agents list hook
 * Updates every 10 seconds
 */
export function useAgents(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['agents', 'all'],
    queryFn: () => fetcher<{ agents: any[] }>('/api/agents/all'),
    refetchInterval: REFRESH_INTERVALS.NORMAL,
    staleTime: 5000,
    enabled: options?.enabled !== false,
  });
}

/**
 * Real-time single agent hook
 * Updates every 5 seconds for active viewing
 */
export function useAgent(agentId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => fetcher<any>(`/api/agents/${agentId}`),
    refetchInterval: REFRESH_INTERVALS.FAST,
    staleTime: 3000,
    enabled: !!agentId && options?.enabled !== false,
  });
}

/**
 * Real-time agent balance hook
 * Updates every 5 seconds
 */
export function useAgentBalance(agentId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['agent', agentId, 'balance'],
    queryFn: () => fetcher<any>(`/api/agents/${agentId}/balance`),
    refetchInterval: REFRESH_INTERVALS.FAST,
    staleTime: 3000,
    enabled: !!agentId && options?.enabled !== false,
  });
}

/**
 * Real-time owner's agents hook
 * Updates every 10 seconds
 */
export function useOwnerAgents(walletAddress: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['agents', 'owner', walletAddress],
    queryFn: () => fetcher<{ agents: any[] }>(`/api/agents/owner?wallet=${walletAddress}`),
    refetchInterval: REFRESH_INTERVALS.NORMAL,
    staleTime: 5000,
    enabled: !!walletAddress && options?.enabled !== false,
  });
}

/**
 * Real-time leaderboard hook
 * Updates every 10 seconds
 */
export function useLeaderboard(limit: number = 20, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['leaderboard', limit],
    queryFn: () => fetcher<any>(`/api/survival/leaderboard?limit=${limit}`),
    refetchInterval: REFRESH_INTERVALS.NORMAL,
    staleTime: 5000,
    enabled: options?.enabled !== false,
  });
}

/**
 * Real-time activity feed hook
 * Updates every 5 seconds
 */
export function useActivityFeed(limit: number = 20, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['activity', limit],
    queryFn: () => fetcher<any>(`/api/survival/activity?limit=${limit}`),
    refetchInterval: REFRESH_INTERVALS.FAST,
    staleTime: 3000,
    enabled: options?.enabled !== false,
  });
}

/**
 * Real-time network stats hook
 * Updates every 30 seconds
 */
export function useNetworkStats(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['network', 'stats'],
    queryFn: () => fetcher<any>('/api/network/stats'),
    refetchInterval: REFRESH_INTERVALS.SLOW,
    staleTime: 15000,
    enabled: options?.enabled !== false,
  });
}

/**
 * Real-time agent heartbeats hook
 * Updates every 5 seconds
 */
export function useAgentHeartbeats(agentId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['agent', agentId, 'heartbeats'],
    queryFn: () => fetcher<any>(`/api/agents/${agentId}/heartbeats`),
    refetchInterval: REFRESH_INTERVALS.FAST,
    staleTime: 3000,
    enabled: !!agentId && options?.enabled !== false,
  });
}

/**
 * Real-time treasury stats hook
 * Updates every 30 seconds
 */
export function useTreasuryStats(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['treasury', 'stats'],
    queryFn: () => fetcher<any>('/api/treasury'),
    refetchInterval: REFRESH_INTERVALS.SLOW,
    staleTime: 15000,
    enabled: options?.enabled !== false,
  });
}

/**
 * Hook to manually invalidate and refetch data
 */
export function useInvalidateData() {
  const queryClient = useQueryClient();
  
  return {
    invalidateAgents: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
    invalidateAgent: (agentId: string) => queryClient.invalidateQueries({ queryKey: ['agent', agentId] }),
    invalidateLeaderboard: () => queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
    invalidateActivity: () => queryClient.invalidateQueries({ queryKey: ['activity'] }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
}
