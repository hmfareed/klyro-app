"use client";

export function ProfileBanner() {
  return (
    <div className="relative h-44 sm:h-56 md:h-64 w-full overflow-hidden rounded-2xl bg-black">
      {/* Super AMOLED dark wave mesh gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-indigo-950/40 to-black" />

      {/* Glowing wave SVG ribbons matching reference image */}
      <svg
        className="absolute inset-0 h-full w-full object-cover opacity-90"
        viewBox="0 0 1200 300"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="wave1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#312e81" stopOpacity="0.8" />
            <stop offset="40%" stopColor="#4f46e5" stopOpacity="0.7" />
            <stop offset="70%" stopColor="#7c3aed" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="wave2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </linearGradient>

          <radialGradient id="bannerGlow" cx="60%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#7c3aed" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="1200" height="300" fill="#000000" />
        <rect width="1200" height="300" fill="url(#bannerGlow)" />

        {/* Smooth fluid layered curves */}
        <path
          d="M0,160 C300,80 500,240 850,110 C1050,40 1150,100 1200,90 L1200,300 L0,300 Z"
          fill="url(#wave1)"
          opacity="0.85"
        />
        <path
          d="M0,210 C250,140 600,290 900,160 C1100,70 1180,130 1200,120 L1200,300 L0,300 Z"
          fill="url(#wave2)"
          opacity="0.5"
        />
        <path
          d="M0,250 C350,210 650,280 950,210 C1100,180 1180,210 1200,200 L1200,300 L0,300 Z"
          fill="#000000"
          opacity="0.75"
        />
      </svg>

      {/* Subtle bottom vignette to blend seamlessly into pure black content below */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
    </div>
  );
}
