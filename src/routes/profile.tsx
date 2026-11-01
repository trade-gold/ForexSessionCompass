import { createFileRoute } from "@tanstack/react-router";
import { UserProfileDashboard } from "@/components/UserProfileDashboard";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile & Settings | Forex Time Tools" },
      { property: "og:title", content: "My Profile & Settings | Forex Time Tools" },
      { property: "og:description", content: "Manage your Forex Time Tools account profile and preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
