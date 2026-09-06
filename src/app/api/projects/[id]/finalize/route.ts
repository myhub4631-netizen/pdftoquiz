import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ExcelGenerator } from '@/lib/excel/generator';
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

    const doc = await ProjectStore.getDocument(id);

    if (!doc) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
    }

    // 2. Query document_pages and check all page statuses
    let pageRows: any[] = [];
    try {
      const { data } = await supabase
        .from('document_pages')
        .select('*')
        .eq('document_id', doc.id)
        .order('page_number', { ascending: true });
      pageRows = data || [];
    } catch {
      pageRows = [];
    }

    const pages = pageRows || [];
    const incompletePages = pages.filter((p) => {
      const meta = PageJobManager.parsePageMetadata(p);
      return meta.status !== 'COMPLETED';
    });

    if (incompletePages.length > 0) {
      const failedCount = pages.filter((p) => PageJobManager.parsePageMetadata(p).status === 'FAILED').length;
      return NextResponse.json(
        {
          success: false,
          error: `Cannot finalize: ${incompletePages.length} page(s) are not completed (${failedCount} failed).`,
          incompletePagesCount: incompletePages.length,
          failedPagesCount: failedCount,
        },
        { status: 400 }
      );
    }

    // 3. Fetch all extracted questions with options and images
    let questionsList: any[] = [];
    try {
      const { data: questionsData } = await supabase
        .from('questions')
        .select(`
          *,
          options:question_options(*),
          images:question_images(*)
        `)
        .eq('project_id', id)
        .order('question_number', { ascending: true });
      questionsList = questionsData || [];
    } catch {
      questionsList = [];
    }

    const totalDetectedQuestions = questionsList.length || project.extracted_questions || 0;
    const expectedQuestions = project.expected_questions || 180;
    const needsReviewCount = questionsList.filter((q) => q.needs_review).length || project.needs_review_count || 0;

    // Validation: If expected questions = 180 and detected = 178, mark project NEEDS_REVIEW
    const finalStatus = totalDetectedQuestions < expectedQuestions || needsReviewCount > 0
      ? 'NEEDS_REVIEW'
      : 'COMPLETED';

    // 4. Collect image buffers for embedding into Excel workbook
    const imageBuffersMap = new Map<string, { buffer: Buffer; extension: 'png' | 'jpeg' | 'gif' }>();

    for (const q of questionsList) {
      if (q.images && Array.isArray(q.images)) {
        for (const img of q.images) {
          const imgKey = img.storage_path_optimized || img.storage_path_original;
          if (imgKey && imgKey.startsWith('data:image/')) {
            try {
              const base64Content = imgKey.split(',')[1];
              if (base64Content) {
                const buf = Buffer.from(base64Content, 'base64');
                const ext = img.optimized_format === 'jpeg' || img.optimized_format === 'jpg' ? 'jpeg' : 'png';
                imageBuffersMap.set(imgKey, { buffer: buf, extension: ext as any });
              }
            } catch (err) {
              console.warn('[finalize] Image buffer parse notice:', err);
            }
          }
        }
      }
    }

    // 5. Generate 3-sheet Excel Workbook (Questions, Metadata, Extraction Report)
    const xlsxBuffer = await ExcelGenerator.generateWorkbook({
      project: project as any,
      questions: questionsList as any,
      imageBuffers: imageBuffersMap,
    });

    // 6. Save XLSX to Supabase Storage bucket 'exports'
    const fileName = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Questions.xlsx`;
    const storagePath = `exports/${project.user_id}/${id}/${Date.now()}_${fileName}`;
    let savedStoragePath = storagePath;

    try {
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('exports')
        .upload(storagePath, xlsxBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true,
        });

      if (uploadData?.path) {
        savedStoragePath = uploadData.path;
      } else if (uploadErr) {
        console.warn('[finalize] Supabase storage upload warning:', uploadErr.message);
      }
    } catch (stErr: any) {
      console.warn('[finalize] Supabase storage upload notice:', stErr?.message);
    }

    // 7. Create Exports Record
    const totalImagesCount = questionsList.reduce((acc, q) => acc + (q.images?.length || 0), 0);
    let exportRecordId = `exp-${id}`;

    try {
      const { data: exportRecord } = await supabase
        .from('exports')
        .insert({
          project_id: id,
          user_id: project.user_id,
          file_name: fileName,
          storage_path: savedStoragePath,
          file_size_bytes: xlsxBuffer.length,
          format: 'XLSX',
          question_count: totalDetectedQuestions,
          images_count: totalImagesCount,
          download_count: 0,
        })
        .select()
        .single();
      if (exportRecord?.id) exportRecordId = exportRecord.id;
    } catch (e) {
      // Continue
    }

    // 8. Update Project Status to COMPLETED or NEEDS_REVIEW
    await ProjectStore.updateProject(id, {
      status: finalStatus,
      total_questions: totalDetectedQuestions,
      extracted_questions: totalDetectedQuestions,
      needs_review_count: needsReviewCount,
    });

    return NextResponse.json({
      success: true,
      projectId: id,
      status: finalStatus,
      totalQuestions: totalDetectedQuestions,
      expectedQuestions,
      needsReviewCount,
      exportId: exportRecordId,
      exportFileName: fileName,
      message: `Project finalized successfully with status ${finalStatus}`,
    });
  } catch (err: any) {
    console.error('[finalize] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Finalize project failed' }, { status: 500 });
  }
}
