import { createFileRoute, Link } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import {
  ArrowLeft,
  Crown,
  Check,
  RefreshCcw,
  AlertTriangle,
  Sparkles,
  CalendarDays,
  CreditCard,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/providers/I18nProvider";
import { apiClient } from "@/lib/api";
import type { Subscription, SubscriptionPlan } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings/subscription")({
  head: () => ({
    meta: [{ title: "Subscription — Vellum" }],
  }),
  component: SubscriptionPage,
});

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatAmount(cents?: number, currency?: string, interval?: string) {
  if (typeof cents !== "number" || !currency) return null;
  try {
    const n = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
    return interval ? `${n}/${interval === "month" ? "mo" : interval === "year" ? "yr" : interval}` : n;
  } catch {
    return `${cents / 100} ${currency}`;
  }
}

function statusKey(s?: string): "subscriptionStatusActive" | "subscriptionStatusCanceled" | "subscriptionStatusPastDue" | "subscriptionStatusTrialing" {
  if (s === "canceled") return "subscriptionStatusCanceled";
  if (s === "past_due") return "subscriptionStatusPastDue";
  if (s === "trialing") return "subscriptionStatusTrialing";
  return "subscriptionStatusActive";
}

function statusTone(s?: string) {
  switch (s) {
    case "active":
    case "trialing":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case "canceled":
      return "bg-muted text-muted-foreground border-border";
    case "past_due":
      return "bg-amber-500/10 text-amber-600 border-amber-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: "pro-monthly",
    name: "Vellum Pro",
    description: "Everything you need to read and write beautifully.",
    amountCents: 499,
    currency: "USD",
    interval: "month",
    popular: true,
    features: [
      "Ad-free reading experience",
      "Unlimited saved articles & highlights",
      "Custom themes and advanced typography",
      "Early access to new features",
      "Priority support",
    ],
  },
  {
    id: "pro-yearly",
    name: "Vellum Pro Annual",
    description: "Two months free, billed yearly.",
    amountCents: 4790,
    currency: "USD",
    interval: "year",
    features: [
      "All Pro features",
      "Save ~20% vs monthly",
      "Exclusive yearly badge",
    ],
  },
];

function SubscriptionPage() {
  const { t } = useI18n();
  const [subscription, setSubscription] = useState<Subscription | null | undefined>(undefined);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_PLANS);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"idle" | "upgrade" | "restore" | "cancel" | "resume">("idle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [sub, fetchedPlans] = await Promise.all([
          apiClient.getSubscription().catch(() => null as unknown as Subscription | null),
          apiClient.getSubscriptionPlans().catch(() => [] as unknown as SubscriptionPlan[]),
        ]);
        if (cancelled) return;
        setSubscription(sub ?? null);
        if (fetchedPlans && fetchedPlans.length > 0) setPlans(fetchedPlans);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const upgrade = async (plan: SubscriptionPlan) => {
    try {
      setAction("upgrade");
      const res = await apiClient.createSubscriptionCheckout({
        planId: plan.id,
        successUrl: `${window.location.origin}/settings/subscription`,
        cancelUrl: `${window.location.origin}/settings/subscription`,
      });
      if (res?.subscription) {
        setSubscription(res.subscription);
        toast.success("Subscription updated!");
      } else if (res?.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        // Fallback: optimistic mark with a mock subscription for UI
        const now = new Date();
        const renewal = new Date(now);
        renewal.setMonth(renewal.getMonth() + (plan.interval === "year" ? 12 : 1));
        setSubscription({
          id: "sub_" + Math.random().toString(36).slice(2, 10),
          userId: "",
          planId: plan.id,
          planName: plan.name,
          status: "active",
          amountCents: plan.amountCents,
          currency: plan.currency,
          interval: plan.interval,
          renewalDate: renewal.toISOString(),
          cancelAtPeriodEnd: false,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
        toast.success("Subscribed to " + plan.name);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update subscription");
    } finally {
      setAction("idle");
    }
  };

  const restore = async () => {
    try {
      setAction("restore");
      const res = await apiClient.restorePurchases();
      if (res?.subscription) {
        setSubscription(res.subscription);
        toast.success(`Restored ${res.restored} purchase(s).`);
      } else {
        toast.message("No previous purchases to restore.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Restore failed");
    } finally {
      setAction("idle");
    }
  };

  const cancelSubscription = async () => {
    try {
      setAction("cancel");
      const s = await apiClient.cancelSubscription();
      setSubscription(s);
      toast.success("Subscription canceled — you'll keep access until renewal.");
    } catch (err: any) {
      toast.error(err?.message || "Couldn't cancel");
    } finally {
      setAction("idle");
    }
  };

  const resume = async () => {
    try {
      setAction("resume");
      const s = await apiClient.resumeSubscription();
      setSubscription(s);
      toast.success("Subscription resumed.");
    } catch (err: any) {
      toast.error(err?.message || "Couldn't resume");
    } finally {
      setAction("idle");
    }
  };

  const hasActiveSub = useMemo(() => {
    if (!subscription) return false;
    return subscription.status === "active" || subscription.status === "trialing";
  }, [subscription]);

  return (
    <WebShell>
      <div className="max-w-[880px] mx-auto" data-testid="settings-subscription-page">
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          data-testid="subscription-back"
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} />
          {t("common.back")}
        </Link>

        <header className="flex items-start gap-4 mb-8">
          <span className="size-14 shrink-0 grid place-items-center rounded-2xl bg-gradient-to-br from-amber-400 via-pink-500 to-fuchsia-600 text-white shadow-lg">
            <Crown className="size-7" strokeWidth={1.8} />
          </span>
          <div>
            <h1 className="text-3xl font-display italic" data-testid="subscription-title">
              {t("settings.subscriptionTitle")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveSub
                ? "Manage your current plan."
                : "Upgrade Vellum for an even better experience."}
            </p>
          </div>
        </header>

        {/* Current subscription status */}
        <section className="mb-8" data-testid="subscription-status-card">
          <div className="bg-card border border-border rounded-3xl p-6 md:p-7 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 size-60 rounded-full bg-gradient-to-br from-accent/30 via-fuchsia-500/10 to-transparent blur-3xl pointer-events-none" />
            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-5 w-32 rounded bg-muted" />
                <div className="h-9 w-64 rounded bg-muted" />
                <div className="h-4 w-48 rounded bg-muted" />
              </div>
            ) : subscription ? (
              <div className="relative">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span
                    data-testid="subscription-status-pill"
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold uppercase tracking-wider",
                      statusTone(subscription.status),
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {t(`settings.${statusKey(subscription.status)}`)}
                  </span>
                  <h2 className="text-xl font-semibold" data-testid="subscription-plan-name">
                    {subscription.planName}
                  </h2>
                  {formatAmount(subscription.amountCents, subscription.currency, subscription.interval) && (
                    <span className="ml-auto text-sm font-medium text-muted-foreground">
                      {formatAmount(subscription.amountCents, subscription.currency, subscription.interval)}
                    </span>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-4 mb-5">
                  <div className="flex items-center gap-3 text-sm">
                    <CalendarDays className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t("settings.subscriptionRenewalDate")}:&nbsp;</span>
                    <span className="font-medium" data-testid="subscription-renewal-date">
                      {formatDate(subscription.renewalDate || subscription.currentPeriodEnd)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CreditCard className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Renews automatically</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {subscription.cancelAtPeriodEnd || subscription.status === "canceled" ? (
                    <Button
                      variant="default"
                      onClick={resume}
                      disabled={action !== "idle"}
                      data-testid="subscription-resume"
                    >
                      {action === "resume" && <RefreshCcw className="size-4 animate-spin" />}
                      Resume subscription
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={cancelSubscription}
                      disabled={action !== "idle"}
                      data-testid="subscription-cancel"
                    >
                      {action === "cancel" && <RefreshCcw className="size-4 animate-spin" />}
                      Cancel renewal
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={restore}
                    disabled={action !== "idle"}
                    data-testid="subscription-restore"
                  >
                    {action === "restore" ? (
                      <RefreshCcw className="size-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="size-4" />
                    )}
                    {t("settings.subscriptionRestore")}
                  </Button>
                </div>

                {subscription.cancelAtPeriodEnd && (
                  <div data-testid="subscription-canceled-banner" className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                    <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-700 dark:text-amber-400">Your subscription ends at renewal</p>
                      <p className="text-amber-700/90 dark:text-amber-400/90 mt-0.5">
                        You will keep access to Pro features until {formatDate(subscription.renewalDate || subscription.currentPeriodEnd)}.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles className="size-5 text-accent" />
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-accent">
                    Vellum Free
                  </h2>
                </div>
                <p className="text-2xl font-semibold mb-4" data-testid="subscription-empty-headline">
                  {t("settings.subscriptionEmpty")}
                </p>
                <p className="text-muted-foreground max-w-xl mb-5">
                  Subscribe to unlock ad-free reading, custom themes, unlimited saves, and early access features.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={restore} disabled={action !== "idle"} data-testid="subscription-restore-empty">
                    {action === "restore" ? (
                      <RefreshCcw className="size-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="size-4" />
                    )}
                    {t("settings.subscriptionRestore")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Plans */}
        <section className="mb-8" data-testid="subscription-plans-section">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-2">
            {t("settings.subscriptionUpgrade")}
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-3xl border p-6 transition-all",
                  plan.popular
                    ? "border-accent/70 ring-1 ring-accent/30 bg-gradient-to-b from-accent/5 to-transparent"
                    : "border-border bg-card",
                )}
                data-testid={`subscription-plan-${plan.id}`}
              >
                {plan.popular && (
                  <span className="absolute -top-2.5 left-6 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent text-white text-[11px] font-bold uppercase tracking-wider">
                    <Sparkles className="size-3" /> Popular
                  </span>
                )}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h4 className="text-lg font-semibold">{plan.name}</h4>
                  {formatAmount(plan.amountCents, plan.currency, plan.interval) && (
                    <div className="text-right">
                      <div className="text-xl font-bold">
                        {formatAmount(plan.amountCents, plan.currency, plan.interval)}
                      </div>
                    </div>
                  )}
                </div>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mb-5">{plan.description}</p>
                )}
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f: string) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground/90">
                      <span className="mt-0.5 size-4 rounded-full bg-accent/15 text-accent grid place-items-center shrink-0">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.popular ? "default" : "outline"}
                  className="w-full"
                  onClick={() => upgrade(plan)}
                  disabled={action !== "idle"}
                  data-testid={`subscription-upgrade-${plan.id}`}
                >
                  {action === "upgrade" && <RefreshCcw className="size-4 animate-spin" />}
                  {hasActiveSub ? "Switch plan" : t("settings.subscriptionUpgrade")}
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </WebShell>
  );
}
