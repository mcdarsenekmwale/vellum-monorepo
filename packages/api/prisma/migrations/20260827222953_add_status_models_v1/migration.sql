-- CreateTable
CREATE TABLE "system_metric_snapshots" (
    "id" UUID NOT NULL,
    "service" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyP50" INTEGER NOT NULL DEFAULT 0,
    "latencyP95" INTEGER NOT NULL DEFAULT 0,
    "latencyP99" INTEGER NOT NULL DEFAULT 0,
    "utilization" INTEGER NOT NULL DEFAULT 0,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "queueDepth" INTEGER,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" UUID NOT NULL,
    "service" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "windowSeconds" INTEGER NOT NULL DEFAULT 120,
    "severity" TEXT NOT NULL,
    "channels" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 600,
    "lastFiredAt" TIMESTAMP(3),
    "createdById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "ruleId" UUID,
    "service" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" UUID,
    "snoozedUntil" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedById" UUID,
    "closeNote" TEXT,
    "incidentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "postmortemUrl" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_metric_snapshots_service_createdAt_idx" ON "system_metric_snapshots"("service", "createdAt");

-- CreateIndex
CREATE INDEX "alert_rules_service_enabled_idx" ON "alert_rules"("service", "enabled");

-- CreateIndex
CREATE INDEX "alerts_service_createdAt_idx" ON "alerts"("service", "createdAt");

-- CreateIndex
CREATE INDEX "alerts_severity_createdAt_idx" ON "alerts"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "incidents_service_startedAt_idx" ON "incidents"("service", "startedAt");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "alert_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
