import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/constants";

const encoder = new TextEncoder();
const lifetime = 60 * 60 * 24 * 14;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return encoder.encode(value);
}

export function verifyPin(candidate: string) {
  const expected = process.env.APP_LOGIN_PIN;
  if (!expected) throw new Error("APP_LOGIN_PIN is not configured");
  const left = createHash("sha256").update(candidate).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export async function createSession() {
  const token = await new SignJWT({ role: "owner" }).setProtectedHeader({ alg: "HS256" }).setSubject("owner").setIssuedAt().setExpirationTime(`${lifetime}s`).sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: lifetime });
}

export async function readSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try { return (await jwtVerify(token, secret())).payload; } catch { return null; }
}

export async function requireSession() {
  const session = await readSession();
  if (!session) redirect("/login");
  return session;
}

export async function destroySession() { (await cookies()).delete(SESSION_COOKIE); }
