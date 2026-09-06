import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ExcelGenerator } from '@/lib/excel/generator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // 1. Fetch project
    const { data: project, error: pErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (pErr || !project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // 2. Fetch all questions with options and images
    const { data: questions, error: qErr } = await supabase
      .from('questions')
      .select('*, options:question_options(*), images:question_images(*)')
      .eq('project_id', id)
      .order('question_number', { ascending: true });

    if (qErr) throw qErr;

    // 3. Generate Excel Buffer
    const excelBuffer = await ExcelGenerator.generateWorkbook({
      project,
      questions: questions || [],
    });

    const safeTitle = project.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeTitle}_QuestionBank.xlsx`;

    // Record export entry
    await supabase.from('exports').insert({
      project_id: id,
      user_id: project.user_id,
      file_name: fileName,
      storage_path: `exports/${project.user_id}/${id}/${fileName}`,
      file_size_bytes: excelBuffer.length,
      format: 'XLSX',
      question_count: questions?.length || 0,
      images_count: 0,
      download_count: 1,
    });

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': excelBuffer.length.toString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return GET(req, context);
}
