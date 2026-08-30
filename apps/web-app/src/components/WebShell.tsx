import { Link, useRouterState } from "@tanstack/react-router";
import { Avatar } from "@/components/Avatar";
import {
  Home,
  Compass,
  PlaySquare,
  Bookmark,
  User,
  Search,
  Settings,
  Plus,
  LogIn,
  UserPlus,
} from "lucide-react";
import { WebBellInbox } from "@/components/activity/web-bell-inbox";
import { useState, type ReactNode } from "react";
import { useAuthState, useArticles } from "@/hooks/useApi";
import { SuggestedAuthorsSidebar } from "@/components/SuggestedAuthorsSidebar";
import { useI18n } from "@/components/providers/I18nProvider";
import { AiWebProfileCoachBar } from "./ai/web-profile-coach-bar";
import { useAISnapshot } from "./ai/use-ai-snapshot";
import AiWebProfileFAB from "./ai/web-profile-fab";
import AiWebSharedChatDrawer from "./ai/web-shared-chat-drawer";
import { cn } from "@/lib/utils";

const authNavItems = [
  { to: "/", label: "navigation.home", icon: Home },
  { to: "/discover", label: "navigation.discover", icon: Compass },
  { to: "/highlights", label: "navigation.highlights", icon: PlaySquare },
  { to: "/saved", label: "navigation.saved", icon: Bookmark },
  { to: "/profile", label: "navigation.profile", icon: User },
] as const;

const guestNavItems = [
  { to: "/", label: "navigation.home", icon: Home },
  { to: "/discover", label: "navigation.discover", icon: Compass },
  { to: "/highlights", label: "navigation.highlights", icon: PlaySquare },
] as const;

export function WebShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAuthenticated } = useAuthState();
  const { t } = useI18n();
  const { data: articlesData, isLoading: articlesLoading } = useArticles(1, 10);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const isOwner = isAuthenticated && !!user;

  const { data: aiSnapshot, loading: aiSnapshotLoading } = useAISnapshot({
    profileUserId: (user as any)?.id ?? null,
    profileUserHandle: (user as any)?.handle ?? null,
    isOwner,
    enabled: true,
  });

  const articles = articlesData?.data ?? [];
  const suggestedAuthors = articles
    .slice(0, 10)
    .reduce(
      (acc, article) => {
        if (
          article.author &&
          !acc.find((a) => a.id === article.author.id)
        ) {
          acc.push(article.author);
        }
        return acc;
      },
      [] as Array<{
        id: string;
        handle: string;
        name: string;
        avatar?: string;
        bio?: string;
      }>,
    )
    .slice(0, 5);

  const userDisplay = {
    name: user?.name || "Guest",
    handle: user?.handle || "@guest",
    avatar: user?.avatar || null,
  };

  const navItems = isAuthenticated ? authNavItems : guestNavItems;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1280px] flex">
        {/* Left Sidebar */}
        <aside className="sticky top-0 h-screen w-[244px] hidden md:flex flex-col border-r border-border px-6 py-8 overflow-y-auto">
          <Link
            to="/"
            className="font-display italic text-3xl tracking-tight mb-10 inline-block shrink-0"
          >
            Vellbase.
          </Link>

          <nav className="flex flex-col gap-2 flex-1 min-h-0">
            {navItems.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 rounded-xl transition-colors",
                    active
                      ? "bg-foreground text-background font-semibold"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon
                    className="size-6 shrink-0"
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span className="text-base truncate">{t(item.label)}</span>
                </Link>
              );
            })}

            {isAuthenticated ? (
              <Link
                to="/compose"
                className="mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent text-white font-semibold hover:opacity-90 transition-opacity shrink-0"
              >
                <Plus className="size-5" strokeWidth={2.2} />
                <span>{t("navigation.compose")}</span>
              </Link>
            ) : (
              <div className="mt-4 space-y-2 shrink-0">
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-foreground text-background font-semibold hover:opacity-90 transition-opacity"
                >
                  <LogIn className="size-5" strokeWidth={2.2} />
                  <span>{t("auth.signIn")}</span>
                </Link>
                <Link
                  to="/register"
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors"
                >
                  <UserPlus className="size-5" strokeWidth={2.2} />
                  <span>{t("auth.createAccount")}</span>
                </Link>
              </div>
            )}
          </nav>

          {/* AI Coach Bar */}
          {isAuthenticated && (
            <div className="mt-4 shrink-0">
              <AiWebProfileCoachBar
                snapshot={aiSnapshot}
                snapshotLoading={aiSnapshotLoading}
                isOwner={isOwner}
                onOpenDrawer={() => setDrawerOpen(true)}
              />
            </div>
          )}

          {/* User Profile Footer */}
          <div className="border-t border-border pt-4 mt-4 shrink-0">
            {isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted min-w-0"
                >
                  <Avatar
                    src={userDisplay.avatar}
                    alt={userDisplay.name}
                    name={userDisplay.name}
                    handle={userDisplay.handle}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {userDisplay.handle}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {userDisplay.name}
                    </p>
                  </div>
                </Link>
                <Link
                  to="/settings"
                  className="mt-2 flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <Settings className="size-5 shrink-0" strokeWidth={1.8} />
                  <span className="text-sm">{t("navigation.settings")}</span>
                </Link>
              </>
            ) : (
              <div className="px-2 py-3">
                <p className="text-sm text-muted-foreground">
                  Sign in to access your profile, saved articles, and more.
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 pb-20 md:pb-0">
          {/* Top Bar */}
          <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
            <div className="flex items-center justify-between px-6 md:px-10 py-4">
              <Link
                to="/"
                className="md:hidden font-display italic text-2xl shrink-0"
              >
                Vellbase.
              </Link>
              <div className="hidden md:flex flex-1 max-w-[280px]">
                <label className="flex items-center gap-2 bg-muted rounded-full px-4 py-2 w-full" htmlFor="webshell-search">
                  <Search className="size-4 text-muted-foreground shrink-0" />
                  <span className="sr-only">Search</span>
                  <input
                    id="webshell-search"
                    type="text"
                    placeholder={t("navigation.search")}
                    className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground min-w-0"
                  />
                </label>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                {isAuthenticated ? (
                  <>
                    <WebBellInbox />
                    <Link to="/profile" className="md:hidden shrink-0" aria-label={userDisplay.handle ? `${userDisplay.handle} profile` : 'Go to profile'}>
                      <Avatar
                        src={userDisplay.avatar}
                        alt={userDisplay.name || 'User avatar'}
                        name={userDisplay.name}
                        handle={userDisplay.handle}
                        size="sm"
                      />
                    </Link>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      to="/login"
                      className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-muted transition-colors"
                    >
                      {t("auth.signIn")}
                    </Link>
                    <Link
                      to="/register"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                      Get Started
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="px-4 md:px-10 py-6">{children}</div>

          <AiWebSharedChatDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            profileOwnerId={(user as any)?.id ?? null}
            profileOwnerAvatar={user?.avatar ?? null}
            profileOwnerName={user?.name ?? null}
            isOwner={isOwner}
            isAuthenticated={isAuthenticated}
            viewerAvatar={user?.avatar ?? null}
            viewerName={user?.name ?? null}
          />
        </main>

        {/* Right Sidebar */}
        <aside className="hidden lg:block w-[320px] flex-none p-8 sticky top-0 h-screen overflow-y-hidden pb-24">
          {/* Suggested Authors */}
          <SuggestedAuthorsSidebar
            limit={5}
            suggestedAuthors={suggestedAuthors.map((a) => ({
              ...a,
              followersCount: 0,
              articlesCount: 0,
            }))}
          />

          {/* Trending */}
          <div className="mb-5">
            <span className="text-sm text-muted-foreground font-semibold mb-4 block">
              {t("home.trending")} {t("common.now")}
            </span>
            <div className="space-y-3">
              {articlesLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="h-8 w-8 bg-muted rounded animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="h-2 w-full bg-muted rounded animate-pulse" />
                        <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                  ))
                : articles.slice(0, 4).map((a, i) => (
                    <Link
                      key={a.slug}
                      to="/article/$slug"
                      params={{ slug: a.slug }}
                      className="flex gap-3 group min-w-0"
                    >
                      <span className="text-2xl font-display italic text-muted-foreground/40 w-8 shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-0.5 truncate">
                          {a.category?.name ?? "Article"}
                        </p>
                        <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                          {a.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.views?.toLocaleString() ?? 0} reads
                        </p>
                      </div>
                    </Link>
                  ))}
            </div>
          </div>

          {/* Footer Links */}
          <div className="text-xs text-muted-foreground/70 leading-relaxed">
            <div className="flex flex-wrap gap-x-2 gap-y-1 mb-2">
              <Link to="/settings/about" className="hover:underline">
                {t("common.about")}
              </Link>
              <Link to="/settings/help" className="hover:underline">
                {t("common.help")}
              </Link>
              <Link to="/settings/privacy" className="hover:underline">
                {t("common.privacy")}
              </Link>
              <Link to="/settings/about" className="hover:underline">
                {t("common.terms")}
              </Link>
              <Link to="/discover" className="hover:underline">
                {t("navigation.discover")}
              </Link>
              {isAuthenticated && (
                <Link to="/compose" className="hover:underline">
                  {t("navigation.compose")}
                </Link>
              )}
            </div>
            <p>&copy; 2026 Vellbase</p>
          </div>
        </aside>
      </div>

      {/* ─── AI Coach FAB (fixed to viewport, outside sidebar flow) ─── */}
      <AiWebProfileFAB
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        className="!bottom-6 !right-6"
      />
    </div>
  );
}