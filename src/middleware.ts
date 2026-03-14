import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  // Skip Supabase session refresh if env vars are not configured yet
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL === "your-supabase-url"
  ) {
    return NextResponse.next();
  }

  // Refresh session and get current user
  const { response, user } = await updateSession(request);

  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  const isApiRoute = pathname.startsWith("/api/");

  // Authenticated user visiting login/signup → redirect to /map
  if (isPublicRoute && user) {
    return NextResponse.redirect(new URL("/map", request.url));
  }

  // Unauthenticated user visiting protected page → redirect to /login
  if (!isPublicRoute && !isApiRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image  (image optimization files)
     * - favicon.ico  (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
