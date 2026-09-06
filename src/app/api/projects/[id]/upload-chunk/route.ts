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
        const project = await ProjectStore.getProject(id);
        const doc = await ProjectStore.getDocument(id);
        const userId = project?.user_id || doc?.user_id || 'user';
        const storagePath = doc?.storage_path || `uploads/${userId}/${id}/original.pdf`;

        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(storagePath, currentPdf, { upsert: true, contentType: 'application/pdf' });

        if (uploadErr) {
          console.warn('[upload-chunk] Storage upload warning:', uploadErr.message);
        }
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
