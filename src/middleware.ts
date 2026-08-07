import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "chatmosphere-dev-secret-change-in-production-32chars"
);

const PUBLIC_PATHS = ["/", "/join", "/login", "/api/auth/join", "/api/auth/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Allow static assets and API routes (handled by route-level auth)
  if (pathname.startsWith("/_next") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check auth cookie
  const token = request.cookies.get("ch_session")?.value;
  if (!token) {
    const url = new URL("/join", request.url);
    return NextResponse.redirect(url);
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    const url = new URL("/join", request.url);
    const response = NextResponse.redirect(url);
    response.cookies.delete("ch_session");
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
