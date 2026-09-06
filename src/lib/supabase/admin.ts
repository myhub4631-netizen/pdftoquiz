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
  if (!serviceRoleKey) {
    throw new Error('Configuration error: SUPABASE_SERVICE_ROLE_KEY environment variable is missing. Admin and guest operations require a secret service role key.');
  }
  if (serviceRoleKey.startsWith('sb_publish') || serviceRoleKey === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Configuration error: SUPABASE_SERVICE_ROLE_KEY is set to a public/anon key instead of a secret service_role key.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
