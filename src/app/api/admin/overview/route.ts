import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    const [
      { count: totalUsers },
      { count: totalProjects },
      { count: totalQuestions },
      { count: totalJobs },
      { count: totalExports },
      { data: recentProjects },
      { data: recentJobs },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('projects').select('*', { count: 'exact', head: true }),
      supabase.from('questions').select('*', { count: 'exact', head: true }),
      supabase.from('processing_jobs').select('*', { count: 'exact', head: true }),
      supabase.from('exports').select('*', { count: 'exact', head: true }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('processing_jobs').select('*, projects(name)').order('created_at', { ascending: false }).limit(5),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        total_users: totalUsers || 0,
        total_projects: totalProjects || 0,
        total_questions: totalQuestions || 0,
        total_jobs: totalJobs || 0,
        total_exports: totalExports || 0,
      },
      recent_projects: recentProjects || [],
      recent_jobs: recentJobs || [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
