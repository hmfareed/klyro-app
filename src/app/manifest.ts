import type { MetadataRoute } from "next";

// 27 §4: PWA middle step before native — installable, zero native cost.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Klyro — Build together",
    short_name: "Klyro",
    description: "Post what you're building, find people to build it with.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#4f46e5",
    icons: [{ src: "/klyro-mark.png", sizes: "any", type: "image/png" }],
  };
}
