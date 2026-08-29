import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { SETTINGS_DEFINITIONS } from '../src/modules/admin/settings-definitions';
import { seedSupportAgents } from './seed-support-agents';
import { runSeedActivityLikes } from './seed-activity-likes';
import { runSeedActivityCommentsFollows } from './seed-activity-comments-follows';
import { runSeedActivityMentionsReplies } from './seed-activity-mentions-replies';
import { runSeedActivitySharesBookmarks } from './seed-activity-shares-bookmarks';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);
  const now = new Date();

  const admin = await prisma.user.create({
    data: {
      email: 'admin@vellbase.com',
      passwordHash,
      handle: 'vellbaseadmin',
      name: 'Vellbase Admin',
      role: 'ADMIN',
      emailVerified: now,
      bio: 'Founder and admin of Vellbase',
    },
  });

  const moderator = await prisma.user.create({
    data: {
      email: 'moderator@vellbase.com',
      passwordHash,
      handle: 'vellbasemod',
      name: 'Vellbase Moderator',
      role: 'MODERATOR',
      emailVerified: now,
      bio: 'Community moderator',
    },
  });

  const creator = await prisma.user.create({
    data: {
      email: 'creator@vellbase.com',
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
      details: { email: 'creator@vellbase.com', role: 'CREATOR' },
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
      details: { key: 'site_name', previousValue: 'Vellbase', newValue: 'Vellbase Platform' },
      metadata: { description: 'Updated site name setting' },
      changes: { site_name: { old: 'Vellbase', new: 'Vellbase Platform' } },
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
      details: { email: 'newuser@vellbase.com', role: 'CREATOR' },
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

  // ─── Seed System Settings ───
  console.log('Seeding system settings...');
  for (const def of SETTINGS_DEFINITIONS) {
    await prisma.systemSetting.upsert({
      where: { key: def.key },
      update: {
        value: def.value,
        category: def.category,
        description: def.description,
      },
      create: {
        key: def.key,
        value: def.value,
        category: def.category,
        description: def.description,
        version: 1,
      },
    });
  }
  console.log(`Seeded ${SETTINGS_DEFINITIONS.length} system settings`);

  // ─── Seed Support Agents + Ticket Ecosystem (idempotent, upsert-based) ───
  console.log('Seeding support agents + ticket ecosystem...');
  await seedSupportAgents(prisma);
  console.log('Support agents + ticket ecosystem complete.');

  // ─── Seed Help Center FAQs (idempotent by question+category key) ───
  console.log('Seeding help center FAQs...');
  const FAQS: Array<{ category: string; question: string; answer: string }> = [
    {
      category: 'Getting Started',
      question: 'How do I create my first article?',
      answer:
        "Tap the pen (+) button in the bottom navigation bar to open the composer. Give your story a title, then start writing. Use the toolbar to format text, insert images, add highlights, and attach embeds. When you're ready, hit Publish — you can always edit it later.",
    },
    {
      category: 'Getting Started',
      question: 'How do I personalize my feed?',
      answer:
        'Follow authors you enjoy reading, bookmark articles you love, and react to the stories that resonate. Vellbase surfaces content based on the topics you engage with. You can also tap Discover to explore new categories and trending topics curated just for you.',
    },
    {
      category: 'Getting Started',
      question: 'Can I import articles from another platform?',
      answer:
        'Yes. Open Profile → Settings → Import Content, paste a URL or upload an HTML/Markdown export, and we will do our best to preserve formatting, images, and metadata. All imported drafts are private until you publish them.',
    },
    {
      category: 'Account & Billing',
      question: 'How do I change my email or password?',
      answer:
        'Open Settings → Account. For email changes, you will receive a confirmation link at the new address. For passwords, we will ask for your current password first. If you signed in with a social provider, connect an email and password first before attempting a password change.',
    },
    {
      category: 'Account & Billing',
      question: 'What is included in the Vellbase Pro plan?',
      answer:
        'Vellbase Pro includes AI-powered drafts and edits (up to 500/month), a custom domain for your publication, advanced analytics with audience geography and retention curves, priority customer support, and removal of Vellbase branding from newsletters you send.',
    },
    {
      category: 'Account & Billing',
      question: 'How do I cancel my subscription?',
      answer:
        'Go to Settings → Subscription and tap "Cancel renewal". Your plan remains active until the end of the billing cycle and no further charges are made. You can reactivate at any time from the same screen before it expires.',
    },
    {
      category: 'Content & Writing',
      question: 'Does Vellbase support Markdown?',
      answer:
        "Yes — the composer accepts pasted Markdown and renders it instantly. If you prefer to write in Markdown, toggle the Markdown mode switch in the composer's three-dot menu to get a split preview pane.",
    },
    {
      category: 'Content & Writing',
      question: 'Can I schedule an article to publish later?',
      answer:
        "Absolutely. When a story is ready, tap Publish, then choose Schedule. Pick a date and time in your local timezone. You can edit or reschedule up until the publish moment from the Scheduled tab of your profile.",
    },
    {
      category: 'Content & Writing',
      question: 'How do SEO and social previews work?',
      answer:
        'Every published article automatically generates a social card using your cover image, title, and excerpt. You can override the SEO title, description, or social image per article under Article Settings → Social Sharing Cards. Google typically indexes new Vellbase articles within 24-48 hours.',
    },
    {
      category: 'Notifications',
      question: 'Why am I not receiving push notifications?',
      answer:
        'First, make sure notifications are enabled for Vellbase in your device Settings (iOS: Settings → Notifications → Vellbase; Android: Long-press the app icon → App Info → Notifications). Then visit Settings → Notifications inside Vellbase and confirm the specific categories you want are on. If everything is on, try logging out and back in — this refreshes your push token.',
    },
    {
      category: 'Notifications',
      question: 'Can I get only important notifications, not every like?',
      answer:
        "Yes. Go to Settings → Notifications and turn off the toggles you don't need (for example, leave Comments and Replies on but switch Likes off). You can also disable Marketing emails and only keep the Weekly digest.",
    },
    {
      category: 'Safety & Privacy',
      question: 'How do I block or mute another user?',
      answer:
        "Open their profile, tap the three-dot menu, and choose Block or Mute. Blocked users cannot comment on your articles or send you direct messages. Muting simply hides their content from your feeds. You can review the list from Settings → Privacy → Blocked Accounts.",
    },
    {
      category: 'Safety & Privacy',
      question: 'Can I make my profile private so only followers see my content?',
      answer:
        "Yes. Open Settings → Privacy → Profile Visibility and choose Followers. New followers will need your approval before they can read full articles or see your likes history. Your public bio and avatar remain discoverable so people can request access.",
    },
    {
      category: 'Troubleshooting',
      question: 'The app is slow or keeps freezing — what should I do?',
      answer:
        'Start by force-closing the app and reopening. If that does not help, clear the cache from Settings → About → Clear cached data. On iOS you can also offload and reinstall the app without losing your account data. Persistent slowdowns usually mean a weak connection or low storage — try a different network and free up space.',
    },
    {
      category: 'Troubleshooting',
      question: 'Why are my images failing to upload?',
      answer:
        'Vellbase accepts JPG, PNG, WebP, and HEIC images up to 25 MB each. Animated GIFs are supported up to 10 MB. If an upload fails, check the file size, try reducing the resolution, or switch to a faster network. Uploads automatically retry three times before giving up.',
    },
    {
      category: 'Troubleshooting',
      question: 'I forgot my password — how do I reset it?',
      answer:
        "On the login screen, tap Forgot Password and enter the email you used to create your account. You'll receive a one-time reset link that expires after 30 minutes. If the email does not arrive, check your spam folder or try the account-recovery option inside Help Center → Contact Support.",
    },
  ];

  let faqCreated = 0;
  let faqUpdated = 0;
  for (const f of FAQS) {
    const existing = await prisma.faqItem.findFirst({
      where: { category: f.category, question: f.question },
    });
    if (existing) {
      await prisma.faqItem.update({
        where: { id: existing.id },
        data: { answer: f.answer },
      });
      faqUpdated++;
    } else {
      await prisma.faqItem.create({ data: f });
      faqCreated++;
    }
  }
  console.log(`FAQs seeded (created=${faqCreated}, updated=${faqUpdated}, total=${FAQS.length})`);

  // ─── Seed activity feed data (likes / comments+replies / mentions+replies / shares+bookmarks)
  //     Toggle via env: SEED_ACTIVITY=1 npm run seed   (or ts-node prisma/seed.ts)
  if (process.env.SEED_ACTIVITY === '1') {
    console.log('\n[seed] SEED_ACTIVITY=1 → running activity feed seeders…');
    let total = 0;
    total += await runSeedActivityLikes(prisma);
    total += await runSeedActivityCommentsFollows(prisma);
    total += await runSeedActivityMentionsReplies(prisma);
    total += await runSeedActivitySharesBookmarks(prisma);
    console.log(`[seed] activity seeders complete: +${total} notifications.\n`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
