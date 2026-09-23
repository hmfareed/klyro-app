"use client";

import { useState } from "react";
import { X, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import type { ProfileUser } from "./ProfileHeader";

type EditProfileModalProps = {
  user: ProfileUser;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedUser: Partial<ProfileUser>) => void;
};

export function EditProfileModal({
  user,
  isOpen,
  onClose,
  onSave,
}: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [bio, setBio] = useState(user.bio || "");
  const [about, setAbout] = useState(user.about || "");
  const [location, setLocation] = useState(user.location || "");
  const [websiteUrl, setWebsiteUrl] = useState(user.websiteUrl || "");
  const [githubUsername, setGithubUsername] = useState(user.githubUsername || "");
  const [skills, setSkills] = useState<Array<{ name: string; level: string }>>(
    (user.skills || []).map((s) => ({
      name: s.skill.name,
      level: s.level || "INTERMEDIATE",
    }))
  );
  const [newSkillName, setNewSkillName] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleAddSkill = () => {
    const trimmed = newSkillName.trim();
    if (!trimmed) return;
    if (skills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setNewSkillName("");
      return;
    }
    setSkills([...skills, { name: trimmed, level: "INTERMEDIATE" }]);
    setNewSkillName("");
  };

  const handleRemoveSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/v1/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          bio: bio.trim() || undefined,
          about: about.trim() || undefined,
          location: location.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          githubUsername: githubUsername.trim() || undefined,
          skills: skills.map((s) => ({
            name: s.name,
            level: s.level as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT",
          })),
        }),
      });

      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.success) {
        setErrorMsg(d?.error?.message || "Failed to update profile.");
        setSaving(false);
        return;
      }

      onSave({
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        about: about.trim() || null,
        location: location.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        githubUsername: githubUsername.trim() || null,
        skills: skills.map((s, idx) => ({
          skillId: `s-${idx}`,
          level: s.level,
          skill: { id: `s-${idx}`, name: s.name },
        })),
      });

      onClose();
    } catch {
      setErrorMsg("An unexpected network error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-400" />
              <span>Edit Profile</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Update your public persona, headline, bio, and tech skills.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl bg-red-950/40 border border-red-800/60 p-3 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Mohammed Fareed"
              maxLength={80}
              className="w-full rounded-xl border border-zinc-800 bg-black px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Bio / Tagline */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Tagline / Roles <span className="text-zinc-500 font-normal">(short summary)</span>
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Full Stack Developer • Student • Tech Enthusiast"
              maxLength={160}
              className="w-full rounded-xl border border-zinc-800 bg-black px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-zinc-500 text-right">{bio.length}/160</p>
          </div>

          {/* About */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              About me <span className="text-zinc-500 font-normal">(detailed story)</span>
            </label>
            <textarea
              rows={4}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Tell others what you build, what you enjoy learning, and what roles you're open to..."
              maxLength={5000}
              className="w-full rounded-xl border border-zinc-800 bg-black px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Location & Website Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Tamale, Ghana"
                maxLength={120}
                className="w-full rounded-xl border border-zinc-800 bg-black px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Website or Link
              </label>
              <input
                type="text"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="e.g. https://fareed.dev"
                maxLength={2048}
                className="w-full rounded-xl border border-zinc-800 bg-black px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* GitHub Username */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              GitHub Username
            </label>
            <div className="flex items-center rounded-xl border border-zinc-800 bg-black px-3.5 py-2.5 text-xs text-zinc-400 focus-within:border-indigo-500">
              <span className="text-zinc-600 mr-1">github.com/</span>
              <input
                type="text"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value.replace(/^@/, ""))}
                placeholder="username"
                maxLength={80}
                className="w-full bg-transparent text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Skills Tag Management */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Skills & Tech Stack
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                placeholder="Add a skill (e.g. React, TypeScript, Docker)"
                className="flex-1 rounded-xl border border-zinc-800 bg-black px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="inline-flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                <Plus size={14} /> Add
              </button>
            </div>

            {skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 rounded-xl bg-black/60 border border-zinc-800/80">
                {skills.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300"
                  >
                    <span>{s.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(idx)}
                      className="text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-800 bg-black px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              <span>{saving ? "Saving…" : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
