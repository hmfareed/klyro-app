import { createHash } from "crypto";

// 03-auth: HaveIBeenPwned k-anonymity check. Sends only first 5 hex chars of
// SHA-1(password); never the password or full hash. Fail-open on network error
// (log, allow) so signup doesn't hard-depend on HIBP availability.
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "User-Agent": "Klyro-Password-Check" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.split("\n").some((line) => line.split(":")[0]?.trim() === suffix);
  } catch (err) {
    console.warn("[klyro] breach-check unavailable, fail-open:", (err as Error).message);
    return false;
  }
}
