// 03-auth usernames: GitHub-identical rules.
// 3-39 chars, alnum + single hyphens, no leading/trailing/double hyphen,
// globally unique case-insensitive, case-preserving. 30d cooldown enforced
// at the service layer via UsernameHistory; URL /u/:username (docs: /@username).
import { z } from "zod";

const RESERVED = new Set([
  "admin", "api", "app", "auth", "billing", "docs", "explore", "help",
  "klyro", "buildtogether", "login", "logout", "settings", "signup",
  "support", "teams", "users", "www",
]);

export const usernameSchema = z
  .string()
  .min(3)
  .max(39)
  .regex(/^(?!-)(?!.*--)[a-zA-Z0-9-]+(?<!-)$/, "Use letters, numbers, single hyphens; no leading/trailing/double hyphens")
  .refine((u) => !RESERVED.has(u.toLowerCase()), "That username is reserved");

export function normalizeUsername(u: string): string {
  return u.toLowerCase();
}

// 30 §7: 2–3 auto-suggested alternatives on USERNAME_TAKEN, not a bare error.
export function suggestUsernames(base: string): string[] {
  const clean = base.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "builder";
  const rand = Math.floor(100 + Math.random() * 900);
  const out = [`${clean}-${rand.toString().slice(1)}`, `${clean}-dev`, `${clean}-hq`];
  // Keep within 3–39 chars and valid format.
  return [...new Set(out)].filter((u) => u.length >= 3 && u.length <= 39 && !u.includes("--")).slice(0, 3);
}
