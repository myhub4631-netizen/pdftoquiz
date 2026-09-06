import ExcelJS from 'exceljs';
import { Question, Project } from '@/types/database';

export interface ExcelExportOptions {
  project: Project;
  questions: Question[];
  imageBuffers?: Map<string, { buffer: Buffer; extension: 'png' | 'jpeg' | 'gif' }>;
}

export class ExcelGenerator {
  /**
   * Generates a multi-sheet .xlsx workbook with embedded images, metadata summary, and extraction audit report.
   */
  static async generateWorkbook(options: ExcelExportOptions): Promise<Buffer> {
    const { project, questions, imageBuffers = new Map() } = options;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'QuestionForge AI';
    workbook.lastModifiedBy = 'QuestionForge AI';
    workbook.created = new Date();
    workbook.modified = new Date();

    // =========================================================================
    // SHEET 1: Questions (Core Question Bank)
    // =========================================================================
    const qSheet = workbook.addWorksheet('Questions', {
      views: [{ state: 'frozen', ySplit: 1 }],
      properties: { tabColor: { argb: 'FF2563EB' } },
    });

    qSheet.columns = [
      { header: 'Q.No', key: 'question_no', width: 8 },
      { header: 'Subject', key: 'subject', width: 14 },
      { header: 'Chapter', key: 'chapter', width: 18 },
      { header: 'Question Text', key: 'question_text', width: 45 },
      { header: 'Option A', key: 'option_a', width: 25 },
      { header: 'Option B', key: 'option_b', width: 25 },
      { header: 'Option C', key: 'option_c', width: 25 },
      { header: 'Option D', key: 'option_d', width: 25 },
      { header: 'Answer', key: 'answer', width: 10 },
      { header: 'Type', key: 'question_type', width: 16 },
      { header: 'Difficulty', key: 'difficulty', width: 12 },
      { header: 'Confidence', key: 'confidence', width: 14 },
      { header: 'Page', key: 'source_page', width: 8 },
      { header: 'Review Flag', key: 'needs_review', width: 14 },
      { header: 'Question Image', key: 'q_image_col', width: 22 },
      { header: 'Option A Image', key: 'opt_a_img', width: 20 },
      { header: 'Option B Image', key: 'opt_b_img', width: 20 },
      { header: 'Option C Image', key: 'opt_c_img', width: 20 },
      { header: 'Option D Image', key: 'opt_d_img', width: 20 },
      { header: 'System ID', key: 'id', width: 36 },
    ];

    // Header styling
    const headerRow = qSheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }, // Slate 800
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF2563EB' } },
        right: { style: 'thin', color: { argb: 'FF334155' } },
      };
    });

    // Populate question rows
    questions.forEach((q, idx) => {
      const rowIndex = idx + 2;
      const optA = q.options?.find((o) => o.label.toUpperCase() === 'A')?.text || '';
      const optB = q.options?.find((o) => o.label.toUpperCase() === 'B')?.text || '';
      const optC = q.options?.find((o) => o.label.toUpperCase() === 'C')?.text || '';
      const optD = q.options?.find((o) => o.label.toUpperCase() === 'D')?.text || '';

      const row = qSheet.addRow({
        question_no: q.question_number,
        subject: q.subject || 'Physics',
        chapter: q.chapter || '-',
        question_text: q.question_text,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        answer: q.answer || '-',
        question_type: q.question_type || 'single_correct',
        difficulty: q.difficulty || 'Medium',
        confidence: `${q.confidence}%`,
        source_page: q.source_pages?.join(', ') || '1',
        needs_review: q.needs_review ? 'YES (Flagged)' : 'OK',
        q_image_col: '',
        opt_a_img: '',
        opt_b_img: '',
        opt_c_img: '',
        opt_d_img: '',
        id: q.id,
      });

      // Check if question has images
      const qImages = q.images?.filter((img) => !img.option_id) || [];
      const hasImages = (q.images && q.images.length > 0) || false;
      row.height = hasImages ? 100 : 38;

      // Zebra styling & cell formatting
      const isEven = idx % 2 === 0;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }

        // Center align specific columns
        if ([1, 9, 10, 11, 12, 13, 14].includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // Highlight review rows
        if (colNumber === 14 && q.needs_review) {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFDC2626' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEE2E2' },
          };
        }
      });

      // Embed image drawings if available in buffers
      if (q.images && q.images.length > 0) {
        q.images.forEach((img) => {
          const imgKey = img.storage_path_optimized || img.storage_path_original;
          const found = imageBuffers.get(imgKey);
          if (found) {
            try {
              const imageId = workbook.addImage({
                buffer: found.buffer,
                extension: found.extension,
              });

              let targetCol = 15; // Question Image column (col 15, index 14)
              if (img.option_id) {
                const opt = q.options?.find((o) => o.id === img.option_id);
                if (opt?.label === 'A') targetCol = 16;
                else if (opt?.label === 'B') targetCol = 17;
                else if (opt?.label === 'C') targetCol = 18;
                else if (opt?.label === 'D') targetCol = 19;
              }

              qSheet.addImage(imageId, {
                tl: { col: targetCol - 1 + 0.05, row: rowIndex - 1 + 0.05 },
                ext: { width: 130, height: 90 },
                editAs: 'oneCell',
              });
            } catch (embedErr) {
              console.warn('Could not embed image into excel cell:', embedErr);
            }
          }
        });
      }
    });

    // =========================================================================
    // SHEET 2: Metadata (Project Summary & Stats)
    // =========================================================================
    const metaSheet = workbook.addWorksheet('Metadata', {
      properties: { tabColor: { argb: 'FF10B981' } },
    });

    metaSheet.columns = [
      { header: 'Property', key: 'property', width: 28 },
      { header: 'Value', key: 'value', width: 45 },
    ];

    const metaHeader = metaSheet.getRow(1);
    metaHeader.height = 28;
    metaHeader.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const physicsCount = questions.filter((q) => q.subject.toLowerCase().includes('phys')).length;
    const chemCount = questions.filter((q) => q.subject.toLowerCase().includes('chem')).length;
    const bioCount = questions.filter((q) => q.subject.toLowerCase().includes('bio')).length;
    const mathCount = questions.filter((q) => q.subject.toLowerCase().includes('math')).length;
    const totalImages = questions.reduce((acc, q) => acc + (q.images?.length || 0), 0);

    const metadataRows = [
      { property: 'Project Name', value: project.name },
      { property: 'Exam Type', value: project.exam_type },
      { property: 'Year', value: project.year },
      { property: 'Total Questions', value: questions.length },
      { property: 'Physics Questions', value: physicsCount },
      { property: 'Chemistry Questions', value: chemCount },
      { property: 'Biology Questions', value: bioCount },
      { property: 'Mathematics Questions', value: mathCount },
      { property: 'Images Extracted', value: totalImages },
      { property: 'Needs Review Flagged', value: questions.filter((q) => q.needs_review).length },
      { property: 'Export Date', value: new Date().toISOString() },
      { property: 'Generated By', value: 'QuestionForge AI Engine' },
    ];

    metadataRows.forEach((item) => {
      const r = metaSheet.addRow(item);
      r.height = 24;
      r.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    });

    // =========================================================================
    // SHEET 3: Extraction Report (AI Audit Log)
    // =========================================================================
    const reportSheet = workbook.addWorksheet('Extraction Report', {
      properties: { tabColor: { argb: 'FFF59E0B' } },
    });

    reportSheet.columns = [
      { header: 'Q.No', key: 'q_no', width: 10 },
      { header: 'Subject', key: 'subject', width: 15 },
      { header: 'Confidence (%)', key: 'conf', width: 16 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Images Count', key: 'img_cnt', width: 14 },
      { header: 'Needs Review', key: 'needs_rev', width: 14 },
      { header: 'Review Reason', key: 'reason', width: 45 },
    ];

    const repHeader = reportSheet.getRow(1);
    repHeader.height = 28;
    repHeader.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92400E' } };
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    questions.forEach((q) => {
      const r = reportSheet.addRow({
        q_no: q.question_number,
        subject: q.subject,
        conf: `${q.confidence}%`,
        status: q.confidence >= 85 ? 'High Quality' : q.confidence >= 70 ? 'Moderate' : 'Low Confidence',
        img_cnt: q.images?.length || 0,
        needs_rev: q.needs_review ? 'YES' : 'NO',
        reason: q.review_reason || 'Clean extraction',
      });
      r.height = 22;
      r.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
