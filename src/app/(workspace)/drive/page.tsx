"use client";

import { useState } from "react";
import {
  HardDrive,
  FileText,
  FileCode,
  ImageIcon as FileImage,
  Folder,
  Upload,
  Download,
  Search,
} from "lucide-react";

interface DriveFile {
  id: string;
  name: string;
  type: "document" | "code" | "image" | "archive";
  size: string;
  repo: string;
  uploader: string;
  updatedAt: string;
}

const FILES: DriveFile[] = [
  {
    id: "f-1",
    name: "architecture-v1-spec.pdf",
    type: "document",
    size: "2.4 MB",
    repo: "school-management-system",
    uploader: "Fareed",
    updatedAt: "2 days ago",
  },
  {
    id: "f-2",
    name: "database-schema-v1.sql",
    type: "code",
    size: "148 KB",
    repo: "school-management-system",
    uploader: "Fareed",
    updatedAt: "3 days ago",
  },
  {
    id: "f-3",
    name: "branding-assets-pack.zip",
    type: "archive",
    size: "18.2 MB",
    repo: "klyro-website",
    uploader: "Maryam",
    updatedAt: "1 week ago",
  },
  {
    id: "f-4",
    name: "dashboard-mockup-final.png",
    type: "image",
    size: "3.8 MB",
    repo: "africart-marketplace",
    uploader: "Abdul",
    updatedAt: "1 week ago",
  },
  {
    id: "f-5",
    name: "smart-contract-escrow.sol",
    type: "code",
    size: "42 KB",
    repo: "africart-marketplace",
    uploader: "Fareed",
    updatedAt: "2 weeks ago",
  },
];

export default function WorkspaceDrivePage() {
  const [files] = useState<DriveFile[]>(FILES);
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<string>("all");

  const filtered = files.filter((f) => {
    if (activeType !== "all" && f.type !== activeType) return false;
    if (search.trim() && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f24] p-6 text-white min-w-0">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <HardDrive size={20} className="text-amber-400" />
            Workspace Drive
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cloud file storage, architectural schemas, documentation, and design assets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
            <Folder size={14} /> New Folder
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors">
            <Upload size={14} /> Upload File
          </button>
        </div>
      </div>

      {/* Storage Quota Card */}
      <div className="mb-6 rounded-xl border border-white/10 bg-[#0b1226] p-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-slate-300">Storage Usage</span>
          <span className="text-slate-400 font-mono">1.2 GB of 10.0 GB (12%)</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-indigo-500" style={{ width: "12%" }} />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-[#0b1226] border border-white/10 p-1 w-full sm:w-auto">
          {["all", "document", "code", "image", "archive"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                activeType === t
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t === "all" ? "All Files" : `${t}s`}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search drive files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#0b1226] py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Files Table */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1226] shadow-sm">
        <table className="w-full text-left text-xs text-slate-400">
          <thead className="border-b border-white/10 bg-white/[0.02] text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3">File Name</th>
              <th className="px-5 py-3">Repository</th>
              <th className="px-5 py-3">Size</th>
              <th className="px-5 py-3">Uploaded By</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((file) => (
              <tr key={file.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3.5 font-medium text-white flex items-center gap-2.5">
                  {file.type === "document" && <FileText size={16} className="text-red-400 shrink-0" />}
                  {file.type === "code" && <FileCode size={16} className="text-indigo-400 shrink-0" />}
                  {file.type === "image" && <FileImage size={16} className="text-emerald-400 shrink-0" />}
                  {file.type === "archive" && <HardDrive size={16} className="text-amber-400 shrink-0" />}
                  <span className="truncate">{file.name}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] font-mono text-slate-300 border border-white/10">
                    {file.repo}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-mono text-[11px]">{file.size}</td>
                <td className="px-5 py-3.5 text-slate-300">{file.uploader}</td>
                <td className="px-5 py-3.5 text-slate-500">{file.updatedAt}</td>
                <td className="px-5 py-3.5 text-right">
                  <button className="rounded p-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                    <Download size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
