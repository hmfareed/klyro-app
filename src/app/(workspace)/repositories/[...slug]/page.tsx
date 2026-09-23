"use client";

import { use, useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FolderGit2 } from "lucide-react";
import Link from "next/link";

import { RepoHeader } from "@/components/repository/RepoHeader";
import { RepoCodeView } from "@/components/repository/RepoCodeView";
import { RepoBlobView } from "@/components/repository/RepoBlobView";
import { RepoBlameView } from "@/components/repository/RepoBlameView";
import { RepoCommitsView } from "@/components/repository/RepoCommitsView";
import { RepoCommitDiffView } from "@/components/repository/RepoCommitDiffView";
import { RepoBranchesView } from "@/components/repository/RepoBranchesView";
import { RepoPullRequestsView } from "@/components/repository/RepoPullRequestsView";
import { RepoIssuesView } from "@/components/repository/RepoIssuesView";
import { RepoActionsView } from "@/components/repository/RepoActionsView";
import { RepoReleasesView } from "@/components/repository/RepoReleasesView";
import { RepoSettingsView } from "@/components/repository/RepoSettingsView";
import { RepoNetworkGraphView } from "@/components/repository/RepoNetworkGraphView";

interface RepoDashboardProps {
  params: Promise<{ slug: string[] }>;
}

function RepositoryShell({ params }: RepoDashboardProps) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse path segments
  const first = slug?.[0] || "";
  const second = slug?.[1] || "";
  const third = slug?.[2] || "";
  const fourth = slug?.[3] || "";

  // If 1 segment, owner is unknown yet, will resolve from API
  // If 2+ segments, owner = first, repoSlug = second
  const hasOwnerAndRepo = slug.length >= 2;
  const initialOwner = hasOwnerAndRepo ? first : "";
  const initialRepo = hasOwnerAndRepo ? second : first;

  const [repository, setRepository] = useState<any | null>(null);
  const [viewer, setViewer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Active view states
  const [activeTab, setActiveTab] = useState("code");
  const [activeBranch, setActiveBranch] = useState("main");
  const [currentPath, setCurrentPath] = useState("");
  const [blobFile, setBlobFile] = useState<string | null>(null);
  const [isBlame, setIsBlame] = useState(false);
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null);
  const [selectedPRNumber, setSelectedPRNumber] = useState<number | null>(null);
  const [selectedIssueNumber, setSelectedIssueNumber] = useState<number | null>(null);

  // Sync state from URL
  useEffect(() => {
    if (third === "commits") {
      setActiveTab("commits");
      setSelectedCommitSha(null);
    } else if (third === "commit" && fourth) {
      setActiveTab("commits");
      setSelectedCommitSha(fourth);
    } else if (third === "branches") {
      setActiveTab("branches");
    } else if (third === "pulls") {
      setActiveTab("pulls");
      setSelectedPRNumber(fourth ? parseInt(fourth, 10) : null);
    } else if (third === "issues") {
      setActiveTab("issues");
      setSelectedIssueNumber(fourth ? parseInt(fourth, 10) : null);
    } else if (third === "actions") {
      setActiveTab("actions");
    } else if (third === "releases" || third === "tags") {
      setActiveTab("releases");
    } else if (third === "settings") {
      setActiveTab("settings");
    } else if (third === "blob" && fourth) {
      setActiveTab("code");
      setActiveBranch(fourth);
      setBlobFile(slug.slice(4).join("/"));
      setIsBlame(false);
    } else if (third === "blame" && fourth) {
      setActiveTab("code");
      setActiveBranch(fourth);
      setBlobFile(slug.slice(4).join("/"));
      setIsBlame(true);
    } else if (third === "tree" && fourth) {
      setActiveTab("code");
      setActiveBranch(fourth);
      setCurrentPath(slug.slice(4).join("/"));
      setBlobFile(null);
    } else {
      const tabQuery = searchParams.get("tab");
      if (tabQuery) setActiveTab(tabQuery);
    }
  }, [slug, third, fourth, searchParams]);

  const loadRepository = useCallback(() => {
    let url = `/api/v1/repositories/${initialOwner}/${initialRepo}`;
    if (!hasOwnerAndRepo) {
      url = `/api/v1/repositories/${first}`;
    }

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        const repoData = d?.data?.repository || d?.repository;
        const viewerData = d?.data?.viewer || d?.viewer;
        if (repoData) {
          setRepository(repoData);
          setViewer(viewerData);
          if (repoData.defaultBranch && !fourth) {
            setActiveBranch(repoData.defaultBranch);
          }
          if (!hasOwnerAndRepo && repoData.owner?.username) {
            router.replace(`/repositories/${repoData.owner.username}/${repoData.slug}`, { scroll: false });
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [first, initialOwner, initialRepo, hasOwnerAndRepo, fourth]);

  useEffect(() => {
    loadRepository();
  }, [loadRepository]);

  // Tab change handler
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setBlobFile(null);
    setSelectedCommitSha(null);
    setSelectedPRNumber(null);
    setSelectedIssueNumber(null);

    if (repository) {
      const owner = repository.owner.username;
      const rSlug = repository.slug;
      if (tab === "code") router.push(`/repositories/${owner}/${rSlug}`, { scroll: false });
      else router.push(`/repositories/${owner}/${rSlug}?tab=${tab}`, { scroll: false });
    }
  };

  // Toggle star
  const handleStarToggle = async () => {
    if (!repository) return;
    try {
      const res = await fetch(`/api/v1/repositories/${repository.owner.username}/${repository.slug}/star`, {
        method: "POST",
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data) {
        setViewer((v: any) => ({ ...v, isStarred: d.data.starred }));
        setRepository((r: any) => ({
          ...r,
          _count: { ...r._count, stars: d.data.starsCount },
        }));
      }
    } catch {}
  };

  // Toggle watch
  const handleWatchToggle = async () => {
    if (!repository) return;
    try {
      const res = await fetch(`/api/v1/repositories/${repository.owner.username}/${repository.slug}/watch`, {
        method: "POST",
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data) {
        setViewer((v: any) => ({ ...v, isWatching: d.data.watching }));
        setRepository((r: any) => ({
          ...r,
          _count: { ...r._count, watchers: d.data.watchersCount },
        }));
      }
    } catch {}
  };

  // Fork
  const handleFork = async () => {
    if (!repository) return;
    try {
      const res = await fetch(`/api/v1/repositories/${repository.owner.username}/${repository.slug}/fork`, {
        method: "POST",
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data?.repository) {
        router.push(`/repositories/${d.data.repository.owner.username}/${d.data.repository.slug}`);
      }
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!repository) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 bg-black">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl">
          <FolderGit2 size={36} className="mx-auto text-slate-500 mb-3" />
          <h2 className="text-lg font-bold text-white">Repository not found</h2>
          <p className="mt-2 text-xs text-slate-400">
            The repository may have been renamed, deleted, or is private.
          </p>
          <div className="mt-6">
            <Link
              href="/repositories"
              className="inline-block rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Back to repositories
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const owner = repository.owner.username;
  const repoName = repository.slug;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-black text-white">
      {/* Header bar */}
      <RepoHeader
        repository={repository}
        viewer={viewer}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onStarToggle={handleStarToggle}
        onWatchToggle={handleWatchToggle}
        onFork={handleFork}
        onRestore={loadRepository}
      />

      {/* Main Tab View */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {activeTab === "code" && (
          <>
            {blobFile ? (
              isBlame ? (
                <RepoBlameView
                  owner={owner}
                  repo={repoName}
                  refName={activeBranch}
                  filePath={blobFile}
                  onNavigateBack={() => setIsBlame(false)}
                  onViewCommit={(sha) => {
                    setSelectedCommitSha(sha);
                    setActiveTab("commits");
                  }}
                />
              ) : (
                <RepoBlobView
                  owner={owner}
                  repo={repoName}
                  refName={activeBranch}
                  filePath={blobFile}
                  isProtectedBranch={Boolean(
                    repository?.branchRules?.some(
                      (r: any) => r.pattern === activeBranch && r.requirePullRequest
                    )
                  )}
                  onNavigateBack={() => setBlobFile(null)}
                  onViewBlame={() => setIsBlame(true)}
                  onViewHistory={() => {
                    setActiveTab("commits");
                  }}
                  onBranchChange={(b) => setActiveBranch(b)}
                />
              )
            ) : (
              <RepoCodeView
                repository={repository}
                owner={owner}
                repo={repoName}
                currentBranch={activeBranch}
                onBranchChange={(b) => setActiveBranch(b)}
                currentPath={currentPath}
                onNavigatePath={(p) => setCurrentPath(p)}
                onOpenFile={(p) => setBlobFile(p)}
                onViewCommits={() => setActiveTab("commits")}
              />
            )}
          </>
        )}

        {activeTab === "commits" && (
          <>
            {selectedCommitSha ? (
              <RepoCommitDiffView
                owner={owner}
                repo={repoName}
                sha={selectedCommitSha}
                onBack={() => setSelectedCommitSha(null)}
              />
            ) : (
              <RepoCommitsView
                owner={owner}
                repo={repoName}
                refName={activeBranch}
                onSelectCommit={(sha) => setSelectedCommitSha(sha)}
                onViewGraph={() => setActiveTab("graph")}
              />
            )}
          </>
        )}

        {(activeTab === "graph" || activeTab === "network") && (
          <>
            {selectedCommitSha ? (
              <RepoCommitDiffView
                owner={owner}
                repo={repoName}
                sha={selectedCommitSha}
                onBack={() => setSelectedCommitSha(null)}
              />
            ) : (
              <RepoNetworkGraphView
                owner={owner}
                repo={repoName}
                defaultBranch={repository.defaultBranch}
                onSelectCommit={(sha) => setSelectedCommitSha(sha)}
                onSelectBranch={(b) => {
                  setActiveBranch(b);
                  setActiveTab("code");
                }}
              />
            )}
          </>
        )}

        {activeTab === "branches" && (
          <RepoBranchesView
            owner={owner}
            repo={repoName}
            defaultBranch={repository.defaultBranch}
            viewer={viewer}
            onSelectBranch={(b) => {
              setActiveBranch(b);
              setActiveTab("code");
            }}
          />
        )}

        {activeTab === "pulls" && (
          <RepoPullRequestsView
            owner={owner}
            repo={repoName}
            defaultBranch={repository.defaultBranch}
            viewer={viewer}
            selectedPRNumber={selectedPRNumber}
            onSelectPR={(num) => setSelectedPRNumber(num)}
          />
        )}

        {activeTab === "issues" && (
          <RepoIssuesView
            owner={owner}
            repo={repoName}
            viewer={viewer}
            selectedIssueNumber={selectedIssueNumber}
            onSelectIssue={(num) => setSelectedIssueNumber(num)}
          />
        )}

        {activeTab === "actions" && (
          <RepoActionsView
            owner={owner}
            repo={repoName}
            defaultBranch={repository.defaultBranch}
            viewer={viewer}
          />
        )}

        {activeTab === "releases" && (
          <RepoReleasesView
            owner={owner}
            repo={repoName}
            defaultBranch={repository.defaultBranch}
            viewer={viewer}
          />
        )}

        {activeTab === "settings" && (
          <RepoSettingsView
            repository={repository}
            owner={owner}
            repo={repoName}
            viewer={viewer}
            onRefresh={loadRepository}
          />
        )}
      </div>
    </div>
  );
}

export default function RepositoryDashboardPage(props: RepoDashboardProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-12 bg-black">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      }
    >
      <RepositoryShell {...props} />
    </Suspense>
  );
}
