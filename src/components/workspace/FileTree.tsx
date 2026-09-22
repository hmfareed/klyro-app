import { ChevronDown, ChevronRight, FileText, Folder, GitBranch, Search } from "lucide-react";
import { fileTree, repo } from "@/mock/workspace";

export function FileTree() {
  return (
    <div className="w-52 shrink-0 overflow-y-auto border-r border-white/10 pr-1">
      <div className="p-2">
        <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-slate-200">
          <GitBranch size={14} /> {repo.branch} <ChevronDown size={14} className="ml-auto" />
        </span>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-slate-400">
          <Search size={14} /> Find a file...
        </div>
      </div>
      <ul className="px-1 pb-4 text-sm">
        {fileTree.map((n) => (
          <li key={`${n.depth}-${n.name}`}>
            <span
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${
                n.active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
              }`}
              style={{ paddingLeft: `${0.5 + n.depth * 0.9}rem` }}
            >
              {n.type === "folder" ? (
                <>
                  {n.open ? <ChevronDown size={13} className="text-slate-500" /> : <ChevronRight size={13} className="text-slate-500" />}
                  <Folder size={15} className="shrink-0 text-indigo-400" />
                </>
              ) : (
                <FileText size={15} className="ml-4 shrink-0 text-sky-400" />
              )}
              <span className="truncate">{n.name}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
