import { createFileRoute, Link } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Mail,
  Search,
  BookOpen,
  LogIn,
  PenLine,
  ShieldCheck,
  Bookmark,
  Flag,
  BarChart3,
  Sparkles,
  Code2,
  Webhook,
  CreditCard,
  Trash2,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Loader2,
  FileText,
  Hash,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  useHelpArticles,
  useTicketCategories,
  useCreateTicket,
  useMyTickets,
  useAuthState,
  useReplyToTicket,
} from "@/hooks/useApi";
import type {
  HelpArticle,
  SupportTicket,
  TicketPriority,
  TicketStatus,
  TicketMessage as TicketMessageType,
} from "@vellum/api-client/types";

export const Route = createFileRoute("/settings/help")({
  head: () => ({
    meta: [
      { title: "Help Center — Vellum" },
      { name: "description", content: "Frequently asked questions and support for Vellum." },
    ],
  }),
  component: HelpPage,
});

// Map icon names to Lucide components
const ICON_MAP: Record<string, React.FC<{ className?: string; strokeWidth?: number }>> = {
  BookOpen,
  LogIn,
  PenLine,
  ShieldCheck,
  Bookmark,
  Flag,
  BarChart3,
  Sparkles,
  Code2,
  Webhook,
  CreditCard,
  Trash2,
};

type Tab = "kb" | "contact" | "tickets";

const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  WAITING_ON_CUSTOMER: "Waiting on you",
  ESCALATED: "Escalated",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  NEW: "bg-blue-100 text-blue-700 border-blue-200",
  ASSIGNED: "bg-purple-100 text-purple-700 border-purple-200",
  IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-200",
  WAITING_ON_CUSTOMER: "bg-orange-100 text-orange-700 border-orange-200",
  ESCALATED: "bg-red-100 text-red-700 border-red-200",
  RESOLVED: "bg-green-100 text-green-700 border-green-200",
  CLOSED: "bg-gray-100 text-gray-600 border-gray-200",
  REOPENED: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

function HelpPage() {
  const [tab, setTab] = useState<Tab>("kb");
  const [kbSearch, setKbSearch] = useState("");
  const [kbCategory, setKbCategory] = useState<string | null>(null);
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [ticketFilter, setTicketFilter] = useState<TicketStatus | "ALL">("ALL");
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});

  const { data: articles, isLoading: articlesLoading } = useHelpArticles({
    search: kbSearch || undefined,
    category: kbCategory || undefined,
  });
  const { data: categories } = useTicketCategories();
  const { isAuthenticated } = useAuthState();
  const { mutate: createTicket, isLoading: creatingTicket } = useCreateTicket();
  const {
    data: myTicketsRaw,
    refetch: refetchTickets,
    isLoading: ticketsLoading,
  } = useMyTickets(1, 50);
  const { mutate: replyToTicket, isLoading: replying } = useReplyToTicket();

  // Ticket form state
  const [formSubject, setFormSubject] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formCategory, setFormCategory] = useState<string>("");
  const [formPriority, setFormPriority] = useState<TicketPriority>("MEDIUM");
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const categoryGroups = useMemo(() => {
    if (!articles) return [];
    const groups = new Map<string, HelpArticle[]>();
    for (const a of articles) {
      if (!groups.has(a.category)) groups.set(a.category, []);
      groups.get(a.category)!.push(a);
    }
    return Array.from(groups.entries()).map(([name, items]) => ({
      name,
      items: items.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0)),
    }));
  }, [articles]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    if (articles) for (const a of articles) set.add(a.category);
    return Array.from(set).sort();
  }, [articles]);

  const popularArticles = useMemo(
    () => (articles ? articles.filter((a) => a.popular).slice(0, 5) : []),
    [articles]
  );

  const filteredTickets = useMemo(() => {
    if (!myTicketsRaw?.data) return [] as SupportTicket[];
    return ticketFilter === "ALL"
      ? myTicketsRaw.data
      : myTicketsRaw.data.filter((t: SupportTicket) => t.status === (ticketFilter as TicketStatus));
  }, [myTicketsRaw, ticketFilter]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }
    if (!formSubject.trim() || !formMessage.trim()) {
      setFormError("Subject and message are required.");
      return;
    }
    setFormError(null);
    try {
      const result = await createTicket({
        subject: formSubject.trim(),
        message: formMessage.trim(),
        priority: formPriority,
        categoryId: formCategory || undefined,
      });
      setFormSuccess(
        `Thanks! Your ticket ${result.ticketNumber} has been submitted. We'll reply within 24 hours.`
      );
      setFormSubject("");
      setFormMessage("");
      setFormCategory("");
      setFormPriority("MEDIUM");
      refetchTickets();
      setTimeout(() => setFormSuccess(null), 6000);
    } catch (err: any) {
      setFormError(err?.message || "Something went wrong. Please try again.");
    }
  };

  const handleReply = async (ticketId: string) => {
    const draft = replyDraft[ticketId]?.trim();
    if (!draft) return;
    try {
      await replyToTicket(ticketId, draft);
      setReplyDraft((prev) => ({ ...prev, [ticketId]: "" }));
      refetchTickets();
    } catch (err: any) {
      console.error(err);
    }
  };

  const renderArticleBody = (lines: string[]) =>
    lines.map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("## ")) {
        return (
          <h4 key={i} className="text-sm font-semibold mt-4 mb-2 text-foreground">
            {trimmed.slice(3)}
          </h4>
        );
      }
      if (trimmed.startsWith(" - ") || trimmed.startsWith("- ")) {
        return (
          <li key={i} className="ml-5 text-sm text-muted-foreground leading-relaxed list-disc">
            {trimmed.replace(/^- /, "").replace(/^ /, "")}
          </li>
        );
      }
      if (!trimmed) return <br key={i} />;
      return (
        <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-1">
          {trimmed}
        </p>
      );
    });

  const getIcon = (iconName: string) => {
    const Comp = ICON_MAP[iconName] ?? FileText;
    return <Comp className="size-5" strokeWidth={1.8} />;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <WebShell>
      <div className="max-w-[720px] mx-auto">
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} />
          Back to settings
        </Link>

        <h1 className="text-3xl font-display italic mb-2">Help Center</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Answers to common questions about using Vellum, or reach out to our team directly.
        </p>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 p-1 bg-muted/60 rounded-xl w-fit">
          {(
            [
              { id: "kb", label: "Knowledge Base", icon: BookOpen },
              { id: "contact", label: "Contact Support", icon: Mail },
              { id: "tickets", label: "My Tickets", icon: MessageSquare },
            ] as { id: Tab; label: string; icon: React.FC<{ className?: string }> }[]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === id
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ─── KNOWLEDGE BASE TAB ─── */}
        {tab === "kb" && (
          <div className="space-y-8">
            {/* Search */}
            <div className="relative">
              <Search
                className="size-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2"
                strokeWidth={1.8}
              />
              <input
                value={kbSearch}
                onChange={(e) => setKbSearch(e.target.value)}
                type="text"
                placeholder="Search help articles, topics, keywords…"
                className="w-full h-11 pl-10 pr-10 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm placeholder:text-muted-foreground"
              />
              {kbSearch && (
                <button
                  onClick={() => setKbSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                >
                  <X className="size-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setKbCategory(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  kbCategory === null
                    ? "bg-accent text-white border-accent"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                All
              </button>
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setKbCategory(kbCategory === cat ? null : cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    kbCategory === cat
                      ? "bg-accent text-white border-accent"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {articlesLoading && (
              <div className="grid place-items-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!articlesLoading && popularArticles.length > 0 && !kbSearch && !kbCategory && (
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-2">
                  Popular
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {popularArticles.map((a) => (
                    <button
                      key={a.id}
                      onClick={() =>
                        setOpenArticleId(openArticleId === a.id ? null : a.id)
                      }
                      className="text-left bg-card border border-border rounded-xl p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="size-9 shrink-0 rounded-full bg-accent/10 text-accent grid place-items-center">
                          {getIcon(a.icon)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium mb-1">{a.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {a.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                            <Clock className="size-3" />
                            {a.readMinutes} min read ·{" "}
                            <span className="inline-flex items-center gap-1">
                              <Hash className="size-3" />
                              {a.category}
                            </span>
                          </div>
                        </div>
                        <ChevronRight
                          className={`size-4 text-muted-foreground shrink-0 mt-1 transition-transform ${
                            openArticleId === a.id ? "rotate-90" : ""
                          }`}
                        />
                      </div>
                      {openArticleId === a.id && (
                        <div className="mt-4 pt-4 border-t border-border pl-12">
                          {renderArticleBody(a.content)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* By category */}
            {!articlesLoading &&
              categoryGroups.map(({ name, items }) => (
                <section key={name}>
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-2">
                    {name}
                  </h3>
                  <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
                    {items.map((a) => {
                      const isOpen = openArticleId === a.id;
                      return (
                        <div key={a.id}>
                          <button
                            onClick={() => setOpenArticleId(isOpen ? null : a.id)}
                            aria-expanded={isOpen}
                            className="w-full flex items-start justify-between gap-4 p-4 hover:bg-muted transition-colors text-left"
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div
                                className={`size-9 shrink-0 rounded-full grid place-items-center ${
                                  a.popular
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {getIcon(a.icon)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{a.title}</p>
                                  {a.popular && (
                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                      Popular
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {a.description}
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="size-3" />
                                    {a.readMinutes} min
                                  </span>
                                  <span>{a.views.toLocaleString()} views</span>
                                </div>
                              </div>
                            </div>
                            <ChevronDown
                              className={`size-4 text-muted-foreground shrink-0 mt-3 transition-transform ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-5 pl-16">
                              {renderArticleBody(a.content)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}

            {!articlesLoading && articles?.length === 0 && (
              <div className="text-center py-16 bg-card border border-border rounded-2xl">
                <Search className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium mb-1">No articles found</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Try a different search or browse categories.
                </p>
                {(kbSearch || kbCategory) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setKbSearch("");
                      setKbCategory(null);
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── CONTACT SUPPORT TAB ─── */}
        {tab === "contact" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-accent/5 to-accent/0 border border-border rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-full bg-accent/15 text-accent grid place-items-center shrink-0">
                  <Mail className="size-6" strokeWidth={1.8} />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Reach the Vellum support team</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Can't find what you're looking for in the knowledge base? Submit a ticket and
                    a real human will get back to you — typically within 24 hours on business
                    days.
                  </p>
                </div>
              </div>
            </div>

            {showLoginPrompt && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 mb-1">
                    You need to be signed in
                  </p>
                  <p className="text-xs text-amber-700 mb-3">
                    Please sign in to submit a support ticket so we can follow up with you.
                  </p>
                  <Link to="/login">
                    <Button size="sm" variant="default">
                      Sign in to Vellum
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {formSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
                <CheckCircle2 className="size-5 text-green-600 shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">{formSuccess}</p>
              </div>
            )}

            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{formError}</p>
              </div>
            )}

            <form
              onSubmit={handleSubmitTicket}
              className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border"
            >
              <div className="p-5">
                <label className="block text-sm font-medium mb-1.5">Subject *</label>
                <input
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  type="text"
                  placeholder="Briefly summarize your issue or question"
                  disabled={!isAuthenticated || creatingTicket}
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm placeholder:text-muted-foreground disabled:opacity-50"
                />
              </div>

              <div className="p-5 grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    disabled={!isAuthenticated || creatingTicket}
                    className="w-full h-10 px-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm disabled:opacity-50"
                  >
                    <option value="">General question</option>
                    {categories?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TicketPriority)}
                    disabled={!isAuthenticated || creatingTicket}
                    className="w-full h-10 px-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm disabled:opacity-50"
                  >
                    {PRIORITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-5">
                <label className="block text-sm font-medium mb-1.5">Message *</label>
                <textarea
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  rows={6}
                  placeholder="Please describe the issue in detail. Include steps to reproduce, any error messages, and your browser/device."
                  disabled={!isAuthenticated || creatingTicket}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm placeholder:text-muted-foreground resize-none disabled:opacity-50"
                />
              </div>

              <div className="p-5 flex items-center justify-between gap-3 bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  By submitting, you agree to our{" "}
                  <Link to="/settings/about" className="underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link to="/settings/privacy" className="underline">
                    Privacy Policy
                  </Link>
                  .
                </p>
                <Button type="submit" disabled={!isAuthenticated || creatingTicket}>
                  {creatingTicket ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Submit ticket
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ─── MY TICKETS TAB ─── */}
        {tab === "tickets" && (
          <div className="space-y-6">
            {!isAuthenticated && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                <AlertCircle className="size-8 text-amber-600 mx-auto mb-3" />
                <p className="font-semibold mb-1 text-amber-800">Sign in to view your tickets</p>
                <p className="text-sm text-amber-700 mb-4">
                  Once signed in, you'll see all your past and open support conversations here.
                </p>
                <Link to="/login">
                  <Button size="sm">Sign in to Vellum</Button>
                </Link>
              </div>
            )}

            {isAuthenticated && (
              <>
                {/* Status filter */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setTicketFilter("ALL")}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      ticketFilter === "ALL"
                        ? "bg-accent text-white border-accent"
                        : "bg-card text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    All ({myTicketsRaw?.total ?? 0})
                  </button>
                  {(
                    [
                      "NEW",
                      "IN_PROGRESS",
                      "WAITING_ON_CUSTOMER",
                      "RESOLVED",
                      "CLOSED",
                    ] as TicketStatus[]
                  ).map((s: TicketStatus) => (
                    <button
                      key={s}
                      onClick={() => setTicketFilter(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                        ticketFilter === s
                          ? "bg-accent text-white border-accent"
                          : "bg-card text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      {STATUS_LABELS[s]}{" "}
                      {myTicketsRaw?.data && (
                        <span className="opacity-70">
                          ({myTicketsRaw.data.filter((t: SupportTicket) => t.status === s).length})
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {ticketsLoading && (
                  <div className="grid place-items-center py-12">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!ticketsLoading && filteredTickets.length === 0 && (
                  <div className="text-center py-16 bg-card border border-border rounded-2xl">
                    <MessageSquare className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium mb-1">No tickets yet</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {ticketFilter === "ALL"
                        ? "You haven't submitted any support tickets yet."
                        : `No ${STATUS_LABELS[ticketFilter]} tickets.`}
                    </p>
                    <Button size="sm" onClick={() => setTab("contact")}>
                      <Mail className="size-4" />
                      Contact support
                    </Button>
                  </div>
                )}

                {!ticketsLoading && filteredTickets.length > 0 && (
                  <div className="space-y-3">
                    {filteredTickets.map((t: SupportTicket) => {
                      const isOpen = openTicketId === t.id;
                      const ticketStatus = t.status as TicketStatus;
                      return (
                        <div
                          key={t.id}
                          className="bg-card border border-border rounded-2xl overflow-hidden"
                        >
                          <button
                            onClick={() => setOpenTicketId(isOpen ? null : t.id)}
                            className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`size-9 shrink-0 rounded-full grid place-items-center ${
                                  ticketStatus === "RESOLVED" || ticketStatus === "CLOSED"
                                    ? "bg-green-100 text-green-700"
                                    : ticketStatus === "WAITING_ON_CUSTOMER"
                                      ? "bg-orange-100 text-orange-700"
                                      : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {ticketStatus === "RESOLVED" || ticketStatus === "CLOSED" ? (
                                  <CheckCircle2 className="size-4.5" strokeWidth={1.8} />
                                ) : (
                                  <MessageSquare className="size-4.5" strokeWidth={1.8} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <p className="text-sm font-medium truncate">{t.subject}</p>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                                      STATUS_COLORS[ticketStatus]
                                    }`}
                                  >
                                    {STATUS_LABELS[ticketStatus]}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                  <span className="font-mono">{t.ticketNumber}</span>
                                  <span>·</span>
                                  <span>{formatDate(t.createdAt)}</span>
                                  {t.category && (
                                    <>
                                      <span>·</span>
                                      <span>{t.category.name}</span>
                                    </>
                                  )}
                                  {t.assignee && (
                                    <>
                                      <span>·</span>
                                      <span>Assigned to {t.assignee.name}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <ChevronDown
                                className={`size-4 text-muted-foreground shrink-0 mt-2 transition-transform ${
                                  isOpen ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                          </button>

                          {isOpen && (
                            <div className="border-t border-border">
                              {/* Messages thread */}
                              <div className="p-5 space-y-4 bg-muted/20">
                                {/* Initial message */}
                                <div className="flex gap-3">
                                  <div className="size-8 shrink-0 rounded-full bg-muted grid place-items-center text-xs font-medium text-muted-foreground">
                                    You
                                  </div>
                                  <div className="flex-1">
                                    <div className="bg-card border border-border rounded-2xl rounded-tl-sm p-3.5">
                                      <p className="text-[11px] text-muted-foreground mb-1">
                                        You · {formatDate(t.createdAt)}
                                      </p>
                                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                        {t.message}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Subsequent messages */}
                                {t.messages?.map((m: TicketMessageType) => {
                                  const isYou = m.authorId === t.userId;
                                  return (
                                    <div key={m.id} className={`flex gap-3 ${isYou ? "" : "flex-row-reverse"}`}>
                                      <div
                                        className={`size-8 shrink-0 rounded-full grid place-items-center text-xs font-medium ${
                                          isYou
                                            ? "bg-muted text-muted-foreground"
                                            : "bg-accent/15 text-accent"
                                        }`}
                                      >
                                        {isYou ? "You" : (m.author.name?.[0] ?? "A")}
                                      </div>
                                      <div className={`flex-1 max-w-[80%] ${isYou ? "" : "text-right"}`}>
                                        <div
                                          className={`rounded-2xl p-3.5 inline-block text-left ${
                                            isYou
                                              ? "bg-card border border-border rounded-tl-sm"
                                              : "bg-accent/10 border border-accent/10 rounded-tr-sm"
                                          }`}
                                        >
                                          <p className="text-[11px] text-muted-foreground mb-1">
                                            {m.author.name} · {formatDate(m.createdAt)}
                                          </p>
                                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                            {m.body}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Reply box */}
                              {t.status !== "CLOSED" && t.status !== "RESOLVED" ? (
                                <div className="p-4 border-t border-border bg-card">
                                  <div className="flex gap-2 items-end">
                                    <textarea
                                      value={replyDraft[t.id] ?? ""}
                                      onChange={(e) =>
                                        setReplyDraft((prev) => ({
                                          ...prev,
                                          [t.id]: e.target.value,
                                        }))
                                      }
                                      rows={2}
                                      placeholder="Write a reply…"
                                      className="flex-1 px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm placeholder:text-muted-foreground resize-none"
                                    />
                                    <Button
                                      onClick={() => handleReply(t.id)}
                                      disabled={!replyDraft[t.id]?.trim() || replying}
                                      size="sm"
                                    >
                                      {replying ? (
                                        <Loader2 className="size-4 animate-spin" />
                                      ) : (
                                        <Send className="size-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-4 border-t border-border text-center">
                                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                                    <CheckCircle2 className="size-3.5" />
                                    This ticket is {STATUS_LABELS[ticketStatus].toLowerCase()}. If
                                    you need further help, please open a new one.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </WebShell>
  );
}
