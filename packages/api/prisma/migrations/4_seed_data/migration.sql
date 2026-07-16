-- Seed data for development

-- First, disable RLS temporarily for seeding
ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Article" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Highlight" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSettings" DISABLE ROW LEVEL SECURITY;

-- Insert Categories
INSERT INTO "Category" ("id", "name", "slug", "tint") VALUES
('cat-001', 'Technology', 'technology', '#3b82f6'),
('cat-002', 'Business', 'business', '#8b5cf6'),
('cat-003', 'Science', 'science', '#06b6d4'),
('cat-004', 'Health', 'health', '#10b981'),
('cat-005', 'Entertainment', 'entertainment', '#f59e0b'),
('cat-006', 'Sports', 'sports', '#ef4444'),
('cat-007', 'Politics', 'politics', '#6366f1'),
('cat-008', 'Lifestyle', 'lifestyle', '#ec4899')
ON CONFLICT DO NOTHING;

-- Insert Users (password: password123)
INSERT INTO "User" ("id", "email", "emailVerified", "passwordHash", "handle", "name", "avatar", "bio", "publication", "role", "isActive", "createdAt", "updatedAt") VALUES
('user-001', 'admin@vellum.app', NOW(), '$2b$10$uHk6v3BiAhjwsNnGsykxROg.oYbcAXnxl4Fdw4Bkx1/T9Z3cDSCJW', 'admin', 'Admin User', NULL, 'System administrator', 'Vellum', 'ADMIN', true, NOW(), NOW()),
('user-002', 'moderator@vellum.app', NOW(), '$2b$10$uHk6v3BiAhjwsNnGsykxROg.oYbcAXnxl4Fdw4Bkx1/T9Z3cDSCJW', 'moderator', 'Moderator User', NULL, 'Content moderator', 'Vellum', 'MODERATOR', true, NOW(), NOW()),
('user-003', 'creator@vellum.app', NOW(), '$2b$10$uHk6v3BiAhjwsNnGsykxROg.oYbcAXnxl4Fdw4Bkx1/T9Z3cDSCJW', 'creator', 'Content Creator', NULL, 'Professional content creator', 'Vellum', 'CREATOR', true, NOW(), NOW()),
('user-004', 'user1@vellum.app', NOW(), '$2b$10$uHk6v3BiAhjwsNnGsykxROg.oYbcAXnxl4Fdw4Bkx1/T9Z3cDSCJW', 'user1', 'Regular User', NULL, 'Casual reader', 'Vellum', 'USER', true, NOW(), NOW()),
('user-005', 'user2@vellum.app', NOW(), '$2b$10$uHk6v3BiAhjwsNnGsykxROg.oYbcAXnxl4Fdw4Bkx1/T9Z3cDSCJW', 'user2', 'Jane Doe', NULL, 'Tech enthusiast', 'Vellum', 'USER', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Insert User Settings
INSERT INTO "UserSettings" ("id", "userId", "emailNotifications", "pushNotifications", "emailMarketing", "allowComments", "allowLikes", "showOnlineStatus", "createdAt", "updatedAt") VALUES
('settings-001', 'user-001', true, true, false, true, true, true, NOW(), NOW()),
('settings-002', 'user-002', true, true, false, true, true, true, NOW(), NOW()),
('settings-003', 'user-003', true, true, true, true, true, true, NOW(), NOW()),
('settings-004', 'user-004', true, false, false, true, true, true, NOW(), NOW()),
('settings-005', 'user-005', true, true, false, true, true, false, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Insert Articles
INSERT INTO "Article" ("id", "slug", "title", "excerpt", "body", "cover", "readMinutes", "categoryId", "authorId", "likesCount", "views", "featured", "isPublished", "publishedAt", "commentsCount", "createdAt", "updatedAt") VALUES
('article-001', 'the-future-of-artificial-intelligence', 'The Future of Artificial Intelligence', 'Exploring the latest advancements in AI technology and its impact on various industries.', ARRAY['Artificial intelligence has become one of the most transformative technologies of our time. From machine learning algorithms to deep neural networks, AI is revolutionizing how we live and work.', 'In recent years, we have seen significant breakthroughs in natural language processing, computer vision, and autonomous systems. These advancements are enabling new applications across healthcare, finance, transportation, and many other sectors.', 'As AI continues to evolve, it raises important questions about ethics, privacy, and the future of work. Organizations must carefully consider how to implement AI responsibly while maximizing its benefits.'], 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=futuristic%20AI%20technology%20abstract%20blue%20gradient&image_size=landscape_16_9', 8, '529fe7af-7c06-41f2-b3eb-d1a9c51c32ea', 'user-003', 128, 2543, true, true, NOW() - INTERVAL '7 days', 45, NOW() - INTERVAL '7 days', NOW()),
('article-002', 'web-development-trends-2024', 'Web Development Trends in 2024', 'A comprehensive guide to the latest trends and technologies shaping web development.', ARRAY['The web development landscape is constantly evolving, with new frameworks, tools, and best practices emerging every year. In 2024, several key trends are dominating the industry.', 'Server-side rendering, edge computing, and real-time applications are becoming increasingly important. Developers are also focusing on performance optimization, accessibility, and security.', 'With the rise of AI-powered development tools, the way we build web applications is changing rapidly. These tools are helping developers be more productive while maintaining high-quality standards.'], 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20web%20development%20code%20editor%20colorful&image_size=landscape_16_9', 6, '529fe7af-7c06-41f2-b3eb-d1a9c51c32ea', 'user-003', 89, 1892, false, true, NOW() - INTERVAL '5 days', 23, NOW() - INTERVAL '5 days', NOW()),
('article-003', 'sustainable-business-practices', 'Sustainable Business Practices', 'How companies are adopting eco-friendly strategies and reducing their carbon footprint.', ARRAY['Sustainability has become a critical focus for businesses worldwide. Consumers are increasingly demanding that companies take action to protect the environment.', 'From renewable energy sources to circular economy models, businesses are finding innovative ways to reduce their environmental impact.', 'Implementing sustainable practices not only benefits the planet but also improves brand reputation and can lead to significant cost savings over time.'], 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=sustainable%20green%20business%20eco%20friendly%20nature&image_size=landscape_16_9', 5, '9095dfb1-f4d3-43e3-aa64-640d1a33962f', 'user-003', 67, 1234, false, true, NOW() - INTERVAL '3 days', 18, NOW() - INTERVAL '3 days', NOW()),
('article-004', 'health-benefits-of-digital-wellness', 'Health Benefits of Digital Wellness', 'Exploring how technology can help improve mental health and well-being.', ARRAY['Digital wellness has emerged as an important topic in today''s technology-driven world. While excessive screen time can be harmful, technology can also be a force for good.', 'From meditation apps to fitness trackers, digital tools are helping people take control of their mental and physical health.', 'The key is finding a balance - using technology mindfully to enhance well-being rather than letting it control our lives.'], 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=digital%20wellness%20health%20mindfulness%20peaceful&image_size=landscape_16_9', 4, '3ce45fdb-248b-4499-b8fe-7ac7a17cfa40', 'user-005', 54, 987, false, true, NOW() - INTERVAL '2 days', 12, NOW() - INTERVAL '2 days', NOW()),
('article-005', 'quantum-computing-breakthroughs', 'Quantum Computing Breakthroughs', 'Recent advancements in quantum computing and what they mean for the future.', ARRAY['Quantum computing represents a paradigm shift in computational capabilities. Unlike classical computers that use bits, quantum computers use qubits that can exist in multiple states simultaneously.', 'Recent breakthroughs have brought quantum computing closer to practical applications. Researchers are exploring uses in cryptography, drug discovery, climate modeling, and more.', 'While we are still in the early stages of quantum computing development, the potential applications are truly revolutionary.'], 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=quantum%20computing%20abstract%20particles%20blue%20glow&image_size=landscape_16_9', 7, 'ab88f58a-8eb6-470f-b311-0da98a758aaa', 'user-003', 145, 3201, true, true, NOW() - INTERVAL '10 days', 56, NOW() - INTERVAL '10 days', NOW()),
('article-006', 'the-rise-of-remote-work', 'The Rise of Remote Work', 'How remote work is transforming the workplace and employee expectations.', ARRAY['The COVID-19 pandemic accelerated a shift towards remote work that was already underway. Today, many companies are embracing hybrid work models.', 'Remote work offers benefits for both employees and employers - increased flexibility, reduced overhead costs, and access to a wider talent pool.', 'However, it also presents challenges around communication, collaboration, and maintaining company culture. Organizations must adapt to thrive in this new work environment.'], 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=remote%20work%20home%20office%20laptop%20comfortable&image_size=landscape_16_9', 5, '9095dfb1-f4d3-43e3-aa64-640d1a33962f', 'user-005', 78, 1567, false, true, NOW() - INTERVAL '4 days', 28, NOW() - INTERVAL '4 days', NOW())
ON CONFLICT DO NOTHING;

-- Insert Highlights
INSERT INTO "Highlight" ("id", "title", "cover", "videoUrl", "thumbnailUrl", "handle", "authorId", "likesCount", "commentsCount", "shares", "description", "aspectRatio", "duration", "isPublished", "publishedAt", "createdAt", "updatedAt") VALUES
('highlight-001', 'AI Demo', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=AI%20demo%20technology%20presentation&image_size=portrait_16_9', NULL, 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=AI%20demo%20thumbnail&image_size=square', 'highlight-ai-demo', 'user-003', 234, 45, 89, 'Check out this amazing AI demonstration showing the capabilities of modern machine learning.', 1.777, 60, true, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW()),
('highlight-002', 'Web Dev Tips', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=web%20development%20tips%20code%20screen&image_size=portrait_16_9', NULL, 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=web%20dev%20tips%20thumbnail&image_size=square', 'web-dev-tips', 'user-003', 156, 32, 45, 'Quick tips for improving your web development workflow.', 1.777, 45, true, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW()),
('highlight-003', 'Productivity Hacks', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=productivity%20workspace%20organized&image_size=portrait_16_9', NULL, 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=productivity%20hacks%20thumbnail&image_size=square', 'productivity-hacks', 'user-005', 89, 18, 23, 'Boost your productivity with these simple hacks.', 1.777, 30, true, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW())
ON CONFLICT DO NOTHING;

-- Insert Comments on Articles
INSERT INTO "Comment" ("id", "articleSlug", "authorId", "body", "parentId", "likesCount", "createdAt", "updatedAt") VALUES
('comment-001', 'the-future-of-artificial-intelligence', 'user-004', 'Great article! I found the section on AI ethics particularly interesting.', NULL, 12, NOW() - INTERVAL '6 days', NOW()),
('comment-002', 'the-future-of-artificial-intelligence', 'user-005', 'Thanks for sharing this comprehensive overview. Looking forward to more content on this topic.', NULL, 8, NOW() - INTERVAL '5 days', NOW()),
('comment-003', 'the-future-of-artificial-intelligence', 'user-002', 'I completely agree with your points about responsible AI implementation.', 'comment-001', 5, NOW() - INTERVAL '4 days', NOW()),
('comment-004', 'web-development-trends-2024', 'user-004', 'Server-side rendering is definitely a game-changer for performance.', NULL, 6, NOW() - INTERVAL '4 days', NOW()),
('comment-005', 'quantum-computing-breakthroughs', 'user-005', 'Quantum computing is fascinating! Can''t wait to see what comes next.', NULL, 9, NOW() - INTERVAL '8 days', NOW())
ON CONFLICT DO NOTHING;

-- Insert Comments on Highlights
INSERT INTO "Comment" ("id", "highlightId", "authorId", "body", "parentId", "likesCount", "createdAt", "updatedAt") VALUES
('comment-006', 'highlight-001', 'user-004', 'This demo is incredible! AI has come so far.', NULL, 15, NOW() - INTERVAL '4 days', NOW()),
('comment-007', 'highlight-001', 'user-005', 'Thanks for sharing this with the community.', NULL, 7, NOW() - INTERVAL '3 days', NOW()),
('comment-008', 'highlight-002', 'user-004', 'These tips are very helpful. Saved me a lot of time!', NULL, 11, NOW() - INTERVAL '2 days', NOW())
ON CONFLICT DO NOTHING;

-- Insert Notifications
INSERT INTO "Notification" ("id", "userId", "actorId", "kind", "articleSlug", "highlightId", "commentId", "body", "read", "createdAt") VALUES
('notif-001', 'user-003', 'user-004', 'LIKE', 'the-future-of-artificial-intelligence', NULL, NULL, 'user1 liked your article "The Future of Artificial Intelligence"', false, NOW() - INTERVAL '6 days'),
('notif-002', 'user-003', 'user-005', 'COMMENT', 'the-future-of-artificial-intelligence', NULL, 'comment-002', 'Jane Doe commented on your article', false, NOW() - INTERVAL '5 days'),
('notif-003', 'user-004', 'user-003', 'MENTION', NULL, NULL, 'comment-003', 'Content Creator mentioned you in a comment', true, NOW() - INTERVAL '4 days'),
('notif-004', 'user-005', 'user-003', 'LIKE', 'the-rise-of-remote-work', NULL, NULL, 'Content Creator liked your article', false, NOW() - INTERVAL '3 days'),
('notif-005', 'user-003', 'user-004', 'COMMENT', NULL, 'highlight-001', 'comment-006', 'user1 commented on your highlight', false, NOW() - INTERVAL '4 days')
ON CONFLICT DO NOTHING;

-- Insert Likes
INSERT INTO "Like" ("id", "userId", "articleSlug", "highlightId", "commentId", "createdAt") VALUES
('like-001', 'user-004', 'the-future-of-artificial-intelligence', NULL, NULL, NOW() - INTERVAL '6 days'),
('like-002', 'user-005', 'the-future-of-artificial-intelligence', NULL, NULL, NOW() - INTERVAL '5 days'),
('like-003', 'user-003', 'the-rise-of-remote-work', NULL, NULL, NOW() - INTERVAL '3 days'),
('like-004', 'user-004', NULL, 'highlight-001', NULL, NOW() - INTERVAL '4 days'),
('like-005', 'user-003', NULL, NULL, 'comment-001', NOW() - INTERVAL '5 days')
ON CONFLICT DO NOTHING;

-- Insert Bookmarks
INSERT INTO "Bookmark" ("id", "userId", "articleSlug", "highlightId", "createdAt") VALUES
('bookmark-001', 'user-004', 'the-future-of-artificial-intelligence', NULL, NOW() - INTERVAL '5 days'),
('bookmark-002', 'user-004', 'quantum-computing-breakthroughs', NULL, NOW() - INTERVAL '7 days'),
('bookmark-003', 'user-005', 'the-future-of-artificial-intelligence', NULL, NOW() - INTERVAL '4 days'),
('bookmark-004', 'user-005', NULL, 'highlight-001', NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;

-- Insert Follows
INSERT INTO "Follow" ("id", "followerId", "followingId", "createdAt") VALUES
('follow-001', 'user-004', 'user-003', NOW() - INTERVAL '10 days'),
('follow-002', 'user-005', 'user-003', NOW() - INTERVAL '8 days'),
('follow-003', 'user-004', 'user-005', NOW() - INTERVAL '6 days'),
('follow-004', 'user-002', 'user-003', NOW() - INTERVAL '12 days')
ON CONFLICT DO NOTHING;

-- Re-enable RLS
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Article" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Highlight" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSettings" ENABLE ROW LEVEL SECURITY;