import { v4 as uuidv4 } from 'uuid';

export type ProfileVisibility = 'public' | 'followers' | 'private';
export type PlanName = 'Free' | 'Pro' | 'Teams';
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled';

export interface PrivacyFields {
  profileVisibility: ProfileVisibility;
  allowComments: boolean;
  showLikesCount: boolean;
  showOnlineStatus: boolean;
}

export interface NotificationPrefsShape {
  push: {
    likes: boolean;
    comments: boolean;
    replies: boolean;
    follows: boolean;
    mentions: boolean;
    newArticles: boolean;
    system: boolean;
  };
  email: {
    digest: boolean;
    marketing: boolean;
  };
  soundsEnabled: boolean;
}

export interface SubscriptionShape {
  planName: PlanName;
  status: SubscriptionStatus;
  renewalDate?: string;
  cancelAtPeriodEnd: boolean;
  features: {
    aiDrafts: number;
    customDomain: boolean;
    analytics: boolean;
  };
}

export interface FaqItemShape {
  id: string;
  category: string;
  question: string;
  answer: string;
  updatedAt: string;
}

export interface UserTicketMessageShape {
  id: string;
  body: string;
  authorName: string;
  authorId: string;
  createdAt: string;
}

export type TicketCategory =
  | 'General'
  | 'Account'
  | 'Technical'
  | 'Billing'
  | 'Safety';

export type UserTicketStatus = 'open' | 'active' | 'closed';

export interface UserTicketShape {
  id: string;
  ownerId: string;
  category: TicketCategory;
  subject: string;
  status: UserTicketStatus;
  createdAt: string;
  updatedAt: string;
  messages: UserTicketMessageShape[];
}

const DEFAULT_PRIVACY: PrivacyFields = {
  profileVisibility: 'public',
  allowComments: true,
  showLikesCount: true,
  showOnlineStatus: true,
};

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefsShape = {
  push: {
    likes: true,
    comments: true,
    replies: true,
    follows: true,
    mentions: true,
    newArticles: false,
    system: true,
  },
  email: {
    digest: true,
    marketing: false,
  },
  soundsEnabled: true,
};

function makeDefaultSubscription(now = new Date()): SubscriptionShape {
  const renewal = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    planName: 'Free',
    status: 'active',
    renewalDate: renewal.toISOString(),
    cancelAtPeriodEnd: false,
    features: {
      aiDrafts: 5,
      customDomain: false,
      analytics: false,
    },
  };
}

const FAQ_SEED: Array<Omit<FaqItemShape, 'id' | 'updatedAt'>> = [
  { category: 'Getting Started', question: 'How do I create my first article?', answer: 'From the dashboard, click the "New Article" button in the top right. Give it a title, write your content using the rich editor, add a cover image, and click Publish when ready.' },
  { category: 'Getting Started', question: 'How do I customize my profile?', answer: 'Go to Settings → Profile. You can upload an avatar, update your display name, write a bio, add your website, and set your location. Save changes when done.' },
  { category: 'Getting Started', question: 'Can I import posts from another platform?', answer: 'Yes. Go to Settings → Import. We support importing Markdown files and RSS feeds. Larger imports may take a few minutes to process.' },
  { category: 'Account & Billing', question: 'How do I change my email address?', answer: 'Visit Settings → Account and click "Change Email". You must confirm the new address via a verification link we send. Your login handle stays the same.' },
  { category: 'Account & Billing', question: 'What payment methods do you accept?', answer: 'We accept all major credit cards (Visa, Mastercard, Amex), PayPal, and Apple Pay. Annual plan customers can also pay via invoice for teams of 10 or more.' },
  { category: 'Account & Billing', question: 'Can I cancel anytime and what happens to my data?', answer: 'You can cancel anytime from Settings → Billing. Your data remains accessible for 30 days after cancellation. After that, public content is preserved as read-only; private content is deleted.' },
  { category: 'Content & Writing', question: 'Does the AI writer store or train on my drafts?', answer: 'No. By default, AI drafts are processed ephemerally and are not used for model training. Enterprise customers can enable fully private processing under Settings → AI.' },
  { category: 'Content & Writing', question: 'How do I schedule an article to publish later?', answer: 'In the article editor, open the Publish dropdown and select "Schedule". Pick a date and time, and confirm. Your article will be published automatically at the chosen time.' },
  { category: 'Content & Writing', question: 'Can multiple people co-author an article?', answer: 'Pro and Teams plans support real-time collaborative editing. Invite editors via email from the article sidebar and assign viewer, editor, or owner roles.' },
  { category: 'Notifications', question: 'How do I turn off push notifications on mobile?', answer: 'From the mobile app go to Settings → Notifications and disable the categories you want to mute. You can also set a quiet-hours window there.' },
  { category: 'Notifications', question: 'What is the weekly digest email?', answer: 'The weekly digest summarizes your top-performing content, new followers, and engagement highlights. You can opt out under Notification Preferences.' },
  { category: 'Safety & Privacy', question: 'Who can see my articles and activity?', answer: 'By default your profile is public. Under Privacy Settings you can restrict profile visibility to followers only or make it fully private. Individual articles have their own visibility toggle.' },
  { category: 'Safety & Privacy', question: 'How do I block or report another user?', answer: 'From any user profile click the three-dot menu and choose Block or Report. Reports are reviewed by our moderation team within 24 hours.' },
  { category: 'Troubleshooting', question: 'The editor won\'t load. What should I do?', answer: 'First, try refreshing and disabling any content-blocking extensions. If that fails, clear your browser cache and cookies, or try an incognito window. Still stuck? Contact support.' },
  { category: 'Troubleshooting', question: 'Why aren\'t my push notifications arriving?', answer: 'Check that notifications are enabled in both your browser settings and under Notification Preferences in the app. Mobile users should also verify OS-level notification permissions for our app.' },
  { category: 'Troubleshooting', question: 'My images won\'t upload.', answer: 'Supported formats are JPG, PNG, WebP, and GIF, up to 10MB. Very large images may need compression. If using Safari, ensure "Develop → Disable Cross-Origin Restrictions" is off, or try Chrome.' },
];

export class InMemoryStore {
  private static instance: InMemoryStore;
  static getInstance(): InMemoryStore {
    if (!InMemoryStore.instance) {
      InMemoryStore.instance = new InMemoryStore();
    }
    return InMemoryStore.instance;
  }

  privacy: Map<string, PrivacyFields> = new Map();
  notifPrefs: Map<string, NotificationPrefsShape> = new Map();
  subscriptions: Map<string, SubscriptionShape> = new Map();
  faqs: FaqItemShape[] = [];
  tickets: Map<string, UserTicketShape> = new Map();
  ticketCounter = 0;
  ticketNumbers: Map<string, number> = new Map();

  private constructor() {
    this.seedFaqs();
  }

  private seedFaqs() {
    const now = new Date('2025-06-01T00:00:00Z').toISOString();
    this.faqs = FAQ_SEED.map((f) => ({
      id: 'faq-' + slugify(f.question),
      category: f.category,
      question: f.question,
      answer: f.answer,
      updatedAt: now,
    }));
  }

  getPrivacy(userId: string): PrivacyFields {
    if (!this.privacy.has(userId)) {
      this.privacy.set(userId, { ...DEFAULT_PRIVACY });
    }
    return { ...this.privacy.get(userId)! };
  }

  updatePrivacy(
    userId: string,
    patch: Partial<PrivacyFields>,
  ): PrivacyFields {
    const existing = this.getPrivacy(userId);
    const merged = { ...existing, ...patch };
    this.privacy.set(userId, merged);
    return { ...merged };
  }

  getNotificationPrefs(userId: string): NotificationPrefsShape {
    if (!this.notifPrefs.has(userId)) {
      this.notifPrefs.set(userId, deepClone(DEFAULT_NOTIFICATION_PREFS));
    }
    return deepClone(this.notifPrefs.get(userId)!);
  }

  setNotificationPrefs(
    userId: string,
    next: NotificationPrefsShape,
  ): NotificationPrefsShape {
    const defaults = deepClone(DEFAULT_NOTIFICATION_PREFS);
    const safe: NotificationPrefsShape = {
      push: {
        likes: next.push?.likes !== undefined ? !!next.push.likes : defaults.push.likes,
        comments: next.push?.comments !== undefined ? !!next.push.comments : defaults.push.comments,
        replies: next.push?.replies !== undefined ? !!next.push.replies : defaults.push.replies,
        follows: next.push?.follows !== undefined ? !!next.push.follows : defaults.push.follows,
        mentions: next.push?.mentions !== undefined ? !!next.push.mentions : defaults.push.mentions,
        newArticles: next.push?.newArticles !== undefined ? !!next.push.newArticles : defaults.push.newArticles,
        system: next.push?.system !== undefined ? !!next.push.system : defaults.push.system,
      },
      email: {
        digest: next.email?.digest !== undefined ? !!next.email.digest : defaults.email.digest,
        marketing: next.email?.marketing !== undefined ? !!next.email.marketing : defaults.email.marketing,
      },
      soundsEnabled:
        next.soundsEnabled !== undefined
          ? !!next.soundsEnabled
          : defaults.soundsEnabled,
    };
    this.notifPrefs.set(userId, safe);
    return deepClone(safe);
  }

  getSubscription(userId: string): SubscriptionShape {
    if (!this.subscriptions.has(userId)) {
      this.subscriptions.set(userId, makeDefaultSubscription());
    }
    return deepClone(this.subscriptions.get(userId)!);
  }

  restoreSubscription(userId: string): SubscriptionShape {
    const curr = this.getSubscription(userId);
    curr.status = 'active';
    curr.cancelAtPeriodEnd = false;
    this.subscriptions.set(userId, curr);
    return deepClone(curr);
  }

  listFaqs(params: {
    category?: string;
    search?: string;
    page: number;
    perPage: number;
  }): { items: FaqItemShape[]; total: number; page: number; perPage: number } {
    let items = this.faqs.slice();
    if (params.category) {
      items = items.filter(
        (f) => f.category.toLowerCase() === params.category!.toLowerCase(),
      );
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (f) =>
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q),
      );
    }
    const total = items.length;
    const start = (params.page - 1) * params.perPage;
    const paged = items.slice(start, start + params.perPage);
    return { items: paged, total, page: params.page, perPage: params.perPage };
  }

  private nextTicketNumber(userId: string): number {
    const n = (this.ticketNumbers.get(userId) ?? 0) + 1;
    this.ticketNumbers.set(userId, n);
    this.ticketCounter += 1;
    return this.ticketCounter;
  }

  listTickets(params: {
    ownerId: string;
    status: 'active' | 'closed' | 'all';
    page: number;
    perPage: number;
  }): {
    items: UserTicketShape[];
    total: number;
    page: number;
    perPage: number;
  } {
    let items = Array.from(this.tickets.values()).filter(
      (t) => t.ownerId === params.ownerId,
    );
    if (params.status === 'active') {
      items = items.filter((t) => t.status !== 'closed');
    } else if (params.status === 'closed') {
      items = items.filter((t) => t.status === 'closed');
    }
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const total = items.length;
    const start = (params.page - 1) * params.perPage;
    const paged = items.slice(start, start + params.perPage).map(stripMessages);
    return { items: paged, total, page: params.page, perPage: params.perPage };
  }

  getTicket(id: string): UserTicketShape | undefined {
    const t = this.tickets.get(id);
    if (!t) return undefined;
    return { ...t, messages: t.messages.map((m) => ({ ...m })) };
  }

  createTicket(params: {
    ownerId: string;
    ownerName: string;
    category: TicketCategory;
    subject: string;
    body: string;
  }): UserTicketShape {
    const now = new Date().toISOString();
    const id = 'ticket-' + this.nextTicketNumber(params.ownerId);
    const firstMessage: UserTicketMessageShape = {
      id: id + '-msg-1',
      body: params.body,
      authorName: params.ownerName,
      authorId: params.ownerId,
      createdAt: now,
    };
    const ticket: UserTicketShape = {
      id,
      ownerId: params.ownerId,
      category: params.category,
      subject: params.subject,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      messages: [firstMessage],
    };
    this.tickets.set(id, ticket);
    return { ...ticket, messages: ticket.messages.map((m) => ({ ...m })) };
  }

  addMessage(params: {
    ticketId: string;
    authorId: string;
    authorName: string;
    body: string;
  }): UserTicketMessageShape | undefined {
    const t = this.tickets.get(params.ticketId);
    if (!t) return undefined;
    const now = new Date().toISOString();
    const msg: UserTicketMessageShape = {
      id: params.ticketId + '-msg-' + (t.messages.length + 1),
      body: params.body,
      authorName: params.authorName,
      authorId: params.authorId,
      createdAt: now,
    };
    t.messages.push(msg);
    t.updatedAt = now;
    if (t.status === 'closed') t.status = 'active';
    else if (t.status === 'open') t.status = 'active';
    return { ...msg };
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function deepClone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

function stripMessages(t: UserTicketShape): UserTicketShape {
  return { ...t, messages: [] };
}

export const store = InMemoryStore.getInstance();
