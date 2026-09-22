import { z } from "zod";
import { usernameSchema } from "@/shared/auth/usernames";

// 03-auth validation: password >= 10 chars; HIBP k-anonymity breach check runs
// server-side on signup (see signup route) — no arbitrary complexity rules.
export const signupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10).max(128),
  username: usernameSchema,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const onboardingSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  bio: z.string().max(160).optional(),
  about: z.string().max(5000).optional(),
  location: z.string().max(120).optional(),
  websiteUrl: z.string().url().max(2048).optional().or(z.literal("")),
  intent: z.enum(["start", "join", "both"]).optional(),
  skills: z.array(z.object({ name: z.string().min(1).max(60), level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]).default("INTERMEDIATE") })).max(20).optional(),
});
