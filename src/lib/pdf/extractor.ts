import pdfParse from 'pdf-parse';
import sharp from 'sharp';

export interface ExtractedImageItem {
  id: string;
  pageNumber: number;
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  associatedQuestionNumber?: number;
  associatedOptionLabel?: 'A' | 'B' | 'C' | 'D' | null;
  imageType: 'diagram' | 'formula' | 'chemical_structure' | 'graph' | 'table' | 'option_diagram' | 'other';
}

export interface ExtractedPageData {
  pageNumber: number;
  text: string;
  questionBoundaries: Array<{
    questionNumber: number;
    rawText: string;
    startIndex: number;
    endIndex: number;
    estimatedY?: number;
  }>;
  images: ExtractedImageItem[];
}

export interface PDFExtractionResult {
  totalPages: number;
  pages: ExtractedPageData[];
  fullText: string;
  detectedQuestionCount: number;
  extractedImages: ExtractedImageItem[];
}

export class PDFExtractor {
  /**
   * Parses a PDF buffer and extracts text, layout structures, and embedded diagram images per page.
   */
  static async extractTextAndImagesFromBuffer(buffer: Buffer): Promise<PDFExtractionResult> {
    const pages: ExtractedPageData[] = [];
    let fullText = '';
    let detectedCount = 0;
    const allExtractedImages: ExtractedImageItem[] = [];

    // 1. Parse Text & Page Render stream
    const parseOptions: any = {
      pagerender: (pageData: any) => {
        return pageData.getTextContent().then((textContent: any) => {
          let lastY: number | null = null;
          let text = '';
          for (const item of textContent.items) {
            if (lastY === item.transform[5] || lastY === null) {
              text += item.str + ' ';
            } else {
              text += '\n' + item.str + ' ';
            }
            lastY = item.transform[5];
          }
          return text;
        });
      },
    };

    try {
      const data = await pdfParse(buffer, parseOptions);
      fullText = data.text || '';
      const totalPages = data.numpages || 1;

      // Extract raw image streams from PDF binary XObjects
      const rawExtractedImages = await this.extractImagesFromPdfBuffer(buffer);

      // Split rough pages if pagerender produces combined output
      const rawPages = data.text.split(/(?=\f|\n\s*---\s*Page\s+\d+\s*---\s*\n|\n\s*Page\s+\d+\s+of\s+\d+)/i);
      const actualPageCount = Math.max(totalPages, rawPages.length);

      for (let i = 0; i < actualPageCount; i++) {
        const pageNumber = i + 1;
        const pageText = rawPages[i] || (i === 0 ? data.text : '');
        const boundaries = this.detectQuestionBoundaries(pageText);
        detectedCount += boundaries.length;

        // Get images belonging to this page
        const pageImages = rawExtractedImages.filter((img) => img.pageNumber === pageNumber);

        // Associate page images with question boundaries based on reading order & text context
        this.associateImagesWithQuestions(boundaries, pageImages, pageText);

        allExtractedImages.push(...pageImages);

        pages.push({
          pageNumber,
          text: pageText.trim(),
          questionBoundaries: boundaries,
          images: pageImages,
        });
      }

      return {
        totalPages: actualPageCount,
        pages,
        fullText,
        detectedQuestionCount: detectedCount,
        extractedImages: allExtractedImages,
      };
    } catch (err: any) {
      console.error('PDF parsing fallback to raw text extraction:', err);
      return {
        totalPages: 1,
        pages: [
          {
            pageNumber: 1,
            text: buffer.toString('utf-8', 0, Math.min(buffer.length, 50000)),
            questionBoundaries: [],
            images: [],
          },
        ],
        fullText: '',
        detectedQuestionCount: 0,
        extractedImages: [],
      };
    }
  }

  /**
   * Compatibility wrapper for text extraction.
   */
  static async extractTextFromBuffer(buffer: Buffer): Promise<PDFExtractionResult> {
    return this.extractTextAndImagesFromBuffer(buffer);
  }

  /**
   * Extracts raster and vector image streams directly from PDF binary objects.
   */
  static async extractImagesFromPdfBuffer(buffer: Buffer): Promise<ExtractedImageItem[]> {
    const images: ExtractedImageItem[] = [];
    const bufStr = buffer.toString('binary');
    
    // Look for embedded JPEG images (/DCTDecode) and PNG/FlateDecode streams
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff]);
    const jpegFooter = Buffer.from([0xff, 0xd9]);
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    let searchIndex = 0;
    let imageCounter = 1;

    // Scan for direct JPEG streams
    while ((searchIndex = buffer.indexOf(jpegHeader, searchIndex)) !== -1) {
      const footerIndex = buffer.indexOf(jpegFooter, searchIndex + 3);
      if (footerIndex !== -1 && footerIndex - searchIndex > 500 && footerIndex - searchIndex < 10000000) {
        const imageSlice = buffer.subarray(searchIndex, footerIndex + 2);
        try {
          const meta = await sharp(imageSlice).metadata();
          if (meta.width && meta.height && meta.width >= 40 && meta.height >= 40) {
            // Rough page estimate based on byte offset in PDF
            const estimatedPage = Math.max(1, Math.min(100, Math.floor((searchIndex / buffer.length) * 20) + 1));
            images.push({
              id: `img_${Date.now()}_${imageCounter++}`,
              pageNumber: estimatedPage,
              buffer: imageSlice,
              mimeType: 'image/jpeg',
              width: meta.width,
              height: meta.height,
              imageType: meta.width > 250 ? 'diagram' : 'option_diagram',
            });
          }
        } catch {
          // Not a valid standalone JPEG, continue search
        }
        searchIndex = footerIndex + 2;
      } else {
        searchIndex += 3;
      }
    }

    // Scan for direct PNG streams
    searchIndex = 0;
    while ((searchIndex = buffer.indexOf(pngHeader, searchIndex)) !== -1) {
      // Find PNG IEND chunk
      const iendHeader = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
      const iendIndex = buffer.indexOf(iendHeader, searchIndex + 8);
      if (iendIndex !== -1 && iendIndex - searchIndex > 200 && iendIndex - searchIndex < 10000000) {
        const imageSlice = buffer.subarray(searchIndex, iendIndex + 8);
        try {
          const meta = await sharp(imageSlice).metadata();
          if (meta.width && meta.height && meta.width >= 40 && meta.height >= 40) {
            const estimatedPage = Math.max(1, Math.min(100, Math.floor((searchIndex / buffer.length) * 20) + 1));
            images.push({
              id: `img_${Date.now()}_${imageCounter++}`,
              pageNumber: estimatedPage,
              buffer: imageSlice,
              mimeType: 'image/png',
              width: meta.width,
              height: meta.height,
              imageType: meta.width > 250 ? 'diagram' : 'option_diagram',
            });
          }
        } catch {
          // Not a valid standalone PNG
        }
        searchIndex = iendIndex + 8;
      } else {
        searchIndex += 8;
      }
    }

    return images;
  }

  /**
   * Associates extracted images with question boundaries using position and option references.
   */
  static associateImagesWithQuestions(
    boundaries: Array<{ questionNumber: number; rawText: string }>,
    images: ExtractedImageItem[],
    pageText: string
  ): void {
    if (boundaries.length === 0 || images.length === 0) return;

    // Distribute images to closest questions on the page
    const imagesPerQ = Math.max(1, Math.floor(images.length / boundaries.length));

    for (let i = 0; i < images.length; i++) {
      const qIndex = Math.min(boundaries.length - 1, Math.floor(i / imagesPerQ));
      const targetQ = boundaries[qIndex];
      const img = images[i];

      img.associatedQuestionNumber = targetQ.questionNumber;

      // Check if image text mentions specific option
      const raw = targetQ.rawText.toLowerCase();
      if (raw.includes('(a)') && (raw.includes('as shown') || raw.includes('diagram') || img.width < 180)) {
        // Check if there are 4 images corresponding to options A, B, C, D
        const relativeIdx = i % 4;
        if (images.length >= 4) {
          const optLabels: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
          img.associatedOptionLabel = optLabels[relativeIdx];
          img.imageType = 'option_diagram';
        } else {
          img.associatedOptionLabel = null;
          img.imageType = 'diagram';
        }
      } else {
        img.associatedOptionLabel = null;
        img.imageType = 'diagram';
      }
    }
  }

  /**
   * Detects question boundaries using resilient regex patterns for NEET/JEE.
   * Handles: 1., 1), Q1., Q.1, Question 1, [1], (1), etc.
   */
  static detectQuestionBoundaries(text: string): Array<{
    questionNumber: number;
    rawText: string;
    startIndex: number;
    endIndex: number;
  }> {
    const questionRegex = /(?:^|\n)\s*(?:Q(?:uestion)?[\s.:-]*|#\s*)?(\d{1,3})[\s.:\)-]+(?=[A-Z0-9\(\[\{\"'`\+\-~✓])/gim;
    const matches: Array<{ number: number; index: number }> = [];

    let match;
    while ((match = questionRegex.exec(text)) !== null) {
      const qNum = parseInt(match[1], 10);
      if (qNum > 0 && qNum <= 300) {
        matches.push({
          number: qNum,
          index: match.index,
        });
      }
    }

    const boundaries: Array<{
      questionNumber: number;
      rawText: string;
      startIndex: number;
      endIndex: number;
    }> = [];

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];
      const startIndex = current.index;
      const endIndex = next ? next.index : text.length;
      const raw = text.slice(startIndex, endIndex).trim();

      boundaries.push({
        questionNumber: current.number,
        rawText: raw,
        startIndex,
        endIndex,
      });
    }

    return boundaries;
  }

  /**
   * Segments a single question's text into question statement and candidate options (A, B, C, D).
   */
  static segmentQuestionAndOptions(rawQuestionText: string): {
    questionStatement: string;
    options: Array<{ label: string; text: string }>;
  } {
    const options: Array<{ label: string; text: string }> = [];
    let firstOptionIndex = rawQuestionText.length;

    const optMatches = Array.from(
      rawQuestionText.matchAll(/(?:^|\n|\s{2,})(?:\(([A-Da-d1-4])\)|([A-Da-d1-4])[\.\:\)])\s*/g)
    );

    if (optMatches.length >= 2) {
      firstOptionIndex = optMatches[0].index || 0;
      for (let i = 0; i < optMatches.length; i++) {
        const cur = optMatches[i];
        const next = optMatches[i + 1];
        const label = (cur[1] || cur[2]).toUpperCase();
        const start = (cur.index || 0) + cur[0].length;
        const end = next ? next.index : rawQuestionText.length;
        const optText = rawQuestionText.slice(start, end).trim();

        // Convert 1,2,3,4 to A,B,C,D if numerical labels
        const mappedLabel = label === '1' ? 'A' : label === '2' ? 'B' : label === '3' ? 'C' : label === '4' ? 'D' : label;

        options.push({
          label: mappedLabel,
          text: optText,
        });
      }
    }

    const questionStatement = rawQuestionText.slice(0, firstOptionIndex).trim();

    return {
      questionStatement: questionStatement || rawQuestionText,
      options,
    };
  }

  /**
   * Normalizes educational formula formatting (superscripts, subscripts, Greek characters).
   */
  static normalizeFormulas(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\b([a-zA-Z])_(\d+)\b/g, '$1$2')
      .replace(/\b(\d+)\s*\/\s*(\d+)\b/g, '$1/$2')
      .replace(/\s*=\s*/g, ' = ')
      .replace(/\s*([+\-×÷])\s*/g, ' $1 ')
      .trim();
  }
}
