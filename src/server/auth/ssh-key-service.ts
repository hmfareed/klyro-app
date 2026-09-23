import crypto from "node:crypto";
import { prisma } from "@/shared/db/prisma";

export const SUPPORTED_KEY_TYPES = [
  "ssh-ed25519",
  "ssh-rsa",
  "ecdsa-sha2-nistp256",
  "ecdsa-sha2-nistp384",
  "ecdsa-sha2-nistp521",
];

export interface ParsedSshKey {
  keyType: string;
  base64Data: string;
  rawBytes: Buffer;
  fingerprint: string;
  comment?: string;
}

/**
 * Calculates standard OpenSSH SHA-256 fingerprint from raw key bytes or base64
 * Format: "SHA256:<base64-digest-without-padding>"
 */
export function computeSshFingerprint(data: Buffer | string): string {
  const rawBytes = typeof data === "string" ? Buffer.from(data, "base64") : data;
  const hash = crypto.createHash("sha256").update(rawBytes).digest("base64");
  return `SHA256:${hash.replace(/=+$/, "")}`;
}

/**
 * Parses and validates an OpenSSH public key line
 * Format: "<keyType> <base64Data> [comment]"
 */
export function parseOpenSshPublicKey(rawKey: string): ParsedSshKey {
  if (!rawKey || typeof rawKey !== "string") {
    throw new Error("Invalid SSH public key: empty input");
  }

  const clean = rawKey.trim();
  const parts = clean.split(/\s+/);
  if (parts.length < 2) {
    throw new Error("Invalid SSH public key: expected '<type> <base64-data> [comment]'");
  }

  const [keyType, base64Data, ...commentParts] = parts;
  const comment = commentParts.length > 0 ? commentParts.join(" ") : undefined;

  if (!SUPPORTED_KEY_TYPES.includes(keyType)) {
    throw new Error(
      `Unsupported SSH key type '${keyType}'. Supported types: ${SUPPORTED_KEY_TYPES.join(", ")}`
    );
  }

  const rawBytes = Buffer.from(base64Data, "base64");
  if (rawBytes.length < 16) {
    throw new Error("Invalid SSH public key: key data is too short or malformed");
  }

  // Validate the internal wire format length prefix for key type
  try {
    const typeLen = rawBytes.readUInt32BE(0);
    if (typeLen > 0 && typeLen < rawBytes.length - 4) {
      const internalKeyType = rawBytes.subarray(4, 4 + typeLen).toString("utf8");
      if (internalKeyType !== keyType) {
        throw new Error(
          `Key type prefix '${keyType}' does not match internal type '${internalKeyType}'`
        );
      }
    }
  } catch (err: any) {
    throw new Error(`Failed to decode OpenSSH key wire format: ${err.message}`);
  }

  const fingerprint = computeSshFingerprint(rawBytes);

  return {
    keyType,
    base64Data,
    rawBytes,
    fingerprint,
    comment,
  };
}

/**
 * Adds an SSH key for a user
 */
export async function addSshKeyForUser(params: {
  userId: string;
  title?: string;
  publicKey: string;
}) {
  const parsed = parseOpenSshPublicKey(params.publicKey);

  // Check if fingerprint already exists
  const existing = await prisma.userSshKey.findUnique({
    where: { fingerprint: parsed.fingerprint },
  });

  if (existing) {
    throw new Error("This SSH key is already registered in Klyro.");
  }

  const title = params.title?.trim() || parsed.comment || `${parsed.keyType} key`;

  // Standardize single-line stored public key
  const normalizedKey = `${parsed.keyType} ${parsed.base64Data}${parsed.comment ? " " + parsed.comment : ""}`;

  return await prisma.userSshKey.create({
    data: {
      userId: params.userId,
      title,
      publicKey: normalizedKey,
      fingerprint: parsed.fingerprint,
      keyType: parsed.keyType,
    },
  });
}

/**
 * Lists all SSH keys for a user
 */
export async function listSshKeysForUser(userId: string) {
  return await prisma.userSshKey.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      fingerprint: true,
      keyType: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Deletes an SSH key belonging to a user
 */
export async function deleteSshKeyForUser(userId: string, keyId: string) {
  const key = await prisma.userSshKey.findFirst({
    where: { id: keyId, userId },
  });

  if (!key) {
    throw new Error("SSH key not found or does not belong to you.");
  }

  return await prisma.userSshKey.delete({
    where: { id: keyId },
  });
}

/**
 * Looks up a user by their SSH key fingerprint
 */
export async function findUserBySshFingerprint(fingerprint: string) {
  return await prisma.userSshKey.findUnique({
    where: { fingerprint },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Records when an SSH key was used to authenticate
 */
export async function recordSshKeyUsage(keyId: string) {
  try {
    await prisma.userSshKey.update({
      where: { id: keyId },
      data: { lastUsedAt: new Date() },
    });
  } catch {}
}
