/**
 * Deployment Status API
 * 
 * GET /api/deployments - Get recent/active deployments
 * GET /api/deployments?agentId=xxx - Get deployment for specific agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getDeploymentStatus, 
  getActiveDeployments,
  getRecentDeployments,
  getDeploymentById,
  getDeploymentEvents,
  initDeploymentTables,
} from '@/lib/deployments';

export const dynamic = 'force-dynamic';

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initDeploymentTables();
    initialized = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureInit();

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const deploymentId = searchParams.get('deploymentId');
    const activeOnly = searchParams.get('active') === 'true';
    const withEvents = searchParams.get('events') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get specific deployment by ID
    if (deploymentId) {
      const deployment = await getDeploymentById(deploymentId);
      
      if (!deployment) {
        return NextResponse.json(
          { success: false, error: 'Deployment not found' },
          { status: 404 }
        );
      }

      let events = undefined;
      if (withEvents) {
        events = await getDeploymentEvents(deploymentId);
      }

      return NextResponse.json({
        success: true,
        deployment,
        events,
      });
    }

    // Get deployment for specific agent
    if (agentId) {
      const deployment = await getDeploymentStatus(agentId);
      
      return NextResponse.json({
        success: true,
        deployment,
        hasDeployment: !!deployment,
      });
    }

    // Get active or recent deployments
    const deployments = activeOnly 
      ? await getActiveDeployments()
      : await getRecentDeployments(limit);

    return NextResponse.json({
      success: true,
      deployments,
      count: deployments.length,
    });
  } catch (error: any) {
    console.error('Deployments API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
