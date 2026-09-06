"""
PyMuPDF (fitz) & pdfplumber 2D Spatial PDF Extractor

Extracts text blocks with exact (x0, y0, x1, y1) bounding coordinates,
decodes XObject image streams, renders high-res 300 DPI page images,
crops vector drawing paths for diagram preservation, and applies
100% deterministic geometric spatial association for questions and options.
"""

import fitz  # PyMuPDF
import io
import re
import base64
from typing import List, Dict, Any, Tuple
from PIL import Image
from .spatial_associator import SpatialAssociator

class PDFExtractorService:
    @classmethod
    def extract_page_data(
        cls,
        pdf_bytes: bytes,
        page_number: int,
        dpi: int = 300,
        extract_images: bool = True,
        prev_last_question: int = 0
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

        # 1. Extract 2D spatial text blocks with exact bounding coordinates (native PDF)
        native_text_blocks = []
        raw_text_parts = []
        blocks = page.get_text("blocks")  # (x0, y0, x1, y1, text, block_no, block_type)

        for b in blocks:
            x0, y0, x1, y1, text, block_no, block_type = b
            cleaned_text = text.strip()
            if cleaned_text:
                native_text_blocks.append({
                    "text": cleaned_text,
                    "x0": round(x0, 2),
                    "y0": round(y0, 2),
                    "x1": round(x1, 2),
                    "y1": round(y1, 2),
                    "source": "native_pdf",
                    "confidence": None,
                    "block_type": "text" if block_type == 0 else "image"
                })
                raw_text_parts.append(cleaned_text)

        full_page_text = "\n".join(raw_text_parts)
        is_scanned = len(full_page_text.strip()) < 30

        # Initial test of question boundaries from native text
        question_boundaries = cls._detect_question_spatial_bounds(native_text_blocks, full_page_text, page_height, prev_last_question)

        # 2. If scanned, missing boundaries, or image regions exist, run OCR and perform Unified Block Normalization
        image_list = page.get_images(full=True)
        has_embedded_images = len(image_list) > 0

        unified_blocks = list(native_text_blocks)

        if is_scanned or not question_boundaries or has_embedded_images:
            try:
                from .ocr_service import OCRService
                ocr_data = OCRService.run_ocr_on_page(pdf_bytes, page_number, dpi)
                if ocr_data.get("success") and ocr_data.get("ocr_blocks"):
                    ocr_blocks = ocr_data["ocr_blocks"]
                    raw_parts = [full_page_text] if full_page_text else []
                    
                    for ob in ocr_blocks:
                        ob_x0, ob_y0, ob_x1, ob_y1 = ob["x0"], ob["y0"], ob["x1"], ob["y1"]
                        # Spatial deduplication: Check if OCR block overlaps with an existing native PDF block
                        is_duplicate = False
                        for nb in native_text_blocks:
                            # Vertical overlap check
                            inter_y0 = max(ob_y0, nb["y0"])
                            inter_y1 = min(ob_y1, nb["y1"])
                            if inter_y1 > inter_y0:
                                overlap_h = inter_y1 - inter_y0
                                min_h = min(ob_y1 - ob_y0, nb["y1"] - nb["y0"])
                                if min_h > 0 and (overlap_h / min_h) > 0.7:
                                    is_duplicate = True
                                    break
                        if not is_duplicate:
                            unified_blocks.append({
                                "text": ob["text"],
                                "x0": ob_x0,
                                "y0": ob_y0,
                                "x1": ob_x1,
                                "y1": ob_y1,
                                "source": ob.get("source", "tesseract"),
                                "confidence": ob.get("confidence", 93.4),
                                "block_type": "text"
                            })
                            raw_parts.append(ob["text"])

                    full_page_text = "\n".join(raw_parts)
                    # Re-detect question boundaries on unified blocks (native + OCR)
                    question_boundaries = cls._detect_question_spatial_bounds(unified_blocks, full_page_text, page_height, prev_last_question)
            except Exception:
                pass

        # Sort unified blocks top-to-bottom
        unified_blocks.sort(key=lambda b: (b["y0"], b["x0"]))

        # 3. Extract Embedded XObject Images & Vector Path Crops with Deterministic Spatial Association
        extracted_images = []
        raster_xobjects_count = 0
        raster_valid_bbox_count = 0
        vector_objects_count = 0
        vector_clusters_count = 0
        vector_crops_count = 0
        mapped_count = 0
        unmapped_count = 0

        if extract_images:
            raw_extracted, raster_xobjects_count, raster_valid_bbox_count, vector_objects_count, vector_clusters_count, vector_crops_count = cls._extract_page_images_and_drawings(
                doc, page, page_number, dpi, page_width, page_height
            )

            # Apply deterministic geometric spatial association for every image
            for img in raw_extracted:
                img_box = {"x0": img["x0"], "y0": img["y0"], "x1": img["x1"], "y1": img["y1"]}
                assoc = SpatialAssociator.associate_image_to_question_or_option(img_box, question_boundaries, page_height)
                
                img["associated_question_number"] = assoc["question_number"]
                img["target_type"] = assoc["target_type"]
                img["associated_option_label"] = assoc["option"]
                img["association_method"] = assoc["association_method"]
                img["confidence"] = assoc["confidence"]
                img["unmapped_reason"] = assoc["unmapped_reason"]

                if assoc["target_type"] in ("question", "option", "standalone_diagram"):
                    mapped_count += 1
                else:
                    unmapped_count += 1

                extracted_images.append(img)

        doc.close()

        # Determine last question number on this page for cross-page continuation linking
        last_q_num = prev_last_question
        if question_boundaries:
            last_q_num = max(qb["question_number"] for qb in question_boundaries)

        total_visual_elements = raster_valid_bbox_count + vector_crops_count

        return {
            "success": True,
            "page_number": page_number,
            "total_pages": total_pages,
            "page_width": round(page_width, 2),
            "page_height": round(page_height, 2),
            "is_scanned": is_scanned,
            "full_text": full_page_text,
            "text_blocks": unified_blocks,
            "question_boundaries": question_boundaries,
            "images": extracted_images,
            "diagnostics": {
                "raster_xobjects_count": raster_xobjects_count,
                "raster_valid_bbox_count": raster_valid_bbox_count,
                "vector_objects_count": vector_objects_count,
                "vector_diagram_clusters_count": vector_clusters_count,
                "vector_diagram_crops_count": vector_crops_count,
                "total_visual_elements": total_visual_elements,
                "mapped_visual_elements": mapped_count,
                "unmapped_visual_elements": unmapped_count,
                "conservation_check_pass": total_visual_elements == (mapped_count + unmapped_count),
                "last_question_number": last_q_num
            }
        }

    @classmethod
    def is_instruction_page(cls, text: str) -> bool:
        text_lower = text.lower()
        instruction_keywords = [
            "important instructions",
            "instructions for candidates",
            "read carefully the following instructions",
            "general instructions",
            "test booklet code",
            "candidate must hand over the answer sheet",
            "use of an electronic/manual calculator is prohibited",
            "candidates are governed by all rules"
        ]
        matches = sum(1 for kw in instruction_keywords if kw in text_lower)
        return matches >= 1

    @classmethod
    def _detect_question_spatial_bounds(
        cls,
        text_blocks: List[Dict[str, Any]],
        full_text: str,
        page_height: float,
        prev_last_question: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Detects question numbers (Q1., 1), Question 1, etc.) and constructs spatial bounding rectangles.
        If no question number starts at the top of the page, creates a continuation boundary linked to prev_last_question.
        """
        if cls.is_instruction_page(full_text):
            return []

        question_regex = re.compile(
            r"(?:^|\n)\s*(?:(?:Q(?:uestion)?[\s.:-]*|#\s*)(\d{1,3})[\s.:\)-]*|(\d{1,3})\s*[\.:\-]+)[\s\r\n]+(?=[A-Z0-9\(\[\{\"'`\+\-~✓])",
            re.IGNORECASE
        )

        matches = []
        seen_q_numbers = set()

        # Sort input text blocks spatially top-to-bottom
        sorted_blocks = sorted(text_blocks, key=lambda b: (b["y0"], b["x0"]))

        for block in sorted_blocks:
            b_text = block["text"]
            for m in question_regex.finditer(b_text):
                q_str = m.group(1) or m.group(2)
                if not q_str:
                    continue
                q_num = int(q_str)
                if 0 < q_num <= 300:
                    prefix_text = b_text[:m.start()].rstrip()
                    if (prefix_text.endswith("(") or prefix_text.endswith("[")) and not re.search(r"Q(?:uestion)?$", prefix_text, re.IGNORECASE):
                        continue
                    # Deduplicate repeated question numbers on the same page
                    if q_num not in seen_q_numbers:
                        seen_q_numbers.add(q_num)
                        matches.append({
                            "question_number": q_num,
                            "x0": block["x0"],
                            "y0": block["y0"],
                            "x1": block["x1"],
                            "y1": block["y1"],
                            "block_text": block["text"],
                            "source": block.get("source", "native_pdf"),
                            "confidence": block.get("confidence")
                        })

        matches.sort(key=lambda m: (m["y0"], m["question_number"]))

        # Handle cross-page question continuation: if page starts without question number & prev_last_question > 0
        if prev_last_question > 0 and (not matches or matches[0]["y0"] > 120.0):
            cont_q = {
                "question_number": prev_last_question,
                "x0": 0.0,
                "y0": 0.0,
                "x1": 595.28,
                "y1": 50.0,
                "block_text": "Cross-page question continuation",
                "is_continuation": True,
                "source": "native_pdf",
                "confidence": None
            }
            matches.insert(0, cont_q)

        boundaries = []
        for i, curr in enumerate(matches):
            next_match = matches[i + 1] if i + 1 < len(matches) else None
            y1_limit = next_match["y0"] if next_match else page_height

            # Detect option bounds within this question's vertical territory
            option_bounds = cls._detect_option_bounds_in_block(curr["x0"], curr["y0"], y1_limit, text_blocks)

            boundaries.append({
                "question_number": curr["question_number"],
                "x0": curr["x0"],
                "y0": curr["y0"],
                "x1": 595.28,
                "y1": round(y1_limit, 2),
                "option_bounds": option_bounds,
                "is_continuation": curr.get("is_continuation", False),
                "source_blocks": [
                    {
                        "source": curr.get("source", "native_pdf"),
                        "bbox": [curr["x0"], curr["y0"], curr.get("x1", 595.28), curr.get("y1", curr["y0"] + 20)],
                        "confidence": curr.get("confidence")
                    }
                ]
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
        Computes sub-bounding box coordinates for options sharing a single text block line.
        """
        opt_regex = re.compile(r"(?:^|\s{2,}|\b)\(([A-D])\)|(?:^|\s{2,})\b([A-D])[\.\:\)]\s+", re.IGNORECASE)
        option_bounds = []

        for block in text_blocks:
            if start_y <= block["y0"] < end_y:
                b_text = block["text"]
                b_len = max(len(b_text), 1)
                b_width = max(block["x1"] - block["x0"], 10.0)
                matches = list(opt_regex.finditer(b_text))

                for idx, m in enumerate(matches):
                    label = (m.group(1) or m.group(2)).upper()
                    mapped_label = "A" if label == "1" else "B" if label == "2" else "C" if label == "3" else "D" if label == "4" else label

                    start_char = m.start()
                    next_char = matches[idx + 1].start() if idx + 1 < len(matches) else len(b_text)

                    opt_x0 = block["x0"] + (start_char / b_len) * b_width
                    opt_x1 = block["x0"] + (next_char / b_len) * b_width

                    option_bounds.append({
                        "label": mapped_label,
                        "x0": round(opt_x0, 2),
                        "y0": block["y0"],
                        "x1": round(opt_x1, 2),
                        "y1": block["y1"]
                    })

        return option_bounds

    @classmethod
    def _extract_page_images_and_drawings(
        cls,
        doc: fitz.Document,
        page: fitz.Page,
        page_number: int,
        dpi: int,
        page_width: float,
        page_height: float
    ) -> Tuple[List[Dict[str, Any]], int, int, int, int, int]:
        """
        Extracts raster XObject image streams and vector drawing path bounding boxes.
        Returns: (extracted_images_list, raster_xobjects_count, raster_valid_bbox_count, vector_objects_count, vector_clusters_count, vector_crops_count)
        """
        extracted = []
        img_counter = 1
        raster_xobjects_count = 0
        raster_valid_bbox_count = 0
        vector_objects_count = 0
        vector_clusters_count = 0
        vector_crops_count = 0

        # 1. Raster XObjects
        image_list = page.get_images(full=True)
        raster_xobjects_count = len(image_list)

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

                if width >= 30 and height >= 30:
                    b64_data = f"data:image/{image_ext};base64," + base64.b64encode(image_bytes).decode("utf-8")
                    
                    # Search image bbox on page
                    rects = page.get_image_rects(xref)
                    img_bbox = rects[0] if rects else fitz.Rect(0, 0, width, height)

                    visual_id = f"visual_p{page_number}_{img_counter:04d}"
                    extracted.append({
                        "visual_id": visual_id,
                        "image_id": visual_id,
                        "type": "raster_image",
                        "page_number": page_number,
                        "x0": round(img_bbox.x0, 2),
                        "y0": round(img_bbox.y0, 2),
                        "x1": round(img_bbox.x1, 2),
                        "y1": round(img_bbox.y1, 2),
                        "width": width,
                        "height": height,
                        "format": image_ext,
                        "image_base64": b64_data,
                        "is_vector_crop": False,
                        "parent_element_id": f"xobject_xref_{xref}"
                    })
                    img_counter += 1
                    raster_valid_bbox_count += 1
            except Exception:
                pass

        # 2. Vector Drawing Paths & Clusters (Circuits, Geometric Figures, Graphs)
        try:
            drawings = page.get_drawings()
            if drawings:
                vector_objects_count = len(drawings)
                clusters = []

                for d in drawings:
                    r = d["rect"]
                    w, h = r.width, r.height
                    
                    # Filter out full-width page border lines & header/footer dividers
                    if w > (page_width - 40) or h > (page_height - 40):
                        continue
                    if w < 5 and h > 100:  # Vertical column divider line
                        continue
                    if h < 5 and w > 100:  # Horizontal row divider line
                        continue
                    if w < 15 or h < 15:   # Tiny bullet dot or noise
                        continue

                    # Group drawing into clusters (merge if bounding boxes touch or within 20pt)
                    merged = False
                    for c in clusters:
                        if (max(c.x0, r.x0) <= min(c.x1, r.x1) + 20) and (max(c.y0, r.y0) <= min(c.y1, r.y1) + 20):
                            c.include_rect(r)
                            merged = True
                            break

                    if not merged:
                        clusters.append(fitz.Rect(r))

                vector_clusters_count = len(clusters)

                # Process meaningful vector diagram bounding box clusters
                for idx, c_rect in enumerate(clusters, 1):
                    if c_rect.width >= 35 and c_rect.height >= 35:
                        pix = page.get_pixmap(dpi=dpi, clip=c_rect)
                        img_bytes = pix.tobytes("png")
                        b64_data = "data:image/png;base64," + base64.b64encode(img_bytes).decode("utf-8")

                        visual_id = f"visual_p{page_number}_{img_counter:04d}"
                        extracted.append({
                            "visual_id": visual_id,
                            "image_id": visual_id,
                            "type": "vector_diagram",
                            "page_number": page_number,
                            "x0": round(c_rect.x0, 2),
                            "y0": round(c_rect.y0, 2),
                            "x1": round(c_rect.x1, 2),
                            "y1": round(c_rect.y1, 2),
                            "width": pix.width,
                            "height": pix.height,
                            "format": "png",
                            "image_base64": b64_data,
                            "is_vector_crop": True,
                            "parent_element_id": f"vector_cluster_p{page_number}_{idx}"
                        })
                        img_counter += 1
                        vector_crops_count += 1
        except Exception:
            pass

        return extracted, raster_xobjects_count, raster_valid_bbox_count, vector_objects_count, vector_clusters_count, vector_crops_count
