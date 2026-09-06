"""
2D Spatial Bounding-Box Overlap & Association Engine

Calculates deterministic spatial relationships between PDF text blocks,
extracted diagram images, question boundaries, and option rectangles.
Replaces arbitrary index division with exact (x0, y0, x1, y1) 2D bounding box geometry.
"""

from typing import List, Dict, Any, Optional

class SpatialAssociator:
    @staticmethod
    def calculate_bounding_box_overlap(box1: Dict[str, float], box2: Dict[str, float]) -> float:
        """
        Calculates Intersection-over-Area ratio for box1 relative to box2.
        Box format: {'x0': float, 'y0': float, 'x1': float, 'y1': float}
        """
        x_left = max(box1['x0'], box2['x0'])
        y_top = max(box1['y0'], box2['y0'])
        x_right = min(box1['x1'], box2['x1'])
        y_bottom = min(box1['y1'], box2['y1'])

        if x_right < x_left or y_bottom < y_top:
            return 0.0

        intersection_area = (x_right - x_left) * (y_bottom - y_top)
        box1_area = (box1['x1'] - box1['x0']) * (box1['y1'] - box1['y0'])

        return intersection_area / box1_area if box1_area > 0 else 0.0

    @classmethod
    def associate_image_to_question_or_option(
        cls,
        image_box: Dict[str, float],
        question_boundaries: List[Dict[str, Any]],
        page_height: float = 842.0
    ) -> Dict[str, Any]:
        """
        Determines deterministic spatial association for an image/vector diagram against question boundaries.
        Returns:
          - question_number: int | None
          - target_type: 'question' | 'option' | 'standalone_diagram' | 'unmapped'
          - option: 'A' | 'B' | 'C' | 'D' | None
          - association_method: 'geometric'
          - confidence: float
          - unmapped_reason: str | None
        """
        if not question_boundaries:
            return {
                "question_number": None,
                "target_type": "unmapped",
                "option": None,
                "association_method": "geometric",
                "confidence": 0.0,
                "unmapped_reason": "no_question_boundaries_on_page"
            }

        img_y0 = image_box["y0"]
        img_y1 = image_box["y1"]
        img_mid_y = (img_y0 + img_y1) / 2.0

        # Ignore header/footer margin images (y < 35 or y > page_height - 35)
        if img_y1 < 35 or img_y0 > (page_height - 35):
            return {
                "question_number": None,
                "target_type": "unmapped",
                "option": None,
                "association_method": "geometric",
                "confidence": 0.0,
                "unmapped_reason": "page_header_footer_margin"
            }

        # 1. Find containing question boundary (where img_mid_y falls within question y0 and y1)
        matching_q = None
        for qb in question_boundaries:
            if qb["y0"] - 15 <= img_mid_y <= qb["y1"] + 15:
                matching_q = qb
                break

        # Fallback to closest question boundary by vertical distance
        if not matching_q:
            min_dist = float("inf")
            for qb in question_boundaries:
                dist = min(abs(img_mid_y - qb["y0"]), abs(img_mid_y - qb["y1"]))
                if dist < min_dist:
                    min_dist = dist
                    matching_q = qb

        if not matching_q:
            return {
                "question_number": None,
                "target_type": "unmapped",
                "option": None,
                "association_method": "geometric",
                "confidence": 0.0,
                "unmapped_reason": "outside_all_question_boundaries"
            }

        q_num = matching_q["question_number"]
        option_bounds = matching_q.get("option_bounds", [])

        # If no options detected in question boundary -> Question Stem diagram
        if not option_bounds:
            return {
                "question_number": q_num,
                "target_type": "question",
                "option": None,
                "association_method": "geometric",
                "confidence": 0.95,
                "unmapped_reason": None
            }

        # Find top Y coordinate of the first option label
        first_opt_y0 = min(opt["y0"] for opt in option_bounds)

        # 2. If image is physically situated above option labels -> Question Stem Diagram
        if img_y1 <= first_opt_y0 + 10:
            return {
                "question_number": q_num,
                "target_type": "question",
                "option": None,
                "association_method": "geometric",
                "confidence": 0.96,
                "unmapped_reason": None
            }

        # 3. Check exact 2D bounding box overlap with option rectangles
        best_label = None
        max_overlap = 0.0

        for opt in option_bounds:
            overlap = cls.calculate_bounding_box_overlap(image_box, opt)
            if overlap > max_overlap:
                max_overlap = overlap
                best_label = opt.get("label")

        if best_label and max_overlap >= 0.15:
            return {
                "question_number": q_num,
                "target_type": "option",
                "option": best_label,
                "association_method": "geometric",
                "confidence": round(0.85 + (max_overlap * 0.14), 2),
                "unmapped_reason": None
            }

        # 4. Fallback based on mid-point Y matching option Y-interval
        for opt in option_bounds:
            if opt["y0"] - 5 <= img_mid_y <= opt["y1"] + 5:
                return {
                    "question_number": q_num,
                    "target_type": "option",
                    "option": opt.get("label"),
                    "association_method": "geometric",
                    "confidence": 0.88,
                    "unmapped_reason": None
                }

        # Default fallback to question stem
        return {
            "question_number": q_num,
            "target_type": "question",
            "option": None,
            "association_method": "geometric",
            "confidence": 0.90,
            "unmapped_reason": None
        }
