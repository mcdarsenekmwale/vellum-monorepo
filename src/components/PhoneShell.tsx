import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Compass, PlaySquare, Bookmark, User } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/", label: "Feed", icon: Home },
  { to: "/discover", label: "Find", icon: Compass },
  { to: "/reels", label: "Reels", icon: PlaySquare },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/profile", label: "Me", icon: User },
] as const;

export function PhoneShell({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-frame flex justify-center py-0 md:py-10 md:px-4">
      <main className="w-full max-w-[440px] bg-background text-foreground shadow-2xl md:rounded-[40px] overflow-hidden relative md:border-8 md:border-black/5 min-h-screen md:min-h-[860px] md:h-[860px] flex flex-col">
        {header}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-28">{children}</div>
        <nav className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border px-6 py-3 flex justify-between items-center z-30">
          {tabs.map((t) => {
            const active = t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-col items-center gap-1 px-2 py-1 transition-opacity ${active ? "opacity-100" : "opacity-40 hover:opacity-70"}`}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                <span className="text-[9px] font-bold uppercase tracking-widest">{t.label}</span>
                {active && <span className="size-1 rounded-full bg-accent" />}
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}

export function TopBar({ title = "Vellum.", right }: { title?: string; right?: ReactNode }) {
  return (
    <nav className="px-6 pt-8 pb-4 flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-20 border-b border-border/50">
      <div className="font-display italic text-2xl tracking-tight text-foreground">{title}</div>
      {right ?? (
        <div className="size-10 rounded-full bg-accent/10 border border-accent/20 grid place-items-center">
          <div className="size-2 bg-accent rounded-full animate-pulse" />
        </div>
      )}
    </nav>
  );
}
