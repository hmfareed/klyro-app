"use client";

import { useState } from "react";
import { ProfileBanner } from "./ProfileBanner";
import { ProfileHeader, type ProfileUser } from "./ProfileHeader";
import { ProfileTabs, type ProfileTab } from "./ProfileTabs";
import { OverviewTab } from "./OverviewTab";
import { RepositoriesTab } from "./RepositoriesTab";
import { ProjectsTab } from "./ProjectsTab";
import { TeamsTab } from "./TeamsTab";
import { ActivityTab } from "./ActivityTab";
import { EditProfileModal } from "./EditProfileModal";

type UserProfileViewProps = {
  initialUser: ProfileUser;
  isOwner: boolean;
};

export function UserProfileView({ initialUser, isOwner }: UserProfileViewProps) {
  const [user, setUser] = useState<ProfileUser>(initialUser);
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [isFollowing, setIsFollowing] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Handle follow / unfollow toggle
  const handleFollowToggle = async () => {
    const nextState = !isFollowing;
    setIsFollowing(nextState);

    // Optimistically update followers count
    setUser((prev) => ({
      ...prev,
      stats: {
        ...(prev.stats || {
          repositoriesCount: 0,
          followersCount: 0,
          followingCount: 0,
          contributionsCount: 0,
        }),
        followersCount: Math.max(
          0,
          (prev.stats?.followersCount || 0) + (nextState ? 1 : -1)
        ),
      },
    }));

    try {
      await fetch(`/api/v1/users/${user.username}/follow`, {
        method: nextState ? "POST" : "DELETE",
      });
    } catch {}
  };

  // Handle saving profile changes
  const handleSaveProfile = (updatedFields: Partial<ProfileUser>) => {
    setUser((prev) => ({
      ...prev,
      ...updatedFields,
    }));
  };

  const reposCount = (user.projectsOwned?.length || 0) + (user.memberships?.length || 0);
  const projectsCount = (user.projectsOwned?.length || 0) + (user.memberships?.length || 0);
  const teamsCount = (user.memberships?.length || 0) + (user.projectsOwned?.length || 0);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-indigo-500/30">
      {/* Top Banner & Header Wrapper */}
      <div className="mx-auto max-w-7xl pt-4 px-3 sm:px-6">
        <ProfileBanner />
        <ProfileHeader
          user={user}
          isOwner={isOwner}
          onEditProfile={() => setEditModalOpen(true)}
          onFollowToggle={handleFollowToggle}
          isFollowing={isFollowing}
        />
        <ProfileTabs
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          reposCount={reposCount}
          projectsCount={projectsCount}
          teamsCount={teamsCount}
        />
      </div>

      {/* Main Tab Content */}
      <main className="mx-auto max-w-7xl">
        {activeTab === "overview" && (
          <OverviewTab
            user={user}
            isOwner={isOwner}
            onNavigateTab={setActiveTab}
            onEditProfile={() => setEditModalOpen(true)}
          />
        )}

        {activeTab === "repositories" && (
          <RepositoriesTab user={user} isOwner={isOwner} />
        )}

        {activeTab === "projects" && (
          <ProjectsTab user={user} isOwner={isOwner} />
        )}

        {activeTab === "teams" && (
          <TeamsTab user={user} isOwner={isOwner} />
        )}

        {activeTab === "activity" && (
          <ActivityTab user={user} />
        )}
      </main>

      {/* Edit Profile Modal (Owner Only) */}
      {isOwner && (
        <EditProfileModal
          user={user}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
}
