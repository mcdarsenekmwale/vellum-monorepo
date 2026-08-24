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
import { useI18n } from "@/components/providers/I18nProvider";

const STATUS_KEY_MAP: Record<TicketStatus, string> = {
  NEW: "settings.ticketStatusNew",
  ASSIGNED: "settings.ticketStatusAssigned",
  IN_PROGRESS: "settings.ticketStatusInProgress",
  WAITING_ON_CUSTOMER: "settings.ticketStatusWaitingOnCustomer",
  ESCALATED: "settings.ticketStatusEscalated",
  RESOLVED: "settings.ticketStatusResolved",
  CLOSED: "settings.ticketStatusClosed",
  REOPENED: "settings.ticketStatusReopened",
};

const PRIORITY_KEY_MAP: Record<TicketPriority, string> = {
  LOW: "settings.ticketPriorityLow",
  MEDIUM: "settings.ticketPriorityMedium",
  HIGH: "settings.ticketPriorityHigh",
  CRITICAL: "settings.ticketPriorityCritical",
  EMERGENCY: "settings.ticketPriorityEmergency",
};

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

function HelpPage() {
  const { t, formatNumber, formatDate: fmtDate } = useI18n();
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
      setFormError(t("settings.contactErrorRequired"));
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
      setFormSuccess(t("settings.contactSuccessMessage", { ticketNumber: result.ticketNumber }));
      setFormSubject("");
      setFormMessage("");
      setFormCategory("");
      setFormPriority("MEDIUM");
      refetchTickets();
      setTimeout(() => setFormSuccess(null), 6000);
    } catch (err: any) {
      setFormError(err?.message || t("settings.contactErrorGeneric"));
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
    fmtDate(new Date(iso), {
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
          {t("settings.helpBackToSettings")}
        </Link>

        <h1 className="text-3xl font-display italic mb-2">{t("settings.helpTitle")}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {t("settings.helpSubtitle")}
        </p>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 p-1 bg-muted/60 rounded-xl w-fit">
          {(
            [
              { id: "kb", label: t("settings.helpTabKnowledgeBase"), icon: BookOpen },
              { id: "contact", label: t("settings.helpTabContactSupport"), icon: Mail },
              { id: "tickets", label: t("settings.helpTabMyTickets"), icon: MessageSquare },
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
                placeholder={t("settings.helpKbSearchPlaceholder")}
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
                {t("settings.helpCategoryAll")}
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
                  {t("settings.helpSectionPopular")}
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
                            {t("settings.helpMetaReadMinutes", { minutes: a.readMinutes })} ·{" "}
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
                                      {t("settings.helpPopularBadge")}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {a.description}
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="size-3" />
                                    {t("settings.helpMetaReadMinutes", { minutes: a.readMinutes })}
                                  </span>
                                  <span>{formatNumber(a.views)} views</span>
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
                <p className="text-sm font-medium mb-1">{t("settings.helpNoArticlesFound")}</p>
                <p className="text-xs text-muted-foreground mb-4">
                  {t("settings.helpNoArticlesDescription")}
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
                    {t("settings.helpClearFilters")}
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
                  <h3 className="font-semibold mb-1">{t("settings.contactReachTeam")}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("settings.contactReachDescription")}
                  </p>
                </div>
              </div>
            </div>

            {showLoginPrompt && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 mb-1">
                    {t("settings.contactSignInRequired")}
                  </p>
                  <p className="text-xs text-amber-700 mb-3">
                    {t("settings.contactSignInDescription")}
                  </p>
                  <Link to="/login">
                    <Button size="sm" variant="default">
                      {t("settings.contactSignIn")}
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
                <label className="block text-sm font-medium mb-1.5">{t("settings.contactLabelSubject")}</label>
                <input
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  type="text"
                  placeholder={t("settings.contactSubjectPlaceholder")}
                  disabled={!isAuthenticated || creatingTicket}
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm placeholder:text-muted-foreground disabled:opacity-50"
                />
              </div>

              <div className="p-5 grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t("settings.contactLabelCategory")}</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    disabled={!isAuthenticated || creatingTicket}
                    className="w-full h-10 px-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm disabled:opacity-50"
                  >
                    <option value="">{t("settings.contactCategoryGeneral")}</option>
                    {categories?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t("settings.contactLabelPriority")}</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TicketPriority)}
                    disabled={!isAuthenticated || creatingTicket}
                    className="w-full h-10 px-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm disabled:opacity-50"
                  >
                    {(Object.keys(PRIORITY_KEY_MAP) as TicketPriority[]).map((val) => (
                      <option key={val} value={val}>
                        {t(PRIORITY_KEY_MAP[val])}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-5">
                <label className="block text-sm font-medium mb-1.5">{t("settings.contactLabelMessage")}</label>
                <textarea
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  rows={6}
                  placeholder={t("settings.contactMessagePlaceholder")}
                  disabled={!isAuthenticated || creatingTicket}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm placeholder:text-muted-foreground resize-none disabled:opacity-50"
                />
              </div>

              <div className="p-5 flex items-center justify-between gap-3 bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  {t("settings.contactAgreement")}
                </p>
                <Button type="submit" disabled={!isAuthenticated || creatingTicket}>
                  {creatingTicket ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("settings.contactSending")}
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      {t("settings.contactSubmitTicket")}
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
                      {t(STATUS_KEY_MAP[s])}{" "}
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
                    <p className="text-sm font-medium mb-1">{t("settings.ticketsNoTicketsYet")}</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {ticketFilter === "ALL"
                        ? t("settings.ticketsNoTicketsDescription")
                        : t("settings.ticketsNoStatusTickets", { status: t(STATUS_KEY_MAP[ticketFilter as TicketStatus]) })}
                    </p>
                    <Button size="sm" onClick={() => setTab("contact")}>
                      <Mail className="size-4" />
                      {t("settings.ticketsContactSupport")}
                    </Button>
                  </div>
                )}

                {!ticketsLoading && filteredTickets.length > 0 && (
                  <div className="space-y-3">
                    {filteredTickets.map((ticket: SupportTicket) => {
                      const isOpen = openTicketId === ticket.id;
                      const ticketStatus = ticket.status as TicketStatus;
                      return (
                        <div
                          key={ticket.id}
                          className="bg-card border border-border rounded-2xl overflow-hidden"
                        >
                          <button
                            onClick={() => setOpenTicketId(isOpen ? null : ticket.id)}
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
                                  <p className="text-sm font-medium truncate">{ticket.subject}</p>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                                      STATUS_COLORS[ticketStatus]
                                    }`}
                                  >
                                    {t(STATUS_KEY_MAP[ticketStatus])}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                  <span className="font-mono">{ticket.ticketNumber}</span>
                                  <span>·</span>
                                  <span>{formatDate(ticket.createdAt)}</span>
                                  {ticket.category && (
                                    <>
                                      <span>·</span>
                                      <span>{ticket.category.name}</span>
                                    </>
                                  )}
                                  {ticket.assignee && (
                                    <>
                                      <span>·</span>
                                      <span>{t("settings.ticketsAssignedTo", { name: ticket.assignee.name })}</span>
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
                                    {t("settings.ticketsYou")}
                                  </div>
                                  <div className="flex-1">
                                    <div className="bg-card border border-border rounded-2xl rounded-tl-sm p-3.5">
                                      <p className="text-[11px] text-muted-foreground mb-1">
                                        {t("settings.ticketsYou")} · {formatDate(ticket.createdAt)}
                                      </p>
                                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                        {ticket.message}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Subsequent messages */}
                                {ticket.messages?.map((m: TicketMessageType) => {
                                  const isYou = m.authorId === ticket.userId;
                                  return (
                                    <div key={m.id} className={`flex gap-3 ${isYou ? "" : "flex-row-reverse"}`}>
                                      <div
                                        className={`size-8 shrink-0 rounded-full grid place-items-center text-xs font-medium ${
                                          isYou
                                            ? "bg-muted text-muted-foreground"
                                            : "bg-accent/15 text-accent"
                                        }`}
                                      >
                                        {isYou ? t("settings.ticketsYou") : (m.author.name?.[0] ?? "A")}
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
                              {ticket.status !== "CLOSED" && ticket.status !== "RESOLVED" ? (
                                <div className="p-4 border-t border-border bg-card">
                                  <div className="flex gap-2 items-end">
                                    <textarea
                                      value={replyDraft[ticket.id] ?? ""}
                                      onChange={(e) =>
                                        setReplyDraft((prev) => ({
                                          ...prev,
                                          [ticket.id]: e.target.value,
                                        }))
                                      }
                                      rows={2}
                                      placeholder={t("settings.ticketsReplyPlaceholder")}
                                      className="flex-1 px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm placeholder:text-muted-foreground resize-none"
                                    />
                                    <Button
                                      onClick={() => handleReply(ticket.id)}
                                      disabled={!replyDraft[ticket.id]?.trim() || replying}
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
                                    {t("settings.ticketsClosedNotice", { status: t(STATUS_KEY_MAP[ticketStatus]).toLowerCase() })}
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
