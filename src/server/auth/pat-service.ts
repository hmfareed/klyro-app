import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/shared/db/prisma";
import { verifyPassword } from "@/shared/auth/passwords";
import { getSessionUserId } from "@/shared/auth/session";

export const PAT_PREFIX = "klyro_pat_";

/**
 * Hash a personal access token using SHA-256 for secure storage
 */
export function hashPat(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface GeneratePatOptions {
  userId: string;
  name: string;
  scopes?: string[];
  expirationDays?: number | null;
}

export interface GeneratePatResult {
  token: string;
  record: {
    id: string;
    userId: string;
    name: string;
    tokenPrefix: string;
    scopes: string[];
    expiresAt: Date | null;
    createdAt: Date;
  };
}

/**
 * Generate a new Personal Access Token (PAT)
 * Returns the plaintext token once for display to the user.
 */
export async function generatePersonalAccessToken(
  options: GeneratePatOptions
): Promise<GeneratePatResult> {
  const randomHex = randomBytes(32).toString("hex");
  const rawToken = `${PAT_PREFIX}${randomHex}`;
  const tokenHash = hashPat(rawToken);
  const tokenPrefix = `${rawToken.slice(0, 18)}...`;

  const scopes = options.scopes && options.scopes.length > 0
    ? options.scopes
    : ["repo:read", "repo:write"];

  let expiresAt: Date | null = null;
  if (options.expirationDays && options.expirationDays > 0) {
    expiresAt = new Date(Date.now() + options.expirationDays * 24 * 60 * 60 * 1000);
  }

  const record = await prisma.personalAccessToken.create({
    data: {
      userId: options.userId,
      name: options.name.trim() || "Git Token",
      tokenPrefix,
      tokenHash,
      scopes,
      expiresAt,
    },
    select: {
      id: true,
      userId: true,
      name: true,
      tokenPrefix: true,
      scopes: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return {
    token: rawToken,
    record,
  };
}

export interface VerifyPatResult {
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string | null;
    status: string;
  };
  tokenRecord: {
    id: string;
    name: string;
    scopes: string[];
  };
  scopes: string[];
}

/**
 * Verify a raw Personal Access Token
 */
export async function verifyPersonalAccessToken(
  rawToken: string
): Promise<VerifyPatResult | null> {
  if (!rawToken || !rawToken.startsWith(PAT_PREFIX)) {
    return null;
  }

  const tokenHash = hashPat(rawToken);

  const pat = await prisma.personalAccessToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          status: true,
        },
      },
    },
  });

  if (!pat || pat.user.status !== "ACTIVE") {
    return null;
  }

  // Check expiration
  if (pat.expiresAt && pat.expiresAt.getTime() < Date.now()) {
    return null;
  }

  // Update lastUsedAt asynchronously
  prisma.personalAccessToken
    .update({
      where: { id: pat.id },
      data: { lastUsedAt: new Date() },
    })
    .catch((err) => console.error("[PAT] Failed to update lastUsedAt:", err));

  return {
    user: pat.user,
    tokenRecord: {
      id: pat.id,
      name: pat.name,
      scopes: pat.scopes,
    },
    scopes: pat.scopes,
  };
}

export interface GitAuthResult {
  authenticated: boolean;
  userId: string | null;
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string | null;
  } | null;
  scopes: string[];
  authMethod: "pat" | "password" | "session" | "anonymous";
}

/**
 * Authenticate incoming Git HTTP requests (Smart HTTP protocol)
 * Checks HTTP Basic Authorization header: username + PAT or password.
 * Also supports active session for browser/dev testing.
 */
export async function authenticateGitRequest(req: Request): Promise<GitAuthResult> {
  const authHeader = req.headers.get("authorization");

  if (authHeader && authHeader.toLowerCase().startsWith("basic ")) {
    const base64Credentials = authHeader.slice(6).trim();
    const decoded = Buffer.from(base64Credentials, "base64").toString("utf8");
    const colonIdx = decoded.indexOf(":");

    if (colonIdx !== -1) {
      const username = decoded.slice(0, colonIdx).trim();
      const password = decoded.slice(colonIdx + 1).trim();

      // 1. Check if password is a PAT
      if (password.startsWith(PAT_PREFIX)) {
        const patVerification = await verifyPersonalAccessToken(password);
        if (patVerification) {
          return {
            authenticated: true,
            userId: patVerification.user.id,
            user: patVerification.user,
            scopes: patVerification.scopes,
            authMethod: "pat",
          };
        }
      }

      // 2. Check if password is user account password
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: username, mode: "insensitive" } },
            { email: { equals: username, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          passwordHash: true,
          status: true,
        },
      });

      if (user && user.status === "ACTIVE" && user.passwordHash) {
        const isValidPassword = await verifyPassword(user.passwordHash, password);
        if (isValidPassword) {
          return {
            authenticated: true,
            userId: user.id,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              displayName: user.displayName,
            },
            scopes: ["repo:read", "repo:write", "repo:admin"],
            authMethod: "password",
          };
        }
      }
    }
  }

  // 3. Fallback: check session cookie (useful for local development or in-browser calls)
  try {
    const sessionUserId = await getSessionUserId();
    if (sessionUserId) {
      const sessionUser = await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          status: true,
        },
      });

      if (sessionUser && sessionUser.status === "ACTIVE") {
        return {
          authenticated: true,
          userId: sessionUser.id,
          user: sessionUser,
          scopes: ["repo:read", "repo:write", "repo:admin"],
          authMethod: "session",
        };
      }
    }
  } catch {}

  // 4. Anonymous
  return {
    authenticated: false,
    userId: null,
    user: null,
    scopes: [],
    authMethod: "anonymous",
  };
}
