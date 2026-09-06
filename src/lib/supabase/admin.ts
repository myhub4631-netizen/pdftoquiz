import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://wobwuwnqfjivgfqsjoho.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_VscTMjnUfBel-2IANzNqHA_Ud-5Zf4b';

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Configuration error: NEXT_PUBLIC_SUPABASE_URL is not set.');
  }
  if (supabaseUrl.includes('localhost') && (process.env.NODE_ENV === 'production' || process.env.VERCEL)) {
    throw new Error('Configuration error: localhost Supabase URL is not allowed in production.');
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  if (!serviceRoleKey) {
    throw new Error('Configuration error: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
