"""
PyMuPDF & Tesseract / OpenCV High-Res Page Renderer & OCR Engine

Renders PDF pages to 300 DPI images for scanned document parsing, 
text line reconstruction, bounding box layout extraction, and confidence scoring.
"""

import fitz  # PyMuPDF
import io
import base64
import cv2
import numpy as np
from PIL import Image
from typing import Dict, Any, List

try:
    import pytesseract
    HAS_PYTESSERACT = True
except ImportError:
    HAS_PYTESSERACT = False

class OCRService:
    @classmethod
    def render_page_to_image(cls, pdf_bytes: bytes, page_number: int, dpi: int = 300) -> Dict[str, Any]:
        """
        Renders a PDF page to a high-resolution 300 DPI PNG image buffer.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if page_number < 1 or page_number > len(doc):
            doc.close()
            raise ValueError(f"Page number {page_number} out of bounds")

        page = doc[page_number - 1]
        pix = page.get_pixmap(dpi=dpi)
        img_bytes = pix.tobytes("png")
        b64_data = "data:image/png;base64," + base64.b64encode(img_bytes).decode("utf-8")

        width = pix.width
        height = pix.height
        doc.close()

        return {
            "success": True,
            "page_number": page_number,
            "width": width,
            "height": height,
            "dpi": dpi,
            "image_base64": b64_data
        }

    @classmethod
    def run_ocr_on_page(cls, pdf_bytes: bytes, page_number: int, dpi: int = 300) -> Dict[str, Any]:
        """
        Executes OCR layout analysis on scanned/native pages using PyMuPDF + OpenCV + PyTesseract pipeline.
        Returns recognized text lines, bounding boxes [x0, y0, x1, y1], and confidence scores.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if page_number < 1 or page_number > len(doc):
            doc.close()
            raise ValueError(f"Page number {page_number} out of bounds")

        page = doc[page_number - 1]
        rect = page.rect
        page_width, page_height = rect.width, rect.height

        ocr_blocks = []
        full_text = ""
        ocr_engine_used = "PyMuPDF-Native"

        # 1. First check if native text layout blocks exist
        text_blocks = page.get_text("blocks")
        has_native_text = False

        if text_blocks:
            for b in text_blocks:
                b_text = b[4].strip() if len(b) > 4 else ""
                if b_text:
                    has_native_text = True
                    ocr_blocks.append({
                        "text": b_text,
                        "x0": round(b[0], 2),
                        "y0": round(b[1], 2),
                        "x1": round(b[2], 2),
                        "y1": round(b[3], 2),
                        "confidence": 99.0,
                        "type": "native_text_block"
                    })
            full_text = page.get_text("text").strip()

        # 2. If no native text found or scanned page, run OpenCV + PyTesseract or PyMuPDF OCR
        if not has_native_text:
            pix = page.get_pixmap(dpi=dpi)
            img_bytes = pix.tobytes("png")
            nparr = np.frombuffer(img_bytes, np.uint8)
            cv_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            # Preprocess image with OpenCV (Grayscale + OTSU Thresholding)
            gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)

            pil_img = Image.fromarray(thresh)

            if HAS_PYTESSERACT:
                try:
                    data = pytesseract.image_to_data(pil_img, output_type=pytesseract.Output.DICT)
                    ocr_engine_used = "PyTesseract-OpenCV"
                    n_boxes = len(data['text'])
                    scale_x = page_width / pix.width
                    scale_y = page_height / pix.height

                    current_line = []
                    for i in range(n_boxes):
                        txt = data['text'][i].strip()
                        conf = float(data['conf'][i])
                        if txt and conf > 0:
                            x0 = round(data['left'][i] * scale_x, 2)
                            y0 = round(data['top'][i] * scale_y, 2)
                            w = data['width'][i] * scale_x
                            h = data['height'][i] * scale_y
                            x1 = round(x0 + w, 2)
                            y1 = round(y0 + h, 2)

                            ocr_blocks.append({
                                "text": txt,
                                "x0": x0,
                                "y0": y0,
                                "x1": x1,
                                "y1": y1,
                                "confidence": round(conf, 1),
                                "type": "ocr_word"
                            })
                            current_line.append(txt)
                    full_text = " ".join(current_line)
                except Exception as e:
                    ocr_engine_used = "OpenCV-Fallback"
            
            # PyMuPDF get_textpage_ocr fallback if pytesseract not bound
            if not ocr_blocks:
                try:
                    tp = page.get_textpage_ocr(dpi=dpi, full=True)
                    ocr_text = tp.extractText().strip()
                    full_text = ocr_text
                    ocr_engine_used = "PyMuPDF-Tesseract"
                    ocr_blocks.append({
                        "text": ocr_text,
                        "x0": 0.0,
                        "y0": 0.0,
                        "x1": round(page_width, 2),
                        "y1": round(page_height, 2),
                        "confidence": 90.0,
                        "type": "ocr_textpage"
                    })
                except Exception:
                    pass

        doc.close()

        return {
            "success": True,
            "page_number": page_number,
            "ocr_applied": True,
            "ocr_engine": ocr_engine_used,
            "full_text": full_text,
            "ocr_blocks_count": len(ocr_blocks),
            "ocr_blocks": ocr_blocks
        }
