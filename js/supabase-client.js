/* ============================================================
   SUPABASE CONFIG
   ------------------------------------------------------------
   Paste your two Supabase values below. That's it — every page
   (register, login, forgot-password, reset-password, confirmed,
   dashboard) reads from this one file.

   Where to find them:
   Supabase Dashboard → your project → Project Settings → API
     - "Project URL"            → SUPABASE_URL
     - "anon" "public" API key  → SUPABASE_ANON_KEY

   This key is safe to expose in frontend code — it's the public
   key, protected by your Row Level Security rules, not a secret.
   ============================================================ */

const SUPABASE_URL = "https://gywjjfrsqafaxdibvkox.supabase.co"; // e.g. https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5d2pqZnJzcWFmYXhkaWJ2a294Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NzcxNzMsImV4cCI6MjA5NzU1MzE3M30.HPDE7nj1uxww0BDhVtqm2il49IpR3Fp4Lwxnw1cczCE";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
