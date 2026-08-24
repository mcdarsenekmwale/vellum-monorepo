-- Migration: Access Control Center tables
-- Creates: AccessRequest, AccessRequestEvent, ResourcePermission, UserResourceAccess
-- Also creates enum types AccessRequestStatus, AccessRequestType

-- Enum types
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "AccessRequestType" AS ENUM ('PERMANENT', 'TEMPORARY');

-- AccessRequest table
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "permissionKey" TEXT NOT NULL,
    "type" "AccessRequestType" NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "justification" TEXT NOT NULL,
    "adminJustification" TEXT,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- AccessRequestEvent table
CREATE TABLE "AccessRequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT,
    "transition" "AccessRequestStatus" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRequestEvent_pkey" PRIMARY KEY ("id")
);

-- ResourcePermission table
CREATE TABLE "ResourcePermission" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "permissionName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourcePermission_pkey" PRIMARY KEY ("id")
);

-- UserResourceAccess table
CREATE TABLE "UserResourceAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "permissionKey" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserResourceAccess_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "AccessRequest_requesterId_idx" ON "AccessRequest"("requesterId");
CREATE INDEX "AccessRequest_reviewerId_idx" ON "AccessRequest"("reviewerId");
CREATE INDEX "AccessRequest_status_idx" ON "AccessRequest"("status");
CREATE INDEX "AccessRequest_type_idx" ON "AccessRequest"("type");
CREATE INDEX "AccessRequest_resourceType_idx" ON "AccessRequest"("resourceType");
CREATE INDEX "AccessRequest_permissionKey_idx" ON "AccessRequest"("permissionKey");
CREATE INDEX "AccessRequest_createdAt_idx" ON "AccessRequest"("createdAt");
CREATE INDEX "AccessRequest_expiresAt_idx" ON "AccessRequest"("expiresAt");

CREATE INDEX "AccessRequestEvent_requestId_idx" ON "AccessRequestEvent"("requestId");
CREATE INDEX "AccessRequestEvent_actorId_idx" ON "AccessRequestEvent"("actorId");
CREATE INDEX "AccessRequestEvent_createdAt_idx" ON "AccessRequestEvent"("createdAt");

CREATE INDEX "ResourcePermission_resourceType_idx" ON "ResourcePermission"("resourceType");
CREATE UNIQUE INDEX "ResourcePermission_permissionKey_key" ON "ResourcePermission"("permissionKey");

CREATE INDEX "UserResourceAccess_userId_idx" ON "UserResourceAccess"("userId");
CREATE INDEX "UserResourceAccess_resourceType_idx" ON "UserResourceAccess"("resourceType");
CREATE INDEX "UserResourceAccess_permissionKey_idx" ON "UserResourceAccess"("permissionKey");
CREATE INDEX "UserResourceAccess_expiresAt_idx" ON "UserResourceAccess"("expiresAt");
CREATE UNIQUE INDEX "UserResourceAccess_user_resource_perm_unique" ON "UserResourceAccess"("userId", "resourceType", "permissionKey");

-- Unique constraint on AccessRequest
CREATE UNIQUE INDEX "AccessRequest_requester_resource_perm_status_unique" ON "AccessRequest"("requesterId", "resourceType", "permissionKey", "status");

-- Foreign keys
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_reviewerId_fkey"
    FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "AccessRequestEvent" ADD CONSTRAINT "AccessRequestEvent_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "AccessRequest"("id") ON DELETE CASCADE;
ALTER TABLE "AccessRequestEvent" ADD CONSTRAINT "AccessRequestEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "UserResourceAccess" ADD CONSTRAINT "UserResourceAccess_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Seed default resource permissions
INSERT INTO "ResourcePermission" ("id", "resourceType", "permissionKey", "permissionName", "description") VALUES
    (gen_random_uuid(), 'articles', 'articles:view', 'View Articles', 'View article content'),
    (gen_random_uuid(), 'articles', 'articles:create', 'Create Articles', 'Create new articles'),
    (gen_random_uuid(), 'articles', 'articles:edit', 'Edit Articles', 'Edit existing articles'),
    (gen_random_uuid(), 'articles', 'articles:delete', 'Delete Articles', 'Delete articles'),
    (gen_random_uuid(), 'articles', 'articles:publish', 'Publish Articles', 'Publish or unpublish articles'),
    (gen_random_uuid(), 'highlights', 'highlights:view', 'View Highlights', 'View highlights'),
    (gen_random_uuid(), 'highlights', 'highlights:create', 'Create Highlights', 'Create new highlights'),
    (gen_random_uuid(), 'highlights', 'highlights:edit', 'Edit Highlights', 'Edit existing highlights'),
    (gen_random_uuid(), 'highlights', 'highlights:delete', 'Delete Highlights', 'Delete highlights'),
    (gen_random_uuid(), 'highlights', 'highlights:feature', 'Feature Highlights', 'Feature highlights on homepage'),
    (gen_random_uuid(), 'playlists', 'playlists:view', 'View Playlists', 'View playlists'),
    (gen_random_uuid(), 'playlists', 'playlists:create', 'Create Playlists', 'Create new playlists'),
    (gen_random_uuid(), 'playlists', 'playlists:edit', 'Edit Playlists', 'Edit existing playlists'),
    (gen_random_uuid(), 'playlists', 'playlists:delete', 'Delete Playlists', 'Delete playlists'),
    (gen_random_uuid(), 'playlists', 'playlists:manage_tracks', 'Manage Tracks', 'Add or remove tracks from playlists'),
    (gen_random_uuid(), 'tracks', 'tracks:view', 'View Tracks', 'View audio tracks'),
    (gen_random_uuid(), 'tracks', 'tracks:upload', 'Upload Tracks', 'Upload new audio tracks'),
    (gen_random_uuid(), 'tracks', 'tracks:edit', 'Edit Tracks', 'Edit track metadata'),
    (gen_random_uuid(), 'tracks', 'tracks:delete', 'Delete Tracks', 'Delete tracks'),
    (gen_random_uuid(), 'tags', 'tags:view', 'View Tags', 'View tags'),
    (gen_random_uuid(), 'tags', 'tags:create', 'Create Tags', 'Create new tags'),
    (gen_random_uuid(), 'tags', 'tags:edit', 'Edit Tags', 'Edit existing tags'),
    (gen_random_uuid(), 'tags', 'tags:delete', 'Delete Tags', 'Delete tags'),
    (gen_random_uuid(), 'media', 'media:view', 'View Media', 'View media files'),
    (gen_random_uuid(), 'media', 'media:upload', 'Upload Media', 'Upload new media files'),
    (gen_random_uuid(), 'media', 'media:edit', 'Edit Media', 'Edit media metadata'),
    (gen_random_uuid(), 'media', 'media:delete', 'Delete Media', 'Delete media files'),
    (gen_random_uuid(), 'users', 'users:view', 'View Users', 'View user profiles'),
    (gen_random_uuid(), 'users', 'users:create', 'Create Users', 'Create new user accounts'),
    (gen_random_uuid(), 'users', 'users:edit', 'Edit Users', 'Edit user profiles'),
    (gen_random_uuid(), 'users', 'users:delete', 'Delete Users', 'Delete user accounts'),
    (gen_random_uuid(), 'users', 'users:suspend', 'Suspend Users', 'Suspend or reactivate users'),
    (gen_random_uuid(), 'roles', 'roles:view', 'View Roles', 'View RBAC roles'),
    (gen_random_uuid(), 'roles', 'roles:create', 'Create Roles', 'Create new roles'),
    (gen_random_uuid(), 'roles', 'roles:edit', 'Edit Roles', 'Edit existing roles'),
    (gen_random_uuid(), 'roles', 'roles:delete', 'Delete Roles', 'Delete roles'),
    (gen_random_uuid(), 'permissions', 'permissions:view', 'View Permissions', 'View permission definitions'),
    (gen_random_uuid(), 'permissions', 'permissions:grant', 'Grant Permissions', 'Grant permissions to users'),
    (gen_random_uuid(), 'permissions', 'permissions:revoke', 'Revoke Permissions', 'Revoke permissions from users'),
    (gen_random_uuid(), 'api', 'api:view', 'View API Keys', 'View API keys'),
    (gen_random_uuid(), 'api', 'api:create', 'Create API Keys', 'Create new API keys'),
    (gen_random_uuid(), 'api', 'api:revoke', 'Revoke API Keys', 'Revoke API keys'),
    (gen_random_uuid(), 'api', 'api:configure', 'Configure API', 'Configure API settings'),
    (gen_random_uuid(), 'bots', 'bots:view', 'View Bots', 'View bot configurations'),
    (gen_random_uuid(), 'bots', 'bots:create', 'Create Bots', 'Create new bots'),
    (gen_random_uuid(), 'bots', 'bots:edit', 'Edit Bots', 'Edit bot configurations'),
    (gen_random_uuid(), 'bots', 'bots:delete', 'Delete Bots', 'Delete bots'),
    (gen_random_uuid(), 'bots', 'bots:deploy', 'Deploy Bots', 'Deploy or undeploy bots'),
    (gen_random_uuid(), 'tickets', 'tickets:view', 'View Tickets', 'View support tickets'),
    (gen_random_uuid(), 'tickets', 'tickets:create', 'Create Tickets', 'Create new tickets'),
    (gen_random_uuid(), 'tickets', 'tickets:update', 'Update Tickets', 'Update ticket status and details'),
    (gen_random_uuid(), 'tickets', 'tickets:resolve', 'Resolve Tickets', 'Resolve or close tickets'),
    (gen_random_uuid(), 'storage', 'storage:view', 'View Storage', 'View storage usage and files'),
    (gen_random_uuid(), 'storage', 'storage:upload', 'Upload to Storage', 'Upload files to storage'),
    (gen_random_uuid(), 'storage', 'storage:delete', 'Delete from Storage', 'Delete files from storage'),
    (gen_random_uuid(), 'storage', 'storage:manage', 'Manage Storage', 'Manage storage settings and quotas'),
    (gen_random_uuid(), 'knowledge_base', 'knowledge_base:view', 'View Knowledge Base', 'View knowledge base articles'),
    (gen_random_uuid(), 'knowledge_base', 'knowledge_base:create', 'Create KB Articles', 'Create knowledge base articles'),
    (gen_random_uuid(), 'knowledge_base', 'knowledge_base:edit', 'Edit KB Articles', 'Edit knowledge base articles'),
    (gen_random_uuid(), 'knowledge_base', 'knowledge_base:delete', 'Delete KB Articles', 'Delete knowledge base articles'),
    (gen_random_uuid(), 'settings', 'settings:view', 'View Settings', 'View system settings'),
    (gen_random_uuid(), 'settings', 'settings:update', 'Update Settings', 'Update system settings'),
    (gen_random_uuid(), 'features', 'features:view', 'View Features', 'View feature flags'),
    (gen_random_uuid(), 'features', 'features:toggle', 'Toggle Features', 'Toggle feature flags on or off'),
    (gen_random_uuid(), 'analytics', 'analytics:view', 'View Analytics', 'View analytics data'),
    (gen_random_uuid(), 'analytics', 'analytics:export', 'Export Analytics', 'Export analytics data'),
    (gen_random_uuid(), 'notifications', 'notifications:view', 'View Notifications', 'View notification settings and history'),
    (gen_random_uuid(), 'notifications', 'notifications:send', 'Send Notifications', 'Send notifications to users'),
    (gen_random_uuid(), 'email', 'email:view', 'View Email', 'View email templates and history'),
    (gen_random_uuid(), 'email', 'email:create', 'Create Email', 'Create email templates'),
    (gen_random_uuid(), 'email', 'email:send', 'Send Email', 'Send emails to users'),
    (gen_random_uuid(), 'integrations', 'integrations:view', 'View Integrations', 'View integration configurations'),
    (gen_random_uuid(), 'integrations', 'integrations:configure', 'Configure Integrations', 'Configure integration settings')
ON CONFLICT ("permissionKey") DO NOTHING;
