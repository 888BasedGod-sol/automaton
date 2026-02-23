/**
 * Deployment Stage Update API
 * 
 * POST /api/deployments/update - Update deployment stage
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  updateDeploymentStage, 
  getDeploymentStatus,
  initDeploymentTables,
  type DeploymentStage,
} from '@/lib/deployments';

export const dynamic = 'force-dynamic';

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initDeploymentTables();
    initialized = true;
  }
}

const VALID_STAGES: DeploymentStage[] = [
  'created', 'funding', 'funded', 'provisioning', 
  'registering', 'registered', 'starting', 'running', 'failed'
];

export async function POST(request: NextRequest) {
  try {
    await ensureInit();

    const body = await request.json();
    const { agentId, stage, message, error, txHash, erc8004Id, sandboxId, metadata } = body;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'agentId is required' },
        { status: 400 }
      );
    }

    if (!stage || !VALID_STAGES.includes(stage)) {
      return NextResponse.json(
        { success: false, error: `Invalid stage. Valid stages: ${VALID_STAGES.join(', ')}` },
        { status: 400 }
      );
    }

    // Get current deployment
    const deployment = await getDeploymentStatus(agentId);

    if (!deployment) {
      return NextResponse.json(
        { success: false, error: 'No deployment found for this agent' },
        { status: 404 }
      );
    }

    // Get deployment ID from the query
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deploymentId');

    // We need to get the deployment ID from the database
    // For now, we'll query it
    const { query } = await import('@/lib/postgres');
    const result = await query(
      `SELECT id FROM deployments WHERE agent_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [agentId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Deployment record not found' },
        { status: 404 }
      );
    }

    const depId = deploymentId || result.rows[0].id;

    // Update the deployment stage
    await updateDeploymentStage(depId, stage as DeploymentStage, {
      message,
      error,
      txHash,
      erc8004Id,
      sandboxId,
      metadata,
    });

    // Get updated status
    const updatedStatus = await getDeploymentStatus(agentId);

    return NextResponse.json({
      success: true,
      deployment: updatedStatus,
    });
  } catch (error: any) {
    console.error('Deployment update error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
