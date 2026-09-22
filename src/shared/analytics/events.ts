// 24-analytics + 30 §8: typed event catalog.
// Server-side business actions are logged via logEvent() (ad-blocker-proof).
// Client onboarding transitions POST to /api/v1/analytics which calls the same.
export const ANALYTICS_EVENTS = [
  "onboarding_started",
  "username_set",
  "profile_basics_completed",
  "onboarding_step_skipped",
  "intent_selected",
  "onboarding_completed",
  "project_created",
  "application_submitted",
  "application_accepted",
  "milestone_completed",
  "project_completed",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsProps = {
  entry_point?: "organic" | "project_invite" | "group_invite" | "oauth" | "referral";
  step?: string;
  value?: string;
  projectId?: string;
  [k: string]: string | undefined;
};
