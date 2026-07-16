import { createFileRoute } from "@tanstack/react-router";
import { Check, Minus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { ROLES, can, type Resource } from "@/lib/auth/rbac";

const RESOURCES: Resource[] = [
  "users","roles","articles","posts","highlights","videos","media","music",
  "comments","reports","moderation","webhooks","api.keys","ai.agents",
  "storage","audit","flags","settings","billing",
];

export const Route = createFileRoute("/_app/permissions")({
  head: () => ({ meta: [{ title: "Permissions · Vellum Admin" }] }),
  component: () => (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Permission matrix"
        description="What each role can read across the platform. Write/delete/admin gates are enforced in the RBAC layer."
      />
      <SectionCard padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left">Resource</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-4 py-3 text-center">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map((res) => (
                <tr key={res} className="border-t">
                  <td className="px-5 py-3 font-mono text-xs">{res}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-4 py-3 text-center">
                      {can(r, res, "read") ? (
                        <span className="inline-grid size-6 place-items-center rounded-full bg-success/15 text-success">
                          <Check className="size-3.5" />
                        </span>
                      ) : (
                        <span className="inline-grid size-6 place-items-center rounded-full bg-muted text-muted-foreground">
                          <Minus className="size-3.5" />
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  ),
});
