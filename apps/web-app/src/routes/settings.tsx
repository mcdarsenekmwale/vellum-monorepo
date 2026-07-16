import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Vellum" },
      { name: "description", content: "Customize your Vellum experience." },
    ],
  }),
  beforeLoad: async ({ location }) => {
    await requireAuth(location.pathname);
  },
  component: SettingsLayout,
});

function SettingsLayout() {
  return <Outlet />;
}
