import { FileList } from "@/components/workspace/FileList";
import { FileTree } from "@/components/workspace/FileTree";
import { ReadmeCard } from "@/components/workspace/ReadmeCard";
import { RepoHeader } from "@/components/workspace/RepoHeader";
import { RightPanel } from "@/components/workspace/RightPanel";

// Repositories workspace screen — pixel-faithful to Ui/*.png (mock data).
// Dynamic slug is accepted so recent-repo links work; data lookup lands in Phase 1/2.
export default async function RepoPage({ params }: { params: Promise<{ slug: string }> }) {
  await params;
  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <RepoHeader />
        <div className="flex min-h-0 flex-1">
          <FileTree />
          <div className="min-w-0 flex-1 p-4">
            <FileList />
            <ReadmeCard />
          </div>
        </div>
      </div>
      <RightPanel />
    </div>
  );
}
