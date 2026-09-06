import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ProjectStore } from '@/lib/projects/store';
import { verifyServerMasterAdmin } from '@/lib/auth/admin-check';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabaseServer = await createServerSupabaseClient();

    // 1. Fetch project using requesting user's Supabase server client (enforcing RLS)
    let project = await ProjectStore.getProject(id, supabaseServer);

    // 2. If not found via user RLS, check if user is a server-verified Master Admin
    if (!project) {
      const isMasterAdmin = await verifyServerMasterAdmin(req);
      if (isMasterAdmin) {
        const adminClient = createAdminClient();
        project = await ProjectStore.getProject(id, adminClient);
      }
    }

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const supabase = createAdminClient();

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
