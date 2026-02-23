/**
 * Deployment Pipeline Tracking
 * 
 * Tracks the progress of agent deployment through multiple stages:
 * 1. Agent Created - Basic agent record in DB
 * 2. Wallet Funded - Received initial funding
 * 3. Sandbox Provisioning - Conway sandbox being created
 * 4. On-Chain Registration - ERC-8004 registration pending/complete
 * 5. Agent Started - Running and sending heartbeats
 */

import { query } from './postgres';

export type DeploymentStage = 
  | 'created'
  | 'funding'
  | 'funded'
  | 'provisioning'
  | 'registering'
  | 'registered'
  | 'starting'
  | 'running'
  | 'failed';

export interface DeploymentStatus {
  agentId: string;
  agentName: string;
  stage: DeploymentStage;
  progress: number; // 0-100
  message: string;
  error?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  txHash?: string;
  erc8004Id?: string;
  sandboxId?: string;
  estimatedTimeRemaining?: number; // seconds
}

export interface DeploymentEvent {
  id: string;
  deploymentId: string;
  stage: DeploymentStage;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

const STAGE_PROGRESS: Record<DeploymentStage, number> = {
  created: 10,
  funding: 20,
  funded: 30,
  provisioning: 50,
  registering: 70,
  registered: 80,
  starting: 90,
  running: 100,
  failed: -1,
};

const STAGE_MESSAGES: Record<DeploymentStage, string> = {
  created: 'Agent created, awaiting funding',
  funding: 'Processing funding transaction',
  funded: 'Funding confirmed, preparing sandbox',
  provisioning: 'Provisioning compute sandbox',
  registering: 'Registering on-chain identity',
  registered: 'On-chain registration complete',
  starting: 'Starting agent runtime',
  running: 'Agent is live and earning points!',
  failed: 'Deployment failed',
};

/**
 * Initialize deployment tracking tables
 */
export async function initDeploymentTables() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS deployments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        stage TEXT NOT NULL DEFAULT 'created',
        progress INTEGER DEFAULT 10,
        message TEXT,
        error TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        tx_hash TEXT,
        erc8004_id TEXT,
        sandbox_id TEXT,
        metadata JSONB DEFAULT '{}'
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS deployment_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
        stage TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        metadata JSONB DEFAULT '{}'
      )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_deployments_agent ON deployments(agent_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_deployments_stage ON deployments(stage)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_deployment_events_deployment ON deployment_events(deployment_id)`);

    return true;
  } catch (error) {
    console.error('[deployments] Failed to init tables:', error);
    return false;
  }
}

/**
 * Create a new deployment tracking record
 */
export async function createDeployment(agentId: string): Promise<string> {
  const result = await query(`
    INSERT INTO deployments (agent_id, stage, progress, message)
    VALUES ($1, 'created', 10, $2)
    RETURNING id
  `, [agentId, STAGE_MESSAGES.created]);

  const deploymentId = result.rows[0].id;

  // Log first event
  await logDeploymentEvent(deploymentId, 'created', 'Deployment initiated');

  return deploymentId;
}

/**
 * Update deployment stage
 */
export async function updateDeploymentStage(
  deploymentId: string,
  stage: DeploymentStage,
  extraData?: {
    message?: string;
    error?: string;
    txHash?: string;
    erc8004Id?: string;
    sandboxId?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const progress = STAGE_PROGRESS[stage];
  const message = extraData?.message || STAGE_MESSAGES[stage];
  const isComplete = stage === 'running' || stage === 'failed';

  await query(`
    UPDATE deployments SET
      stage = $1,
      progress = $2,
      message = $3,
      error = $4,
      tx_hash = COALESCE($5, tx_hash),
      erc8004_id = COALESCE($6, erc8004_id),
      sandbox_id = COALESCE($7, sandbox_id),
      metadata = deployments.metadata || COALESCE($8, '{}')::jsonb,
      updated_at = NOW(),
      completed_at = CASE WHEN $9 THEN NOW() ELSE completed_at END
    WHERE id = $10
  `, [
    stage,
    progress,
    message,
    extraData?.error || null,
    extraData?.txHash || null,
    extraData?.erc8004Id || null,
    extraData?.sandboxId || null,
    JSON.stringify(extraData?.metadata || {}),
    isComplete,
    deploymentId,
  ]);

  // Log event
  await logDeploymentEvent(deploymentId, stage, message, extraData?.metadata);
}

/**
 * Log a deployment event
 */
export async function logDeploymentEvent(
  deploymentId: string,
  stage: DeploymentStage,
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  await query(`
    INSERT INTO deployment_events (deployment_id, stage, message, metadata)
    VALUES ($1, $2, $3, $4)
  `, [deploymentId, stage, message, JSON.stringify(metadata || {})]);
}

/**
 * Get deployment status for an agent
 */
export async function getDeploymentStatus(agentId: string): Promise<DeploymentStatus | null> {
  const result = await query(`
    SELECT d.*, a.name as agent_name
    FROM deployments d
    JOIN agents a ON a.id = d.agent_id
    WHERE d.agent_id = $1
    ORDER BY d.started_at DESC
    LIMIT 1
  `, [agentId]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    agentId: row.agent_id,
    agentName: row.agent_name,
    stage: row.stage as DeploymentStage,
    progress: parseInt(row.progress),
    message: row.message,
    error: row.error,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    txHash: row.tx_hash,
    erc8004Id: row.erc8004_id,
    sandboxId: row.sandbox_id,
  };
}

/**
 * Get deployment events timeline
 */
export async function getDeploymentEvents(deploymentId: string): Promise<DeploymentEvent[]> {
  const result = await query(`
    SELECT id, deployment_id, stage, message, timestamp, metadata
    FROM deployment_events
    WHERE deployment_id = $1
    ORDER BY timestamp ASC
  `, [deploymentId]);

  return result.rows.map((row: any) => ({
    id: row.id,
    deploymentId: row.deployment_id,
    stage: row.stage as DeploymentStage,
    message: row.message,
    timestamp: row.timestamp,
    metadata: row.metadata,
  }));
}

/**
 * Get all active (in-progress) deployments
 */
export async function getActiveDeployments(): Promise<DeploymentStatus[]> {
  const result = await query(`
    SELECT d.*, a.name as agent_name
    FROM deployments d
    JOIN agents a ON a.id = d.agent_id
    WHERE d.stage NOT IN ('running', 'failed')
    ORDER BY d.started_at DESC
    LIMIT 50
  `);

  return result.rows.map((row: any) => ({
    agentId: row.agent_id,
    agentName: row.agent_name,
    stage: row.stage as DeploymentStage,
    progress: parseInt(row.progress),
    message: row.message,
    error: row.error,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    txHash: row.tx_hash,
    erc8004Id: row.erc8004_id,
    sandboxId: row.sandbox_id,
  }));
}

/**
 * Get the active deployment for a specific agent (most recent non-terminal deployment)
 */
export async function getActiveDeployment(agentId: string): Promise<DeploymentStatus | null> {
  const result = await query(`
    SELECT d.*, a.name as agent_name
    FROM deployments d
    JOIN agents a ON a.id = d.agent_id
    WHERE d.agent_id = $1
      AND d.stage NOT IN ('running', 'failed')
    ORDER BY d.started_at DESC
    LIMIT 1
  `, [agentId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    agentId: row.agent_id,
    agentName: row.agent_name,
    stage: row.stage as DeploymentStage,
    progress: parseInt(row.progress),
    message: row.message,
    error: row.error,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    txHash: row.tx_hash,
    erc8004Id: row.erc8004_id,
    sandboxId: row.sandbox_id,
  };
}

/**
 * Get recent deployments (completed and active)
 */
export async function getRecentDeployments(limit: number = 20): Promise<DeploymentStatus[]> {
  const result = await query(`
    SELECT d.*, a.name as agent_name
    FROM deployments d
    JOIN agents a ON a.id = d.agent_id
    ORDER BY d.started_at DESC
    LIMIT $1
  `, [limit]);

  return result.rows.map((row: any) => ({
    agentId: row.agent_id,
    agentName: row.agent_name,
    stage: row.stage as DeploymentStage,
    progress: parseInt(row.progress),
    message: row.message,
    error: row.error,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    txHash: row.tx_hash,
    erc8004Id: row.erc8004_id,
    sandboxId: row.sandbox_id,
  }));
}

/**
 * Get deployment by ID
 */
export async function getDeploymentById(deploymentId: string): Promise<DeploymentStatus | null> {
  const result = await query(`
    SELECT d.*, a.name as agent_name
    FROM deployments d
    JOIN agents a ON a.id = d.agent_id
    WHERE d.id = $1
  `, [deploymentId]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    agentId: row.agent_id,
    agentName: row.agent_name,
    stage: row.stage as DeploymentStage,
    progress: parseInt(row.progress),
    message: row.message,
    error: row.error,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    txHash: row.tx_hash,
    erc8004Id: row.erc8004_id,
    sandboxId: row.sandbox_id,
  };
}
