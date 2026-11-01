import { createFileRoute } from "@tanstack/react-router";
import { UserProfileDashboard } from "@/components/UserProfileDashboard";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile & Settings | Forex Time Tools" },
      {
        name: "description",
        content: "View and manage your user profile, preferences, membership, and security settings.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UserProfilePage,
});

function UserProfilePage() {
  return <UserProfileDashboard initialSection="profile" />;
}
