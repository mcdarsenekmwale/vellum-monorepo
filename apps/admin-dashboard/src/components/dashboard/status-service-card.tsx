import type { ProbeResult, ServiceName, ServiceStatus } from "@/lib/api/services";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AlertTriangle, HardDrive, Server, Webhook, Zap } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { RadialGauge } from "./charts";
import { cn } from "@/lib/utils";

const META: Record<ServiceName, { title: string; Icon: any; unit: string }> = {
  database: { title: "Database", Icon: Server, unit: "conns" },
  api: { title: "API Gateway", Icon: Zap, unit: "%" },
  redis: { title: "Redis", Icon: Zap, unit: "%" },
  storage: { title: "Object Storage", Icon: HardDrive, unit: "%" },
  webhooks: { title: "Webhooks", Icon: Webhook, unit: "%" },
};

const STATUS_BADGE: Record<ServiceStatus, string> = {
  healthy: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  degraded: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  down: "bg-rose-500/10 text-rose-600 border-rose-500/30",
};

function Spark({ data }: { data: ProbeResult[] }) {
  const rows = data.map((p, i) => ({ i, p95: p.latencyP95 }));
  return (
    <div className="h-14 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={rows}
          margin={{ top: 2, right: 2, left: 2, bottom: 0 }}
        >
          <defs>
            <linearGradient id="svc-spark" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="hsl(var(--chart-1))"
                stopOpacity={0.55}
              />
              <stop
                offset="100%"
                stopColor="hsl(var(--chart-1))"
                stopOpacity={0.05}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border))"
            strokeDasharray="3 3"
          />
          <XAxis hide dataKey="i" />
          <Tooltip
            cursor={false}
            contentStyle={{ borderRadius: 8, fontSize: 11 }}
            formatter={(v: any) => [`${v} ms`, "p95 latency"]}
            labelFormatter={() => ""}
          />
          <Area
            type="monotone"
            dataKey="p95"
            stroke="hsl(var(--chart-1))"
            fill="url(#svc-spark)"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusServiceCard({
  service,
  current,
  spark,
  events,
}: {
  service: ServiceName;
  current: ProbeResult;
  spark: ProbeResult[];
  events: Array<{
    id: string;
    severity: string;
    message: string;
    createdAt: string;
  }>;
}) {
  const meta = META[service];
  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <meta.Icon className="h-4 w-4 text-chart-1" /> {meta.title}
        </CardTitle>
        <Badge
          variant="outline"
          className={cn("capitalize text-[11px]", STATUS_BADGE[current.status])}
        >
          {current.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <RadialGauge
            value={current.utilization}
            label={service === "database" ? "Load" : "Util"}
            unit={meta.unit}
          />
          <div className="min-w-0 flex-1">
            <Spark data={spark} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
          {(["latencyP50", "latencyP95", "latencyP99"] as const).map((k, i) => (
            <div key={k}>
              <div className="text-muted-foreground">
                {["p50", "p95", "p99"][i]}
              </div>
              <div className="font-semibold tabular-nums">
                {current[k]}
                <span className="text-muted-foreground text-[10px]">ms</span>
              </div>
            </div>
          ))}
        </div>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="events" className="border-b-0">
            <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline">
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Recent {events.length}{" "}
                events
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2">
              {events.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  No recent events. All nominal.
                </div>
              )}
              {events.map((e) => (
                <div
                  key={e.id}
                  className="rounded-md border bg-muted/20 p-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] capitalize",
                        e.severity === "critical"
                          ? STATUS_BADGE.down
                          : e.severity === "warning"
                            ? STATUS_BADGE.degraded
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {e.severity}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(e.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-1 break-words leading-snug">
                    {e.message}
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
