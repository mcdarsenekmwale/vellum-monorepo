import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/articles")({
  head: () => ({ meta: [{ title: "Articles · Vellbase Admin" }] }),
  component: () => <Outlet />,
});
