"""
Coordinate Transformation Utility

Provides explicit, bi-directional transformation between rendered image pixels 
(pixel_x0, pixel_y0, pixel_x1, pixel_y1) and standard PDF points (x0, y0, x1, y1)
taking into account actual page dimensions, rendering DPI, and orientation.
"""

from typing import List, Tuple, Dict, Any

class CoordinateTransformer:
    @staticmethod
    def pixels_to_pdf_points(
        bbox_pixels: Tuple[float, float, float, float],
        page_width_pts: float,
        page_height_pts: float,
        img_width_px: int,
        img_height_px: int
    ) -> Tuple[float, float, float, float]:
        """
        Converts pixel coordinates [px0, py0, px1, py1] to standard PDF point coordinates [x0, y0, x1, y1].
        """
        if img_width_px <= 0 or img_height_px <= 0:
            return bbox_pixels

        scale_x = page_width_pts / float(img_width_px)
        scale_y = page_height_pts / float(img_height_px)

        px0, py0, px1, py1 = bbox_pixels
        x0 = round(px0 * scale_x, 2)
        y0 = round(py0 * scale_y, 2)
        x1 = round(px1 * scale_x, 2)
        y1 = round(py1 * scale_y, 2)

        return (x0, y0, x1, y1)

    @staticmethod
    def pdf_points_to_pixels(
        bbox_pts: Tuple[float, float, float, float],
        page_width_pts: float,
        page_height_pts: float,
        dpi: int = 300
    ) -> Tuple[int, int, int, int]:
        """
        Converts PDF point coordinates [x0, y0, x1, y1] to rendered image pixels at given DPI.
        (1 pt = 1/72 inch).
        """
        scale = dpi / 72.0
        x0, y0, x1, y1 = bbox_pts

        px0 = int(round(x0 * scale))
        py0 = int(round(y0 * scale))
        px1 = int(round(x1 * scale))
        py1 = int(round(y1 * scale))

        return (px0, py0, px1, py1)
