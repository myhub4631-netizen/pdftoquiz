import { NextRequest, NextResponse } from 'next/server';
import { ProjectStore } from '@/lib/projects/store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { base64Chunk } = body;

    if (!base64Chunk) {
      return NextResponse.json({ success: false, error: 'No chunk provided' }, { status: 400 });
    }

    const chunkBuffer = Buffer.from(base64Chunk, 'base64');
    ProjectStore.appendPdfChunk(id, chunkBuffer);

    const currentPdf = ProjectStore.getPdfBuffer(id);

    return NextResponse.json({
      success: true,
      projectId: id,
      receivedSize: chunkBuffer.length,
      totalSize: currentPdf ? currentPdf.length : chunkBuffer.length,
    });
  } catch (err: any) {
    console.error('[POST /api/projects/[id]/upload-chunk] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Chunk upload failed' }, { status: 500 });
  }
}
