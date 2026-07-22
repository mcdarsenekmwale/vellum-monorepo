import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/articles")({
  head: () => ({ meta: [{ title: "Articles · Vellum Admin" }] }),
  component: () => <Outlet />,
});
