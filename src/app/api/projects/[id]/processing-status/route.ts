import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageJobManager } from '@/lib/processing/page-job-manager';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // 1. Fetch Project
    const { data: project, error: pErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (pErr || !project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const { data: doc } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', id)
      .limit(1)
      .maybeSingle();

    if (!doc) {
      return NextResponse.json({
        success: true,
        projectId: id,
        projectStatus: project.status,
        totalPages: 0,
        completedPages: 0,
        processingPages: 0,
        queuedPages: 0,
        failedPages: 0,
        progressPercentage: 0,
        totalQuestionsDetected: project.extracted_questions || 0,
        totalImagesDetected: 0,
        firstIncompletePage: null,
        pages: [],
      });
    }

    // 2. Fetch all document_pages records
    const { data: pageRows } = await supabase
      .from('document_pages')
      .select('*')
      .eq('document_id', doc.id)
      .order('page_number', { ascending: true });

    const rawPages = pageRows || [];
    const totalPages = rawPages.length || doc.page_count || 1;

    let completedPages = 0;
    let processingPages = 0;
    let queuedPages = 0;
    let failedPages = 0;
    let totalQuestionsDetected = 0;
    let totalImagesDetected = 0;
    let firstIncompletePage: number | null = null;

    const pageMatrix = rawPages.map((p) => {
      const meta = PageJobManager.parsePageMetadata(p);

      if (meta.status === 'COMPLETED') {
        completedPages++;
        totalQuestionsDetected += meta.questions_count;
        totalImagesDetected += meta.images_count;
      } else if (meta.status === 'PROCESSING') {
        processingPages++;
      } else if (meta.status === 'FAILED') {
        failedPages++;
      } else {
        queuedPages++;
      }

      if (meta.status !== 'COMPLETED' && firstIncompletePage === null) {
        firstIncompletePage = p.page_number;
      }

      return {
        pageNumber: p.page_number,
        status: meta.status,
        questionsCount: meta.questions_count,
        imagesCount: meta.images_count,
        errorMessage: meta.error_message,
        processedAt: meta.processed_at,
      };
    });

    const progressPercentage = totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;

    return NextResponse.json({
      success: true,
      projectId: id,
      projectStatus: project.status,
      expectedQuestions: project.expected_questions || 180,
      totalPages,
      completedPages,
      processingPages,
      queuedPages,
      failedPages,
      progressPercentage,
      totalQuestionsDetected,
      totalImagesDetected,
      firstIncompletePage,
      pages: pageMatrix,
    });
  } catch (err: any) {
    console.error('[processing-status] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to fetch status' }, { status: 500 });
  }
}
