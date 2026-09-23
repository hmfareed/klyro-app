"use client";

import { useEffect, useState } from "react";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Shield,
  Clock,
  AlertTriangle,
  ExternalLink,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";

interface TokenRecord {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function PersonalAccessTokensPage() {
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [expirationDays, setExpirationDays] = useState<number | null>(90);
  const [scopes, setScopes] = useState<string[]>(["repo:read", "repo:write"]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  // Revealed token (one-time)
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoking
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadTokens = async () => {
    try {
      const res = await fetch("/api/v1/user/tokens");
      if (res.ok) {
        const data = await res.json();
        setTokens(data?.data?.tokens || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTokens();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setGenerateError("Please provide a token name");
      return;
    }

    setGenerating(true);
    setGenerateError("");

    try {
      const res = await fetch("/api/v1/user/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          expirationDays,
          scopes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data?.error?.message || "Failed to generate token");
        return;
      }

      setRevealedToken(data.data.token);
      setName("");
      setShowModal(false);
      loadTokens();
    } catch (err: any) {
      setGenerateError(err.message || "Failed to generate token");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this token? Any Git remote operations using it will immediately fail.")) {
      return;
    }

    setRevokingId(id);
    try {
      const res = await fetch(`/api/v1/user/tokens/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTokens((prev) => prev.filter((t) => t.id !== id));
      }
    } catch {} finally {
      setRevokingId(null);
    }
  };

  const copyRevealed = () => {
    if (!revealedToken) return;
    navigator.clipboard.writeText(revealedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scope: string) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-black text-white p-6 sm:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/repositories"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors mb-2"
            >
              <ChevronLeft size={14} /> Back to repositories
            </Link>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Key size={24} className="text-indigo-400" /> Personal Access Tokens
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Personal access tokens function like ordinary passwords for Git remote operations (clone, fetch, push) from VS Code, JetBrains IDEs, and Git CLI.
            </p>
          </div>

          <button
            onClick={() => {
              setRevealedToken(null);
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-indigo-500 transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Generate token</span>
          </button>
        </div>

        {/* One-Time Token Reveal Box */}
        {revealedToken && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold mb-1.5">
              <Shield size={18} /> Token Generated Successfully
            </div>
            <p className="text-xs text-slate-300 mb-3">
              Make sure to copy your personal access token now. You won't be able to see it again!
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-black/60 p-2.5">
              <input
                type="text"
                readOnly
                value={revealedToken}
                className="w-full bg-transparent font-mono text-xs text-emerald-200 focus:outline-none select-all"
              />
              <button
                onClick={copyRevealed}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors cursor-pointer shrink-0"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tokens List */}
        <div className="rounded-2xl border border-zinc-800 bg-[#090d1f] shadow-xl overflow-hidden">
          <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Active Tokens ({tokens.length})</h2>
            <span className="text-[11px] text-slate-500">Tokens are securely hashed (SHA-256)</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="p-12 text-center">
              <Key size={36} className="mx-auto text-slate-600 mb-3" />
              <p className="text-sm font-semibold text-slate-300">No active personal access tokens</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Generate a token to push code, authenticate with Git over HTTPS, or connect VS Code.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer"
              >
                <Plus size={14} /> Generate token
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {tokens.map((token) => {
                const isExpired =
                  token.expiresAt && new Date(token.expiresAt).getTime() < Date.now();
                return (
                  <div key={token.id} className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-white text-sm">{token.name}</span>
                        <code className="rounded bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                          {token.tokenPrefix}
                        </code>
                        {isExpired && (
                          <span className="rounded-full bg-red-950/80 border border-red-500/30 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                            Expired
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {token.scopes.map((s) => (
                          <span
                            key={s}
                            className="rounded-md border border-indigo-500/20 bg-indigo-950/30 px-2 py-0.2 text-[10px] font-medium text-indigo-300"
                          >
                            {s}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                        <span>Created {new Date(token.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>
                          {token.lastUsedAt
                            ? `Last used ${new Date(token.lastUsedAt).toLocaleDateString()}`
                            : "Never used"}
                        </span>
                        <span>•</span>
                        <span>
                          {token.expiresAt
                            ? `Expires ${new Date(token.expiresAt).toLocaleDateString()}`
                            : "No expiration"}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRevoke(token.id)}
                      disabled={revokingId === token.id}
                      className="rounded-xl border border-red-500/30 bg-red-950/20 p-2 text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Revoke token"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Generate Token Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
              <h3 className="text-lg font-bold text-white">New Personal Access Token</h3>
              <p className="mt-1 text-xs text-slate-400">
                Personal tokens provide Git remote write and read authorization.
              </p>

              {generateError && (
                <div className="mt-3 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-300">
                  {generateError}
                </div>
              )}

              <form onSubmit={handleGenerate} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Note / Description
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VS Code Laptop, CI Runner, JetBrains"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Expiration
                  </label>
                  <select
                    value={expirationDays === null ? "never" : expirationDays}
                    onChange={(e) =>
                      setExpirationDays(e.target.value === "never" ? null : parseInt(e.target.value, 10))
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days (Recommended)</option>
                    <option value={365}>1 year</option>
                    <option value="never">No expiration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Select Scopes
                  </label>
                  <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scopes.includes("repo:read")}
                        onChange={() => toggleScope("repo:read")}
                        className="mt-0.5 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-0"
                      />
                      <div>
                        <p className="text-xs font-semibold text-white">repo:read</p>
                        <p className="text-[11px] text-slate-400">Clone and fetch public and private repositories</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scopes.includes("repo:write")}
                        onChange={() => toggleScope("repo:write")}
                        className="mt-0.5 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-0"
                      />
                      <div>
                        <p className="text-xs font-semibold text-white">repo:write</p>
                        <p className="text-[11px] text-slate-400">Push commits, create and delete branches</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scopes.includes("repo:admin")}
                        onChange={() => toggleScope("repo:admin")}
                        className="mt-0.5 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-0"
                      />
                      <div>
                        <p className="text-xs font-semibold text-white">repo:admin</p>
                        <p className="text-[11px] text-slate-400">Manage repository settings, branch rules, and webhooks</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-zinc-900 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generating}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {generating ? "Generating..." : "Generate Token"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
