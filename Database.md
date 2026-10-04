# Database

Vellbase uses PostgreSQL through Prisma ORM. The schema is located at `packages/api/prisma/schema.prisma`.

## Entity groups

### Identity
- User
- UserSettings
- Session
- RefreshToken

### Publishing
- Article
- Highlight
- Story
- Category
- Tag
- Media

### Social
- Comment
- Like
- Bookmark
- Follow
- Notification

### Platform operations
- API keys
- Webhooks
- Reports
- Feature flags
- System settings
- AI agents
- Background jobs
- Other administration records

## Social data patterns

Likes are polymorphic across articles, highlights and comments. Follow records model follower/following relationships and prevent self-follow. Notifications keep target user, actor, kind and read state.

## Migration workflow

```bash
cd packages/api
npx prisma migrate dev --name migration_name
npm run db:generate
npm run migrate:prod
npm run db:studio
```

## Safe schema changes

1. Update Prisma schema.
2. Create a named migration.
3. Regenerate Prisma Client.
4. Run API tests.
5. Run E2E tests.
6. Verify production compatibility.

Do not manually modify production schema when a migration can express the change safely.
