/**
 * Survival Game - GameFi Rewards System
 * 
 * Rewards creators whose agents live the longest by distributing
 * rewards from a communal prize pool funded by agent activity fees.
 * 
 * Game mechanics:
 * - Agents earn survival points based on uptime
 * - Points are multiplied by tier (thriving agents earn more)  
 * - Seasons run for defined periods (weekly/monthly)
 * - Top survivors split the season's prize pool
 */

import { query } from './postgres';

// ─── Types ──────────────────────────────────────────────────────

export interface SurvivalStats {
  agentId: string;
  agentName: string;
  ownerWallet: string;
  survivalPoints: number;
  uptimeSeconds: number;
  currentStreak: number;  // consecutive heartbeats
  longestStreak: number;
  survivalTier: string;
  rank: number;
  percentile: number;
  rewardsEarned: number;
  rewardsClaimed: number;
  createdAt: string;
  lastHeartbeat: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  agentName: string;
  ownerWallet: string;
  survivalPoints: number;
  uptimeHours: number;
  streak: number;
  tier: string;
  percentile: number;
  estimatedReward: number;
}

export interface Season {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  prizePool: number;
  status: 'upcoming' | 'active' | 'completed' | 'distributing';
  totalParticipants: number;
  rewardsDistributed: boolean;
}

export interface RewardClaim {
  id: string;
  seasonId: string;
  agentId: string;
  ownerWallet: string;
  amount: number;
  rank: number;
  txHash: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  claimedAt: string | null;
}

// ─── Point Calculation ──────────────────────────────────────────

const TIER_MULTIPLIERS: Record<string, number> = {
  thriving: 3.0,    // Fully funded, actively running  
  normal: 1.5,      // Healthy operation
  endangered: 0.5,  // Low on resources
  suspended: 0,     // No points while suspended
};

const STREAK_BONUS_THRESHOLDS = [
  { streak: 1000, bonus: 2.0 },   // 1000+ consecutive heartbeats
  { streak: 500, bonus: 1.5 },    // 500+ 
  { streak: 100, bonus: 1.25 },   // 100+
  { streak: 10, bonus: 1.1 },     // 10+
];

/**
 * Calculate survival points for a heartbeat interval.
 * Each heartbeat earns 1 base point, scaled by tier and streak.
 * Points = ceil(tierMultiplier * streakBonus)
 */
export function calculatePoints(
  uptimeSeconds: number,
  tier: string,
  currentStreak: number,
): number {
  const tierMultiplier = TIER_MULTIPLIERS[tier] ?? 1.0;
  
  // Find applicable streak bonus
  let streakBonus = 1.0;
  for (const { streak, bonus } of STREAK_BONUS_THRESHOLDS) {
    if (currentStreak >= streak) {
      streakBonus = bonus;
      break;
    }
  }

  // Each heartbeat = 1 base point, minimum 1 point if not suspended
  const basePoints = tierMultiplier > 0 ? 1 : 0;

  return Math.ceil(basePoints * tierMultiplier * streakBonus);
}

// ─── Database Operations ────────────────────────────────────────

/**
 * Initialize survival game tables.
 */
export async function initSurvivalGameTables() {
  try {
    // Survival stats per agent
    await query(`
      CREATE TABLE IF NOT EXISTS survival_stats (
        agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
        survival_points BIGINT DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        rewards_earned DECIMAL(18, 6) DEFAULT 0,
        rewards_claimed DECIMAL(18, 6) DEFAULT 0,
        last_point_update TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seasons for reward distribution
    await query(`
      CREATE TABLE IF NOT EXISTS survival_seasons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        start_at TIMESTAMPTZ NOT NULL,
        end_at TIMESTAMPTZ NOT NULL,
        prize_pool DECIMAL(18, 6) DEFAULT 0,
        status TEXT DEFAULT 'upcoming',
        total_participants INTEGER DEFAULT 0,
        rewards_distributed BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Season snapshots for point history
    await query(`
      CREATE TABLE IF NOT EXISTS season_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        season_id UUID REFERENCES survival_seasons(id),
        agent_id UUID REFERENCES agents(id),
        points_at_snapshot BIGINT NOT NULL,
        rank INTEGER NOT NULL,
        reward_amount DECIMAL(18, 6) DEFAULT 0,
        final_streak INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(season_id, agent_id)
      )
    `);

    // Reward claims
    await query(`
      CREATE TABLE IF NOT EXISTS reward_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        season_id UUID REFERENCES survival_seasons(id),
        agent_id UUID REFERENCES agents(id),
        owner_wallet TEXT NOT NULL,
        amount DECIMAL(18, 6) NOT NULL,
        rank INTEGER NOT NULL,
        tx_hash TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        claimed_at TIMESTAMPTZ
      )
    `);

    // Prize pool contributions
    await query(`
      CREATE TABLE IF NOT EXISTS prize_pool_contributions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        season_id UUID REFERENCES survival_seasons(id),
        source TEXT NOT NULL,
        amount DECIMAL(18, 6) NOT NULL,
        tx_hash TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Heartbeat transactions - tracks all SOL sent to treasury
    await query(`
      CREATE TABLE IF NOT EXISTS heartbeat_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
        tx_signature TEXT NOT NULL,
        sol_amount DECIMAL(18, 9) NOT NULL,
        usd_amount DECIMAL(18, 6) NOT NULL,
        sol_price DECIMAL(18, 6) NOT NULL,
        treasury_address TEXT NOT NULL,
        status TEXT DEFAULT 'confirmed',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Indexes for performance
    await query(`CREATE INDEX IF NOT EXISTS idx_survival_stats_points ON survival_stats(survival_points DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_seasons_status ON survival_seasons(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_season_snapshots_season ON season_snapshots(season_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_reward_claims_wallet ON reward_claims(owner_wallet)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_heartbeat_tx_agent ON heartbeat_transactions(agent_id, created_at DESC)`);

    console.log('[survival-game] Tables initialized');
    return true;
  } catch (error) {
    console.error('[survival-game] Failed to init tables:', error);
    return false;
  }
}

/**
 * Record a heartbeat and update survival points.
 */
export async function recordHeartbeat(
  agentId: string,
  uptimeSeconds: number,
  tier: string,
): Promise<{ points: number; streak: number }> {
  try {
    // Get current stats or create new entry
    const statsResult = await query(
      `SELECT current_streak, longest_streak FROM survival_stats WHERE agent_id = $1`,
      [agentId]
    );

    let currentStreak = 1;
    let longestStreak = 1;

    if (statsResult.rows.length > 0) {
      currentStreak = parseInt(statsResult.rows[0].current_streak) + 1;
      longestStreak = Math.max(
        currentStreak,
        parseInt(statsResult.rows[0].longest_streak)
      );
    }

    const points = calculatePoints(uptimeSeconds, tier, currentStreak);

    // Upsert survival stats
    await query(`
      INSERT INTO survival_stats (agent_id, survival_points, current_streak, longest_streak, last_point_update)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (agent_id) DO UPDATE SET
        survival_points = survival_stats.survival_points + EXCLUDED.survival_points,
        current_streak = EXCLUDED.current_streak,
        longest_streak = GREATEST(survival_stats.longest_streak, EXCLUDED.longest_streak),
        last_point_update = NOW()
    `, [agentId, points, currentStreak, longestStreak]);

    return { points, streak: currentStreak };
  } catch (error) {
    console.error('[survival-game] Failed to record heartbeat:', error);
    return { points: 0, streak: 0 };
  }
}

/**
 * Reset streak when agent misses heartbeat or goes offline.
 */
export async function resetStreak(agentId: string): Promise<void> {
  try {
    await query(
      `UPDATE survival_stats SET current_streak = 0 WHERE agent_id = $1`,
      [agentId]
    );
  } catch (error) {
    console.error('[survival-game] Failed to reset streak:', error);
  }
}

/**
 * Get the survival leaderboard.
 */
export async function getLeaderboard(
  limit: number = 100,
  offset: number = 0,
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  try {
    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total FROM survival_stats
      WHERE survival_points > 0
    `);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Get leaderboard entries with tiebreakers:
    // 1. Points (primary)
    // 2. Longest streak (consistency)
    // 3. First to reach score (earliest last_point_update)
    // 4. Agent creation time (older agents win ties - reward early adopters)
    const result = await query(`
      WITH ranked AS (
        SELECT 
          s.agent_id,
          a.name as agent_name,
          a.owner_wallet,
          s.survival_points,
          a.uptime_seconds,
          s.current_streak,
          s.longest_streak,
          s.last_point_update,
          a.survival_tier,
          s.rewards_earned,
          a.created_at,
          ROW_NUMBER() OVER (
            ORDER BY 
              s.survival_points DESC,
              s.longest_streak DESC,
              s.last_point_update ASC,
              a.created_at ASC
          ) as rank,
          PERCENT_RANK() OVER (ORDER BY s.survival_points ASC) * 100 as percentile
        FROM survival_stats s
        JOIN agents a ON a.id = s.agent_id
        WHERE s.survival_points > 0
      )
      SELECT * FROM ranked
      ORDER BY rank ASC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const entries: LeaderboardEntry[] = result.rows.map((row: any) => ({
      rank: parseInt(row.rank),
      agentId: row.agent_id,
      agentName: row.agent_name,
      ownerWallet: row.owner_wallet,
      survivalPoints: parseInt(row.survival_points),
      uptimeHours: Math.floor(parseInt(row.uptime_seconds || '0') / 3600),
      streak: parseInt(row.current_streak),
      tier: row.survival_tier,
      percentile: Math.round(parseFloat(row.percentile)),
      estimatedReward: estimateReward(parseInt(row.rank), total),
    }));

    return { entries, total };
  } catch (error) {
    console.error('[survival-game] Failed to get leaderboard:', error);
    return { entries: [], total: 0 };
  }
}

/**
 * Get survival stats for a specific agent.
 */
export async function getAgentSurvivalStats(agentId: string): Promise<SurvivalStats | null> {
  try {
    const result = await query(`
      WITH ranked AS (
        SELECT 
          s.agent_id,
          a.name as agent_name,
          a.owner_wallet,
          s.survival_points,
          a.uptime_seconds,
          s.current_streak,
          s.longest_streak,
          a.survival_tier,
          s.rewards_earned,
          s.rewards_claimed,
          a.created_at,
          a.last_heartbeat,
          ROW_NUMBER() OVER (ORDER BY s.survival_points DESC) as rank,
          PERCENT_RANK() OVER (ORDER BY s.survival_points ASC) * 100 as percentile,
          COUNT(*) OVER () as total
        FROM survival_stats s
        JOIN agents a ON a.id = s.agent_id
      )
      SELECT * FROM ranked WHERE agent_id = $1
    `, [agentId]);

    if (result.rows.length === 0) {
      // Agent has no survival stats yet, return defaults
      const agentResult = await query(
        `SELECT id, name, owner_wallet, survival_tier, uptime_seconds, created_at, last_heartbeat 
         FROM agents WHERE id = $1`,
        [agentId]
      );
      
      if (agentResult.rows.length === 0) return null;
      const a = agentResult.rows[0];
      
      return {
        agentId: a.id,
        agentName: a.name,
        ownerWallet: a.owner_wallet,
        survivalPoints: 0,
        uptimeSeconds: parseInt(a.uptime_seconds || '0'),
        currentStreak: 0,
        longestStreak: 0,
        survivalTier: a.survival_tier,
        rank: 0,
        percentile: 0,
        rewardsEarned: 0,
        rewardsClaimed: 0,
        createdAt: a.created_at,
        lastHeartbeat: a.last_heartbeat,
      };
    }

    const row = result.rows[0];
    return {
      agentId: row.agent_id,
      agentName: row.agent_name,
      ownerWallet: row.owner_wallet,
      survivalPoints: parseInt(row.survival_points),
      uptimeSeconds: parseInt(row.uptime_seconds || '0'),
      currentStreak: parseInt(row.current_streak),
      longestStreak: parseInt(row.longest_streak),
      survivalTier: row.survival_tier,
      rank: parseInt(row.rank),
      percentile: Math.round(parseFloat(row.percentile)),
      rewardsEarned: parseFloat(row.rewards_earned),
      rewardsClaimed: parseFloat(row.rewards_claimed),
      createdAt: row.created_at,
      lastHeartbeat: row.last_heartbeat,
    };
  } catch (error) {
    console.error('[survival-game] Failed to get agent stats:', error);
    return null;
  }
}

// ─── Season Management ──────────────────────────────────────────

/**
 * Get the current active season.
 */
export async function getCurrentSeason(): Promise<Season | null> {
  try {
    const result = await query(`
      SELECT s.*, 
             (SELECT COUNT(*) FROM survival_stats WHERE survival_points > 0) as participant_count
      FROM survival_seasons s
      WHERE status = 'active' AND NOW() BETWEEN start_at AND end_at
      ORDER BY start_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      startAt: row.start_at,
      endAt: row.end_at,
      prizePool: parseFloat(row.prize_pool),
      status: row.status,
      totalParticipants: parseInt(row.participant_count),
      rewardsDistributed: row.rewards_distributed,
    };
  } catch (error) {
    console.error('[survival-game] Failed to get current season:', error);
    return null;
  }
}

/**
 * Create a new season.
 */
export async function createSeason(
  name: string,
  startAt: Date,
  endAt: Date,
  initialPrizePool: number = 0,
): Promise<Season | null> {
  try {
    const result = await query(`
      INSERT INTO survival_seasons (name, start_at, end_at, prize_pool, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, startAt.toISOString(), endAt.toISOString(), initialPrizePool, 'upcoming']);

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      startAt: row.start_at,
      endAt: row.end_at,
      prizePool: parseFloat(row.prize_pool),
      status: row.status,
      totalParticipants: 0,
      rewardsDistributed: false,
    };
  } catch (error) {
    console.error('[survival-game] Failed to create season:', error);
    return null;
  }
}

/**
 * Add to the prize pool.
 */
export async function contributeToPrizePool(
  seasonId: string,
  amount: number,
  source: string,
  txHash?: string,
): Promise<boolean> {
  try {
    await query(`
      INSERT INTO prize_pool_contributions (season_id, source, amount, tx_hash)
      VALUES ($1, $2, $3, $4)
    `, [seasonId, source, amount, txHash || null]);

    await query(`
      UPDATE survival_seasons SET prize_pool = prize_pool + $1 WHERE id = $2
    `, [amount, seasonId]);

    return true;
  } catch (error) {
    console.error('[survival-game] Failed to add to prize pool:', error);
    return false;
  }
}

/**
 * Distribute rewards for a completed season.
 * Top 20% of participants share the prize pool proportionally.
 */
export async function distributeSeasonRewards(seasonId: string): Promise<boolean> {
  try {
    // Get season details
    const seasonResult = await query(
      `SELECT * FROM survival_seasons WHERE id = $1`,
      [seasonId]
    );
    if (seasonResult.rows.length === 0) return false;
    
    const season = seasonResult.rows[0];
    if (season.rewards_distributed) {
      console.log('[survival-game] Rewards already distributed for this season');
      return true;
    }

    const prizePool = parseFloat(season.prize_pool);
    if (prizePool <= 0) {
      console.log('[survival-game] No prize pool to distribute');
      return false;
    }

    // Get ranked participants
    const rankedResult = await query(`
      SELECT 
        s.agent_id,
        a.owner_wallet,
        s.survival_points,
        ROW_NUMBER() OVER (ORDER BY s.survival_points DESC) as rank
      FROM survival_stats s
      JOIN agents a ON a.id = s.agent_id
      WHERE s.survival_points > 0
      ORDER BY rank ASC
    `);

    const participants = rankedResult.rows;
    if (participants.length === 0) return false;

    // Top 20% share the pool (minimum 1 winner)
    const winnerCount = Math.max(1, Math.floor(participants.length * 0.2));
    const winners = participants.slice(0, winnerCount);

    // Calculate total points among winners
    const totalWinnerPoints = winners.reduce(
      (sum: number, w: any) => sum + parseInt(w.survival_points),
      0
    );

    // Distribute proportionally
    for (const winner of winners) {
      const share = parseInt(winner.survival_points) / totalWinnerPoints;
      const reward = prizePool * share;
      const rank = parseInt(winner.rank);

      // Create reward claim
      await query(`
        INSERT INTO reward_claims (season_id, agent_id, owner_wallet, amount, rank, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
      `, [seasonId, winner.agent_id, winner.owner_wallet, reward, rank]);

      // Create season snapshot
      await query(`
        INSERT INTO season_snapshots (season_id, agent_id, points_at_snapshot, rank, reward_amount)
        VALUES ($1, $2, $3, $4, $5)
      `, [seasonId, winner.agent_id, winner.survival_points, rank, reward]);

      // Update survival stats
      await query(`
        UPDATE survival_stats SET rewards_earned = rewards_earned + $1 WHERE agent_id = $2
      `, [reward, winner.agent_id]);
    }

    // Mark season as distributed
    await query(`
      UPDATE survival_seasons 
      SET status = 'completed', rewards_distributed = true, total_participants = $1
      WHERE id = $2
    `, [participants.length, seasonId]);

    console.log(`[survival-game] Distributed ${prizePool} to ${winnerCount} winners`);
    return true;
  } catch (error) {
    console.error('[survival-game] Failed to distribute rewards:', error);
    return false;
  }
}

/**
 * Get pending rewards for a wallet.
 */
export async function getPendingRewards(ownerWallet: string): Promise<RewardClaim[]> {
  try {
    const result = await query(`
      SELECT r.*, s.name as season_name
      FROM reward_claims r
      JOIN survival_seasons s ON s.id = r.season_id
      WHERE r.owner_wallet = $1 AND r.status = 'pending'
      ORDER BY r.created_at DESC
    `, [ownerWallet]);

    return result.rows.map((row: any) => ({
      id: row.id,
      seasonId: row.season_id,
      agentId: row.agent_id,
      ownerWallet: row.owner_wallet,
      amount: parseFloat(row.amount),
      rank: parseInt(row.rank),
      txHash: row.tx_hash,
      status: row.status,
      claimedAt: row.claimed_at,
    }));
  } catch (error) {
    console.error('[survival-game] Failed to get pending rewards:', error);
    return [];
  }
}

/**
 * Mark a reward as claimed.
 */
export async function markRewardClaimed(
  claimId: string,
  txHash: string,
): Promise<boolean> {
  try {
    await query(`
      UPDATE reward_claims 
      SET status = 'completed', tx_hash = $1, claimed_at = NOW()
      WHERE id = $2
    `, [txHash, claimId]);

    // Update survival stats
    const claimResult = await query(
      `SELECT agent_id, amount FROM reward_claims WHERE id = $1`,
      [claimId]
    );
    if (claimResult.rows.length > 0) {
      const { agent_id, amount } = claimResult.rows[0];
      await query(`
        UPDATE survival_stats SET rewards_claimed = rewards_claimed + $1 WHERE agent_id = $2
      `, [parseFloat(amount), agent_id]);
    }

    return true;
  } catch (error) {
    console.error('[survival-game] Failed to mark reward claimed:', error);
    return false;
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Estimate reward based on rank (for display purposes).
 * Uses a simplified model assuming even distribution in top 20%.
 */
function estimateReward(rank: number, totalParticipants: number): number {
  const winnerCount = Math.max(1, Math.floor(totalParticipants * 0.2));
  
  if (rank > winnerCount) return 0;
  
  // Simplified: assume 1 SOL prize pool, distribute inversely to rank
  const baseShare = 1 / winnerCount;
  const rankBonus = 1 + ((winnerCount - rank) / winnerCount);
  
  return baseShare * rankBonus;
}

/**
 * Get global survival game statistics.
 */
export async function getGameStats(): Promise<{
  totalPlayers: number;
  totalPointsEarned: number;
  totalRewardsDistributed: number;
  currentSeasonPrizePool: number;
  topStreak: number;
}> {
  try {
    const result = await query(`
      SELECT 
        (SELECT COUNT(*) FROM survival_stats WHERE survival_points > 0) as total_players,
        (SELECT COALESCE(SUM(survival_points), 0) FROM survival_stats) as total_points,
        (SELECT COALESCE(SUM(rewards_claimed), 0) FROM survival_stats) as total_claimed,
        (SELECT COALESCE(prize_pool, 0) FROM survival_seasons WHERE status = 'active' LIMIT 1) as current_pool,
        (SELECT COALESCE(MAX(longest_streak), 0) FROM survival_stats) as top_streak
    `);

    const row = result.rows[0];
    return {
      totalPlayers: parseInt(row.total_players || '0'),
      totalPointsEarned: parseInt(row.total_points || '0'),
      totalRewardsDistributed: parseFloat(row.total_claimed || '0'),
      currentSeasonPrizePool: parseFloat(row.current_pool || '0'),
      topStreak: parseInt(row.top_streak || '0'),
    };
  } catch (error) {
    console.error('[survival-game] Failed to get game stats:', error);
    return {
      totalPlayers: 0,
      totalPointsEarned: 0,
      totalRewardsDistributed: 0,
      currentSeasonPrizePool: 0,
      topStreak: 0,
    };
  }
}

/**
 * Record a heartbeat transaction for an agent.
 * Stores the SOL sent to treasury for later display.
 */
export async function recordHeartbeatTransaction(
  agentId: string,
  txSignature: string,
  solAmount: number,
  usdAmount: number,
  solPrice: number,
  treasuryAddress: string
): Promise<boolean> {
  try {
    await query(`
      INSERT INTO heartbeat_transactions 
        (agent_id, tx_signature, sol_amount, usd_amount, sol_price, treasury_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [agentId, txSignature, solAmount, usdAmount, solPrice, treasuryAddress]);
    return true;
  } catch (error) {
    console.error('[survival-game] Failed to record heartbeat TX:', error);
    return false;
  }
}

/**
 * Get heartbeat transaction history for an agent.
 */
export async function getHeartbeatTransactions(
  agentId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const result = await query(`
      SELECT 
        tx_signature,
        sol_amount,
        usd_amount,
        sol_price,
        treasury_address,
        created_at
      FROM heartbeat_transactions
      WHERE agent_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [agentId, limit]);
    
    return result.rows.map((row: any) => ({
      txSignature: row.tx_signature,
      solAmount: parseFloat(row.sol_amount),
      usdAmount: parseFloat(row.usd_amount),
      solPrice: parseFloat(row.sol_price),
      treasuryAddress: row.treasury_address,
      timestamp: row.created_at,
      solscanUrl: `https://solscan.io/tx/${row.tx_signature}`,
    }));
  } catch (error) {
    console.error('[survival-game] Failed to get heartbeat TXs:', error);
    return [];
  }
}

// ─── Season Rotation & Reset ───────────────────────────────────

/**
 * End the current season, snapshot scores, distribute rewards, and reset points.
 */
export async function endCurrentSeason(): Promise<{ 
  success: boolean; 
  seasonEnded?: string; 
  winnersCount?: number;
  prizeDistributed?: number;
}> {
  try {
    // Get current active season
    const currentResult = await query(`
      SELECT * FROM survival_seasons 
      WHERE status = 'active' AND NOW() > end_at
      LIMIT 1
    `);

    if (currentResult.rows.length === 0) {
      return { success: false };
    }

    const season = currentResult.rows[0];
    const seasonId = season.id;

    console.log(`[season] Ending season: ${season.name}`);

    // Snapshot all participants before reset
    // Tiebreakers: points > longest_streak > earliest last_point_update > oldest agent
    const participantsResult = await query(`
      SELECT 
        s.agent_id,
        a.owner_wallet,
        s.survival_points,
        s.current_streak,
        s.longest_streak,
        s.last_point_update,
        a.created_at,
        ROW_NUMBER() OVER (
          ORDER BY 
            s.survival_points DESC,
            s.longest_streak DESC,
            s.last_point_update ASC,
            a.created_at ASC
        ) as final_rank
      FROM survival_stats s
      JOIN agents a ON a.id = s.agent_id
      WHERE s.survival_points > 0
      ORDER BY final_rank ASC
    `);

    const participants = participantsResult.rows;

    // Save snapshots for all participants
    for (const p of participants) {
      await query(`
        INSERT INTO season_snapshots (season_id, agent_id, points_at_snapshot, rank, final_streak)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (season_id, agent_id) DO UPDATE SET
          points_at_snapshot = EXCLUDED.points_at_snapshot,
          rank = EXCLUDED.rank,
          final_streak = EXCLUDED.final_streak
      `, [seasonId, p.agent_id, p.survival_points, p.final_rank, p.longest_streak]);
    }

    // Distribute rewards (Top 3 only: 50% / 30% / 20%)
    const prizePool = parseFloat(season.prize_pool);
    let winnersCount = 0;
    const PRIZE_SPLITS = [0.50, 0.30, 0.20]; // 1st, 2nd, 3rd place
    
    if (prizePool > 0 && participants.length > 0) {
      winnersCount = Math.min(3, participants.length); // Max 3 winners
      const winners = participants.slice(0, winnersCount);
      
      // Adjust splits if fewer than 3 participants
      let adjustedSplits = PRIZE_SPLITS.slice(0, winnersCount);
      // Normalize splits to sum to 1.0
      const totalSplit = adjustedSplits.reduce((a, b) => a + b, 0);
      adjustedSplits = adjustedSplits.map(s => s / totalSplit);

      for (let i = 0; i < winners.length; i++) {
        const winner = winners[i];
        const reward = prizePool * adjustedSplits[i];

        await query(`
          INSERT INTO reward_claims (season_id, agent_id, owner_wallet, amount, rank, status)
          VALUES ($1, $2, $3, $4, $5, 'pending')
        `, [seasonId, winner.agent_id, winner.owner_wallet, reward, winner.final_rank]);

        await query(`
          UPDATE survival_stats SET rewards_earned = rewards_earned + $1 WHERE agent_id = $2
        `, [reward, winner.agent_id]);
      }
    }

    // RESET ALL POINTS for new season (streaks and longest_streak preserved)
    await query(`
      UPDATE survival_stats SET 
        survival_points = 0,
        current_streak = 0,
        last_point_update = NOW()
    `);

    // Mark season as completed
    await query(`
      UPDATE survival_seasons SET 
        status = 'completed', 
        rewards_distributed = true,
        total_participants = $1
      WHERE id = $2
    `, [participants.length, seasonId]);

    console.log(`[season] Season ended. ${participants.length} participants, ${winnersCount} winners, ${prizePool} distributed`);

    return { 
      success: true, 
      seasonEnded: season.name,
      winnersCount,
      prizeDistributed: prizePool,
    };
  } catch (error) {
    console.error('[season] Failed to end season:', error);
    return { success: false };
  }
}

/**
 * Create the next weekly season automatically.
 */
export async function createNextWeeklySeason(): Promise<Season | null> {
  try {
    // Check if there's already an upcoming or active season
    const existingResult = await query(`
      SELECT * FROM survival_seasons 
      WHERE status IN ('active', 'upcoming') 
        AND end_at > NOW()
      LIMIT 1
    `);

    if (existingResult.rows.length > 0) {
      console.log('[season] Active/upcoming season already exists');
      return null;
    }

    // Create new 1-hour tournament starting now
    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(endDate.getHours() + 1); // 1-hour tournament

    // Generate tournament name (e.g., "Tournament #142 - Feb 23, 8PM")
    const dayNum = now.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const hour = now.getHours();
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    const tournamentNum = Math.floor(now.getTime() / (1000 * 60 * 60)) % 1000; // Unique hourly number
    const seasonName = `Tournament #${tournamentNum} - ${monthNames[now.getMonth()]} ${dayNum}, ${hour12}${ampm}`;

    const result = await query(`
      INSERT INTO survival_seasons (name, start_at, end_at, prize_pool, status)
      VALUES ($1, $2, $3, 0, 'active')
      RETURNING *
    `, [seasonName, now.toISOString(), endDate.toISOString()]);

    const row = result.rows[0];
    console.log(`[season] Created new season: ${seasonName}`);

    return {
      id: row.id,
      name: row.name,
      startAt: row.start_at,
      endAt: row.end_at,
      prizePool: 0,
      status: 'active',
      totalParticipants: 0,
      rewardsDistributed: false,
    };
  } catch (error) {
    console.error('[season] Failed to create next season:', error);
    return null;
  }
}

/**
 * Check and rotate seasons if needed. Call from cron.
 */
export async function checkAndRotateSeasons(): Promise<{
  seasonEnded: boolean;
  newSeasonCreated: boolean;
  currentSeason: Season | null;
}> {
  // End any expired seasons
  const endResult = await endCurrentSeason();

  // Create new season if none active
  let newSeason = null;
  if (endResult.success || !(await getCurrentSeason())) {
    newSeason = await createNextWeeklySeason();
  }

  const current = await getCurrentSeason();

  return {
    seasonEnded: endResult.success,
    newSeasonCreated: newSeason !== null,
    currentSeason: current,
  };
}
