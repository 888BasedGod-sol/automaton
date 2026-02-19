import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * SPL Token Launch API
 * 
 * POST /api/tokens/launch
 * Body: { name, symbol, decimals, initialSupply, uri?, agentId }
 * 
 * This endpoint provides the interface for token launching.
 * Actual token creation requires agent's private key and is done server-side.
 */

interface TokenLaunchRequest {
  name: string;
  symbol: string;
  decimals?: number;
  initialSupply: number;
  uri?: string;
  agentId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TokenLaunchRequest = await request.json();
    const { name, symbol, decimals = 6, initialSupply, uri, agentId } = body;

    // Validate inputs
    if (!name || !symbol || !initialSupply || !agentId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, symbol, initialSupply, agentId' },
        { status: 400 }
      );
    }

    if (symbol.length > 10) {
      return NextResponse.json(
        { success: false, error: 'Symbol must be 10 characters or less' },
        { status: 400 }
      );
    }

    if (decimals < 0 || decimals > 9) {
      return NextResponse.json(
        { success: false, error: 'Decimals must be between 0 and 9' },
        { status: 400 }
      );
    }

    // For now, return a demo response
    // Full implementation requires:
    // 1. Fetch agent's Solana private key from database
    // 2. Create SPL token mint
    // 3. Create associated token account
    // 4. Mint initial supply
    // 5. Optionally upload metadata to IPFS/Arweave
    
    const demoMint = 'Demo' + Array.from({ length: 40 }, () => 
      '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 58)]
    ).join('');

    return NextResponse.json({
      success: true,
      token: {
        mint: demoMint,
        name,
        symbol,
        decimals,
        initialSupply,
        uri: uri || null,
        createdAt: new Date().toISOString(),
      },
      message: 'Token launch requires Solana mainnet integration. Demo token created.',
      instructions: [
        'To launch a real token, the agent needs:',
        '1. Sufficient SOL for rent (~0.002 SOL)',
        '2. Valid Solana keypair stored in database',
        '3. Metadata URI (optional, for token image/description)',
      ],
    });

  } catch (error: any) {
    console.error('Token launch error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Return token launch requirements
  return NextResponse.json({
    success: true,
    endpoint: '/api/tokens/launch',
    method: 'POST',
    requirements: {
      name: 'string - Token name (e.g., "My Agent Token")',
      symbol: 'string - Token symbol, max 10 chars (e.g., "MAT")',
      decimals: 'number - Optional, default 6',
      initialSupply: 'number - Initial token supply',
      uri: 'string - Optional metadata URI',
      agentId: 'string - Agent ID that will own the token',
    },
    fees: {
      rent: '~0.002 SOL for mint account',
      transaction: '~0.000005 SOL',
    },
    note: 'Full implementation requires agent private key access',
  });
}
