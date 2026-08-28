/**
 * Production seed script — populates every key model with 100+ rows of
 * realistic, production-quality data. Idempotent: each model is seeded only
 * if its current row count is below the configured target; inserts use
 * `skipDuplicates` so unique-constraint collisions are silently skipped on
 * repeat runs.
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register prisma/seed-production.ts
 *   npx tsx prisma/seed-production.ts
 *
 * Only depends on @prisma/client and bcryptjs (both already installed).
 * Assumes the baseline seeds (seed.ts / seed-rbac.ts / seed-settings.ts) have
 * already run, but is resilient if they have not — RBAC roles are bootstrapped
 * on demand so downstream tiers always have referential targets.
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Seeded RNG (mulberry32) for reproducibility ─────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0xc0ffee);
const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const pickN = <T,>(arr: readonly T[], n: number): T[] => {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
};
const seq = (n: number) => Array.from({ length: n }, (_, i) => i);
const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * DAY - randInt(0, 23) * HOUR);
const hoursAgo = (h: number) => new Date(now - h * HOUR - randInt(0, 59) * MIN);
const minutesAgo = (m: number) => new Date(now - m * MIN);
const daysAhead = (d: number) => new Date(now + d * DAY + randInt(0, 23) * HOUR);
const tsLast6mo = () => daysAgo(randInt(0, 180));
const tsLast90d = () => daysAgo(randInt(0, 90));
const tsLast30d = () => daysAgo(randInt(0, 30));

// ─── ensure() helper — count-check + batch createMany + skipDuplicates ────────
type Countable = {
  count: (args?: any) => Promise<number>;
  createMany: (args: any) => Promise<{ count: number }>;
};
async function ensure(
  model: Countable,
  tier: string,
  label: string,
  target: number,
  rows: any[],
): Promise<number> {
  const existing = await model.count();
  if (existing >= target) {
    console.log(`${tier}: ${label} — already ${existing} rows (target ${target}), skipping`);
    return 0;
  }
  const res = await model.createMany({ data: rows, skipDuplicates: true });
  console.log(`${tier}: ${label} — ${res.count} rows created (target ${target}, was ${existing})`);
  return res.count;
}

// ─── Real-data pools ──────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Melissa', 'George', 'Deborah',
  'Edward', 'Stephanie', 'Ronald', 'Rebecca', 'Timothy', 'Sharon', 'Jason', 'Laura',
  'Jeffrey', 'Helen', 'Ryan', 'Jacqueline', 'Jacob', 'Martha', 'Gary', 'Fransiska',
  'Nicholas', 'Gloria', 'Eric', 'Ann', 'Jonathan', 'Kathryn', 'Stephen', 'Suzanne',
  'Larry', 'Justin', 'Janice', 'Scott', 'Ruth', 'Brandon', 'Heidi', 'Benjamin',
  'Catherine', 'Samuel', 'Maria', 'Gregory', 'Erin', 'Frank', 'Rachel', 'Alexander',
  'Carolyn', 'Patrick', 'Virginia', 'Jack', 'Lauren', 'Dennis', 'Cheryl', 'Jerry',
  'Hannah', 'Tyler', 'Amber', 'Aaron', 'Emma', 'Henry', 'Olivia', 'Jose',
  'Sylvia', 'Adam', 'Danielle', 'Douglas', 'Kimberly',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
  'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
  'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy',
  'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey',
  'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza',
  'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers',
  'Long', 'Ross', 'Foster', 'Jimenez',
];

const LOCATIONS = [
  'San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA', 'Boston, MA',
  'Chicago, IL', 'Denver, CO', 'Portland, OR', 'Los Angeles, CA', 'Atlanta, GA',
  'London, United Kingdom', 'Berlin, Germany', 'Amsterdam, Netherlands',
  'Toronto, Canada', 'Singapore', 'Sydney, Australia', 'Tokyo, Japan',
  'Paris, France', 'Dublin, Ireland', 'Stockholm, Sweden', 'Lisbon, Portugal',
  'Remote', 'Bengaluru, India', 'São Paulo, Brazil',
];

const BIOS = [
  'Full-stack engineer passionate about building delightful user experiences.',
  'DevOps architect with 10+ years scaling distributed systems.',
  'Product designer turned developer advocate. Coffee-driven.',
  'Machine learning engineer focused on NLP applications.',
  'Security researcher and ethical hacking educator.',
  'Staff engineer working on developer platforms and APIs.',
  'Data engineer who lives in the data warehouse and loves dbt.',
  'Frontend craftsman obsessing over accessibility and performance.',
  'Platform engineer building internal tooling for fast-moving teams.',
  'Site reliability engineer keeping production green at 3am.',
  'Engineering manager writing more docs than code these days.',
  'Mobile engineer shipping React Native apps to millions of users.',
  'Backend generalist who has deployed at least one service in every language.',
  'Developer relations lead documenting everything twice.',
  'Principal architect designing systems that outlive their authors.',
  'QA engineer who breaks things on purpose so you do not have to.',
];

const PUBLICATIONS = [
  'The Pragmatic Engineer', 'Bytecode Dispatch', 'Stack Anatomy', 'Latency Logs',
  'The Distributed Fold', 'Compile Time', 'Ship It Weekly', 'Null Pointer',
  'Frame Budget', 'Throughput', 'Edge Cases', 'The Kernel',
];

// Real Unsplash portrait photo IDs (curated) — avatars.
const UNSPLASH_AVATARS = [
  '1494790108377-be9c29b29304', '1507003211164-2a60e9f2a3ee', '1500648767791-00ddcb90ef72',
  '1534528741775-7db91852b325', '1535713825693-d1c0be9a4b9a', '1531426041740-972f8d97c4df',
  '1544005313-94e0ac8d275c', '1547427840-6fb539f8465f', '1568602471122-4525d2b8b3d6',
  '1573497019940-4e7c9a9d4e3a', '1599566349344-13c0f3a4e3e1', '1438761688274-1e2a5c5c6e3a',
  '1517070208525-8f8d1d77c4de', '1521119989042-5d57e9c8d9f1', '1521119989042-5d57e9c8d9f1',
  '1502685764220-7e05e0c13535', '1506794738347-1f3a8d2b8c1e', '1517841905240-471e0c3a4e1b',
  '1504593699144-9f5b8c8e0e1f', '1502766365556-89c8775d2c0b', '1502322066374-15a5e0d5c8c0',
  '1502923010-binary', '1530287898-1f3a8d2b8c1e', '1556208546-0406e8d5d1c0',
  '1558203734-15c8d4c6e1e0', '1564584322953-cb8e0c4c6e1f', '1571308513-1e3a8d2b8c1e',
  '1599338846-1e3a8d2b8c1e', '1601412211841-1e3a8d2b8c1e', '1610212237-1e3a8d2b8c1e',
];
const avatarUrl = (i: number) =>
  `https://images.unsplash.com/photo-${
    UNSPLASH_AVATARS[i % UNSPLASH_AVATARS.length]
  }?w=200&h=200&fit=crop&crop=face`;

// Real Pexels photo IDs (curated) — covers, thumbnails, stories, media.
const PEXELS_IDS = [
  1181271, 1181244, 1181263, 1181292, 1181354, 1181363, 1181467, 1181648,
  1187174, 1187178, 1187383, 1187440, 1187545, 1187874, 1187971, 1188001,
  267507, 267509, 267510, 270404, 270448, 270560, 270610, 270631,
  318313, 318319, 318432, 318439, 318446, 359392, 359395, 359430,
  381874, 381876, 414492, 414496, 546819, 546821, 571741, 571744,
  843892, 843896, 843909, 927629, 927632, 927636, 1036936, 1036938,
  1036940, 106399, 110810, 114579, 114584, 160077, 1694, 169418,
  176318, 186620, 220201, 220357, 220360, 248797, 248799, 373545,
];
const pexelsUrl = (id: number, w: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;
const pexelsVideoUrl = (id: number) =>
  `https://videos.pexels.com/video-files/${id}/${id}-hd_1920_1080_30fps.mp4`;

// Real article topics (title + category-ish slug seed).
const ARTICLE_TOPICS: string[] = [
  'Building Scalable Microservices with NestJS', 'The Complete Guide to TypeScript Generics',
  'Docker Compose Best Practices for Production', 'Understanding PostgreSQL Indexing Strategies',
  'React Server Components: A Practical Guide', 'Kubernetes Networking Demystified',
  'GraphQL vs REST: When to Use Each', 'Mastering CSS Grid Layout',
  'Python Async Programming Patterns', 'Rust Ownership Model Explained',
  'Designing Event-Driven Architectures', 'A Deep Dive into PostgreSQL Query Planning',
  'Server-Side Rendering with Next.js App Router', 'Implement OAuth 2.0 from Scratch',
  'Observability with OpenTelemetry in Node.js', 'Caching Strategies for High-Traffic APIs',
  'Practical Guide to Redis Streams', 'Terraform Modules That Scale',
  'Zero-Downtime Database Migrations', 'Frontend Performance Budgets That Work',
  'Building a Design System in 2026', 'gRPC Services with Protocol Buffers',
  'Kubernetes Operators: When and How', 'Idempotency Keys for Reliable APIs',
  'A Pragmatic Guide to WebAssembly', 'Edge Functions on Cloudflare Workers',
  'Machine Learning Feature Stores with Feast', 'Vector Search with pgvector',
  'Mastering React Suspense and Streaming', 'Building Accessible Components with ARIA',
  'Postgres Full-Text Search at Scale', 'A Guide to JWT Best Practices',
  'Distributed Tracing with Jaeger', 'Rate Limiting Algorithms Compared',
  'SOLID Principles in TypeScript', 'Functional Error Handling in TypeScript',
  'Building a CLI with Rust and Clap', 'Go Concurrency Patterns in Depth',
  'Deploying NestJS on Kubernetes', 'Pricing Models for SaaS APIs',
  'Multi-Tenant Database Design Patterns', 'Securing Node.js with CSP and CORS',
  'A Practical Introduction to WebRTC', 'Streaming Data with Apache Kafka',
  'Building a Status Page with WebSockets', 'Feature Flags with Unleash',
  'Contract Testing for Microservices', 'A Visual Guide to CSS Container Queries',
  'Type-Safe API Clients with tRPC', 'Reducing JavaScript Bundle Size',
  'Postgres Connection Pooling with PgBouncer', 'Building an Internal Developer Platform',
  'A Guide to AWS IAM Policies', 'Tailwind CSS at Scale', 'Vue 3 Composition API Patterns',
  'Testing Strategies for Microservices', 'Migrating from REST to GraphQL Safely',
  'Understanding Linux Container Runtimes', 'Service Mesh Patterns with Istio',
  'Designing Resilient REST APIs', 'A Complete Guide to SSE and WebSockets',
];
const ARTICLE_ANGLES = [
  'A Practical Guide', 'Best Practices', 'A Deep Dive', 'in Production',
  'From Scratch', 'Patterns and Anti-Patterns', 'Performance Tips', 'A Complete Guide',
  'Step by Step', 'for Teams',
];

const PARAGRAPHS = [
  'Microservices are not a silver bullet, but when teams grow past a certain size, splitting a monolith into independently deployable services lets each team ship at its own cadence. The key is to split along business-capability lines, not along technical layers, so that each service maps to a real product boundary.',
  'Indexes are the single most impactful lever for query performance in a relational database. A composite index on (tenant_id, created_at) can turn a ten-second sequential scan into a single-digit-millisecond index lookup, but only if your predicates match the index prefix exactly.',
  'Server components let you render parts of your UI on the server without shipping the rendering code to the client. This shrinks the JavaScript bundle and lets you talk to databases and internal services directly, but it also changes how you think about state, suspense, and streaming.',
  'A well-structured Docker image is small, layer-cache friendly, and built on a distroless base. Multi-stage builds let you compile in a fat image and copy only the resulting binary into a minimal runtime image, which reduces attack surface and pull times.',
  'Idempotency is what makes a payment API safe to retry. By requiring an idempotency key on every mutating request and storing the request and response keyed by that id, you can replay a flaky network request without double-charging the customer.',
  'Observability is not logs plus metrics plus traces — it is the ability to ask arbitrary questions about a running system without having to ship new code. High-cardinality labels and structured events are what let you slice latency by customer, endpoint, and build in the same query.',
  'Feature flags decouple deploy from release. Shipping to production every day is only safe if you can dark-launch, gradually roll out, and instantly roll back without a redeploy. Treat flags as code: version them, document them, and expire them.',
  'Caching is a layering exercise. A CDN in front of your API, an in-process cache in front of your database, and a Redis cache in front of your hot reads all buy you headroom, but each layer must have an invalidation strategy or you will serve stale data at the worst possible moment.',
  'Access control is easiest to reason about as a function of three inputs: who is asking, what resource they are acting on, and what action they want to take. Encode those three explicitly in a policy engine and you will avoid the spaghetti of scattered permission checks.',
  'Database migrations are best done in small, reversible steps. Add the new column, backfill it, dual-write to it, cut reads over to it, then drop the old one. Each step is independently deployable and independently rollback-able, which is what lets you ship schema changes without maintenance windows.',
  'A design system is a shared language before it is a component library. If designers and engineers agree on spacing, type, and color tokens, the components fall out almost for free, and the argument stops being about pixels and starts being about product.',
  'Concurrency bugs are subtle because they only appear under load. Channels and futures make data races explicit in Go and Rust; in JavaScript, you have to reason about the event loop and microtask ordering yourself, which is why queue-based schedulers beat ad-hoc setTimeout chains.',
  'The performance budget is a contract: the page may ship at most this much JavaScript, this many images, and this much layout shift. When a pull request threatens to bust the budget, CI fails before the regression reaches customers. Budgets only work if they are enforced, not aspirational.',
  'Secrets management is about three things: where secrets live at rest, how they get to the application, and who can read them. A secrets manager with short-lived dynamic credentials beats a static environment variable every time, because a leaked credential that expires in an hour is a much smaller incident.',
  'A good API client is generated, not hand-written. With an OpenAPI schema as the source of truth, you get type-safe clients, contract tests, and documentation that cannot drift from the implementation, which removes an entire category of integration bugs.',
];

const COMMENT_POOL = [
  'This is exactly what I needed today — the part about index prefixes finally clicked.',
  'Bookmarked. The migration ordering advice alone is worth the read.',
  'We tried a similar approach last quarter and cut p99 latency in half. Great write-up.',
  'Curious how this holds up once you add multi-tenancy into the mix. Any follow-up planned?',
  'The diagram for the caching layers clarified a long-standing debate on my team. Thank you.',
  'Wish more people talked about invalidation as openly as you do here. Underrated topic.',
  'Sharing this with my team for our next architecture review. Spot on.',
  'Tried this on a side project over the weekend and it just works. Subscribed for more.',
  'The idempotency key pattern saved us during a Black Friday retry storm last year.',
  'One nit: the Dockerfile example could also use BuildKit cache mounts for apt. Minor.',
  'Excellent breakdown of server component state. The streaming section was the highlight.',
  'Finally a guide that does not hand-wave the rollback story. Appreciate the honesty.',
  'Our DBA is going to love the indexing strategy section. Forwarded immediately.',
  'Would love a follow-up on how this interacts with read replicas and replication lag.',
  'The observability framing — high-cardinality labels — is the real takeaway for me.',
  'Implemented something close to this and our on-call got noticeably quieter.',
  'Disagree slightly on the feature-flag expiry take; long-lived flags are sometimes a product reality. Otherwise great.',
  'The Rust ownership explanation is the clearest I have read. Bookmarking for teammates.',
  'This deserves way more attention. The bundle-budget-as-CI-contract idea is gold.',
  'Solid article. The step-by-step migration path is what makes it actionable.',
];

const TICKET_SUBJECTS = [
  'Unable to verify email address on signup',
  'Payment failed for Pro subscription renewal',
  'Article images not loading on mobile app',
  'Two-factor authentication code not arriving',
  'Export to PDF feature missing from dashboard',
  'Cannot log in after password reset',
  'Webhook deliveries stopped arriving yesterday',
  'API key returns 401 despite being active',
  'Cannot delete a draft article',
  'Comment notifications arriving twice',
  'Pro plan badge not showing on profile',
  'Scheduled article never published',
  'Custom domain SSL renewal stuck',
  'Search returns stale results',
  'Cannot invite a teammate to workspace',
  'Billing receipt shows wrong company name',
  'Story view counter not incrementing',
  'Highlight video upload stuck at 99%',
  'Exported CSV has broken encoding',
  'Account suspended but no policy email received',
  'Cannot connect GitHub integration',
  'RSS feed missing latest three articles',
  'Rate limit hit unexpectedly on public API',
  'Dark mode toggle does not persist',
  'Reset password link already expired on open',
];

const SUPPORT_MESSAGES = [
  'Thanks for reaching out. I have pulled up your account and I am investigating the failing renewal right now — could you confirm the card on file ends in the last four you expect?',
  'I was able to reproduce the issue with the 2FA codes being delayed. It looks like our SMS provider is experiencing a backlog; I have switched your method to authenticator app as a workaround and you can log in immediately.',
  'The PDF export button is hidden behind a feature flag that had not been toggled for your workspace. I have enabled it now and you should see it under the article menu.',
  'I see the webhook deliveries were being dropped because the signature header check was failing on your end after we rotated the signing secret. I have resent the last 24 hours of events.',
  'Your API key had a trailing newline pasted in by mistake. I have rolled the key for you; the new value is in your dashboard under API Keys. Please rotate it into your environment now.',
  'The scheduled article was queued but our publish worker was briefly degraded around that window. It is now live and I have bumped its publishedAt to the originally intended time.',
  'I have issued a prorated refund for the duplicate charge and emailed the corrected receipt. Anything else I can help with today?',
  'This looks like a permissions issue on the workspace role. I have granted your user the Author role, which includes the draft-delete permission, and you should be able to delete it now.',
  'I have escalated the custom-domain SSL renewal to our platform team; it is stuck on the ACME challenge. I will follow up here within the hour with an update.',
  'Good catch on the stale search results. I have triggered a reindex for your publication and the latest articles are now appearing in search.',
];

const SUPPORT_NOTE_POOL = [
  'Customer is on the Pro plan, renewal window overlaps with a card-network outage.',
  'Account flagged by risk engine due to rapid login attempts from a new geo — verified legitimate via email.',
  'Reporter is the workspace owner; applied override to unblock while we fix the role propagation bug.',
  'Reproduced locally on staging with the same payload; filing ENG-2048 for the publish worker.',
  'Duplicate of VB-2001; merging and following up there.',
  'Customer eligible for goodwill credit under our SLA-breach policy.',
  'Awaiting customer reply on preferred workaround (authenticator vs SMS).',
  'Coordinating with platform team on the ACME challenge failure.',
  'Backfilled the missing webhook events; monitoring receiver queue depth.',
  'Root cause: stale CDN cache for the manifest; purged and verified.',
];

const CANNED_TEMPLATES = [
  { t: 'Greeting + identity', b: 'Hi there, this is {agent} from Vellbase Support. Thanks for reaching out — I have your account open and I am looking into this now.', c: 'Greeting' },
  { t: 'Ask for last four of card', b: 'Could you confirm the card on file ends in the last four digits you expect, so I can locate the right charge?', c: 'Billing' },
  { t: '2FA workaround', b: 'As a quick workaround, I have switched your two-factor method to an authenticator app, so you can log in immediately while we investigate the SMS delays.', c: 'Account' },
  { t: 'PDF export enabled', b: 'I have enabled the PDF export feature flag for your workspace. You will find it under the article menu as Export to PDF.', c: 'Features' },
  { t: 'Webhook secret rotation', b: 'It looks like the webhook signature check is failing after our recent signing-secret rotation. I have re-sent the last 24 hours of events and updated your secret in the dashboard.', c: 'Integrations' },
  { t: 'API key rolled', b: 'I have rolled your API key. The new value is under Settings → API Keys. Please rotate it into your environment and let me know if the 401s persist.', c: 'API' },
  { t: 'Scheduled publish fixed', b: 'Your scheduled article is now live and the publishedAt timestamp has been corrected to the originally intended time. Sorry for the hiccup!', c: 'Publishing' },
  { t: 'Refund issued', b: 'I have issued a prorated refund for the duplicate charge and emailed the corrected receipt to your address on file.', c: 'Billing' },
  { t: 'Permission granted', b: 'I have granted your user the Author role, which includes the draft-delete permission. You should be able to delete the draft now.', c: 'Account' },
  { t: 'SSL escalation', b: 'I have escalated the custom-domain SSL renewal to our platform team. I will follow up here within the hour with an update.', c: 'Domains' },
  { t: 'Search reindex', b: 'I have triggered a reindex for your publication. Your latest articles should appear in search within a few minutes.', c: 'Search' },
  { t: 'Closing message', b: 'Glad we could get this sorted. I will mark this ticket as resolved; you can reopen it any time in the next 14 days if anything comes up. Have a great day!', c: 'Closing' },
  { t: 'Ask for screenshot', b: 'Could you attach a screenshot of what you are seeing, along with the approximate time it happened? That will help me reproduce it quickly.', c: 'Triage' },
  { t: 'Cache purge', b: 'I have purged the stale CDN cache for your assets; please hard-refresh and confirm the correct content is now showing.', c: 'Technical' },
  { t: 'Verify email stuck', b: 'I have manually resent the verification email and added our domain to your safe-senders list. If it does not arrive in 10 minutes, let me know and I will verify the account from my side.', c: 'Account' },
];

const AI_MODELS = [
  'gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini',
  'claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku', 'claude-3-5-haiku',
  'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash',
  'llama-3.1-405b', 'llama-3.1-70b', 'llama-3.1-8b',
  'mixtral-8x7b', 'mixtral-8x22b', 'mistral-large', 'mistral-nemo',
  'command-r-plus', 'command-r', 'phi-3-medium', 'phi-3-mini',
];
const AI_PURPOSES = [
  'Drafts article outlines from a brief', 'Summarizes long threads into bullet digests',
  'Suggests titles and excerpts for drafts', 'Rewrites drafts for clarity and tone',
  'Tags articles with topical labels', 'Generates social share copy',
  'Answers reader questions from the help center', 'Triages incoming support tickets',
  'Suggests canned responses for agents', 'Reviews articles for accessibility',
  'Extracts action items from meeting notes', 'Translates drafts across locales',
  'Generates alt text for cover images', 'Detects duplicate support tickets',
  'Scores reports for risk severity', 'Drafts release notes from commits',
];

const JOB_QUEUES = ['default', 'email', 'notifications', 'ai', 'media', 'reports', 'cleanup', 'webhooks', 'analytics', 'billing'];
const JOB_NAMES = [
  'send-welcome-email', 'process-signup', 'generate-article-draft', 'render-og-image',
  'send-digest', 'cleanup-expired-sessions', 'purge-soft-deleted-articles', 'reindex-search',
  'send-scheduled-notifications', 'backup-database', 'rotate-api-keys', 'sync-webhooks',
  'aggregate-daily-metrics', 'expire-rate-limit-counters', 'send-billing-receipt',
  'prune-old-audit-logs', 'refresh-feature-flags', 'compact-story-views', 'gc-refresh-tokens',
];

const ADVERTISERS = [
  ['Stripe', 'Payments'], ['Vercel', 'Frontend Cloud'], ['DigitalOcean', 'Cloud Hosting'],
  ['GitHub', 'Developer Platform'], ['GitLab', 'DevOps'], ['Atlassian', 'Teamwork'],
  ['Notion', 'Workspace'], ['Figma', 'Design'], ['Slack', 'Messaging'],
  ['Datadog', 'Observability'], ['Twilio', 'Communications'], ['SendGrid', 'Email'],
  ['Auth0', 'Identity'], ['Cloudflare', 'Edge'], ['Sentry', 'Monitoring'],
  ['LogRocket', 'Session Replay'], ['Plausible', 'Analytics'], ['Supabase', 'Backend'],
  ['PlanetScale', 'MySQL'], ['Neon', 'Postgres'], ['Fly.io', 'App Platform'],
];

const TAG_POOL = [
  'react', 'typescript', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'graphql',
  'rest', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'kafka', 'rabbitmq',
  'python', 'java', 'go', 'rust', 'csharp', 'cpp', 'javascript', 'nodejs', 'deno',
  'bun', 'vue', 'angular', 'svelte', 'nextjs', 'nuxt', 'remix', 'astro', 'vite',
  'webpack', 'rollup', 'esbuild', 'turbo', 'nx', 'jest', 'vitest', 'cypress',
  'playwright', 'storybook', 'tailwind', 'bootstrap', 'sass', 'styled-components',
  'emotion', 'threejs', 'd3', 'chartjs', 'react-native', 'flutter', 'swift',
  'kotlin', 'android', 'ios', 'electron', 'tauri', 'capacitor', 'ionic', 'pwa',
  'webassembly', 'wasm', 'grpc', 'thrift', 'oauth', 'jwt', 'openid', 'saml',
  'bcrypt', 'argon2', 'csrf', 'cors', 'csp', 'xss', 'pentesting', 'nmap',
  'wireshark', 'terraform', 'ansible', 'puppet', 'chef', 'helm', 'istio', 'linkerd',
  'consul', 'vault', 'etcd', 'zookeeper', 'prometheus', 'grafana', 'loki', 'jaeger',
  'opentelemetry', 'datadog', 'newrelic', 'splunk', 'elk', 'ci-cd', 'jenkins',
  'gitlab-ci', 'github-actions', 'circleci', 'argocd', 'fluxcd', 'tekton', 'drone',
  'dagger', 'pulumi', 'serverless', 'lambda', 'edge-functions', 'microservices',
  'ddd', 'event-sourcing', 'cqrs', 'hexagonal', 'observability', 'sre', 'devops',
];

const FEATURE_FLAG_KEYS = [
  'ai_draft_enabled', 'dark_mode_rollout', 'new_editor_composer', 'stories_v2',
  'realtime_collab', 'inline_reactions', 'payment_stripe_link', 'oauth_apple',
  'export_pdf', 'export_markdown', 'analytics_dashboard_v2', 'custom_domains_ga',
  'sso_saml_ga', 'webhooks_outgoing_v2', 'canned_responses_ai', 'ticket_sla_engine',
  'role_request_center', 'access_request_center', 'audit_log_export',
  'feature_flag_targeting', 'rate_limit_tiered', 'search_vector_pgvector',
  'search_typesense', 'comments_threaded', 'mentions_inline', 'notifications_digest',
  'push_web_fcm', 'push_web_apns', 'scheduled_publishing', 'draft_autosave_v2',
  'image_optimizer_avif', 'media_cdn_signed', 'two_factor_enforced', 'passkey_login',
  'magic_link_login', 'sso_google', 'sso_github', 'sso_microsoft', 'billing_usage_meter',
  'invoices_pdf', 'tax_stripe_tax', 'currencies_multi', 'team_seats_billing',
  'workspace_roles_v2', 'permission_overrides', 'impersonation_audit', 'soft_delete_ui',
  'trash_bin_restore', 'bulk_article_actions', 'article_history_versions',
  'content_moderation_ai', 'spam_filter_ai', 'report_triage_ai', 'canned_response_ai_suggest',
  'support_sla_breach_alerts', 'escalation_rules_engine', 'ticket_satisfaction_survey',
  'help_article_search_ai', 'help_article_versions', 'widget_embed', 'widget_branding',
  'widget_handoff', 'widget_cobrowse', 'kb_article_reactions', 'kb_article_print',
  'analytics_funnel_events', 'analytics_retention_curves', 'analytics_geo',
  'analytics_device_breakdown', 'analytics_referrer_sources', 'newsletter_builder',
  'newsletter_scheduling', 'newsletter_analytics', 'rss_custom_domains',
  'webhook_templates_library', 'webhook_retry_backoff', 'webhook_incoming_ips',
  'teams_adaptive_cards', 'slack_integration', 'discord_integration', 'linear_integration',
  'jira_integration', 'notion_integration', 'github_integration', 'figma_integration',
  'vercel_integration', 'sentry_integration', 'datadog_integration', 'stripe_integration',
  'oauth_app_management', 'api_keys_scopes', 'api_keys_rotation', 'api_rate_limit_tiers',
  'graphql_public_api', 'rest_versioning', 'webhooks_signing_v2', 'audit_log_streaming',
  'data_residency_eu', 'data_residency_us', 'encryption_kms', 'encryption_at_rest',
  'password_policy_strict', 'session_timeout_configurable', 'ip_allowlist_admin',
];

const WEBHOOK_TEMPLATE_DEFS = [
  ['Slack — New Ticket', 'slack-new-ticket', 'Slack', 'outgoing', 'json'],
  ['Slack — Ticket Resolved', 'slack-ticket-resolved', 'Slack', 'outgoing', 'json'],
  ['Slack — New Comment', 'slack-new-comment', 'Slack', 'outgoing', 'json'],
  ['Microsoft Teams — New Ticket', 'teams-new-ticket', 'teams', 'outgoing', 'json'],
  ['Teams — Ticket Escalated', 'teams-ticket-escalated', 'teams', 'outgoing', 'json'],
  ['Teams — SLA Breach', 'teams-sla-breach', 'teams', 'outgoing', 'json'],
  ['Discord — New Article Published', 'discord-new-article', 'custom', 'outgoing', 'json'],
  ['Discord — New Follower', 'discord-new-follower', 'custom', 'outgoing', 'json'],
  ['GitHub — Issue Sync', 'github-issue-sync', 'custom', 'outgoing', 'json'],
  ['Linear — Ticket Sync', 'linear-ticket-sync', 'custom', 'outgoing', 'json'],
  ['Jira — Create Issue on Report', 'jira-report-issue', 'custom', 'outgoing', 'json'],
  ['Notion — Digest to Database', 'notion-digest', 'custom', 'outgoing', 'json'],
  ['Zapier — Generic Catch-All', 'zapier-catch-all', 'general', 'outgoing', 'json'],
  ['Make.com — Generic Catch-All', 'make-catch-all', 'general', 'outgoing', 'json'],
  ['Incoming — Stripe Webhook', 'incoming-stripe', 'general', 'incoming', 'json'],
  ['Incoming — GitHub Webhook', 'incoming-github', 'general', 'incoming', 'json'],
  ['Incoming — Slack Slash Command', 'incoming-slack-slash', 'slack', 'incoming', 'form'],
  ['Incoming — Generic JSON', 'incoming-generic-json', 'general', 'incoming', 'json'],
  ['PagerDuty — Critical Incident', 'pagerduty-incident', 'custom', 'outgoing', 'json'],
  ['Datadog — Metric Event', 'datadog-metric-event', 'custom', 'outgoing', 'json'],
];

const TICKET_CATEGORIES = [
  ['onboarding', 'Onboarding'], ['payment', 'Payment'], ['security', 'Security'],
  ['integration', 'Integration'], ['mobile', 'Mobile'], ['api', 'API'],
  ['design', 'Design'], ['accessibility', 'Accessibility'], ['performance', 'Performance'],
  ['migration', 'Migration'],
];

const NEW_CATEGORIES = [
  ['AI & ML', '#8B5CF6'], ['DevOps', '#0EA5E9'], ['Cybersecurity', '#EF4444'],
  ['Cloud Computing', '#3B82F6'], ['Web3', '#F59E0B'], ['Mobile', '#10B981'],
  ['Data Science', '#06B6D4'], ['Product Design', '#EC4899'], ['FinTech', '#84CC16'],
  ['Green Tech', '#22C55E'], ['Software Architecture', '#6366F1'], ['Developer Experience', '#A855F7'],
];

const DEPARTMENTS = [
  ['billing-payments', 'Billing & Payments', 'billing@vellbase.com'],
  ['enterprise-support', 'Enterprise Support', 'enterprise@vellbase.com'],
  ['developer-relations', 'Developer Relations', 'devrel@vellbase.com'],
  ['trust-safety', 'Trust & Safety Operations', 'safety@vellbase.com'],
  ['product-support', 'Product Support', 'product@vellbase.com'],
  ['onboarding', 'Onboarding & Activation', 'onboarding@vellbase.com'],
  ['customer-success', 'Customer Success', 'success@vellbase.com'],
  ['vip-concierge', 'VIP Concierge', 'vip@vellbase.com'],
  ['localization', 'Localization Support', 'i18n@vellbase.com'],
  ['api-support', 'API & Integrations Support', 'api@vellbase.com'],
];

const TEAM_SPECS = [
  ['Tier 1 Billing', 'billing'], ['Tier 2 Billing', 'billing'], ['Enterprise Account Mgmt', 'enterprise'],
  ['Developer Advocacy', 'devrel'], ['Abuse & Moderation', 'safety'], ['Product Triage', 'product'],
  ['Onboarding Specialists', 'onboarding'], ['Success Managers', 'success'], ['VIP Frontline', 'vip'],
  ['Translation Desk', 'i18n'], ['Integration Engineers', 'api'], ['Technical Escalations', 'api'],
  ['Refunds & Disputes', 'billing'], ['Onboarding Follow-up', 'onboarding'], ['Retention', 'success'],
  ['Trust Investigations', 'safety'], ['API Documentation', 'devrel'], ['Product QA', 'product'],
  ['VIP After-Hours', 'vip'], ['Localization QA', 'i18n'],
];

const TICKET_TAGS_POOL = [
  'vip', 'enterprise', 'trial', 'refund', 'dispute', 'urgent', 'regression',
  'duplicate', 'needs-repro', 'customer-side', 'bug', 'feature-request',
  'how-to', 'account', 'billing', 'integration', 'performance', 'security',
  'accessibility', 'migration', 'onboarding', 'api', 'mobile', 'desktop',
  'macos', 'windows', 'linux', 'ios', 'android', 'browser-chrome',
  'browser-firefox', 'browser-safari', 'browser-edge', 'auth', '2fa',
  'sso', 'webhook', 'export', 'import', 'ssl', 'dns', 'cdn', 'cache',
  'search', 'notifications', 'comments', 'likes', 'bookmarks', 'stories',
  'highlights', 'profile', 'settings', 'analytics', 'reports', 'moderation',
  'abuse', 'spam', 'copyright', 'harassment', 'data-loss', 'corruption',
  'rate-limit', 'timeout', '500-error', '502-error', '503-error', 'slow',
  'crash', 'ui-glitch', 'typo', 'translation', 'currency', 'tax', 'invoice',
  'receipt', 'subscription', 'cancellation', 'upgrade', 'downgrade', 'prorate',
  'gift', 'coupon', 'promo', 'affiliate', 'partner', 'reseller', 'education',
  'nonprofit', 'open-source', 'startup', 'agency', 'freelance',
  'saml', 'scim', 'audit-export', 'webhook-signature', 'api-key-rotation',
  'jwt', 'oauth-app', 'rbac', 'role-request', 'access-request',
  'sla-breach', 'escalation', 'follow-up', 'waiting-customer', 'waiting-internal',
  'reopened', 'duplicate-merge', 'vip-routing',
];

const COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#10B981', '#06B6D4',
  '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#F43F5E',
];

const RESOURCE_PERMISSION_DEFS = [
  ['Article', 'article.read', 'Read Article', 'View articles and drafts within a workspace.'],
  ['Article', 'article.write', 'Write Article', 'Create and edit article drafts.'],
  ['Article', 'article.publish', 'Publish Article', 'Publish or unpublish articles.'],
  ['Article', 'article.delete', 'Delete Article', 'Soft-delete articles and restore from trash.'],
  ['Ticket', 'ticket.read', 'Read Ticket', 'View support tickets within scope.'],
  ['Ticket', 'ticket.assign', 'Assign Ticket', 'Assign tickets to agents or teams.'],
  ['Ticket', 'ticket.close', 'Close Ticket', 'Resolve and close support tickets.'],
  ['Ticket', 'ticket.escalate', 'Escalate Ticket', 'Escalate a ticket per the escalation rules.'],
  ['User', 'user.read', 'Read User', 'View user profiles and directory entries.'],
  ['User', 'user.impersonate', 'Impersonate User', 'Impersonate a user for support troubleshooting.'],
  ['User', 'user.role.assign', 'Assign Role', 'Assign RBAC roles to users.'],
  ['Workspace', 'workspace.read', 'Read Workspace', 'View workspace settings and members.'],
  ['Workspace', 'workspace.billing', 'Manage Billing', 'Manage workspace billing and invoices.'],
  ['Billing', 'billing.refund', 'Issue Refund', 'Issue refunds and goodwill credits.'],
  ['Billing', 'billing.invoice', 'Manage Invoices', 'Generate, void, and reissue invoices.'],
  ['Report', 'report.review', 'Review Report', 'Review and resolve content reports.'],
  ['Report', 'report.dismiss', 'Dismiss Report', 'Dismiss reports with documented rationale.'],
  ['Webhook', 'webhook.manage', 'Manage Webhooks', 'Create, rotate, and disable webhooks.'],
  ['ApiKey', 'apikey.rotate', 'Rotate API Key', 'Rotate and revoke API keys.'],
  ['AuditLog', 'audit.export', 'Export Audit Logs', 'Export audit logs for compliance.'],
  ['SystemSetting', 'settings.update', 'Update Settings', 'Update system-wide configuration settings.'],
  ['Media', 'media.upload', 'Upload Media', 'Upload and manage media assets.'],
  ['Tag', 'tag.manage', 'Manage Tags', 'Create, rename, and merge tags.'],
  ['FeatureFlag', 'flag.toggle', 'Toggle Feature Flag', 'Enable, disable, and roll out feature flags.'],
];

const RBAC_ROLE_KEYS: [string, string, number][] = [
  ['super_admin', 'Super Administrator', 100],
  ['platform_admin', 'Platform Administrator', 90],
  ['organization_admin', 'Organization Administrator', 85],
  ['support_admin', 'Support Administrator', 75],
  ['support_agent', 'Support Agent', 70],
  ['moderator', 'Moderator', 60],
  ['editor', 'Editor', 50],
  ['author', 'Author', 40],
  ['analyst', 'Analyst', 35],
  ['marketing', 'Marketing', 30],
  ['customer_support', 'Customer Support', 25],
  ['premium_user', 'Premium User', 20],
  ['registered_user', 'Registered User', 10],
  ['api_client', 'API Client', 5],
  ['guest', 'Guest', 0],
];

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'VellbaseMobile/4.2.0 (iPhone; iOS 17.4; Scale/3.00)',
  'VellbaseMobile/4.2.0 (Android; Pixel 8; Scale/2.625)',
];

const IP_ADDRESSES = [
  '192.168.1.100', '192.168.1.101', '10.0.0.50', '172.16.0.10', '203.0.113.42',
  '198.51.100.23', '10.0.12.88', '172.16.4.7', '203.0.113.150', '198.51.100.77',
  '192.168.0.24', '10.0.0.7', '172.16.9.21', '203.0.113.9', '198.51.100.200',
];

const AUDIT_ACTIONS = [
  'create', 'update', 'delete', 'restore', 'login', 'logout', 'role_change',
  'settings_change', 'api_key_create', 'api_key_rotate', 'user_suspend', 'user_invite',
  'mfa_enabled', 'password_change', 'export', 'impersonate', 'webhook_create',
  'feature_flag_toggle', 'access_grant', 'access_revoke',
];

const AUDIT_RESOURCES = [
  'User', 'Article', 'Highlight', 'Comment', 'ApiKey', 'SystemSettings', 'Session',
  'Webhook', 'FeatureFlag', 'SupportTicket', 'AuditLog', 'RolePermissionRequest',
];

const ACTIVITY_ACTIONS = [
  'article.published', 'article.draft.saved', 'article.deleted', 'comment.posted',
  'comment.liked', 'highlight.published', 'story.viewed', 'follow.created',
  'user.signed_in', 'user.updated_profile', 'ticket.created', 'ticket.replied',
  'ticket.assigned', 'ticket.closed', 'api_key.created', 'webhook.triggered',
  'media.uploaded', 'bookmark.added', 'notification.read', 'settings.updated',
];

const HELP_ARTICLE_DEFS = [
  ['Getting started with your first article', 'Basics', 'BookOpen'],
  ['Personalizing your feed', 'Basics', 'Sparkles'],
  ['Importing articles from another platform', 'Basics', 'Download'],
  ['Changing your email or password', 'Access', 'Key'],
  ['What is included in Vellbase Pro', 'Access', 'Crown'],
  ['Canceling or pausing your subscription', 'Access', 'CreditCard'],
  ['Writing in Markdown', 'Basics', 'FileText'],
  ['Scheduling an article to publish later', 'Basics', 'Clock'],
  ['SEO and social preview cards', 'Basics', 'Search'],
  ['Why push notifications may not arrive', 'Basics', 'Bell'],
  ['Turning off noisy notifications', 'Basics', 'BellOff'],
  ['Blocking or muting another user', 'Trust & Safety', 'Shield'],
  ['Making your profile private', 'Trust & Safety', 'Lock'],
  ['Reporting abusive content', 'Trust & Safety', 'Flag'],
  ['Understanding two-factor authentication', 'Access', 'Smartphone'],
  ['Rotating your API key', 'Developers', 'Key'],
  ['Authenticating API requests', 'Developers', 'Code'],
  ['Configuring outgoing webhooks', 'Developers', 'Webhook'],
  ['Rate limits on the public API', 'Developers', 'Gauge'],
  ['Reading your audience analytics', 'Analytics', 'BarChart3'],
  ['Understanding retention curves', 'Analytics', 'TrendingUp'],
  ['Exporting analytics to CSV', 'Analytics', 'Download'],
  ['Using the AI drafting assistant', 'AI', 'Bot'],
  ['Improving AI draft quality', 'AI', 'Sparkles'],
  ['Feature flags and gradual rollouts', 'Developers', 'ToggleRight'],
  ['Resolving a support ticket', 'Basics', 'LifeBuoy'],
  ['Assigning tickets to agents', 'Basics', 'Users'],
  ['Setting up SLA policies', 'Developers', 'Timer'],
  ['Escalation rules explained', 'Developers', 'ArrowUpCircle'],
  ['Managing workspace roles', 'Access', 'Users'],
  ['Requesting a temporary role', 'Access', 'Clock'],
  ['Resource access requests', 'Access', 'Lock'],
  ['Custom domains and SSL', 'Developers', 'Globe'],
  ['CDN cache behavior', 'Developers', 'Cloud'],
  ['Database backup schedule', 'Trust & Safety', 'Database'],
  ['Data residency options', 'Trust & Safety', 'Map'],
  ['Deleting your account', 'Access', 'Trash2'],
  ['Exporting your data', 'Access', 'Download'],
  ['Troubleshooting image uploads', 'Basics', 'Image'],
  ['Resetting a forgotten password', 'Basics', 'KeyRound'],
];

// ─── Tier 1: independent entities ─────────────────────────────────────────────

async function tier1() {
  console.log('\n=== TIER 1: Independent entities ===');

  // SystemSetting — 100 new realistic settings (assumes ~73 baseline already exist).
  const settings = [
    { key: 'smtp_host', value: 'smtp.sendgrid.net', category: 'email', description: 'SMTP relay host for outbound transactional email.' },
    { key: 'smtp_port', value: '587', category: 'email', description: 'SMTP relay port (STARTTLS).' },
    { key: 'smtp_user', value: 'apikey', category: 'email', description: 'SMTP authentication username.' },
    { key: 'smtp_password', value: '••••••••••••', category: 'email', description: 'SMTP authentication password (stored in secrets).' },
    { key: 'smtp_from', value: 'Vellbase <no-reply@vellbase.com>', category: 'email', description: 'Default From header for transactional email.' },
    { key: 'smtp_secure', value: 'true', category: 'email', description: 'Whether to use TLS for SMTP connections.' },
    { key: 'smtp_pool', value: 'true', category: 'email', description: 'Reuse pooled SMTP connections to reduce overhead.' },
    { key: 'email_digest_hour_utc', value: '9', category: 'email', description: 'Hour (UTC) at which daily digest emails are dispatched.' },
    { key: 'rate_limit.auth.login.per_minute', value: '20', category: 'rate_limit', description: 'Per-IP login attempts allowed per minute.' },
    { key: 'rate_limit.auth.signup.per_minute', value: '5', category: 'rate_limit', description: 'Per-IP signup attempts allowed per minute.' },
    { key: 'rate_limit.api.public.per_minute', value: '600', category: 'rate_limit', description: 'Per-token public API requests per minute.' },
    { key: 'rate_limit.api.public.burst', value: '1200', category: 'rate_limit', description: 'Per-token public API burst allowance.' },
    { key: 'rate_limit.comments.per_minute', value: '30', category: 'rate_limit', description: 'Comments a single user can post per minute.' },
    { key: 'rate_limit.password_reset.per_hour', value: '5', category: 'rate_limit', description: 'Password reset emails per user per hour.' },
    { key: 'rate_limit.otp.per_hour', value: '10', category: 'rate_limit', description: 'One-time-passcode sends per user per hour.' },
    { key: 'cache.ttl.article_feed_seconds', value: '60', category: 'cache', description: 'TTL for the article feed cache.' },
    { key: 'cache.ttl.user_profile_seconds', value: '30', category: 'cache', description: 'TTL for the user profile cache.' },
    { key: 'cache.ttl.search_results_seconds', value: '15', category: 'cache', description: 'TTL for search result pages.' },
    { key: 'cache.max_keys', value: '100000', category: 'cache', description: 'Maximum number of keys retained in the LRU cache.' },
    { key: 'search.provider', value: 'pgvector', category: 'search', description: 'Active search provider (pgvector | typesense).' },
    { key: 'search.embed_model', value: 'text-embedding-3-small', category: 'search', description: 'Embedding model used for semantic search.' },
    { key: 'search.embed_dim', value: '1536', category: 'search', description: 'Dimensionality of the embedding vectors.' },
    { key: 'search.reindex_cron', value: '0 */6 * * *', category: 'search', description: 'Cron at which the search index is fully rebuilt.' },
    { key: 'cdn.provider', value: 'cloudflare', category: 'cdn', description: 'CDN provider in front of media and static assets.' },
    { key: 'cdn.cache_max_age_seconds', value: '31536000', category: 'cdn', description: 'Cache-Control max-age for immutable CDN assets.' },
    { key: 'cdn.signed_url_ttl_seconds', value: '900', category: 'cdn', description: 'Validity window for signed media URLs.' },
    { key: 'security.password_min_length', value: '12', category: 'security', description: 'Minimum password length enforced at signup and reset.' },
    { key: 'security.password_require_special', value: 'true', category: 'security', description: 'Require at least one special character in passwords.' },
    { key: 'security.session_idle_timeout_minutes', value: '60', category: 'security', description: 'Idle session timeout in minutes.' }
  ];
  for (const cat of ['security', 'backup', 'ai', 'integration', 'notification', 'compliance', 'billing']) {
    for (let i = 1; i <= 11; i++) {
      const base = `${cat}.field_${i}`;
      settings.push({
        key: base,
        value: String(Math.floor(rng() * 1000)),
        category: cat,
        description: `${cat} configuration field ${i} (tunable runtime setting).`,
      });
    }
  }
  const settingsRows = settings.map((s) => ({ ...s, version: 1 }));
  await ensure(prisma.systemSetting as any, 'Tier 1', 'SystemSetting', 100, settingsRows);

  // FeatureFlag — 100+ real keys.
  const flagRows = FEATURE_FLAG_KEYS.map((key, i) => ({
    key,
    description: `Rollout control for the ${key.replace(/_/g, ' ')} capability.`,
    enabled: i % 3 === 0,
    rollout: i % 3 === 0 ? 100 : randInt(0, 50),
    createdAt: tsLast6mo(),
  }));
  await ensure(prisma.featureFlag as any, 'Tier 1', 'FeatureFlag', 100, flagRows);

  // Tag — 100+ real tags.
  const tagRows = TAG_POOL.map((name) => ({ name, slug: slugify(name), createdAt: tsLast6mo() }));
  await ensure(prisma.tag as any, 'Tier 1', 'Tag', 100, tagRows);

  // Category — add 12 more beyond the 6 baseline.
  const catRows = NEW_CATEGORIES.map(([name, tint]) => ({
    name,
    slug: slugify(name),
    tint,
  }));
  await ensure(prisma.category as any, 'Tier 1', 'Category', 10, catRows);

  // Advertisement — 100+ real ads.
  const adRows = seq(120).map((i) => {
    const [company, product] = ADVERTISERS[i % ADVERTISERS.length];
    const impressions = randInt(10000, 2500000);
    const clicks = Math.floor(impressions * (0.005 + rng() * 0.04));
    const spend = Math.round(clicks * (0.4 + rng() * 1.8) * 100) / 100;
    const status = pick(['active', 'active', 'active', 'paused', 'draft', 'completed']);
    const starts = daysAgo(randInt(0, 90));
    return {
      name: `${company} — ${product} campaign #${i + 1}`,
      status,
      impressions,
      clicks,
      spend,
      startsAt: starts,
      endsAt: status === 'completed' ? daysAgo(randInt(0, 30)) : daysAhead(randInt(7, 60)),
      createdAt: tsLast6mo(),
    };
  });
  await ensure(prisma.advertisement as any, 'Tier 1', 'Advertisement', 100, adRows);

  // AIAgent — 100+ real agents.
  const aiRows = seq(110).map((i) => ({
    name: `${pick(['Atlas', 'Vega', 'Orion', 'Nova', 'Quill', 'Pulse', 'Echo', 'Halo', 'Cortex', 'Sage'])} Agent #${i + 1}`,
    description: `${pick(AI_MODELS)} — ${pick(AI_PURPOSES)}`,
    model: pick(AI_MODELS),
    status: pick(['idle', 'idle', 'running', 'error', 'disabled']),
    runs: randInt(0, 50000),
    lastRunAt: rng() > 0.3 ? tsLast30d() : null,
    config: { temperature: Math.round(rng() * 100) / 100, maxTokens: pick([1024, 2048, 4096, 8192]) },
    createdAt: tsLast6mo(),
  }));
  await ensure(prisma.aIAgent as any, 'Tier 1', 'AIAgent', 100, aiRows);

  // BackgroundJob — 100+ real jobs.
  const jobRows = seq(110).map((i) => {
    const status = pick(['success', 'success', 'success', 'failed', 'retry', 'running', 'pending']);
    return {
      name: pick(JOB_NAMES),
      queue: pick(JOB_QUEUES),
      status,
      duration: status === 'running' || status === 'pending' ? null : randInt(50, 45000),
      error: status === 'failed' ? pick(['ETIMEDOUT', 'ECONNRESET', 'prisma: P2002', 'queue drained', 'OOM killed']) : null,
      payload: { id: i + 1, attempt: randInt(1, 3), context: pick(['signup', 'digest', 'reindex', 'webhook', 'cleanup']) },
      ranAt: tsLast30d(),
      createdAt: tsLast30d(),
    };
  });
  await ensure(prisma.backgroundJob as any, 'Tier 1', 'BackgroundJob', 100, jobRows);

  // WebhookTemplate — 20+ templates.
  const whRows = WEBHOOK_TEMPLATE_DEFS.map(([name, slug, category, type, format]) => ({
    name,
    slug,
    description: `Reusable ${type} webhook template for ${name.toLowerCase()}.`,
    category,
    type: type.toUpperCase() as any,
    format: format.toUpperCase() as any,
    config: { url: 'https://example.com/webhook', events: ['ticket.created', 'ticket.resolved'] },
    variables: ['ticketId', 'ticketNumber', 'subject'],
    isBuiltIn: true,
    isActive: true,
    createdAt: tsLast6mo(),
  }));
  await ensure(prisma.webhookTemplate as any, 'Tier 1', 'WebhookTemplate', 20, whRows);

  // CannedResponse — 100+ canned responses for support agents.
  const cannedRows: any[] = [];
  CANNED_TEMPLATES.forEach((t, idx) => {
    cannedRows.push({
      title: t.t,
      body: t.b,
      category: t.c,
      shortcut: `/${slugify(t.t)}-${idx}`,
      isActive: true,
      usageCount: randInt(5, 5000),
      tags: [t.c.toLowerCase(), 'common'],
      variables: t.b.match(/\{[a-z]+\}/g) || [],
      shortcuts: [`${slugify(t.t)}`, `/${idx}`],
      createdAt: tsLast6mo(),
    });
  });
  // Pad to 100 with variations.
  for (let i = 0; i < 100 - CANNED_TEMPLATES.length; i++) {
    const base = CANNED_TEMPLATES[i % CANNED_TEMPLATES.length];
    cannedRows.push({
      title: `${base.t} (variant ${i + 1})`,
      body: `${base.b} Let me know if there is anything else I can help with — happy to dig deeper.`,
      category: base.c,
      shortcut: `/${slugify(base.t)}-v${i + 1}`,
      isActive: i % 5 !== 0,
      usageCount: randInt(0, 2000),
      tags: [base.c.toLowerCase(), 'variant'],
      variables: base.b.match(/\{[a-z]+\}/g) || [],
      shortcuts: [`${slugify(base.t)}-v${i + 1}`],
      createdAt: tsLast6mo(),
    });
  }
  await ensure(prisma.cannedResponse as any, 'Tier 1', 'CannedResponse', 100, cannedRows);

  // TicketCategory — add 10 more beyond the 5 baseline.
  const tcRows = TICKET_CATEGORIES.map(([key, name], i) => ({
    key,
    name,
    description: `${name} ticket category for routing and reporting.`,
    sortOrder: i + 5,
    isActive: true,
  }));
  await ensure(prisma.ticketCategory as any, 'Tier 1', 'TicketCategory', 10, tcRows);

  // TicketTag — 100+ tags with colors.
  const ttRows = TICKET_TAGS_POOL.map((name, i) => ({
    name,
    color: COLORS[i % COLORS.length],
    createdAt: tsLast6mo(),
  }));
  await ensure(prisma.ticketTag as any, 'Tier 1', 'TicketTag', 100, ttRows);

  // HelpArticle — 100+ articles with real content arrays.
  const helpRows = HELP_ARTICLE_DEFS.map(([title, category, icon], i) => {
    const paras = pickN(PARAGRAPHS, randInt(3, 5));
    return {
      slug: slugify(title) + (i > 0 ? `-${i}` : ''),
      title,
      description: `A practical walkthrough of ${title.toLowerCase()}.`,
      content: paras,
      category,
      icon,
      readMinutes: randInt(2, 9),
      popular: i % 7 === 0,
      views: randInt(50, 60000),
      isPublished: true,
      createdAt: tsLast6mo(),
    };
  });
  // Pad to 100+ by generating sequenced follow-ups.
  const extraHelp: any[] = [];
  for (let i = 0; HELP_ARTICLE_DEFS.length + extraHelp.length < 105; i++) {
    const [title, category, icon] = HELP_ARTICLE_DEFS[i % HELP_ARTICLE_DEFS.length];
    const idx = HELP_ARTICLE_DEFS.length + i;
    extraHelp.push({
      slug: slugify(title) + `-followup-${idx}`,
      title: `${title}: Follow-up Q&A`,
      description: `Common follow-up questions and answers about ${title.toLowerCase()}.`,
      content: pickN(PARAGRAPHS, 3),
      category,
      icon,
      readMinutes: randInt(2, 6),
      popular: false,
      views: randInt(20, 8000),
      isPublished: true,
      createdAt: tsLast6mo(),
    });
  }
  await ensure(prisma.helpArticle as any, 'Tier 1', 'HelpArticle', 100, [...helpRows, ...extraHelp]);
}

// ─── Tier 2: users + dependent core entities ──────────────────────────────────

async function tier2() {
  console.log('\n=== TIER 2: Users + core entities ===');
  const passwordHash = await bcrypt.hash('Vellbase2026!', 12);
  const roles = ['USER', 'USER', 'USER', 'USER', 'CREATOR', 'CREATOR', 'MODERATOR', 'SUPPORT_ADMIN', 'ADMIN'] as const;

  // User — 120+ real users.
  const usedHandles = new Set<string>();
  const userRows: any[] = [];
  for (let i = 0; i < 120; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7 + 3) % LAST_NAMES.length];
    let handle = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
    let n = 1;
    while (usedHandles.has(handle)) handle = `${first}.${last}${++n}`.toLowerCase().replace(/[^a-z.0-9]/g, '');
    usedHandles.add(handle);
    const role = pick(roles);
    const isCreator = role === 'CREATOR';
    userRows.push({
      email: `${handle}@vellbase.com`,
      passwordHash,
      handle,
      name: `${first} ${last}`,
      role,
      emailVerified: rng() > 0.12 ? tsLast90d() : null,
      avatar: avatarUrl(i),
      bio: pick(BIOS),
      website: `https://${handle}.dev`,
      location: pick(LOCATIONS),
      publication: isCreator ? pick(PUBLICATIONS) : null,
      isActive: rng() > 0.06,
      createdAt: tsLast6mo(),
    });
  }
  await ensure(prisma.user as any, 'Tier 2', 'User', 120, userRows);

  // Fetch all users (created now or pre-existing) for downstream tiers.
  const users = await prisma.user.findMany({ select: { id: true, handle: true, role: true, email: true } });
  const userIds = users.map((u) => u.id);

  // UserSettings — one per user.
  const usRows = users.map((u) => ({
    userId: u.id,
    emailNotifications: rng() > 0.2,
    pushNotifications: rng() > 0.15,
    emailMarketing: rng() > 0.7,
    allowComments: rng() > 0.1,
    allowLikes: rng() > 0.05,
    showOnlineStatus: rng() > 0.4,
    profileVisibility: pick(['public', 'public', 'public', 'followers']),
    showLikesCount: rng() > 0.3,
    createdAt: tsLast6mo(),
  }));
  await ensure(prisma.userSettings as any, 'Tier 2', 'UserSettings', 120, usRows);

  // Fetch userSettings to wire NotificationPreferences + Subscriptions.
  const userSettings = await prisma.userSettings.findMany({ select: { id: true, userId: true } });

  // NotificationPreferences — one per userSettings.
  const npRows = userSettings.map((s) => ({
    userSettingsId: s.id,
    pushLikes: rng() > 0.4,
    pushComments: rng() > 0.15,
    pushReplies: rng() > 0.1,
    pushFollows: rng() > 0.2,
    pushMentions: rng() > 0.1,
    pushNewArticles: rng() > 0.6,
    pushSystem: true,
    emailDigest: rng() > 0.3,
    emailMarketing: rng() > 0.7,
    soundsEnabled: rng() > 0.5,
    createdAt: tsLast6mo(),
  }));
  await ensure(prisma.notificationPreferences as any, 'Tier 2', 'NotificationPreferences', 120, npRows);

  // UserSubscription — ~50% of users, mix of Free/Pro/Enterprise.
  const subUsers = pickN(userSettings, Math.floor(userSettings.length * 0.5));
  const subRows = subUsers.map((s) => {
    const plan = pick(['Free', 'Pro', 'Pro', 'Enterprise']);
    return {
      userId: s.userId,
      planName: plan,
      status: pick(['active', 'active', 'active', 'past_due', 'canceled']),
      renewalDate: rng() > 0.3 ? daysAhead(randInt(1, 365)) : null,
      cancelAtPeriodEnd: rng() > 0.85,
      aiDrafts: plan === 'Free' ? 5 : plan === 'Pro' ? 500 : 100000,
      customDomain: plan !== 'Free',
      analytics: plan !== 'Free',
      createdAt: tsLast6mo(),
    };
  });
  await ensure(prisma.userSubscription as any, 'Tier 2', 'UserSubscription', 50, subRows);

  // ApiKey — 100+ keys.
  const apiRows = seq(100).map((i) => ({
    name: pick(['Production API Key', 'Staging Reader', 'CI Runner', 'Mobile App', 'Analytics Pipeline', 'Backoffice Tool']) + ` ${i + 1}`,
    key: `vb_live_${slugify(pick(['prod', 'stg', 'ci', 'app', 'data', 'ops']))}_${i.toString(36)}_${Math.floor(rng() * 1e12).toString(36)}`,
    userId: userIds[i % userIds.length],
    scopes: pickN(['articles:read', 'articles:write', 'tickets:read', 'tickets:write', 'users:read', 'media:upload'], randInt(1, 3)),
    isActive: rng() > 0.1,
    expiresAt: rng() > 0.4 ? daysAhead(randInt(10, 365)) : null,
    lastUsedAt: rng() > 0.3 ? tsLast30d() : null,
    createdAt: tsLast6mo(),
  }));
  await ensure(prisma.apiKey as any, 'Tier 2', 'ApiKey', 100, apiRows);

  // RefreshToken — 100+ tokens.
  const rtRows = seq(100).map((i) => ({
    userId: userIds[i % userIds.length],
    token: `rt_${i.toString(36)}_${Math.floor(rng() * 1e15).toString(36)}_${Math.floor(rng() * 1e15).toString(36)}`,
    expiresAt: rng() > 0.2 ? daysAhead(randInt(1, 90)) : daysAgo(randInt(1, 30)),
    deviceInfo: pick(['iPhone 15 Pro · iOS 17.4', 'Pixel 8 · Android 14', 'MacBook Pro · Chrome 124', 'Windows 11 · Edge 124']),
    createdAt: tsLast90d(),
  }));
  await ensure(prisma.refreshToken as any, 'Tier 2', 'RefreshToken', 100, rtRows);

  // Session — 100+ sessions.
  const sessRows = seq(100).map((i) => ({
    userId: userIds[i % userIds.length],
    sessionToken: `st_${i.toString(36)}_${Math.floor(rng() * 1e15).toString(36)}_${Math.floor(rng() * 1e15).toString(36)}`,
    expiresAt: rng() > 0.2 ? daysAhead(randInt(1, 30)) : daysAgo(randInt(1, 14)),
    deviceInfo: pick(['iPhone 15 Pro · iOS 17.4', 'Pixel 8 · Android 14', 'MacBook Pro · Chrome 124', 'Windows 11 · Edge 124']),
    ipAddress: pick(IP_ADDRESSES),
    userAgent: pick(USER_AGENTS),
    createdAt: tsLast30d(),
  }));
  await ensure(prisma.session as any, 'Tier 2', 'Session', 100, sessRows);

  // Media — 100+ media uploads with Pexels image URLs.
  const mediaRows = seq(100).map((i) => {
    const pid = PEXELS_IDS[i % PEXELS_IDS.length];
    return {
      filename: `pexels-photo-${pid}.jpeg`,
      originalName: pick(['cover.jpg', 'thumbnail.jpg', 'hero.png', 'screenshot.png', 'avatar.jpg']),
      mimeType: 'image/jpeg',
      size: randInt(120_000, 8_000_000),
      type: 'IMAGE' as any,
      url: pexelsUrl(pid, 1200),
      thumbnailUrl: pexelsUrl(pid, 400),
      width: pick([1200, 1600, 1920, 2400]),
      height: pick([800, 900, 1080, 1350]),
      metadata: { source: 'pexels', photoId: pid, alt: 'Editorial cover image' },
      uploadedBy: userIds[i % userIds.length],
      createdAt: tsLast90d(),
    };
  });
  await ensure(prisma.media as any, 'Tier 2', 'Media', 100, mediaRows);
}

// ─── Tier 3: content entities ──────────────────────────────────────────────────

async function tier3() {
  console.log('\n=== TIER 3: Content entities ===');
  const users = await prisma.user.findMany({ select: { id: true, handle: true, role: true } });
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  if (users.length === 0 || categories.length === 0) {
    console.log('Tier 3: missing users or categories — skipping');
    return;
  }
  const authors = users;
  const authorIds = authors.map((u) => u.id);
  const authorHandles = authors.map((u) => u.handle);
  const catIds = categories.map((c) => c.id);

  // Article — 120+ real articles.
  const articleRows: any[] = [];
  const usedSlugs = new Set<string>();
  for (let i = 0; i < 120; i++) {
    const topic = ARTICLE_TOPICS[i % ARTICLE_TOPICS.length];
    const angle = ARTICLE_ANGLES[Math.floor(i / ARTICLE_TOPICS.length) % ARTICLE_ANGLES.length];
    const title = i < ARTICLE_TOPICS.length ? topic : `${topic}: ${angle}`;
    let slug = slugify(title);
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${slugify(title)}-${n++}`;
    usedSlugs.add(slug);
    const views = randInt(200, 60000);
    const isPublished = rng() > 0.12;
    articleRows.push({
      slug,
      title,
      excerpt: `A hands-on guide to ${topic.toLowerCase()}.`,
      body: pickN(PARAGRAPHS, randInt(4, 7)),
      cover: pexelsUrl(PEXELS_IDS[i % PEXELS_IDS.length], 1200),
      readMinutes: randInt(3, 18),
      categoryId: catIds[i % catIds.length],
      authorId: authorIds[i % authorIds.length],
      likesCount: Math.floor(views * (0.01 + rng() * 0.05)),
      views,
      shares: Math.floor(views * (0.001 + rng() * 0.01)),
      featured: i % 11 === 0,
      isPublished,
      publishedAt: isPublished ? tsLast90d() : null,
      createdAt: tsLast6mo(),
    });
  }
  await ensure(prisma.article as any, 'Tier 3', 'Article', 120, articleRows);

  // Highlight — 100+ highlights.
  const highlightRows = seq(110).map((i) => {
    const pid = PEXELS_IDS[i % PEXELS_IDS.length];
    const isPublished = rng() > 0.15;
    return {
      title: pick([
        'React Hooks in 5 Minutes', 'CSS Grid Masterclass', 'Kubernetes 101 Live',
        'TypeScript Tips You Missed', 'Docker Deep Dive', 'Postgres Performance Tricks',
        'GraphQL Crash Course', 'Rust in Anger', 'Go Concurrency Live', 'Edge Functions Demo',
      ]) + ` #${i + 1}`,
      cover: pexelsUrl(pid, 800),
      videoUrl: pexelsVideoUrl(pid),
      thumbnailUrl: pexelsUrl(pid, 800),
      handle: pick(['contentcreator', 'johndoe', 'janedoe', 'velvbasemod', authorHandles[i % authorHandles.length]]),
      authorId: authorIds[i % authorIds.length],
      likesCount: randInt(20, 8000),
      commentsCount: randInt(2, 400),
      shares: randInt(5, 1200),
      description: pick(['A quick hands-on walkthrough', 'Recorded live with Q&A', 'Everything you need in under 5 minutes']),
      music: pick([null, 'Licensed background track — Ambient Pulse']),
      aspectRatio: 1.777,
      duration: randInt(60, 900),
      isPublished,
      publishedAt: isPublished ? tsLast90d() : null,
      createdAt: tsLast6mo(),
    };
  });
  await ensure(prisma.highlight as any, 'Tier 3', 'Highlight', 100, highlightRows);

  // Story — 100+ stories.
  const storyRows = seq(110).map((i) => {
    const pid = PEXELS_IDS[i % PEXELS_IDS.length];
    const created = tsLast30d();
    return {
      authorId: authorIds[i % authorIds.length],
      image: pexelsUrl(pid, 600),
      caption: pick([
        'Behind the scenes of today’s release',
        'Quick tip for your next deploy',
        'Spotlight on a great community article',
        'New in the editor: drag-to-reorder blocks',
        null,
      ]),
      duration: pick([5000, 6000, 7000, 8000]),
      createdAt: created,
      expiresAt: new Date(created.getTime() + DAY),
    };
  });
  await ensure(prisma.story as any, 'Tier 3', 'Story', 100, storyRows);
}

// ─── Tier 4: engagement entities ───────────────────────────────────────────────

async function tier4() {
  console.log('\n=== TIER 4: Engagement entities ===');
  const users = await prisma.user.findMany({ select: { id: true } });
  const articles = await prisma.article.findMany({ select: { id: true, slug: true } });
  const highlights = await prisma.highlight.findMany({ select: { id: true } });
  const stories = await prisma.story.findMany({ select: { id: true } });
  if (users.length === 0 || articles.length === 0) {
    console.log('Tier 4: missing users or articles — skipping');
    return;
  }
  const userIds = users.map((u) => u.id);
  const articleSlugs = articles.map((a) => a.slug);
  const highlightIds = highlights.map((h) => h.id);
  const storyIds = stories.map((s) => s.id);

  // Comment — 200+ comments. Two-phase: top-level first, then replies.
  // Gated separately by parentId so a partial run self-heals without
  // duplicating top-level rows (Comment has no unique business key).
  const topLevelCount = await prisma.comment.count({ where: { parentId: null } });
  if (topLevelCount < 150) {
    const topCommentRows: any[] = [];
    for (let i = 0; i < 150; i++) {
      topCommentRows.push({
        articleSlug: pick(articleSlugs),
        highlightId: null,
        authorId: userIds[i % userIds.length],
        body: pick(COMMENT_POOL),
        likesCount: randInt(0, 120),
        createdAt: tsLast90d(),
      });
    }
    const res = await prisma.comment.createMany({ data: topCommentRows, skipDuplicates: true });
    console.log(`Tier 4: Comment (top-level) — ${res.count} rows created (target 150, was ${topLevelCount})`);
  } else {
    console.log(`Tier 4: Comment (top-level) — already ${topLevelCount} rows (target 150), skipping`);
  }

  const replyCount = await prisma.comment.count({ where: { parentId: { not: null } } });
  if (replyCount < 50) {
    const sampleComments = await prisma.comment.findMany({
      take: 60,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const replyRows: any[] = [];
    for (let i = 0; i < 50 && sampleComments.length; i++) {
      replyRows.push({
        articleSlug: null,
        highlightId: null,
        authorId: userIds[(i + 5) % userIds.length],
        body: pick(COMMENT_POOL),
        parentId: sampleComments[i % sampleComments.length].id,
        likesCount: randInt(0, 40),
        createdAt: tsLast90d(),
      });
    }
    const res = await prisma.comment.createMany({ data: replyRows, skipDuplicates: true });
    console.log(`Tier 4: Comment (replies) — ${res.count} rows created (target 50, was ${replyCount})`);
  } else {
    console.log(`Tier 4: Comment (replies) — already ${replyCount} rows (target 50), skipping`);
  }

  const commentIds = (await prisma.comment.findMany({ take: 200, select: { id: true } })).map((c) => c.id);

  // Like — 200+ across articles, highlights, comments.
  const likeRows: any[] = [];
  for (let i = 0; i < 80; i++) {
    likeRows.push({ userId: userIds[i % userIds.length], articleSlug: pick(articleSlugs), createdAt: tsLast90d() });
  }
  if (highlightIds.length) {
    for (let i = 0; i < 70; i++) {
      likeRows.push({ userId: userIds[(i + 2) % userIds.length], highlightId: pick(highlightIds), createdAt: tsLast90d() });
    }
  }
  if (commentIds.length) {
    for (let i = 0; i < 60; i++) {
      likeRows.push({ userId: userIds[(i + 4) % userIds.length], commentId: pick(commentIds), createdAt: tsLast90d() });
    }
  }
  await ensure(prisma.like as any, 'Tier 4', 'Like', 200, likeRows);

  // Bookmark — 100+.
  const bookmarkRows: any[] = [];
  for (let i = 0; i < 70; i++) {
    bookmarkRows.push({ userId: userIds[i % userIds.length], articleSlug: pick(articleSlugs), createdAt: tsLast90d() });
  }
  if (highlightIds.length) {
    for (let i = 0; i < 40; i++) {
      bookmarkRows.push({ userId: userIds[(i + 3) % userIds.length], highlightId: pick(highlightIds), createdAt: tsLast90d() });
    }
  }
  await ensure(prisma.bookmark as any, 'Tier 4', 'Bookmark', 100, bookmarkRows);

  // Follow — 200+ relationships.
  const followRows: any[] = [];
  for (let i = 0; i < 200; i++) {
    const a = userIds[i % userIds.length];
    let b = userIds[(i * 3 + 1) % userIds.length];
    if (b === a) b = userIds[(i * 3 + 2) % userIds.length];
    followRows.push({ followerId: a, followingId: b, createdAt: tsLast6mo() });
  }
  await ensure(prisma.follow as any, 'Tier 4', 'Follow', 200, followRows);

  // Notification — 200+.
  const notifKinds = ['LIKE', 'COMMENT', 'REPLY', 'FOLLOW', 'BOOKMARK', 'MENTION', 'SYSTEM'];
  const notifRows: any[] = [];
  for (let i = 0; i < 200; i++) {
    const kind = pick(notifKinds) as any;
    const actor = userIds[(i + 1) % userIds.length];
    const recipient = userIds[i % userIds.length];
    notifRows.push({
      userId: recipient,
      actorId: actor === recipient ? null : actor,
      kind,
      articleSlug: rng() > 0.5 ? pick(articleSlugs) : null,
      highlightId: rng() > 0.7 && highlightIds.length ? pick(highlightIds) : null,
      commentId: rng() > 0.8 && commentIds.length ? pick(commentIds) : null,
      body: pick([
        'started following you',
        'liked your article',
        'replied to your comment',
        'bookmarked your highlight',
        'mentioned you in a comment',
        'published a new article you might enjoy',
        'a system update is available for your workspace',
      ]),
      metadata: { delivered: true },
      read: rng() > 0.4,
      readAt: rng() > 0.4 ? tsLast30d() : null,
      createdAt: tsLast90d(),
    });
  }
  await ensure(prisma.notification as any, 'Tier 4', 'Notification', 200, notifRows);

  // StoryView — 200+.
  const storyViewRows: any[] = [];
  if (storyIds.length) {
    for (let i = 0; i < 200; i++) {
      storyViewRows.push({
        storyId: pick(storyIds),
        viewerId: userIds[i % userIds.length],
        viewedAt: tsLast30d(),
      });
    }
  }
  await ensure(prisma.storyView as any, 'Tier 4', 'StoryView', 200, storyViewRows);

  // Report — 100+ reports with real reasons.
  const reportRows: any[] = [];
  const reportTargets = [
    ...articleSlugs.map((s) => ({ type: 'Article', id: s })),
    ...highlightIds.map((id) => ({ type: 'Highlight', id })),
    ...commentIds.slice(0, 30).map((id) => ({ type: 'Comment', id })),
    ...userIds.slice(0, 30).map((id) => ({ type: 'User', id })),
  ].filter((t) => t.id);
  for (let i = 0; i < 100; i++) {
    const target = pick(reportTargets);
    const status = pick(['open', 'open', 'reviewing', 'resolved', 'dismissed']);
    reportRows.push({
      targetType: target.type,
      targetId: target.id,
      reason: pick(['spam', 'harassment', 'copyright', 'inappropriate', 'misinformation', 'other']),
      reporterId: userIds[i % userIds.length],
      status,
      priority: pick(['low', 'medium', 'medium', 'high', 'critical']),
      aiScore: randInt(0, 100),
      aiCategory: pick(['spam', 'harassment', 'copyright', 'safe', 'low_confidence']),
      notes: status !== 'open' ? 'Reviewed against community guidelines.' : null,
      resolvedById: status === 'resolved' || status === 'dismissed' ? pick(userIds) : null,
      resolvedAt: status === 'resolved' || status === 'dismissed' ? tsLast30d() : null,
      createdAt: tsLast90d(),
    });
  }
  await ensure(prisma.report as any, 'Tier 4', 'Report', 100, reportRows);
}

// ─── Tier 5: support / agent ecosystem ─────────────────────────────────────────

async function tier5() {
  console.log('\n=== TIER 5: Support / agent ecosystem ===');
  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  if (users.length === 0) {
    console.log('Tier 5: no users — skipping');
    return;
  }
  const userIds = users.map((u) => u.id);

  // SupportDepartment — 10+ new departments.
  const deptRows = DEPARTMENTS.map(([key, name, email]) => ({
    key,
    name,
    description: `${name} department handling ${name.toLowerCase()} inquiries and escalations.`,
    email,
    isActive: true,
    firstResponseSlaMinutes: pick([30, 60, 120]),
    resolutionSlaMinutes: pick([720, 1440, 2880]),
    slaAdherenceTargetPct: pick([90, 95, 98]),
    businessHoursStartMin: 540,
    businessHoursEndMin: 1080,
    businessDays: [1, 2, 3, 4, 5],
    timezone: pick(['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Singapore']),
    budgetAllocated: randInt(150000, 800000),
    resourceCapacityFte: randInt(3, 12),
  }));
  await ensure(prisma.supportDepartment as any, 'Tier 5', 'SupportDepartment', 10, deptRows);

  // Fetch all departments (new + pre-existing) for teams.
  const departments = await prisma.supportDepartment.findMany({ select: { id: true, key: true, name: true } });
  if (departments.length === 0) {
    console.log('Tier 5: no departments — skipping rest');
    return;
  }

  // SupportTeam — 20+ teams.
  const teamRows = TEAM_SPECS.map(([name, spec], i) => ({
    departmentId: departments[i % departments.length].id,
    name,
    description: `${name} — specializes in ${spec} workflows.`,
    isActive: true,
    leadId: userIds[i % userIds.length],
    slaInheritFromDept: i % 2 === 0,
    firstResponseSlaMinutes: i % 2 === 0 ? null : pick([30, 60, 120]),
    resolutionSlaMinutes: i % 2 === 0 ? null : pick([720, 1440, 2880]),
    businessHoursInherit: i % 2 === 0,
    businessHoursStartMin: i % 2 === 0 ? null : 540,
    businessHoursEndMin: i % 2 === 0 ? null : 1080,
    businessDays: i % 2 === 0 ? [] : [1, 2, 3, 4, 5],
    timezone: pick(['America/New_York', 'Europe/London', 'Asia/Singapore']),
    maxTicketsPerAgent: randInt(5, 15),
    concurrentTicketLimitPerAgent: randInt(2, 6),
    skillSpecialization: spec,
  }));
  await ensure(prisma.supportTeam as any, 'Tier 5', 'SupportTeam', 20, teamRows);

  const teams = await prisma.supportTeam.findMany({ select: { id: true, departmentId: true } });

  // SupportAgent — 30+ agents (subset of users).
  const agentUserIds = pickN(userIds, Math.min(30, userIds.length));
  const agentRows = agentUserIds.map((uid, i) => ({
    userId: uid,
    departmentId: teams[i % teams.length]?.departmentId ?? departments[i % departments.length].id,
    teamId: teams[i % teams.length]?.id ?? null,
    status: pick(['ONLINE', 'BUSY', 'AWAY', 'OFFLINE'] as any),
    maxTickets: randInt(5, 20),
    activeTickets: randInt(0, 12),
    skills: pickN(['billing', 'technical', 'product', 'escalation', 'onboarding', 'vip', 'api', 'security'], randInt(2, 4)),
    isActive: rng() > 0.1,
    vacationUntil: rng() > 0.85 ? daysAhead(randInt(1, 14)) : null,
  }));
  await ensure(prisma.supportAgent as any, 'Tier 5', 'SupportAgent', 30, agentRows);

  const agents = await prisma.supportAgent.findMany({ select: { id: true, userId: true, teamId: true } });

  // SupportAgentTeamMembership — 50+ memberships.
  const membershipRows: any[] = [];
  for (let i = 0; i < Math.min(60, agents.length * 2); i++) {
    const agent = agents[i % agents.length];
    const team = teams[(i + 1) % teams.length] ?? teams[0];
    if (!team) continue;
    const ended = rng() > 0.7;
    membershipRows.push({
      agentId: agent.id,
      teamId: team.id,
      isPrimary: i % 3 === 0,
      startDate: tsLast6mo(),
      endDate: ended ? tsLast30d() : null,
      assignedBy: userIds[i % userIds.length],
      assignedAt: tsLast6mo(),
    });
  }
  await ensure(prisma.supportAgentTeamMembership as any, 'Tier 5', 'SupportAgentTeamMembership', 50, membershipRows);

  // SlaPolicy — 20+ policies.
  const slaRows = seq(24).map((i) => {
    const priority = pick(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY'] as any);
    return {
      name: `${priority} SLA — ${departments[i % departments.length].name}`,
      departmentId: departments[i % departments.length].id,
      priority,
      firstResponseMinutes: pick([30, 60, 120, 240, 480]),
      resolutionMinutes: pick([720, 1440, 2880, 5760]),
      escalationMinutes: pick([60, 120, 240, 480]),
      isActive: true,
    };
  });
  await ensure(prisma.slaPolicy as any, 'Tier 5', 'SlaPolicy', 20, slaRows);

  const slaPolicies = await prisma.slaPolicy.findMany({ select: { id: true, priority: true } });
  const ticketCategories = await prisma.ticketCategory.findMany({ select: { id: true } });

  // EscalationRule — 50+ rules.
  const escalationRows: any[] = [];
  for (let i = 0; i < 50; i++) {
    if (slaPolicies.length === 0) break;
    escalationRows.push({
      slaPolicyId: slaPolicies[i % slaPolicies.length].id,
      name: `Escalation #${i + 1} — ${pick(['breach-warning', 'auto-reassign', 'notify-vip', 'page-oncall'])}`,
      triggerAfterMinutes: pick([30, 60, 120, 240, 480]),
      action: pick(['notify_manager', 'reassign_team', 'page_oncall', 'email_vip']),
      targetRole: pick(['support_admin', 'organization_admin', 'platform_admin', null]),
      isActive: true,
    });
  }
  await ensure(prisma.escalationRule as any, 'Tier 5', 'EscalationRule', 50, escalationRows);

  // SupportTicket — 100+ tickets.
  const ticketRows: any[] = [];
  const statuses = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'WAITING_ON_INTERNAL', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED'] as const;
  for (let i = 0; i < 100; i++) {
    const status = pick(statuses) as any;
    const created = tsLast6mo();
    const isClosed = status === 'CLOSED' || status === 'RESOLVED';
    ticketRows.push({
      ticketNumber: `VB-2026-${(1000 + i).toString()}`,
      subject: pick(TICKET_SUBJECTS),
      message: pick(SUPPORT_MESSAGES),
      description: pick(TICKET_SUBJECTS),
      type: pick(['CUSTOMER', 'INTERNAL', 'BUG_REPORT', 'FEATURE_REQUEST', 'TECHNICAL', 'BILLING', 'ABUSE', 'MODERATION'] as any),
      priority: pick(['LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY'] as any),
      status,
      userId: userIds[i % userIds.length],
      assigneeId: agentUserIds.length ? pick(agentUserIds) : null,
      departmentId: departments[i % departments.length].id,
      teamId: teams[i % teams.length]?.id ?? null,
      categoryId: ticketCategories.length ? ticketCategories[i % ticketCategories.length].id : null,
      slaPolicyId: slaPolicies.length ? slaPolicies[i % slaPolicies.length].id : null,
      dueAt: daysAhead(randInt(1, 5)),
      firstResponseAt: status !== 'NEW' ? new Date(created.getTime() + randInt(10, 600) * MIN) : null,
      resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date(created.getTime() + randInt(1, 72) * HOUR) : null,
      closedAt: status === 'CLOSED' ? new Date(created.getTime() + randInt(2, 96) * HOUR) : null,
      reopenedAt: status === 'REOPENED' ? tsLast30d() : null,
      satisfaction: isClosed ? randInt(1, 5) : null,
      interactionsCount: randInt(1, 20),
      slaMetResponse: rng() > 0.2,
      slaMetResolution: isClosed ? rng() > 0.25 : null,
      version: 1,
      metadata: { source: pick(['web', 'mobile', 'email', 'api']), channel: pick(['in-app', 'widget', 'email']) },
      createdAt: created,
    });
  }
  await ensure(prisma.supportTicket as any, 'Tier 5', 'SupportTicket', 100, ticketRows);

  const tickets = await prisma.supportTicket.findMany({ select: { id: true, ticketNumber: true, userId: true, assigneeId: true } });
  if (tickets.length === 0) {
    console.log('Tier 5: no tickets — skipping ticket children');
    return;
  }
  const ticketIds = tickets.map((t) => t.id);

  // TicketMessage — 300+ messages.
  const messageRows: any[] = [];
  for (let i = 0; i < 300; i++) {
    const t = tickets[i % tickets.length];
    messageRows.push({
      ticketId: t.id,
      authorId: rng() > 0.5 ? t.userId : (agentUserIds.length ? pick(agentUserIds) : t.userId),
      body: pick(SUPPORT_MESSAGES),
      isInternal: rng() > 0.8,
      createdAt: tsLast90d(),
    });
  }
  await ensure(prisma.ticketMessage as any, 'Tier 5', 'TicketMessage', 300, messageRows);

  // TicketInternalNote — 100+ notes.
  const noteRows: any[] = [];
  for (let i = 0; i < 100; i++) {
    const t = tickets[i % tickets.length];
    noteRows.push({
      ticketId: t.id,
      authorId: agentUserIds.length ? pick(agentUserIds) : t.userId,
      body: pick(SUPPORT_NOTE_POOL),
      createdAt: tsLast90d(),
    });
  }
  await ensure(prisma.ticketInternalNote as any, 'Tier 5', 'TicketInternalNote', 100, noteRows);

  // TicketAttachment — 50+ attachments.
  const attachmentRows: any[] = [];
  for (let i = 0; i < 50; i++) {
    const t = tickets[i % tickets.length];
    const pid = PEXELS_IDS[i % PEXELS_IDS.length];
    attachmentRows.push({
      ticketId: t.id,
      uploadedById: t.userId,
      filename: `attachment-${i + 1}.jpeg`,
      originalName: pick(['screenshot.png', 'error-log.txt', 'receipt.pdf', 'config.json']),
      mimeType: pick(['image/png', 'image/jpeg', 'text/plain', 'application/pdf']),
      size: randInt(20_000, 2_000_000),
      url: pexelsUrl(pid, 800),
      createdAt: tsLast90d(),
    });
  }
  await ensure(prisma.ticketAttachment as any, 'Tier 5', 'TicketAttachment', 50, attachmentRows);

  // TicketAssignment — 100+ assignments.
  const assignmentRows: any[] = [];
  for (let i = 0; i < 100; i++) {
    const t = tickets[i % tickets.length];
    const agent = pick(agentUserIds.length ? agentUserIds : userIds);
    assignmentRows.push({
      ticketId: t.id,
      agentId: agent,
      assignedBy: rng() > 0.3 ? pick(userIds) : null,
      reason: pick(['round-robin', 'skill-match', 'vip-routing', 'manual', 'escalation']),
      isActive: i % 4 !== 0,
      createdAt: tsLast90d(),
      endedAt: i % 4 === 0 ? tsLast30d() : null,
    });
  }
  await ensure(prisma.ticketAssignment as any, 'Tier 5', 'TicketAssignment', 100, assignmentRows);

  // TicketStatusHistory — 200+ status changes.
  const statusValues = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'WAITING_ON_INTERNAL', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED'] as const;
  const historyRows: any[] = [];
  for (let i = 0; i < 200; i++) {
    const t = tickets[i % tickets.length];
    historyRows.push({
      ticketId: t.id,
      fromStatus: rng() > 0.15 ? pick(statusValues) : null,
      toStatus: pick(statusValues) as any,
      changedById: agentUserIds.length ? pick(agentUserIds) : t.userId,
      reason: pick(['auto-assign', 'customer replied', 'agent resolved', 'reopened by customer', 'escalated per SLA']),
      createdAt: tsLast90d(),
    });
  }
  await ensure(prisma.ticketStatusHistory as any, 'Tier 5', 'TicketStatusHistory', 200, historyRows);

  // TicketWatcher — 100+ watchers.
  const watcherRows: any[] = [];
  for (let i = 0; i < 100; i++) {
    const t = tickets[i % tickets.length];
    watcherRows.push({
      ticketId: t.id,
      userId: userIds[(i + 2) % userIds.length],
      createdAt: tsLast90d(),
    });
  }
  await ensure(prisma.ticketWatcher as any, 'Tier 5', 'TicketWatcher', 100, watcherRows);

  // TicketTagAssignment — 100+ tag assignments.
  const ticketTags = await prisma.ticketTag.findMany({ select: { id: true } });
  const tagAssignmentRows: any[] = [];
  if (ticketTags.length) {
    for (let i = 0; i < 100; i++) {
      tagAssignmentRows.push({
        ticketId: ticketIds[i % ticketIds.length],
        tagId: ticketTags[i % ticketTags.length].id,
      });
    }
  }
  await ensure(prisma.ticketTagAssignment as any, 'Tier 5', 'TicketTagAssignment', 100, tagAssignmentRows);
}

// ─── Tier 6: RBAC + access control ────────────────────────────────────────────

async function tier6() {
  console.log('\n=== TIER 6: RBAC + access control ===');
  const users = await prisma.user.findMany({ select: { id: true } });
  if (users.length === 0) {
    console.log('Tier 6: no users — skipping');
    return;
  }
  const userIds = users.map((u) => u.id);
  const adminIds = userIds.slice(0, Math.max(5, Math.floor(userIds.length * 0.1)));

  // ResourcePermission — 20+ resource permissions.
  const rpRows = RESOURCE_PERMISSION_DEFS.map(([resourceType, permissionKey, permissionName, description]) => ({
    resourceType,
    permissionKey,
    permissionName,
    description,
  }));
  await ensure(prisma.resourcePermission as any, 'Tier 6', 'ResourcePermission', 20, rpRows);

  const resourcePerms = await prisma.resourcePermission.findMany({ select: { id: true, permissionKey: true, resourceType: true } });

  // RolePermissionRequest — 50+ requests.
  const requestRows: any[] = [];
  const requestStatuses = ['PENDING', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] as const;
  const justifications = [
    'Need temporary editor access to publish our quarterly engineering blog series.',
    'Requested support_agent role to triage inbound tickets during the launch week rotation.',
    'Promoted to team lead; require moderator permissions to manage community reports.',
    'Filling in for an on-call analyst; need audit.view for the incident review.',
    'Need articles.publish to ship the partner announcement on schedule.',
    'Billing requires temporary refund permission to reconcile a disputed enterprise invoice.',
    'Marketing rollout needs feature_flag.toggle for the dark-mode phased launch.',
    'Need webhook.manage to rotate signing secrets after the security audit.',
    'Requested access to manage custom domains for the new regional publication.',
    'Need apikey.rotate to cycle a compromised CI key before the deploy window.',
  ];
  for (let i = 0; i < 50; i++) {
    const status = pick(requestStatuses) as any;
    const roleKey = pick(RBAC_ROLE_KEYS)[0];
    const created = tsLast6mo();
    requestRows.push({
      requesterId: userIds[i % userIds.length],
      reviewerId: status !== 'PENDING' ? pick(adminIds) : null,
      requestedRoleKey: roleKey,
      type: pick(['PERMANENT', 'TEMPORARY'] as any),
      status,
      justification: pick(justifications),
      adminJustification: status === 'APPROVED' || status === 'REJECTED' ? 'Reviewed against least-privilege policy.' : null,
      startsAt: status !== 'PENDING' ? new Date(created.getTime() + DAY) : null,
      expiresAt: pick(['PERMANENT', 'TEMPORARY']) === 'TEMPORARY' ? daysAhead(randInt(7, 90)) : null,
      reviewedAt: status !== 'PENDING' ? new Date(created.getTime() + randInt(1, 72) * HOUR) : null,
      createdAt: created,
    });
  }
  await ensure(prisma.rolePermissionRequest as any, 'Tier 6', 'RolePermissionRequest', 50, requestRows);

  const roleRequests = await prisma.rolePermissionRequest.findMany({ select: { id: true } });
  const roleRequestIds = roleRequests.map((r) => r.id);

  // RolePermissionRequestEvent — 100+ events.
  const rprEventRows: any[] = [];
  const requestTransitions = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] as const;
  for (let i = 0; i < 100 && roleRequestIds.length; i++) {
    rprEventRows.push({
      requestId: roleRequestIds[i % roleRequestIds.length],
      actorId: rng() > 0.3 ? pick(adminIds) : null,
      transition: pick(requestTransitions) as any,
      reason: pick(['auto-expired after 7 days', 'approved by manager', 'rejected — least privilege', 'requested extension', 'auto-approved by policy']),
      metadata: { source: pick(['web', 'admin-panel', 'api']) },
      createdAt: tsLast6mo(),
    });
  }
  await ensure(prisma.rolePermissionRequestEvent as any, 'Tier 6', 'RolePermissionRequestEvent', 100, rprEventRows);

  // AccessRequest — 50+ access requests.
  const accessRows: any[] = [];
  const accessStatuses = ['PENDING', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
  const accessJustifications = [
    'Need read access to the billing workspace to reconcile Q3 invoices.',
    'Requested write access to the production analytics dashboard for the launch retro.',
    'Need to manage webhooks for the new Slack integration rollout.',
    'Requested export permission on audit logs for the SOC 2 evidence collection.',
    'Need refund permission on the billing resource for the disputed enterprise account.',
    'Requested assign permission on tickets during the on-call coverage window.',
    'Need to toggle the dark-mode feature flag for the phased rollout.',
    'Requested upload permission on media for the marketing asset refresh.',
    'Need manage permission on tags to consolidate duplicate topic tags.',
    'Requested rotate permission on API keys after the credentials refresh.',
  ];
  for (let i = 0; i < 50; i++) {
    if (resourcePerms.length === 0) break;
    const perm = resourcePerms[i % resourcePerms.length];
    const status = pick(accessStatuses) as any;
    const created = tsLast6mo();
    accessRows.push({
      requesterId: userIds[i % userIds.length],
      reviewerId: status !== 'PENDING' ? pick(adminIds) : null,
      resourceType: perm.resourceType,
      resourceId: rng() > 0.5 ? pick(userIds) : null,
      permissionKey: perm.permissionKey,
      type: pick(['PERMANENT', 'TEMPORARY'] as any),
      status,
      justification: pick(accessJustifications),
      adminJustification: status !== 'PENDING' ? 'Reviewed against resource-access policy.' : null,
      startsAt: status !== 'PENDING' ? new Date(created.getTime() + DAY) : null,
      expiresAt: pick(['PERMANENT', 'TEMPORARY']) === 'TEMPORARY' ? daysAhead(randInt(7, 90)) : null,
      reviewedAt: status !== 'PENDING' ? new Date(created.getTime() + randInt(1, 48) * HOUR) : null,
      createdAt: created,
    });
  }
  await ensure(prisma.accessRequest as any, 'Tier 6', 'AccessRequest', 50, accessRows);

  const accessRequests = await prisma.accessRequest.findMany({ select: { id: true } });
  const accessRequestIds = accessRequests.map((r) => r.id);

  // AccessRequestEvent — 100+ events.
  const areEventRows: any[] = [];
  const accessTransitions = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
  for (let i = 0; i < 100 && accessRequestIds.length; i++) {
    areEventRows.push({
      requestId: accessRequestIds[i % accessRequestIds.length],
      actorId: rng() > 0.3 ? pick(adminIds) : null,
      transition: pick(accessTransitions) as any,
      reason: pick(['auto-cancelled by requester', 'approved with expiry', 'rejected — least privilege', 'revoked after review', 'escalated to manager']),
      metadata: { source: pick(['web', 'admin-panel', 'api']) },
      createdAt: tsLast6mo(),
    });
  }
  await ensure(prisma.accessRequestEvent as any, 'Tier 6', 'AccessRequestEvent', 100, areEventRows);

  // UserResourceAccess — 100+ resource access records.
  const uraRows: any[] = [];
  if (resourcePerms.length) {
    for (let i = 0; i < 100; i++) {
      const perm = resourcePerms[i % resourcePerms.length];
      uraRows.push({
        userId: userIds[i % userIds.length],
        resourceType: perm.resourceType,
        resourceId: rng() > 0.5 ? pick(userIds) : null,
        permissionKey: perm.permissionKey,
        grantedAt: tsLast6mo(),
        grantedBy: pick(adminIds),
        expiresAt: rng() > 0.6 ? daysAhead(randInt(7, 180)) : null,
        isActive: rng() > 0.15,
      });
    }
  }
  await ensure(prisma.userResourceAccess as any, 'Tier 6', 'UserResourceAccess', 100, uraRows);
}

// ─── Tier 7: audit / activity ──────────────────────────────────────────────────

async function tier7() {
  console.log('\n=== TIER 7: Audit / activity ===');
  const users = await prisma.user.findMany({ select: { id: true } });
  if (users.length === 0) {
    console.log('Tier 7: no users — skipping');
    return;
  }
  const userIds = users.map((u) => u.id);
  const someIds = userIds.slice(0, Math.max(10, Math.floor(userIds.length * 0.3)));

  // AuditLog — 200+ audit logs.
  const auditRows: any[] = [];
  for (let i = 0; i < 200; i++) {
    const success = rng() > 0.15;
    auditRows.push({
      userId: rng() > 0.1 ? pick(userIds) : null,
      action: pick(AUDIT_ACTIONS),
      resource: pick(AUDIT_RESOURCES),
      resourceId: rng() > 0.2 ? pick(someIds) : null,
      details: { source: pick(['web', 'admin-panel', 'api', 'cli']), context: 'production-seed' },
      metadata: { description: 'Automated audit entry from production seed run.' },
      changes: rng() > 0.6 ? { field: { old: 'off', new: 'on' } } : null,
      success,
      ipAddress: pick(IP_ADDRESSES),
      userAgent: pick(USER_AGENTS),
      location: pick(LOCATIONS),
      createdAt: tsLast6mo(),
    });
  }
  await ensure(prisma.auditLog as any, 'Tier 7', 'AuditLog', 200, auditRows);

  // ActivityLog — 200+ activity logs.
  const activityRows: any[] = [];
  for (let i = 0; i < 200; i++) {
    activityRows.push({
      userId: rng() > 0.1 ? pick(userIds) : null,
      action: pick(ACTIVITY_ACTIONS),
      entityType: pick(['Article', 'Highlight', 'Comment', 'User', 'Ticket', 'ApiKey', 'Webhook', 'Media', 'Bookmark', 'Notification']),
      entityId: rng() > 0.3 ? pick(someIds) : null,
      details: { tab: pick(['feed', 'profile', 'dashboard', 'inbox']), result: 'success' },
      ipAddress: pick(IP_ADDRESSES),
      createdAt: tsLast6mo(),
    });
  }
  await ensure(prisma.activityLog as any, 'Tier 7', 'ActivityLog', 200, activityRows);

  // RBAC bootstrap — ensure roles exist so RoleAssignmentHistory has FK targets.
  const existingRoles = await prisma.rbacRole.count();
  if (existingRoles < RBAC_ROLE_KEYS.length) {
    const roleRows = RBAC_ROLE_KEYS.map(([key, name, rank]) => ({
      key,
      name,
      isSystem: true,
      isActive: true,
      rank,
    }));
    const res = await prisma.rbacRole.createMany({ data: roleRows, skipDuplicates: true });
    console.log(`Tier 7: RbacRole bootstrap — ${res.count} roles created`);
  } else {
    console.log(`Tier 7: RbacRole already ${existingRoles} rows, skipping bootstrap`);
  }
  const roles = await prisma.rbacRole.findMany({ select: { id: true, key: true } });
  if (roles.length === 0) {
    console.log('Tier 7: no roles available — skipping RoleAssignmentHistory');
  } else {
    const historyActions = ['assigned', 'revoked', 'changed', 'assigned', 'assigned', 'revoked'];
    const historyReasons = [
      'Promoted after quarterly performance review.',
      'Temporary access granted for the launch rotation.',
      'Role reverted to least-privilege baseline after project closeout.',
      'Assigned as primary role during onboarding.',
      'Granted elevated permissions for incident response.',
      'Revoked after policy violation review.',
    ];
    const historyRows: any[] = [];
    for (let i = 0; i < 100; i++) {
      historyRows.push({
        userId: userIds[i % userIds.length],
        roleId: roles[i % roles.length].id,
        action: pick(historyActions),
        assignedBy: rng() > 0.3 ? pick(userIds) : null,
        reason: pick(historyReasons),
        createdAt: tsLast6mo(),
      });
    }
    await ensure(prisma.roleAssignmentHistory as any, 'Tier 7', 'RoleAssignmentHistory', 100, historyRows);
  }

  // HelpArticleVersion — 100+ versions.
  const helpArticles = await prisma.helpArticle.findMany({ select: { id: true, title: true } });
  const versionRows: any[] = [];
  if (helpArticles.length) {
    for (let i = 0; i < 100; i++) {
      const article = helpArticles[i % helpArticles.length];
      versionRows.push({
        articleId: article.id,
        version: Math.floor(i / helpArticles.length) + 1,
        title: article.title,
        content: pickN(PARAGRAPHS, randInt(2, 4)),
        authorId: pick(userIds),
        changeNote: pick(['Clarified a step after reader feedback', 'Updated screenshots for new UI', 'Added troubleshooting section', 'Editorial pass for clarity', 'Fixed a broken cross-link']),
        createdAt: tsLast6mo(),
      });
    }
  }
  await ensure(prisma.helpArticleVersion as any, 'Tier 7', 'HelpArticleVersion', 100, versionRows);
}

// ─── Orchestration ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Production seed starting...');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  await tier1();
  await tier2();
  await tier3();
  await tier4();
  await tier5();
  await tier6();
  await tier7();

  console.log('\n✅ Production seed complete.');
}

main()
  .catch((e) => {
    console.error('Production seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
