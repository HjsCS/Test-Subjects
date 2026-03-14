import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/check";
import { getAuthenticatedUser } from "@/lib/supabase/auth-guard";

const NOT_CONFIGURED = NextResponse.json(
  {
    error:
      "Supabase is not configured. Fill in .env.local with your credentials.",
  },
  { status: 503 },
);

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/moods/[id]
 * Fetch a single mood entry by ID.
 * RLS ensures the user can only see their own or friends' visible entries.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  try {
    const { error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { id } = await context.params;
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("mood_entries")
      .select("*, profiles!fk_mood_entries_profile(display_name, avatar_url)")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/moods/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/moods/[id]
 * Update a mood entry. Only the owner can update (enforced by RLS + API check).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { id } = await context.params;
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const body = await request.json();

    // Don't allow changing user_id
    delete body.user_id;

    const { data, error } = await supabase
      .from("mood_entries")
      .update(body)
      .eq("id", id)
      .eq("user_id", user.id) // Belt-and-suspenders: only owner can update
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("PATCH /api/moods/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/moods/[id]
 * Delete a mood entry. Only the owner can delete (enforced by RLS + API check).
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { id } = await context.params;
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { error } = await supabase
      .from("mood_entries")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id); // Belt-and-suspenders: only owner can delete

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE /api/moods/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
