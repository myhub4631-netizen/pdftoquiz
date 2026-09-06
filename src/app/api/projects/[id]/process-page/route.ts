import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PDFExtractor } from '@/lib/pdf/extractor';
import { ImageProcessor } from '@/lib/image/processor';
import { OpenRouterProvider } from '@/lib/ai/openrouter';
import { NEETSubjectDetector } from '@/lib/pdf/neet-detector';
import { PageJobManager, PageStatus } from '@/lib/processing/page-job-manager';
import { QuestionType } from '@/types/database';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const pageNumber = Number(body.pageNumber) || 1;
    const retry = Boolean(body.retry);

    const supabase = createAdminClient();
    const aiProvider = new OpenRouterProvider();

    // 1. Fetch Project & Document Details
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
      .single();

    if (!doc) {
      return NextResponse.json({ success: false, error: 'Document not found for project' }, { status: 404 });
    }

    // 2. Fetch page row from document_pages
    const { data: pageRow } = await supabase
      .from('document_pages')
      .select('*')
      .eq('document_id', doc.id)
      .eq('page_number', pageNumber)
      .single();

    const currentMeta = PageJobManager.parsePageMetadata(pageRow);

    // 3. IDEMPOTENCY CHECK
    // If page is already COMPLETED and user did not choose retry, return immediately without re-processing
    if (currentMeta.status === 'COMPLETED' && !retry) {
      return NextResponse.json({
        success: true,
        pageNumber,
        status: 'COMPLETED',
        questionsCount: currentMeta.questions_count,
        imagesCount: currentMeta.images_count,
        message: `Page ${pageNumber} is already COMPLETED`,
      });
    }

    // 4. LOCK PAGE STATUS TO 'PROCESSING'
    const processingMeta = PageJobManager.encodePageMetadata({
      status: 'PROCESSING',
      questions_count: currentMeta.questions_count,
      images_count: currentMeta.images_count,
      error_message: null,
      processed_at: new Date().toISOString(),
    });

    await supabase
      .from('document_pages')
      .update({ page_image_path: processingMeta })
      .eq('document_id', doc.id)
      .eq('page_number', pageNumber);

    try {
      // 5. Download PDF & Extract raw content for this specific page
      const { buffer: pdfBuffer } = await PageJobManager.getPdfBufferForProject(id);
      const pdfResult = await PDFExtractor.extractTextAndImagesFromBuffer(pdfBuffer);

      const pageData = pdfResult.pages.find((p) => p.pageNumber === pageNumber) || {
        pageNumber,
        text: pdfResult.fullText || '',
        questionBoundaries: [],
        images: [],
      };

      // Detect Subject Permutations/Routing
      const paperStructure = NEETSubjectDetector.analyzePaperStructure(
        pdfResult.fullText,
        project.expected_questions || 180,
        project.exam_type
      );

      // 6. Process Page Diagrams with Vision & Sharp
      const pageImages = pdfResult.extractedImages.filter((img) => img.pageNumber === pageNumber);
      const processedPageImages: any[] = [];

      const imageSettings = project.image_settings || {
        extract_images: true,
        compress_images: true,
        compression_level: 'High',
        convert_to_svg: false,
      };

      if (imageSettings.extract_images && pageImages.length > 0) {
        for (const rawImg of pageImages) {
          try {
            const processed = await ImageProcessor.processImage(rawImg.buffer, {
              compressionLevel: imageSettings.compression_level,
              convertToSvg: imageSettings.convert_to_svg,
            });

            // Perform Vision-capable AI analysis for diagram classification & option association
            let suggestedAssoc: 'question' | 'A' | 'B' | 'C' | 'D' = 'question';
            let imgType: any = 'diagram';

            try {
              const base64Data = rawImg.buffer.toString('base64');
              const visionResult = await aiProvider.analyzeQuestionImage(
                base64Data,
                pageData.text.slice(0, 500)
              );
              suggestedAssoc = visionResult.suggested_association;
              imgType = visionResult.image_type || 'diagram';
            } catch {
              // Context layout & coordinate fallback if vision call fails
              if (rawImg.associatedOptionLabel) {
                suggestedAssoc = rawImg.associatedOptionLabel;
                imgType = 'option_diagram';
              }
            }

            processedPageImages.push({
              rawImg,
              processed,
              suggestedAssoc,
              imgType,
            });
          } catch (imgErr) {
            console.warn(`[process-page] Image processing warning on page ${pageNumber}:`, imgErr);
          }
        }
      }

      // 7. AI Question Structuring via OpenRouter
      const pageQuestions: any[] = [];
      const imageHints = pageImages.map((img) => img.id);

      if (pageData.text && pageData.text.trim().length > 0) {
        try {
          const aiQuestions = await aiProvider.extractQuestionsFromChunk(
            pageData.text,
            pageNumber,
            project.exam_type,
            imageHints
          );

          if (aiQuestions.length > 0) {
            for (const q of aiQuestions) {
              const qNum = q.question_number || (pageQuestions.length + 1);
              const mappedSubject = NEETSubjectDetector.getSubjectForQuestion(
                qNum,
                paperStructure,
                q.question_text
              );

              pageQuestions.push({
                ...q,
                subject: q.subject && q.subject !== 'General' ? q.subject : mappedSubject,
                source_pages: [pageNumber],
              });
            }
          }
        } catch (aiErr: any) {
          console.warn(`[process-page] AI extraction fallback on page ${pageNumber}:`, aiErr?.message);
        }
      }

      // Fallback: Regex boundary segmenter if AI returned empty
      if (pageQuestions.length === 0 && pageData.questionBoundaries.length > 0) {
        for (const bound of pageData.questionBoundaries) {
          const seg = PDFExtractor.segmentQuestionAndOptions(bound.rawText);
          const mappedSubject = NEETSubjectDetector.getSubjectForQuestion(
            bound.questionNumber,
            paperStructure,
            seg.questionStatement
          );

          pageQuestions.push({
            question_number: bound.questionNumber,
            subject: mappedSubject,
            chapter: null,
            question_text: seg.questionStatement,
            options: seg.options,
            answer: null,
            question_type: 'single_correct',
            confidence: 75,
            needs_review: true,
            review_reason: 'Extracted via fallback pattern segmenter.',
            source_pages: [pageNumber],
          });
        }
      }

      // 8. Delete previous questions/options/images for this page to prevent duplicates on retry
      const { data: oldQs } = await supabase
        .from('questions')
        .select('id')
        .eq('project_id', id)
        .contains('source_pages', [pageNumber]);

      if (oldQs && oldQs.length > 0) {
        const oldIds = oldQs.map((q) => q.id);
        await supabase.from('questions').delete().in('id', oldIds);
      }

      // 9. Persist page questions, options, and images to Supabase database
      let insertedQCount = 0;
      let insertedImgCount = 0;

      for (let idx = 0; idx < pageQuestions.length; idx++) {
        const qData = pageQuestions[idx];
        const qNum = qData.question_number || (idx + 1);

        const { data: savedQ } = await supabase
          .from('questions')
          .insert({
            project_id: id,
            question_number: qNum,
            subject: qData.subject || 'Physics',
            chapter: qData.chapter || null,
            question_text: qData.question_text || `Question ${qNum}`,
            answer: qData.answer || null,
            question_type: (qData.question_type as QuestionType) || 'single_correct',
            difficulty: qData.difficulty || 'Medium',
            confidence: qData.confidence || 90,
            confidence_breakdown: qData.confidence_breakdown || { text: 95, options: 95, images: 90, question_number: 100 },
            needs_review: Boolean(qData.needs_review),
            review_reason: qData.review_reason || null,
            is_reviewed: false,
            source_pages: [pageNumber],
          })
          .select()
          .single();

        if (savedQ) {
          insertedQCount++;
          const insertedOptionMap = new Map<string, string>(); // label -> option_id

          // Insert Options
          if (qData.options && Array.isArray(qData.options)) {
            for (let optIdx = 0; optIdx < qData.options.length; optIdx++) {
              const opt = qData.options[optIdx];
              const optLabel = (opt.label || String.fromCharCode(65 + optIdx)).toUpperCase();
              const { data: savedOpt } = await supabase
                .from('question_options')
                .insert({
                  question_id: savedQ.id,
                  label: optLabel,
                  text: opt.text || '',
                  order_index: optIdx,
                })
                .select()
                .single();

              if (savedOpt) {
                insertedOptionMap.set(optLabel, savedOpt.id);
              }
            }
          }

          // Attach page diagrams belonging to this question
          const qImages = processedPageImages.filter(
            (item) => item.rawImg.associatedQuestionNumber === qNum || idx === 0
          );

          for (let imgIdx = 0; imgIdx < qImages.length; imgIdx++) {
            const { rawImg, processed, suggestedAssoc, imgType } = qImages[imgIdx];
            const optId = suggestedAssoc !== 'question' ? insertedOptionMap.get(suggestedAssoc) || null : null;
            const base64Data = `data:image/${processed.optimizedFormat};base64,${processed.optimizedBuffer.toString('base64')}`;

            const { data: savedImg } = await supabase
              .from('question_images')
              .insert({
                question_id: savedQ.id,
                option_id: optId,
                storage_path_original: `images/${project.user_id}/${id}/p${pageNumber}_q${qNum}_img${imgIdx + 1}.${processed.originalFormat}`,
                storage_path_optimized: base64Data,
                image_type: imgType || rawImg.imageType || 'diagram',
                original_format: processed.originalFormat,
                optimized_format: processed.optimizedFormat,
                original_dimensions: processed.originalDimensions,
                optimized_dimensions: processed.optimizedDimensions,
                original_size_bytes: processed.originalSizeBytes,
                optimized_size_bytes: processed.optimizedSizeBytes,
                compression_percentage: processed.compressionPercentage,
                is_svg: processed.isSvg,
                svg_content: processed.svgContent,
                order_index: imgIdx,
                source_page: pageNumber,
              })
              .select()
              .single();

            if (savedImg) {
              insertedImgCount++;
            }
          }
        }
      }

      // 10. MARK PAGE STATUS AS 'COMPLETED'
      const completedMeta = PageJobManager.encodePageMetadata({
        status: 'COMPLETED',
        questions_count: insertedQCount,
        images_count: insertedImgCount,
        error_message: null,
        processed_at: new Date().toISOString(),
      });

      await supabase
        .from('document_pages')
        .update({
          page_image_path: completedMeta,
          ocr_applied: true,
        })
        .eq('document_id', doc.id)
        .eq('page_number', pageNumber);

      return NextResponse.json({
        success: true,
        pageNumber,
        status: 'COMPLETED',
        questionsCount: insertedQCount,
        imagesCount: insertedImgCount,
        message: `Page ${pageNumber} processed and completed successfully`,
      });
    } catch (procErr: any) {
      console.error(`[process-page] Fatal error on Page ${pageNumber}:`, procErr);

      // MARK PAGE STATUS AS 'FAILED'
      const failedMeta = PageJobManager.encodePageMetadata({
        status: 'FAILED',
        questions_count: 0,
        images_count: 0,
        error_message: procErr?.message || 'Processing failed',
        processed_at: new Date().toISOString(),
      });

      await supabase
        .from('document_pages')
        .update({ page_image_path: failedMeta })
        .eq('document_id', doc.id)
        .eq('page_number', pageNumber);

      return NextResponse.json(
        {
          success: false,
          pageNumber,
          status: 'FAILED',
          error: procErr?.message || `Failed to process page ${pageNumber}`,
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error('[process-page] Outer error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Page processing request failed' }, { status: 500 });
  }
}
