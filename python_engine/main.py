"""
QuestionForge AI - Python Document Engine Microservice

FastAPI application providing 2D spatial coordinate layout extraction,
XObject & vector diagram rendering, PaddleOCR scanned PDF processing,
and deterministic bounding-box image association.
"""

import base64
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from services.pdf_extractor import PDFExtractorService
from services.ocr_service import OCRService
from services.spatial_associator import SpatialAssociator

app = FastAPI(
    title="QuestionForge AI Document Engine",
    version="1.0.0",
    description="High-fidelity 2D spatial PDF layout analysis microservice"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class ExtractPageRequest(BaseModel):
    pdf_base64: str = Field(..., description="Base64 encoded PDF file string")
    page_number: int = Field(1, description="Page number to parse (1-indexed)")
    dpi: Optional[int] = Field(300, description="DPI for page rendering and vector crops")
    extract_images: Optional[bool] = Field(True, description="Whether to extract embedded XObjects and vector crops")

class OCRPageRequest(BaseModel):
    pdf_base64: str
    page_number: int = 1
    dpi: Optional[int] = 300

class AssociateImageRequest(BaseModel):
    image_box: Dict[str, float]
    question_bound: Dict[str, Any]

# Endpoints
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "QuestionForge Python Document Engine", "version": "1.0.0"}

@app.post("/api/v1/extract-page")
def extract_page(req: ExtractPageRequest):
    try:
        pdf_bytes = base64.b64decode(req.pdf_base64)
        result = PDFExtractorService.extract_page_data(
            pdf_bytes=pdf_bytes,
            page_number=req.page_number,
            dpi=req.dpi or 300,
            extract_images=req.extract_images if req.extract_images is not None else True
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ocr-page")
def ocr_page(req: OCRPageRequest):
    try:
        pdf_bytes = base64.b64decode(req.pdf_base64)
        result = OCRService.run_ocr_on_page(
            pdf_bytes=pdf_bytes,
            page_number=req.page_number,
            dpi=req.dpi or 300
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/render-page")
def render_page(req: OCRPageRequest):
    try:
        pdf_bytes = base64.b64decode(req.pdf_base64)
        result = OCRService.render_page_to_image(
            pdf_bytes=pdf_bytes,
            page_number=req.page_number,
            dpi=req.dpi or 300
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/associate-image")
def associate_image(req: AssociateImageRequest):
    try:
        result = SpatialAssociator.associate_image_to_question_or_option(
            image_box=req.image_box,
            question_bound=req.question_bound
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
