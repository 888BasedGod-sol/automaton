import { NextRequest, NextResponse } from 'next/server';
import { updateAgentThought, isPostgresConfigured, getAgentById } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { thought } = await request.json();

    if (!thought) {
      return NextResponse.json(
        { success: false, error: 'Missing thought' },
        { status: 400 }
      );
    }

    if (!isPostgresConfigured()) {
       return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Verify agent exists
    const agent = await getAgentById(id);
    if (!agent) {
       return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    const updated = await updateAgentThought(id, thought);
    if (!updated) {
        return NextResponse.json(
        { success: false, error: 'Failed to update' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating agent log:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
