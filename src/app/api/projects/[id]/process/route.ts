import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const origin = req.nextUrl.origin;

    // Trigger initiate-parse via internal HTTP call or proxy
    const initRes = await fetch(`${origin}/api/projects/${id}/initiate-parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await initRes.json();
    return NextResponse.json(data, { status: initRes.status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Process trigger failed' }, { status: 500 });
  }
}
