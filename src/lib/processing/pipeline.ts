import { createAdminClient } from '@/lib/supabase/admin';
import { PDFExtractor } from '@/lib/pdf/extractor';
import { ImageProcessor } from '@/lib/image/processor';
import { OpenRouterProvider } from '@/lib/ai/openrouter';
import { NEETSubjectDetector } from '@/lib/pdf/neet-detector';
import { Project, QuestionType, ImageType } from '@/types/database';

export interface PipelineExecutionOptions {
  projectId: string;
  pdfBuffer: Buffer;
  fileName: string;
  userId: string;
}

export class QuestionForgePipeline {
  /**
   * Executes the full extraction & processing pipeline asynchronously.
   */
  static async run(options: PipelineExecutionOptions): Promise<void> {
    const { projectId, pdfBuffer, fileName, userId } = options;
    const supabase = createAdminClient();
    const aiProvider = new OpenRouterProvider();

    // 1. Fetch Project Details & Image Settings
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projErr || !project) {
      throw new Error(`Project ${projectId} not found: ${projErr?.message}`);
    }

    // 2. Initialize or Update Processing Job
    const { data: job, error: jobErr } = await supabase
      .from('processing_jobs')
      .insert({
        project_id: projectId,
        user_id: userId,
        status: 'running',
        progress_percentage: 5,
        current_step: 'Parsing PDF pages and layout',
        current_step_index: 1,
        total_steps: 7,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    const jobId = job?.id;

    const log = async (level: 'INFO' | 'WARN' | 'ERROR', message: string, metadata: any = {}) => {
      console.log(`[Job ${jobId || projectId}] [${level}] ${message}`);
      if (jobId) {
        await supabase.from('processing_logs').insert({
          job_id: jobId,
          level,
          message,
          metadata,
        });
      }
    };

    const updateJob = async (fields: Record<string, any>) => {
      if (jobId) {
        await supabase.from('processing_jobs').update(fields).eq('id', jobId);
      }
    };

    const updateProject = async (status: string, metadata: any = {}) => {
      await supabase.from('projects').update({ status, ...metadata, updated_at: new Date().toISOString() }).eq('id', projectId);
    };

    try {
      await log('INFO', `Starting extraction pipeline for "${fileName}" (${project.exam_type})`);
      await updateProject('ANALYSING');

      // STEP 1: Parse PDF text, layout, and embedded images
      await updateJob({ progress_percentage: 15, current_step: 'Extracting text and identifying page structure', current_step_index: 2 });
      const pdfResult = await PDFExtractor.extractTextAndImagesFromBuffer(pdfBuffer);

      // Detect NEET Subject Distribution & Section Permutations
      const paperStructure = NEETSubjectDetector.analyzePaperStructure(
        pdfResult.fullText,
        pdfResult.detectedQuestionCount || project.expected_questions || 200,
        project.exam_type
      );

      await log('INFO', `PDF Parsed: ${pdfResult.totalPages} pages, ${pdfResult.detectedQuestionCount} potential questions, ${pdfResult.extractedImages.length} diagram images.`);
      await log('INFO', `Detected Subject Sequence: [ ${paperStructure.detectedOrderSummary} ] (${paperStructure.format})`);

      // Update Document metadata
      await supabase.from('documents').upsert({
        project_id: projectId,
        user_id: userId,
        file_name: fileName,
        file_size_bytes: pdfBuffer.length,
        mime_type: 'application/pdf',
        storage_path: `uploads/${userId}/${projectId}/original.pdf`,
        page_count: pdfResult.totalPages,
        extracted_text_size: pdfResult.fullText.length,
      });

      // STEP 2: Page-by-page AI structuring
      await updateProject('AI_PROCESSING');
      await updateJob({
        progress_percentage: 30,
        current_step: 'Running AI question & option structuring',
        current_step_index: 3,
        total_questions_detected: pdfResult.detectedQuestionCount,
      });

      const extractedQuestionsList: any[] = [];
      let totalQuestionsExtracted = 0;
      let needsReviewTotal = 0;

      // Group pages into reasonable chunks for OpenRouter
      for (let i = 0; i < pdfResult.pages.length; i++) {
        const page = pdfResult.pages[i];
        if (!page.text || page.text.trim().length === 0) continue;

        await log('INFO', `Processing Page ${page.pageNumber} of ${pdfResult.totalPages}...`);

        try {
          const aiQuestions = await aiProvider.extractQuestionsFromChunk(
            page.text,
            page.pageNumber,
            project.exam_type
          );

          if (aiQuestions.length > 0) {
            for (const q of aiQuestions) {
              const qNum = q.question_number || (extractedQuestionsList.length + 1);
              const mappedSubject = NEETSubjectDetector.getSubjectForQuestion(
                qNum,
                paperStructure,
                q.question_text
              );

              extractedQuestionsList.push({
                ...q,
                subject: q.subject && q.subject !== 'General' ? q.subject : mappedSubject,
              });
            }
          } else {
            // Fallback: If AI returned 0, use boundary regex segmenter with detected subject routing
            for (const bound of page.questionBoundaries) {
              const seg = PDFExtractor.segmentQuestionAndOptions(bound.rawText);
              const mappedSubject = NEETSubjectDetector.getSubjectForQuestion(
                bound.questionNumber,
                paperStructure,
                seg.questionStatement
              );

              extractedQuestionsList.push({
                question_number: bound.questionNumber,
                subject: mappedSubject,
                chapter: null,
                question_text: seg.questionStatement,
                options: seg.options,
                answer: null,
                question_type: 'single_correct',
                confidence: 70,
                needs_review: true,
                review_reason: 'Extracted via fallback pattern segmenter; recommended for review.',
                source_pages: [page.pageNumber],
              });
            }
          }
        } catch (pageErr: any) {
          await log('WARN', `AI chunk failed for page ${page.pageNumber}, applying regex fallback: ${pageErr?.message}`);
          for (const bound of page.questionBoundaries) {
            const seg = PDFExtractor.segmentQuestionAndOptions(bound.rawText);
            const mappedSubject = NEETSubjectDetector.getSubjectForQuestion(
              bound.questionNumber,
              paperStructure,
              seg.questionStatement
            );

            extractedQuestionsList.push({
              question_number: bound.questionNumber,
              subject: mappedSubject,
              chapter: null,
              question_text: seg.questionStatement,
              options: seg.options,
              answer: null,
              question_type: 'single_correct',
              confidence: 50,
              needs_review: true,
              review_reason: `AI processing timed out: ${pageErr?.message}`,
              source_pages: [page.pageNumber],
            });
          }
        }

        const pct = Math.min(70, Math.round(30 + ((i + 1) / pdfResult.pages.length) * 40));
        await updateJob({ progress_percentage: pct, questions_processed: extractedQuestionsList.length });
      }

      // STEP 3: Image Processing & Optimization
      await updateProject('PROCESSING_IMAGES');
      await updateJob({
        progress_percentage: 75,
        current_step: 'Optimizing diagrams and associating options',
        current_step_index: 4,
      });

      const imageSettings = project.image_settings || {
        extract_images: true,
        compress_images: true,
        compression_level: 'High',
        convert_to_svg: false,
        keep_original_images: true,
      };

      const processedImagesMap = new Map<number, any[]>();

      if (imageSettings.extract_images && pdfResult.extractedImages && pdfResult.extractedImages.length > 0) {
        await log('INFO', `Processing ${pdfResult.extractedImages.length} extracted diagram images with Sharp...`);
        
        for (const rawImg of pdfResult.extractedImages) {
          try {
            const processed = await ImageProcessor.processImage(rawImg.buffer, {
              compressionLevel: imageSettings.compression_level,
              convertToSvg: imageSettings.convert_to_svg,
            });

            const qNum = rawImg.associatedQuestionNumber || 1;
            if (!processedImagesMap.has(qNum)) {
              processedImagesMap.set(qNum, []);
            }

            processedImagesMap.get(qNum)!.push({
              rawImg,
              processed,
            });
          } catch (procErr: any) {
            await log('WARN', `Image optimization failed for image on page ${rawImg.pageNumber}: ${procErr?.message}`);
          }
        }
      }

      // STEP 4: Insert into Database with Relational Options and Images
      await updateProject('VALIDATION');
      await updateJob({
        progress_percentage: 85,
        current_step: 'Validating questions and persisting to database',
        current_step_index: 5,
      });

      // Clear any previous questions for re-processing
      await supabase.from('questions').delete().eq('project_id', projectId);

      for (let index = 0; index < extractedQuestionsList.length; index++) {
        const qData = extractedQuestionsList[index];
        const qNum = qData.question_number || (index + 1);

        if (qData.needs_review) needsReviewTotal++;
        totalQuestionsExtracted++;

        // Insert Question
        const { data: savedQ, error: qInsertErr } = await supabase
          .from('questions')
          .insert({
            project_id: projectId,
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
            source_pages: qData.source_pages || [1],
          })
          .select()
          .single();

        if (savedQ) {
          const insertedOptionMap = new Map<string, string>(); // label -> option_id

          // Insert Options
          if (qData.options && Array.isArray(qData.options)) {
            for (let optIdx = 0; optIdx < qData.options.length; optIdx++) {
              const opt = qData.options[optIdx];
              const optLabel = opt.label || String.fromCharCode(65 + optIdx);
              const { data: savedOpt } = await supabase.from('question_options').insert({
                question_id: savedQ.id,
                label: optLabel,
                text: opt.text || '',
                order_index: optIdx,
              }).select().single();

              if (savedOpt) {
                insertedOptionMap.set(optLabel.toUpperCase(), savedOpt.id);
              }
            }
          }

          // Insert Associated Images for this Question
          const qImages = processedImagesMap.get(qNum) || [];
          for (let imgIdx = 0; imgIdx < qImages.length; imgIdx++) {
            const { rawImg, processed } = qImages[imgIdx];
            const optId = rawImg.associatedOptionLabel ? insertedOptionMap.get(rawImg.associatedOptionLabel) || null : null;

            const base64Data = `data:image/${processed.optimizedFormat};base64,${processed.optimizedBuffer.toString('base64')}`;

            await supabase.from('question_images').insert({
              question_id: savedQ.id,
              option_id: optId,
              storage_path_original: `images/${userId}/${projectId}/q${qNum}_img${imgIdx + 1}.${processed.originalFormat}`,
              storage_path_optimized: base64Data, // In-memory data URI for instant client rendering & embedding
              image_type: rawImg.imageType || 'diagram',
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
              source_page: rawImg.pageNumber,
            });
          }
        }
      }

      // STEP 5: Final Validation & Metrics update
      await updateJob({
        progress_percentage: 100,
        current_step: 'Completed successfully',
        current_step_index: 7,
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_questions_detected: pdfResult.detectedQuestionCount || totalQuestionsExtracted,
        questions_processed: totalQuestionsExtracted,
      });

      const finalStatus = needsReviewTotal > 0 ? 'NEEDS_REVIEW' : 'COMPLETED';
      await updateProject(finalStatus, {
        total_questions: totalQuestionsExtracted,
        total_pages: pdfResult.totalPages,
        extracted_questions: totalQuestionsExtracted,
        needs_review_count: needsReviewTotal,
      });

      // Increment profile question and project stats
      try {
        await supabase.rpc('increment_profile_stats', {
          u_id: userId,
          p_count: 1,
          q_count: totalQuestionsExtracted,
        });
      } catch {
        // Continue if RPC function is optional
      }

      await log('INFO', `Extraction finished successfully: ${totalQuestionsExtracted} questions extracted (${needsReviewTotal} flagged for review).`);

    } catch (err: any) {
      await log('ERROR', `Pipeline execution encountered fatal error: ${err?.message}`);
      await updateJob({
        status: 'failed',
        error_message: err?.message || 'Processing error',
        completed_at: new Date().toISOString(),
      });
      await updateProject('FAILED');
      throw err;
    }
  }
}
