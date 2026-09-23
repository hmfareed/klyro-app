"use client";

import { useEffect, useState } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  Shield,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  Terminal,
} from "lucide-react";
import Link from "next/link";

interface SshKeyRecord {
  id: string;
  title: string;
  fingerprint: string;
  keyType: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function SshKeysSettingsPage() {
  const [keys, setKeys] = useState<SshKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal state
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Copy fingerprint state
  const [copiedFingerprint, setCopiedFingerprint] = useState<string | null>(null);

  // Deleting key state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadKeys = async () => {
    try {
      const res = await fetch("/api/v1/user/ssh-keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data?.data?.keys || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey.trim()) {
      setAddError("Please paste your SSH public key.");
      return;
    }

    setAdding(true);
    setAddError("");

    try {
      const res = await fetch("/api/v1/user/ssh-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          publicKey: publicKey.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAddError(data?.error?.message || "Failed to add SSH key");
        return;
      }

      setTitle("");
      setPublicKey("");
      setShowModal(false);
      loadKeys();
    } catch (err: any) {
      setAddError(err.message || "Failed to add SSH key");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this SSH key? Any Git operations using this key will immediately fail.")) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/user/ssh-keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
      }
    } catch {} finally {
      setDeletingId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFingerprint(id);
    setTimeout(() => setCopiedFingerprint(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-zinc-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Link
            href="/repositories"
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Repositories
          </Link>
          <span>/</span>
          <span className="text-zinc-200">Settings</span>
          <span>/</span>
          <span className="text-emerald-400 font-medium">SSH Keys</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
              <KeyRound className="w-6 h-6 text-emerald-400" />
              SSH Keys
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Add your SSH public keys to authenticate Git pushes and clones over SSH (<code className="text-emerald-400 bg-emerald-950/40 px-1 py-0.5 rounded text-xs">git@klyro.dev</code>).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings/tokens"
              className="px-3.5 py-2 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded-lg transition-colors"
            >
              HTTPS Tokens
            </Link>
            <button
              onClick={() => {
                setShowModal(true);
                setAddError("");
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-emerald-950/50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New SSH Key
            </button>
          </div>
        </div>

        {/* SSH Keys List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-16 text-zinc-500 text-sm">
              Loading your SSH keys...
            </div>
          ) : keys.length === 0 ? (
            <div className="border border-dashed border-zinc-800 rounded-xl p-8 text-center bg-[#090C14]">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 text-zinc-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-zinc-200">No SSH keys registered</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 mb-6">
                You have not added any SSH keys yet. Add an SSH public key from your development machine to clone and push without HTTPS credentials.
              </p>

              {/* Terminal Quick Instructions */}
              <div className="bg-[#05070B] border border-zinc-800/80 rounded-lg p-4 max-w-lg mx-auto text-left space-y-2">
                <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Generate a new SSH key on your machine:</span>
                </div>
                <pre className="text-xs text-emerald-300/90 font-mono bg-zinc-950/80 p-2.5 rounded border border-zinc-800/60 overflow-x-auto">
                  ssh-keygen -t ed25519 -C "your-email@example.com"
                </pre>
                <div className="text-xs text-zinc-400 font-mono pt-1">
                  <span>Then copy the public key to clipboard:</span>
                </div>
                <pre className="text-xs text-emerald-300/90 font-mono bg-zinc-950/80 p-2.5 rounded border border-zinc-800/60 overflow-x-auto">
                  cat ~/.ssh/id_ed25519.pub
                </pre>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                >
                  Add Your First SSH Key
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-xl overflow-hidden bg-[#0A0D16]">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-900/40 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <KeyRound className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="font-semibold text-white text-sm">{k.title}</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                        {k.keyType}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                      <span>{k.fingerprint}</span>
                      <button
                        onClick={() => copyToClipboard(k.fingerprint, k.id)}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                        title="Copy fingerprint"
                      >
                        {copiedFingerprint === k.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                      <span>Added {new Date(k.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>
                        {k.lastUsedAt
                          ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                          : "Never used"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleDeleteKey(k.id)}
                      disabled={deletingId === k.id}
                      className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors border border-transparent hover:border-red-900/40"
                      title="Delete SSH Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Educational Info Card */}
        <div className="bg-[#090C15] border border-zinc-800/80 rounded-xl p-5 flex items-start gap-3.5 text-xs text-zinc-400">
          <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-medium text-zinc-200">Restricted Git Shell Security</h4>
            <p>
              Klyro SSH connections are strictly restricted to Git transport operations (<code className="text-zinc-300">git-upload-pack</code> and <code className="text-zinc-300">git-receive-pack</code>). Interactive terminal shell access is disabled for platform security.
            </p>
          </div>
        </div>

        {/* Add SSH Key Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0C0F19] border border-zinc-800 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-emerald-400" />
                  Add New SSH Key
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Paste the contents of your public key file (typically <code className="text-zinc-300">~/.ssh/id_ed25519.pub</code> or <code className="text-zinc-300">~/.ssh/id_rsa.pub</code>).
                </p>
              </div>

              {addError && (
                <div className="p-3 bg-red-950/50 border border-red-900/60 rounded-lg text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <form onSubmit={handleAddKey} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Title (optional)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. MacBook Pro, Work Desktop"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Key <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={6}
                    value={publicKey}
                    onChange={(e) => setPublicKey(e.target.value)}
                    placeholder="Begins with 'ssh-ed25519', 'ssh-rsa', 'ecdsa-sha2-nistp256'..."
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 resize-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    disabled={adding}
                    className="px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adding || !publicKey.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    {adding ? "Adding Key..." : "Add SSH Key"}
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
