import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { apiClient } from "@/lib/api";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Vellum" },
      { name: "description", content: "Customize your Vellum experience." },
    ],
  }),
  beforeLoad: async () => {
    const user = await apiClient.getCurrentUser();
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: "/settings" } });
    }
  },
  component: SettingsLayout,
});

function SettingsLayout() {
  return <Outlet />;
}
