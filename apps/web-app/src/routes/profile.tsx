import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Vellum" },
      { name: "description", content: "Your reading activity, likes and drafts on Vellum." },
    ],
  }),
  beforeLoad: async ({ location }) => {
    await requireAuth(location.pathname);
  },
  component: ProfileLayout,
});

function ProfileLayout() {
  return <Outlet />;
}
