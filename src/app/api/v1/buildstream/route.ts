import { NextRequest } from "next/server";
import { getSessionUserId } from "@/shared/auth/session";
import { apiOk, apiError } from "@/shared/api/errors";
import {
  getBuildstreamFeed,
  getEcosystemStats,
  getUserPulse,
  getTrendingProjects,
  getTopOpportunities,
  getRecommendedBuilders,
  getBuildRadar,
  BuildstreamTab,
  BuildstreamFilter,
} from "@/server/buildstream";

// GET /api/v1/buildstream
// Single unified endpoint for the live, non-seeded Klyro Buildstream space
export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const { searchParams } = new URL(req.url);

    const tab = (searchParams.get("tab") as BuildstreamTab) || "everything";
    const filter = (searchParams.get("filter") as BuildstreamFilter) || "all";
    const query = searchParams.get("q") || "";
    const cursor = searchParams.get("cursor") || undefined;
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 50);
    const feedOnly = searchParams.get("feedOnly") === "true";

    const { items, nextCursor } = await getBuildstreamFeed({
      userId,
      tab,
      filter,
      query,
      cursor,
      limit,
    });

    if (feedOnly) {
      return apiOk({ items, nextCursor });
    }

    const [stats, pulse, trending, opportunities, recommendedBuilders, radar] = await Promise.all([
      getEcosystemStats(),
      getUserPulse(userId),
      getTrendingProjects(),
      getTopOpportunities(),
      getRecommendedBuilders(userId),
      getBuildRadar(),
    ]);

    return apiOk({
      items,
      nextCursor,
      stats,
      pulse,
      trending,
      opportunities,
      recommendedBuilders,
      radar,
    });
  } catch (err) {
    console.error("[Buildstream API] Error:", err);
    return apiError("INTERNAL_ERROR", "Failed to load Buildstream.", err instanceof Error ? err.message : null, 500);
  }
}
