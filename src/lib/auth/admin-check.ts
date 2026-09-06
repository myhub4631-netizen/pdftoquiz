import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Verifies whether the requesting user is a legitimate, server-verified Master Admin or Admin.
 * 
 * Flow:
 * 1. Read authenticated session from cookies via createServerSupabaseClient()
 * 2. Retrieve authenticated user object
 * 3. Query the authoritative server-side 'profiles' table for user's role
 * 4. Return true ONLY if profile.role === 'MASTER_ADMIN' || profile.role === 'ADMIN'
 * 
 * NOTE: Client-controlled HTTP headers (e.g. x-master-admin) are NEVER trusted for authorization.
 */
export async function verifyServerMasterAdmin(req?: NextRequest, customUser?: any): Promise<boolean> {
  try {
    let user = customUser;

    if (!user) {
      const supabaseServer = await createServerSupabaseClient();
      const { data, error } = await supabaseServer.auth.getUser();
      if (error || !data?.user) {
        return false;
      }
      user = data.user;
    }

    if (!user?.id) {
      return false;
    }

    // Check app_metadata or user_metadata if role is stored in JWT
    if (user.app_metadata?.role === 'MASTER_ADMIN' || user.app_metadata?.role === 'ADMIN') {
      return true;
    }

    // Authoritative Server-side DB check against 'profiles' table
    const adminClient = createAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return false;
    }

    if (profile.status === 'BLOCKED') {
      return false;
    }

    return profile.role === 'MASTER_ADMIN' || profile.role === 'ADMIN';
  } catch (err) {
    console.error('[verifyServerMasterAdmin] Error verifying admin role:', err);
    return false;
  }
}
