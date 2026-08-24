// ─── Suggested Module — TDD Test Suite ──────────────────────────────────────
// Phase 1 (RED): Fail-first tests for known production issues.
// Phase 2 (GREEN): Fix service to pass.
// Phase 3 (REFACTOR): Keep green, tighten types, remove "any".

import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { SuggestedService } from "./suggested.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CacheService } from "../../shared/cache/cache.service";
import { Logger } from "@nestjs/common";

// =========================================================================
// Mock Prisma — deterministic in-memory tables
// =========================================================================

type ARTICLE = {
  id: string; slug: string | null; authorId: string; isPublished: boolean;
  deletedAt: Date | null; featured: boolean; likesCount: number; createdAt: Date;
  categoryId?: string | null; title?: string;
};
type USER = {
  id: string; handle: string; name: string; avatar: string | null;
  bio: string | null; isActive: boolean; deletedAt: Date | null;
  role: "GUEST" | "USER" | "CREATOR" | "MODERATOR" | "SUPPORT_ADMIN" | "ADMIN" | "PLATFORM_ADMIN" | "SUPER_ADMIN";
  createdAt: Date;
};
type FOLLOW = { id: string; followerId: string; followingId: string; createdAt: Date };
type LIKE = { id: string; userId: string; articleSlug: string | null };
type BOOKMARK = { id: string; userId: string; articleSlug: string | null };
type CATEGORY = { id: string; name: string };

class MockPrisma {
  nextId = 1;
  uid(prefix: string) { return `${prefix}-${this.nextId++}`; }

  _articles: ARTICLE[] = [];
  _users: USER[] = [];
  _follows: FOLLOW[] = [];
  _likes: LIKE[] = [];
  _bookmarks: BOOKMARK[] = [];
  _categories: CATEGORY[] = [
    { id: "cat-1", name: "Tech" },
    { id: "cat-2", name: "Art" },
  ];
  // Fault-injection hooks: keyed by "model.method" => error to throw
  _faults = new Map<string, Error>();
  private triggerFault(key: string): void {
    const e = this._faults.get(key);
    if (e) { this._faults.delete(key); throw e; }
  }

  constructor() { this.seed(); }

  seed() {
    const now = new Date("2025-01-01T00:00:00Z");
    // Users (roles): u-guest GUEST, u-user USER, u-creator1/2 CREATOR, u-mod MODERATOR, u-admin ADMIN, u-super SUPER_ADMIN, u-plat PLATFORM_ADMIN, u-inactive CREATOR (inactive), u-deleted CREATOR (deleted)
    const mkUser = (partial: Partial<USER> & { id: string; role: USER["role"]; handle: string; name: string }): USER => ({
      avatar: null, bio: "", isActive: true, deletedAt: null, createdAt: now, ...partial,
    });
    this._users = [
      mkUser({ id: "u-guest", role: "GUEST", handle: "guest1", name: "Guest User" }),
      mkUser({ id: "u-user", role: "USER", handle: "regular-user", name: "Regular User" }),
      mkUser({ id: "u-c1", role: "CREATOR", handle: "creator1", name: "Creator One", avatar: "/c1.png", bio: "I'm a creator",
        createdAt: new Date("2024-01-01") }),
      mkUser({ id: "u-c2", role: "CREATOR", handle: "creator2", name: "Creator Two", avatar: "/c2.png", bio: "Content",
        createdAt: new Date("2024-02-01") }),
      mkUser({ id: "u-c3", role: "CREATOR", handle: "creator3", name: "Creator Three", avatar: "/c3.png", bio: "Third",
        createdAt: new Date("2024-03-01") }),
      mkUser({ id: "u-mod", role: "MODERATOR", handle: "mod1", name: "Mod User" }),
      mkUser({ id: "u-admin", role: "ADMIN", handle: "admin1", name: "Admin User" }),
      mkUser({ id: "u-plat", role: "PLATFORM_ADMIN", handle: "plat1", name: "Platform Admin" }),
      mkUser({ id: "u-super", role: "SUPER_ADMIN", handle: "super1", name: "Super Admin" }),
      mkUser({ id: "u-support", role: "SUPPORT_ADMIN", handle: "support1", name: "Support Admin" }),
      mkUser({ id: "u-inactive", role: "CREATOR", handle: "inactive1", name: "Inactive Creator", isActive: false }),
      mkUser({ id: "u-deleted", role: "CREATOR", handle: "deleted1", name: "Deleted Creator", deletedAt: now }),
      mkUser({ id: "u-follower", role: "USER", handle: "follower-joe", name: "Joe Follower" }),
    ];

    // Articles: each creator publishes some. c1 has 3 (one featured, high likes), c2 has 2, c3 2, c-inactive 1
    const mkArticle = (a: Partial<ARTICLE> & { id: string; slug: string; authorId: string }): ARTICLE => ({
      isPublished: true, deletedAt: null, featured: false, likesCount: 0,
      createdAt: now, categoryId: "cat-1", title: a.slug, ...a,
    });
    this._articles = [
      mkArticle({ id: "a1", slug: "a-one", authorId: "u-c1", featured: true, likesCount: 100, createdAt: new Date("2025-01-02") }),
      mkArticle({ id: "a2", slug: "a-two", authorId: "u-c1", likesCount: 15, createdAt: new Date("2025-01-03") }),
      mkArticle({ id: "a3", slug: "a-three", authorId: "u-c1", likesCount: 1, createdAt: new Date("2025-01-01") }),
      mkArticle({ id: "a4", slug: "a-four", authorId: "u-c2", likesCount: 200, createdAt: new Date("2025-01-02") }),
      mkArticle({ id: "a5", slug: "a-five", authorId: "u-c2", likesCount: 10, createdAt: new Date("2025-01-01") }),
      mkArticle({ id: "a6", slug: "a-six", authorId: "u-c3", likesCount: 50, createdAt: new Date("2025-01-01") }),
      mkArticle({ id: "a7", slug: "a-seven", authorId: "u-c3", likesCount: 0, createdAt: new Date("2024-12-30") }),
      mkArticle({ id: "a8-unpublished", slug: "a-unpub", authorId: "u-c1", isPublished: false }),
      mkArticle({ id: "a9-deleted", slug: "a-del", authorId: "u-c2", deletedAt: now }),
      mkArticle({ id: "a10-inactive-author", slug: "a-inac", authorId: "u-inactive" }),
      mkArticle({ id: "a11-deleted-author", slug: "a-delauth", authorId: "u-deleted" }),
    ];

    // Follows: u-follower follows u-c1
    this._follows = [
      { id: "f-1", followerId: "u-follower", followingId: "u-c1", createdAt: now },
    ];
    // Likes: u-follower liked a4 (creator2)
    this._likes = [{ id: "l-1", userId: "u-follower", articleSlug: "a-four" }];
    // Bookmarks: u-follower bookmarked a6
    this._bookmarks = [{ id: "b-1", userId: "u-follower", articleSlug: "a-six" }];
  }

  // Generic helpers
  private userById(id: string) { return this._users.find(u => u.id === id) ?? null; }
  private categoryById(id?: string | null) {
    return this._categories.find(c => c.id === id) ?? null;
  }

  // ─── Prisma-like client facade ───────────────────────────────────────────
  get article() {
    const me = this;
    return {
      findMany: async (q: any) => {
        me.triggerFault("article.findMany");
        const w = q.where || {};
        let rows = me._articles.slice();
        if (w.isPublished === true) rows = rows.filter(r => r.isPublished);
        if (w.isPublished === false) rows = rows.filter(r => !r.isPublished);
        if (w.deletedAt === null) rows = rows.filter(r => r.deletedAt === null);
        // authorId filter: supports { notIn, not } nested operators
        if (w.authorId && typeof w.authorId === "object") {
          if (w.authorId.notIn) rows = rows.filter(r => !w.authorId.notIn.includes(r.authorId));
          if (w.authorId.not) rows = rows.filter(r => r.authorId !== w.authorId.not);
        } else if (w.authorId) {
          rows = rows.filter(r => r.authorId === w.authorId);
        }
        // id filter: supports { not, in } nested operators
        if (w.id && typeof w.id === "object") {
          if (w.id.not) rows = rows.filter(r => r.id !== w.id.not);
          if (w.id.in) rows = rows.filter(r => w.id.in.includes(r.id));
        } else if (w.id) {
          rows = rows.filter(r => r.id === w.id);
        }
        // Order: featured desc, likesCount desc, createdAt desc
        const order = (q.orderBy || []).map((o: any) => Object.entries(o)[0] as [string, string]);
        rows.sort((a: any, b: any) => {
          for (const [field, dir] of order) {
            const av = a[field]; const bv = b[field];
            const cmp = av instanceof Date ? av.getTime() - (bv as Date).getTime()
              : typeof av === "boolean" ? (av === bv ? 0 : av ? -1 : 1)
              : (av as number) - (bv as number);
            if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
          }
          return 0;
        });
        const skip = q.skip ?? 0;
        const take = q.take ?? rows.length;
        const sliced = rows.slice(skip, skip + take);
        // include author + category
        if (q.include) {
          return sliced.map(a => ({
            ...a,
            author: q.include.author
              ? (() => {
                  const u = me.userById(a.authorId)!;
                  const sel = q.include.author.select;
                  if (!sel) return u;
                  const out: any = {};
                  for (const k of Object.keys(sel)) if (u) out[k] = (u as any)[k];
                  return out;
                })()
              : undefined,
            category: q.include.category ? me.categoryById(a.categoryId) : undefined,
          }));
        }
        return sliced;
      },
    };
  }

  get user() {
    const me = this;
    return {
      findMany: async (q: any) => {
        const w = q.where || {};
        let rows = me._users.slice();
        if (w.isActive === true) rows = rows.filter(r => r.isActive);
        if (w.deletedAt === null) rows = rows.filter(r => r.deletedAt === null);
        if (w.role?.in) rows = rows.filter(r => w.role.in.includes(r.role));
        // id filter: supports { notIn, not } nested operators
        if (w.id && typeof w.id === "object") {
          if (w.id.notIn) rows = rows.filter(r => !w.id.notIn.includes(r.id));
          if (w.id.not) rows = rows.filter(r => r.id !== w.id.not);
        } else if (w.id) {
          rows = rows.filter(r => r.id === w.id);
        }
        // Sort by followers _count desc then createdAt desc
        const order = (q.orderBy || []).map((o: any) => {
          const [k1, v1] = Object.entries(o)[0] as [string, any];
          if (k1 === "followers" && v1._count) return ["_followers", v1._count] as [string, string];
          return [k1, v1] as [string, string];
        });
        rows.sort((ua: any, ub: any) => {
          for (const [field, dir] of order) {
            let av: any, bv: any;
            if (field === "_followers") {
              av = me._follows.filter(f => f.followingId === ua.id).length;
              bv = me._follows.filter(f => f.followingId === ub.id).length;
            } else {
              av = ua[field]; bv = ub[field];
            }
            const cmp = av instanceof Date ? av.getTime() - (bv as Date).getTime()
              : typeof av === "number" ? av - bv
              : String(av).localeCompare(String(bv));
            if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
          }
          return 0;
        });
        const skip = q.skip ?? 0;
        const take = q.take ?? rows.length;
        const sliced = rows.slice(skip, skip + take);
        const sel = q.select;
        return sliced.map(u => {
          const followersCount = me._follows.filter(f => f.followingId === u.id).length;
          const articlesCount = me._articles.filter(a => a.authorId === u.id && a.isPublished && a.deletedAt === null).length;
          if (!sel) return { ...u, followersCount, articlesCount };
          const out: any = {};
          for (const k of Object.keys(sel)) {
            if (k === "_count") {
              out._count = {
                ...(sel._count.select?.followers ? { followers: followersCount } : {}),
                ...(sel._count.select?.articles ? { articles: articlesCount } : {}),
              };
              continue;
            }
            out[k] = (u as any)[k];
          }
          return out;
        });
      },
    };
  }

  get follow() {
    const me = this;
    return {
      findMany: async (q: any) => {
        const w = q.where || {};
        let rows = me._follows.slice();
        if (w.followerId) rows = rows.filter(r => r.followerId === w.followerId);
        // Join with users for following.{isActive, deletedAt} relation filter
        if (w.following) {
          rows = rows.filter(r => {
            const followingUser = me._users.find(u => u.id === r.followingId);
            if (!followingUser) return false;
            if (w.following.isActive === true && !followingUser.isActive) return false;
            if (w.following.deletedAt === null && followingUser.deletedAt !== null) return false;
            return true;
          });
        }
        if (q.select) return rows.map(r => {
          const out: any = {};
          for (const k of Object.keys(q.select)) out[k] = (r as any)[k];
          return out;
        });
        return rows;
      },
    };
  }

  get like() {
    const me = this;
    return {
      findMany: async (q: any) => {
        const w = q.where || {};
        let rows = me._likes.slice();
        if (w.userId) rows = rows.filter(r => r.userId === w.userId);
        if (w.articleSlug?.in) rows = rows.filter(r => r.articleSlug != null && w.articleSlug.in.includes(r.articleSlug));
        if (q.select) return rows.map(r => {
          const out: any = {};
          for (const k of Object.keys(q.select)) out[k] = (r as any)[k];
          return out;
        });
        return rows;
      },
    };
  }

  get bookmark() {
    const me = this;
    return {
      findMany: async (q: any) => {
        const w = q.where || {};
        let rows = me._bookmarks.slice();
        if (w.userId) rows = rows.filter(r => r.userId === w.userId);
        if (w.articleSlug?.in) rows = rows.filter(r => r.articleSlug != null && w.articleSlug.in.includes(r.articleSlug));
        if (q.select) return rows.map(r => {
          const out: any = {};
          for (const k of Object.keys(q.select)) out[k] = (r as any)[k];
          return out;
        });
        return rows;
      },
    };
  }
}

// =========================================================================
// Mock CacheService — capture get/set/del calls and return stored values
// =========================================================================
class MockCache {
  store = new Map<string, { v: any; ttl?: number; setAt: number }>();
  stats = { get: 0, set: 0, del: 0, hits: 0, misses: 0 };
  async get<T = any>(key: string): Promise<T | null> {
    this.stats.get++;
    const entry = this.store.get(key);
    if (!entry) { this.stats.misses++; return null as any; }
    if (entry.ttl && (Date.now() - entry.setAt) / 1000 > entry.ttl) {
      this.store.delete(key); this.stats.misses++; return null as any;
    }
    this.stats.hits++;
    return entry.v as T;
  }
  async set<T>(key: string, value: T, ttlSec?: number): Promise<void> {
    this.stats.set++;
    this.store.set(key, { v: value, ttl: ttlSec, setAt: Date.now() });
  }
  async del(key: string): Promise<void> {
    this.stats.del++;
    this.store.delete(key);
  }
}

// =========================================================================
// Suite: SuggestedService — RED tests
// =========================================================================

describe("SuggestedService — Production hardening (TDD suite)", () => {
  let service: SuggestedService;
  let prisma: MockPrisma;
  let cache: MockCache;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeAll(async () => {
    // Use real Nest Logger spy to confirm no raw console.error calls
    loggerErrorSpy = jest.spyOn(Logger.prototype as any, "error").mockImplementation(() => void 0);
    loggerWarnSpy = jest.spyOn(Logger.prototype as any, "warn").mockImplementation(() => void 0);
  });

  beforeEach(async () => {
    prisma = new MockPrisma();
    cache = new MockCache();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestedService,
        { provide: PrismaService, useValue: prisma as any },
        { provide: CacheService, useValue: cache as any },
      ],
    }).compile();
    service = module.get<SuggestedService>(SuggestedService);
    jest.clearAllMocks();
    cache.stats = { get: 0, set: 0, del: 0, hits: 0, misses: 0 };
    cache.store.clear();
  });

  // ==========================================================================
  // BUG #1 + BUG #11 — Suggested authors must NOT include GUEST or USER or
  // ADMIN/MODERATOR/SUPPORT_ADMIN etc. Only CREATOR authors, consistent
  // between getSuggestedAuthors AND getReplacementAuthor.
  // ==========================================================================
  it("BUG #1/#11: getSuggestedAuthors includes only CREATOR role (no GUEST/USER/ADMIN/MOD)", async () => {
    const res = await service.getSuggestedAuthors(undefined, 20, 0);
    const returnedRoles = new Set();
    for (const author of prisma._users.filter(u =>
      res.data.some((d: any) => d.id === u.id)
    )) returnedRoles.add(author.role);
    expect(returnedRoles.has("CREATOR")).toBe(true);
    expect(returnedRoles.has("GUEST")).toBe(false);
    expect(returnedRoles.has("USER")).toBe(false);
    expect(returnedRoles.has("ADMIN")).toBe(false);
    expect(returnedRoles.has("MODERATOR")).toBe(false);
    expect(returnedRoles.has("SUPPORT_ADMIN")).toBe(false);
    expect(returnedRoles.has("SUPER_ADMIN")).toBe(false);
    expect(returnedRoles.has("PLATFORM_ADMIN")).toBe(false);
  });

  it("BUG #1 cont: getReplacementAuthor also uses same CREATOR-only role filter (no ADMIN/MOD)", async () => {
    // Exclude a creator so replacement picks a different one
    const rep = await service.getReplacementAuthor(undefined, "u-c1");
    expect(rep).not.toBeNull();
    const u = prisma._users.find(x => x.id === rep!.id);
    expect(u!.role).toBe("CREATOR");
    expect(["ADMIN", "MODERATOR", "GUEST", "USER", "SUPPORT_ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"].includes(u!.role)).toBe(false);
  });

  it("Bug #7: getSuggestedAuthors filters out inactive + deleted users", async () => {
    const res = await service.getSuggestedAuthors(undefined, 50, 0);
    const ids = res.data.map((a: any) => a.id);
    expect(ids).not.toContain("u-inactive");
    expect(ids).not.toContain("u-deleted");
  });

  it("Bug #7 cont: getSuggestedArticles — authors from followed list who are inactive are still excluded (getFollowedAuthorIds isActive filter)", async () => {
    // Make u-follower follow u-inactive (inactive CREATOR). The followed ID list should still filter out inactive authors so they aren't skipped incorrectly.
    prisma._follows.push({ id: "f-99", followerId: "u-follower", followingId: "u-inactive", createdAt: new Date() });
    // For getSuggestedArticles: when we getFollowedAuthorIds, inactive/deleted should NOT be included (they shouldn't be considered 'followed' for the exclusion), so u-inactive's active articles remain suggested.
    const res = await service.getSuggestedArticles("u-follower", 50, 0);
    const authorIds = new Set(res.data.map((a: any) => a.author.id));
    expect(authorIds.has("u-inactive")).toBe(true);
  });

  // ==========================================================================
  // BUG #4/#10 — input validation: reject negative limit/offset, cap extremes
  // ==========================================================================
  it("BUG #4: negative limit throws BadRequestException", async () => {
    await expect(service.getSuggestedArticles("u-follower", -1, 0)).rejects.toThrow(BadRequestException);
  });
  it("BUG #4: negative offset throws BadRequestException", async () => {
    await expect(service.getSuggestedArticles("u-follower", 4, -5)).rejects.toThrow(BadRequestException);
  });
  it("BUG #10: limit > MAX_LIMIT (50) capped to max OR throws — test the boundary", async () => {
    // Cap to max: pass 1000, get <= 50 items back
    const res = await service.getSuggestedArticles(undefined, 1000, 0);
    expect(res.data.length).toBeLessThanOrEqual(50);
    expect(res.limit).toBeLessThanOrEqual(50);
  });
  it("BUG #10: offset cap (prevent huge offsets) — offset > 5000 capped or throws", async () => {
    await expect(service.getSuggestedArticles(undefined, 10, 20000)).rejects.toThrow(BadRequestException);
  });
  it("BUG #4: same validation applies to authors endpoint", async () => {
    await expect(service.getSuggestedAuthors("u-follower", -1, 0)).rejects.toThrow(BadRequestException);
    await expect(service.getSuggestedAuthors("u-follower", 10, -1)).rejects.toThrow(BadRequestException);
    const capRes = await service.getSuggestedAuthors(undefined, 1000, 0);
    expect(capRes.limit).toBeLessThanOrEqual(50);
  });

  // ==========================================================================
  // BUG #3 — enrichWithUserState: null slugs don't falsely flip to false
  // ==========================================================================
  it("BUG #3: null slugs in article data still resolve safely (no crash, default false)", async () => {
    // Add a test article with null slug (schema allows)
    prisma._articles.push({
      id: "a-nullslug", slug: null, authorId: "u-c2", isPublished: true, deletedAt: null,
      featured: false, likesCount: 0, createdAt: new Date("2025-01-01"), categoryId: "cat-1",
      title: "no-slug",
    });
    const res = await service.getSuggestedArticles(undefined, 50, 0);
    const withNull = res.data.find((a: any) => a.slug === null);
    expect(withNull).toBeDefined();
    expect(withNull.isLiked).toBe(false);
    expect(withNull.isBookmarked).toBe(false);
  });

  // ==========================================================================
  // BUG #8 — Caching: repeated calls with same userId/limit/offset hit cache
  // ==========================================================================
  it("BUG #8: getSuggestedArticles caches repeated identical queries (Cache.set/get hit)", async () => {
    const res1 = await service.getSuggestedArticles("u-follower", 4, 0);
    const setsAfter1 = cache.stats.set;
    const getsAfter1 = cache.stats.get;
    expect(setsAfter1).toBeGreaterThanOrEqual(1); // at least one set
    expect(getsAfter1).toBeGreaterThanOrEqual(1); // at least one get (miss)
    const res2 = await service.getSuggestedArticles("u-follower", 4, 0);
    expect(cache.stats.hits).toBeGreaterThanOrEqual(1);
    expect(res2).toEqual(res1);
  });
  it("BUG #8 cont: getSuggestedAuthors caches repeated identical queries", async () => {
    const res1 = await service.getSuggestedAuthors("u-follower", 5, 0);
    expect(cache.stats.set).toBeGreaterThanOrEqual(1);
    await service.getSuggestedAuthors("u-follower", 5, 0);
    expect(cache.stats.hits).toBeGreaterThanOrEqual(1);
  });
  it("BUG #8 cont: different userId = different cache key (no cross-user leak)", async () => {
    await service.getSuggestedArticles("u-user", 4, 0);
    const beforeHits = cache.stats.hits;
    await service.getSuggestedArticles("u-admin", 4, 0); // different user
    // No hit for a different user; stats.hits should remain equal to before or after only from prior tests not leaking
    expect(cache.stats.hits).toBe(beforeHits);
  });

  // ==========================================================================
  // Functional correctness
  // ==========================================================================
  it("getSuggestedArticles excludes followed author articles for authenticated user", async () => {
    // u-follower follows u-c1. c1 has 3 published articles.
    const res = await service.getSuggestedArticles("u-follower", 50, 0);
    const authorIds = new Set(res.data.map((a: any) => a.author.id));
    expect(authorIds.has("u-c1")).toBe(false); // followed
    expect(authorIds.has("u-c2")).toBe(true);
    expect(authorIds.has("u-c3")).toBe(true);
  });

  it("getSuggestedArticles excludes self-authored articles for authenticated user", async () => {
    // u-c1 authored a1, a2, a3. Should not see their own articles.
    const res = await service.getSuggestedArticles("u-c1", 50, 0);
    const authorIds = new Set(res.data.map((a: any) => a.author.id));
    expect(authorIds.has("u-c1")).toBe(false);
  });

  it("getSuggestedArticles returns hasMore correctly when more than limit", async () => {
    const res = await service.getSuggestedArticles(undefined, 2, 0);
    expect(res.hasMore).toBe(true);
    expect(res.data.length).toBe(2);
    const resAll = await service.getSuggestedArticles(undefined, 50, 0);
    const end = await service.getSuggestedArticles(undefined, 50, resAll.data.length);
    expect(end.hasMore).toBe(false);
  });

  it("getSuggestedArticles enriches isLiked + isBookmarked correctly for auth user", async () => {
    const res = await service.getSuggestedArticles("u-follower", 50, 0);
    const a4 = res.data.find((a: any) => a.slug === "a-four");
    const a6 = res.data.find((a: any) => a.slug === "a-six");
    const a5 = res.data.find((a: any) => a.slug === "a-five");
    expect(a4.isLiked).toBe(true);
    expect(a4.isBookmarked).toBe(false);
    expect(a6.isBookmarked).toBe(true);
    expect(a6.isLiked).toBe(false);
    expect(a5.isLiked).toBe(false);
    expect(a5.isBookmarked).toBe(false);
  });

  it("getReplacementArticle excludes the specified article + author + returned enrich", async () => {
    const rep = await service.getReplacementArticle("u-follower", "a-four", "u-c2");
    expect(rep).not.toBeNull();
    expect(rep!.id).not.toBe("a-four");
    expect((rep as any).author.id).not.toBe("u-c2");
    // Should still have enrich flags
    expect("isLiked" in rep!).toBe(true);
  });

  it("getReplacementArticle returns null if no articles available", async () => {
    // Force: remove all but one, call with it excluded
    const only = prisma._articles[0].id;
    const onlyAuthor = prisma._articles[0].authorId;
    const saved = prisma._articles.slice();
    prisma._articles = prisma._articles.filter(a => a.id === only && a.isPublished && !a.deletedAt);
    const rep = await service.getReplacementArticle(undefined, only, onlyAuthor);
    prisma._articles = saved;
    expect(rep).toBeNull();
  });

  it("getReplacementAuthor excludes specified author + returns same fields", async () => {
    const rep = await service.getReplacementAuthor("u-follower", "u-c1");
    expect(rep).not.toBeNull();
    expect(rep!.id).not.toBe("u-c1");
    expect(rep!.id).not.toBe("u-follower");
    expect(typeof rep!.followersCount).toBe("number");
    expect(typeof rep!.articlesCount).toBe("number");
    expect(typeof rep!.handle).toBe("string");
  });

  it("getSuggestedAuthors excludes followed authors for authenticated user", async () => {
    const res = await service.getSuggestedAuthors("u-follower", 20, 0);
    const ids = res.data.map((a: any) => a.id);
    expect(ids).not.toContain("u-c1"); // followed
    expect(ids).toContain("u-c2");
    expect(ids).toContain("u-c3");
  });

  it("getSuggestedAuthors excludes self for authenticated user", async () => {
    const res = await service.getSuggestedAuthors("u-c2", 20, 0);
    const ids = res.data.map((a: any) => a.id);
    expect(ids).not.toContain("u-c2");
  });

  it("getReplacementAuthor returns null if only one author exists", async () => {
    const saved = prisma._users.slice();
    prisma._users = prisma._users.filter(u => u.id === "u-c1" || u.role !== "CREATOR");
    // Make sure inactive/deleted not counted
    prisma._users = prisma._users.filter(u => u.id === "u-c1");
    prisma._users[0].isActive = true; prisma._users[0].deletedAt = null;
    const rep = await service.getReplacementAuthor(undefined, "u-c1");
    prisma._users = saved;
    expect(rep).toBeNull();
  });

  // ==========================================================================
  // BUG #6: No raw console.error calls — uses Nest Logger
  // ==========================================================================
  it("BUG #6: errors use Nest Logger, not raw console.error", async () => {
    // Use fault-injection hook (setter works consistently across getter invocations)
    prisma._faults.set("article.findMany", new Error("boom"));
    await expect(service.getSuggestedArticles(undefined, 4, 0)).rejects.toThrow("boom");
    // The service should use Logger.error so our spy catches it
    expect(loggerErrorSpy).toHaveBeenCalled();
  });
});
