import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PDFExtractor } from '@/lib/pdf/extractor';
import { PageJobManager } from '@/lib/processing/page-job-manager';
import { ProjectStore } from '@/lib/projects/store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // 1. Fetch Project via ProjectStore
    const project = await ProjectStore.getProject(id);

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // 2. Fetch PDF Buffer
    const { buffer: pdfBuffer, fileName, docId } = await PageJobManager.getPdfBufferForProject(id);

    // 3. Validate PDF Binary Integrity
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF document buffer not found in Supabase Storage.');
    }

    const headerStr = pdfBuffer.toString('utf8', 0, Math.min(pdfBuffer.length, 10));
    if (!headerStr.startsWith('%PDF-')) {
      throw new Error(`Uploaded PDF in Supabase Storage is corrupted or incomplete. (Header: ${headerStr.slice(0, 5)})`);
    }

    // 4. Extract Page structure & raw text
    const pdfResult = await PDFExtractor.extractTextAndImagesFromBuffer(pdfBuffer);

    // 4. Ensure document record exists
    const documentRecord = await ProjectStore.saveDocument({
      id: docId,
      project_id: id,
      user_id: project.user_id,
      file_name: fileName,
      file_size_bytes: pdfBuffer.length,
      mime_type: 'application/pdf',
      storage_path: `uploads/${project.user_id}/${id}/original.pdf`,
      page_count: pdfResult.totalPages,
      extracted_text_size: pdfResult.fullText.length,
      created_at: new Date().toISOString(),
    });

    const targetDocId = documentRecord?.id || docId;

    // 5. Initialize/upsert document_pages with status QUEUED
    const initialPages = [];
    for (let i = 0; i < pdfResult.pages.length; i++) {
      const p = pdfResult.pages[i];
      const pageMeta = PageJobManager.encodePageMetadata({
        status: 'QUEUED',
        questions_count: 0,
        images_count: 0,
        error_message: null,
        processed_at: null,
      });

      initialPages.push({
        document_id: targetDocId,
        page_number: p.pageNumber,
        text_content: p.text || '',
        page_image_path: pageMeta,
        ocr_applied: false,
      });
    }

    // Delete old document pages if re-initiating
    try {
      await supabase.from('document_pages').delete().eq('document_id', targetDocId);
      await supabase.from('document_pages').insert(initialPages);
    } catch (e) {
      console.warn('[initiate-parse] Page insert notice:', e);
    }

    // 6. Update Project status to EXTRACTING & record page count
    await ProjectStore.updateProject(id, {
      status: 'EXTRACTING',
      total_pages: pdfResult.totalPages,
    });

    return NextResponse.json({
      success: true,
      projectId: id,
      documentId: targetDocId,
      totalPages: pdfResult.totalPages,
      expectedQuestions: project.expected_questions || 180,
      detectedQuestionCount: pdfResult.detectedQuestionCount || 0,
      message: 'PDF page parse initialized successfully',
    });
  } catch (err: any) {
    console.error('[initiate-parse] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Initiate parse failed' }, { status: 500 });
  }
}
