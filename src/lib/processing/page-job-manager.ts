import { createAdminClient } from '@/lib/supabase/admin';
import { PDFExtractor, ExtractedImageItem } from '@/lib/pdf/extractor';
import { ImageProcessor } from '@/lib/image/processor';
import { OpenRouterProvider } from '@/lib/ai/openrouter';
import { NEETSubjectDetector } from '@/lib/pdf/neet-detector';
import { ExcelGenerator } from '@/lib/excel/generator';
import { ProjectStore } from '@/lib/projects/store';

export type PageStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface PageMetadata {
  status: PageStatus;
  questions_count: number;
  images_count: number;
  error_message: string | null;
  processed_at: string | null;
}

export class PageJobManager {
  /**
   * Helper to safely extract PageMetadata from document_pages page_image_path field.
   */
  static parsePageMetadata(pageRow: any): PageMetadata {
    if (!pageRow) {
      return {
        status: 'QUEUED',
        questions_count: 0,
        images_count: 0,
        error_message: null,
        processed_at: null,
      };
    }

    const pathStr = pageRow.page_image_path || '';
    if (pathStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(pathStr);
        return {
          status: (parsed.status as PageStatus) || 'QUEUED',
          questions_count: Number(parsed.questions_count) || 0,
          images_count: Number(parsed.images_count) || 0,
          error_message: parsed.error_message || null,
          processed_at: parsed.processed_at || null,
        };
      } catch {
        // Fall through
      }
    }

    // Fallback based on text_content presence
    return {
      status: pageRow.ocr_applied ? 'COMPLETED' : 'QUEUED',
      questions_count: 0,
      images_count: 0,
      error_message: null,
      processed_at: pageRow.created_at || null,
    };
  }

  /**
   * Helper to serialize PageMetadata back into page_image_path.
   */
  static encodePageMetadata(meta: Partial<PageMetadata>, extraPath?: string): string {
    return JSON.stringify({
      status: meta.status || 'QUEUED',
      questions_count: meta.questions_count || 0,
      images_count: meta.images_count || 0,
      error_message: meta.error_message || null,
      processed_at: meta.processed_at || new Date().toISOString(),
      extraPath: extraPath || null,
    });
  }

  /**
   * Downloads PDF buffer from Supabase Storage or document record.
   */
  static async getPdfBufferForProject(projectId: string): Promise<{ buffer: Buffer; fileName: string; docId: string }> {
    const supabase = createAdminClient();
    const project = await ProjectStore.getProject(projectId);
    const doc = await ProjectStore.getDocument(projectId);

    let fileName = `${project?.name || 'document'}.pdf`;
    let pdfBuffer: Buffer | null = null;

    // 1. Check ProjectStore memory and disk cache first
    pdfBuffer = ProjectStore.getPdfBuffer(projectId);
    if (pdfBuffer && doc?.file_name) {
      fileName = doc.file_name;
    }

    // 2. Download from Supabase Storage bucket 'documents' if not found in ProjectStore
    if (!pdfBuffer) {
      const pathsToTry = [
        doc?.storage_path,
        `uploads/${project?.user_id}/${projectId}/original.pdf`,
        `uploads/${projectId}/original.pdf`,
        doc?.file_name ? `${doc.file_name}` : null,
      ].filter(Boolean) as string[];

      for (const p of pathsToTry) {
        try {
          const { data: fileData, error: dlErr } = await supabase.storage
            .from('documents')
            .download(p);

          if (fileData && !dlErr) {
            const arrayBuf = await fileData.arrayBuffer();
            pdfBuffer = Buffer.from(arrayBuf);
            fileName = doc?.file_name || fileName;
            ProjectStore.savePdfBuffer(projectId, pdfBuffer);
            break;
          }
        } catch (err) {
          console.warn(`[PageJobManager] Storage download notice for path ${p}:`, err);
        }
      }
    }

    if (!pdfBuffer) {
      throw new Error(`PDF document buffer not found in storage or cache for project: ${projectId}`);
    }

    return {
      buffer: pdfBuffer,
      fileName,
      docId: doc?.id || `doc-${projectId}`,
    };
  }
}
