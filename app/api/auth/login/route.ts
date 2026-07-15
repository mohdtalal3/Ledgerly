import { NextRequest, NextResponse } from "next/server";
import { createSession, verifyPin } from "@/lib/auth/session";
import { pinSchema } from "@/lib/validations";

const attempts = new Map<string, { count: number; reset: number }>();

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const now = Date.now();
  const state = attempts.get(ip);
  if (state && state.reset > now && state.count >= 5) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  const parsed = pinSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !verifyPin(parsed.data.pin)) {
    attempts.set(ip, state && state.reset > now ? { ...state, count: state.count + 1 } : { count: 1, reset: now + 15 * 60_000 });
    return NextResponse.json({ error: "That PIN is not correct." }, { status: 401 });
  }
  attempts.delete(ip);
  await createSession();
  return NextResponse.json({ ok: true });
}
