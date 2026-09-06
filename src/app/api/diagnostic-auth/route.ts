import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
  };

  try {
    const adminClient = createAdminClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const anonClient = createClient(supabaseUrl, anonKey);

    // 1. Test profiles direct insert with admin client
    const testUuid = '00000000-0000-0000-0000-000000000099';
    const profileInsertRes = await adminClient.from('profiles').upsert({
      id: testUuid,
      email: 'direct_profile_test@example.com',
      full_name: 'Direct Profile Test',
      role: 'USER',
      status: 'ACTIVE',
      projects_count: 0,
      questions_count: 0,
      storage_used_bytes: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    diagnostics.profile_direct_insert = {
      success: !profileInsertRes.error,
      error: profileInsertRes.error ? {
        code: profileInsertRes.error.code,
        message: profileInsertRes.error.message,
        details: profileInsertRes.error.details,
        hint: profileInsertRes.error.hint,
      } : null,
    };

    // Clean up test profile row if created
    if (!profileInsertRes.error) {
      await adminClient.from('profiles').delete().eq('id', testUuid);
    }

    // 2. Test admin.createUser
    const adminCreateEmail = `admin_create_${Date.now()}@example.com`;
    const adminCreateRes = await adminClient.auth.admin.createUser({
      email: adminCreateEmail,
      password: 'TestPassword123!',
      email_confirm: false,
    });

    diagnostics.admin_create_user = {
      has_error: Boolean(adminCreateRes.error),
      error: adminCreateRes.error ? {
        name: adminCreateRes.error.name,
        message: adminCreateRes.error.message,
        status: adminCreateRes.error.status,
        code: (adminCreateRes.error as any).code,
      } : null,
      user_id: adminCreateRes.data?.user?.id || null,
    };

    // If admin.createUser succeeded, check if profile was created
    if (adminCreateRes.data?.user?.id) {
      const pCheck = await adminClient.from('profiles').select('*').eq('id', adminCreateRes.data.user.id).maybeSingle();
      diagnostics.admin_user_profile_check = {
        profile_found: Boolean(pCheck.data),
        profile_data: pCheck.data,
      };
      // Clean up test auth user
      await adminClient.auth.admin.deleteUser(adminCreateRes.data.user.id);
    }

    // 3. Test public signUp
    const publicSignUpEmail = `public_signup_${Date.now()}@example.com`;
    const publicSignUpRes = await anonClient.auth.signUp({
      email: publicSignUpEmail,
      password: 'TestPassword123!',
    });

    diagnostics.public_signup = {
      has_error: Boolean(publicSignUpRes.error),
      error: publicSignUpRes.error ? {
        name: publicSignUpRes.error.name,
        message: publicSignUpRes.error.message,
        status: publicSignUpRes.error.status,
        code: (publicSignUpRes.error as any).code,
      } : null,
      user_id: publicSignUpRes.data?.user?.id || null,
    };

    return NextResponse.json({ success: true, diagnostics });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Diagnostic failed',
      diagnostics,
    }, { status: 500 });
  }
}
