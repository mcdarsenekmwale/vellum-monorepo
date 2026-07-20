import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/moderation")({
  head: () => ({ meta: [{ title: "Moderation · Vellum Admin" }] }),
  component: () => <Outlet />,
});
