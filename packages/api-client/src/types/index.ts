// User Types
export interface User {
  id: string;
  email: string;
  emailVerified?: string;
  handle: string;
  name: string;
  avatar?: string;
  bio?: string;
  publication?: string;
  role: 'ADMIN' | 'MODERATOR' | 'CREATOR' | 'USER' | 'GUEST';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface UserSettings {
  id: string;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  emailMarketing: boolean;
  allowComments: boolean;
  allowLikes: boolean;
  showOnlineStatus: boolean;
  createdAt: string;
  updatedAt: string;
}

// Article Types
export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string[];
  cover?: string;
  readMinutes: number;
  categoryId: string;
  authorId: string;
  likesCount: number;
  views: number;
  featured: boolean;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  author: ArticleAuthor;
  category: Category;
  isLiked: boolean;
  isBookmarked: boolean;
  comments?: Comment[];
  commentCount?: number;
}

export interface ArticleAuthor {
  id: string;
  handle: string;
  name: string;
  avatar?: string;
  bio?: string;
}

// Category Types
export interface Category {
  id: string;
  name: string;
  tint: string;
  slug: string;
}

// Highlight Types
export interface Highlight {
  id: string;
  title: string;
  cover?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  handle: string;
  authorId?: string;
  author?: ArticleAuthor;
  likesCount: number;
  commentsCount: number;
  shares: number;
  description?: string;
  music?: string;
  aspectRatio: number;
  duration?: number;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// Comment Types
export interface Comment {
  id: string;
  articleSlug?: string;
  highlightId?: string;
  authorId: string;
  author: ArticleAuthor;
  body: string;
  parentId?: string;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  replies?: Comment[];
}

// Story Types
export interface Story {
  id: string;
  authorId: string;
  author: ArticleAuthor;
  image: string;
  caption?: string;
  duration: number;
  createdAt: string;
  expiresAt: string;
  views?: number;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  actorId?: string;
  actor?: ArticleAuthor;
  kind: 'LIKE' | 'COMMENT' | 'REPLY' | 'FOLLOW' | 'BOOKMARK' | 'MENTION' | 'SYSTEM';
  articleSlug?: string;
  highlightId?: string;
  commentId?: string;
  body?: string;
  read: boolean;
  createdAt: string;
}

// Media Types
export interface Media {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  metadata?: Record<string, unknown>;
  uploadedBy: string;
  createdAt: string;
  deletedAt?: string;
}

// Follow Types
export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

// Pagination Types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  handle: string;
  name: string;
  bio?: string;
  publication?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// API Error Types
export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

// Toggle Response Types
export interface ToggleResponse {
  liked?: boolean;
  bookmarked?: boolean;
  following?: boolean;
}

// Search Types
export interface SearchResults {
  users: ArticleAuthor[];
  articles: Article[];
  highlights: Highlight[];
  categories: Category[];
  total: number;
}

// Dashboard Stats (Admin)
export interface DashboardStats {
  users: number;
  articles: number;
  highlights: number;
  comments: number;
  likes: number;
  notifications: number;
}

// Audit Log
export interface AuditLog {
  id: string;
  userId?: string;
  user?: User;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// API Key
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  userId?: string;
  scopes: string[];
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  lastUsedAt?: string;
}