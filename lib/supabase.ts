import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Read-only anon client. Used from server components; RLS demo_read_all allows select.
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
