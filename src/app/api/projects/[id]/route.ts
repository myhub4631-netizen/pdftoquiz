import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProjectStore } from '@/lib/projects/store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // 1. Fetch project from ProjectStore or Supabase
    const project = await ProjectStore.getProject(id);

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // 2. Get latest active processing job if any
    const { data: job } = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('project_id', id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Get question counts by subject
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
        totalQuestions: questions?.length || project.extracted_questions || 0,
        needsReviewCount: needsReviewCount || project.needs_review_count || 0,
        subjectStats,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to fetch project' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    await supabase.from('projects').delete().eq('id', id);
    return NextResponse.json({ success: true, message: 'Project deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Delete project failed' }, { status: 500 });
  }
}
