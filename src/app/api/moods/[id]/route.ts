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
 *
 * Two modes:
 * 1. toggle_reaction: { toggle_reaction: "❤️" } — server-side read-modify-write
 * 2. Content edit: { note, emotion_score, ... } — owner only, within 10 minutes
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

    // ─── Mode 1: Toggle reaction (server-side, no race condition) ───
    if (body.toggle_reaction) {
      const emoji = body.toggle_reaction as string;

      const { data: current, error: readErr } = await supabase
        .from("mood_entries")
        .select("reactions")
        .eq("id", id)
        .single();

      if (readErr || !current) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      }

      const reactions: { user_id: string; emoji: string }[] =
        current.reactions ?? [];
      const idx = reactions.findIndex(
        (r) => r.user_id === user.id && r.emoji === emoji,
      );

      if (idx >= 0) {
        reactions.splice(idx, 1);
      } else {
        reactions.push({ user_id: user.id, emoji });
      }

      const { data, error } = await supabase
        .from("mood_entries")
        .update({ reactions })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    // ─── Mode 2: Content edit (owner only) ───
    delete body.user_id;
    delete body.created_at;
    delete body.reactions;

    // Visibility-only changes are always allowed; other edits have 10-min window
    const isVisibilityOnly =
      Object.keys(body).length === 1 && "visibility" in body;

    if (!isVisibilityOnly) {
      const { data: existing } = await supabase
        .from("mood_entries")
        .select("created_at")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (!existing) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      }

      const ageMs = Date.now() - new Date(existing.created_at).getTime();
      if (ageMs > 10 * 60 * 1000) {
        return NextResponse.json(
          { error: "Can only edit entries within 10 minutes of creation" },
          { status: 403 },
        );
      }
    }

    const { data, error } = await supabase
      .from("mood_entries")
      .update(body)
      .eq("id", id)
      .eq("user_id", user.id)
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
 * Delete a mood entry. Only the owner can delete.
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
      .eq("user_id", user.id);

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
