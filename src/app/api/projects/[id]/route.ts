import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // Get latest active job
    const { data: job } = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('project_id', id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get question counts by subject
    const { data: questions } = await supabase
      .from('questions')
      .select('id, subject, needs_review, confidence')
      .eq('project_id', id);

    const subjectStats: Record<string, number> = {};
    let needsReviewCount = 0;
    (questions || []).forEach((q) => {
      subjectStats[q.subject] = (subjectStats[q.subject] || 0) + 1;
      if (q.needs_review) needsReviewCount++;
    });

    return NextResponse.json({
      success: true,
      project,
      job,
      stats: {
        totalQuestions: questions?.length || 0,
        needsReviewCount,
        subjectStats,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Project deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
