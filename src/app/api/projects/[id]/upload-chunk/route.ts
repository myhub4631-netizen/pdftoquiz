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
    const { base64Chunk, chunkIndex = 0, totalChunks = 1 } = body;

    if (!base64Chunk) {
      return NextResponse.json({ success: false, error: 'No chunk provided' }, { status: 400 });
    }

    const chunkBuffer = Buffer.from(base64Chunk, 'base64');
    const supabase = createAdminClient();
    const project = await ProjectStore.getProject(id);
    const doc = await ProjectStore.getDocument(id);

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const userId = project.user_id;
    const chunkPath = `uploads/${userId}/${id}/chunks/chunk_${chunkIndex}.bin`;

    // Ensure bucket "documents" exists
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.some((b) => b.name === 'documents')) {
        await supabase.storage.createBucket('documents', {
          public: true,
          fileSizeLimit: 52428800,
          allowedMimeTypes: ['application/pdf', 'application/octet-stream'],
        });
      }
    } catch {}

    // Save individual chunk binary to Supabase Storage
    const { error: chunkUploadErr } = await supabase.storage
      .from('documents')
      .upload(chunkPath, chunkBuffer, { upsert: true, contentType: 'application/octet-stream' });

    if (chunkUploadErr) {
      console.warn(`[upload-chunk] Chunk ${chunkIndex} storage notice:`, chunkUploadErr.message);
    }

    // Also update in-memory cache for current instance
    ProjectStore.appendPdfChunk(id, chunkBuffer);

    // Check if this is the final chunk to assemble full PDF
    const isLastChunk = Number(chunkIndex) >= Number(totalChunks) - 1;
    let isComplete = false;

    if (isLastChunk) {
      const chunkBuffers: Buffer[] = [];
      let allChunksFound = true;

      // Attempt to download all chunks from Supabase Storage
      for (let i = 0; i < totalChunks; i++) {
        const cPath = `uploads/${userId}/${id}/chunks/chunk_${i}.bin`;
        const { data: cData, error: cErr } = await supabase.storage.from('documents').download(cPath);

        if (cData && !cErr) {
          const cBuf = Buffer.from(await cData.arrayBuffer());
          chunkBuffers.push(cBuf);
        } else {
          allChunksFound = false;
          break;
        }
      }

      // Fallback to in-memory buffer if storage chunks missing
      let fullPdfBuffer: Buffer | null = null;
      if (allChunksFound && chunkBuffers.length === Number(totalChunks)) {
        fullPdfBuffer = Buffer.concat(chunkBuffers);
      } else {
        fullPdfBuffer = ProjectStore.getPdfBuffer(id);
      }

      if (fullPdfBuffer && fullPdfBuffer.length > 0) {
        // Validate PDF header magic bytes (%PDF-)
        const headerStr = fullPdfBuffer.toString('utf8', 0, Math.min(fullPdfBuffer.length, 10));
        if (!headerStr.startsWith('%PDF-')) {
          console.warn(`[upload-chunk] Assembled buffer header mismatch: '${headerStr.slice(0, 5)}'`);
        }

        const canonicalPath = `uploads/${userId}/${id}/original.pdf`;

        // Store final canonical assembled PDF to Supabase Storage
        const { error: finalUploadErr } = await supabase.storage
          .from('documents')
          .upload(canonicalPath, fullPdfBuffer, { upsert: true, contentType: 'application/pdf' });

        if (finalUploadErr) {
          console.warn('[upload-chunk] Canonical PDF upload warning:', finalUploadErr.message);
        }

        // Cache in ProjectStore
        ProjectStore.savePdfBuffer(id, fullPdfBuffer);

        // Update document record in database with correct size and canonical path
        await ProjectStore.saveDocument(
          {
            id: doc?.id || crypto.randomUUID(),
            project_id: id,
            user_id: userId,
            file_name: doc?.file_name || `${project.name}.pdf`,
            file_size_bytes: fullPdfBuffer.length,
            mime_type: 'application/pdf',
            storage_path: canonicalPath,
            page_count: 0,
            created_at: new Date().toISOString(),
          },
          supabase
        );

        // Clean up temporary chunk files
        const chunkPathsToDelete = Array.from({ length: totalChunks }, (_, i) => `uploads/${userId}/${id}/chunks/chunk_${i}.bin`);
        try {
          await supabase.storage.from('documents').remove(chunkPathsToDelete);
        } catch {}

        isComplete = true;
      }
    }

    return NextResponse.json({
      success: true,
      projectId: id,
      chunkIndex,
      totalChunks,
      isComplete,
    });
  } catch (err: any) {
    console.error('[POST /api/projects/[id]/upload-chunk] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Chunk upload failed' }, { status: 500 });
  }
}
