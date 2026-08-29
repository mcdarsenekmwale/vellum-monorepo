import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { RoleRequestsModule } from './modules/role-requests/role-requests.module';
import { AccessRequestsModule } from './modules/access-requests/access-requests.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { SupportModule } from './modules/support/support.module';
import { HealthModule } from './modules/health/health.module';
import { SuggestedModule } from './modules/suggested/suggested.module';
import { SettingsModule } from './modules/settings/settings.module';
import { HelpCenterModule } from './modules/help-center/help-center.module';
import { ActivityModule } from './modules/activity/activity.module';
import { PrismaModule } from './shared/prisma/prisma.module';
import { CacheModule } from './shared/cache/cache.module';
import { AuthLoggerMiddleware } from './shared/middleware/auth-logger.middleware';

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
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ActivityModule,
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
    RoleRequestsModule,
    AccessRequestsModule,
    RbacModule,
    SupportModule,
    HealthModule,
    SuggestedModule,
    SettingsModule,
    HelpCenterModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthLoggerMiddleware).forRoutes('*');
  }
}
