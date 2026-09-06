import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
  };

  try {
    const { test_email, test_password } = await req.json().catch(() => ({}));

    const emailToUse = test_email || `diag_user_${Date.now()}@example.com`;
    const passwordToUse = test_password || 'DiagTestPass123!';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // 1. Test standard anon client signUp
    const anonClient = createClient(supabaseUrl, anonKey);
    console.log('[Diagnostic Auth] Testing anonClient.auth.signUp with email:', emailToUse);

    const signupStart = Date.now();
    const signupRes = await anonClient.auth.signUp({
      email: emailToUse,
      password: passwordToUse,
    });
    const signupDuration = Date.now() - signupStart;

    diagnostics.anon_signup = {
      duration_ms: signupDuration,
      has_error: Boolean(signupRes.error),
      error: signupRes.error ? {
        name: signupRes.error.name,
        message: signupRes.error.message,
        status: signupRes.error.status,
        code: signupRes.error.code,
      } : null,
      user_id: signupRes.data?.user?.id || null,
      user_email: signupRes.data?.user?.email || null,
      has_session: Boolean(signupRes.data?.session),
    };

    // 2. Test admin client check if user was created in auth.users or profiles
    const adminClient = createAdminClient();
    if (signupRes.data?.user?.id) {
      const targetId = signupRes.data.user.id;
      const profileQuery = await adminClient.from('profiles').select('*').eq('id', targetId).maybeSingle();
      diagnostics.profile_check = {
        profile_found: Boolean(profileQuery.data),
        profile_data: profileQuery.data,
        profile_error: profileQuery.error ? profileQuery.error.message : null,
      };
    } else {
      // Check if user exists in auth.users by listing users
      const listUsersRes = await adminClient.auth.admin.listUsers();
      const createdUser = listUsersRes.data?.users?.find(u => u.email === emailToUse);
      diagnostics.auth_user_check = {
        user_created_in_auth_users: Boolean(createdUser),
        user_id: createdUser?.id || null,
        created_at: createdUser?.created_at || null,
      };
      if (createdUser) {
        const profileQuery = await adminClient.from('profiles').select('*').eq('id', createdUser.id).maybeSingle();
        diagnostics.profile_check = {
          profile_found: Boolean(profileQuery.data),
          profile_data: profileQuery.data,
          profile_error: profileQuery.error ? profileQuery.error.message : null,
        };
      }
    }

    return NextResponse.json({ success: true, diagnostics });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Diagnostic failed',
      diagnostics,
    }, { status: 500 });
  }
}
