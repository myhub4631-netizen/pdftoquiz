import { NextRequest, NextResponse } from 'next/server';
import { ProjectStore } from '@/lib/projects/store';
import { createAdminClient } from '@/lib/supabase/admin';

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

    // Save to Supabase Storage so all Vercel serverless function instances can access the PDF
    if (currentPdf) {
      try {
        const supabase = createAdminClient();
        const doc = await ProjectStore.getDocument(id);
        const storagePath = doc?.storage_path || `uploads/${id}/original.pdf`;

        await supabase.storage
          .from('documents')
          .upload(storagePath, currentPdf, { upsert: true, contentType: 'application/pdf' });
      } catch (storageErr) {
        console.warn('[upload-chunk] Storage upload notice:', storageErr);
      }
    }

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
