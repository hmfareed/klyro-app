"use client";

import { useState } from "react";
import { X, Send, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";

interface RoleOption {
  id: string;
  title: string;
}

interface OpportunityApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectSlug: string;
  projectTitle: string;
  roles: RoleOption[];
  initialRoleId?: string;
  onSuccess?: () => void;
}

export function OpportunityApplyModal({
  isOpen,
  onClose,
  projectSlug,
  projectTitle,
  roles,
  initialRoleId,
  onSuccess,
}: OpportunityApplyModalProps) {
  const [selectedRole, setSelectedRole] = useState(
    initialRoleId || (roles[0]?.id ?? "")
  );
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRole) {
      setError("Please select a role to apply for.");
      return;
    }
    if (message.trim().length < 10) {
      setError("Please include a brief message (at least 10 characters).");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/projects/${projectSlug}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: selectedRole,
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.error?.message || "Failed to submit application.");
      }

      setSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-white shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-400" />
            <h2 className="text-base font-bold text-white">Join Build: {projectTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Application Submitted!</h3>
            <p className="text-xs text-zinc-400">
              The project owner will review your pitch and get back to you.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Role you want to take on
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
              >
                {roles.length === 0 ? (
                  <option value="">No specific role (Contributor)</option>
                ) : (
                  roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Why do you want to contribute?
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Mention relevant experience, what you'd like to build, and your weekly availability..."
                rows={4}
                className="w-full rounded-xl border border-zinc-800 bg-black p-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                <Send size={13} />
                <span>{isSubmitting ? "Submitting..." : "Send Application"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
