import { ChevronDown, Search } from "lucide-react";
import { BrandLockup } from "@/components/Brand";

const LINKS = ["Product", "Solutions", "Pricing", "Resources"];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <a href="/"><BrandLockup markSize={28} tone="light" /></a>
        <nav className="hidden items-center gap-5 text-sm text-slate-600 lg:flex">
          {LINKS.map((l) => (
            <a key={l} href="#" className="flex items-center gap-1 hover:text-slate-900">
              {l} {l !== "Pricing" && <ChevronDown size={14} />}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button aria-label="Search" className="hidden text-slate-500 hover:text-slate-900 sm:block"><Search size={18} /></button>
          <a href="/login" className="hidden rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 sm:block">
            Sign in
          </a>
          <a href="/signup" className="rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Get started free
          </a>
        </div>
      </div>
    </header>
  );
}
