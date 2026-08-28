/**
 * Vellbase API — User Simulation Script
 *
 * Emulates 10 realistic user personas logging into the Vellbase API and
 * performing real actions against live endpoints. Each persona registers a
 * fresh account with a unique email (firstname.lastname.simN@vellbase.com,
 * password: Vellbase2026!); if the email already exists (HTTP 409), the
 * persona falls back to login. This decouples the simulation from the exact
 * email format used by the production seed script.
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register prisma/user-simulation.ts
 *   # or: npx tsx prisma/user-simulation.ts
 *
 * Requires the NestJS API to be running on http://localhost:3001.
 *
 * NOTE ON ENDPOINT SHAPES (verified against the real controllers):
 *  - Auth login/register returns { user, accessToken, refreshToken, expiresIn }
 *    (camelCase). The token field is `accessToken`, NOT `access_token`.
 *  - Regular users create support tickets via POST /api/help/tickets (HelpController,
 *    JWT-only). POST /api/support/tickets is RBAC-gated for support agents/admins.
 *  - Article creation uses `categorySlug` (not `categoryId`) in CreateArticleDto.
 *  - Likes/bookmarks target articles via `articleSlug`, highlights via `highlightId`,
 *    comments via `commentId`. There is no "like a story" endpoint, so personas
 *    asked to "like stories" instead view story details (GET /api/stories/:authorId/:storyId),
 *    which records a real StoryView (engagement).
 *  - There is no direct change-password endpoint; the real flow is forgot/reset
 *    password. The "change password" persona action initiates the forgot-password
 *    flow (POST /api/auth/forgot-password), which is the real first step.
 */

// ─── Configuration ─────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3001';
const DEFAULT_PASSWORD = 'Vellbase2026!';
const THROTTLE_MS = 500; // wait between actions (ThrottlerModule is active)

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApiResponse<T = any> {
  status: number;
  ok: boolean;
  data: T;
  error?: string;
}

interface PersonaResult {
  name: string;
  actions: number;
  successes: number;
  failures: number;
  notes: string;
}

interface ActionLog {
  action: string;
  status: 'success' | 'failure';
  detail: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** ISO timestamp for log lines. */
function ts(): string {
  return new Date().toISOString();
}

/** Sleep helper used to respect the rate limiter between actions. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Perform a real HTTP request against the API. Network/parse errors are
 * captured per-call so a single failure never aborts the whole persona.
 */
async function apiRequest<T = any>(
  method: string,
  path: string,
  opts: { token?: string; body?: any; query?: Record<string, any> } = {},
): Promise<ApiResponse<T>> {
  let url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  if (opts.query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) params.append(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    let data: any = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { status: res.status, ok: res.ok, data };
  } catch (err: any) {
    return { status: 0, ok: false, data: null, error: err?.message ?? String(err) };
  }
}

/** Normalize a list-shaped response into an array. Handles { data: [] }, { items: [] }, and bare arrays. */
function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.articles)) return data.articles;
  if (data && Array.isArray(data.users)) return data.users;
  return [];
}

/** Take up to N items from a list. */
function take<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}

// ─── Persona Runner ──────────────────────────────────────────────────────────

/**
 * Tracks per-persona action counts and prints the formatted log lines.
 * Each action is wrapped so that failures are recorded but never abort the run.
 */
class PersonaRunner {
  personaLabel: string;
  actions = 0;
  successes = 0;
  failures = 0;
  notes: string[] = [];

  constructor(personaLabel: string) {
    this.personaLabel = personaLabel;
  }

  /**
   * Run a single action: perform the request, log the outcome with timestamp +
   * status code + success/failure marker, and update counters. Never throws.
   */
  async run(
    label: string,
    method: string,
    path: string,
    opts: { token?: string; body?: any; query?: Record<string, any> } = {},
  ): Promise<ApiResponse> {
    this.actions++;
    await sleep(THROTTLE_MS);
    const res = await apiRequest(method, path, opts);
    const statusText = res.status === 0 ? 'Network Error' : `${res.status}`;
    const loc = `${method} ${path}`;
    if (res.ok) {
      this.successes++;
      console.log(`[${ts()}] ACTION [${label}]: ${loc} → ${statusText} ✓`);
    } else {
      this.failures++;
      const msg = res.error || (res.data && (res.data.message || res.data.error)) || 'Unknown error';
      const detail = typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 200);
      console.log(`[${ts()}] ACTION [${label}]: ${loc} → ${statusText} Error: ${detail} ✗`);
    }
    return res;
  }

  /** Log an informational note (not counted as an API action). */
  note(msg: string) {
    this.notes.push(msg);
    console.log(`[${ts()}] NOTE: ${msg}`);
  }

  summary(): PersonaResult {
    return {
      name: this.personaLabel,
      actions: this.actions,
      successes: this.successes,
      failures: this.failures,
      notes: this.notes.join('; '),
    };
  }
}

/** Login via POST /api/auth/login and return the access token + user object. */
async function login(runner: PersonaRunner, email: string, password: string): Promise<{ token: string; user: any } | null> {
  const res = await runner.run('login', 'POST', '/api/auth/login', { body: { email, password } });
  if (!res.ok || !res.data) return null;
  // Real shape: { user, accessToken, refreshToken, expiresIn }
  const token = res.data.accessToken || res.data.access_token;
  const user = res.data.user;
  if (!token) {
    runner.note('Login succeeded but no access token in response');
    return null;
  }
  return { token, user };
}

/**
 * Register a fresh account via POST /api/auth/register; if the email already
 * exists (HTTP 409) or register otherwise fails, fall back to login. Mirrors
 * persona 10's pattern so personas 1-9 also work against a fresh DB without
 * depending on the seed script's exact email format.
 *
 * The AuthController throttles /api/auth/register to 5 requests per 60s per IP.
 * To keep all 10 personas from tripping that limit, registerOrLogin consults a
 * rolling-window counter and waits for a free slot before calling register.
 */
const REGISTER_TIMESTAMPS: number[] = [];
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 60_000;

async function awaitRegistrationSlot(): Promise<void> {
  const now = Date.now();
  while (REGISTER_TIMESTAMPS.length && REGISTER_TIMESTAMPS[0] <= now - REGISTER_WINDOW_MS) {
    REGISTER_TIMESTAMPS.shift();
  }
  if (REGISTER_TIMESTAMPS.length >= REGISTER_LIMIT) {
    const waitMs = REGISTER_WINDOW_MS - (now - REGISTER_TIMESTAMPS[0]) + 250;
    console.log(`[${ts()}] NOTE: register rate limit (${REGISTER_LIMIT}/${REGISTER_WINDOW_MS / 1000}s) reached; waiting ${(waitMs / 1000).toFixed(1)}s for a free slot...`);
    await sleep(waitMs);
    return awaitRegistrationSlot();
  }
  REGISTER_TIMESTAMPS.push(Date.now());
}

async function registerOrLogin(
  runner: PersonaRunner,
  name: string,
  email: string,
  handle?: string,
  bio?: string,
): Promise<{ token: string; user: any } | null> {
  const derivedHandle = handle ?? email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  // Respect the AuthController's 5-registrations-per-60s throttle.
  await awaitRegistrationSlot();
  const regRes = await runner.run('register account', 'POST', '/api/auth/register', {
    body: {
      email,
      name,
      handle: derivedHandle,
      password: DEFAULT_PASSWORD,
      ...(bio ? { bio } : {}),
    },
  });
  if (regRes.ok) {
    const token = regRes.data?.accessToken || regRes.data?.access_token;
    const user = regRes.data?.user;
    if (token) {
      runner.note('Registration succeeded; using issued token');
      return { token, user };
    }
  }
  // Fall back to login (e.g. HTTP 409 email already registered by a prior run)
  return login(runner, email, DEFAULT_PASSWORD);
}

// ─── PERSONAS ───────────────────────────────────────────────────────────────

/**
 * PERSONA 1 — Sarah Chen — Content Consumer
 * A marketing manager who reads articles during her commute, engages lightly,
 * and follows authors whose work she enjoys.
 */
async function persona1_sarah(): Promise<PersonaResult> {
  const runner = new PersonaRunner('PERSONA 1: Sarah Chen');
  console.log('\n══════════ PERSONA 1: Sarah Chen ══════════');
  const email = 'sarah.chen.sim1@vellbase.com';

  const auth = await registerOrLogin(runner, 'Sarah Chen', email);
  if (!auth) {
    runner.note('Could not log in; skipping remaining actions');
    return runner.summary();
  }
  const { token } = auth;

  // Browse articles
  const browse = await runner.run('browse articles', 'GET', '/api/articles', { token, query: { page: 1, limit: 20 } });
  const articles = asList(browse.data);
  if (articles.length === 0) runner.note('No articles found to consume');

  // Read 5 articles
  const toRead = take(articles, 5);
  for (const a of toRead) {
    await runner.run(`read article ${a.slug}`, 'GET', `/api/articles/${a.slug}`, { token });
  }

  // Like 3
  for (const a of take(toRead, 3)) {
    await runner.run(`like article ${a.slug}`, 'POST', '/api/likes/toggle', { token, body: { articleSlug: a.slug } });
  }

  // Bookmark 2
  for (const a of take(toRead, 2)) {
    await runner.run(`bookmark article ${a.slug}`, 'POST', '/api/bookmarks/toggle', { token, body: { articleSlug: a.slug } });
  }

  // Comment on 1
  if (toRead[0]) {
    await runner.run('comment on article', 'POST', '/api/comments', {
      token,
      body: { body: 'Really enjoyed this piece — the examples made it click for me. Thanks for writing!', articleSlug: toRead[0].slug },
    });
  }

  // Follow the author of the first read article
  const authorId = toRead[0]?.author?.id;
  if (authorId) {
    await runner.run(`follow author ${toRead[0].author?.handle ?? authorId}`, 'POST', `/api/follows/${authorId}`, { token });
  } else {
    runner.note('No author to follow');
  }

  // View notifications
  await runner.run('view notifications', 'GET', '/api/notifications', { token });

  console.log(`Persona 1 completed: ${runner.actions} actions, ${runner.successes} successes, ${runner.failures} failures`);
  return runner.summary();
}

/**
 * PERSONA 2 — Marcus Johnson — Power Reader
 * A senior engineer who browses highlights, watches story updates from his
 * favorite creators, and follows multiple authors.
 */
async function persona2_marcus(): Promise<PersonaResult> {
  const runner = new PersonaRunner('PERSONA 2: Marcus Johnson');
  console.log('\n══════════ PERSONA 2: Marcus Johnson ══════════');
  const email = 'marcus.johnson.sim2@vellbase.com';

  const auth = await registerOrLogin(runner, 'Marcus Johnson', email);
  if (!auth) {
    runner.note('Could not log in; skipping remaining actions');
    return runner.summary();
  }
  const { token } = auth;

  // Browse highlights
  const hl = await runner.run('browse highlights', 'GET', '/api/highlights', { token, query: { page: 1, limit: 10 } });
  const highlights = asList(hl.data);
  if (highlights.length === 0) runner.note('No highlights found');

  // Watch 3 highlights
  const toWatch = take(highlights, 3);
  for (const h of toWatch) {
    await runner.run(`watch highlight ${h.id}`, 'GET', `/api/highlights/${h.id}`, { token });
  }

  // Like 2 highlights
  for (const h of take(toWatch, 2)) {
    await runner.run(`like highlight ${h.id}`, 'POST', '/api/likes/toggle', { token, body: { highlightId: h.id } });
  }

  // Comment on 1 highlight
  if (toWatch[0]) {
    await runner.run('comment on highlight', 'POST', '/api/comments', {
      token,
      body: { body: 'This is a fantastic highlight — exactly the kind of signal I look for.', highlightId: toWatch[0].id },
    });
  }

  // View stories
  const st = await runner.run('view stories feed', 'GET', '/api/stories', { token });
  const stories = asList(st.data);
  if (stories.length === 0) runner.note('No stories found');

  // View 5 stories (records a StoryView per call)
  const toView = take(stories, 5);
  for (const s of toView) {
    const authorId = s.authorId || s.author?.id;
    if (authorId && s.id) {
      await runner.run(`view story ${s.id}`, 'GET', `/api/stories/${authorId}/${s.id}`, { token });
    }
  }

  // Follow 2 authors (from highlights/stories)
  const candidateAuthors = [
    ...highlights.map((h) => h.author).filter(Boolean),
    ...stories.map((s) => s.author).filter(Boolean),
  ];
  const seen = new Set<string>();
  const authorsToFollow = candidateAuthors.filter((a) => {
    if (!a?.id || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  }).slice(0, 2);
  for (const a of authorsToFollow) {
    await runner.run(`follow author ${a.handle ?? a.id}`, 'POST', `/api/follows/${a.id}`, { token });
  }
  if (authorsToFollow.length < 2) runner.note('Fewer than 2 distinct authors available to follow');

  console.log(`Persona 2 completed: ${runner.actions} actions, ${runner.successes} successes, ${runner.failures} failures`);
  return runner.summary();
}

/**
 * PERSONA 3 — Emily Rodriguez — Content Creator
 * A staff writer who publishes a new article, reviews her own work, checks
 * notifications for reader engagement, and replies to a comment.
 */
async function persona3_emily(): Promise<PersonaResult> {
  const runner = new PersonaRunner('PERSONA 3: Emily Rodriguez');
  console.log('\n══════════ PERSONA 3: Emily Rodriguez ══════════');
  const email = 'emily.rodriguez.sim3@vellbase.com';

  const auth = await registerOrLogin(runner, 'Emily Rodriguez', email);
  if (!auth) {
    runner.note('Could not log in; skipping remaining actions');
    return runner.summary();
  }
  const { token, user } = auth;

  // Fetch categories to use a real category slug
  const catRes = await runner.run('fetch categories', 'GET', '/api/categories', { token });
  const categories = asList(catRes.data);
  const categorySlug = categories[0]?.slug ?? 'technology';
  runner.note(`Using category slug: ${categorySlug}`);

  // Create a new article (requires CREATOR role; a 403 is a valid real outcome)
  const createRes = await runner.run('create article', 'POST', '/api/articles', {
    token,
    body: {
      title: 'Understanding Event-Driven Architecture in Node.js',
      excerpt: 'A deep dive into event-driven systems, message queues, and how they power scalable applications.',
      body: [
        'Event-driven architecture is a paradigm where services communicate through events rather than direct synchronous calls. It decouples producers from consumers and lets systems scale horizontally.',
        'In Node.js, the EventEmitter class provides a built-in way to handle events. For production systems, message brokers like Redis Streams, RabbitMQ, or Kafka add durability and fan-out semantics.',
        'The trade-off is eventual consistency: engineers must design for idempotent consumers and out-of-order delivery. Done well, the result is a resilient, elastic backend.',
      ],
      cover: 'https://images.pexels.com/photos/1181271/pexels-photo-1181271.jpeg',
      readMinutes: 7,
      categorySlug,
    },
  });

  let slug: string | undefined = createRes.data?.slug;
  if (!slug) {
    runner.note('Article creation did not return a slug; attempting to read it back from author feed');
  }

  // If created, publish it
  if (slug) {
    await runner.run(`publish article ${slug}`, 'PUT', `/api/articles/${slug}`, {
      token,
      body: { isPublished: true },
    });
  }

  // View own articles (by handle)
  if (user?.handle) {
    await runner.run('view own articles', 'GET', `/api/articles/author/${user.handle}`, { token });
  }

  // Check notifications
  await runner.run('check notifications', 'GET', '/api/notifications', { token });

  // Respond to a comment on the article (fetch comments, reply to the first)
  if (slug) {
    const commentsRes = await runner.run('fetch article comments', 'GET', '/api/comments', { token, query: { articleSlug: slug } });
    const comments = asList(commentsRes.data);
    const parent = comments[0];
    if (parent?.id) {
      await runner.run('reply to a comment', 'POST', '/api/comments', {
        token,
        body: { body: 'Thanks for the thoughtful comment — really glad this landed for you!', articleSlug: slug, parentId: parent.id },
      });
    } else {
      runner.note('No existing comments to reply to');
    }
  }

  console.log(`Persona 3 completed: ${runner.actions} actions, ${runner.successes} successes, ${runner.failures} failures`);
  return runner.summary();
}

/**
 * PERSONA 4 — David Kim — Support User
 * A customer who hits a snag with email verification, opens a support ticket,
 * follows up with extra detail, checks status, and reads help articles.
 */
async function persona4_david(): Promise<PersonaResult> {
  const runner = new PersonaRunner('PERSONA 4: David Kim');
  console.log('\n══════════ PERSONA 4: David Kim ══════════');
  const email = 'david.kim.sim4@vellbase.com';

  const auth = await registerOrLogin(runner, 'David Kim', email);
  if (!auth) {
    runner.note('Could not log in; skipping remaining actions');
    return runner.summary();
  }
  const { token } = auth;

  // Open a support ticket via the user-facing help-center endpoint
  const ticketRes = await runner.run('open support ticket', 'POST', '/api/help/tickets', {
    token,
    body: {
      subject: 'Email verification link expired before I could click it',
      message: "I received the verification email but when I clicked the link it said 'token expired'. Can you resend it? My email is david.kim.sim4@vellbase.com",
      type: 'CUSTOMER',
      priority: 'MEDIUM',
    },
  });

  const ticketId = ticketRes.data?.id;
  if (!ticketId) runner.note('Ticket creation did not return an id; follow-up actions will be skipped');

  // Add a follow-up message
  if (ticketId) {
    await runner.run('add follow-up message', 'POST', `/api/help/tickets/${ticketId}/messages`, {
      token,
      body: { body: 'Update: I also tried logging in and it worked, so the account exists — just the verification step is blocking me. Thanks!' },
    });
  }

  // Check ticket status
  if (ticketId) {
    await runner.run('check ticket status', 'GET', `/api/help/tickets/${ticketId}`, { token });
  }

  // View help / knowledge-base articles
  await runner.run('view help articles', 'GET', '/api/help/kb/articles', { token });
  await runner.run('view help categories', 'GET', '/api/help/categories', { token });

  console.log(`Persona 4 completed: ${runner.actions} actions, ${runner.successes} successes, ${runner.failures} failures`);
  return runner.summary();
}

/**
 * PERSONA 5 — Jessica Williams — Social Butterfly
 * A community member who searches for authors, follows several, browses her
 * bookmarks, likes articles across categories, views suggestions, and updates
 * her display name.
 */
async function persona5_jessica(): Promise<PersonaResult> {
  const runner = new PersonaRunner('PERSONA 5: Jessica Williams');
  console.log('\n══════════ PERSONA 5: Jessica Williams ══════════');
  const email = 'jessica.williams.sim5@vellbase.com';

  const auth = await registerOrLogin(runner, 'Jessica Williams', email);
  if (!auth) {
    runner.note('Could not log in; skipping remaining actions');
    return runner.summary();
  }
  const { token } = auth;

  // Search for authors
  const searchRes = await runner.run('search for authors', 'GET', '/api/search', {
    token,
    query: { query: 'tech', type: 'users', limit: 20 },
  });
  const foundUsers = asList(searchRes.data);

  // Follow 5 authors (top up from suggested if search is short)
  let candidates = foundUsers.slice(0, 5);
  if (candidates.length < 5) {
    const sugRes = await runner.run('fetch suggested authors', 'GET', '/api/suggested/authors', { token, query: { limit: 10 } });
    const suggested = asList(sugRes.data).map((s) => ({ id: s.id, handle: s.handle, name: s.name }));
    for (const s of suggested) {
      if (candidates.length >= 5) break;
      if (!candidates.find((c) => c.id === s.id)) candidates.push(s);
    }
  }
  for (const u of candidates.slice(0, 5)) {
    if (u?.id) await runner.run(`follow ${u.handle ?? u.id}`, 'POST', `/api/follows/${u.id}`, { token });
  }

  // Browse bookmarks
  await runner.run('browse bookmarked articles', 'GET', '/api/bookmarks/articles', { token });

  // Like 10 articles across categories
  const categories = ['technology', 'business', 'science', 'health', 'entertainment'];
  let liked = 0;
  for (const cat of categories) {
    if (liked >= 10) break;
    const res = await runner.run(`browse ${cat} articles`, 'GET', '/api/articles', { token, query: { category: cat, page: 1, limit: 5 } });
    const arts = asList(res.data);
    for (const a of arts) {
      if (liked >= 10) break;
      if (a?.slug) {
        await runner.run(`like ${a.slug}`, 'POST', '/api/likes/toggle', { token, body: { articleSlug: a.slug } });
        liked++;
      }
    }
  }
  if (liked < 10) runner.note(`Only liked ${liked} of 10 target articles (catalog may be thin)`);

  // View suggested authors (after following, to see refreshed suggestions)
  await runner.run('view suggested authors', 'GET', '/api/suggested/authors', { token, query: { limit: 5 } });

  // Update display name
  await runner.run('update display name', 'PUT', '/api/users/me', { token, body: { name: 'Jessica W.' } });

  console.log(`Persona 5 completed: ${runner.actions} actions, ${runner.successes} successes, ${runner.failures} failures`);
  return runner.summary();
}

/**
 * PERSONA 6 — Michael Brown — Settings Manager
 * A privacy-conscious user who audits his settings, tunes notification
 * preferences, updates his bio, initiates a password change, verifies the
 * settings persisted, and logs out.
 */
async function persona6_michael(): Promise<PersonaResult> {
  const runner = new PersonaRunner('PERSONA 6: Michael Brown');
  console.log('\n══════════ PERSONA 6: Michael Brown ══════════');
  const email = 'michael.brown.sim6@vellbase.com';

  const auth = await registerOrLogin(runner, 'Michael Brown', email);
  if (!auth) {
    runner.note('Could not log in; skipping remaining actions');
    return runner.summary();
  }
  const { token } = auth;

  // GET current settings
  await runner.run('get settings', 'GET', '/api/users/me/settings', { token });

  // Update notification preferences (simple UserSettings DTO)
  await runner.run('update notification preferences', 'PUT', '/api/users/me/settings', {
    token,
    body: { emailNotifications: false, pushNotifications: true, emailMarketing: false, allowComments: true, allowLikes: true, showOnlineStatus: false },
  });

  // Update fine-grained notification preferences (v1 settings)
  await runner.run('update fine-grained notification prefs', 'PUT', '/api/v1/me/notifications/preferences', {
    token,
    body: {
      push: { likes: true, comments: true, replies: true, follows: true, mentions: true, newArticles: true, system: true },
      email: { digest: true, marketing: false },
      soundsEnabled: true,
    },
  });

  // Update profile bio
  await runner.run('update profile bio', 'PUT', '/api/users/me', {
    token,
    body: { bio: 'Privacy-minded engineer. Reading on systems design and distributed storage.' },
  });

  // Change password — no direct endpoint exists; initiate the real forgot-password flow
  await runner.run('initiate password change (forgot-password)', 'POST', '/api/auth/forgot-password', {
    body: { email },
  });

  // Verify settings saved
  await runner.run('verify settings saved', 'GET', '/api/users/me/settings', { token });

  // Logout
  await runner.run('logout', 'POST', '/api/auth/logout', { token });

  console.log(`Persona 6 completed: ${runner.actions} actions, ${runner.successes} successes, ${runner.failures} failures`);
  return runner.summary();
}

/**
 * PERSONA 7 — Aisha Patel — Highlight Viewer
 * Browses highlights, views several, likes and comments on them, then explores
 * the stories feed and engages with stories (via real story-view calls).
 */
async function persona7_aisha(): Promise<PersonaResult> {
  const runner = new PersonaRunner('PERSONA 7: Aisha Patel');
  console.log('\n══════════ PERSONA 7: Aisha Patel ══════════');
  const email = 'aisha.patel.sim7@vellbase.com';

  const auth = await registerOrLogin(runner, 'Aisha Patel', email);
  if (!auth) {
    runner.note('Could not log in; skipping remaining actions');
    return runner.summary();
  }
  const { token } = auth;

  // Browse highlights
  const hl = await runner.run('browse highlights', 'GET', '/api/highlights', { token, query: { page: 1, limit: 10 } });
  const highlights = asList(hl.data);
  if (highlights.length === 0) runner.note('No highlights found');

  // View 5 highlights
  const toView = take(highlights, 5);
  for (const h of toView) {
    await runner.run(`view highlight ${h.id}`, 'GET', `/api/highlights/${h.id}`, { token });
  }

  // Like 3 highlights
  for (const h of take(toView, 3)) {
    await runner.run(`like highlight ${h.id}`, 'POST', '/api/likes/toggle', { token, body: { highlightId: h.id } });
  }

  // Comment on 2 highlights
  const toComment = take(toView, 2);
  const comments = [
    'Beautiful capture — the composition here is striking.',
    'Saving this one. The color grade is exactly what I have been aiming for.',
  ];
  for (let i = 0; i < toComment.length; i++) {
    await runner.run('comment on highlight', 'POST', '/api/comments', {
      token,
      body: { body: comments[i] ?? 'Great highlight!', highlightId: toComment[i].id },
    });
  }

  // View stories feed
  const st = await runner.run('view stories feed', 'GET', '/api/stories', { token });
  const stories = asList(st.data);
  if (stories.length === 0) runner.note('No stories found');

  // "Like" 5 stories → no like-story endpoint exists; engage by viewing 5
  // stories, which records a real StoryView on the server.
  const toStory = take(stories, 5);
  if (toStory.length === 0) {
    runner.note('No stories to engage with');
  }
  for (const s of toStory) {
    const authorId = s.authorId || s.author?.id;
    if (authorId && s.id) {
      await runner.run(`engage story ${s.id} (view)`, 'GET', `/api/stories/${authorId}/${s.id}`, { token });
    }
  }

  console.log(`Persona 7 completed: ${runner.actions} actions, ${runner.successes} successes, ${runner.failures} failures`);
  return runner.summary();
}

/**
 * PERSONA 8 — Thomas Anderson — Article Browser
 * A methodical reader who paginates the article list, filters by category,
 * reads a few, bookmarks a couple, and shares one.
 */
async function persona8_thomas(): Promise<PersonaResult> {
  const runner = new PersonaRunner('PERSONA 8: Thomas Anderson');
  console.log('\n══════════ PERSONA 8: Thomas Anderson ══════════');
  const email = 'thomas.anderson.sim8@vellbase.com';

  const auth = await registerOrLogin(runner, 'Thomas Anderson', email);
  if (!auth) {
    runner.note('Could not log in; skipping remaining actions');
    return runner.summary();
  }
  const { token } = auth;

  // Page 1
  const p1 = await runner.run('browse articles page 1', 'GET', '/api/articles', { token, query: { page: 1, limit: 20 } });
  const page1 = asList(p1.data);

  // Page 2
  const p2 = await runner.run('browse articles page 2', 'GET', '/api/articles', { token, query: { page: 2, limit: 20 } });
  const page2 = asList(p2.data);

  // Filter by category
  const catRes = await runner.run('filter by technology category', 'GET', '/api/articles', { token, query: { category: 'technology', page: 1, limit: 10 } });
  const filtered = asList(catRes.data);

  // Read 3 articles (prefer filtered, then page results)
  const pool = [...filtered, ...page1, ...page2];
  const deduped = pool.filter((a, i, arr) => a?.slug && arr.findIndex((x) => x.slug === a.slug) === i);
  const toRead = take(deduped, 3);
  for (const a of toRead) {
    await runner.run(`read article ${a.slug}`, 'GET', `/api/articles/${a.slug}`, { token });
  }

  // Bookmark 2
  for (const a of take(toRead, 2)) {
    await runner.run(`bookmark ${a.slug}`, 'POST', '/api/bookmarks/toggle', { token, body: { articleSlug: a.slug } });
  }

  // Share 1
  if (toRead[0]) {
    await runner.run(`share ${toRead[0].slug}`, 'POST', `/api/articles/${toRead[0].slug}/share`, { token });
  }

  console.log(`Persona 8 completed: ${runner.actions} actions, ${runner.successes} successes, ${runner.failures} failures`);
  return runner.summary();
}

/**
 * PERSONA 9 — Olivia Martinez — Mobile-like User
 * A phone-first user who checks her profile, scrolls stories, watches a batch
 * of them, browses highlights, and updates her avatar.
 */
async function persona9_olivia(): Promise<PersonaResult> {
  const runner = new PersonaRunner('PERSONA 9: Olivia Martinez');
  console.log('\n══════════ PERSONA 9: Olivia Martinez ══════════');
  const email = 'olivia.martinez.sim9@vellbase.com';

  const auth = await registerOrLogin(runner, 'Olivia Martinez', email);
  if (!auth) {
    runner.note('Could not log in; skipping remaining actions');
    return runner.summary();
  }
  const { token } = auth;

  // Get current user
  await runner.run('get current user', 'GET', '/api/users/me', { token });

  // Stories feed
  const st = await runner.run('get stories', 'GET', '/api/stories', { token });
  const stories = asList(st.data);
  if (stories.length === 0) runner.note('No stories found');

  // View 10 stories
  const toView = take(stories, 10);
  for (const s of toView) {
    const authorId = s.authorId || s.author?.id;
    if (authorId && s.id) {
      await runner.run(`view story ${s.id}`, 'GET', `/api/stories/${authorId}/${s.id}`, { token });
    }
  }
  if (toView.length < 10) runner.note(`Only ${toView.length} stories available to view`);

  // Highlights
  const hl = await runner.run('get highlights', 'GET', '/api/highlights', { token, query: { page: 1, limit: 10 } });
  const highlights = asList(hl.data);

  // View 5 highlights
  for (const h of take(highlights, 5)) {
    await runner.run(`view highlight ${h.id}`, 'GET', `/api/highlights/${h.id}`, { token });
  }

  // Update avatar URL
  await runner.run('update avatar URL', 'PUT', '/api/users/me', {
    token,
    body: { avatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg' },
  });

  console.log(`Persona 9 completed: ${runner.actions} actions, ${runner.successes} successes, ${runner.failures} failures`);
  return runner.summary();
}

/**
 * PERSONA 10 — Daniel Lee — New User Onboarding
 * A brand-new user who registers, attempts email verification, logs in,
 * sets up his bio, follows a few authors, likes his first article, and
 * browses suggested content.
 */
async function persona10_daniel(): Promise<PersonaResult> {
  const runner = new PersonaRunner('PERSONA 10: Daniel Lee');
  console.log('\n══════════ PERSONA 10: Daniel Lee ══════════');
  const email = 'daniel.lee.10@vellbase.com';

  // Register — if the email already exists (409), fall back to login (realistic returning user)
  const regRes = await runner.run('register new account', 'POST', '/api/auth/register', {
    body: {
      email,
      handle: 'daniellee10',
      name: 'Daniel Lee',
      password: DEFAULT_PASSWORD,
      bio: 'Just joined Vellbase — excited to learn and follow great writers.',
    },
  });

  let token: string | undefined;
  if (regRes.ok && regRes.data?.accessToken) {
    token = regRes.data.accessToken;
    runner.note('Registration succeeded; using issued token');
  } else {
    // Fall back to login (e.g. email already registered by seed)
    const auth = await login(runner, email, DEFAULT_PASSWORD);
    token = auth?.token;
  }
  if (!token) {
    runner.note('Could not obtain an auth token; skipping remaining actions');
    return runner.summary();
  }

  // Verify email — requires a token emailed to the user, which we don't have.
  // We issue the real verify-email call; a 400 is the expected real outcome here.
  await runner.run('verify email (no token available)', 'POST', '/api/auth/verify-email', {
    body: { token: '00000000-0000-0000-0000-000000000000' },
  });

  // Update bio
  await runner.run('update bio', 'PUT', '/api/users/me', {
    token,
    body: { bio: 'New here. Developer interested in distributed systems and good product writing.' },
  });

  // Follow 3 authors (from suggested authors)
  const sugRes = await runner.run('fetch suggested authors', 'GET', '/api/suggested/authors', { token, query: { limit: 5 } });
  const suggested = asList(sugRes.data);
  const toFollow = take(suggested, 3);
  for (const a of toFollow) {
    if (a?.id) await runner.run(`follow ${a.handle ?? a.id}`, 'POST', `/api/follows/${a.id}`, { token });
  }
  if (toFollow.length < 3) runner.note(`Only ${toFollow.length} authors available to follow`);

  // Like first article
  const feedRes = await runner.run('browse suggested articles', 'GET', '/api/suggested/articles', { token, query: { limit: 5 } });
  const suggArticles = asList(feedRes.data);
  if (suggArticles[0]?.slug) {
    await runner.run(`like first article ${suggArticles[0].slug}`, 'POST', '/api/likes/toggle', { token, body: { articleSlug: suggArticles[0].slug } });
  } else {
    // Fallback: like the first article from the main feed
    const af = await runner.run('browse articles feed', 'GET', '/api/articles', { token, query: { page: 1, limit: 5 } });
    const first = asList(af.data)[0];
    if (first?.slug) {
      await runner.run(`like first article ${first.slug}`, 'POST', '/api/likes/toggle', { token, body: { articleSlug: first.slug } });
    } else {
      runner.note('No article available to like');
    }
  }

  // View suggested content
  await runner.run('view suggested articles', 'GET', '/api/suggested/articles', { token, query: { limit: 4 } });

  console.log(`Persona 10 completed: ${runner.actions} actions, ${runner.successes} successes, ${runner.failures} failures`);
  return runner.summary();
}

// ─── Final summary printer ───────────────────────────────────────────────────

function printFinalSummary(results: PersonaResult[]): void {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                          FINAL SUMMARY                                              ║');
  console.log('╠═══════════════════════════════════════╦═════════╦═══════════╦═══════════╦════════════════════════════╣');
  console.log('║ Persona                                ║ Actions ║ Successes ║ Failures  ║ Notes                       ║');
  console.log('╠═══════════════════════════════════════╬═════════╬═══════════╬═══════════╬════════════════════════════╣');

  const pad = (s: string, n: number) => (s + ' '.repeat(n)).slice(0, n);

  let totalActions = 0;
  let totalSuccesses = 0;
  let totalFailures = 0;
  for (const r of results) {
    totalActions += r.actions;
    totalSuccesses += r.successes;
    totalFailures += r.failures;
    const notes = r.notes || '—';
    console.log(`║ ${pad(r.name, 37)} ║ ${pad(String(r.actions), 7)} ║ ${pad(String(r.successes), 9)} ║ ${pad(String(r.failures), 9)} ║ ${pad(notes, 26)} ║`);
  }

  console.log('╠═══════════════════════════════════════╬═════════╬═══════════╬═══════════╬════════════════════════════╣');
  console.log(`║ ${pad('TOTAL', 37)} ║ ${pad(String(totalActions), 7)} ║ ${pad(String(totalSuccesses), 9)} ║ ${pad(String(totalFailures), 9)} ║ ${pad(`${results.length} personas`, 26)} ║`);
  console.log('╚═══════════════════════════════════════╩═════════╩═══════════╩═══════════╩════════════════════════════╝');
}

// ─── main() ─────────────────────────────────────────────────────────────────

/**
 * Run all 10 personas sequentially and print the final summary table.
 * Sequential execution (with the per-action throttle) keeps the run within
 * the ThrottlerModule's per-IP limits while still exercising every persona.
 */
export async function main(): Promise<void> {
  console.log('╗');
  console.log('║  Vellbase API — User Simulation');
  console.log(`║  Target: ${BASE_URL}/api`);
  console.log(`║  Started: ${ts()}`);
  console.log('║  Running 10 personas sequentially (500ms throttle between actions)');
  console.log('╝');

  const results: PersonaResult[] = [];

  results.push(await persona1_sarah());
  results.push(await persona2_marcus());
  results.push(await persona3_emily());
  results.push(await persona4_david());
  results.push(await persona5_jessica());
  results.push(await persona6_michael());
  results.push(await persona7_aisha());
  results.push(await persona8_thomas());
  results.push(await persona9_olivia());
  results.push(await persona10_daniel());

  printFinalSummary(results);
  console.log(`\nSimulation finished at ${ts()}\n`);
}

// Run when executed directly (ts-node / tsx), not when imported.
if (require.main === module) {
  main().catch((err) => {
    console.error('Simulation failed unexpectedly:', err);
    process.exit(1);
  });
}
