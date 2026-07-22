import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Ban, Mail, Shield, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { AreaSpark } from "@/components/dashboard/charts";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveAvatar } from "@/lib/avatar";
import { format } from "date-fns";
import {
  useUserById,
  useArticles,
  useAnalyticsTimeseries,
  useAuditLogs,
  useUpdateUserRole,
  useToggleUserStatus,
  type Article,
  type AuditLogEntry,
  type TimeseriesPoint,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/_app/users/$userId")({
  head: ({ params }) => ({ meta: [{ title: `User ${params.userId} · Vellum Admin` }] }),
  component: UserDetail,
  notFoundComponent: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">User not found.</div>
  ),
});

const ROLE_OPTIONS = ["ADMIN", "MODERATOR", "CREATOR", "USER", "GUEST"];

function UserDetail() {
  const { userId } = Route.useParams();
  const { data: user, isLoading, isError } = useUserById(userId);
  const { data: articlesData } = useArticles({ pageSize: 100 });
  const { data: tsData } = useAnalyticsTimeseries(30);
  const { data: auditData } = useAuditLogs({ pageSize: 50 });
  const updateUserRole = useUpdateUserRole();
  const toggleUserStatus = useToggleUserStatus();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
          <Link to="/users"><ArrowLeft className="size-4" /> All users</Link>
        </Button>
        <ChartSkeleton height={200} />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
          <Link to="/users"><ArrowLeft className="size-4" /> All users</Link>
        </Button>
        <SectionCard>
          <div className="p-10 text-center text-sm text-muted-foreground">
            Couldn't load this user. They may have been removed.
          </div>
        </SectionCard>
      </div>
    );
  }

  const userArticles: Article[] = (articlesData?.data ?? []).filter((a) => a.authorId === user.id);
  const userAudit: AuditLogEntry[] = (auditData?.data ?? []).filter((a) => a.userId === user.id);
  const spark = (tsData ?? []).map((p: TimeseriesPoint) => ({ date: p.date, value: p.users }));
  const handle = user.handle.startsWith("@") ? user.handle : `@${user.handle}`;
  const status = user.isActive ? "active" : "suspended";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
        <Link to="/users"><ArrowLeft className="size-4" /> All users</Link>
      </Button>

      <div className="surface-card overflow-hidden">
        <div className="relative h-28 gradient-primary" />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 px-6 pb-5 -mt-7">
          <div className="flex min-w-0 items-end gap-4">
            <Avatar className="size-20 shrink-0 ring-4 ring-card">
              <AvatarImage src={resolveAvatar(user.avatar, user.handle)} />
              <AvatarFallback>{user.name?.[0] ?? "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 pb-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-semibold">{user.name}</h2>
                <StatusBadge status={status} />
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-mono">{handle}</span> · {user.email}
              </div>
            </div>
          </div>
          <div className="hidden shrink-0 gap-2 sm:flex">
            <Button variant="outline" size="sm" className="gap-1.5"><Mail className="size-4" /> Message</Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const next = ROLE_OPTIONS[(ROLE_OPTIONS.indexOf(user.role) + 1) % ROLE_OPTIONS.length];
                updateUserRole.mutate({ id: user.id, role: next });
              }}
              disabled={updateUserRole.isPending}
            >
              <Shield className="size-4" /> Change role
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-warning"
              onClick={() => toggleUserStatus.mutate(user.id)}
              disabled={toggleUserStatus.isPending}
            >
              <Ban className="size-4" /> {user.isActive ? "Suspend" : "Reactivate"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive"><Trash2 className="size-4" /> Delete</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Articles" value={userArticles.length.toString()} tone="info" />
        <StatCard label="Published" value={userArticles.filter((a) => a.isPublished).length.toString()} tone="success" />
        <StatCard label="Total views" value={userArticles.reduce((s, a) => s + a.views, 0).toLocaleString()} tone="primary" />
        <StatCard label="Total likes" value={userArticles.reduce((s, a) => s + a.likesCount, 0).toLocaleString()} tone="warning" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          {["overview", "activity", "content"].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SectionCard title="Account" className="lg:col-span-1">
            <dl className="grid grid-cols-3 gap-y-3 text-sm">
              <Info k="Role" v={user.role} />
              <Info k="Status" v={<StatusBadge status={status} />} />
              <Info k="Joined" v={format(new Date(user.createdAt), "MMM d, yyyy")} />
              <Info k="ID" v={<span className="font-mono text-xs">{user.id}</span>} />
              <Info k="Updated" v={format(new Date(user.updatedAt), "MMM d, yyyy")} />
              <Info k="Publication" v={user.publication ?? "—"} />
              {user.bio && <Info k="Bio" v={<span className="text-xs">{user.bio}</span>} />}
            </dl>
          </SectionCard>

          <SectionCard title="30-day activity" className="lg:col-span-2">
            {spark.length > 0 ? <AreaSpark data={spark} /> : <ChartSkeleton height={120} />}
            <div className="mt-4 grid grid-cols-3 gap-4 text-center text-xs">
              <Kpi label="Audit events" v={userAudit.length.toString()} />
              <Kpi label="Articles" v={userArticles.length.toString()} />
              <Kpi label="Published" v={userArticles.filter((a) => a.isPublished).length.toString()} />
            </div>
          </SectionCard>

          {userAudit.length > 0 && (
            <SectionCard title="Recent activity" className="lg:col-span-3" padded={false}>
              <ol className="divide-y">
                {userAudit.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex gap-4 px-5 py-3">
                    <div className="w-32 shrink-0 text-xs text-muted-foreground">
                      {format(new Date(a.createdAt), "MMM d, HH:mm")}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">{a.action}</span> on {a.resource}
                    </div>
                  </li>
                ))}
              </ol>
            </SectionCard>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <SectionCard title="Activity log" padded={false}>
            {userAudit.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No activity recorded.</div>
            ) : (
              <ol className="divide-y">
                {userAudit.map((a) => (
                  <li key={a.id} className="grid grid-cols-[120px_1fr_100px] gap-4 px-5 py-3 text-sm">
                    <span className="text-xs text-muted-foreground">{format(new Date(a.createdAt), "MMM d, HH:mm")}</span>
                    <span><span className="font-medium">{a.action}</span> on {a.resource}</span>
                    <span className="text-right text-xs text-muted-foreground truncate">{a.ipAddress ?? "—"}</span>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          <SectionCard title="Uploaded content" padded={false}>
            {userArticles.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No content from this user yet.</div>
            ) : (
              <ul className="divide-y">
                {userArticles.map((c) => (
                  <li key={c.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="grid size-10 place-items-center rounded-md bg-muted text-xs font-medium">A</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.title}</div>
                      <div className="text-xs text-muted-foreground">article · {c.views.toLocaleString()} views</div>
                    </div>
                    <StatusBadge status={c.isPublished ? "active" : "draft"} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="col-span-1 text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="col-span-2 text-sm">{v}</dd>
    </>
  );
}

function Kpi({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-lg font-semibold tabular-nums">{v}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
