"""
PyMuPDF (fitz) & pdfplumber 2D Spatial PDF Extractor

Extracts text blocks with exact (x0, y0, x1, y1) bounding coordinates,
decodes XObject image streams, renders high-res 300 DPI page images,
and crops vector drawing paths for diagram preservation.
"""

import fitz  # PyMuPDF
import io
import re
import base64
from typing import List, Dict, Any, Tuple
from PIL import Image

class PDFExtractorService:
    @classmethod
    def extract_page_data(
        cls,
        pdf_bytes: bytes,
        page_number: int,
        dpi: int = 300,
        extract_images: bool = True
    ) -> Dict[str, Any]:
        """
        Parses a single page from a PDF byte buffer and returns structured 2D spatial data.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)

        if page_number < 1 or page_number > total_pages:
            raise ValueError(f"Page number {page_number} out of bounds (1-{total_pages})")

        page_idx = page_number - 1
        page = doc[page_idx]
        rect = page.rect

        page_width = rect.width
        page_height = rect.height

        # 1. Extract 2D spatial text blocks with exact bounding coordinates
        text_blocks = []
        raw_text_parts = []
        blocks = page.get_text("blocks")  # (x0, y0, x1, y1, text, block_no, block_type)

        for b in blocks:
            x0, y0, x1, y1, text, block_no, block_type = b
            cleaned_text = text.strip()
            if cleaned_text:
                text_blocks.append({
                    "text": cleaned_text,
                    "x0": round(x0, 2),
                    "y0": round(y0, 2),
                    "x1": round(x1, 2),
                    "y1": round(y1, 2),
                    "block_type": "text" if block_type == 0 else "image"
                })
                raw_text_parts.append(cleaned_text)

        full_page_text = "\n".join(raw_text_parts)
        is_scanned = len(full_page_text.strip()) < 30

        # 2. Detect Question Boundaries with Spatial Y-Bounds
        question_boundaries = cls._detect_question_spatial_bounds(text_blocks, full_page_text)

        # 3. Extract Embedded XObject Images & Vector Path Crops
        extracted_images = []
        if extract_images:
            extracted_images = cls._extract_page_images_and_drawings(doc, page, page_number, dpi)

        doc.close()

        return {
            "success": True,
            "page_number": page_number,
            "total_pages": total_pages,
            "page_width": round(page_width, 2),
            "page_height": round(page_height, 2),
            "is_scanned": is_scanned,
            "full_text": full_page_text,
            "text_blocks": text_blocks,
            "question_boundaries": question_boundaries,
            "images": extracted_images
        }

    @classmethod
    def _detect_question_spatial_bounds(cls, text_blocks: List[Dict[str, Any]], full_text: str) -> List[Dict[str, Any]]:
        """
        Detects question numbers (Q1., 1), Question 1, etc.) and constructs spatial bounding rectangles.
        """
        question_regex = re.compile(
            r"(?:^|\n)\s*(?:Q(?:uestion)?[\s.:-]*|#\s*)?(\d{1,3})[\s.:\)-]+(?=[A-Z0-9\(\[\{\"'`\+\-~✓])",
            re.IGNORECASE
        )
        
        matches = []
        for block in text_blocks:
            for m in question_regex.finditer(block["text"]):
                q_num = int(m.group(1))
                if 0 < q_num <= 300:
                    matches.append({
                        "question_number": q_num,
                        "x0": block["x0"],
                        "y0": block["y0"],
                        "block_text": block["text"]
                    })

        matches.sort(key=lambda m: (m["y0"], m["question_number"]))

        boundaries = []
        for i, curr in enumerate(matches):
            next_match = matches[i + 1] if i + 1 < len(matches) else None
            y1_limit = next_match["y0"] if next_match else 842.0

            # Detect option bounds within this question's vertical territory
            option_bounds = cls._detect_option_bounds_in_block(curr["x0"], curr["y0"], y1_limit, text_blocks)

            boundaries.append({
                "question_number": curr["question_number"],
                "x0": curr["x0"],
                "y0": curr["y0"],
                "x1": 595.28,
                "y1": round(y1_limit, 2),
                "option_bounds": option_bounds
            })

        return boundaries

    @classmethod
    def _detect_option_bounds_in_block(
        cls,
        start_x: float,
        start_y: float,
        end_y: float,
        text_blocks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Locates (A), (B), (C), (D) option labels within vertical boundaries.
        """
        opt_regex = re.compile(r"(?:^|\s{2,})(?:\(([A-D1-4])\)|([A-D1-4])[\.\:\)])\s*", re.IGNORECASE)
        option_bounds = []

        for block in text_blocks:
            if start_y <= block["y0"] < end_y:
                for m in opt_regex.finditer(block["text"]):
                    label = (m.group(1) or m.group(2)).upper()
                    mapped_label = "A" if label == "1" else "B" if label == "2" else "C" if label == "3" else "D" if label == "4" else label
                    option_bounds.append({
                        "label": mapped_label,
                        "x0": block["x0"],
                        "y0": block["y0"],
                        "x1": block["x1"],
                        "y1": block["y1"]
                    })

        return option_bounds

    @classmethod
    def _extract_page_images_and_drawings(
        cls,
        doc: fitz.Document,
        page: fitz.Page,
        page_number: int,
        dpi: int
    ) -> List[Dict[str, Any]]:
        """
        Extracts raster XObject image streams and vector drawing path bounding boxes.
        """
        extracted = []
        img_counter = 1

        # 1. Raster XObjects
        image_list = page.get_images(full=True)
        for img_info in image_list:
            xref = img_info[0]
            try:
                base_image = doc.extract_image(xref)
                if not base_image:
                    continue

                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                width = base_image["width"]
                height = base_image["height"]

                if width >= 40 and height >= 40:
                    b64_data = f"data:image/{image_ext};base64," + base64.b64encode(image_bytes).decode("utf-8")
                    
                    # Search image bbox on page
                    rects = page.get_image_rects(xref)
                    img_bbox = rects[0] if rects else fitz.Rect(0, 0, width, height)

                    extracted.append({
                        "image_id": f"img_p{page_number}_{img_counter}",
                        "x0": round(img_bbox.x0, 2),
                        "y0": round(img_bbox.y0, 2),
                        "x1": round(img_bbox.x1, 2),
                        "y1": round(img_bbox.y1, 2),
                        "width": width,
                        "height": height,
                        "format": image_ext,
                        "image_base64": b64_data,
                        "is_vector_crop": False
                    })
                    img_counter += 1
            except Exception:
                pass

        # 2. Vector Drawing Paths (Circuits, Geometric Figures, Graphs)
        try:
            drawings = page.get_drawings()
            if drawings:
                # Group vector drawing bounding boxes
                vector_rects = [d["rect"] for d in drawings if d["rect"].width > 50 and d["rect"].height > 50]
                for v_rect in vector_rects[:3]: # Limit to top 3 vector diagram crops per page
                    pix = page.get_pixmap(dpi=dpi, clip=v_rect)
                    img_bytes = pix.tobytes("png")
                    b64_data = "data:image/png;base64," + base64.b64encode(img_bytes).decode("utf-8")

                    extracted.append({
                        "image_id": f"vec_p{page_number}_{img_counter}",
                        "x0": round(v_rect.x0, 2),
                        "y0": round(v_rect.y0, 2),
                        "x1": round(v_rect.x1, 2),
                        "y1": round(v_rect.y1, 2),
                        "width": pix.width,
                        "height": pix.height,
                        "format": "png",
                        "image_base64": b64_data,
                        "is_vector_crop": True
                    })
                    img_counter += 1
        except Exception:
            pass

        return extracted
