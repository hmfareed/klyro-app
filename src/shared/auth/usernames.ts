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
