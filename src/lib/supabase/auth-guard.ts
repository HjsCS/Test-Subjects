import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Extracts the authenticated user from the request context.
 * Returns the user object or a 401 NextResponse.
 *
 * Usage in API route handlers:
 *   const { user, error } = await getAuthenticatedUser();
 *   if (error) return error;
 *   // user is guaranteed non-null here
 */
export async function getAuthenticatedUser(): Promise<
  { user: User; error: null } | { user: null; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user, error: null };
}
