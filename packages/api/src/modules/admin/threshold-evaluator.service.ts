import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import type { AlertRule } from '@prisma/client';

type Operator = '>' | '<' | '>=' | '<=' | '==';

@Injectable()
export class ThresholdEvaluatorService {
  private readonly logger = new Logger(ThresholdEvaluatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Cron('* * * * *', { name: 'threshold_evaluator_minutely' })
  async evaluateAllRules() {
    const rules = await this.prisma.alertRule.findMany({ where: { enabled: true } });
    for (const rule of rules) {
      try {
        await this.evaluateRule(rule, false);
      } catch (e) {
        this.logger.error(`Rule ${rule.id} failed: ${(e as Error).message}`);
      }
    }
  }

  private getMetricValue(s: { latencyP50: number; latencyP95: number; latencyP99: number; utilization: number; errorRate: number; queueDepth?: number }, metric: string): number | null {
    switch (metric) {
      case 'latency-p50': return s.latencyP50;
      case 'latency-p95': return s.latencyP95;
      case 'latency-p99': return s.latencyP99;
      case 'utilization': return s.utilization;
      case 'error-rate':  return s.errorRate;
      case 'queue-depth': return s.queueDepth ?? null;
      default: return null;
    }
  }

  private compare(a: number, op: Operator, b: number): boolean {
    switch (op) {
      case '>':  return a >  b;
      case '<':  return a <  b;
      case '>=': return a >= b;
      case '<=': return a <= b;
      case '==': return a === b;
      default: return false;
    }
  }

  async evaluateRule(rule: AlertRule, dryRun: boolean): Promise<{ fired: boolean; value: number | null; reason: string }> {
    const since = new Date(Date.now() - rule.windowSeconds * 1000);
    const snaps = await this.prisma.systemMetricSnapshot.findMany({
      where: { service: rule.service, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    if (!snaps.length) return { fired: false, value: null, reason: 'no-data' };
    const values = snaps
      .map((s) => this.getMetricValue(s, rule.metric))
      .filter((v): v is number => v != null);
    if (!values.length) return { fired: false, value: null, reason: 'no-metric-values' };
    const agg = values.reduce((m, v) => Math.max(m, v), -Infinity);
    const op = rule.operator as Operator;
    const fired = this.compare(agg, op, rule.threshold);
    if (!fired || dryRun) return { fired, value: Number.isFinite(agg) ? agg : null, reason: fired ? 'would-fire' : 'within-threshold' };

    const cooldownPassed = !rule.lastFiredAt || (Date.now() - rule.lastFiredAt.getTime()) > rule.cooldownSeconds * 1000;
    if (!cooldownPassed) return { fired: false, value: Number.isFinite(agg) ? agg : null, reason: 'cooldown' };

    const value = Number.isFinite(agg) ? agg : null;
    const message = `${rule.service} ${rule.metric} ${op} ${rule.threshold} (actual=${(value ?? 0).toFixed(value != null && value < 1 ? 3 : 0)} window=${rule.windowSeconds}s)`;

    const alert = await this.prisma.alert.create({
      data: {
        ruleId: rule.id, service: rule.service, severity: rule.severity, message,
        value, threshold: rule.threshold,
      },
    });

    await this.prisma.alertRule.update({ where: { id: rule.id }, data: { lastFiredAt: new Date() } });

    this.dispatchChannels(rule, alert).catch((e) => this.logger.warn(`channel dispatch rule=${rule.id}: ${(e as Error).message}`));

    try {
      await this.cache.publish?.('admin:status:alerts', JSON.stringify({ type: 'alert', alert }));
    } catch { /* ignore pub sub failures */ }

    // Incident auto-rollup: 3+ same (service,severity) alerts in 1h
    const hourAgo = new Date(Date.now() - 3600_000);
    const sameServiceSeverityCount = await this.prisma.alert.count({
      where: { service: rule.service, severity: rule.severity, createdAt: { gte: hourAgo } },
    });
    if (sameServiceSeverityCount >= 3) {
      const openIncident = await this.prisma.incident.findFirst({
        where: { service: rule.service, severity: rule.severity, resolvedAt: null },
        orderBy: { startedAt: 'desc' },
      });
      if (!openIncident) {
        await this.prisma.incident.create({
          data: {
            title: `${rule.severity.toUpperCase()}: ${rule.service} ${rule.metric} sustained breach`,
            severity: rule.severity, service: rule.service,
            startedAt: hourAgo, detectedAt: new Date(),
            alerts: { connect: { id: alert.id } },
          },
        });
      } else {
        await this.prisma.incident.update({
          where: { id: openIncident.id },
          data: { alerts: { connect: { id: alert.id } } },
        });
      }
    }
    return { fired: true, value, reason: 'fired' };
  }

  private async dispatchChannels(rule: AlertRule, alert: { id: string; severity: string; message: string }) {
    const channels = (rule.channels as any) ?? {};
    if (channels.email) this.logger.log(`[CHANNEL email] alert ${alert.id}: ${alert.message}`);
    const headers = { 'Content-Type': 'application/json', 'X-Vellbase-Test': rule.lastFiredAt ? '0' : '1' };
    if (typeof channels.teams === 'string' && channels.teams.length > 0) {
      try { await fetch(channels.teams, { method: 'POST', headers, body: JSON.stringify({ text: `[Vellbase alert] ${alert.message}` }) }); } catch {/* noop */}
    }
    if (typeof channels.slack === 'string' && channels.slack.length > 0) {
      try { await fetch(channels.slack, { method: 'POST', headers, body: JSON.stringify({ text: `[Vellbase alert] ${alert.message}` }) }); } catch {/* noop */}
    }
  }

  async testRule(rule: AlertRule): Promise<{ fired: boolean; value: number | null; reason: string; channels: Array<{ name: string; ok: boolean; error?: string }> }> {
    const evalResult = await this.evaluateRule(rule, true);
    const channels = (rule.channels as any) ?? {};
    const results: Array<{ name: string; ok: boolean; error?: string }> = [];
    if (channels.dashboard) results.push({ name: 'dashboard', ok: true });
    if (channels.email)     results.push({ name: 'email', ok: true });
    const headers = { 'Content-Type': 'application/json', 'X-Vellbase-Test': '1' };
    if (typeof channels.teams === 'string' && channels.teams.length > 0) {
      try { await fetch(channels.teams, { method: 'POST', headers, body: JSON.stringify({ text: `[Vellbase TEST] test alert rule ${rule.id}` }) }); results.push({ name: 'teams', ok: true }); }
      catch (e) { results.push({ name: 'teams', ok: false, error: (e as Error).message }); }
    }
    if (typeof channels.slack === 'string' && channels.slack.length > 0) {
      try { await fetch(channels.slack, { method: 'POST', headers, body: JSON.stringify({ text: `[Vellbase TEST] test alert rule ${rule.id}` }) }); results.push({ name: 'slack', ok: true }); }
      catch (e) { results.push({ name: 'slack', ok: false, error: (e as Error).message }); }
    }
    return { ...evalResult, channels: results };
  }

  async bulkAcknowledge(ids: string[], adminId: string): Promise<number> {
    const r = await this.prisma.alert.updateMany({
      where: { id: { in: ids }, acknowledgedAt: null },
      data: { acknowledgedAt: new Date(), acknowledgedById: adminId },
    });
    await this.logActivity(adminId, 'alert.bulk-ack', 'Alert', { count: r.count, ids });
    return r.count;
  }

  async bulkSnooze(ids: string[], adminId: string, until: Date): Promise<number> {
    const r = await this.prisma.alert.updateMany({
      where: { id: { in: ids }, closedAt: null },
      data: { snoozedUntil: until },
    });
    await this.logActivity(adminId, 'alert.bulk-snooze', 'Alert', { count: r.count, ids, until: until.toISOString() });
    return r.count;
  }

  async closeAlert(id: string, adminId: string, closeNote: string) {
    const updated = await this.prisma.alert.update({
      where: { id }, data: { closedAt: new Date(), closedById: adminId, closeNote },
    });
    await this.logActivity(adminId, 'alert.close', 'Alert', { id, closeNote });
    if (updated.incidentId) {
      const remain = await this.prisma.alert.count({ where: { incidentId: updated.incidentId, closedAt: null } });
      if (remain === 0) {
        await this.prisma.incident.update({ where: { id: updated.incidentId }, data: { resolvedAt: new Date() } });
      }
    }
    return updated;
  }

  private async logActivity(userId: string, action: string, entityType: string, details: Record<string, unknown>) {
    try {
      await this.prisma.activityLog.create({
        data: { userId, action, entityType, details: details as any },
      });
    } catch { /* ignore */ }
  }
}
