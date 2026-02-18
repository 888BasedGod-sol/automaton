import { NextRequest, NextResponse } from 'next/server';
import { getAgentPublic, getAgent, updateAgentBalances, markAgentFunded, updateAgentStatus } from '@/lib/db';
import { getAgentBalances, hasMinimumFunding } from '@/lib/balances';
import path from 'path';
import fs from 'fs';

// Check if we're in serverless environment
const IS_SERVERLESS = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Lazy load better-sqlite3
let Database: typeof import('better-sqlite3') | null = null;
if (!IS_SERVERLESS) {
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    console.warn('[Agent API] better-sqlite3 not available');
  }
}

const POOL_DB = path.join(process.env.HOME || '/tmp', '.automaton', 'credit_pool.db');
const ACTIVITY_DB = path.join(process.env.HOME || '/tmp', '.automaton', 'activity.db');

function getAgentCredits(agentId: string): number | null {
  if (IS_SERVERLESS || !Database) return null; // No data in serverless
  try {
    if (!fs.existsSync(POOL_DB)) return null;
    const db = new Database(POOL_DB, { readonly: true });
    const row = db.prepare('SELECT allocated_cents, used_cents FROM allocations WHERE agent_id = ?').get(agentId) as any;
    db.close();
    return row ? row.allocated_cents - row.used_cents : null;
  } catch { return null; }
}

function getAgentStats(agentId: string): any {
  if (IS_SERVERLESS || !Database) return { followers: 0, following: 0, interactions: 0 }; // No data in serverless
  try {
    if (!fs.existsSync(ACTIVITY_DB)) return { followers: 0, following: 0, interactions: 0 };
    const db = new Database(ACTIVITY_DB, { readonly: true });
    const followers = db.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?').get(agentId) as any;
    const following = db.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').get(agentId) as any;
    const interactions = db.prepare('SELECT COUNT(*) as count FROM activities WHERE agent_id = ?').get(agentId) as any;
    db.close();
    return { followers: followers?.count || 0, following: following?.count || 0, interactions: interactions?.count || 0 };
  } catch { return { followers: 0, following: 0, interactions: 0 }; }
}

function getAgentActivity(agentId: string): any[] {
  if (IS_SERVERLESS || !Database) return []; // Empty in serverless
  try {
    if (!fs.existsSync(ACTIVITY_DB)) return [];
    const db = new Database(ACTIVITY_DB, { readonly: true });
    const activities = db.prepare('SELECT * FROM activities WHERE agent_id = ? ORDER BY created_at DESC LIMIT 20').all(agentId);
    db.close();
    return activities;
  } catch { return []; }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = getAgentPublic(params.id);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Enrich with social/activity data
    const creditsBalance = getAgentCredits(params.id);
    const stats = getAgentStats(params.id);
    const recentActivity = getAgentActivity(params.id);

    return NextResponse.json({
      success: true,
      agent: {
        ...agent,
        creditsBalance,
        stats,
        recentActivity,
      },
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

// Check and update balances
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { action } = body;

    const agent = getAgent(params.id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (action === 'check_balances') {
      // Fetch current balances
      const balances = await getAgentBalances(agent.solana_address, agent.evm_address);

      // Update database
      updateAgentBalances(agent.id, {
        sol_balance: balances.sol,
        usdc_balance: balances.solanaUsdc + balances.baseUsdc,
      });

      // Check if newly funded
      if (agent.status === 'pending_funding' && hasMinimumFunding(balances)) {
        markAgentFunded(agent.id);
      }

      const updatedAgent = getAgentPublic(agent.id);

      return NextResponse.json({
        success: true,
        balances,
        agent: updatedAgent,
        funded: hasMinimumFunding(balances),
      });
    }

    if (action === 'start') {
      // Only funded agents can be started
      if (agent.status !== 'funded') {
        return NextResponse.json(
          { error: 'Agent must be funded before starting' },
          { status: 400 }
        );
      }

      updateAgentStatus(agent.id, 'running');
      const updatedAgent = getAgentPublic(agent.id);

      return NextResponse.json({
        success: true,
        agent: updatedAgent,
        message: 'Agent started',
      });
    }

    if (action === 'stop') {
      updateAgentStatus(agent.id, 'stopped');
      const updatedAgent = getAgentPublic(agent.id);

      return NextResponse.json({
        success: true,
        agent: updatedAgent,
        message: 'Agent stopped',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing agent action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
