"use client";

import { useState } from "react";
import { CheckCircle2, AlertOctagon, MessageSquare, X } from "lucide-react";

interface RepoReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitReview: (state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED", body: string) => Promise<boolean>;
  isAuthor: boolean;
}

export function RepoReviewModal({
  isOpen,
  onClose,
  onSubmitReview,
  isAuthor,
}: RepoReviewModalProps) {
  const [reviewState, setReviewState] = useState<"COMMENTED" | "APPROVED" | "CHANGES_REQUESTED">("COMMENTED");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const ok = await onSubmitReview(reviewState, body.trim());
      if (ok) {
        setBody("");
        setReviewState("COMMENTED");
        onClose();
      } else {
        setError("Failed to submit review.");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#090d1f] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-white">Review changes</h3>
            <p className="text-xs text-slate-400 mt-0.5">Submit feedback or formal approval for this pull request.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Review summary (optional)
            </label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Leave a comment summarizing your review…"
              className="w-full rounded-xl border border-white/10 bg-zinc-950 p-3 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Review Decision Radios */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            {/* Comment */}
            <label
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                reviewState === "COMMENTED"
                  ? "border-indigo-500/80 bg-indigo-950/20"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <input
                type="radio"
                name="reviewState"
                value="COMMENTED"
                checked={reviewState === "COMMENTED"}
                onChange={() => setReviewState("COMMENTED")}
                className="mt-0.5 text-indigo-500 focus:ring-0"
              />
              <div className="space-y-0.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <MessageSquare size={13} className="text-slate-400" /> Comment
                </span>
                <p className="text-[11px] text-slate-400">
                  Submit general feedback without explicit approval or changes requested.
                </p>
              </div>
            </label>

            {/* Approve */}
            <label
              className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${
                isAuthor
                  ? "opacity-40 cursor-not-allowed border-white/5 bg-white/[0.01]"
                  : reviewState === "APPROVED"
                  ? "border-emerald-500/80 bg-emerald-950/20 cursor-pointer"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer"
              }`}
            >
              <input
                type="radio"
                name="reviewState"
                value="APPROVED"
                disabled={isAuthor}
                checked={reviewState === "APPROVED"}
                onChange={() => setReviewState("APPROVED")}
                className="mt-0.5 text-emerald-500 focus:ring-0"
              />
              <div className="space-y-0.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 size={13} /> Approve
                </span>
                <p className="text-[11px] text-slate-400">
                  {isAuthor
                    ? "You cannot approve your own pull request."
                    : "Submit feedback and approve merging these changes into the base branch."}
                </p>
              </div>
            </label>

            {/* Request changes */}
            <label
              className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${
                isAuthor
                  ? "opacity-40 cursor-not-allowed border-white/5 bg-white/[0.01]"
                  : reviewState === "CHANGES_REQUESTED"
                  ? "border-rose-500/80 bg-rose-950/20 cursor-pointer"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer"
              }`}
            >
              <input
                type="radio"
                name="reviewState"
                value="CHANGES_REQUESTED"
                disabled={isAuthor}
                checked={reviewState === "CHANGES_REQUESTED"}
                onChange={() => setReviewState("CHANGES_REQUESTED")}
                className="mt-0.5 text-rose-500 focus:ring-0"
              />
              <div className="space-y-0.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                  <AlertOctagon size={13} /> Request changes
                </span>
                <p className="text-[11px] text-slate-400">
                  {isAuthor
                    ? "You cannot request changes on your own pull request."
                    : "Submit feedback that must be addressed before the pull request can be merged."}
                </p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition-all disabled:opacity-40"
            >
              {submitting ? "Submitting review…" : "Submit review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
