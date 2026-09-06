import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ProjectStore } from '@/lib/projects/store';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    let projectsList = await ProjectStore.listProjects();

    if (userId) {
      projectsList = projectsList.filter((p) => p.user_id === userId);
    }

    return NextResponse.json({ success: true, projects: projectsList });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to list projects' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    const supabaseServer = await createServerSupabaseClient();
    const { data: { user } } = await supabaseServer.auth.getUser();

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data') || contentType.includes('form-data')) {
      const formData = await req.formData();
      body = {
        name: formData.get('name')?.toString(),
        exam_type: formData.get('exam_type')?.toString(),
        year: formData.get('year')?.toString(),
        subject_focus: formData.get('subject_focus')?.toString(),
        description: formData.get('description')?.toString(),
        image_settings: {
          extract_images: formData.get('extract_images') === 'true',
          compress_images: formData.get('compress_images') === 'true',
          compression_level: formData.get('compression_level')?.toString() || 'Medium',
          convert_to_svg: formData.get('convert_to_svg') === 'true',
          keep_original_images: formData.get('keep_original_images') === 'true',
        },
      };
    } else {
      body = await req.json();
    }

    const {
      name,
      exam_type = 'NEET',
      year = new Date().getFullYear(),
      subject_focus,
      description,
      image_settings,
      user_id,
    } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Project name is required' }, { status: 400 });
    }

    const expectedQuestions = exam_type === 'NEET' ? 180 : exam_type === 'JEE_MAIN' ? 90 : 100;
    const targetUserId = user?.id || user_id || '00000000-0000-0000-0000-000000000001';

    // ALWAYS generate a REAL UUID for the project
    const realProjectId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const newProjectRecord = {
      id: realProjectId,
      user_id: targetUserId,
      name,
      exam_type,
      year: Number(year),
      subject_focus: subject_focus || null,
      description: description || null,
      status: 'UPLOADED',
      expected_questions: expectedQuestions,
      extracted_questions: 0,
      needs_review_count: 0,
      image_settings: image_settings || {
        extract_images: true,
        compress_images: true,
        compression_level: 'High',
        convert_to_svg: false,
        keep_original_images: true,
      },
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Save project using ProjectStore (use user session client if authenticated, else admin client for guest projects)
    const clientToUse = user ? supabaseServer : undefined;
    const savedProject = await ProjectStore.saveProject(newProjectRecord, clientToUse);

    // If storage_path or file_name is present, save document record
    if (body.storage_path || body.file_name) {
      await ProjectStore.saveDocument({
        id: crypto.randomUUID(),
        project_id: realProjectId,
        user_id: targetUserId,
        file_name: body.file_name || `${name}.pdf`,
        file_size_bytes: Number(body.file_size) || 0,
        mime_type: 'application/pdf',
        storage_path: body.storage_path || `uploads/${targetUserId}/${realProjectId}/original.pdf`,
        page_count: 0,
        created_at: nowIso,
      });
    }

    return NextResponse.json({ success: true, project: savedProject });
  } catch (err: any) {
    console.error('[POST /api/projects] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Project creation failed' }, { status: 500 });
  }
}
