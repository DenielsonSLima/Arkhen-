import { createClient } from '@supabase/supabase-js';

const defaultSupabaseUrl = 'https://dgklhykjwzmeqxejlicz.supabase.co';
const defaultSupabasePublishableKey = 'sb_publishable_WI3KnXA-nJf2RnHq_1AKXA_EhwQuDOi';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || defaultSupabaseUrl;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || defaultSupabasePublishableKey;

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL nao foi configurada.');
}

if (!supabasePublishableKey) {
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY nao foi configurada.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const supabaseProjectUrl = supabaseUrl;
