import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  BookOpen, 
  Search, 
  Plus, 
  Eye, 
  Clock, 
  TrendingUp, 
  FileText, 
  Tag,
  LayoutGrid,
  List,
  ArrowUpRight,
  Filter,
  X,
  BookMarked,
  Sparkles,
  Library,
  ChevronRight,
  Users,
  Star,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { useHelpArticles } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/support/kb")({
  head: () => ({ meta: [{ title: "Knowledge Base · Vellum Admin" }] }),
  component: KnowledgeBasePage,
});

/* ─── Constants ─── */

const PREDEFINED_CATEGORIES = [
  "Getting Started",
  "Account",
  "Billing",
  "API",
  "Troubleshooting",
  "Best Practices",
];

/* ─── Quick Action Card ─── */

function QuickActionCard({
  icon: Icon,
  label,
  description,
  onClick,
  variant = "default",
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  onClick?: () => void;
  variant?: "default" | "primary" | "success" | "warning";
}) {
  const variants = {
    default: "border-muted/50 hover:border-foreground/30 hover:bg-muted/30",
    primary: "border-primary/30 hover:border-primary/60 hover:bg-primary/5",
    success: "border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5",
    warning: "border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5",
  };

  const iconVariants = {
    default: "text-muted-foreground bg-muted/50",
    primary: "text-primary bg-primary/10",
    success: "text-emerald-500 bg-emerald-500/10",
    warning: "text-amber-500 bg-amber-500/10",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 rounded-xl border-2 p-4 transition-all text-left w-full",
        variants[variant]
      )}
    >
      <div className={cn(
        "grid size-10 place-items-center rounded-lg shrink-0",
        iconVariants[variant]
      )}>
        <Icon className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
    </button>
  );
}

/* ─── Empty State ─── */

function EmptyState({
  hasFilters,
  onClearFilters,
  onAddArticle,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
  onAddArticle: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/10 p-8 text-center">
      {/* Centered Icon */}
      <div className="relative mb-6">
        <div className="size-24 rounded-full bg-primary/5 flex items-center justify-center">
          <BookOpen className="size-12 text-primary/40" />
        </div>
        {!hasFilters && (
          <div className="absolute -bottom-2 -right-2 rounded-full bg-primary p-1.5 shadow-lg">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
        )}
      </div>

      <h3 className="text-xl font-semibold">
        {hasFilters ? "No articles found" : "No articles yet"}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasFilters
          ? "Try adjusting your search or category filters to find what you're looking for."
          : "Get started by creating your first help article for your users."}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {hasFilters ? (
          <Button variant="outline" onClick={onClearFilters} className="gap-2">
            <X className="size-4" />
            Clear filters
          </Button>
        ) : (
          <PermissionGuard resource="support" action="write">
            <Button onClick={onAddArticle} className="gap-2">
              <Plus className="size-4" />
              Create first article
            </Button>
          </PermissionGuard>
        )}
      </div>

      {!hasFilters && (
        <div className="mt-8 grid gap-3 sm:grid-cols-3 w-full max-w-lg">
          <div className="rounded-lg border bg-background p-3 text-center">
            <FileText className="size-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs font-medium">Write content</p>
            <p className="text-[10px] text-muted-foreground">Create helpful guides</p>
          </div>
          <div className="rounded-lg border bg-background p-3 text-center">
            <Tag className="size-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs font-medium">Organize</p>
            <p className="text-[10px] text-muted-foreground">Categorize articles</p>
          </div>
          <div className="rounded-lg border bg-background p-3 text-center">
            <Users className="size-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs font-medium">Help users</p>
            <p className="text-[10px] text-muted-foreground">Reduce support tickets</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */

function KnowledgeBasePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "name">("recent");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: articles, isLoading } = useHelpArticles({ search, category });

  /* Derive categories from actual data, fallback to predefined */
  const categories = useMemo(() => {
    const fromData = [...new Set((articles ?? []).map((a) => a.category))];
    return fromData.length > 0 ? fromData : PREDEFINED_CATEGORIES;
  }, [articles]);

  /* Sort articles */
  const sortedArticles = useMemo(() => {
    if (!articles) return [];
    const sorted = [...articles];
    switch (sortBy) {
      case "popular":
        return sorted.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
      case "name":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case "recent":
      default:
        return sorted.sort((a, b) => 
          new Date(b.updatedAt ?? b.createdAt).getTime() - 
          new Date(a.updatedAt ?? a.createdAt).getTime()
        );
    }
  }, [articles, sortBy]);

  /* Stats */
  const totalArticles = articles?.length ?? 0;
  const publishedCount = articles?.filter((a) => a.isPublished).length ?? 0;
  const draftCount = totalArticles - publishedCount;
  const totalViews = articles?.reduce((sum, a) => sum + (a.views ?? 0), 0) ?? 0;

  const clearFilters = () => {
    setSearch("");
    setCategory(undefined);
  };

  const hasFilters = search || category;

  return (
    <PermissionGuard resource="support" action="read">
      <div className="space-y-6">
        <PageHeader
          title="Knowledge Base"
          description="Manage help articles, FAQs, and support documentation"
          actions={
            <PermissionGuard resource="support" action="write">
              <Button className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New Article
              </Button>
            </PermissionGuard>
          }
        />

        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard 
            label="Total Articles"
            value={totalArticles}
            icon={FileText}
            tone="primary"
          />
          <StatCard 
            label="Published"
            value={publishedCount}
            icon={BookOpen}
            tone="success"
          />
          <StatCard 
            label="Drafts"
            value={draftCount}
            icon={Clock}
            tone="warning"
          />
          <StatCard 
            label="Total Views"
            value={totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}k` : totalViews}
            icon={TrendingUp}
            tone="info"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickActionCard
            icon={BookMarked}
            label="View All Articles"
            description="Browse all knowledge base content"
            variant="primary"
          />
          <QuickActionCard
            icon={FileText}
            label="Draft Articles"
            description={`${draftCount} articles in draft`}
            variant="warning"
          />
          <QuickActionCard
            icon={Users}
            label="Popular Articles"
            description="Most viewed by users"
            variant="success"
          />
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

            {/* Sort */}
            <div className="flex items-center gap-1 rounded-lg border bg-background p-1 shrink-0">
              {[
                { value: "recent", label: "Recent" },
                { value: "popular", label: "Popular" },
                { value: "name", label: "Name" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSortBy(value as typeof sortBy)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                    sortBy === value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 rounded-lg border bg-background p-1 shrink-0">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  viewMode === "grid"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  viewMode === "list"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* Clear Filters */}
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </Button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Tag className="size-3" />
              Categories
            </span>
            <button
              onClick={() => setCategory(undefined)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all border",
                !category
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
              )}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(category === cat ? undefined : cat)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all border cursor-pointer",
                  category === cat
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className={cn(
            "grid gap-4",
            viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
          )}>
            {Array.from({ length: 6 }).map((_, i) => (
              <ChartSkeleton key={i} height={180} />
            ))}
          </div>
        ) : sortedArticles.length === 0 ? (
          <EmptyState
            hasFilters={hasFilters === ""}
            onClearFilters={clearFilters}
            onAddArticle={() => setIsCreateOpen(true)}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{sortedArticles.length}</span> article
                {sortedArticles.length !== 1 ? "s" : ""}
                {category && (
                  <>
                    {" "}in <span className="font-medium text-foreground">{category}</span>
                  </>
                )}
              </p>
              <Badge variant="secondary" className="gap-1">
                <BookOpen className="size-3" />
                {totalArticles} total
              </Badge>
            </div>

            {viewMode === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sortedArticles.map((article) => (
                  <SectionCard
                    key={article.id}
                    className="group flex flex-col overflow-hidden transition-all hover:shadow-md hover:border-foreground/20"
                  >
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                          <BookOpen className="size-5" />
                        </div>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          {article.popular && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="gap-1 text-[10px]">
                                  <TrendingUp className="size-3" />
                                  Popular
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>Highly viewed article</TooltipContent>
                            </Tooltip>
                          )}
                          <Badge
                            variant={article.isPublished ? "default" : "outline"}
                            className={cn(
                              "text-[10px]",
                              article.isPublished && "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                            )}
                          >
                            {article.isPublished ? "Published" : "Draft"}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex-1">
                        <h3 className="font-semibold leading-tight group-hover:text-primary transition-colors line-clamp-1">
                          {article.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                          {article.description}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Tag className="size-3" />
                          <span>{article.category}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {article.readMinutes} min
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 cursor-help">
                                <Eye className="size-3" />
                                {article.views?.toLocaleString() ?? 0}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Total views</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>

                    <div className="border-t bg-muted/30 px-5 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full gap-1.5 text-xs font-medium hover:bg-background"
                        asChild
                      >
                        <Link
                          to="/help/$articleId"
                          params={{ articleId: article.id }}
                        >
                          Read Article
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </SectionCard>
                ))}
              </div>
            ) : (
              /* List View */
              <SectionCard padded={false} className="overflow-hidden">
                <div className="divide-y">
                  {sortedArticles.map((article) => (
                    <Link
                      key={article.id}
                      to="/help/$articleId"
                      params={{ articleId: article.id }}
                      className="group flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <BookOpen className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                            {article.title}
                          </h3>
                          {article.popular && (
                            <Badge variant="secondary" className="text-[10px] shrink-0 gap-1">
                              <Star className="size-2.5" />
                              Popular
                            </Badge>
                          )}
                          <Badge
                            variant={article.isPublished ? "default" : "outline"}
                            className={cn(
                              "text-[10px] shrink-0",
                              article.isPublished && "bg-emerald-500/10 text-emerald-600"
                            )}
                          >
                            {article.isPublished ? "Published" : "Draft"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {article.description}
                        </p>
                      </div>
                      <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                        <span className="flex items-center gap-1.5">
                          <Tag className="size-3" />
                          {article.category}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-3" />
                          {article.readMinutes} min
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Eye className="size-3" />
                          {article.views?.toLocaleString() ?? 0}
                        </span>
                      </div>
                      <ArrowUpRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                  ))}
                </div>
              </SectionCard>
            )}
          </>
        )}
      </div>
    </PermissionGuard>
  );
}