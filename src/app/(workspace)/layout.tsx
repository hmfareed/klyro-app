import { Suspense } from "react";
import { Sidebar } from "@/components/workspace/Sidebar";
import { TopBar } from "@/components/workspace/TopBar";
import { WorkspaceCreateProjectModal } from "@/components/workspace/WorkspaceCreateProjectModal";

// Authenticated workspace shell: TopBar + Sidebar persistent,
// with integrated in-workspace modals.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-[#0a0f24] text-white">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Suspense fallback={<aside className="w-56 shrink-0 bg-[#0b1226] border-r border-white/10" />}>
          <Sidebar />
        </Suspense>
        <div className="flex min-w-0 flex-1">{children}</div>
      </div>
      <WorkspaceCreateProjectModal />
    </div>
  );
}
