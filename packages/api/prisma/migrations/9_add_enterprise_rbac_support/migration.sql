-- Enterprise RBAC + Support Center migration

-- Enums
CREATE TYPE "TicketType" AS ENUM ('CUSTOMER', 'INTERNAL', 'BUG_REPORT', 'FEATURE_REQUEST', 'TECHNICAL', 'BILLING', 'ABUSE', 'MODERATION');
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY');
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'WAITING_ON_INTERNAL', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED');
CREATE TYPE "AgentStatus" AS ENUM ('ONLINE', 'BUSY', 'AWAY', 'OFFLINE');

-- RBAC tables
CREATE TABLE "PermissionGroup" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PermissionGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "groupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RbacRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "RbacRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoleAssignmentHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "assignedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoleAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- Support tables
CREATE TABLE "SupportDepartment" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "SupportDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "SupportTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportAgent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "teamId" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'OFFLINE',
    "maxTickets" INTEGER NOT NULL DEFAULT 10,
    "activeTickets" INTEGER NOT NULL DEFAULT 0,
    "skills" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "vacationUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "SupportAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TicketCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketTagAssignment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "TicketTagAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketInternalNote" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TicketInternalNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketAssignment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "TicketAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketStatusHistory" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fromStatus" "TicketStatus",
    "toStatus" "TicketStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketWatcher" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketWatcher_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SlaPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT,
    "priority" "TicketPriority" NOT NULL,
    "firstResponseMinutes" INTEGER NOT NULL,
    "resolutionMinutes" INTEGER NOT NULL,
    "escalationMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EscalationRule" (
    "id" TEXT NOT NULL,
    "slaPolicyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerAfterMinutes" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "targetRole" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EscalationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CannedResponse" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "shortcut" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "CannedResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HelpArticleVersion" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT[],
    "authorId" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HelpArticleVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- Migrate SupportTicket: add new columns
ALTER TABLE "SupportTicket" ADD COLUMN "ticketNumber" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN "description" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN "type" "TicketType" NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE "SupportTicket" ADD COLUMN "assigneeId" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN "slaPolicyId" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN "dueAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN "firstResponseAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN "reopenedAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN "satisfaction" INTEGER;
ALTER TABLE "SupportTicket" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SupportTicket" ADD COLUMN "metadata" JSONB;
ALTER TABLE "SupportTicket" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Generate ticket numbers for existing rows
UPDATE "SupportTicket" st
SET "ticketNumber" = 'TKT-' || LPAD(sub.rn::TEXT, 6, '0')
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt") AS rn
  FROM "SupportTicket"
  WHERE "ticketNumber" IS NULL
) sub
WHERE st.id = sub.id;
ALTER TABLE "SupportTicket" ALTER COLUMN "ticketNumber" SET NOT NULL;

-- Migrate priority/status to enums
ALTER TABLE "SupportTicket" ADD COLUMN "priority_new" "TicketPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "SupportTicket" ADD COLUMN "status_new" "TicketStatus" NOT NULL DEFAULT 'NEW';

UPDATE "SupportTicket" SET "priority_new" = CASE
  WHEN LOWER("priority") = 'low' THEN 'LOW'::"TicketPriority"
  WHEN LOWER("priority") = 'high' THEN 'HIGH'::"TicketPriority"
  WHEN LOWER("priority") = 'critical' THEN 'CRITICAL'::"TicketPriority"
  WHEN LOWER("priority") = 'emergency' THEN 'EMERGENCY'::"TicketPriority"
  ELSE 'MEDIUM'::"TicketPriority"
END;

UPDATE "SupportTicket" SET "status_new" = CASE
  WHEN LOWER("status") = 'open' THEN 'NEW'::"TicketStatus"
  WHEN LOWER("status") = 'assigned' THEN 'ASSIGNED'::"TicketStatus"
  WHEN LOWER("status") = 'in_progress' THEN 'IN_PROGRESS'::"TicketStatus"
  WHEN LOWER("status") = 'waiting_on_customer' THEN 'WAITING_ON_CUSTOMER'::"TicketStatus"
  WHEN LOWER("status") = 'waiting_on_internal' THEN 'WAITING_ON_INTERNAL'::"TicketStatus"
  WHEN LOWER("status") = 'escalated' THEN 'ESCALATED'::"TicketStatus"
  WHEN LOWER("status") = 'resolved' THEN 'RESOLVED'::"TicketStatus"
  WHEN LOWER("status") = 'closed' THEN 'CLOSED'::"TicketStatus"
  WHEN LOWER("status") = 'reopened' THEN 'REOPENED'::"TicketStatus"
  ELSE 'NEW'::"TicketStatus"
END;

ALTER TABLE "SupportTicket" DROP COLUMN "priority";
ALTER TABLE "SupportTicket" DROP COLUMN "status";
ALTER TABLE "SupportTicket" RENAME COLUMN "priority_new" TO "priority";
ALTER TABLE "SupportTicket" RENAME COLUMN "status_new" TO "status";

-- Unique constraints
CREATE UNIQUE INDEX "PermissionGroup_key_key" ON "PermissionGroup"("key");
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
CREATE UNIQUE INDEX "RbacRole_key_key" ON "RbacRole"("key");
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");
CREATE UNIQUE INDEX "UserRoleAssignment_userId_roleId_key" ON "UserRoleAssignment"("userId", "roleId");
CREATE UNIQUE INDEX "UserPermissionOverride_userId_permissionId_key" ON "UserPermissionOverride"("userId", "permissionId");
CREATE UNIQUE INDEX "SupportDepartment_key_key" ON "SupportDepartment"("key");
CREATE UNIQUE INDEX "SupportAgent_userId_key" ON "SupportAgent"("userId");
CREATE UNIQUE INDEX "TicketCategory_key_key" ON "TicketCategory"("key");
CREATE UNIQUE INDEX "TicketTag_name_key" ON "TicketTag"("name");
CREATE UNIQUE INDEX "TicketTagAssignment_ticketId_tagId_key" ON "TicketTagAssignment"("ticketId", "tagId");
CREATE UNIQUE INDEX "TicketWatcher_ticketId_userId_key" ON "TicketWatcher"("ticketId", "userId");
CREATE UNIQUE INDEX "CannedResponse_shortcut_key" ON "CannedResponse"("shortcut");
CREATE UNIQUE INDEX "HelpArticleVersion_articleId_version_key" ON "HelpArticleVersion"("articleId", "version");
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");

-- Indexes
CREATE INDEX "Permission_groupId_idx" ON "Permission"("groupId");
CREATE INDEX "RbacRole_isSystem_idx" ON "RbacRole"("isSystem");
CREATE INDEX "RbacRole_parentId_idx" ON "RbacRole"("parentId");
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");
CREATE INDEX "UserRoleAssignment_userId_idx" ON "UserRoleAssignment"("userId");
CREATE INDEX "UserRoleAssignment_roleId_idx" ON "UserRoleAssignment"("roleId");
CREATE INDEX "UserRoleAssignment_expiresAt_idx" ON "UserRoleAssignment"("expiresAt");
CREATE INDEX "UserPermissionOverride_userId_idx" ON "UserPermissionOverride"("userId");
CREATE INDEX "UserPermissionOverride_permissionId_idx" ON "UserPermissionOverride"("permissionId");
CREATE INDEX "RoleAssignmentHistory_userId_idx" ON "RoleAssignmentHistory"("userId");
CREATE INDEX "RoleAssignmentHistory_roleId_idx" ON "RoleAssignmentHistory"("roleId");
CREATE INDEX "SupportTeam_departmentId_idx" ON "SupportTeam"("departmentId");
CREATE INDEX "SupportAgent_departmentId_idx" ON "SupportAgent"("departmentId");
CREATE INDEX "SupportAgent_teamId_idx" ON "SupportAgent"("teamId");
CREATE INDEX "SupportAgent_status_idx" ON "SupportAgent"("status");
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");
CREATE INDEX "TicketMessage_authorId_idx" ON "TicketMessage"("authorId");
CREATE INDEX "TicketInternalNote_ticketId_idx" ON "TicketInternalNote"("ticketId");
CREATE INDEX "TicketAttachment_ticketId_idx" ON "TicketAttachment"("ticketId");
CREATE INDEX "TicketAssignment_ticketId_idx" ON "TicketAssignment"("ticketId");
CREATE INDEX "TicketAssignment_agentId_idx" ON "TicketAssignment"("agentId");
CREATE INDEX "TicketStatusHistory_ticketId_idx" ON "TicketStatusHistory"("ticketId");
CREATE INDEX "SlaPolicy_departmentId_idx" ON "SlaPolicy"("departmentId");
CREATE INDEX "SlaPolicy_priority_idx" ON "SlaPolicy"("priority");
CREATE INDEX "EscalationRule_slaPolicyId_idx" ON "EscalationRule"("slaPolicyId");
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");
CREATE INDEX "SupportTicket_assigneeId_idx" ON "SupportTicket"("assigneeId");
CREATE INDEX "SupportTicket_departmentId_idx" ON "SupportTicket"("departmentId");
CREATE INDEX "SupportTicket_categoryId_idx" ON "SupportTicket"("categoryId");
CREATE INDEX "SupportTicket_deletedAt_idx" ON "SupportTicket"("deletedAt");

-- Foreign keys
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PermissionGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RbacRole" ADD CONSTRAINT "RbacRole_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RbacRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RbacRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RbacRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleAssignmentHistory" ADD CONSTRAINT "RoleAssignmentHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleAssignmentHistory" ADD CONSTRAINT "RoleAssignmentHistory_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RbacRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTeam" ADD CONSTRAINT "SupportTeam_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "SupportDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportAgent" ADD CONSTRAINT "SupportAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportAgent" ADD CONSTRAINT "SupportAgent_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "SupportDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportAgent" ADD CONSTRAINT "SupportAgent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SupportTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TicketTagAssignment" ADD CONSTRAINT "TicketTagAssignment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketTagAssignment" ADD CONSTRAINT "TicketTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "TicketTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketInternalNote" ADD CONSTRAINT "TicketInternalNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketInternalNote" ADD CONSTRAINT "TicketInternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketAssignment" ADD CONSTRAINT "TicketAssignment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketAssignment" ADD CONSTRAINT "TicketAssignment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketWatcher" ADD CONSTRAINT "TicketWatcher_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "SupportDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EscalationRule" ADD CONSTRAINT "EscalationRule_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "SlaPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HelpArticleVersion" ADD CONSTRAINT "HelpArticleVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "SupportDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "SlaPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
