import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Flame, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIncidents, useStatusRealtime } from "@/lib/api/hooks";
import { updateIncident } from "@/lib/api/services";
import type { Incident, Severity } from "@/lib/api/services";

const SEV_BORDER: Record<Severity, string> = {
  critical: "border-l-rose-500",
  warning: "border-l-amber-500",
  info: "border-l-sky-500",
};
const SEV_DOT: Record<Severity, string> = {
  critical: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

function fmt(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Dot({
  label,
  iso,
  color,
}: {
  label: string;
  iso?: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-2 min-w-[130px]">
      <div
        className={cn(
          "h-2.5 w-2.5 rounded-full mt-1.5 ring-4 ring-background",
          iso ? color : "bg-muted",
        )}
      />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-xs tabular-nums">{fmt(iso)}</div>
      </div>
    </div>
  );
}

function IncidentRow({ inc }: { inc: Incident }) {
  const qc = useQueryClient();
  const [summary, setSummary] = useState(inc.summary ?? "");
  const [postmortem, setPostmortem] = useState(inc.postmortemUrl ?? "");
  const mut = useMutation({
    mutationFn: (patch: Partial<Incident>) => updateIncident(inc.id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "status", "incidents"] });
      toast.success("Incident updated");
    },
    onError: (e: any) =>
      toast.error("Save failed", { description: e?.message }),
  });

  return (
    <AccordionItem
      value={inc.id}
      className={cn(
        "border-l-4 pl-4 mb-4 rounded-r-xl border bg-background shadow-sm",
        SEV_BORDER[inc.severity],
      )}
    >
      <div className="flex items-start gap-2 pr-3 pt-3">
        <div
          className={cn(
            "h-6 w-6 rounded-full grid place-items-center text-white shrink-0",
            SEV_DOT[inc.severity],
          )}
        >
          <Flame className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="font-semibold truncate">{inc.title}</div>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {inc.service} • {inc.severity}
            </span>
            {inc._count?.alerts ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {inc._count.alerts} alerts
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 pb-2">
            <Dot
              label="Start"
              iso={inc.startedAt}
              color={SEV_DOT[inc.severity]}
            />
            <Dot label="Detect" iso={inc.detectedAt} color="bg-slate-500" />
            <Dot label="Ack" iso={inc.acknowledgedAt} color="bg-indigo-500" />
            <Dot label="Resolve" iso={inc.resolvedAt} color="bg-emerald-500" />
          </div>
        </div>
        <AccordionTrigger className="w-auto justify-self-end pt-1 hover:no-underline" />
      </div>
      <AccordionContent className="pr-4 pb-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Summary</Label>
          <Textarea
            rows={4}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Timeline, impact, root cause, lessons learned."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Postmortem URL</Label>
          <div className="flex gap-2">
            <Input
              value={postmortem}
              onChange={(e) => setPostmortem(e.target.value)}
              placeholder="https://confluence…"
            />
            {postmortem && (
              <Button asChild variant="outline" size="sm">
                <a href={postmortem} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => mut.mutate({ summary, postmortemUrl: postmortem })}
            disabled={mut.isPending}
          >
            {mut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Save
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function StatusIncidentTimeline() {
  const inc = useIncidents(30);
  const status = useStatusRealtime();
  const items = inc.data ?? [];
  return (
    <section className="rounded-xl border shadow-sm p-4 md:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div>
          <h2 className="text-base font-semibold">Incidents (30d)</h2>
          <p className="text-xs text-muted-foreground">
            Auto-rolled up from 3+ same-bucket alerts. Updated{" "}
            {status.data?.updatedAt ? fmt(status.data.updatedAt) : "…"}
          </p>
        </div>
      </header>
      {inc.isLoading && (
        <div className="text-sm text-muted-foreground py-6 text-center">
          Loading incidents…
        </div>
      )}
      {!inc.isLoading && items.length === 0 && (
        <div className="text-center py-10">
          <div className="mx-auto h-10 w-10 rounded-full bg-emerald-500/10 grid place-items-center text-emerald-600 mb-3">
            <Flame className="h-5 w-5" />
          </div>
          <div className="text-sm font-medium">
            No incidents in the last 30 days
          </div>
          <div className="text-xs text-muted-foreground">
            That&apos;s great — keep it going!
          </div>
        </div>
      )}
      <Accordion type="multiple" className="w-full border-none">
        {items.map((i) => (
          <IncidentRow key={i.id} inc={i} />
        ))}
      </Accordion>
    </section>
  );
}
