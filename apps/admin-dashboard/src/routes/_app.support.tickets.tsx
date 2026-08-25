import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/support/tickets")({
  head: () => ({ meta: [{ title: "Support Tickets · Vellbase Admin" }] }),
  component: () => <Outlet />,
});

