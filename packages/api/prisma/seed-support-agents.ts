import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Module-level prisma reference — assigned at the start of `seedSupportAgents`.
// Helper functions below close over this variable.
let prisma: PrismaClient;

/** Find or create a SupportTeam by name within a department (no unique key besides id). */
async function findOrCreateTeam(
  name: string,
  departmentId: string,
  description?: string,
) {
  const existing = await prisma.supportTeam.findFirst({
    where: { name, departmentId },
  });
  if (existing) return existing;
  return prisma.supportTeam.create({
    data: { name, departmentId, description },
  });
}

/** Find or create an SlaPolicy by name + department + priority. */
async function findOrCreateSlaPolicy(data: {
  name: string;
  departmentId: string | null;
  priority: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  escalationMinutes?: number;
}) {
  const where: any = {
    name: data.name,
    departmentId: data.departmentId ?? undefined,
    priority: data.priority,
  };
  const existing = await prisma.slaPolicy.findFirst({ where });
  if (existing) return existing;
  return prisma.slaPolicy.create({
    data: {
      name: data.name,
      departmentId: data.departmentId,
      priority: data.priority as any,
      firstResponseMinutes: data.firstResponseMinutes,
      resolutionMinutes: data.resolutionMinutes,
      escalationMinutes: data.escalationMinutes,
    },
  });
}

/** Ensure UserSettings row exists for a user. */
async function ensureUserSettings(userId: string) {
  const existing = await prisma.userSettings.findUnique({ where: { userId } });
  if (!existing) {
    await prisma.userSettings.create({ data: { userId } });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Seed the support-agents and ticket ecosystem.
 * Takes an instantiated PrismaClient so it can be orchestrated from a larger
 * seed pipeline (e.g. prisma/seed.ts calls this).  Idempotent: existing rows
 * are matched by email/ticketNumber and reused via upsert.
 */
export async function seedSupportAgents(client: PrismaClient) {
  prisma = client;
  const passwordHash = await bcrypt.hash('password123', 12);
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  // ─── 1. Departments ──────────────────────────────────────────────────────────
  console.log('Seeding support departments...');

  // 1a. Users for department heads — will be referenced later below (ensure users exist)
  // We'll fetch the actual user IDs for priya/david after user upserts below, then link.
  // For now we seed departments with headId resolved after step 5.

  const generalDept = await prisma.supportDepartment.upsert({
    where: { key: 'general-support' },
    update: {
      name: 'General Support',
      description: 'General customer support department handling onboarding, account questions, and first-line triage.',
      email: 'support@vellum.com',
      firstResponseSlaMinutes: 60,
      resolutionSlaMinutes: 2880,
      slaAdherenceTargetPct: 95,
      businessHoursStartMin: 540,
      businessHoursEndMin: 1080,
      businessDays: [1, 2, 3, 4, 5],
      timezone: 'America/New_York',
      budgetAllocated: 350000,
      resourceCapacityFte: 6,
    },
    create: {
      key: 'general-support',
      name: 'General Support',
      description: 'General customer support department handling onboarding, account questions, and first-line triage.',
      email: 'support@vellum.com',
      isActive: true,
      firstResponseSlaMinutes: 60,
      resolutionSlaMinutes: 2880,
      slaAdherenceTargetPct: 95,
      businessHoursStartMin: 540,
      businessHoursEndMin: 1080,
      businessDays: [1, 2, 3, 4, 5],
      timezone: 'America/New_York',
      budgetAllocated: 350000,
      resourceCapacityFte: 6,
    },
  });

  const techDept = await prisma.supportDepartment.upsert({
    where: { key: 'technical-support' },
    update: {
      name: 'Technical Support',
      description: 'Technical issues, bugs, platform stability, and API integration problems.',
      email: 'tech-support@vellum.com',
      firstResponseSlaMinutes: 30,
      resolutionSlaMinutes: 1440,
      slaAdherenceTargetPct: 97,
      businessHoursStartMin: 480,
      businessHoursEndMin: 1050,
      businessDays: [1, 2, 3, 4, 5],
      timezone: 'America/Los_Angeles',
      budgetAllocated: 480000,
      resourceCapacityFte: 8,
    },
    create: {
      key: 'technical-support',
      name: 'Technical Support',
      description: 'Technical issues, bugs, platform stability, and API integration problems.',
      email: 'tech-support@vellum.com',
      isActive: true,
      firstResponseSlaMinutes: 30,
      resolutionSlaMinutes: 1440,
      slaAdherenceTargetPct: 97,
      businessHoursStartMin: 480,
      businessHoursEndMin: 1050,
      businessDays: [1, 2, 3, 4, 5],
      timezone: 'America/Los_Angeles',
      budgetAllocated: 480000,
      resourceCapacityFte: 8,
    },
  });

  const billingDept = await prisma.supportDepartment.upsert({
    where: { key: 'billing-support' },
    update: {
      name: 'Billing Support',
      description: 'Billing, payments, subscription management, and refunds.',
      email: 'billing@vellum.com',
      firstResponseSlaMinutes: 90,
      resolutionSlaMinutes: 1920,
      slaAdherenceTargetPct: 94,
      businessHoursStartMin: 540,
      businessHoursEndMin: 1020,
      businessDays: [1, 2, 3, 4, 5],
      timezone: 'Europe/London',
      budgetAllocated: 220000,
      resourceCapacityFte: 4,
    },
    create: {
      key: 'billing-support',
      name: 'Billing Support',
      description: 'Billing, payments, subscription management, and refunds.',
      email: 'billing@vellum.com',
      isActive: true,
      firstResponseSlaMinutes: 90,
      resolutionSlaMinutes: 1920,
      slaAdherenceTargetPct: 94,
      businessHoursStartMin: 540,
      businessHoursEndMin: 1020,
      businessDays: [1, 2, 3, 4, 5],
      timezone: 'Europe/London',
      budgetAllocated: 220000,
      resourceCapacityFte: 4,
    },
  });

  // ─── 2. Teams ───────────────────────────────────────────────────────────────
  console.log('Seeding support teams (6 teams across 3 departments)...');

  const tier1Team = await prisma.supportTeam.upsert({
    where: { departmentId_name: { departmentId: generalDept.id, name: 'Tier 1 Support' } },
    update: {
      description: 'First-line general support agents handling initial triage, onboarding, and FAQ.',
      slaInheritFromDept: true,
      businessHoursInherit: true,
      maxTicketsPerAgent: 20,
      concurrentTicketLimitPerAgent: 10,
      skillSpecialization: 'GENERAL',
    },
    create: {
      name: 'Tier 1 Support',
      departmentId: generalDept.id,
      description: 'First-line general support agents handling initial triage, onboarding, and FAQ.',
      slaInheritFromDept: true,
      businessHoursInherit: true,
      maxTicketsPerAgent: 20,
      concurrentTicketLimitPerAgent: 10,
      skillSpecialization: 'GENERAL',
      businessDays: [1, 2, 3, 4, 5],
    },
  });

  const customerSuccessTeam = await prisma.supportTeam.upsert({
    where: { departmentId_name: { departmentId: generalDept.id, name: 'Customer Success' } },
    update: {
      description: 'Customer success team: proactive outreach, renewals, and value-delivery follow-ups.',
      slaInheritFromDept: true,
      businessHoursInherit: true,
      maxTicketsPerAgent: 12,
      concurrentTicketLimitPerAgent: 6,
      skillSpecialization: 'CUSTOMER_SUCCESS',
    },
    create: {
      name: 'Customer Success',
      departmentId: generalDept.id,
      description: 'Customer success team: proactive outreach, renewals, and value-delivery follow-ups.',
      slaInheritFromDept: true,
      businessHoursInherit: true,
      maxTicketsPerAgent: 12,
      concurrentTicketLimitPerAgent: 6,
      skillSpecialization: 'CUSTOMER_SUCCESS',
      businessDays: [1, 2, 3, 4, 5],
    },
  });

  const tier2Team = await prisma.supportTeam.upsert({
    where: { departmentId_name: { departmentId: techDept.id, name: 'Tier 2 Support' } },
    update: {
      description: 'Second-line technical escalation engineers handling bugs, API issues, and product malfunctions.',
      slaInheritFromDept: true,
      businessHoursInherit: true,
      maxTicketsPerAgent: 15,
      concurrentTicketLimitPerAgent: 8,
      skillSpecialization: 'TECHNICAL',
    },
    create: {
      name: 'Tier 2 Support',
      departmentId: techDept.id,
      description: 'Second-line technical escalation engineers handling bugs, API issues, and product malfunctions.',
      slaInheritFromDept: true,
      businessHoursInherit: true,
      maxTicketsPerAgent: 15,
      concurrentTicketLimitPerAgent: 8,
      skillSpecialization: 'TECHNICAL',
      businessDays: [1, 2, 3, 4, 5],
    },
  });

  const devRelTeam = await prisma.supportTeam.upsert({
    where: { departmentId_name: { departmentId: techDept.id, name: 'Developer Relations' } },
    update: {
      description: 'Developer relations and integrations engineers assisting with SDKs, APIs, and Webhooks.',
      slaInheritFromDept: false,
      firstResponseSlaMinutes: 60,
      resolutionSlaMinutes: 2160,
      businessHoursInherit: false,
      businessHoursStartMin: 540,
      businessHoursEndMin: 1080,
      timezone: 'UTC',
      maxTicketsPerAgent: 14,
      concurrentTicketLimitPerAgent: 7,
      skillSpecialization: 'API_INTEGRATION',
    },
    create: {
      name: 'Developer Relations',
      departmentId: techDept.id,
      description: 'Developer relations and integrations engineers assisting with SDKs, APIs, and Webhooks.',
      slaInheritFromDept: false,
      firstResponseSlaMinutes: 60,
      resolutionSlaMinutes: 2160,
      businessHoursInherit: false,
      businessHoursStartMin: 540,
      businessHoursEndMin: 1080,
      businessDays: [1, 2, 3, 4, 5],
      timezone: 'UTC',
      maxTicketsPerAgent: 14,
      concurrentTicketLimitPerAgent: 7,
      skillSpecialization: 'API_INTEGRATION',
    },
  });

  const billingTeam = await prisma.supportTeam.upsert({
    where: { departmentId_name: { departmentId: billingDept.id, name: 'Billing Team' } },
    update: {
      description: 'Billing and payment specialists handling invoices, receipts, and charge verification.',
      slaInheritFromDept: true,
      businessHoursInherit: true,
      maxTicketsPerAgent: 12,
      concurrentTicketLimitPerAgent: 6,
      skillSpecialization: 'BILLING',
    },
    create: {
      name: 'Billing Team',
      departmentId: billingDept.id,
      description: 'Billing and payment specialists handling invoices, receipts, and charge verification.',
      slaInheritFromDept: true,
      businessHoursInherit: true,
      maxTicketsPerAgent: 12,
      concurrentTicketLimitPerAgent: 6,
      skillSpecialization: 'BILLING',
      businessDays: [1, 2, 3, 4, 5],
    },
  });

  const subscriptionsTeam = await prisma.supportTeam.upsert({
    where: { departmentId_name: { departmentId: billingDept.id, name: 'Subscriptions & Refunds' } },
    update: {
      description: 'Subscription lifecycle management, refunds, cancellations, and discount/credits.',
      slaInheritFromDept: false,
      firstResponseSlaMinutes: 120,
      resolutionSlaMinutes: 2880,
      businessHoursInherit: true,
      maxTicketsPerAgent: 10,
      concurrentTicketLimitPerAgent: 5,
      skillSpecialization: 'SUBSCRIPTIONS',
    },
    create: {
      name: 'Subscriptions & Refunds',
      departmentId: billingDept.id,
      description: 'Subscription lifecycle management, refunds, cancellations, and discount/credits.',
      slaInheritFromDept: false,
      firstResponseSlaMinutes: 120,
      resolutionSlaMinutes: 2880,
      businessHoursInherit: true,
      maxTicketsPerAgent: 10,
      concurrentTicketLimitPerAgent: 5,
      skillSpecialization: 'SUBSCRIPTIONS',
      businessDays: [1, 2, 3, 4, 5],
    },
  });

  // For backwards compat, also reference the old 3 teams by existing variables
  // (code lower in file still uses `tier1Team`, `tier2Team`, `billingTeam` for SupportAgent.teamId)

  // ─── 3. Ticket Categories ────────────────────────────────────────────────────
  console.log('Seeding ticket categories...');

  const catAccount = await prisma.ticketCategory.upsert({
    where: { key: 'account-issues' },
    update: { name: 'Account Issues', description: 'Login, registration, and account management' },
    create: { key: 'account-issues', name: 'Account Issues', description: 'Login, registration, and account management', sortOrder: 1 },
  });
  const catBug = await prisma.ticketCategory.upsert({
    where: { key: 'technical-bug' },
    update: { name: 'Technical Bug', description: 'Software bugs and technical errors' },
    create: { key: 'technical-bug', name: 'Technical Bug', description: 'Software bugs and technical errors', sortOrder: 2 },
  });
  const catBilling = await prisma.ticketCategory.upsert({
    where: { key: 'billing-question' },
    update: { name: 'Billing Question', description: 'Payment and subscription inquiries' },
    create: { key: 'billing-question', name: 'Billing Question', description: 'Payment and subscription inquiries', sortOrder: 3 },
  });
  const catFeature = await prisma.ticketCategory.upsert({
    where: { key: 'feature-request' },
    update: { name: 'Feature Request', description: 'User-submitted feature suggestions' },
    create: { key: 'feature-request', name: 'Feature Request', description: 'User-submitted feature suggestions', sortOrder: 4 },
  });
  const catHowTo = await prisma.ticketCategory.upsert({
    where: { key: 'how-to' },
    update: { name: 'How-To', description: 'How-to and usage questions' },
    create: { key: 'how-to', name: 'How-To', description: 'How-to and usage questions', sortOrder: 5 },
  });
  const catAbuse = await prisma.ticketCategory.upsert({
    where: { key: 'report-abuse' },
    update: { name: 'Report Abuse', description: 'Abuse, harassment, and spam reports' },
    create: { key: 'report-abuse', name: 'Report Abuse', description: 'Abuse, harassment, and spam reports', sortOrder: 6 },
  });

  // ─── 4. SLA Policies ────────────────────────────────────────────────────────
  console.log('Seeding SLA policies...');

  await findOrCreateSlaPolicy({
    name: 'Standard Response',
    departmentId: generalDept.id,
    priority: 'MEDIUM',
    firstResponseMinutes: 480,
    resolutionMinutes: 2880,
    escalationMinutes: 4320,
  });
  await findOrCreateSlaPolicy({
    name: 'Priority Response',
    departmentId: techDept.id,
    priority: 'HIGH',
    firstResponseMinutes: 120,
    resolutionMinutes: 720,
    escalationMinutes: 1440,
  });
  await findOrCreateSlaPolicy({
    name: 'Critical Response',
    departmentId: techDept.id,
    priority: 'CRITICAL',
    firstResponseMinutes: 30,
    resolutionMinutes: 240,
    escalationMinutes: 360,
  });
  await findOrCreateSlaPolicy({
    name: 'Billing Response',
    departmentId: billingDept.id,
    priority: 'MEDIUM',
    firstResponseMinutes: 360,
    resolutionMinutes: 1440,
    escalationMinutes: 2880,
  });

  // ─── 5. Users ────────────────────────────────────────────────────────────────
  console.log('Seeding users...');

  // 4 General Users (role: USER — closest to REGISTERED_USER in the Role enum)
  const alexMorgan = await prisma.user.upsert({
    where: { email: 'alex.morgan@example.com' },
    update: { name: 'Alex Morgan', role: 'USER', bio: 'Software developer and avid reader', passwordHash, emailVerified: now },
    create: { email: 'alex.morgan@example.com', passwordHash, handle: 'alex.morgan', name: 'Alex Morgan', role: 'USER', emailVerified: now, bio: 'Software developer and avid reader' },
  });
  const jordanTaylor = await prisma.user.upsert({
    where: { email: 'jordan.taylor@example.com' },
    update: { name: 'Jordan Taylor', role: 'USER', bio: 'Product manager and tech enthusiast', passwordHash, emailVerified: now },
    create: { email: 'jordan.taylor@example.com', passwordHash, handle: 'jordan.taylor', name: 'Jordan Taylor', role: 'USER', emailVerified: now, bio: 'Product manager and tech enthusiast' },
  });
  const caseyBrown = await prisma.user.upsert({
    where: { email: 'casey.brown@example.com' },
    update: { name: 'Casey Brown', role: 'USER', bio: 'UX designer and coffee enthusiast', passwordHash, emailVerified: now },
    create: { email: 'casey.brown@example.com', passwordHash, handle: 'casey.brown', name: 'Casey Brown', role: 'USER', emailVerified: now, bio: 'UX designer and coffee enthusiast' },
  });
  const morganWilson = await prisma.user.upsert({
    where: { email: 'morgan.wilson@example.com' },
    update: { name: 'Morgan Wilson', role: 'USER', bio: 'Content writer and blogger', passwordHash, emailVerified: now },
    create: { email: 'morgan.wilson@example.com', passwordHash, handle: 'morgan.wilson', name: 'Morgan Wilson', role: 'USER', emailVerified: now, bio: 'Content writer and blogger' },
  });

  // 4 Support Agents (role: MODERATOR — closest to CUSTOMER_SUPPORT in the Role enum)
  const sarahChen = await prisma.user.upsert({
    where: { email: 'sarah.chen@vellum.com' },
    update: { name: 'Sarah Chen', role: 'MODERATOR', bio: 'Senior technical support engineer', passwordHash, emailVerified: now },
    create: { email: 'sarah.chen@vellum.com', passwordHash, handle: 'sarah.chen', name: 'Sarah Chen', role: 'MODERATOR', emailVerified: now, bio: 'Senior technical support engineer' },
  });
  const mikeJohnson = await prisma.user.upsert({
    where: { email: 'mike.johnson@vellum.com' },
    update: { name: 'Mike Johnson', role: 'MODERATOR', bio: 'Customer support specialist', passwordHash, emailVerified: now },
    create: { email: 'mike.johnson@vellum.com', passwordHash, handle: 'mike.johnson', name: 'Mike Johnson', role: 'MODERATOR', emailVerified: now, bio: 'Customer support specialist' },
  });
  const emmaWatson = await prisma.user.upsert({
    where: { email: 'emma.watson@vellum.com' },
    update: { name: 'Emma Watson', role: 'MODERATOR', bio: 'Billing support representative', passwordHash, emailVerified: now },
    create: { email: 'emma.watson@vellum.com', passwordHash, handle: 'emma.watson', name: 'Emma Watson', role: 'MODERATOR', emailVerified: now, bio: 'Billing support representative' },
  });
  const jamesRodriguez = await prisma.user.upsert({
    where: { email: 'james.rodriguez@vellum.com' },
    update: { name: 'James Rodriguez', role: 'MODERATOR', bio: 'Technical support engineer', passwordHash, emailVerified: now },
    create: { email: 'james.rodriguez@vellum.com', passwordHash, handle: 'james.rodriguez', name: 'James Rodriguez', role: 'MODERATOR', emailVerified: now, bio: 'Technical support engineer' },
  });

  // 2 Support Admins (role: SUPPORT_ADMIN — closest to SENIOR_SUPPORT in the Role enum)
  const priyaPatel = await prisma.user.upsert({
    where: { email: 'priya.patel@vellum.com' },
    update: { name: 'Priya Patel', role: 'SUPPORT_ADMIN', bio: 'Support team lead and administrator', passwordHash, emailVerified: now },
    create: { email: 'priya.patel@vellum.com', passwordHash, handle: 'priya.patel', name: 'Priya Patel', role: 'SUPPORT_ADMIN', emailVerified: now, bio: 'Support team lead and administrator' },
  });
  const davidKim = await prisma.user.upsert({
    where: { email: 'david.kim@vellum.com' },
    update: { name: 'David Kim', role: 'SUPPORT_ADMIN', bio: 'Senior support administrator and head of technical support.', passwordHash, emailVerified: now },
    create: { email: 'david.kim@vellum.com', passwordHash, handle: 'david.kim', name: 'David Kim', role: 'SUPPORT_ADMIN', emailVerified: now, bio: 'Senior support administrator and head of technical support.' },
  });

  // 4 Additional Support Agents (10 total) — mix of MODERATOR agents for the 6 teams
  const linaGarcia = await prisma.user.upsert({
    where: { email: 'lina.garcia@vellum.com' },
    update: { name: 'Lina Garcia', role: 'MODERATOR', bio: 'Customer success manager focusing on enterprise renewals.', passwordHash, emailVerified: now },
    create: { email: 'lina.garcia@vellum.com', passwordHash, handle: 'lina.garcia', name: 'Lina Garcia', role: 'MODERATOR', emailVerified: now, bio: 'Customer success manager focusing on enterprise renewals.' },
  });
  const rajPatel = await prisma.user.upsert({
    where: { email: 'raj.patel@vellum.com' },
    update: { name: 'Raj Patel', role: 'MODERATOR', bio: 'Developer advocate specializing in SDK and webhook integrations.', passwordHash, emailVerified: now },
    create: { email: 'raj.patel@vellum.com', passwordHash, handle: 'raj.patel', name: 'Raj Patel', role: 'MODERATOR', emailVerified: now, bio: 'Developer advocate specializing in SDK and webhook integrations.' },
  });
  const sophieDubois = await prisma.user.upsert({
    where: { email: 'sophie.dubois@vellum.com' },
    update: { name: 'Sophie Dubois', role: 'MODERATOR', bio: 'Subscription lifecycle and refund coordinator, handling EU region.', passwordHash, emailVerified: now },
    create: { email: 'sophie.dubois@vellum.com', passwordHash, handle: 'sophie.dubois', name: 'Sophie Dubois', role: 'MODERATOR', emailVerified: now, bio: 'Subscription lifecycle and refund coordinator, handling EU region.' },
  });
  const tomNguyen = await prisma.user.upsert({
    where: { email: 'tom.nguyen@vellum.com' },
    update: { name: 'Tom Nguyen', role: 'MODERATOR', bio: 'Tier 1 general support specialist covering weekends and APAC hours.', passwordHash, emailVerified: now },
    create: { email: 'tom.nguyen@vellum.com', passwordHash, handle: 'tom.nguyen', name: 'Tom Nguyen', role: 'MODERATOR', emailVerified: now, bio: 'Tier 1 general support specialist covering weekends and APAC hours.' },
  });

  // ─── 6. User Settings ────────────────────────────────────────────────────────
  console.log('Ensuring user settings (14 total)...');
  const agentUsers = [sarahChen, mikeJohnson, emmaWatson, jamesRodriguez, priyaPatel, davidKim, linaGarcia, rajPatel, sophieDubois, tomNguyen];
  const allUsers = [alexMorgan, jordanTaylor, caseyBrown, morganWilson, ...agentUsers];
  for (const user of allUsers) {
    await ensureUserSettings(user.id);
  }

  // ─── 7. SupportAgent Records (10 total) ───────────────────────────────────────
  console.log('Seeding support agent profiles (10 agents)...');

  // Helper: idempotent get-or-create support agent for a user
  async function upsertAgent(user: { id: string }, opts: { departmentId: string; teamId: string; status?: any; maxTickets: number; activeTickets?: number; skills: string[] }) {
    return prisma.supportAgent.upsert({
      where: { userId: user.id },
      update: { departmentId: opts.departmentId, teamId: opts.teamId, status: opts.status ?? 'ONLINE', maxTickets: opts.maxTickets, activeTickets: opts.activeTickets ?? 0, skills: opts.skills, isActive: true },
      create: { userId: user.id, departmentId: opts.departmentId, teamId: opts.teamId, status: opts.status ?? 'ONLINE', maxTickets: opts.maxTickets, activeTickets: opts.activeTickets ?? 0, skills: opts.skills, isActive: true },
    });
  }

  const agentSarah = await upsertAgent(sarahChen, { departmentId: techDept.id, teamId: tier2Team.id, status: 'ONLINE', maxTickets: 15, activeTickets: 4, skills: ['typescript', 'api', 'debugging', 'database'] });
  const agentMike = await upsertAgent(mikeJohnson, { departmentId: generalDept.id, teamId: tier1Team.id, status: 'BUSY', maxTickets: 20, activeTickets: 3, skills: ['accounts', 'general', 'onboarding'] });
  const agentEmma = await upsertAgent(emmaWatson, { departmentId: billingDept.id, teamId: billingTeam.id, status: 'ONLINE', maxTickets: 10, activeTickets: 2, skills: ['billing', 'payments', 'refunds', 'subscriptions'] });
  const agentJames = await upsertAgent(jamesRodriguez, { departmentId: techDept.id, teamId: tier2Team.id, status: 'AWAY', maxTickets: 12, activeTickets: 3, skills: ['infrastructure', 'devops', 'networking', 'security'] });
  const agentPriya = await upsertAgent(priyaPatel, { departmentId: generalDept.id, teamId: tier1Team.id, status: 'ONLINE', maxTickets: 5, activeTickets: 0, skills: ['escalation', 'management', 'training', 'policy'] });
  const agentDavid = await upsertAgent(davidKim, { departmentId: techDept.id, teamId: tier2Team.id, status: 'ONLINE', maxTickets: 5, activeTickets: 0, skills: ['escalation', 'architecture', 'security', 'compliance'] });
  const agentLina = await upsertAgent(linaGarcia, { departmentId: generalDept.id, teamId: customerSuccessTeam.id, status: 'ONLINE', maxTickets: 12, activeTickets: 2, skills: ['customer-success', 'renewals', 'qbr', 'enterprise'] });
  const agentRaj = await upsertAgent(rajPatel, { departmentId: techDept.id, teamId: devRelTeam.id, status: 'ONLINE', maxTickets: 14, activeTickets: 3, skills: ['sdk', 'webhooks', 'openapi', 'graphql', 'python'] });
  const agentSophie = await upsertAgent(sophieDubois, { departmentId: billingDept.id, teamId: subscriptionsTeam.id, status: 'BUSY', maxTickets: 10, activeTickets: 2, skills: ['subscriptions', 'refunds', 'vat', 'eu-tax'] });
  const agentTom = await upsertAgent(tomNguyen, { departmentId: generalDept.id, teamId: tier1Team.id, status: 'ONLINE', maxTickets: 20, activeTickets: 4, skills: ['triage', 'faq', 'apac', 'escalation'] });

  const agentRecords = [agentSarah, agentMike, agentEmma, agentJames, agentPriya, agentDavid, agentLina, agentRaj, agentSophie, agentTom];

  // ─── 7b. Assign Department Heads & Team Leads ────────────────────────────────
  console.log('Assigning department heads and team leads...');

  await prisma.supportDepartment.update({ where: { id: generalDept.id }, data: { head: { connect: { id: priyaPatel.id } } } });
  await prisma.supportDepartment.update({ where: { id: techDept.id }, data: { head: { connect: { id: davidKim.id } } } });
  await prisma.supportDepartment.update({ where: { id: billingDept.id }, data: { head: { connect: { id: emmaWatson.id } } } });

  await prisma.supportTeam.update({ where: { id: tier1Team.id }, data: { lead: { connect: { id: mikeJohnson.id } } } });
  await prisma.supportTeam.update({ where: { id: customerSuccessTeam.id }, data: { lead: { connect: { id: linaGarcia.id } } } });
  await prisma.supportTeam.update({ where: { id: tier2Team.id }, data: { lead: { connect: { id: sarahChen.id } } } });
  await prisma.supportTeam.update({ where: { id: devRelTeam.id }, data: { lead: { connect: { id: rajPatel.id } } } });
  await prisma.supportTeam.update({ where: { id: billingTeam.id }, data: { lead: { connect: { id: emmaWatson.id } } } });
  await prisma.supportTeam.update({ where: { id: subscriptionsTeam.id }, data: { lead: { connect: { id: sophieDubois.id } } } });

  // ─── 7c. Agent ↔ Team Memberships (primary + cross-functional) ───────────────
  console.log('Seeding agent-team memberships (10 agents, each with primary team + 1 cross-functional membership)...');

  // helper: idempotent membership create-or-reactivate
  async function ensureMembership(agentId: string, teamId: string, opts: { isPrimary?: boolean; assignedBy?: string }) {
    const existing = await prisma.supportAgentTeamMembership.findFirst({
      where: { agentId, teamId, endDate: null },
    });
    if (existing) {
      if (opts.isPrimary) {
        // ensure it's the primary one for this agent
        await prisma.$transaction(async (tx) => {
          await tx.supportAgentTeamMembership.updateMany({
            where: { agentId, endDate: null },
            data: { isPrimary: false },
          });
          await tx.supportAgentTeamMembership.update({ where: { id: existing.id }, data: { isPrimary: true } });
        });
      }
      return existing;
    }
    return prisma.supportAgentTeamMembership.create({
      data: {
        agentId,
        teamId,
        isPrimary: !!opts.isPrimary,
        startDate: daysAgo(90),
        endDate: null,
        assignedBy: opts.assignedBy ?? priyaPatel.id,
        assignedAt: daysAgo(90),
      },
    });
  }

  const primaryAssignments: Array<[any, any, boolean]> = [
    [agentMike, tier1Team, true],
    [agentLina, customerSuccessTeam, true],
    [agentPriya, tier1Team, true], // also in CustomerSuccess cross-func below
    [agentTom, tier1Team, true],
    [agentSarah, tier2Team, true],
    [agentJames, tier2Team, true],
    [agentDavid, tier2Team, true], // also in DevRel cross-func
    [agentRaj, devRelTeam, true],
    [agentEmma, billingTeam, true], // also in subscriptions cross-func
    [agentSophie, subscriptionsTeam, true],
  ];
  for (const [agent, team, primary] of primaryAssignments) {
    await ensureMembership(agent.id, team.id, { isPrimary: primary, assignedBy: priyaPatel.id });
  }

  // Cross-functional memberships: 8 agents also assigned to a second team
  const crossAssignments: Array<[any, any]> = [
    [agentMike, customerSuccessTeam], // Tier 1 → CS for escalated renewal discussions
    [agentTom, tier2Team],            // Tier 1 → Tier 2 cross-trained
    [agentPriya, customerSuccessTeam],// Dept Head also serves CS
    [agentRaj, tier2Team],            // DevRel → Tier2 for bugs
    [agentDavid, devRelTeam],         // Tech dept head → DevRel
    [agentEmma, subscriptionsTeam],   // Billing → Subscriptions
    [agentSophie, billingTeam],       // Subscriptions → Billing (invoices)
    [agentLina, billingTeam],         // CS → Billing to coordinate pro-rated credits
  ];
  for (const [agent, team] of crossAssignments) {
    await ensureMembership(agent.id, team.id, { isPrimary: false, assignedBy: davidKim.id });
  }

  // ─── 8. Support Tickets + Messages + Notes + History + Assignments ──────────
  console.log('Seeding support tickets...');

  // Ticket definition type (inline to keep file self-contained)
  type TicketDef = {
    ticketNumber: string;
    subject: string;
    message: string;
    description?: string;
    type: 'CUSTOMER' | 'INTERNAL' | 'BUG_REPORT' | 'FEATURE_REQUEST' | 'TECHNICAL' | 'BILLING' | 'ABUSE' | 'MODERATION';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'EMERGENCY';
    status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_ON_CUSTOMER' | 'WAITING_ON_INTERNAL' | 'ESCALATED' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
    userId: string;
    assigneeId: string;
    departmentId: string;
    categoryId: string;
    assignedById?: string;
    assignmentReason?: string;
    createdAt: Date;
    firstResponseAt?: Date;
    resolvedAt?: Date;
    closedAt?: Date;
    reopenedAt?: Date;
    satisfaction?: number;
    messages: { authorId: string; body: string; isInternal: boolean; createdAt: Date }[];
    notes: { authorId: string; body: string; createdAt: Date }[];
    statusHistory: { fromStatus: string | null; toStatus: string; changedById: string; reason?: string; createdAt: Date }[];
  };

  const ticketDefs: TicketDef[] = [
    // 1 ──────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0001',
      subject: 'Cannot log in after password reset',
      message: 'I reset my password using the email link, but every time I try to log in I get an "invalid credentials" error. I have tried copying the password directly from the reset email.',
      description: 'User unable to authenticate after password reset',
      type: 'CUSTOMER',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      userId: alexMorgan.id,
      assigneeId: mikeJohnson.id,
      departmentId: generalDept.id,
      categoryId: catAccount.id,
      assignedById: priyaPatel.id,
      assignmentReason: 'Auto-assigned to Tier 1 based on category',
      createdAt: daysAgo(2),
      firstResponseAt: daysAgo(1),
      messages: [
        { authorId: alexMorgan.id, body: 'I reset my password using the email link, but every time I try to log in I get an "invalid credentials" error. I have tried copying the password directly from the reset email.', isInternal: false, createdAt: daysAgo(2) },
        { authorId: mikeJohnson.id, body: 'Hi Alex, thank you for reaching out. I am sorry to hear you are having trouble logging in. Can you confirm: (1) Did you receive a success message after resetting your password? (2) Are you using the correct email address? (3) Have you tried clearing your browser cache and cookies?', isInternal: false, createdAt: daysAgo(1) },
        { authorId: alexMorgan.id, body: 'Yes, I got a success message. I am using alex.morgan@example.com. I just tried clearing cache and cookies but I still get the same error.', isInternal: false, createdAt: hoursAgo(20) },
      ],
      notes: [
        { authorId: mikeJohnson.id, body: 'Checking auth service logs for this user. Might be a session caching issue on the server side. Escalating to engineering if not resolved by EOD.', createdAt: daysAgo(1) },
      ],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: alexMorgan.id, createdAt: daysAgo(2) },
        { fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: priyaPatel.id, reason: 'Auto-assigned to Tier 1', createdAt: daysAgo(1) },
        { fromStatus: 'ASSIGNED', toStatus: 'IN_PROGRESS', changedById: mikeJohnson.id, createdAt: hoursAgo(20) },
      ],
    },
    // 2 ──────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0002',
      subject: 'API returns 500 error on /articles endpoint',
      message: 'Every request to GET /api/v1/articles returns a 500 Internal Server Error. This started happening about an hour ago and is blocking our production application.',
      description: 'Critical API outage on articles endpoint',
      type: 'TECHNICAL',
      priority: 'CRITICAL',
      status: 'ASSIGNED',
      userId: jordanTaylor.id,
      assigneeId: sarahChen.id,
      departmentId: techDept.id,
      categoryId: catBug.id,
      assignedById: priyaPatel.id,
      assignmentReason: 'Critical priority — assigned to Tier 2 engineer',
      createdAt: hoursAgo(6),
      firstResponseAt: hoursAgo(5),
      messages: [
        { authorId: jordanTaylor.id, body: 'Every request to GET /api/v1/articles returns a 500 Internal Server Error. This started happening about an hour ago and is blocking our production application. We have not deployed any changes on our end.', isInternal: false, createdAt: hoursAgo(6) },
        { authorId: sarahChen.id, body: 'Hi Jordan, thank you for reporting this. I can see the 500 errors in our monitoring dashboard. I am investigating the root cause now and will provide an update within 30 minutes.', isInternal: false, createdAt: hoursAgo(5) },
      ],
      notes: [
        { authorId: sarahChen.id, body: 'Postgres connection pool exhausted. Looks like a leaked transaction in the articles service. Checking recent deployments.', createdAt: hoursAgo(5) },
      ],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: jordanTaylor.id, createdAt: hoursAgo(6) },
        { fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: priyaPatel.id, reason: 'Critical — assigned to Sarah Chen', createdAt: hoursAgo(5) },
      ],
    },
    // 3 ──────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0003',
      subject: 'Charged twice for monthly subscription',
      message: 'I was charged twice for my monthly subscription on August 5th. Both charges appear on my credit card statement. I would like a refund for the duplicate charge.',
      description: 'Duplicate billing charge — refund requested',
      type: 'BILLING',
      priority: 'HIGH',
      status: 'RESOLVED',
      userId: caseyBrown.id,
      assigneeId: emmaWatson.id,
      departmentId: billingDept.id,
      categoryId: catBilling.id,
      assignedById: priyaPatel.id,
      assignmentReason: 'Billing issue — assigned to billing team',
      createdAt: daysAgo(5),
      firstResponseAt: daysAgo(4),
      resolvedAt: daysAgo(3),
      satisfaction: 5,
      messages: [
        { authorId: caseyBrown.id, body: 'I was charged twice for my monthly subscription on August 5th. Both charges appear on my credit card statement. I would like a refund for the duplicate charge.', isInternal: false, createdAt: daysAgo(5) },
        { authorId: emmaWatson.id, body: 'Hi Casey, thank you for bringing this to our attention. I can see both charges in our system. I am processing a refund for the duplicate charge of $29.99. The refund should appear on your card within 3-5 business days.', isInternal: false, createdAt: daysAgo(4) },
        { authorId: caseyBrown.id, body: 'Thank you for the quick response. I will watch for the refund on my statement.', isInternal: false, createdAt: daysAgo(4) },
        { authorId: emmaWatson.id, body: 'Hi Casey, the refund has been processed successfully. You should see it reflected on your account within 3-5 business days. Is there anything else I can help you with?', isInternal: false, createdAt: daysAgo(3) },
      ],
      notes: [
        { authorId: emmaWatson.id, body: 'Confirmed duplicate charge in Stripe. Refund REF-8821 processed. Added flag to prevent future duplicate charges for this user.', createdAt: daysAgo(3) },
      ],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: caseyBrown.id, createdAt: daysAgo(5) },
        { fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: priyaPatel.id, reason: 'Assigned to billing team', createdAt: daysAgo(4) },
        { fromStatus: 'ASSIGNED', toStatus: 'IN_PROGRESS', changedById: emmaWatson.id, createdAt: daysAgo(4) },
        { fromStatus: 'IN_PROGRESS', toStatus: 'RESOLVED', changedById: emmaWatson.id, reason: 'Refund processed', createdAt: daysAgo(3) },
      ],
    },
    // 4 ──────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0004',
      subject: 'Feature request: dark mode for mobile app',
      message: 'I would love to see a dark mode option in the mobile app. Reading at night with the current bright theme is hard on the eyes. This is a very common feature in modern apps.',
      description: 'User-submitted feature request for dark mode',
      type: 'FEATURE_REQUEST',
      priority: 'LOW',
      status: 'NEW',
      userId: morganWilson.id,
      assigneeId: mikeJohnson.id,
      departmentId: generalDept.id,
      categoryId: catFeature.id,
      createdAt: hoursAgo(3),
      messages: [
        { authorId: morganWilson.id, body: 'I would love to see a dark mode option in the mobile app. Reading at night with the current bright theme is hard on the eyes. This is a very common feature in modern apps and I think it would greatly improve the user experience.', isInternal: false, createdAt: hoursAgo(3) },
      ],
      notes: [],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: morganWilson.id, createdAt: hoursAgo(3) },
      ],
    },
    // 5 ──────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0005',
      subject: 'How do I export my articles to PDF?',
      message: 'I want to download my published articles as PDF files for offline reference. I cannot find an export option anywhere in the settings or article pages.',
      description: 'How-to question about article export',
      type: 'CUSTOMER',
      priority: 'LOW',
      status: 'WAITING_ON_CUSTOMER',
      userId: alexMorgan.id,
      assigneeId: mikeJohnson.id,
      departmentId: generalDept.id,
      categoryId: catHowTo.id,
      assignedById: priyaPatel.id,
      assignmentReason: 'General how-to question',
      createdAt: daysAgo(1),
      firstResponseAt: hoursAgo(20),
      messages: [
        { authorId: alexMorgan.id, body: 'I want to download my published articles as PDF files for offline reference. I cannot find an export option anywhere in the settings or article pages. Is this feature available?', isInternal: false, createdAt: daysAgo(1) },
        { authorId: mikeJohnson.id, body: 'Hi Alex, great question! You can export your articles by navigating to your profile page, clicking on the article you want to export, and then clicking the "Export" button in the top-right corner. You will see options for PDF, Markdown, and HTML. Could you try that and let me know if it works for you?', isInternal: false, createdAt: hoursAgo(20) },
      ],
      notes: [],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: alexMorgan.id, createdAt: daysAgo(1) },
        { fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: priyaPatel.id, createdAt: hoursAgo(20) },
        { fromStatus: 'ASSIGNED', toStatus: 'WAITING_ON_CUSTOMER', changedById: mikeJohnson.id, reason: 'Awaiting user confirmation', createdAt: hoursAgo(20) },
      ],
    },
    // 6 ──────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0006',
      subject: 'Comment section showing spam content',
      message: 'The comment section on my latest article is filled with spam links to suspicious websites. I have tried deleting them but more keep appearing. Can you help?',
      description: 'Spam comments on user article',
      type: 'ABUSE',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      userId: jordanTaylor.id,
      assigneeId: jamesRodriguez.id,
      departmentId: techDept.id,
      categoryId: catAbuse.id,
      assignedById: priyaPatel.id,
      assignmentReason: 'Abuse report — assigned to moderation team',
      createdAt: hoursAgo(12),
      firstResponseAt: hoursAgo(10),
      messages: [
        { authorId: jordanTaylor.id, body: 'The comment section on my latest article is filled with spam links to suspicious websites. I have tried deleting them manually but more keep appearing every few minutes. This is really affecting the reader experience.', isInternal: false, createdAt: hoursAgo(12) },
        { authorId: jamesRodriguez.id, body: 'Hi Jordan, thank you for reporting this. I can see the spam comments you are referring to. I am implementing additional spam filters for your article and investigating the source. In the meantime, I have temporarily enabled comment moderation so new comments require approval before appearing.', isInternal: false, createdAt: hoursAgo(10) },
      ],
      notes: [
        { authorId: jamesRodriguez.id, body: 'Spam coming from a botnet using rotating IPs. Added IP range to blocklist and enabled rate limiting on comments. Will monitor for 24 hours.', createdAt: hoursAgo(10) },
      ],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: jordanTaylor.id, createdAt: hoursAgo(12) },
        { fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: priyaPatel.id, createdAt: hoursAgo(10) },
        { fromStatus: 'ASSIGNED', toStatus: 'IN_PROGRESS', changedById: jamesRodriguez.id, createdAt: hoursAgo(10) },
      ],
    },
    // 7 ──────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0007',
      subject: 'Cannot upload profile picture',
      message: 'Every time I try to upload a profile picture, I get an error saying "Upload failed. Please try again." I have tried different image formats (PNG, JPG) and sizes but nothing works.',
      description: 'Profile picture upload failing — escalated',
      type: 'TECHNICAL',
      priority: 'HIGH',
      status: 'ESCALATED',
      userId: caseyBrown.id,
      assigneeId: sarahChen.id,
      departmentId: techDept.id,
      categoryId: catBug.id,
      assignedById: davidKim.id,
      assignmentReason: 'Escalated to Tier 2 — media upload service issue',
      createdAt: daysAgo(3),
      firstResponseAt: daysAgo(2),
      messages: [
        { authorId: caseyBrown.id, body: 'Every time I try to upload a profile picture, I get an error saying "Upload failed. Please try again." I have tried different image formats (PNG, JPG) and sizes but nothing works. This has been happening for 2 days.', isInternal: false, createdAt: daysAgo(3) },
        { authorId: sarahChen.id, body: 'Hi Casey, I am sorry to hear about the upload issues. I can see the failed upload attempts in our logs. It looks like there is an issue with our media processing service. I am investigating and will escalate to our engineering team if needed.', isInternal: false, createdAt: daysAgo(2) },
        { authorId: caseyBrown.id, body: 'Thank you for looking into this. I really need to update my profile picture for an upcoming presentation. Is there a workaround I can use in the meantime?', isInternal: false, createdAt: daysAgo(1) },
      ],
      notes: [
        { authorId: sarahChen.id, body: 'Image processing service returning 502 errors. Issue is in the thumbnail generation pipeline. Filing a bug report with engineering.', createdAt: daysAgo(2) },
        { authorId: sarahChen.id, body: 'Escalated to engineering. They confirmed the issue is in the media service and are working on a fix. ETA: 24 hours.', createdAt: daysAgo(1) },
      ],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: caseyBrown.id, createdAt: daysAgo(3) },
        { fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: davidKim.id, createdAt: daysAgo(2) },
        { fromStatus: 'ASSIGNED', toStatus: 'IN_PROGRESS', changedById: sarahChen.id, createdAt: daysAgo(2) },
        { fromStatus: 'IN_PROGRESS', toStatus: 'ESCALATED', changedById: sarahChen.id, reason: 'Escalated to engineering for media service fix', createdAt: daysAgo(1) },
      ],
    },
    // 8 ──────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0008',
      subject: 'Requesting refund for unused subscription',
      message: 'I cancelled my subscription last month but was still charged for this month. I would like a refund since I am not using the service anymore.',
      description: 'Refund request for subscription charged after cancellation',
      type: 'BILLING',
      priority: 'MEDIUM',
      status: 'WAITING_ON_CUSTOMER',
      userId: morganWilson.id,
      assigneeId: emmaWatson.id,
      departmentId: billingDept.id,
      categoryId: catBilling.id,
      assignedById: priyaPatel.id,
      assignmentReason: 'Billing refund request',
      createdAt: daysAgo(4),
      firstResponseAt: daysAgo(3),
      messages: [
        { authorId: morganWilson.id, body: 'I cancelled my subscription last month but was still charged for this month. I would like a refund since I am not using the service anymore. My cancellation confirmation number is CNL-4471.', isInternal: false, createdAt: daysAgo(4) },
        { authorId: emmaWatson.id, body: 'Hi Morgan, thank you for providing your cancellation number. I can see that your cancellation was processed on July 28th, but the billing cycle for August had already started on July 25th. Can you confirm if you received a prorated refund notification when you cancelled? This will help me determine the correct refund amount.', isInternal: false, createdAt: daysAgo(3) },
      ],
      notes: [],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: morganWilson.id, createdAt: daysAgo(4) },
        { fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: priyaPatel.id, createdAt: daysAgo(3) },
        { fromStatus: 'ASSIGNED', toStatus: 'WAITING_ON_CUSTOMER', changedById: emmaWatson.id, reason: 'Awaiting cancellation confirmation details', createdAt: daysAgo(3) },
      ],
    },
    // 9 ──────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0009',
      subject: 'Article not appearing in search results',
      message: 'My article "Advanced TypeScript Patterns" is not showing up in search results even when I search for the exact title. Other articles with similar topics appear fine.',
      description: 'Search indexing issue for specific article',
      type: 'TECHNICAL',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      userId: alexMorgan.id,
      assigneeId: jamesRodriguez.id,
      departmentId: techDept.id,
      categoryId: catBug.id,
      assignedById: priyaPatel.id,
      assignmentReason: 'Search indexing issue — assigned to technical team',
      createdAt: hoursAgo(18),
      firstResponseAt: hoursAgo(16),
      messages: [
        { authorId: alexMorgan.id, body: 'My article "Advanced TypeScript Patterns" is not showing up in search results even when I search for the exact title. Other articles with similar topics appear fine. The article is published and visible on my profile page.', isInternal: false, createdAt: hoursAgo(18) },
        { authorId: jamesRodriguez.id, body: 'Hi Alex, I can see the article on your profile but it is indeed missing from search results. I am checking the search index and it looks like the article was not properly indexed when it was published. I am triggering a re-index now.', isInternal: false, createdAt: hoursAgo(16) },
      ],
      notes: [],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: alexMorgan.id, createdAt: hoursAgo(18) },
        { fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: priyaPatel.id, createdAt: hoursAgo(16) },
        { fromStatus: 'ASSIGNED', toStatus: 'IN_PROGRESS', changedById: jamesRodriguez.id, createdAt: hoursAgo(16) },
      ],
    },
    // 10 ─────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0010',
      subject: 'Two-factor authentication not sending codes',
      message: 'I enabled 2FA on my account but I am not receiving the verification codes via SMS or email. I have been locked out of my account for 3 hours and need urgent access.',
      description: '2FA codes not being delivered — critical lockout',
      type: 'TECHNICAL',
      priority: 'CRITICAL',
      status: 'ESCALATED',
      userId: jordanTaylor.id,
      assigneeId: sarahChen.id,
      departmentId: techDept.id,
      categoryId: catAccount.id,
      assignedById: davidKim.id,
      assignmentReason: 'Critical — account lockout due to 2FA failure',
      createdAt: hoursAgo(8),
      firstResponseAt: hoursAgo(7),
      messages: [
        { authorId: jordanTaylor.id, body: 'I enabled 2FA on my account but I am not receiving the verification codes via SMS or email. I have been locked out of my account for 3 hours and need urgent access. I have verified my phone number and email are correct.', isInternal: false, createdAt: hoursAgo(8) },
        { authorId: sarahChen.id, body: 'Hi Jordan, this is a priority issue and I am looking into it immediately. I can see that 2FA was enabled but the code delivery service appears to be experiencing issues. I am temporarily disabling 2FA on your account so you can log in, and I will investigate the code delivery problem.', isInternal: false, createdAt: hoursAgo(7) },
        { authorId: jordanTaylor.id, body: 'Thank you for the quick response. I was able to log in after you disabled 2FA. Please let me know when it is safe to re-enable it.', isInternal: false, createdAt: hoursAgo(6) },
      ],
      notes: [
        { authorId: sarahChen.id, body: 'SMS gateway experiencing intermittent failures. Email codes going to spam folder for some users. Escalating to infrastructure team to check SMS provider status.', createdAt: hoursAgo(7) },
      ],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: jordanTaylor.id, createdAt: hoursAgo(8) },
        { fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: davidKim.id, reason: 'Critical — escalated to Sarah Chen', createdAt: hoursAgo(7) },
        { fromStatus: 'ASSIGNED', toStatus: 'IN_PROGRESS', changedById: sarahChen.id, createdAt: hoursAgo(7) },
        { fromStatus: 'IN_PROGRESS', toStatus: 'ESCALATED', changedById: sarahChen.id, reason: 'SMS gateway issue — escalated to infrastructure', createdAt: hoursAgo(6) },
      ],
    },
    // 11 ─────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0011',
      subject: 'Want to delete my account',
      message: 'I would like to permanently delete my account and all associated data. Please confirm what data will be removed and how long the process takes.',
      description: 'Account deletion request — completed',
      type: 'CUSTOMER',
      priority: 'LOW',
      status: 'CLOSED',
      userId: caseyBrown.id,
      assigneeId: mikeJohnson.id,
      departmentId: generalDept.id,
      categoryId: catAccount.id,
      assignedById: priyaPatel.id,
      assignmentReason: 'Account management — Tier 1',
      createdAt: daysAgo(10),
      firstResponseAt: daysAgo(9),
      resolvedAt: daysAgo(8),
      closedAt: daysAgo(7),
      satisfaction: 4,
      messages: [
        { authorId: caseyBrown.id, body: 'I would like to permanently delete my account and all associated data. Please confirm what data will be removed and how long the process takes.', isInternal: false, createdAt: daysAgo(10) },
        { authorId: mikeJohnson.id, body: 'Hi Casey, I understand you would like to delete your account. When we process a deletion, the following data is removed: profile information, articles, comments, likes, bookmarks, and session data. The process takes up to 30 days for complete removal from all systems. Would you like me to proceed with the deletion?', isInternal: false, createdAt: daysAgo(9) },
        { authorId: caseyBrown.id, body: 'Yes, please proceed. I have downloaded a copy of my articles already. Thank you for the clear explanation.', isInternal: false, createdAt: daysAgo(9) },
      ],
      notes: [
        { authorId: mikeJohnson.id, body: 'User confirmed deletion. Initiated GDPR deletion workflow. Account scheduled for permanent deletion in 30 days. Soft-deleted immediately.', createdAt: daysAgo(8) },
      ],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: caseyBrown.id, createdAt: daysAgo(10) },
        { fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: priyaPatel.id, createdAt: daysAgo(9) },
        { fromStatus: 'ASSIGNED', toStatus: 'IN_PROGRESS', changedById: mikeJohnson.id, createdAt: daysAgo(9) },
        { fromStatus: 'IN_PROGRESS', toStatus: 'RESOLVED', changedById: mikeJohnson.id, reason: 'Account deletion processed', createdAt: daysAgo(8) },
        { fromStatus: 'RESOLVED', toStatus: 'CLOSED', changedById: mikeJohnson.id, reason: 'Auto-closed after 24 hours', createdAt: daysAgo(7) },
      ],
    },
    // 12 ─────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0012',
      subject: 'Payment method update failing',
      message: 'I am trying to update my credit card on file but keep getting an error saying "Payment method could not be updated." My card is valid and has sufficient funds.',
      description: 'Payment method update failing — investigation in progress',
      type: 'BILLING',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      userId: morganWilson.id,
      assigneeId: emmaWatson.id,
      departmentId: billingDept.id,
      categoryId: catBilling.id,
      assignedById: priyaPatel.id,
      assignmentReason: 'Billing issue — assigned to billing team',
      createdAt: daysAgo(1),
      firstResponseAt: hoursAgo(22),
      messages: [
        { authorId: morganWilson.id, body: 'I am trying to update my credit card on file but keep getting an error saying "Payment method could not be updated." My card is valid and has sufficient funds. I have tried both the website and mobile app.', isInternal: false, createdAt: daysAgo(1) },
        { authorId: emmaWatson.id, body: 'Hi Morgan, I am sorry to hear you are having trouble updating your payment method. I can see the error in our system. It appears to be related to our payment processor. I am investigating and will get back to you within a few hours.', isInternal: false, createdAt: hoursAgo(22) },
      ],
      notes: [
        { authorId: emmaWatson.id, body: 'Stripe API returning a generic error for this customer. Checking if the customer object has a lock from a previous failed transaction. May need to manually clear the payment intent.', createdAt: hoursAgo(22) },
      ],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: morganWilson.id, createdAt: daysAgo(1) },
        { fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: priyaPatel.id, createdAt: hoursAgo(22) },
        { fromStatus: 'ASSIGNED', toStatus: 'IN_PROGRESS', changedById: emmaWatson.id, createdAt: hoursAgo(22) },
      ],
    },
    // 13 ─────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0013',
      subject: 'Reporting harassment from another user',
      message: 'Another user has been sending me threatening messages and posting abusive comments on my articles. I have blocked them but they keep creating new accounts.',
      description: 'Harassment report — investigating user',
      type: 'ABUSE',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      userId: alexMorgan.id,
      assigneeId: jamesRodriguez.id,
      departmentId: techDept.id,
      categoryId: catAbuse.id,
      assignedById: priyaPatel.id,
      assignmentReason: 'Abuse report — high priority',
      createdAt: hoursAgo(5),
      firstResponseAt: hoursAgo(4),
      messages: [
        { authorId: alexMorgan.id, body: 'Another user has been sending me threatening messages and posting abusive comments on my articles. I have blocked them but they keep creating new accounts to harass me. This has been going on for a week.', isInternal: false, createdAt: hoursAgo(5) },
        { authorId: jamesRodriguez.id, body: 'Hi Alex, I am very sorry to hear about this. Harassment is taken very seriously. I am reviewing the reported accounts and implementing IP-based restrictions to prevent further account creation. I will also escalate this to our trust and safety team for a permanent ban.', isInternal: false, createdAt: hoursAgo(4) },
      ],
      notes: [
        { authorId: jamesRodriguez.id, body: 'Identified 3 accounts created from the same IP range. Banning all accounts and adding IP to blocklist. Escalating to trust and safety for potential legal action.', createdAt: hoursAgo(4) },
      ],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: alexMorgan.id, createdAt: hoursAgo(5) },
        { fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: priyaPatel.id, createdAt: hoursAgo(4) },
        { fromStatus: 'ASSIGNED', toStatus: 'IN_PROGRESS', changedById: jamesRodriguez.id, createdAt: hoursAgo(4) },
      ],
    },
    // 14 ─────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0014',
      subject: 'Suggestion: add markdown support in comments',
      message: 'It would be great if comments supported markdown formatting so users could format code snippets, bold text, and links properly.',
      description: 'Feature request — markdown in comments',
      type: 'FEATURE_REQUEST',
      priority: 'LOW',
      status: 'NEW',
      userId: jordanTaylor.id,
      assigneeId: mikeJohnson.id,
      departmentId: generalDept.id,
      categoryId: catFeature.id,
      createdAt: hoursAgo(1),
      messages: [
        { authorId: jordanTaylor.id, body: 'It would be great if comments supported markdown formatting so users could format code snippets, bold text, and links properly. Currently comments are plain text only, which makes it hard to share code examples.', isInternal: false, createdAt: hoursAgo(1) },
      ],
      notes: [],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: jordanTaylor.id, createdAt: hoursAgo(1) },
      ],
    },
    // 15 ─────────────────────────────────────────────────────────────────────────
    {
      ticketNumber: 'TKT-SA-0015',
      subject: 'Export to PDF not working',
      message: 'The "Export to PDF" button on articles is not working. When I click it, nothing happens — no download starts and no error message appears.',
      description: 'PDF export broken — reopened after initial fix',
      type: 'TECHNICAL',
      priority: 'MEDIUM',
      status: 'REOPENED',
      userId: caseyBrown.id,
      assigneeId: sarahChen.id,
      departmentId: techDept.id,
      categoryId: catBug.id,
      assignedById: priyaPatel.id,
      assignmentReason: 'Technical bug — assigned to Tier 2',
      createdAt: daysAgo(7),
      firstResponseAt: daysAgo(6),
      resolvedAt: daysAgo(5),
      reopenedAt: daysAgo(2),
      messages: [
        { authorId: caseyBrown.id, body: 'The "Export to PDF" button on articles is not working. When I click it, nothing happens — no download starts and no error message appears. I have tried on Chrome and Safari.', isInternal: false, createdAt: daysAgo(7) },
        { authorId: sarahChen.id, body: 'Hi Casey, thank you for reporting this. I found the issue — the PDF generation library had a version conflict. I have deployed a fix. Could you please try the export again?', isInternal: false, createdAt: daysAgo(6) },
        { authorId: caseyBrown.id, body: 'It worked for a day but now the export is broken again. The button does nothing, same as before.', isInternal: false, createdAt: daysAgo(2) },
        { authorId: sarahChen.id, body: 'Hi Casey, I am sorry the issue has returned. I am reopening the ticket and investigating further. It seems like a caching issue this time. I will get a permanent fix deployed.', isInternal: false, createdAt: daysAgo(2) },
      ],
      notes: [
        { authorId: sarahChen.id, body: 'Initial fix was a library version bump. Recurrence suggests a deeper issue with the PDF service worker cache. Need to investigate service worker lifecycle.', createdAt: daysAgo(2) },
      ],
      statusHistory: [
        { fromStatus: null, toStatus: 'NEW', changedById: caseyBrown.id, createdAt: daysAgo(7) },
        { fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: priyaPatel.id, createdAt: daysAgo(6) },
        { fromStatus: 'ASSIGNED', toStatus: 'IN_PROGRESS', changedById: sarahChen.id, createdAt: daysAgo(6) },
        { fromStatus: 'IN_PROGRESS', toStatus: 'RESOLVED', changedById: sarahChen.id, reason: 'Library version fix deployed', createdAt: daysAgo(5) },
        { fromStatus: 'RESOLVED', toStatus: 'REOPENED', changedById: caseyBrown.id, reason: 'Issue recurred after initial fix', createdAt: daysAgo(2) },
      ],
    },
  ];

  // ─── Create Tickets + Messages + Notes + History + Assignments ─────────────
  for (const def of ticketDefs) {
    const ticket = await prisma.supportTicket.upsert({
      where: { ticketNumber: def.ticketNumber },
      update: {
        subject: def.subject,
        message: def.message,
        description: def.description,
        type: def.type as any,
        priority: def.priority as any,
        status: def.status as any,
        userId: def.userId,
        assigneeId: def.assigneeId,
        departmentId: def.departmentId,
        categoryId: def.categoryId,
        firstResponseAt: def.firstResponseAt,
        resolvedAt: def.resolvedAt,
        closedAt: def.closedAt,
        reopenedAt: def.reopenedAt,
        satisfaction: def.satisfaction,
      },
      create: {
        ticketNumber: def.ticketNumber,
        subject: def.subject,
        message: def.message,
        description: def.description,
        type: def.type as any,
        priority: def.priority as any,
        status: def.status as any,
        userId: def.userId,
        assigneeId: def.assigneeId,
        departmentId: def.departmentId,
        categoryId: def.categoryId,
        firstResponseAt: def.firstResponseAt,
        resolvedAt: def.resolvedAt,
        closedAt: def.closedAt,
        reopenedAt: def.reopenedAt,
        satisfaction: def.satisfaction,
        createdAt: def.createdAt,
      },
    });

    // Messages — only create if none exist (idempotent)
    const msgCount = await prisma.ticketMessage.count({ where: { ticketId: ticket.id } });
    if (msgCount === 0) {
      for (const msg of def.messages) {
        await prisma.ticketMessage.create({
          data: {
            ticketId: ticket.id,
            authorId: msg.authorId,
            body: msg.body,
            isInternal: msg.isInternal,
            createdAt: msg.createdAt,
          },
        });
      }
    }

    // Internal notes — only create if none exist (idempotent)
    const noteCount = await prisma.ticketInternalNote.count({ where: { ticketId: ticket.id } });
    if (noteCount === 0) {
      for (const note of def.notes) {
        await prisma.ticketInternalNote.create({
          data: {
            ticketId: ticket.id,
            authorId: note.authorId,
            body: note.body,
            createdAt: note.createdAt,
          },
        });
      }
    }

    // Status history — only create if none exists (idempotent)
    const historyCount = await prisma.ticketStatusHistory.count({ where: { ticketId: ticket.id } });
    if (historyCount === 0) {
      for (const hist of def.statusHistory) {
        await prisma.ticketStatusHistory.create({
          data: {
            ticketId: ticket.id,
            fromStatus: hist.fromStatus as any,
            toStatus: hist.toStatus as any,
            changedById: hist.changedById,
            reason: hist.reason,
            createdAt: hist.createdAt,
          },
        });
      }
    }

    // Assignment — create if assignee exists and no active assignment
    if (def.assigneeId) {
      const existingAssignment = await prisma.ticketAssignment.findFirst({
        where: { ticketId: ticket.id, agentId: def.assigneeId, isActive: true },
      });
      if (!existingAssignment) {
        await prisma.ticketAssignment.create({
          data: {
            ticketId: ticket.id,
            agentId: def.assigneeId,
            assignedBy: def.assignedById,
            reason: def.assignmentReason,
            isActive: true,
            createdAt: def.firstResponseAt || def.createdAt,
          },
        });
      }
    }
  }

  console.log(`Seeded ${ticketDefs.length} support tickets with messages, notes, and history.`);

  // ─── 9. Activity Logs ────────────────────────────────────────────────────────
  console.log('Seeding activity logs...');

  // Check if activity logs already exist for our seeded tickets (idempotent)
  const seededTickets = await prisma.supportTicket.findMany({
    where: { ticketNumber: { startsWith: 'TKT-SA-' } },
    select: { id: true, ticketNumber: true, subject: true, userId: true, assigneeId: true, status: true, createdAt: true, firstResponseAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const existingLog = await prisma.activityLog.findFirst({
    where: { entityType: 'SupportTicket', entityId: { in: seededTickets.map((t) => t.id) } },
  });

  if (!existingLog) {
    for (const ticket of seededTickets) {
      // Ticket created
      await prisma.activityLog.create({
        data: {
          userId: ticket.userId,
          action: 'ticket_created',
          entityType: 'SupportTicket',
          entityId: ticket.id,
          details: { ticketNumber: ticket.ticketNumber, subject: ticket.subject },
          ipAddress: '192.168.1.100',
          createdAt: ticket.createdAt,
        },
      });

      // Ticket assigned
      if (ticket.assigneeId) {
        await prisma.activityLog.create({
          data: {
            userId: ticket.assigneeId,
            action: 'ticket_assigned',
            entityType: 'SupportTicket',
            entityId: ticket.id,
            details: { ticketNumber: ticket.ticketNumber, assigneeId: ticket.assigneeId },
            ipAddress: '192.168.1.101',
            createdAt: ticket.firstResponseAt || ticket.createdAt,
          },
        });
      }

      // Status changed (if not NEW)
      if (ticket.status !== 'NEW') {
        await prisma.activityLog.create({
          data: {
            userId: ticket.assigneeId || ticket.userId,
            action: 'ticket_status_changed',
            entityType: 'SupportTicket',
            entityId: ticket.id,
            details: { ticketNumber: ticket.ticketNumber, newStatus: ticket.status },
            ipAddress: '192.168.1.101',
            createdAt: ticket.firstResponseAt || ticket.createdAt,
          },
        });
      }
    }
    console.log(`Seeded activity logs for ${seededTickets.length} tickets.`);
  } else {
    console.log('Activity logs already exist — skipping.');
  }

  console.log('Support agent and ticket seed data created successfully!');
}

// Standalone runner: when executed directly via `ts-node prisma/seed-support-agents.ts`
// (rather than imported), create a PrismaClient, run the seed, and disconnect.
if (typeof require !== 'undefined' && require.main === module) {
  const prisma = new PrismaClient();
  seedSupportAgents(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}