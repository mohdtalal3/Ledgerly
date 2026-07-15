import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

export function middleware(request: NextRequest) {
  const loggedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const login = request.nextUrl.pathname === "/login";
  if (!loggedIn && !login) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
