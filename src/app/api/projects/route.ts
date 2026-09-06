import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ProjectStore } from '@/lib/projects/store';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      has_supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabase_host: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
        : null,
      has_anon_key: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      has_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      service_key_prefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10),
      service_key_is_service_role: (() => {
        const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        if (k.startsWith('eyJ')) {
          try {
            const parts = k.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            return payload.role === 'service_role';
          } catch {
            return false;
          }
        }
        return k.startsWith('sb_secret_');
      })(),
      node_env: process.env.NODE_ENV,
      vercel_env: process.env.VERCEL_ENV || (process.env.VERCEL ? 'vercel' : 'local'),
    },
  };

  try {
    let body: any = {};
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
      body = await req.json().catch(() => ({}));
    }

    // Diagnostic Probe Mode
    const isProbe = req.nextUrl.searchParams.get('diagnostic') === 'true' || body.diagnostic === true;

    // 1. Test URL Reachability
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        const pingStart = Date.now();
        const pingRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
        });
        diagnostics.supabase_reachability = {
          reachable: true,
          status: pingRes.status,
          latency_ms: Date.now() - pingStart,
        };
      } catch (pingErr: any) {
        diagnostics.supabase_reachability = {
          reachable: false,
          error_name: pingErr?.name,
          error_message: pingErr?.message,
          cause_code: pingErr?.cause?.code,
          cause_message: pingErr?.cause?.message,
        };
      }
    }

    // 2. Test createServerSupabaseClient & Auth
    let supabaseServer: any = null;
    let authUser: any = null;
    try {
      supabaseServer = await createServerSupabaseClient();
      diagnostics.createServerSupabaseClient = 'PASS';
      const authRes = await supabaseServer.auth.getUser();
      authUser = authRes?.data?.user || null;
      diagnostics.auth = {
        authenticated: Boolean(authUser),
        user_id_present: Boolean(authUser?.id),
        auth_error: authRes?.error?.message || null,
      };
    } catch (authErr: any) {
      diagnostics.createServerSupabaseClient = 'FAIL';
      diagnostics.auth = {
        authenticated: false,
        user_id_present: false,
        error_name: authErr?.name,
        error_message: authErr?.message,
        cause_code: authErr?.cause?.code,
        cause_message: authErr?.cause?.message,
      };
    }

    // 3. Test Admin Client & Harmless Query
    let adminClient: any = null;
    try {
      adminClient = createAdminClient();
      diagnostics.createAdminClient = 'PASS';
      const probeQuery = await adminClient.from('projects').select('id').limit(1);
      diagnostics.database_probe = {
        success: !probeQuery.error,
        code: probeQuery.error?.code || null,
        message: probeQuery.error?.message || null,
        details: probeQuery.error?.details || null,
        hint: probeQuery.error?.hint || null,
      };
    } catch (adminErr: any) {
      diagnostics.createAdminClient = 'FAIL';
      diagnostics.database_probe = {
        success: false,
        error_name: adminErr?.name,
        error_message: adminErr?.message,
        cause_code: adminErr?.cause?.code,
        cause_message: adminErr?.cause?.message,
      };
    }

    if (isProbe) {
      return NextResponse.json({ success: true, diagnostics });
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
      return NextResponse.json({ success: false, error: 'Project name is required', diagnostics }, { status: 400 });
    }

    // Determine target user ID
    let targetUserId = authUser?.id || user_id;

    // If unauthenticated guest session, ensure targetUserId points to an existing profile
    if (!targetUserId && adminClient) {
      try {
        const { data: firstProfile } = await adminClient
          .from('profiles')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (firstProfile?.id) {
          targetUserId = firstProfile.id;
        } else {
          // If no profile exists, check auth users or create a default guest profile
          targetUserId = '00000000-0000-0000-0000-000000000001';
        }
      } catch {
        targetUserId = '00000000-0000-0000-0000-000000000001';
      }
    }

    const expectedQuestions = exam_type === 'NEET' ? 180 : exam_type === 'JEE_MAIN' ? 90 : 100;
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

    // Save project using ProjectStore
    const clientToUse = authUser && supabaseServer ? supabaseServer : adminClient;
    const savedProject = await ProjectStore.saveProject(newProjectRecord, clientToUse);

    // Save document record if present
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

    return NextResponse.json({ success: true, project: savedProject, diagnostics });
  } catch (err: any) {
    const errorDetails = {
      name: err?.name,
      message: err?.message,
      cause_code: err?.cause?.code,
      cause_message: err?.cause?.message,
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
    };
    diagnostics.project_insert_error = errorDetails;

    console.error('[POST /api/projects] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Project creation failed',
        diagnostics,
      },
      { status: 500 }
    );
  }
}
