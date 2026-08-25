import { useMemo } from "react";
import type { TeamsCardType } from "@/lib/api/services";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Users, Activity, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamsCardPreviewProps {
  cardType?: TeamsCardType | null;
  template?: Record<string, unknown> | null;
  sampleEvent?: string;
  samplePayload?: Record<string, unknown>;
  className?: string;
}

const DEFAULT_MESSAGE_TEMPLATE = {
  "@type": "MessageCard",
  "@context": "https://schema.org/extensions",
  themeColor: "6264A7",
  summary: "Vellbase Event Notification",
  sections: [
    {
      activityTitle: "**{{event}}**",
      activitySubtitle: "via Vellbase Webhook",
      activityImage: "https://adaptivecards.io/content/cats/1.png",
      facts: [
        { name: "Environment", value: "Production" },
        { name: "Triggered", value: "{{timestamp}}" },
      ],
      text: "A new event has been received.",
    },
  ],
};

const DEFAULT_ADAPTIVE_TEMPLATE = {
  type: "AdaptiveCard",
  $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
  version: "1.4",
  body: [
    {
      type: "TextBlock",
      size: "Medium",
      weight: "Bolder",
      text: "{{event}}",
    },
    {
      type: "FactSet",
      facts: [
        { title: "Event:", value: "{{event}}" },
        { title: "Time:", value: "{{timestamp}}" },
      ],
    },
    {
      type: "Container",
      style: "emphasis",
      items: [
        {
          type: "TextBlock",
          text: "{{payloadSummary}}",
          wrap: true,
        },
      ],
    },
  ],
  actions: [
    {
      type: "Action.OpenUrl",
      title: "View in Vellbase",
      url: "https://app.vellbase.example.com",
    },
  ],
};

function summarizePayload(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload);
  if (keys.length === 0) return "No data attached";
  const entries = keys.slice(0, 4).map((k) => {
    const v = payload[k];
    const val = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `${k}: ${val.length > 40 ? val.slice(0, 40) + "…" : val}`;
  });
  return entries.join("\n");
}

function interpolate(tpl: unknown, vars: Record<string, string>): unknown {
  if (typeof tpl === "string") {
    return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
  }
  if (Array.isArray(tpl)) return tpl.map((x) => interpolate(x, vars));
  if (tpl && typeof tpl === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(tpl as Record<string, unknown>)) {
      out[k] = interpolate(v, vars);
    }
    return out;
  }
  return tpl;
}

export function TeamsCardPreview({
  cardType = "MESSAGE",
  template,
  sampleEvent = "user.created",
  samplePayload = {
    id: "usr_123",
    email: "john@example.com",
    name: "John Doe",
  },
  className,
}: TeamsCardPreviewProps) {
  const rendered = useMemo(() => {
    const vars: Record<string, string> = {
      event: sampleEvent,
      timestamp: new Date().toLocaleString(),
      payloadSummary: summarizePayload(samplePayload),
    };
    const base =
      template && Object.keys(template).length > 0
        ? template
        : cardType === "ADAPTIVE"
          ? DEFAULT_ADAPTIVE_TEMPLATE
          : DEFAULT_MESSAGE_TEMPLATE;
    return interpolate(base, vars) as Record<string, unknown>;
  }, [cardType, template, sampleEvent, samplePayload]);

  const firstSection = Array.isArray((rendered as any).sections)
    ? (rendered as any).sections[0]
    : null;
  const adaptiveBody = Array.isArray((rendered as any).body) ? (rendered as any).body : [];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-indigo-500" />
          <span className="text-sm font-medium">Teams Preview</span>
          <Badge variant="outline" className="text-[10px]">
            {cardType === "ADAPTIVE" ? "Adaptive Card" : "Message Card"}
          </Badge>
        </div>
        <Badge variant="secondary" className="text-[10px] gap-1">
          <Activity className="size-2.5" />
          {sampleEvent}
        </Badge>
      </div>

      <Card className="border-2 border-indigo-200/60 bg-gradient-to-b from-white to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/20 shadow-sm">
        <CardContent className="p-4 space-y-3">
          {cardType === "ADAPTIVE" ? (
            <>
              {adaptiveBody.slice(0, 4).map((blk: any, i: number) => {
                if (blk.type === "TextBlock") {
                  const isTitle = blk.weight === "Bolder" || blk.size === "Medium";
                  return (
                    <p
                      key={i}
                      className={cn(
                        "break-words",
                        isTitle
                          ? "text-base font-semibold text-foreground"
                          : "text-xs text-muted-foreground whitespace-pre-wrap",
                      )}
                    >
                      {blk.text}
                    </p>
                  );
                }
                if (blk.type === "FactSet") {
                  return (
                    <dl key={i} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      {blk.facts?.map((f: any, j: number) => (
                        <>
                          <dt key={`d-${j}`} className="font-medium text-muted-foreground">
                            {f.title}
                          </dt>
                          <dd key={`v-${j}`} className="font-mono break-all">
                            {f.value}
                          </dd>
                        </>
                      ))}
                    </dl>
                  );
                }
                if (blk.type === "Container") {
                  return (
                    <div
                      key={i}
                      className="rounded-md bg-muted/40 border border-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap"
                    >
                      {blk.items?.map((it: any, j: number) => (
                        <p key={j}>{it.text}</p>
                      ))}
                    </div>
                  );
                }
                return null;
              })}
              <div className="flex gap-2 pt-1 border-t border-indigo-100 dark:border-indigo-900/30">
                <button
                  type="button"
                  className="text-xs rounded-md bg-indigo-500 text-white px-3 py-1.5 hover:bg-indigo-600 transition-colors"
                >
                  View in Vellbase
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="grid size-10 place-items-center rounded-md bg-indigo-100 dark:bg-indigo-900/40 shrink-0">
                  <MessageSquare className="size-5 text-indigo-600 dark:text-indigo-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">
                    {firstSection?.activityTitle?.replace(/\*\*/g, "") ?? "Vellbase Notification"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {firstSection?.activitySubtitle ?? "via Vellbase Webhook"}
                  </p>
                </div>
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              </div>

              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs border-t border-indigo-100 dark:border-indigo-900/30 pt-2 mt-2">
                {firstSection?.facts?.map((f: any, i: number) => (
                  <>
                    <dt
                      key={`d-${i}`}
                      className="font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {f.name}
                    </dt>
                    <dd key={`v-${i}`} className="font-mono break-all">
                      {f.value}
                    </dd>
                  </>
                ))}
                {!firstSection?.facts?.length && (
                  <>
                    <dt className="font-medium text-muted-foreground">Event</dt>
                    <dd className="font-mono break-all">{sampleEvent}</dd>
                    <dt className="font-medium text-muted-foreground">Triggered</dt>
                    <dd className="font-mono break-all">{new Date().toLocaleString()}</dd>
                  </>
                )}
              </dl>

              {firstSection?.text && (
                <p className="text-xs text-muted-foreground rounded-md bg-muted/30 p-2">
                  {firstSection.text}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <AlertCircle className="size-3" />
        Preview is rendered locally. Actual Teams styling may differ slightly.
      </div>
    </div>
  );
}
