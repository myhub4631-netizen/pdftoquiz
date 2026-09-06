import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get('subject');
    const needsReview = searchParams.get('needsReview');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const supabase = createAdminClient();

    let query = supabase
      .from('questions')
      .select('*, options:question_options(*), images:question_images(*)', { count: 'exact' })
      .eq('project_id', id)
      .order('question_number', { ascending: true });

    if (subject && subject !== 'All') {
      query = query.ilike('subject', `%${subject}%`);
    }

    if (needsReview === 'true') {
      query = query.eq('needs_review', true);
    }

    if (search) {
      query = query.or(`question_text.ilike.%${search}%,chapter.ilike.%${search}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: questions, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      questions: questions || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
