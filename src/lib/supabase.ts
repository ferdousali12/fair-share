/**
 * Supabase client for Fair Share.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const SUPABASE_URL = 'https://jnxkdfcxajeliwuhvufz.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpueGtkZmN4YWplbGl3dWh2dWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjc2MTAsImV4cCI6MjEwMTYwMzYxMH0.-uLSg5ytstI6t0fxSelsXm-uXcrrwR4Mhufje4o9zyM';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);