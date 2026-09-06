import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Configuration error: NEXT_PUBLIC_SUPABASE_URL environment variable is missing. Supabase is not configured in this deployment.');
  }
  if (supabaseUrl.includes('localhost') && (process.env.NODE_ENV === 'production' || process.env.VERCEL)) {
    throw new Error('Configuration error: localhost Supabase URL is not allowed in production.');
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || serviceRoleKey.trim() === '') {
    throw new Error('Configuration error: SUPABASE_SERVICE_ROLE_KEY environment variable is missing. Admin operations require a secret service role key.');
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey && serviceRoleKey === anonKey) {
    throw new Error('Configuration error: SUPABASE_SERVICE_ROLE_KEY is set to the public/anon key instead of a secret service_role key.');
  }

  if (serviceRoleKey.startsWith('sb_publish') || serviceRoleKey.startsWith('sbp_')) {
    throw new Error('Configuration error: SUPABASE_SERVICE_ROLE_KEY is set to a publishable key instead of a secret service_role key.');
  }

  if (serviceRoleKey.startsWith('eyJ')) {
    try {
      const parts = serviceRoleKey.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        if (payload.role && payload.role !== 'service_role') {
          throw new Error(`Configuration error: SUPABASE_SERVICE_ROLE_KEY has invalid role '${payload.role}'. Expected 'service_role'.`);
        }
      }
    } catch (e: any) {
      if (e.message?.startsWith('Configuration error:')) throw e;
      throw new Error('Configuration error: SUPABASE_SERVICE_ROLE_KEY is malformed.');
    }
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
