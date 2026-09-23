// Mock workspace data lifted directly from Ui/file_0000000031a481f499cf7b53a0febaeb.png.
// Phase 1+ will replace each section with API data (projects/teams/tasks/files).
// Kept in one file so swapping to fetch() calls is a single diff per component.

export const workspace = {
  name: "Workspace",
  tagline: "Build. Collaborate. Ship.",
  user: { name: "Developer", role: "Developer", initials: "DV" },
};

export const navCounts: Record<string, number | string> = {
  Repositories: 12,
  "Pull Requests": 4,
  Issues: 3,
  Projects: 2,
  Chat: 6,
};

export const recentRepos = [
  "school-management-system",
  "africart-marketplace",
  "klyro-website",
  "waterhub-client",
  "slaybyhumu",
];

export const repo = {
  slug: "school-management-system",
  title: "school-management-system",
  description: "Web application for managing schools, students, teachers and attendance.",
  branch: "main",
  branches: 12,
  tags: 3,
  watch: 3,
  stars: 12,
  forks: 4,
  tabs: [
    { label: "Code", active: true },
    { label: "Issues", count: 3 },
    { label: "Pull Requests", count: 2 },
    { label: "Actions" },
    { label: "Projects" },
    { label: "Wiki" },
    { label: "Settings" },
  ],
  path: "frontend / src / components",
  files: [
    { name: "ui", type: "folder", commit: "feat: add button component", updated: "2 hours ago" },
    { name: "layout", type: "folder", commit: "fix: responsive navbar", updated: "4 hours ago" },
    { name: "dashboard", type: "folder", commit: "feat: dashboard charts", updated: "5 hours ago" },
    { name: "forms", type: "folder", commit: "feat: add form validation", updated: "1 day ago" },
    { name: "index.tsx", type: "file", commit: "feat: initial component", updated: "1 day ago" },
    { name: "button.tsx", type: "file", commit: "fix: button hover style", updated: "3 hours ago" },
    { name: "card.tsx", type: "file", commit: "feat: add card component", updated: "4 hours ago" },
    { name: "modal.tsx", type: "file", commit: "feat: add modal component", updated: "6 hours ago" },
    { name: "table.tsx", type: "file", commit: "feat: table sorting", updated: "1 day ago" },
  ] as { name: string; type: "folder" | "file"; commit: string; updated: string }[],
};

export const fileTree = [
  { name: ".vscode", depth: 0, type: "folder" },
  { name: "backend", depth: 0, type: "folder" },
  { name: "frontend", depth: 0, type: "folder" },
  { name: "src", depth: 1, type: "folder", open: true },
  { name: "components", depth: 2, type: "folder", open: true, active: true },
  { name: "pages", depth: 2, type: "folder" },
  { name: "lib", depth: 1, type: "folder" },
  { name: "styles", depth: 1, type: "folder" },
  { name: "public", depth: 0, type: "folder" },
  { name: ".env.example", depth: 0, type: "file" },
  { name: ".gitignore", depth: 0, type: "file" },
  { name: "next.config.ts", depth: 0, type: "file" },
  { name: "package.json", depth: 0, type: "file" },
  { name: "README.md", depth: 0, type: "file" },
  { name: "docs", depth: 0, type: "folder" },
] as { name: string; depth: number; type: "folder" | "file"; open?: boolean; active?: boolean }[];

export const collaborators = {
  count: 6,
  extra: 2,
  people: ["Fareed", "Abdul", "Maryam", "Kofi", "Ama"],
};

export const activity = [
  {
    who: "Fareed",
    what: "pushed 3 commits",
    when: "2 minutes ago",
    details: ["feat: add attendance module", "fix: dashboard stats", "chore: update dependencies"],
  },
  { who: "Abdul", what: "opened a pull request", when: "5 hours ago", details: ["feat: improve mobile responsiveness #12"] },
  { who: "Maryam", what: "commented on issue", when: "1 day ago", details: ["The GPS check-in is not working on mobile devices. #7"] },
  { who: "Fareed", what: "merged pull request", when: "1 day ago", details: ["Fix: authentication flow #11"] },
];
