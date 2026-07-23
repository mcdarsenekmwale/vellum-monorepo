-- Enable Row Level Security for all tables (idempotent)
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Article" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Highlight" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bookmark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Like" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Follow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Story" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSettings" ENABLE ROW LEVEL SECURITY;

-- Create a function to get current user ID from session variable (idempotent)
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_user_id', TRUE);
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a function to get current user role from session variable (idempotent)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_user_role', TRUE);
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- User table policies (idempotent: DROP IF EXISTS then CREATE)
DROP POLICY IF EXISTS "Users can view their own profile" ON "User";
CREATE POLICY "Users can view their own profile" ON "User"
  FOR SELECT USING (current_user_id() = "id");

DROP POLICY IF EXISTS "Users can update their own profile" ON "User";
CREATE POLICY "Users can update their own profile" ON "User"
  FOR UPDATE USING (current_user_id() = "id");

DROP POLICY IF EXISTS "Admins can view all users" ON "User";
CREATE POLICY "Admins can view all users" ON "User"
  FOR SELECT USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Admins can update all users" ON "User";
CREATE POLICY "Admins can update all users" ON "User"
  FOR UPDATE USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Public can view published user profiles" ON "User";
CREATE POLICY "Public can view published user profiles" ON "User"
  FOR SELECT USING ("isActive" = true);

-- Article table policies
DROP POLICY IF EXISTS "Authors can view their own articles" ON "Article";
CREATE POLICY "Authors can view their own articles" ON "Article"
  FOR SELECT USING (current_user_id() = "authorId");

DROP POLICY IF EXISTS "Authors can update their own articles" ON "Article";
CREATE POLICY "Authors can update their own articles" ON "Article"
  FOR UPDATE USING (current_user_id() = "authorId");

DROP POLICY IF EXISTS "Authors can delete their own articles" ON "Article";
CREATE POLICY "Authors can delete their own articles" ON "Article"
  FOR DELETE USING (current_user_id() = "authorId");

DROP POLICY IF EXISTS "Admins can view all articles" ON "Article";
CREATE POLICY "Admins can view all articles" ON "Article"
  FOR SELECT USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Admins can update all articles" ON "Article";
CREATE POLICY "Admins can update all articles" ON "Article"
  FOR UPDATE USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Admins can delete all articles" ON "Article";
CREATE POLICY "Admins can delete all articles" ON "Article"
  FOR DELETE USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Public can view published articles" ON "Article";
CREATE POLICY "Public can view published articles" ON "Article"
  FOR SELECT USING ("isPublished" = true AND "deletedAt" IS NULL);

-- Highlight table policies
DROP POLICY IF EXISTS "Authors can view their own highlights" ON "Highlight";
CREATE POLICY "Authors can view their own highlights" ON "Highlight"
  FOR SELECT USING (current_user_id() = "authorId");

DROP POLICY IF EXISTS "Authors can update their own highlights" ON "Highlight";
CREATE POLICY "Authors can update their own highlights" ON "Highlight"
  FOR UPDATE USING (current_user_id() = "authorId");

DROP POLICY IF EXISTS "Authors can delete their own highlights" ON "Highlight";
CREATE POLICY "Authors can delete their own highlights" ON "Highlight"
  FOR DELETE USING (current_user_id() = "authorId");

DROP POLICY IF EXISTS "Admins can view all highlights" ON "Highlight";
CREATE POLICY "Admins can view all highlights" ON "Highlight"
  FOR SELECT USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Admins can update all highlights" ON "Highlight";
CREATE POLICY "Admins can update all highlights" ON "Highlight"
  FOR UPDATE USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Admins can delete all highlights" ON "Highlight";
CREATE POLICY "Admins can delete all highlights" ON "Highlight"
  FOR DELETE USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Public can view published highlights" ON "Highlight";
CREATE POLICY "Public can view published highlights" ON "Highlight"
  FOR SELECT USING ("isPublished" = true AND "deletedAt" IS NULL);

-- Comment table policies
DROP POLICY IF EXISTS "Users can view comments on their content" ON "Comment";
CREATE POLICY "Users can view comments on their content" ON "Comment"
  FOR SELECT USING (
    current_user_id() = "authorId" OR
    EXISTS (SELECT 1 FROM "Article" a WHERE a."slug" = "Comment"."articleSlug" AND a."authorId" = current_user_id()) OR
    EXISTS (SELECT 1 FROM "Highlight" h WHERE h."id" = "Comment"."highlightId" AND h."authorId" = current_user_id())
  );

DROP POLICY IF EXISTS "Users can update their own comments" ON "Comment";
CREATE POLICY "Users can update their own comments" ON "Comment"
  FOR UPDATE USING (current_user_id() = "authorId");

DROP POLICY IF EXISTS "Users can delete their own comments" ON "Comment";
CREATE POLICY "Users can delete their own comments" ON "Comment"
  FOR DELETE USING (current_user_id() = "authorId");

DROP POLICY IF EXISTS "Admins can view all comments" ON "Comment";
CREATE POLICY "Admins can view all comments" ON "Comment"
  FOR SELECT USING (current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Admins can delete all comments" ON "Comment";
CREATE POLICY "Admins can delete all comments" ON "Comment"
  FOR DELETE USING (current_user_role() = 'ADMIN');

-- Notification table policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON "Notification";
CREATE POLICY "Users can view their own notifications" ON "Notification"
  FOR SELECT USING (current_user_id() = "userId");

DROP POLICY IF EXISTS "Users can update their own notifications" ON "Notification";
CREATE POLICY "Users can update their own notifications" ON "Notification"
  FOR UPDATE USING (current_user_id() = "userId");

-- AuditLog table policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON "AuditLog";
CREATE POLICY "Admins can view audit logs" ON "AuditLog"
  FOR SELECT USING (current_user_role() = 'ADMIN');

-- Bookmark table policies
DROP POLICY IF EXISTS "Users can view their own bookmarks" ON "Bookmark";
CREATE POLICY "Users can view their own bookmarks" ON "Bookmark"
  FOR SELECT USING (current_user_id() = "userId");

-- Like table policies
DROP POLICY IF EXISTS "Users can view their own likes" ON "Like";
CREATE POLICY "Users can view their own likes" ON "Like"
  FOR SELECT USING (current_user_id() = "userId");

-- Follow table policies
DROP POLICY IF EXISTS "Users can view their own follows" ON "Follow";
CREATE POLICY "Users can view their own follows" ON "Follow"
  FOR SELECT USING (current_user_id() = "followerId" OR current_user_id() = "followingId");

-- Story table policies
DROP POLICY IF EXISTS "Authors can view their own stories" ON "Story";
CREATE POLICY "Authors can view their own stories" ON "Story"
  FOR SELECT USING (current_user_id() = "authorId");

DROP POLICY IF EXISTS "Authors can delete their own stories" ON "Story";
CREATE POLICY "Authors can delete their own stories" ON "Story"
  FOR DELETE USING (current_user_id() = "authorId");

-- Media table policies
DROP POLICY IF EXISTS "Users can view their own media" ON "Media";
CREATE POLICY "Users can view their own media" ON "Media"
  FOR SELECT USING (current_user_id() = "uploadedBy");

DROP POLICY IF EXISTS "Users can delete their own media" ON "Media";
CREATE POLICY "Users can delete their own media" ON "Media"
  FOR DELETE USING (current_user_id() = "uploadedBy");

DROP POLICY IF EXISTS "Admins can view all media" ON "Media";
CREATE POLICY "Admins can view all media" ON "Media"
  FOR SELECT USING (current_user_role() = 'ADMIN');

-- Session table policies
DROP POLICY IF EXISTS "Users can view their own sessions" ON "Session";
CREATE POLICY "Users can view their own sessions" ON "Session"
  FOR SELECT USING (current_user_id() = "userId");

-- RefreshToken table policies
DROP POLICY IF EXISTS "Users can view their own refresh tokens" ON "RefreshToken";
CREATE POLICY "Users can view their own refresh tokens" ON "RefreshToken"
  FOR SELECT USING (current_user_id() = "userId");

-- ApiKey table policies
DROP POLICY IF EXISTS "Users can view their own API keys" ON "ApiKey";
CREATE POLICY "Users can view their own API keys" ON "ApiKey"
  FOR SELECT USING (current_user_id() = "userId");

DROP POLICY IF EXISTS "Users can delete their own API keys" ON "ApiKey";
CREATE POLICY "Users can delete their own API keys" ON "ApiKey"
  FOR DELETE USING (current_user_id() = "userId");

-- UserSettings table policies
DROP POLICY IF EXISTS "Users can view their own settings" ON "UserSettings";
CREATE POLICY "Users can view their own settings" ON "UserSettings"
  FOR SELECT USING (current_user_id() = "userId");

DROP POLICY IF EXISTS "Users can update their own settings" ON "UserSettings";
CREATE POLICY "Users can update their own settings" ON "UserSettings"
  FOR UPDATE USING (current_user_id() = "userId");
