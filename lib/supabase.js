import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local (locally) and to your " +
      "Vercel project settings (for the live site)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Keep the session in the browser's own storage so a crew member stays
    // signed in after closing the app, and with no signal at a scene.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
