import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/check";
import { getAuthenticatedUser } from "@/lib/supabase/auth-guard";

const NOT_CONFIGURED = NextResponse.json(
  { error: "Supabase is not configured." },
  { status: 503 },
);

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/friends/[id]
 * Accept or reject a friend request.
 * Body: { status: "accepted" | "rejected" }
 * Only the addressee can accept/reject.
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

    if (!body.status || !["accepted", "rejected"].includes(body.status)) {
      return NextResponse.json(
        { error: "status must be 'accepted' or 'rejected'" },
        { status: 400 },
      );
    }

    // Verify this request is addressed to the current user
    const { data: friendship, error: fetchError } = await supabase
      .from("friendships")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !friendship) {
      return NextResponse.json(
        { error: "Friend request not found" },
        { status: 404 },
      );
    }

    if (friendship.addressee_id !== user.id) {
      return NextResponse.json(
        { error: "Only the recipient can respond to a friend request" },
        { status: 403 },
      );
    }

    if (friendship.status !== "pending") {
      return NextResponse.json(
        { error: "This request has already been responded to" },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("friendships")
      .update({ status: body.status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("PATCH /api/friends/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/friends/[id]
 * Remove a friendship or cancel a pending request.
 * Either party can delete.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { id } = await context.params;
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Verify user is part of this friendship
    const { data: friendship, error: fetchError } = await supabase
      .from("friendships")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !friendship) {
      return NextResponse.json(
        { error: "Friendship not found" },
        { status: 404 },
      );
    }

    if (
      friendship.requester_id !== user.id &&
      friendship.addressee_id !== user.id
    ) {
      return NextResponse.json(
        { error: "You are not part of this friendship" },
        { status: 403 },
      );
    }

    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Removed" });
  } catch (err) {
    console.error("DELETE /api/friends/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
