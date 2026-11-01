import { createFileRoute } from "@tanstack/react-router";
import { UserProfileDashboard } from "@/components/UserProfileDashboard";

export const Route = createFileRoute("/academy")({
  head: () => ({
    meta: [
      { title: "Account Dashboard | Forex Time Tools" },
      { property: "og:title", content: "Account Dashboard | Forex Time Tools" },
      { property: "og:description", content: "Manage your academy profile and membership status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        name: "description",
        content: "Manage your profile, membership status, subscription details, preferences, and security.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcademyDashboardPage,
});

function AcademyDashboardPage() {
  return <UserProfileDashboard initialSection="overview" />;
}
