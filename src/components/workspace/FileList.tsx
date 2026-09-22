import { FileCode2, Folder } from "lucide-react";
import { repo } from "@/mock/workspace";

export function FileList() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <p className="border-b border-white/10 px-4 py-2.5 text-sm text-slate-300">{repo.path}</p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Last commit</th>
            <th className="px-4 py-2 text-right font-medium">Last updated</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-white/5 text-slate-400"><td className="px-4 py-2">..</td><td /><td /></tr>
          {repo.files.map((f) => (
            <tr key={f.name} className="border-b border-white/5 last:border-0 hover:bg-white/5">
              <td className="px-4 py-2">
                <span className="flex items-center gap-2 text-slate-200">
                  {f.type === "folder" ? <Folder size={16} className="text-indigo-400" /> : <FileCode2 size={16} className="text-sky-400" />}
                  {f.name}
                </span>
              </td>
              <td className="truncate px-4 py-2 text-slate-400">{f.commit}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-slate-500">{f.updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
