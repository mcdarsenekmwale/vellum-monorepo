import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/audit")({
  head: () => ({ meta: [{ title: "Audit Logs · Vellum Admin" }] }),
  component: () => <Outlet />,
});
