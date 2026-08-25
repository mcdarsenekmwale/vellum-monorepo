import { createFileRoute } from "@tanstack/react-router";
import { Check, Minus, Search, ShieldCheck, ChevronDown, ChevronRight, Filter, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageState } from "@/components/dashboard/page-state";
import { SectionCard } from "@/components/dashboard/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePermissionGroups, useRbacRoles } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/permissions")({
  head: () => ({ meta: [{ title: "Permissions · Vellbase Admin" }] }),
  component: PermissionsPage,
});

const ALL_GROUPS = "__all__";

function PermissionsPage() {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState(ALL_GROUPS);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const groupQuery = usePermissionGroups();
  const roleQuery = useRbacRoles({ includeInactive: true });

  const groups = groupQuery.data ?? [];
  const roles = roleQuery.data ?? [];

  // Filter groups and permissions
  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();
    
    return groups
      .filter((group) => groupFilter === ALL_GROUPS || group.id === groupFilter)
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) => {
          if (!query) return true;
          return (
            permission.name.toLowerCase().includes(query) ||
            permission.key.toLowerCase().includes(query) ||
            group.name.toLowerCase().includes(query)
          );
        }),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [groupFilter, groups, search]);

  const roleGrantMap = useMemo(() => {
    return new Map(
      roles.map((role) => [
        role.id,
        new Set(role.permissions?.filter((grant) => grant.granted).map((grant) => grant.permissionId) ?? []),
      ]),
    );
  }, [roles]);

  const totalPermissions = groups.reduce((sum, group) => sum + group.permissions.length, 0);
  const selectedGroup = groupFilter === ALL_GROUPS ? undefined : groups.find((group) => group.id === groupFilter);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(filteredData.map((g) => g.id)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const clearFilters = () => {
    setSearch("");
    setGroupFilter(ALL_GROUPS);
  };

  const hasFilters = search || groupFilter !== ALL_GROUPS;

  // Check if a permission is granted to any role
  const isPermissionGranted = (permissionId: string) => {
    return roles.some((role) => roleGrantMap.get(role.id)?.has(permissionId));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Permission matrix"
        description="Live permission groups and role grants enforced by the backend RBAC service."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <SummaryCard label="Permission groups" value={groups.length} />
        <SummaryCard label="Permissions" value={totalPermissions} />
        <SummaryCard label="Roles" value={roles.length} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9 h-9"
            placeholder="Search permissions..."
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-full sm:w-48">
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_GROUPS}>All groups</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
            >
              <Filter className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Group Expand/Collapse Controls */}
      {filteredData.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll} className="gap-1.5">
            <ChevronRight className="size-3.5" />
            Expand all
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} className="gap-1.5">
            <ChevronDown className="size-3.5" />
            Collapse all
          </Button>
          <span className="text-xs text-muted-foreground ml-2">
            {filteredData.length} groups · {filteredData.reduce((sum, g) => sum + g.permissions.length, 0)} permissions
          </span>
        </div>
      )}

      <PageState
        data={filteredData}
        isLoading={groupQuery.isLoading || roleQuery.isLoading}
        isError={groupQuery.isError || roleQuery.isError}
        error={groupQuery.error ?? roleQuery.error}
        onRetry={() => {
          groupQuery.refetch();
          roleQuery.refetch();
        }}
        emptyTitle="No permissions found"
        emptyDescription={
          selectedGroup 
            ? `No permissions match the current search in "${selectedGroup.name}".` 
            : "No permissions match the current filters."
        }
      >
        <div className="space-y-4">
          {filteredData.map((group) => {
            const isExpanded = expandedGroups.has(group.id);
            const hasPermissions = group.permissions.length > 0;

            return (
              <SectionCard key={group.id} className="overflow-hidden p-0 rounded-md">
                {/* Group Header */}
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                    isExpanded ? "bg-muted/30" : "hover:bg-muted/20"
                  )}
                  onClick={() => toggleGroup(group.id)}
                >
                  <button className="shrink-0 text-muted-foreground hover:text-foreground">
                    {isExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{group.name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {group.permissions.length} permissions
                      </Badge>
                    </div>
                    {group.description && (
                      <p className="text-xs text-muted-foreground truncate">{group.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    <span>
                      {group.permissions.filter((p) => isPermissionGranted(p.id)).length} granted
                    </span>
                  </div>
                </div>

                {/* Permission Table */}
                {isExpanded && hasPermissions && (
                  <div className="border-t overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium min-w-[160px]">
                            Permission
                          </th>
                          <th className="px-4 py-2.5 text-left font-medium min-w-[120px]">
                            Key
                          </th>
                          {roles.map((role) => (
                            <th key={role.id} className="px-2 py-2.5 text-center font-medium min-w-[40px]">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help text-[10px]">{role.name}</span>
                                </TooltipTrigger>
                                <TooltipContent>{role.name}</TooltipContent>
                              </Tooltip>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.permissions.map((permission, index) => (
                          <tr 
                            key={permission.id} 
                            className={cn(
                              "border-t transition-colors",
                              index % 2 === 0 ? "bg-background" : "bg-muted/5"
                            )}
                          >
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-sm">{permission.name}</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                                {permission.key}
                              </code>
                            </td>
                            {roles.map((role) => {
                              const granted = roleGrantMap.get(role.id)?.has(permission.id) ?? false;
                              return (
                                <td key={role.id} className="px-2 py-2.5 text-center">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        className={cn(
                                          "inline-flex size-6 items-center justify-center rounded-md transition-colors",
                                          granted
                                            ? "bg-emerald-500/10 text-emerald-500"
                                            : "bg-muted/30 text-muted-foreground/30"
                                        )}
                                      >
                                        {granted ? (
                                          <Check className="size-3.5" />
                                        ) : (
                                          <Minus className="size-3.5" />
                                        )}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {granted ? "Granted" : "Not granted"}
                                    </TooltipContent>
                                  </Tooltip>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {isExpanded && !hasPermissions && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No permissions in this group match the current filters.
                  </div>
                )}
              </SectionCard>
            );
          })}
        </div>
      </PageState>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}