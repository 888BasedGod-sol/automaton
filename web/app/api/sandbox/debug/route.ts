import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CONWAY_API_URL = process.env.CONWAY_API_URL || 'https://api.conway.tech';
const CONWAY_API_KEY = process.env.CONWAY_API_KEY || '';

export async function GET() {
  const results: Record<string, unknown> = {
    conway_api_url: CONWAY_API_URL,
    api_key_set: !!CONWAY_API_KEY,
    api_key_length: CONWAY_API_KEY.length,
    api_key_prefix: CONWAY_API_KEY.slice(0, 10) + '...',
  };

  if (!CONWAY_API_KEY) {
    return NextResponse.json({
      ...results,
      error: 'CONWAY_API_KEY not configured',
    });
  }

  try {
    // List sandboxes
    const listResp = await fetch(`${CONWAY_API_URL}/v1/sandboxes`, {
      headers: {
        'Authorization': CONWAY_API_KEY,
        'X-API-Key': CONWAY_API_KEY,
      },
    });

    results.list_status = listResp.status;
    results.list_ok = listResp.ok;

    const text = await listResp.text();
    results.raw_response = text.slice(0, 500);

    if (listResp.ok) {
      try {
        const data = JSON.parse(text);
        const sandboxes = Array.isArray(data) ? data : data.sandboxes || [];
        results.sandbox_count = sandboxes.length;
        results.sandboxes = sandboxes.map((s: any) => ({
          id: s.id || s.sandbox_id,
          status: s.status,
          name: s.name,
          vcpu: s.vcpu,
          memory_mb: s.memory_mb,
        }));
      } catch (e) {
        results.parse_error = String(e);
      }
    }
  } catch (error) {
    results.fetch_error = String(error);
  }

  return NextResponse.json(results);
}
