import Image from "next/image";

// Official Klyro brand (Ui/file_00000000a9c8824391c1b0dea7cab76c.png).
// - BrandMark: transparent 'K' mark, safe on dark and light surfaces.
// - BrandLockup: mark + wordmark text rendered in HTML (the lockup PNG's dark
//   wordmark is only legible on light backgrounds, so dark UI composes it).
// - Full lockup file lives at /klyro-logo.png for light surfaces (docs, marketing).

export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/klyro-mark.png"
      alt="Klyro"
      width={Math.round(size * (301 / 333))}
      height={size}
      className={className}
      priority
    />
  );
}

export function BrandLockup({ markSize = 32 }: { markSize?: number }) {
  return (
    <span className="flex items-center gap-2">
      <BrandMark size={markSize} />
      <span className="text-lg font-bold tracking-tight text-white">Klyro</span>
    </span>
  );
}

export const BRAND_TAGLINE = "Code • Collaborate • Build";
