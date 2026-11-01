import { createFileRoute } from "@tanstack/react-router";
import { UserProfileDashboard } from "@/components/UserProfileDashboard";

export const Route = createFileRoute("/academy")({
  head: () => ({
    meta: [
      { title: "Account Dashboard | Forex Time Tools" },
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
