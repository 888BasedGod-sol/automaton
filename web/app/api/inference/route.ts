/**
 * Agent Inference API - Conway Model
 * 
 * POST /api/inference
 * 
 * Proxies inference requests to Conway API while deducting credits
 * from the agent's internal balance. This follows the Conway model
 * where agents pay for their own thinking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentWithKeys, updateAgentCredits, isPostgresConfigured } from '@/lib/postgres';
import { calculateInferenceCost, getSurvivalTierFromCredits } from '@/lib/compute-payment';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow up to 2 minutes for inference

const CONWAY_API_URL = process.env.CONWAY_API_URL || 'https://api.conway.tech';
const CONWAY_API_KEY = process.env.CONWAY_API_KEY || '';

// Low compute models for endangered/suspended agents
const LOW_COMPUTE_MODELS = ['gpt-4o-mini', 'gpt-4.1-mini'];
const DEFAULT_LOW_COMPUTE_MODEL = 'gpt-4o-mini';

interface InferenceRequest {
  agentId: string;
  model?: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  maxTokens?: number;
  temperature?: number;
  tools?: any[];
}

/**
 * POST /api/inference
 * 
 * Make inference request on behalf of agent, deducting credits
 */
export async function POST(request: NextRequest) {
  try {
    const body: InferenceRequest = await request.json();
    const { agentId, messages, maxTokens = 4096, temperature, tools } = body;
    let { model = 'claude-sonnet-4-20250514' } = body;

    if (!agentId || !messages || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing agentId or messages' },
        { status: 400 }
      );
    }

    if (!CONWAY_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Conway API not configured' },
        { status: 500 }
      );
    }

    if (!isPostgresConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Get agent and check credits
    const agent = await getAgentWithKeys(agentId);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    const creditsBalance = agent.credits_balance || 0;
    const tier = getSurvivalTierFromCredits(creditsBalance);

    // Conway model: Cannot make inference if suspended (no credits)
    if (tier === 'suspended') {
      return NextResponse.json({
        success: false,
        error: 'Insufficient credits. Agent is suspended. Pay SOL to treasury to add credits.',
        creditsBalance,
        survivalTier: tier,
      }, { status: 402 }); // Payment Required
    }

    // Conway model: Downgrade to cheaper model if endangered
    if (tier === 'endangered' && !LOW_COMPUTE_MODELS.includes(model)) {
      console.log(`[inference] Agent ${agentId} endangered - downgrading model from ${model} to ${DEFAULT_LOW_COMPUTE_MODEL}`);
      model = DEFAULT_LOW_COMPUTE_MODEL;
    }

    // Estimate credits needed (we'll adjust after actual usage)
    const estimatedTokens = messages.reduce((sum, m) => sum + m.content.length / 4, 0) + maxTokens;
    const estimatedCost = calculateInferenceCost(model, estimatedTokens);

    // Check if can afford estimated cost
    if (creditsBalance < estimatedCost) {
      return NextResponse.json({
        success: false,
        error: `Insufficient credits. Have: ${creditsBalance}, Need: ~${estimatedCost}`,
        creditsBalance,
        estimatedCost,
        survivalTier: tier,
      }, { status: 402 });
    }

    // Make request to Conway API
    const conwayBody: Record<string, any> = {
      model,
      messages,
      stream: false,
    };

    // Handle token limits based on model
    const usesCompletionTokens = /^(o[1-9]|gpt-5|gpt-4\.1)/.test(model);
    if (usesCompletionTokens) {
      conwayBody.max_completion_tokens = maxTokens;
    } else {
      conwayBody.max_tokens = maxTokens;
    }

    if (temperature !== undefined) {
      conwayBody.temperature = temperature;
    }

    if (tools && tools.length > 0) {
      conwayBody.tools = tools;
      conwayBody.tool_choice = 'auto';
    }

    const conwayResp = await fetch(`${CONWAY_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': CONWAY_API_KEY,
      },
      body: JSON.stringify(conwayBody),
    });

    if (!conwayResp.ok) {
      const errText = await conwayResp.text();
      console.error(`[inference] Conway API error: ${conwayResp.status} - ${errText}`);
      return NextResponse.json(
        { success: false, error: `Inference failed: ${conwayResp.status}` },
        { status: conwayResp.status }
      );
    }

    const data = await conwayResp.json();
    
    // Calculate actual cost from usage
    const usage = data.usage || {};
    const totalTokens = usage.total_tokens || estimatedTokens;
    const actualCost = calculateInferenceCost(model, totalTokens);

    // Deduct credits (negative amount)
    await updateAgentCredits(agentId, -actualCost);

    const newBalance = creditsBalance - actualCost;
    const newTier = getSurvivalTierFromCredits(newBalance);

    console.log(`[inference] Agent ${agentId} | Model: ${model} | Tokens: ${totalTokens} | Cost: ${actualCost} cents | Balance: ${newBalance} cents | Tier: ${newTier}`);

    // Return completion with billing info
    return NextResponse.json({
      success: true,
      completion: data,
      billing: {
        model,
        tokensUsed: totalTokens,
        costCents: actualCost,
        creditsRemaining: newBalance,
        survivalTier: newTier,
      }
    });

  } catch (error: any) {
    console.error('[inference] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Inference failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inference?agentId=xxx
 * 
 * Get inference capability status for agent
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Missing agentId parameter' },
        { status: 400 }
      );
    }

    if (!isPostgresConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 500 }
      );
    }

    const agent = await getAgentWithKeys(agentId);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    const creditsBalance = agent.credits_balance || 0;
    const tier = getSurvivalTierFromCredits(creditsBalance);
    const runtimeHours = Math.floor(creditsBalance / 50);

    // Determine available models based on tier
    let availableModels: string[];
    switch (tier) {
      case 'thriving':
        availableModels = ['claude-sonnet-4-20250514', 'gpt-4.1', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4o-mini'];
        break;
      case 'normal':
        availableModels = ['claude-sonnet-4-20250514', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4o-mini'];
        break;
      case 'endangered':
        availableModels = ['gpt-4.1-mini', 'gpt-4o-mini'];
        break;
      default:
        availableModels = [];
    }

    return NextResponse.json({
      success: true,
      agentId,
      credits: {
        balance: creditsBalance,
        survivalTier: tier,
        runtimeHoursRemaining: runtimeHours,
      },
      inference: {
        canMakeRequests: tier !== 'suspended',
        availableModels,
        recommendedModel: tier === 'endangered' ? 'gpt-4o-mini' : 'claude-sonnet-4-20250514',
      },
      conwayConfigured: !!CONWAY_API_KEY,
    });

  } catch (error: any) {
    console.error('[inference] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get inference status' },
      { status: 500 }
    );
  }
}
