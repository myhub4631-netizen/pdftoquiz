import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProjectStore } from '@/lib/projects/store';
import { ExcelGenerator } from '@/lib/excel/generator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // 1. Fetch project via ProjectStore
    const project = await ProjectStore.getProject(id);

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // 2. Fetch all questions via ProjectStore (merging DB + Memory)
    const questions = await ProjectStore.getQuestions(id);

    // 3. Generate Excel Buffer
    const excelBuffer = await ExcelGenerator.generateWorkbook({
      project: project as any,
      questions: questions as any[],
    });

    const safeTitle = (project.name || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeTitle}_QuestionBank.xlsx`;

    // Record export entry
    try {
      await supabase.from('exports').insert({
        project_id: id,
        user_id: project.user_id,
        file_name: fileName,
        storage_path: `exports/${project.user_id}/${id}/${fileName}`,
        file_size_bytes: excelBuffer.length,
        format: 'XLSX',
        question_count: questions.length,
        images_count: 0,
        download_count: 1,
      });
    } catch {
      // Continue
    }

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': excelBuffer.length.toString(),
      },
    });
  } catch (err: any) {
    console.error('[GET /api/projects/[id]/export] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return GET(req, context);
}
