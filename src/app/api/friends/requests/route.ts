import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/check";
import { getAuthenticatedUser } from "@/lib/supabase/auth-guard";

const NOT_CONFIGURED = NextResponse.json(
  { error: "Supabase is not configured." },
  { status: 503 },
);

/**
 * GET /api/friends/requests
 * Returns pending friend requests (both incoming and outgoing).
 */
export async function GET() {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Get all pending requests involving this user
    const { data: requests, error } = await supabase
      .from("friendships")
      .select("*")
      .eq("status", "pending")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json({ incoming: [], outgoing: [] });
    }

    // Get all involved user IDs (the OTHER person in each request)
    const otherIds = requests.map((r) =>
      r.requester_id === user.id ? r.addressee_id : r.requester_id,
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", otherIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p]),
    );

    // Split into incoming and outgoing
    const incoming = requests
      .filter((r) => r.addressee_id === user.id)
      .map((r) => ({
        ...r,
        profiles: profileMap.get(r.requester_id) ?? null,
      }));

    const outgoing = requests
      .filter((r) => r.requester_id === user.id)
      .map((r) => ({
        ...r,
        profiles: profileMap.get(r.addressee_id) ?? null,
      }));

    return NextResponse.json({ incoming, outgoing });
  } catch (err) {
    console.error("GET /api/friends/requests error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
