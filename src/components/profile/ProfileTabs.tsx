"use client";

export type ProfileTab = "overview" | "repositories" | "projects" | "teams" | "activity";

type ProfileTabsProps = {
  activeTab: ProfileTab;
  onChangeTab: (tab: ProfileTab) => void;
  reposCount?: number;
  projectsCount?: number;
  teamsCount?: number;
};

export function ProfileTabs({
  activeTab,
  onChangeTab,
  reposCount,
  projectsCount,
  teamsCount,
}: ProfileTabsProps) {
  const tabs: Array<{ id: ProfileTab; label: string; count?: number }> = [
    { id: "overview", label: "Overview" },
    { id: "repositories", label: "Repositories", count: reposCount },
    { id: "projects", label: "Projects", count: projectsCount },
    { id: "teams", label: "Teams", count: teamsCount },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="mt-8 border-b border-zinc-800 px-4 sm:px-8">
      <nav className="flex space-x-6 overflow-x-auto scrollbar-none" aria-label="Profile Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex items-center gap-2 pb-3.5 pt-1 text-sm font-semibold transition-colors whitespace-nowrap focus:outline-none ${
                isActive ? "text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    isActive
                      ? "bg-indigo-600/30 text-indigo-400 ring-1 ring-indigo-500/50"
                      : "bg-zinc-900 text-zinc-500"
                  }`}
                >
                  {tab.count}
                </span>
              )}

              {/* Active Tab Underline Indicator matching reference */}
              {isActive && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
