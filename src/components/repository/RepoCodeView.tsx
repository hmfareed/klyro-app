"use client";

import { useEffect, useState, useCallback } from "react";
import {
  GitBranch,
  Search,
  Folder,
  FileCode2,
  FileText,
  Clock,
  ChevronDown,
  Terminal,
  BookOpen,
  Plus,
  FilePlus,
} from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";
import { RepoGoToFileModal } from "./RepoGoToFileModal";
import { RepoWebEditor } from "./RepoWebEditor";

interface RepoCodeViewProps {
  repository: any;
  owner: string;
  repo: string;
  currentBranch: string;
  onBranchChange: (branch: string) => void;
  currentPath: string;
  onNavigatePath: (path: string) => void;
  onOpenFile: (filePath: string) => void;
  onViewCommits: () => void;
}

export function RepoCodeView({
  repository,
  owner,
  repo,
  currentBranch,
  onBranchChange,
  currentPath,
  onNavigatePath,
  onOpenFile,
  onViewCommits,
}: RepoCodeViewProps) {
  const [treeData, setTreeData] = useState<{ entries: any[]; latestCommit?: any } | null>(null);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [branchDropdown, setBranchDropdown] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [goToFileOpen, setGoToFileOpen] = useState(false);
  const [addFileMenu, setAddFileMenu] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);

  const isProtectedBranch = Boolean(
    repository?.branchRules?.some((r: any) => r.pattern === currentBranch && r.requirePullRequest)
  );

  // Keyboard shortcut 'T' to open Go To File modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "t" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setGoToFileOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadTree = useCallback(() => {
    setLoading(true);
    const query = new URLSearchParams();
    query.set("ref", currentBranch);
    if (currentPath) query.set("path", currentPath);

    fetch(`/api/v1/repositories/${owner}/${repo}/tree?${query.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.data) {
          setTreeData({
            entries: d.data.entries || [],
            latestCommit: d.data.latestCommit,
          });

          // Check if README.md exists in entries
          const readmeEntry = (d.data.entries || []).find(
            (e: any) => e.name.toLowerCase() === "readme.md" && e.type === "blob"
          );

          if (readmeEntry) {
            fetch(`/api/v1/repositories/${owner}/${repo}/blob?ref=${currentBranch}&path=${readmeEntry.path}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((fileData) => {
                if (fileData?.data?.content) {
                  setReadmeContent(fileData.data.content);
                } else {
                  setReadmeContent(null);
                }
              })
              .catch(() => setReadmeContent(null));
          } else {
            setReadmeContent(null);
          }
        }
      })
      .catch(() => {
        setTreeData({ entries: [] });
      })
      .finally(() => setLoading(false));
  }, [owner, repo, currentBranch, currentPath]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // Format file size
  const formatSize = (bytes?: number) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Breadcrumbs segments
  const pathSegments = currentPath ? currentPath.split("/").filter(Boolean) : [];

  const branches = repository.branches || [];
  const filteredBranches = branchSearch.trim()
    ? branches.filter((b: any) => b.name.toLowerCase().includes(branchSearch.toLowerCase()))
    : branches;

  if (isCreatingFile) {
    return (
      <RepoWebEditor
        owner={owner}
        repo={repo}
        refName={currentBranch}
        initialFilePath={currentPath ? `${currentPath}/` : ""}
        isNewFile={true}
        isProtectedBranch={isProtectedBranch}
        onCancel={() => setIsCreatingFile(false)}
        onCommitted={({ branch, isNewBranch, filePath }) => {
          setIsCreatingFile(false);
          if (isNewBranch) {
            onBranchChange(branch);
          }
          loadTree();
          onOpenFile(filePath);
        }}
      />
    );
  }

  // Empty repository state
  if (!loading && (!treeData?.entries || treeData.entries.length === 0) && !currentPath) {
    const cloneUrl = `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/repositories/${owner}/${repo}.git`;
    return (
      <div className="flex-1 overflow-y-auto p-6 sm:p-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.02] p-8 shadow-xl">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-6">
            <Terminal size={24} className="text-indigo-400" />
            <div>
              <h2 className="text-lg font-bold text-white">This repository is empty</h2>
              <p className="text-xs text-slate-400">
                Push your first commit from your computer or{" "}
                <button
                  onClick={() => setIsCreatingFile(true)}
                  className="text-indigo-400 font-semibold underline hover:text-indigo-300 cursor-pointer"
                >
                  create a new file
                </button>{" "}
                directly in the browser.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-slate-300 mb-2">…or create a new repository on the command line</h3>
              <div className="rounded-xl border border-white/10 bg-zinc-950 p-4 font-mono text-xs text-slate-200 space-y-1">
                <p><span className="text-slate-500">echo &quot;# {repository.name}&quot; &gt;&gt; README.md</span></p>
                <p><span className="text-slate-500">git init</span></p>
                <p><span className="text-slate-500">git add README.md</span></p>
                <p><span className="text-slate-500">git commit -m &quot;first commit&quot;</span></p>
                <p><span className="text-slate-500">git branch -M main</span></p>
                <p><span className="text-slate-500">git remote add origin {cloneUrl}</span></p>
                <p><span className="text-indigo-400">git push -u origin main</span></p>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-300 mb-2">…or push an existing repository from the command line</h3>
              <div className="rounded-xl border border-white/10 bg-zinc-950 p-4 font-mono text-xs text-slate-200 space-y-1">
                <p><span className="text-slate-500">git remote add origin {cloneUrl}</span></p>
                <p><span className="text-slate-500">git branch -M main</span></p>
                <p><span className="text-indigo-400">git push -u origin main</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Controls Bar: Branch Switcher, Breadcrumbs, Go To File button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Branch Dropdown */}
          <div className="relative">
            <button
              onClick={() => setBranchDropdown(!branchDropdown)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <GitBranch size={14} className="text-indigo-400" />
              <span>{currentBranch}</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>

            {branchDropdown && (
              <div
                className="absolute left-0 top-full mt-1.5 w-64 rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl z-40"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-1">
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs mb-2">
                    <Search size={12} className="text-slate-500" />
                    <input
                      type="text"
                      value={branchSearch}
                      onChange={(e) => setBranchSearch(e.target.value)}
                      placeholder="Find a branch…"
                      className="w-full bg-transparent text-white focus:outline-none text-[11px]"
                    />
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {filteredBranches.map((b: any) => (
                    <button
                      key={b.name}
                      onClick={() => {
                        onBranchChange(b.name);
                        setBranchDropdown(false);
                      }}
                      className={`flex items-center justify-between w-full rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                        b.name === currentBranch
                          ? "bg-indigo-600 text-white font-semibold"
                          : "text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      {b.isDefault && (
                        <span className="text-[10px] text-slate-400 font-normal px-1 rounded bg-white/10">
                          default
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Breadcrumb Path */}
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
            <button
              onClick={() => onNavigatePath("")}
              className={`hover:text-indigo-400 transition-colors ${currentPath ? "text-indigo-400 font-semibold cursor-pointer" : "text-white font-bold"}`}
            >
              {repository.name}
            </button>
            {pathSegments.map((seg, idx) => {
              const fullSubpath = pathSegments.slice(0, idx + 1).join("/");
              const isLast = idx === pathSegments.length - 1;
              return (
                <span key={fullSubpath} className="flex items-center gap-1.5">
                  <span className="text-slate-500">/</span>
                  <button
                    onClick={() => onNavigatePath(fullSubpath)}
                    disabled={isLast}
                    className={`transition-colors ${
                      isLast
                        ? "text-white font-bold"
                        : "text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                    }`}
                  >
                    {seg}
                  </button>
                </span>
              );
            })}
          </div>
        </div>

        {/* Go to file, Add file & Commits buttons */}
        <div className="flex items-center gap-2">
          {/* Add file button */}
          <div className="relative">
            <button
              onClick={() => setAddFileMenu(!addFileMenu)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>Add file</span>
              <ChevronDown size={11} className="text-slate-400" />
            </button>

            {addFileMenu && (
              <div
                className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-white/10 bg-zinc-950 p-1.5 shadow-2xl z-40 animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setAddFileMenu(false);
                    setIsCreatingFile(true);
                  }}
                  className="flex items-center gap-2 w-full rounded-lg px-2.5 py-1.5 text-xs text-left text-slate-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                >
                  <FilePlus size={13} className="text-indigo-400" />
                  <span>Create new file</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setGoToFileOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <Search size={13} />
            <span>Go to file</span>
            <kbd className="rounded border border-white/20 px-1 py-0.2 text-[10px] text-slate-400">t</kbd>
          </button>

          <button
            onClick={onViewCommits}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <Clock size={13} />
            <span>Commits</span>
          </button>
        </div>
      </div>

      {/* Latest Commit Bar */}
      {treeData?.latestCommit && (
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-300">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-white truncate">{treeData.latestCommit.author}</span>
            <span className="text-slate-400 truncate">{treeData.latestCommit.message}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-slate-500 text-[11px]">
            <span className="font-mono text-indigo-400">{treeData.latestCommit.shortSha}</span>
            <span>{treeData.latestCommit.relativeDate}</span>
          </div>
        </div>
      )}

      {/* File Browser Table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-500 bg-white/[0.01]">
              <th className="px-4 py-2.5 font-semibold">Name</th>
              <th className="px-4 py-2.5 font-semibold">Last Commit</th>
              <th className="px-4 py-2.5 font-semibold text-right">Updated</th>
              <th className="px-4 py-2.5 font-semibold text-right w-20">Size</th>
            </tr>
          </thead>
          <tbody>
            {/* ".." Up Directory row */}
            {currentPath && (
              <tr
                onClick={() => {
                  const parent = pathSegments.slice(0, -1).join("/");
                  onNavigatePath(parent);
                }}
                className="border-b border-white/5 hover:bg-white/5 cursor-pointer text-indigo-400 font-semibold"
              >
                <td className="px-4 py-2.5 flex items-center gap-2">
                  <Folder size={15} /> ..
                </td>
                <td />
                <td />
                <td />
              </tr>
            )}

            {loading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                </td>
              </tr>
            ) : treeData?.entries.map((entry) => {
              const isFolder = entry.type === "tree";
              return (
                <tr
                  key={entry.path}
                  onClick={() => {
                    if (isFolder) onNavigatePath(entry.path);
                    else onOpenFile(entry.path);
                  }}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  {/* File / Folder Name */}
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 font-medium text-slate-200">
                      {isFolder ? (
                        <Folder size={15} className="text-indigo-400 shrink-0" />
                      ) : entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") || entry.name.endsWith(".js") ? (
                        <FileCode2 size={15} className="text-sky-400 shrink-0" />
                      ) : (
                        <FileText size={15} className="text-slate-400 shrink-0" />
                      )}
                      <span className="truncate hover:underline">{entry.name}</span>
                    </span>
                  </td>

                  {/* Last commit message */}
                  <td className="px-4 py-2.5 text-slate-400 truncate max-w-xs">
                    {entry.lastCommit?.message || "—"}
                  </td>

                  {/* Relative date */}
                  <td className="px-4 py-2.5 text-slate-500 text-right whitespace-nowrap">
                    {entry.lastCommit?.date || "—"}
                  </td>

                  {/* Size */}
                  <td className="px-4 py-2.5 text-slate-500 text-right font-mono whitespace-nowrap">
                    {formatSize(entry.size)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* README Renderer */}
      {readmeContent && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-sm">
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-5 py-3">
            <BookOpen size={16} className="text-indigo-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">README.md</h3>
          </div>
          <div className="p-6 sm:p-8">
            <MarkdownViewer content={readmeContent} />
          </div>
        </div>
      )}

      {/* Go To File Modal */}
      <RepoGoToFileModal
        isOpen={goToFileOpen}
        onClose={() => setGoToFileOpen(false)}
        onSelectFile={(filePath) => onOpenFile(filePath)}
        owner={owner}
        repo={repo}
        refName={currentBranch}
      />
    </div>
  );
}
