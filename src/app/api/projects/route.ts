import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    let query = supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: projects, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, projects: projects || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const {
      name,
      exam_type = 'NEET',
      year = new Date().getFullYear(),
      subject_focus,
      description,
      image_settings,
      user_id = '00000000-0000-0000-0000-000000000001', // Fallback default user ID if not authenticated
    } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Project name is required' }, { status: 400 });
    }

    const expectedQuestions = exam_type === 'NEET' ? 180 : exam_type === 'JEE_MAIN' ? 90 : 100;

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id,
        name,
        exam_type,
        year: Number(year),
        subject_focus: subject_focus || null,
        description: description || null,
        status: 'UPLOADED',
        expected_questions: expectedQuestions,
        image_settings: image_settings || {
          extract_images: true,
          compress_images: true,
          compression_level: 'High',
          convert_to_svg: false,
          keep_original_images: true,
        },
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, project });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
