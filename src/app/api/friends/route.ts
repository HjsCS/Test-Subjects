import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/check";
import { getAuthenticatedUser } from "@/lib/supabase/auth-guard";

const NOT_CONFIGURED = NextResponse.json(
  { error: "Supabase is not configured." },
  { status: 503 },
);

/**
 * GET /api/friends
 * Returns the current user's accepted friends with profile data.
 */
export async function GET() {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Get all accepted friendships where user is either party
    const { data: friendships, error } = await supabase
      .from("friendships")
      .select("*")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!friendships || friendships.length === 0) {
      return NextResponse.json([]);
    }

    // Extract the OTHER user's ID from each friendship
    const friendIds = friendships.map((f) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id,
    );

    // Fetch profiles for all friends
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .in("id", friendIds);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    // Combine friendship + profile data
    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p]),
    );

    const result = friendships.map((f) => {
      const friendId =
        f.requester_id === user.id ? f.addressee_id : f.requester_id;
      return {
        ...f,
        profiles: profileMap.get(friendId) ?? null,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/friends error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/friends
 * Send a friend request.
 * Body: { addressee_id: string }
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const body = await request.json();

    const addresseeId = body.addressee_id;
    if (!addresseeId) {
      return NextResponse.json(
        { error: "addressee_id is required" },
        { status: 400 },
      );
    }

    if (addresseeId === user.id) {
      return NextResponse.json(
        { error: "You cannot send a friend request to yourself" },
        { status: 400 },
      );
    }

    // Check if a friendship already exists in either direction
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status")
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`,
      )
      .limit(1)
      .maybeSingle();

    if (existing) {
      if (existing.status === "accepted") {
        return NextResponse.json(
          { error: "You are already friends" },
          { status: 409 },
        );
      }
      if (existing.status === "pending") {
        return NextResponse.json(
          { error: "A friend request already exists" },
          { status: 409 },
        );
      }
      // If rejected, allow re-sending by deleting the old one
      if (existing.status === "rejected") {
        await supabase.from("friendships").delete().eq("id", existing.id);
      }
    }

    const { data, error } = await supabase
      .from("friendships")
      .insert({
        requester_id: user.id,
        addressee_id: addresseeId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("POST /api/friends error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
