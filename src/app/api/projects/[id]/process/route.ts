import { NextRequest, NextResponse } from 'next/server';
import { QuestionForgePipeline } from '@/lib/processing/pipeline';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: project, error: pErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (pErr || !project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    let pdfBuffer: Buffer;
    let fileName = `${project.name}.pdf`;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (file) {
        const arrayBuf = await file.arrayBuffer();
        pdfBuffer = Buffer.from(arrayBuf);
        fileName = file.name || fileName;
      } else {
        return NextResponse.json({ success: false, error: 'No PDF file in form data' }, { status: 400 });
      }
    } else {
      // Synthetic benchmark PDF generator for NEET/JEE when testing directly
      const mockPdfText = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 650 >> stream
BT
/F1 12 Tf
70 700 Td
(NEET UG MOCK TEST PAPER - FULL SYLLABUS) Tj
0 -30 Td
(1. A particle of mass m is projected with velocity v at an angle of 45 deg with the horizontal.) Tj
0 -15 Td
((A) mv / sqrt(2)) Tj
0 -15 Td
((B) mv * sqrt(2)) Tj
0 -15 Td
((C) 2mv) Tj
0 -15 Td
((D) Zero) Tj
0 -30 Td
(2. Which of the following oxides of Nitrogen is paramagnetic in nature in gaseous state?) Tj
0 -15 Td
((A) N2O) Tj
0 -15 Td
((B) NO2) Tj
0 -15 Td
((C) N2O4) Tj
0 -15 Td
((D) N2O5) Tj
0 -30 Td
(3. In human reproduction, the process of capacitation occurs in:) Tj
0 -15 Td
((A) Epididymis) Tj
0 -15 Td
((B) Vas deferens) Tj
0 -15 Td
((C) Female reproductive tract) Tj
0 -15 Td
((D) Rete testis) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000118 00000 n 
0000000217 00000 n 
0000000293 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
995
%%EOF`;
      pdfBuffer = Buffer.from(mockPdfText, 'utf-8');
    }

    // Launch pipeline execution
    // Run asynchronously to allow instant UI response while tracking status
    QuestionForgePipeline.run({
      projectId: id,
      pdfBuffer,
      fileName,
      userId: project.user_id,
    }).catch((err) => {
      console.error('Background pipeline error:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'Processing initiated successfully',
      projectId: id,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
