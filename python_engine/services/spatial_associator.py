"""
2D Spatial Bounding-Box Overlap & Association Engine

Calculates deterministic spatial relationships between PDF text blocks,
extracted diagram images, question boundaries, and option rectangles.
Replaces arbitrary index division (imageIndex % 4) with exact (x0, y0, x1, y1) bounding box geometry.
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
        question_bound: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Determines whether an image belongs to the Question Statement or Option A/B/C/D
        based on exact Y-position intervals and 2D bounding boxes.
        """
        option_bounds = question_bound.get('option_bounds', [])
        
        if not option_bounds:
            return {'target': 'question', 'confidence': 0.95, 'option_id': None}

        # Find top Y of the first option
        first_opt_y0 = min(opt['y0'] for opt in option_bounds)

        # 1. If image is physically situated above the options -> Question Diagram
        if image_box['y1'] <= first_opt_y0 + 5:
            return {'target': 'question', 'confidence': 0.96, 'option_id': None}

        # 2. Check overlap with individual option bounding boxes
        best_label = None
        max_overlap = 0.0

        for opt in option_bounds:
            overlap = cls.calculate_bounding_box_overlap(image_box, opt)
            if overlap > max_overlap:
                max_overlap = overlap
                best_label = opt.get('label')

        if best_label and max_overlap >= 0.2:
            return {'target': best_label, 'confidence': round(0.85 + (max_overlap * 0.14), 2), 'option_id': None}

        # Fallback based on mid-point Y
        img_mid_y = (image_box['y0'] + image_box['y1']) / 2.0
        for opt in option_bounds:
            if opt['y0'] <= img_mid_y <= opt['y1']:
                return {'target': opt['label'], 'confidence': 0.82, 'option_id': None}

        return {'target': 'question', 'confidence': 0.75, 'option_id': None}
