import { createBrowserClient } from "@supabase/ssr";

// Browser client — publishable key only. Safe to ship to the client bundle.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
