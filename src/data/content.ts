export type Author = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  publication?: string;
  bio?: string;
};

export type Article = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  body: string[];
  cover: string;
  readMinutes: number;
  publishedAgo: string;
  author: Author;
  likes: number;
  featured?: boolean;
};

export type Reel = {
  id: string;
  cover: string;
  title: string;
  handle: string;
  likes: number;
};

export type Comment = {
  id: string;
  articleSlug: string;
  author: Author;
  body: string;
  ago: string;
  parentId?: string;
};

const img = (seed: string, w = 900, h = 1100) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const authors: Author[] = [
  { id: "lydia", name: "Lydia Nakamura", handle: "@lydia", avatar: img("lydia-a", 200, 200), publication: "Vellum Studio", bio: "Writing about material culture and the objects we keep." },
  { id: "julian", name: "Julian Vence", handle: "@jvence", avatar: img("julian-a", 200, 200), publication: "The Courier", bio: "Reporter covering cities, climate, and what comes next." },
  { id: "archdaily", name: "ArchDaily", handle: "@archdaily", avatar: img("archdaily-a", 200, 200), publication: "ArchDaily" },
  { id: "traveler", name: "Traveler", handle: "@traveler", avatar: img("traveler-a", 200, 200), publication: "Traveler Mag" },
  { id: "studio", name: "Studio", handle: "@studio", avatar: img("studio-a", 200, 200), publication: "Studio Weekly" },
  { id: "elena", name: "Elena Vance", handle: "@elena", avatar: img("elena-a", 200, 200), publication: "Field Notes" },
  { id: "marcus", name: "Marcus Thorne", handle: "@mthorne", avatar: img("marcus-a", 200, 200) },
];

export const articles: Article[] = [
  {
    slug: "quiet-return-of-physical-objects",
    category: "Culture",
    title: "The Quiet Return of Physical Objects",
    excerpt: "After a decade of screens, a generation is falling back in love with things you can hold.",
    body: [
      "For years, the culture optimized itself for the glass rectangle. Every song, every book, every photograph collapsed into the same pane. Convenience was the argument, and it was a good one.",
      "But somewhere between the algorithmic playlist and the endless feed, people started missing the friction. The turntable. The film camera. The paperback with a broken spine.",
      "This is not a rejection of technology so much as a re-negotiation with it. The physical object is winning again because it does one thing the internet cannot: it insists on presence.",
      "Walk into any independent bookstore on a Saturday and you will see it. The line for the register is longer than it has been in twenty years.",
    ],
    cover: img("hero-objects", 1080, 1350),
    readMinutes: 8,
    publishedAgo: "2h ago",
    author: authors[1],
    likes: 2431,
    featured: true,
  },
  {
    slug: "serif-fonts-digital-design",
    category: "Design",
    title: "Why Serif Fonts are Dominating Digital Design",
    excerpt: "The screen has finally caught up with the printed page.",
    body: [
      "A decade ago, serifs on the web looked like a mistake. Displays were too coarse, screens too small, browsers too inconsistent.",
      "That world is gone. Retina panels, variable fonts, and a hunger for warmth have brought serif type back to the interface, and it is now the fastest way to signal seriousness on a screen.",
    ],
    cover: img("serif-fonts", 800, 800),
    readMinutes: 5,
    publishedAgo: "4h ago",
    author: authors[5],
    likes: 512,
  },
  {
    slug: "solar-windows-future",
    category: "Environment",
    title: "Solar Windows: The Transparent Future",
    excerpt: "A new class of glass turns entire skylines into quiet power plants.",
    body: [
      "The most interesting solar panels of the next decade will not sit on rooftops. They will be the windows themselves.",
      "Transparent photovoltaic layers, invisible to the eye, are already being retrofitted onto commercial towers in three cities.",
    ],
    cover: img("solar-windows", 800, 800),
    readMinutes: 12,
    publishedAgo: "6h ago",
    author: authors[1],
    likes: 1204,
  },
  {
    slug: "vinyl-renaissance",
    category: "Music",
    title: "Revisiting the Vinyl Renaissance",
    excerpt: "It is no longer a novelty. It is a format.",
    body: [
      "Vinyl outsold CDs for the third year running. That is not a stunt anymore; that is a market.",
    ],
    cover: img("vinyl", 800, 800),
    readMinutes: 4,
    publishedAgo: "1d ago",
    author: authors[6],
    likes: 342,
  },
  {
    slug: "brutalism-comfort",
    category: "Architecture",
    title: "The Silence of Concrete",
    excerpt: "Why a new generation is finding peace in brutalist rooms.",
    body: [
      "The buildings your parents hated are becoming the buildings you cannot stop photographing.",
    ],
    cover: img("brutalism", 800, 800),
    readMinutes: 7,
    publishedAgo: "1d ago",
    author: authors[5],
    likes: 998,
  },
];

export const stories: Author[] = [authors[0], authors[2], authors[3], authors[4], authors[5], authors[6]];

export const reels: Reel[] = [
  { id: "r1", cover: img("reel-london", 720, 1280), title: "London Fog", handle: "@rainyday", likes: 12400 },
  { id: "r2", cover: img("reel-tokyo", 720, 1280), title: "Tokyo Glow", handle: "@night_walk", likes: 8300 },
  { id: "r3", cover: img("reel-coffee", 720, 1280), title: "The Art of Slow Brewing", handle: "@baristanotes", likes: 5600 },
  { id: "r4", cover: img("reel-mountain", 720, 1280), title: "High Altitude Peace", handle: "@peaks", likes: 15400 },
  { id: "r5", cover: img("reel-market", 720, 1280), title: "Marrakech at Dawn", handle: "@traveler", likes: 9200 },
];

export const seedComments: Comment[] = [
  {
    id: "c1",
    articleSlug: "quiet-return-of-physical-objects",
    author: authors[0],
    body: "This is exactly the piece I have been waiting for. The line about 'insisting on presence' will stay with me.",
    ago: "1h",
  },
  {
    id: "c1r1",
    articleSlug: "quiet-return-of-physical-objects",
    author: authors[1],
    body: "Thank you Lydia — this was the sentence that took the longest to write.",
    ago: "42m",
    parentId: "c1",
  },
  {
    id: "c2",
    articleSlug: "quiet-return-of-physical-objects",
    author: authors[6],
    body: "The bookstore observation matches what I am seeing in Portland. Something real is happening.",
    ago: "22m",
  },
];

export const currentUser: Author = {
  id: "me",
  name: "You",
  handle: "@you",
  avatar: img("you-avatar", 200, 200),
  bio: "Reader. Occasional writer.",
};
