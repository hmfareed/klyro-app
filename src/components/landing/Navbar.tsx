import Link from "next/link";
import { BrandLockup } from "@/components/Brand";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link href="/"><BrandLockup markSize={28} tone="light" /></Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
          <Link href="/projects" className="hover:text-slate-900 transition-colors">
            Explore Projects
          </Link>
          <Link href="/repositories" className="hover:text-slate-900 transition-colors">
            Workspace
          </Link>
          <Link href="/#features" className="hover:text-slate-900 transition-colors">
            Features
          </Link>
          <Link href="/#pricing" className="hover:text-slate-900 transition-colors">
            Pricing
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/projects/new" className="hidden rounded-lg border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-300 sm:block transition-colors">
            + New Project
          </Link>
          <Link href="/login" className="hidden rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 sm:block transition-colors">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 shadow-sm transition-opacity">
            Get started free
          </Link>
        </div>
      </div>
    </header>
  );
}
