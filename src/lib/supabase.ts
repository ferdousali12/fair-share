/**
 * Supabase client for Fair Share.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const SUPABASE_URL = 'https://jnxkdfcxajeliwuhvufz.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpueGtkZmN4YWplbGl3dWh2dWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjc2MTAsImV4cCI6MjEwMTYwMzYxMH0.-uLSg5ytstI6t0fxSelsXm-uXcrrwR4Mhufje4o9zyM';

// Fail loudly at startup instead of a confusing network error later
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY. Check your environment variables.'
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// One-time connectivity check — logs a clear warning in the console
// if the Supabase project itself is unreachable (helps distinguish
// "Edge Function not deployed" from "can't reach Supabase at all").
if (import.meta.env.DEV) {
  fetch(`${SUPABASE_URL}/auth/v1/health`)
    .then((res) => {
      if (!res.ok) {
        console.warn('[supabase] Health check returned non-OK status:', res.status);
      } else {
        console.log('[supabase] Connected to project successfully.');
      }
    })
    .catch((err) => {
      console.error(
        '[supabase] Could not reach Supabase project at all. This usually means a network/sandbox block, not a missing Edge Function.',
        err
      );
    });
}