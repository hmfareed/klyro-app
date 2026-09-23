import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Git Smart HTTP remotes: http://localhost:3000/:owner/:repo.git/...
      {
        source: "/:owner/:repo([a-zA-Z0-9._-]+)\\.git/:path*",
        destination: "/api/git/:owner/:repo/:path*",
      },
      // Workspace git remotes: http://localhost:3000/repositories/:owner/:repo.git/...
      {
        source: "/repositories/:owner/:repo([a-zA-Z0-9._-]+)\\.git/:path*",
        destination: "/api/git/:owner/:repo/:path*",
      },
      // Direct git prefix: http://localhost:3000/git/:owner/:repo/...
      {
        source: "/git/:owner/:repo([a-zA-Z0-9._-]+)/:path*",
        destination: "/api/git/:owner/:repo/:path*",
      },
      // Git endpoints when cloned without .git extension
      {
        source: "/:owner/:repo([a-zA-Z0-9._-]+)/info/refs",
        destination: "/api/git/:owner/:repo/info/refs",
      },
      {
        source: "/:owner/:repo([a-zA-Z0-9._-]+)/git-upload-pack",
        destination: "/api/git/:owner/:repo/git-upload-pack",
      },
      {
        source: "/:owner/:repo([a-zA-Z0-9._-]+)/git-receive-pack",
        destination: "/api/git/:owner/:repo/git-receive-pack",
      },
      {
        source: "/repositories/:owner/:repo([a-zA-Z0-9._-]+)/info/refs",
        destination: "/api/git/:owner/:repo/info/refs",
      },
      {
        source: "/repositories/:owner/:repo([a-zA-Z0-9._-]+)/git-upload-pack",
        destination: "/api/git/:owner/:repo/git-upload-pack",
      },
      {
        source: "/repositories/:owner/:repo([a-zA-Z0-9._-]+)/git-receive-pack",
        destination: "/api/git/:owner/:repo/git-receive-pack",
      },
    ];
  },
};

export default nextConfig;
