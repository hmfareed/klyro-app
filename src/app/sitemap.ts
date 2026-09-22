import type { MetadataRoute } from "next";
import { prisma } from "@/shared/db/prisma";

// 28 §3: auto-generated sitemap for public projects/profiles/repos.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const urls: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date() },
    { url: `${base}/signup`, lastModified: new Date() },
  ];
  try {
    const users = await prisma.user.findMany({ select: { username: true, updatedAt: true }, take: 1000 });
    for (const u of users) urls.push({ url: `${base}/u/${u.username}`, lastModified: u.updatedAt });
  } catch { /* DB unreachable at build — static entries only */ }
  return urls;
}
