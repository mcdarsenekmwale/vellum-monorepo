import { createFileRoute, Link } from "@tanstack/react-router";
import {
  UserPlus,
  UserMinus,
  ArrowRight,
  GitBranch,
  Users,
  TrendingUp,
  Clock,
  MoreHorizontal,
  Mail,
  Ban,
  Check,
  X,
  ChevronDown,
} from "lucide-react";
import { ListPage } from "@/components/dashboard/list-page";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFollows, type FollowRecord } from "@/lib/api/hooks";
import { useUsers } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { avatarUrl } from "@/lib/avatar";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/followers")({
  head: () => ({ meta: [{ title: "Followers · Vellum Admin" }] }),
  component: FollowersPage,
});

type DirectionFilter = "all" | "followers" | "following";
type MutualFilter = "all" | "mutual" | "not-mutual";
type SortOption = "newest" | "oldest";

function FollowersPage() {
  const { data, isLoading, error } = useFollows({ pageSize: 50 });
  const { data: usersData } = useUsers();
  const { can, user: currentUser } = useAuth();
  const rows = data?.data ?? [];

  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [mutualFilter, setMutualFilter] = useState<MutualFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // Check if follow is mutual
  const isMutual = useCallback((record: FollowRecord) => {
    return rows.some(
      (r) => r.followerId === record.followingId && r.followingId === record.followerId
    );
  }, [rows]);

  // Filtering and sorting
  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (directionFilter !== "all" && currentUser) {
      if (directionFilter === "followers") {
        result = result.filter((r) => r.followingId === currentUser.id);
      } else if (directionFilter === "following") {
        result = result.filter((r) => r.followerId === currentUser.id);
      }
    }

    if (mutualFilter !== "all") {
      result = result.filter((r) =>
        mutualFilter === "mutual" ? isMutual(r) : !isMutual(r)
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [rows, directionFilter, mutualFilter, sortBy, currentUser, isMutual]);

  const hasActiveFilters = directionFilter !== "all" || mutualFilter !== "all";

  const clearFilters = useCallback(() => {
    setDirectionFilter("all");
    setMutualFilter("all");
    setSortBy("newest");
  }, []);

  // Calculate follow stats
  const totalFollows = rows.length;
  const uniqueFollowers = new Set(rows.map((r) => r.followerId)).size;
  const uniqueFollowing = new Set(rows.map((r) => r.followingId)).size;
  const mutualFollows = rows.filter((r) =>
    rows.some(
      (r2) => r2.followerId === r.followingId && r2.followingId === r.followerId
    )
  ).length;

  // Get user details
  const getUser = (userId: string) => {
    return usersData?.data?.find((u) => u.id === userId);
  };

  return (
    <ListPage<FollowRecord>
      title="Follow graph"
      description="Who follows whom across the platform."
      eyebrow="Community"
      rows={filteredRows}
      isLoading={isLoading}
      error={error}
      searchKeys={["followerId", "followingId"]}
      pageSize={15}
      enableSelection={true}
      enableExport={true}
      enablePagination={true}
      filters={
        <div className="flex items-center gap-2 flex-wrap">
          {/* Direction Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={directionFilter !== "all" ? "default" : "outline"} size="sm" className="gap-1.5 h-8">
                <Users className="size-3.5" />
                Direction
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Filter by direction</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(["all", "followers", "following"] as const).map((dir) => (
                <DropdownMenuItem
                  key={dir}
                  onClick={() => setDirectionFilter(dir)}
                  className={cn(directionFilter === dir && "bg-accent")}
                >
                  {dir === "all" ? "All directions" : dir.charAt(0).toUpperCase() + dir.slice(1)}
                  {directionFilter === dir && <Check className="ml-2 size-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mutual Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={mutualFilter !== "all" ? "default" : "outline"} size="sm" className="gap-1.5 h-8">
                <GitBranch className="size-3.5" />
                Mutual
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Filter by mutual status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {([
                { value: "all", label: "All" },
                { value: "mutual", label: "Mutual" },
                { value: "not-mutual", label: "Not mutual" },
              ] as const).map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setMutualFilter(option.value)}
                  className={cn(mutualFilter === option.value && "bg-accent")}
                >
                  {option.label}
                  {mutualFilter === option.value && <Check className="ml-2 size-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8">
                <TrendingUp className="size-3.5" />
                Sort
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {([
                { value: "newest", label: "Newest first" },
                { value: "oldest", label: "Oldest first" },
              ] as const).map(({ value, label }) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => setSortBy(value)}
                  className={cn(sortBy === value && "bg-accent")}
                >
                  {label}
                  {sortBy === value && <Check className="ml-2 size-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Active filter badges */}
          {hasActiveFilters && (
            <>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Active filters:</span>
                {directionFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setDirectionFilter("all")}>
                    Direction: {directionFilter}
                    <X className="size-3" />
                  </Badge>
                )}
                {mutualFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setMutualFilter("all")}>
                    Mutual: {mutualFilter === "not-mutual" ? "Not mutual" : mutualFilter}
                    <X className="size-3" />
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearFilters}
                >
                  Clear all
                </Button>
              </div>
            </>
          )}
        </div>
      }
      columns={[
        {
          key: "follower",
          header: "Follower",
          cell: (r) => {
            const follower = getUser(r.followerId) ?? r.follower;
            return (
              <Link
                to="/users/$userId"
                params={{ userId: r.followerId }}
                className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarImage
                    src={avatarUrl(follower?.handle ?? r.followerId)}
                    alt={follower?.name}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {follower?.name?.[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {follower?.name ?? r.followerId.slice(0, 8)}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    @{follower?.handle ?? r.followerId.slice(0, 12)}
                  </div>
                </div>
              </Link>
            );
          },
        },
        {
          key: "connection",
          header: "",
          className: "w-16",
          cell: (r) => {
            const mutual = isMutual(r);
            return (
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full px-2 py-0.5",
                    mutual
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <ArrowRight className={cn("size-3", mutual && "text-emerald-500")} />
                </div>
                {mutual && (
                  <Badge
                    variant="outline"
                    className="text-[9px] h-4 px-1 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  >
                    Mutual
                  </Badge>
                )}
              </div>
            );
          },
        },
        {
          key: "followed",
          header: "Follows",
          cell: (r) => {
            const following = getUser(r.followingId) ?? r.following;
            return (
              <Link
                to="/users/$userId"
                params={{ userId: r.followingId }}
                className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarImage
                    src={avatarUrl(following?.handle ?? r.followingId)}
                    alt={following?.name}
                  />
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-medium">
                    {following?.name?.[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {following?.name ?? r.followingId.slice(0, 8)}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    @{following?.handle ?? r.followingId.slice(0, 12)}
                  </div>
                </div>
              </Link>
            );
          },
        },
        {
          key: "stats",
          header: "Stats",
          className: "hidden md:table-cell",
          cell: (r) => {
            const followerUser = getUser(r.followerId);
            const followingUser = getUser(r.followingId);
            return (
              <div className="flex items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-1 text-muted-foreground" title="Follower count">
                  <Users className="size-3.5" />
                  <span className="tabular-nums font-medium text-foreground">
                    {followerUser?.followersCount?.toLocaleString() ?? "0"}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground" title="Following count">
                  <GitBranch className="size-3.5" />
                  <span className="tabular-nums font-medium text-foreground">
                    {followingUser?.followingCount?.toLocaleString() ?? "0"}
                  </span>
                </span>
              </div>
            );
          },
        },
        {
          key: "since",
          header: "Since",
          cell: (r) => (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" />
              <span>{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
            </div>
          ),
        },
        {
          key: "type",
          header: "Type",
          className: "hidden lg:table-cell w-24",
          cell: (r) => {
            const mutual = isMutual(r);
            return (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] h-5",
                  mutual
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-muted bg-muted/50 text-muted-foreground"
                )}
              >
                {mutual ? "Mutual" : "One-way"}
              </Badge>
            );
          },
        },
      ]}
      renderRowActions={(r) => (
        <div className="flex items-center justify-end gap-0.5 opacity-100 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 hover:text-primary"
            asChild
          >
            <Link to="/users/$userId" params={{ userId: r.followerId }}>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link to="/users/$userId" params={{ userId: r.followerId }}>
                  <Users className="size-3.5 mr-2" />
                  View follower
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/users/$userId" params={{ userId: r.followingId }}>
                  <Users className="size-3.5 mr-2" />
                  View following
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Mail className="size-3.5 mr-2" />
                Message
              </DropdownMenuItem>
              {can("follows", "delete") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive">
                    <UserMinus className="size-3.5 mr-2" />
                    Remove follow
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      onRowClick={(r) => {
        // Optional: Navigate to follower profile
      }}
    />
  );
}