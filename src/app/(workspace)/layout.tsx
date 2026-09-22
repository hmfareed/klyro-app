import { Sidebar } from "@/components/workspace/Sidebar";
import { TopBar } from "@/components/workspace/TopBar";

// Authenticated workspace shell from the Ui mock: TopBar + Sidebar persistent,
// main content scrolls between them. Auth pages (/signup, /login, /onboarding)
// stay outside this group and keep the marketing layout.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-[#0a0f24] text-white">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
