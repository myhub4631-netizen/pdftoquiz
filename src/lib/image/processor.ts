import sharp from 'sharp';
import potrace from 'potrace';
import { CompressionLevel, ImageType } from '@/types/database';

export interface ProcessedImageData {
  originalBuffer: Buffer;
  optimizedBuffer: Buffer;
  originalFormat: string;
  optimizedFormat: string;
  originalDimensions: { width: number; height: number };
  optimizedDimensions: { width: number; height: number };
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  compressionPercentage: number;
  isSvg: boolean;
  svgContent: string | null;
  imageType: ImageType;
}

export class ImageProcessor {
  /**
   * Optimizes an image buffer according to user-selected compression level and SVG conversion.
   */
  static async processImage(
    buffer: Buffer,
    settings: {
      compressionLevel?: CompressionLevel;
      convertToSvg?: boolean;
      forceSvg?: boolean;
    } = {}
  ): Promise<ProcessedImageData> {
    const level = settings.compressionLevel || 'High';
    const originalSizeBytes = buffer.length;

    // Get original metadata using sharp
    const imageInstance = sharp(buffer);
    const metadata = await imageInstance.metadata();
    const originalFormat = metadata.format || 'png';
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    let optimizedBuffer: Buffer = buffer;
    let optimizedFormat = 'webp';
    let isSvg = false;
    let svgContent: string | null = null;

    // Check SVG conversion eligibility if requested
    if (settings.convertToSvg) {
      const isSuitable = this.checkIfSuitableForSvg(metadata, originalSizeBytes);
      if (isSuitable || settings.forceSvg) {
        try {
          svgContent = await this.vectorizeToSvg(buffer);
          if (svgContent) {
            isSvg = true;
            optimizedFormat = 'svg';
            optimizedBuffer = Buffer.from(svgContent, 'utf-8');
          }
        } catch (svgErr) {
          console.warn('SVG vectorization skipped due to error:', svgErr);
        }
      }
    }

    if (!isSvg) {
      if (level === 'Original') {
        optimizedBuffer = buffer;
        optimizedFormat = originalFormat;
      } else {
        // Apply tailored compression levels
        let quality = 85;
        let effort = 4;

        switch (level) {
          case 'Low':
            quality = 90;
            effort = 3;
            break;
          case 'Medium':
            quality = 80;
            effort = 4;
            break;
          case 'High':
            quality = 70;
            effort = 5;
            break;
          case 'Maximum':
            quality = 55;
            effort = 6;
            break;
        }

        // Trim border whitespace to focus on the educational content
        let pipeline = sharp(buffer).trim();

        // Convert to high-efficiency WebP preserving crisp lines and equations
        optimizedBuffer = await pipeline
          .webp({
            quality,
            effort,
            lossless: level === 'Low',
          })
          .toBuffer();
      }
    }

    // Measure optimized image dimensions
    const optMeta = isSvg ? metadata : await sharp(optimizedBuffer).metadata();
    const optWidth = optMeta.width || originalWidth;
    const optHeight = optMeta.height || originalHeight;
    const optimizedSizeBytes = optimizedBuffer.length;

    const compressionPercentage = originalSizeBytes > 0
      ? Math.max(0, parseFloat((((originalSizeBytes - optimizedSizeBytes) / originalSizeBytes) * 100).toFixed(2)))
      : 0;

    return {
      originalBuffer: buffer,
      optimizedBuffer,
      originalFormat,
      optimizedFormat,
      originalDimensions: { width: originalWidth, height: originalHeight },
      optimizedDimensions: { width: optWidth, height: optHeight },
      originalSizeBytes,
      optimizedSizeBytes,
      compressionPercentage,
      isSvg,
      svgContent,
      imageType: 'diagram',
    };
  }

  /**
   * Evaluates if a diagram is suitable for clean SVG conversion (e.g. black and white line art / circuits).
   */
  private static checkIfSuitableForSvg(meta: sharp.Metadata, sizeBytes: number): boolean {
    if (!meta.width || !meta.height) return false;
    // Suitable if it's small/medium diagram with 1-3 color channels and reasonable dimensions
    const isReasonableSize = meta.width <= 1200 && meta.height <= 1200;
    const isSmallFile = sizeBytes < 500 * 1024; // under 500KB
    return isReasonableSize && isSmallFile && meta.channels !== undefined && meta.channels <= 4;
  }

  /**
   * Converts raster image to clean SVG using potrace.
   */
  private static vectorizeToSvg(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      potrace.trace(buffer, { threshold: 128, color: '#000000' }, (err, svg) => {
        if (err) return reject(err);
        resolve(svg);
      });
    });
  }

  /**
   * Associative logic: Determines if an extracted image belongs to Question Body or Option A/B/C/D
   * based on vertical and horizontal spatial bounds or text proximity.
   */
  static associateImageWithQuestionOrOption(
    imageY: number,
    questionBounds: {
      questionStartY: number;
      optionBounds: Array<{ label: string; startY: number; endY: number }>;
    }
  ): { target: 'question' | 'A' | 'B' | 'C' | 'D'; confidence: number } {
    if (!questionBounds.optionBounds || questionBounds.optionBounds.length === 0) {
      return { target: 'question', confidence: 0.95 };
    }

    const firstOptStartY = questionBounds.optionBounds[0].startY;
    if (imageY < firstOptStartY) {
      return { target: 'question', confidence: 0.92 };
    }

    for (const opt of questionBounds.optionBounds) {
      if (imageY >= opt.startY && imageY <= opt.endY) {
        return { target: opt.label as any, confidence: 0.88 };
      }
    }

    return { target: 'question', confidence: 0.75 };
  }
}
