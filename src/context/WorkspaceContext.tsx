"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type WorkspaceUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
  email?: string;
};

interface WorkspaceContextType {
  user: WorkspaceUser | null;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  workspaceName: string;
  initials: string;
  sidebarInitial: string;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

const STORAGE_KEY = "klyro_user_profile";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<WorkspaceUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Restore cached user immediately to prevent any flash of placeholder name
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          setUser(parsed);
        }
      }
    } catch {
      // Ignore local storage errors
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/users/me");
      if (!res.ok) return;
      const data = await res.json();
      const u = data?.user ?? data?.data?.user;
      if (u) {
        const userData: WorkspaceUser = {
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          email: u.email,
        };
        setUser(userData);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        } catch {
          // Ignore
        }
      }
    } catch {
      // Ignore offline or fetch errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();

    // Listen for custom profile update events
    const handleProfileUpdate = () => {
      fetchUser();
    };
    window.addEventListener("klyro-profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("klyro-profile-updated", handleProfileUpdate);
    };
  }, [fetchUser]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Compute dynamic names and initials
  const effectiveName = user?.displayName || user?.username || "";
  const workspaceName = effectiveName ? `${effectiveName}'s Workspace` : "Workspace";
  const initials = effectiveName ? effectiveName.trim().slice(0, 2).toUpperCase() : "…";
  const sidebarInitial = effectiveName ? effectiveName.trim().slice(0, 1).toUpperCase() : "W";

  return (
    <WorkspaceContext.Provider
      value={{
        user,
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        workspaceName,
        initials,
        sidebarInitial,
        refreshUser: fetchUser,
        isLoading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
