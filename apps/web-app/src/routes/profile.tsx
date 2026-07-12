import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { apiClient } from "@/lib/api";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Vellum" },
      { name: "description", content: "Your reading activity, likes and drafts on Vellum." },
    ],
  }),
  beforeLoad: async () => {
    const user = await apiClient.getCurrentUser();
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: "/profile" } });
    }
  },
  component: ProfileLayout,
});

function ProfileLayout() {
  return <Outlet />;
}
