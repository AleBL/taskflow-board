import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { COOKIE_NAME } from "../shared/const";
import { ENV } from "./_core/env";
import { getUserById } from "./db";
import type { User } from "../drizzle/schema";

type RequestLike = {
  headers?: {
    cookie?: string;
  };
};

const BCRYPT_ROUNDS = 12;
const DEV_ONLY_SECRET = "dev-only-secret-not-for-production";

let warnedAboutDevSecret = false;

function getSecretKey() {
  const secret = ENV.cookieSecret;
  if (!secret) {
    if (ENV.isProduction) {
      throw new Error("JWT_SECRET must be set in production");
    }
    if (!warnedAboutDevSecret) {
      warnedAboutDevSecret = true;
      console.warn("[Auth] JWT_SECRET not set, using an insecure development secret");
    }
    return new TextEncoder().encode(DEV_ONLY_SECRET);
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: number, maxAgeMs: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + maxAgeMs) / 1000))
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

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authenticateRequest(req: RequestLike): Promise<User | null> {
  const raw = req.headers?.cookie ?? "";

  const cookies = Object.fromEntries(
    raw.split(";").map((c: string) => {
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

export type PublicUser = Pick<User, "id" | "name" | "email" | "role" | "loginMethod" | "createdAt">;

/** Strips secrets (passwordHash) before a user object leaves the server. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    loginMethod: user.loginMethod,
    createdAt: user.createdAt,
  };
}
