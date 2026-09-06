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
        """
        x_left = max(box1['x0'], box2['x0'])
        y_top = max(box1['y0'], box2['y0'])
        x_right = min(box1['x1'], box2['x1'])
        y_bottom = min(box1['y1'], box2['y1'])

        if x_right < x_left or y_bottom < y_top:
            return 0.0

        intersection_area = (x_right - x_left) * (y_bottom - y_top)
        box1_area = (box1['x1'] - box1['x0']) * (box1['y1'] - box1['y0'])
        box2_area = (box2['x1'] - box2['x0']) * (box2['y1'] - box2['y0'])

        ratio1 = intersection_area / box1_area if box1_area > 0 else 0.0
        ratio2 = intersection_area / box2_area if box2_area > 0 else 0.0

        return max(ratio1, ratio2)

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
        img_mid_x = (image_box["x0"] + image_box["x1"]) / 2.0

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

        # 1. Find containing question boundary
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

        if not option_bounds:
            return {
                "question_number": q_num,
                "target_type": "question",
                "option": None,
                "association_method": "geometric",
                "confidence": 0.95,
                "unmapped_reason": None
            }

        # 2. Check 2D bounding box overlap & Euclidean distance proximity to option labels
        best_label = None
        max_score = -1.0

        for opt in option_bounds:
            overlap = cls.calculate_bounding_box_overlap(image_box, opt)
            
            opt_mid_x = (opt["x0"] + opt["x1"]) / 2.0
            x_dist = abs(img_mid_x - opt_mid_x)
            y_dist = abs(img_y0 - opt["y1"]) if img_y0 >= opt["y1"] else abs(opt["y0"] - img_y1)
            
            dist = (x_dist ** 2 + y_dist ** 2) ** 0.5
            
            score = overlap + max(0.0, 1.0 - (dist / 150.0))

            if score > max_score:
                max_score = score
                best_label = opt.get("label")

        if best_label and max_score >= 0.35:
            return {
                "question_number": q_num,
                "target_type": "option",
                "option": best_label,
                "association_method": "geometric",
                "confidence": round(min(0.85 + (max_score * 0.08), 0.98), 2),
                "unmapped_reason": None
            }

        first_opt_y0 = min(opt["y0"] for opt in option_bounds)
        if image_box["y1"] <= first_opt_y0 + 5:
            return {
                "question_number": q_num,
                "target_type": "question",
                "option": None,
                "association_method": "geometric",
                "confidence": 0.96,
                "unmapped_reason": None
            }

        return {
            "question_number": q_num,
            "target_type": "question",
            "option": None,
            "association_method": "geometric",
            "confidence": 0.90,
            "unmapped_reason": None
        }
