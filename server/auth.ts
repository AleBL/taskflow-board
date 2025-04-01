/**
 * Local authentication helpers.
 * Replaces Manus OAuth with email/password + JWT cookie.
 */
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Request } from "express";
import { COOKIE_NAME } from "@shared/const";
import { ENV } from "./_core/env";
import { getUserById } from "./db";
import type { User } from "../drizzle/schema";

const BCRYPT_ROUNDS = 12;

// ─── JWT ──────────────────────────────────────────────────────────────────────

function getSecretKey() {
  const secret = ENV.cookieSecret || "fallback-dev-secret-change-in-prod";
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(getSecretKey());
}

export async function verifySession(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    const id = parseInt(String(payload.sub), 10);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

// ─── Password ─────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Request authentication ───────────────────────────────────────────────────

export async function authenticateRequest(req: Request): Promise<User | null> {
  const raw = req.headers.cookie ?? "";
  const cookies = Object.fromEntries(
    raw.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k?.trim() ?? "", v.join("=")];
    })
  );

  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  const userId = await verifySession(token);
  if (!userId) return null;

  return getUserById(userId);
}
