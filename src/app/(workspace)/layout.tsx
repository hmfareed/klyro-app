import { TopBar } from "@/components/workspace/TopBar";
import { SidebarDrawer } from "@/components/workspace/SidebarDrawer";
import { WorkspaceCreateProjectModal } from "@/components/workspace/WorkspaceCreateProjectModal";

// Authenticated workspace shell: Full-width layout with TopBar header,
// on-demand SidebarDrawer navigation, and integrated modals.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-black text-white">
      <TopBar />
      <div className="flex min-h-0 flex-1 w-full">
        <main className="flex min-w-0 flex-1 w-full overflow-hidden">
          {children}
        </main>
      </div>
      <SidebarDrawer />
      <WorkspaceCreateProjectModal />
    </div>
  );
}
