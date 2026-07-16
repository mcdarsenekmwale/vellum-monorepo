import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);
  const now = new Date();

  const admin = await prisma.user.create({
    data: {
      email: 'admin@vellum.com',
      passwordHash,
      handle: 'vellumadmin',
      name: 'Vellum Admin',
      role: 'ADMIN',
      emailVerified: now,
      bio: 'Founder and admin of Vellum',
    },
  });

  const moderator = await prisma.user.create({
    data: {
      email: 'moderator@vellum.com',
      passwordHash,
      handle: 'vellummod',
      name: 'Vellum Moderator',
      role: 'MODERATOR',
      emailVerified: now,
      bio: 'Community moderator',
    },
  });

  const creator = await prisma.user.create({
    data: {
      email: 'creator@vellum.com',
      passwordHash,
      handle: 'contentcreator',
      name: 'Content Creator',
      role: 'CREATOR',
      emailVerified: now,
      bio: 'Tech content creator',
      publication: 'Tech Insights',
    },
  });

  const user1 = await prisma.user.create({
    data: {
      email: 'user1@example.com',
      passwordHash,
      handle: 'johndoe',
      name: 'John Doe',
      emailVerified: now,
      bio: 'Tech enthusiast',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'user2@example.com',
      passwordHash,
      handle: 'janedoe',
      name: 'Jane Doe',
      emailVerified: now,
      bio: 'Writer and editor',
    },
  });

  await prisma.userSettings.create({ data: { userId: admin.id } });
  await prisma.userSettings.create({ data: { userId: moderator.id } });
  await prisma.userSettings.create({ data: { userId: creator.id } });
  await prisma.userSettings.create({ data: { userId: user1.id } });
  await prisma.userSettings.create({ data: { userId: user2.id } });

  const techCategory = await prisma.category.create({
    data: { name: 'Technology', slug: 'technology', tint: '#3B82F6' },
  });
  const businessCategory = await prisma.category.create({
    data: { name: 'Business', slug: 'business', tint: '#8B5CF6' },
  });
  await prisma.category.create({ data: { name: 'Science', slug: 'science', tint: '#06B6D4' } });
  await prisma.category.create({ data: { name: 'Health', slug: 'health', tint: '#10B981' } });
  await prisma.category.create({ data: { name: 'Entertainment', slug: 'entertainment', tint: '#F59E0B' } });
  await prisma.category.create({ data: { name: 'Sports', slug: 'sports', tint: '#EF4444' } });

  const article1 = await prisma.article.create({
    data: {
      slug: 'introduction-to-react-native',
      title: 'Introduction to React Native',
      excerpt: 'Learn the basics of React Native development',
      body: ['React Native is a popular framework for building mobile applications using React.'],
      cover: 'https://example.com/react-native-cover.jpg',
      readMinutes: 5,
      categoryId: techCategory.id,
      authorId: creator.id,
      isPublished: true,
      publishedAt: now,
      likesCount: 120,
      views: 5000,
    },
  });

  const article2 = await prisma.article.create({
    data: {
      slug: 'nodejs-best-practices',
      title: 'Node.js Best Practices',
      excerpt: 'Essential tips for building scalable Node.js applications',
      body: ['Building scalable Node.js applications requires careful planning.'],
      cover: 'https://example.com/nodejs-cover.jpg',
      readMinutes: 8,
      categoryId: techCategory.id,
      authorId: creator.id,
      isPublished: true,
      publishedAt: now,
      likesCount: 85,
      views: 3200,
    },
  });

  await prisma.article.create({
    data: {
      slug: 'typescript-fundamentals',
      title: 'TypeScript Fundamentals',
      excerpt: 'Master TypeScript for better code quality',
      body: ['TypeScript adds optional static typing to JavaScript.'],
      cover: 'https://example.com/typescript-cover.jpg',
      readMinutes: 6,
      categoryId: techCategory.id,
      authorId: user1.id,
      isPublished: true,
      publishedAt: now,
      likesCount: 67,
      views: 2100,
    },
  });

  await prisma.highlight.create({
    data: {
      title: 'React Hooks Tutorial',
      handle: creator.handle,
      authorId: creator.id,
      description: 'Learn React Hooks in 5 minutes',
      videoUrl: 'https://example.com/hooks-video.mp4',
      thumbnailUrl: 'https://example.com/hooks-thumb.jpg',
      duration: 300,
      likesCount: 250,
      commentsCount: 30,
      shares: 45,
      isPublished: true,
      publishedAt: now,
    },
  });

  await prisma.highlight.create({
    data: {
      title: 'CSS Grid Layout',
      handle: user2.handle,
      authorId: user2.id,
      description: 'Master CSS Grid in 3 minutes',
      videoUrl: 'https://example.com/css-grid-video.mp4',
      thumbnailUrl: 'https://example.com/css-grid-thumb.jpg',
      duration: 180,
      likesCount: 180,
      commentsCount: 22,
      shares: 30,
      isPublished: true,
      publishedAt: now,
    },
  });

  await prisma.comment.create({
    data: { articleSlug: article1.slug, authorId: user1.id, body: 'Great article! Very informative.' },
  });
  await prisma.comment.create({
    data: { articleSlug: article1.slug, authorId: user2.id, body: 'Thanks for sharing this!' },
  });
  await prisma.comment.create({
    data: { articleSlug: article2.slug, authorId: user1.id, body: 'Node.js is awesome!' },
  });

  await prisma.like.create({ data: { userId: user1.id, articleSlug: article1.slug } });
  await prisma.like.create({ data: { userId: user2.id, articleSlug: article1.slug } });
  await prisma.like.create({ data: { userId: user1.id, articleSlug: article2.slug } });

  await prisma.bookmark.create({ data: { userId: user1.id, articleSlug: article1.slug } });
  await prisma.bookmark.create({ data: { userId: user2.id, articleSlug: article2.slug } });

  await prisma.follow.create({ data: { followerId: user1.id, followingId: creator.id } });
  await prisma.follow.create({ data: { followerId: user2.id, followingId: creator.id } });
  await prisma.follow.create({ data: { followerId: user1.id, followingId: user2.id } });

  await prisma.notification.create({
    data: { userId: creator.id, actorId: user1.id, kind: 'FOLLOW', body: 'John Doe started following you' },
  });

  await prisma.notification.create({
    data: { userId: creator.id, actorId: user2.id, kind: 'LIKE', articleSlug: article1.slug, body: 'Jane Doe liked your article' },
  });

  // Create comprehensive audit logs for testing
  const auditLogs = [
    {
      userId: admin.id,
      action: 'create',
      resource: 'User',
      resourceId: creator.id,
      details: { email: 'creator@vellum.com', role: 'CREATOR' },
      metadata: { description: 'Created new creator account via admin panel' },
      success: true,
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      location: 'San Francisco, CA',
    },
    {
      userId: admin.id,
      action: 'role_change',
      resource: 'User',
      resourceId: moderator.id,
      details: { previousRole: 'USER', newRole: 'MODERATOR' },
      metadata: { description: 'Promoted user to moderator' },
      changes: { role: { old: 'USER', new: 'MODERATOR' } },
      success: true,
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      location: 'San Francisco, CA',
    },
    {
      userId: admin.id,
      action: 'settings_change',
      resource: 'SystemSettings',
      resourceId: 'site-name',
      details: { key: 'site_name', previousValue: 'Vellum', newValue: 'Vellum Platform' },
      metadata: { description: 'Updated site name setting' },
      changes: { site_name: { old: 'Vellum', new: 'Vellum Platform' } },
      success: true,
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      location: 'New York, NY',
    },
    {
      userId: moderator.id,
      action: 'delete',
      resource: 'Article',
      resourceId: 'spam-article-123',
      details: { reason: 'Spam content', originalTitle: 'Click here for free stuff' },
      metadata: { description: 'Deleted spam article' },
      success: true,
      ipAddress: '10.0.0.50',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      location: 'Los Angeles, CA',
    },
    {
      userId: admin.id,
      action: 'login',
      resource: 'Session',
      resourceId: null,
      details: { method: 'credentials' },
      metadata: { description: 'Admin logged in' },
      success: true,
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      location: 'San Francisco, CA',
    },
    {
      userId: admin.id,
      action: 'update',
      resource: 'Article',
      resourceId: article1.id,
      details: { changes: ['title', 'excerpt'] },
      metadata: { description: 'Updated article metadata' },
      changes: {
        title: { old: 'Intro to React Native', new: 'Introduction to React Native' },
        excerpt: { old: 'React Native basics', new: 'Learn the basics of React Native development' },
      },
      success: true,
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      location: 'San Francisco, CA',
    },
    {
      userId: null,
      action: 'login',
      resource: 'Session',
      resourceId: null,
      details: { email: 'hacker@example.com', method: 'credentials' },
      metadata: { description: 'Failed login attempt' },
      success: false,
      ipAddress: '203.0.113.42',
      userAgent: 'curl/7.68.0',
      location: 'Unknown',
    },
    {
      userId: admin.id,
      action: 'api_key_create',
      resource: 'ApiKey',
      resourceId: 'key_abc123',
      details: { name: 'Production API Key', permissions: ['read', 'write'] },
      metadata: { description: 'Created new API key for production use' },
      success: true,
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      location: 'San Francisco, CA',
    },
    {
      userId: moderator.id,
      action: 'user_suspend',
      resource: 'User',
      resourceId: user2.id,
      details: { reason: 'Spam activity', duration: '7 days' },
      metadata: { description: 'Suspended user for spam' },
      changes: { status: { old: 'active', new: 'suspended' } },
      success: true,
      ipAddress: '10.0.0.50',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      location: 'Los Angeles, CA',
    },
    {
      userId: admin.id,
      action: 'export',
      resource: 'AuditLog',
      resourceId: null,
      details: { format: 'CSV', dateRange: '2024-01-01 to 2024-12-31' },
      metadata: { description: 'Exported audit logs for compliance' },
      success: true,
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      location: 'New York, NY',
    },
    {
      userId: creator.id,
      action: 'create',
      resource: 'Article',
      resourceId: article2.id,
      details: { title: 'Node.js Best Practices', category: 'Technology' },
      metadata: { description: 'Published new article' },
      success: true,
      ipAddress: '172.16.0.10',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      location: 'Seattle, WA',
    },
    {
      userId: admin.id,
      action: 'mfa_enabled',
      resource: 'User',
      resourceId: admin.id,
      details: { method: 'totp' },
      metadata: { description: 'Admin enabled MFA on account' },
      success: true,
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      location: 'San Francisco, CA',
    },
    {
      userId: moderator.id,
      action: 'password_change',
      resource: 'User',
      resourceId: moderator.id,
      details: { method: 'settings' },
      metadata: { description: 'Moderator changed password' },
      success: true,
      ipAddress: '10.0.0.50',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      location: 'Los Angeles, CA',
    },
    {
      userId: null,
      action: 'delete',
      resource: 'Article',
      resourceId: 'nonexistent-123',
      details: { attemptedBy: 'anonymous' },
      metadata: { description: 'Unauthorized delete attempt' },
      success: false,
      ipAddress: '198.51.100.23',
      userAgent: 'python-requests/2.28.0',
      location: 'Chicago, IL',
    },
    {
      userId: admin.id,
      action: 'user_invite',
      resource: 'User',
      resourceId: null,
      details: { email: 'newuser@vellum.com', role: 'CREATOR' },
      metadata: { description: 'Invited new creator to platform' },
      success: true,
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      location: 'San Francisco, CA',
    },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({ data: log });
  }

  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
