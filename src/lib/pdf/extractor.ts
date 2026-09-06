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
   * Delegates single page spatial parsing to Python FastAPI Document Engine microservice.
   */
  static async extractPageDataViaPythonEngine(buffer: Buffer, pageNumber: number): Promise<ExtractedPageData | null> {
    const pythonUrl = process.env.PYTHON_ENGINE_URL || 'http://localhost:8000';
    try {
      const res = await fetch(`${pythonUrl}/api/v1/extract-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf_base64: buffer.toString('base64'),
          page_number: pageNumber,
          dpi: 300,
          extract_images: true,
        }),
      });

      if (!res.ok) {
        console.warn(`[PDFExtractor] Python Engine returned status ${res.status} at ${pythonUrl}`);
        return null;
      }

      const data = await res.json();
      if (!data.success) {
        console.warn(`[PDFExtractor] Python Engine error response at ${pythonUrl}:`, data.error);
        return null;
      }

      console.log(`[PDFExtractor] ✓ Page ${pageNumber} extracted via Python Engine at ${pythonUrl}`);

      const pageImages: ExtractedImageItem[] = (data.images || []).map((img: any) => ({
        id: img.image_id,
        pageNumber: pageNumber,
        buffer: Buffer.from(img.image_base64.split(',')[1] || '', 'base64'),
        mimeType: `image/${img.format || 'png'}`,
        width: img.width,
        height: img.height,
        x: img.x0,
        y: img.y0,
        imageType: img.width > 250 ? 'diagram' : 'option_diagram',
      }));

      return {
        pageNumber,
        text: data.full_text || '',
        questionBoundaries: (data.question_boundaries || []).map((qb: any) => ({
          questionNumber: qb.question_number,
          rawText: data.full_text || '',
          startIndex: 0,
          endIndex: 0,
          estimatedY: qb.y0,
          optionBounds: qb.option_bounds || [],
        })),
        images: pageImages,
      };
    } catch (err: any) {
      console.warn(`[PDFExtractor] Python Engine unavailable at ${pythonUrl}:`, err?.message || err);
      return null;
    }
  }

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
        return pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false }).then((textContent: any) => {
          let lastY: number | null = null;
          let text = `\n--- PAGE_SPLIT_${pageData.pageIndex + 1} ---\n`;
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
      const rawExtractedImages = await this.extractImagesFromPdfBuffer(buffer, totalPages);

      // Split text into individual page texts using the page split marker
      const splitChunks = data.text.split(/\n--- PAGE_SPLIT_\d+ ---\n/);
      // Filter out leading empty chunk if present
      const rawPages = splitChunks.filter((txt: string, idx: number) => idx > 0 || txt.trim().length > 0);
      const actualPageCount = Math.max(totalPages, rawPages.length);

      for (let i = 0; i < actualPageCount; i++) {
        const pageNumber = i + 1;
        const pageText = rawPages[i] || '';
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
  static async extractImagesFromPdfBuffer(buffer: Buffer, totalPagesCount: number = 1): Promise<ExtractedImageItem[]> {
    const images: ExtractedImageItem[] = [];
    const str = buffer.toString('binary');
    let imageCounter = 1;

    // Scan PDF stream objects (/Subtype /Image)
    const streamRegex = /<<\s*\/Type\s*\/XObject\s*\/Subtype\s*\/Image[\s\S]*?>>\s*stream[\r\n]+/g;
    let match;

    while ((match = streamRegex.exec(str)) !== null) {
      const headerStr = match[0];
      const streamStart = match.index + headerStr.length;
      const endstreamIdx = str.indexOf('endstream', streamStart);

      if (endstreamIdx === -1) continue;

      const streamSlice = buffer.subarray(streamStart, endstreamIdx);
      const pageEst = Math.max(1, Math.min(totalPagesCount, Math.floor((match.index / buffer.length) * totalPagesCount) + 1));

      // Case 1: /Filter /DCTDecode (JPEG)
      if (headerStr.includes('/DCTDecode')) {
        const jpegHeader = Buffer.from([0xff, 0xd8, 0xff]);
        const headerOffset = streamSlice.indexOf(jpegHeader);
        if (headerOffset !== -1) {
          const jpegSlice = streamSlice.subarray(headerOffset);
          try {
            const meta = await sharp(jpegSlice).metadata();
            if (meta.width && meta.height && meta.width >= 40 && meta.height >= 40) {
              images.push({
                id: `img_dct_${Date.now()}_${imageCounter++}`,
                pageNumber: pageEst,
                buffer: jpegSlice,
                mimeType: 'image/jpeg',
                width: meta.width,
                height: meta.height,
                imageType: meta.width > 250 ? 'diagram' : 'option_diagram',
              });
              continue;
            }
          } catch {}
        }
      }

      // Case 2: /Filter /FlateDecode (PNG / Zlib)
      if (headerStr.includes('/FlateDecode')) {
        try {
          const zlib = await import('zlib');
          let decompressed: Buffer;
          try {
            decompressed = zlib.inflateSync(streamSlice);
          } catch {
            decompressed = zlib.inflateRawSync(streamSlice);
          }

          const widthMatch = headerStr.match(/\/Width\s+(\d+)/);
          const heightMatch = headerStr.match(/\/Height\s+(\d+)/);
          const width = widthMatch ? parseInt(widthMatch[1], 10) : null;
          const height = heightMatch ? parseInt(heightMatch[1], 10) : null;

          try {
            const meta = await sharp(decompressed).metadata();
            if (meta.width && meta.height && meta.width >= 40 && meta.height >= 40) {
              images.push({
                id: `img_flate_${Date.now()}_${imageCounter++}`,
                pageNumber: pageEst,
                buffer: decompressed,
                mimeType: `image/${meta.format || 'png'}`,
                width: meta.width,
                height: meta.height,
                imageType: meta.width > 250 ? 'diagram' : 'option_diagram',
              });
              continue;
            }
          } catch {
            if (width && height && width >= 40 && height >= 40) {
              for (const channels of [3, 4, 1]) {
                if (decompressed.length >= width * height * channels) {
                  try {
                    const pngBuf = await sharp(decompressed.subarray(0, width * height * channels), {
                      raw: { width, height, channels: channels as any },
                    })
                      .png()
                      .toBuffer();

                    images.push({
                      id: `img_raw_${Date.now()}_${imageCounter++}`,
                      pageNumber: pageEst,
                      buffer: pngBuf,
                      mimeType: 'image/png',
                      width,
                      height,
                      imageType: width > 250 ? 'diagram' : 'option_diagram',
                    });
                    break;
                  } catch {}
                }
              }
            }
          }
        } catch {}
      }
    }

    // Direct JPEG fallback scanner
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff]);
    const jpegFooter = Buffer.from([0xff, 0xd9]);
    let searchIndex = 0;

    while ((searchIndex = buffer.indexOf(jpegHeader, searchIndex)) !== -1) {
      const footerIndex = buffer.indexOf(jpegFooter, searchIndex + 3);
      if (footerIndex !== -1 && footerIndex - searchIndex > 500 && footerIndex - searchIndex < 10000000) {
        const imageSlice = buffer.subarray(searchIndex, footerIndex + 2);
        try {
          const meta = await sharp(imageSlice).metadata();
          if (meta.width && meta.height && meta.width >= 40 && meta.height >= 40) {
            const pageEst = Math.max(1, Math.min(totalPagesCount, Math.floor((searchIndex / buffer.length) * totalPagesCount) + 1));
            images.push({
              id: `img_${Date.now()}_${imageCounter++}`,
              pageNumber: pageEst,
              buffer: imageSlice,
              mimeType: 'image/jpeg',
              width: meta.width,
              height: meta.height,
              imageType: meta.width > 250 ? 'diagram' : 'option_diagram',
            });
          }
        } catch {}
        searchIndex = footerIndex + 2;
      } else {
        searchIndex += 3;
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
