import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  Search,
  BookOpen,
  LifeBuoy,
  MessageCircle,
  Mail,
  ExternalLink,
  Clock,
  ChevronRight,
  FileText,
  Zap,
  Shield,
  BarChart3,
  Code,
  Users,
  Sparkles,
  ArrowRight,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useHelpArticles, useCreateSupportTicket, type HelpArticle } from "@/lib/api/hooks";

type HelpCategory = "All" | "Basics" | "Access" | "Trust & Safety" | "Developers" | "Analytics" | "AI";

const CATEGORIES: HelpCategory[] = ["All", "Basics", "Access", "Trust & Safety", "Developers", "Analytics", "AI"];

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Basics: BookOpen,
  Access: Users,
  "Trust & Safety": Shield,
  Developers: Code,
  Analytics: BarChart3,
  AI: Sparkles,
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  Users,
  Shield,
  Code,
  BarChart3,
  Sparkles,
  Zap,
  FileText,
  LifeBuoy,
};

function getIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] || FileText;
}

interface SupportOption {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: string;
  href?: string;
  responseTime: string;
  available: boolean;
}

const SUPPORT_OPTIONS: SupportOption[] = [
  {
    id: "chat",
    title: "Chat with support",
    description: "Talk to our team in real-time for urgent issues.",
    icon: MessageCircle,
    action: "Start chat",
    responseTime: "Avg. 4 min",
    available: true,
  },
  {
    id: "ticket",
    title: "Open a ticket",
    description: "Submit a detailed request for complex issues.",
    icon: LifeBuoy,
    action: "Create ticket",
    responseTime: "Within 24h",
    available: true,
  },
  {
    id: "email",
    title: "Email support",
    description: "Send us an email for non-urgent inquiries.",
    icon: Mail,
    action: "Send email",
    href: "mailto:support@vellum.app",
    responseTime: "Within 48h",
    available: true,
  },
  {
    id: "status",
    title: "System status",
    description: "Check current platform health and incident history.",
    icon: CheckCircle2,
    action: "View status",
    href: "https://status.vellum.app",
    responseTime: "Real-time",
    available: true,
  },
];

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

const searchSchema = z.object({ ticket: z.enum(["open"]).optional() });

export const Route = createFileRoute("/_app/help")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Help Center · Vellum Admin" }] }),
  component: HelpPage,
});

function HelpPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<HelpCategory>("All");
  const [ticketOpen, setTicketOpen] = useState(search.ticket === "open");
  const [ticketForm, setTicketForm] = useState({ subject: "", message: "", priority: "medium" });
  const [searchFocused, setSearchFocused] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data: articles, isLoading } = useHelpArticles({
    category: activeCategory !== "All" ? activeCategory : undefined,
    search: debouncedSearch || undefined,
  });

  const createTicket = useCreateSupportTicket();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const popularArticles = useMemo(() => articles?.filter((a) => a.popular) ?? [], [articles]);

  const categoryCounts = useMemo(() => {
    if (!articles) return {};
    const counts: Record<string, number> = {};
    for (const a of articles) {
      counts[a.category] = (counts[a.category] || 0) + 1;
    }
    return counts;
  }, [articles]);

  const openTicketDialog = () => {
    setTicketOpen(true);
    navigate({ search: { ticket: "open" } });
  };

  const closeTicketDialog = () => {
    setTicketOpen(false);
    navigate({ search: {} });
  };

  const handleTicketSubmit = async () => {
    if (!ticketForm.subject.trim() || !ticketForm.message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      await createTicket.mutateAsync({
        subject: ticketForm.subject,
        message: ticketForm.message,
        priority: ticketForm.priority,
      });
      closeTicketDialog();
      toast.success("Ticket submitted", {
        description: "We'll get back to you within 24 hours.",
      });
      setTicketForm({ subject: "", message: "", priority: "medium" });
    } catch (error) {
      toast.error("Failed to submit ticket", {
        description: error instanceof Error ? error.message : "Please try again later.",
      });
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setActiveCategory("All");
  };

  const isSubmitting = createTicket.isPending;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="System"
        title="Help Center"
        description="Documentation, guides, and direct support for your team."
      />

      <SectionCard className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="relative px-8 py-10 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary shadow-sm">
            <LifeBuoy className="size-7" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">How can we help you?</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Search documentation or browse by topic
          </p>

          <div className="mx-auto mt-6 flex max-w-xl items-center gap-2">
            <div
              className={cn(
                "relative flex-1 transition-all",
                searchFocused && "scale-[1.02]"
              )}
            >
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 pl-10 pr-10 text-sm shadow-sm"
                placeholder="Search docs, e.g. 'webhook signing'…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setDebouncedSearch(searchQuery);
                  }
                }}
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Button className="h-11 gap-2" onClick={() => setDebouncedSearch(searchQuery)}>Search</Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">Popular:</span>
            {popularArticles.slice(0, 3).map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory(a.category as HelpCategory);
                }}
                className="text-xs text-primary hover:underline underline-offset-2"
              >
                {a.title}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Tabs
            value={activeCategory}
            onValueChange={(v) => setActiveCategory(v as HelpCategory)}
          >
            <TabsList className="h-9 w-full justify-start overflow-x-auto">
              {CATEGORIES.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="text-xs gap-1.5">
                  {cat !== "All" && (
                    <span className="hidden sm:inline">
                      {(() => {
                        const Icon = CATEGORY_ICONS[cat] || FileText;
                        return <Icon className="size-3.5" />;
                      })()}
                    </span>
                  )}
                  {cat}
                  {cat !== "All" && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5">
                      {categoryCounts[cat] || 0}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeCategory} className="mt-4">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-start gap-4 rounded-lg border p-4"
                    >
                      <Skeleton className="size-10 rounded-lg shrink-0" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                        <div className="flex gap-3">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !articles || articles.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <Search className="mx-auto size-8 text-muted-foreground/40" />
                  <h3 className="mt-3 text-sm font-medium">No articles found</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try adjusting your search or category filter
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={clearSearch}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {articles.map((article) => {
                    const Icon = getIcon(article.icon);
                    return (
                      <Link
                        key={article.id}
                        to="/help/$articleId"
                        params={{ articleId: article.slug }}
                        className="group flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50 hover:border-accent"
                      >
                        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">
                              {article.title}
                            </h3>
                            {article.popular && (
                              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] gap-0.5">
                                <Zap className="size-2.5" /> Popular
                              </Badge>
                            )}
                            {article.updatedAt && (
                              <Badge variant="outline" className="h-4 px-1.5 text-[10px] gap-0.5">
                                <Clock className="size-2.5" /> {formatRelativeDate(article.updatedAt)}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {article.description}
                          </p>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <BookOpen className="size-3" />
                              {article.readMinutes} min read
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <FileText className="size-3" />
                              {article.category}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all shrink-0 mt-1" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {activeCategory === "All" && !searchQuery && (
            <SectionCard title="Most read this week" className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {isLoading
                  ? [1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-3 rounded-md border p-3">
                        <Skeleton className="size-8 rounded-md shrink-0" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/3" />
                        </div>
                      </div>
                    ))
                  : popularArticles.map((article) => {
                      const Icon = getIcon(article.icon);
                      return (
                        <Link
                          key={article.id}
                          to="/help/$articleId"
                          params={{ articleId: article.slug }}
                          className="group flex items-center gap-3 rounded-md border p-3 hover:bg-accent/50 transition-colors"
                        >
                          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {article.title}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{article.readMinutes} min read</div>
                          </div>
                        </Link>
                      );
                    })}
              </div>
            </SectionCard>
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <SectionCard title="Contact support" className="p-5">
            <div className="space-y-3">
              {SUPPORT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const Wrapper = option.href ? "a" : "button";
                const wrapperProps = option.href
                  ? { href: option.href, target: "_blank", rel: "noopener noreferrer" }
                  : option.id === "ticket" || option.id === "chat"
                  ? { onClick: openTicketDialog }
                  : {};

                return (
                  <Wrapper
                    key={option.id}
                    {...wrapperProps}
                    className="flex w-full items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50 text-left"
                  >
                    <div
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-md",
                        option.available
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{option.title}</span>
                        {option.href && <ExternalLink className="size-3 text-muted-foreground" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Clock className="size-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">{option.responseTime}</span>
                        {option.available && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Online
                          </span>
                        )}
                      </div>
                    </div>
                  </Wrapper>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Resources" className="p-5">
            <div className="space-y-1">
              {[
                { label: "API Documentation", href: "/docs/api", icon: Code },
                { label: "Changelog", href: "/changelog", icon: FileText },
                { label: "Community Forum", href: "/community", icon: MessageCircle },
                { label: "Status Page", href: "https://status.vellum.app", icon: CheckCircle2, external: true },
              ].map((item) => {
                const Icon = item.icon;
                const Wrapper = item.external ? "a" : Link;
                const props = item.external
                  ? { href: item.href, target: "_blank", rel: "noopener noreferrer" }
                  : { to: item.href };

                return (
                  <Wrapper
                    key={item.label}
                    {...props}
                    className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent/50 transition-colors"
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="flex-1">{item.label}</span>
                    {item.external ? (
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                    )}
                  </Wrapper>
                );
              })}
            </div>
          </SectionCard>

          <div className="rounded-lg bg-muted/50 p-5 text-center">
            <h4 className="text-sm font-medium">Still need help?</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Our team is available Monday–Friday, 9am–6pm EST
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={openTicketDialog}
            >
              <Mail className="size-3.5" />
              Contact us
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={ticketOpen} onOpenChange={(open) => open ? openTicketDialog() : closeTicketDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="size-5 text-primary" />
              Open a support ticket
            </DialogTitle>
            <DialogDescription>
              Describe your issue and we'll get back to you within 24 hours.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="e.g. Can't configure webhook endpoint"
                value={ticketForm.subject}
                onChange={(e) => setTicketForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <div className="flex gap-2">
                {(["low", "medium", "high", "critical"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setTicketForm((f) => ({ ...f, priority: p }))}
                    className={cn(
                      "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition-colors",
                      ticketForm.priority === p
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted hover:bg-accent"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Describe your issue in detail..."
                rows={4}
                value={ticketForm.message}
                onChange={(e) => setTicketForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>

            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="size-3.5" />
                <span className="font-medium">Before submitting:</span>
              </div>
              <ul className="mt-1 ml-5 list-disc space-y-0.5">
                <li>Check our documentation for common solutions</li>
                <li>Include steps to reproduce if reporting a bug</li>
                <li>Attach screenshots if relevant</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeTicketDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleTicketSubmit}
              disabled={isSubmitting}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Submit ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
