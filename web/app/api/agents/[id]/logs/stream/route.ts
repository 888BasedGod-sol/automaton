
import { NextRequest } from 'next/server';
import { getAgentById } from '@/lib/postgres';

export const dynamic = 'force-dynamic';
// Vercel sometimes caches streaming responses unless we set this
export const runtime = 'nodejs'; 

// SSE Stream Handler
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  // Use a TransformStream for SSE
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Keep track of the last seen thought/timestamp to avoid duplicates
  let lastThought = '';

  const sendEvent = async (data: any) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch (e) {
      console.warn('Writer closed');
    }
  };

  // Start polling loop
  // Note: Vercel functions have a timeout (usually 10s-60s on hobby/pro)
  // The client will need to reconnect when the stream ends.
  const interval = setInterval(async () => {
    try {
      const agent = await getAgentById(id);
      if (agent && agent.last_thought && agent.last_thought !== lastThought) {
        lastThought = agent.last_thought;
        await sendEvent({
          type: 'log',
          content: agent.last_thought,
          timestamp: new Date().toISOString()
        });
      }
      
      // Send a heartbeat to keep connection alive
      await sendEvent({ type: 'heartbeat' }); 
    } catch (e) {
      console.error('Stream error:', e);
      try {
        await writer.close();
      } catch {}
      clearInterval(interval);
    }
  }, 2000); // Check every 2 seconds

  // Clean up on disconnect
  request.signal.addEventListener('abort', () => {
    clearInterval(interval);
    try {
      writer.close();
    } catch {}
  });

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
