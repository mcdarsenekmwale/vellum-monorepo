import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import {
  Ticket,
  Activity,
  Users,
  ShieldAlert,
  FileEdit,
  BarChart3,
  Brain,
  FileText,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType, SVGProps } from "react";

export interface QuickActionsGridProps {
  onRunQuickAction: (message: string, quickActionName?: string) => void;
  onSwitchToChatTab: () => void;
  onOpenModelDialog: () => void;
}

type LucideIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface QuickActionItem {
  id: string;
  icon: LucideIcon;
  iconTint: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}

export function QuickActionsGrid({
  onRunQuickAction,
  onSwitchToChatTab,
  onOpenModelDialog,
}: QuickActionsGridProps) {
  const navigate = useNavigate();

  const triggerChat = (prompt: string, name: string) => {
    onSwitchToChatTab();
    onRunQuickAction(prompt, name);
  };

  const actions: QuickActionItem[] = [
    {
      id: "tickets",
      icon: Ticket,
      iconTint: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      title: "Open tickets",
      subtitle: "Summarize all waiting tickets, priorities, oldest first.",
      onClick: () =>
        triggerChat(
          "Please summarize the open support tickets with priorities and oldest first.",
          "open_tickets_summary"
        ),
    },
    {
      id: "traffic",
      icon: Activity,
      iconTint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      title: "Service health & traffic",
      subtitle: "All systems status, recent alerts, 24h traffic overview.",
      onClick: () =>
        triggerChat(
          "Give me a service health overview: list all system statuses, recent alerts from the last 24 hours, and top traffic sources.",
          "service_health_traffic"
        ),
    },
    {
      id: "churn",
      icon: Users,
      iconTint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      title: "Users at risk",
      subtitle: "Churn-risk users, quick outreach suggestions.",
      onClick: () =>
        triggerChat(
          "List users at risk of churn based on recent inactivity, and suggest short outreach messages.",
          "churn_risk_users"
        ),
    },
    {
      id: "moderation",
      icon: ShieldAlert,
      iconTint: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      title: "Moderation sweep",
      subtitle: "Last 100 comments — keyword classifier, triage flags.",
      onClick: () =>
        triggerChat(
          "Run a moderation sweep over the last 100 comments: flag anything that needs review using the keyword classifier, grouped by risk.",
          "moderation_sweep"
        ),
    },
    {
      id: "draft",
      icon: FileEdit,
      iconTint: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      title: "Draft article",
      subtitle: "AI draft an article, then open editor to confirm and publish.",
      onClick: () =>
        triggerChat(
          "Draft a short engaging article about the most-discussed topic on the platform this week. Suggest category and cover style.",
          "draft_article"
        ),
    },
    {
      id: "report",
      icon: BarChart3,
      iconTint: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      title: "Weekly analytics PDF",
      subtitle: "Engagement, tickets, incidents — summary ready to share.",
      onClick: () =>
        triggerChat(
          "Produce a weekly analytics summary covering engagement, support tickets resolved/opened, and incidents. Prepare it as a shareable report.",
          "weekly_analytics_report"
        ),
    },
    {
      id: "model",
      icon: Brain,
      iconTint: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      title: "Switch AI model",
      subtitle: "Change model, temperature, max tokens — test before save.",
      onClick: () => onOpenModelDialog(),
    },
    {
      id: "activity",
      icon: FileText,
      iconTint: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
      title: "AI activity log",
      subtitle: "Audit-ready log of all placements, tokens, statuses.",
      onClick: () => navigate({ to: "/_app/ai-activity" }),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {actions.map((a) => (
        <Card
          key={a.id}
          className="group cursor-pointer hover:border-emerald-500/40 hover:bg-muted/40 transition-all border bg-card"
          onClick={a.onClick}
        >
          <CardContent className="p-3.5 flex items-start gap-3">
            <div
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-md",
                a.iconTint
              )}
            >
              <a.icon className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1 pr-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium leading-tight truncate">
                  {a.title}
                </h3>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:text-emerald-500 transition-all" />
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                {a.subtitle}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
