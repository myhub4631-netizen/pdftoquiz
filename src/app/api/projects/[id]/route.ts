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

    // Retrieve current authenticated user session if present
    const { data: authData } = await supabaseServer.auth.getUser();
    const authUser = authData?.user || null;

    let project: any = null;

    // 1. Fetch project using requesting user's Supabase server client (enforcing RLS)
    try {
      project = await ProjectStore.getProject(id, supabaseServer);
    } catch (rlsErr: any) {
      console.warn('[GET /api/projects/[id]] RLS fetch notice:', rlsErr?.message);
    }

    // 2. If RLS query returned null but user is authenticated, verify if user owns the project
    if (!project && authUser?.id) {
      try {
        const adminClient = createAdminClient();
        const candidate = await ProjectStore.getProject(id, adminClient);
        if (candidate && candidate.user_id === authUser.id) {
          project = candidate;
        }
      } catch (adminErr: any) {
        console.warn('[GET /api/projects/[id]] Admin fallback notice:', adminErr?.message);
      }
    }

    // 3. If still not found, check if requesting user is a server-verified Master Admin
    if (!project) {
      try {
        const isMasterAdmin = await verifyServerMasterAdmin(req);
        if (isMasterAdmin) {
          const adminClient = createAdminClient();
          project = await ProjectStore.getProject(id, adminClient);
        }
      } catch (masterAdminErr: any) {
        console.warn('[GET /api/projects/[id]] Master admin check notice:', masterAdminErr?.message);
      }
    }

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // Telemetry & Stats Retrieval (safely wrapped)
    let job: any = null;
    let questions: any[] = [];

    try {
      const adminClient = createAdminClient();
      const jobRes = await adminClient
        .from('processing_jobs')
        .select('*')
        .eq('project_id', id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      job = jobRes.data || null;

      const qRes = await adminClient
        .from('questions')
        .select('id, subject, needs_review, confidence')
        .eq('project_id', id);
      questions = qRes.data || [];
    } catch {
      // Fallback query using user server client
      try {
        const qRes = await supabaseServer
          .from('questions')
          .select('id, subject, needs_review, confidence')
          .eq('project_id', id);
        questions = qRes.data || [];
      } catch {}
    }

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
