import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { HighlightsModule } from './modules/highlights/highlights.module';
import { CommentsModule } from './modules/comments/comments.module';
import { StoriesModule } from './modules/stories/stories.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { LikesModule } from './modules/likes/likes.module';
import { BookmarksModule } from './modules/bookmarks/bookmarks.module';
import { FollowsModule } from './modules/follows/follows.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MediaModule } from './modules/media/media.module';
import { SearchModule } from './modules/search/search.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './shared/prisma/prisma.module';
import { CacheModule } from './shared/cache/cache.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100,
      },
    ]),
    PrismaModule,
    CacheModule,
    AuthModule,
    UsersModule,
    ArticlesModule,
    HighlightsModule,
    CommentsModule,
    StoriesModule,
    CategoriesModule,
    LikesModule,
    BookmarksModule,
    FollowsModule,
    NotificationsModule,
    MediaModule,
    SearchModule,
    WebhooksModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}