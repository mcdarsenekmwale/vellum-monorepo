"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RoleSelect } from "@/components/dashboard/users_action_components";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useCreateRoleRequest, useRoleRequests, type RoleRequestType } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  Clock,
  Send,
  CalendarDays,
  History,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_app/roles/request")({
  head: () => ({
    meta: [{ title: "Request Role · Vellum" }],
  }),
  component: RoleRequestPage,
});

const JUSTIFICATION_MIN_LENGTH = 5;
const JUSTIFICATION_MAX_LENGTH = 500;

function RoleRequestPage() {
  const { user } = useAuth();
  const createRoleRequest = useCreateRoleRequest();

  const [requestedRoleKey, setRequestedRoleKey] = useState<string>("");
  const [requestType, setRequestType] = useState<RoleRequestType>("PERMANENT");
  const [startsAt, setStartsAt] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [expiresAt, setExpiresAt] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [justification, setJustification] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const myRequests = useRoleRequests({
    requesterId: user?.id,
    page: 1,
    limit: 50,
  });

  const validate = (): boolean => {
    const next: Record<string, string | undefined> = {};

    if (!requestedRoleKey) {
      next.role = "Please select a role to request";
    }

    if (justification.trim().length < JUSTIFICATION_MIN_LENGTH) {
      next.justification = `Justification must be at least ${JUSTIFICATION_MIN_LENGTH} characters`;
    }

    if (requestType === "TEMPORARY") {
      if (!startsAt) {
        next.startsAt = "Start date is required";
      }
      if (!expiresAt) {
        next.expiresAt = "Expiry date is required";
      }
      if (startsAt && expiresAt) {
        const start = new Date(startsAt).getTime();
        const end = new Date(expiresAt).getTime();
        const now = Date.now();
        const THIRTY_MIN_MS = 30 * 60 * 1000;

        if (end - start < THIRTY_MIN_MS) {
          next.expiresAt = "Expiry must be at least 30 minutes after the start time";
        }
        if (end <= now) {
          next.expiresAt = "Expiry must be in the future";
        }
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: Parameters<typeof createRoleRequest.mutateAsync>[0] = {
      requestedRoleKey,
      type: requestType,
      justification: justification.trim(),
    };

    if (requestType === "TEMPORARY") {
      payload.startsAt = new Date(startsAt).toISOString();
      payload.expiresAt = new Date(expiresAt).toISOString();
    }

    try {
      await createRoleRequest.mutateAsync(payload);
      toast.success("Role request submitted", {
        description: "An admin will review your request shortly.",
        icon: <CheckCircle2 className="size-4" />,
      });
      setJustification("");
      setRequestedRoleKey("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit request";
      toast.error("Submission failed", {
        description: msg,
        icon: <AlertCircle className="size-4" />,
      });
    }
  };

  const justificationCount = justification.length;
  const justificationValid = justification.trim().length >= JUSTIFICATION_MIN_LENGTH;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-0 sm:px-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Request a role or permission change
        </h1>
        <p className="text-sm text-muted-foreground">
          Submit a formal request for an elevated role or temporary access. Administrators will
          review your justification and respond as soon as possible.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">New role request</CardTitle>
              <CardDescription className="text-xs">
                All fields marked with <span className="text-rose-500">*</span> are required
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Role picker */}
            <div className="space-y-2">
              <Label
                htmlFor="role-select"
                className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                <ShieldCheck className="size-3.5" />
                Requested role <span className="text-rose-500 normal-case tracking-normal">*</span>
              </Label>
              <RoleSelect
                value={requestedRoleKey}
                onValueChange={(v) => {
                  setRequestedRoleKey(v);
                  setErrors((p) => ({ ...p, role: undefined }));
                }}
              />
              {errors.role && (
                <p className="flex items-center gap-1 text-xs text-rose-500">
                  <AlertCircle className="size-3" /> {errors.role}
                </p>
              )}
            </div>

            {/* Request type */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Clock className="size-3.5" />
                Access type <span className="text-rose-500 normal-case tracking-normal">*</span>
              </Label>
              <RadioGroup
                value={requestType}
                onValueChange={(v) => setRequestType(v as RoleRequestType)}
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                <div>
                  <RadioGroupItem value="PERMANENT" id="type-permanent" className="peer sr-only" />
                  <Label
                    htmlFor="type-permanent"
                    className={cn(
                      "flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all",
                      "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5",
                      "hover:bg-muted/50",
                    )}
                  >
                    <span className="text-sm font-medium">Permanent</span>
                    <span className="text-xs text-muted-foreground">
                      Ongoing role assignment until changed
                    </span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="TEMPORARY" id="type-temporary" className="peer sr-only" />
                  <Label
                    htmlFor="type-temporary"
                    className={cn(
                      "flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all",
                      "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5",
                      "hover:bg-muted/50",
                    )}
                  >
                    <span className="text-sm font-medium">Temporary</span>
                    <span className="text-xs text-muted-foreground">
                      Time-bound access with start and expiry dates
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Date range (temporary only) */}
            {requestType === "TEMPORARY" && (
              <div className="grid gap-4 rounded-lg border border-dashed p-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="starts-at"
                    className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    <CalendarDays className="size-3.5" />
                    Starts at <span className="text-rose-500 normal-case tracking-normal">*</span>
                  </Label>
                  <Input
                    id="starts-at"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => {
                      setStartsAt(e.target.value);
                      setErrors((p) => ({ ...p, startsAt: undefined }));
                    }}
                    className="focus-visible:ring-offset-0"
                  />
                  {errors.startsAt && (
                    <p className="flex items-center gap-1 text-xs text-rose-500">
                      <AlertCircle className="size-3" /> {errors.startsAt}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="expires-at"
                    className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    <CalendarDays className="size-3.5" />
                    Expires at <span className="text-rose-500 normal-case tracking-normal">*</span>
                  </Label>
                  <Input
                    id="expires-at"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => {
                      setExpiresAt(e.target.value);
                      setErrors((p) => ({ ...p, expiresAt: undefined }));
                    }}
                    className="focus-visible:ring-offset-0"
                  />
                  {errors.expiresAt && (
                    <p className="flex items-center gap-1 text-xs text-rose-500">
                      <AlertCircle className="size-3" /> {errors.expiresAt}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Justification */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="justification"
                  className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Business justification{" "}
                  <span className="text-rose-500 normal-case tracking-normal">*</span>
                </Label>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    justificationCount > JUSTIFICATION_MAX_LENGTH
                      ? "text-rose-500"
                      : justificationValid
                        ? "text-muted-foreground"
                        : "text-muted-foreground/70",
                  )}
                >
                  {justificationCount} / {JUSTIFICATION_MAX_LENGTH}
                </span>
              </div>
              <Textarea
                id="justification"
                value={justification}
                onChange={(e) => {
                  setJustification(e.target.value.slice(0, JUSTIFICATION_MAX_LENGTH));
                  setErrors((p) => ({ ...p, justification: undefined }));
                }}
                rows={5}
                placeholder={
                  "Please explain the business case for this role change. Include:\n• What tasks or projects require this access?\n• Which teams or stakeholders are affected?\n• Any relevant dates or deadlines."
                }
                className={cn(
                  "resize-none focus-visible:ring-offset-0",
                  errors.justification && "border-rose-500 focus-visible:ring-rose-500",
                )}
              />
              {errors.justification ? (
                <p className="flex items-center gap-1 text-xs text-rose-500">
                  <AlertCircle className="size-3" /> {errors.justification}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Minimum {JUSTIFICATION_MIN_LENGTH} characters. Be specific so admins can review
                  quickly.
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex-col-reverse gap-2 border-t sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRequestedRoleKey("");
                setRequestType("PERMANENT");
                setJustification("");
                setErrors({});
              }}
              disabled={createRoleRequest.isPending}
            >
              Reset
            </Button>
            <Button type="submit" disabled={createRoleRequest.isPending} className="gap-2">
              {createRoleRequest.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Submit request
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Past requests */}
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-muted">
              <History className="size-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Your request history</CardTitle>
              <CardDescription className="text-xs">
                Recent role requests you have submitted
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {myRequests.isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading requests...
            </div>
          ) : myRequests.isError ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-rose-500">
              <AlertCircle className="size-4" />
              Failed to load request history
            </div>
          ) : !myRequests.data?.data || myRequests.data.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <History className="size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">No past requests</p>
              <p className="text-xs text-muted-foreground/70">
                Your submitted requests will appear here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-6 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Submitted
                    </th>
                    <th className="px-2 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Role
                    </th>
                    <th className="px-2 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Type
                    </th>
                    <th className="px-6 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.data.data.map((req) => (
                    <tr key={req.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-3 align-top text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatDate(req.createdAt)}
                      </td>
                      <td className="px-2 py-3 align-top">
                        <span className="text-xs font-medium text-foreground">
                          {formatRoleKey(req.requestedRoleKey)}
                        </span>
                      </td>
                      <td className="px-2 py-3 align-top">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                            req.type === "PERMANENT"
                              ? "bg-primary/10 text-primary"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-500",
                          )}
                        >
                          {req.type === "PERMANENT" ? "Permanent" : "Temporary"}
                        </span>
                      </td>
                      <td className="px-6 py-3 align-top text-right">
                        <StatusBadge status={req.status.toLowerCase()} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatRoleKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
