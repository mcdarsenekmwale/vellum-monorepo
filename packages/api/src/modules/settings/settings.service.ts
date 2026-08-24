import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  UpdatePrivacyDto,
  UpdateNotificationPreferencesDto,
  ProfileVisibility,
  SubscriptionShape,
  NotificationPrefsShape,
} from './dto/settings.dto';
import {
  store,
  PrivacyFields,
} from '../shared/store';

const PRIVACY_DEFAULTS: PrivacyFields = {
  profileVisibility: 'public',
  allowComments: true,
  showLikesCount: true,
  showOnlineStatus: true,
};

const VALID_VISIBILITY: ProfileVisibility[] = [
  'public',
  'followers',
  'private',
];

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private prisma: PrismaService) {}

  private async getUserOrFail(userId: string) {
    try {
      const user = await (this.prisma as any).user?.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          handle: true,
          name: true,
          avatar: true,
          bio: true,
          website: true,
          location: true,
          publication: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!user) throw new NotFoundException('User not found');
      return user;
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      return {
        id: userId,
        email: `user-${userId.slice(0, 8)}@example.com`,
        handle: `user${userId.slice(0, 6)}`,
        name: `User ${userId.slice(0, 6)}`,
        avatar: null,
        bio: null,
        website: null,
        location: null,
        publication: null,
        role: 'USER',
        isActive: true,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  private async getPrivacyFromDb(userId: string): Promise<PrivacyFields | null> {
    try {
      const s = await (this.prisma as any).userSettings?.findUnique({
        where: { userId },
        select: {
          profileVisibility: true,
          allowComments: true,
          showLikesCount: true,
          showOnlineStatus: true,
        },
      });
      if (!s) return null;
      const visibility = VALID_VISIBILITY.includes(
        s.profileVisibility as ProfileVisibility,
      )
        ? (s.profileVisibility as ProfileVisibility)
        : 'public';
      return {
        profileVisibility: visibility,
        allowComments: !!s.allowComments,
        showLikesCount: !!s.showLikesCount,
        showOnlineStatus: !!s.showOnlineStatus,
      };
    } catch {
      return null;
    }
  }

  private async upsertPrivacyInDb(
    userId: string,
    fields: PrivacyFields,
  ): Promise<boolean> {
    try {
      const existing = await (this.prisma as any).userSettings?.findUnique({
        where: { userId },
      });
      if (existing) {
        await (this.prisma as any).userSettings.update({
          where: { userId },
          data: {
            profileVisibility: fields.profileVisibility,
            allowComments: fields.allowComments,
            showLikesCount: fields.showLikesCount,
            showOnlineStatus: fields.showOnlineStatus,
          },
        });
      } else {
        await (this.prisma as any).userSettings.create({
          data: {
            userId,
            profileVisibility: fields.profileVisibility,
            allowComments: fields.allowComments,
            showLikesCount: fields.showLikesCount,
            showOnlineStatus: fields.showOnlineStatus,
          },
        });
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  async getCurrentUser(userId: string) {
    const user = await this.getUserOrFail(userId);
    let privacy = await this.getPrivacyFromDb(userId);
    if (!privacy) {
      privacy = store.getPrivacy(userId);
    } else {
      store.updatePrivacy(userId, privacy);
    }
    const notifPrefs = this.getNotificationPrefsShapeFromStore(userId);

    return {
      ...user,
      privacy,
      notificationPrefs: notifPrefs,
    };
  }

  async patchPrivacy(userId: string, dto: UpdatePrivacyDto) {
    const user = await this.getUserOrFail(userId);
    const patch: Partial<PrivacyFields> = {};
    if (dto.profileVisibility !== undefined) {
      if (!VALID_VISIBILITY.includes(dto.profileVisibility)) {
        throw new Error('Invalid profileVisibility');
      }
      patch.profileVisibility = dto.profileVisibility;
    }
    if (dto.allowComments !== undefined) patch.allowComments = dto.allowComments;
    if (dto.showLikesCount !== undefined) patch.showLikesCount = dto.showLikesCount;
    if (dto.showOnlineStatus !== undefined) patch.showOnlineStatus = dto.showOnlineStatus;

    const base = (await this.getPrivacyFromDb(userId)) ?? store.getPrivacy(userId);
    const merged = { ...base, ...patch };

    const saved = await this.upsertPrivacyInDb(userId, merged);
    if (!saved) {
      store.updatePrivacy(userId, merged);
    }
    const finalPrivacy = saved
      ? (await this.getPrivacyFromDb(userId)) ?? merged
      : store.getPrivacy(userId);

    return {
      ...user,
      privacy: finalPrivacy,
      notificationPrefs: this.getNotificationPrefsShapeFromStore(userId),
    };
  }

  private getNotificationPrefsShapeFromStore(
    userId: string,
  ): NotificationPrefsShape {
    const raw = store.getNotificationPrefs(userId);
    return raw;
  }

  private async tryLoadNotifPrefsFromDb(userId: string): Promise<NotificationPrefsShape | null> {
    try {
      const s = await (this.prisma as any).userSettings?.findUnique({
        where: { userId },
        include: { notificationPrefs: true },
      });
      if (!s?.notificationPrefs) return null;
      const np = s.notificationPrefs as any;
      return {
        push: {
          likes: !!np.pushLikes,
          comments: !!np.pushComments,
          replies: !!np.pushReplies,
          follows: !!np.pushFollows,
          mentions: !!np.pushMentions,
          newArticles: !!np.pushNewArticles,
          system: !!np.pushSystem,
        },
        email: {
          digest: !!np.emailDigest,
          marketing: !!np.emailMarketing,
        },
        soundsEnabled: !!np.soundsEnabled,
      };
    } catch {
      return null;
    }
  }

  private async trySaveNotifPrefsToDb(
    userId: string,
    next: NotificationPrefsShape,
  ): Promise<boolean> {
    try {
      const s = await (this.prisma as any).userSettings?.findUnique({
        where: { userId },
        include: { notificationPrefs: true },
      });
      const usId = s?.id;
      if (!usId) return false;
      const data = {
        pushLikes: next.push.likes,
        pushComments: next.push.comments,
        pushReplies: next.push.replies,
        pushFollows: next.push.follows,
        pushMentions: next.push.mentions,
        pushNewArticles: next.push.newArticles,
        pushSystem: next.push.system,
        emailDigest: next.email.digest,
        emailMarketing: next.email.marketing,
        soundsEnabled: next.soundsEnabled,
      };
      if (s.notificationPrefs) {
        await (this.prisma as any).notificationPreferences.update({
          where: { id: s.notificationPrefs.id },
          data,
        });
      } else {
        await (this.prisma as any).notificationPreferences.create({
          data: { userSettingsId: usId, ...data },
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPrefsShape> {
    await this.getUserOrFail(userId);
    const fromDb = await this.tryLoadNotifPrefsFromDb(userId);
    if (fromDb) {
      store.setNotificationPrefs(userId, fromDb);
      return fromDb;
    }
    return store.getNotificationPrefs(userId);
  }

  async putNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPrefsShape> {
    await this.getUserOrFail(userId);
    const shaped: NotificationPrefsShape = {
      push: {
        likes: !!dto.push.likes,
        comments: !!dto.push.comments,
        replies: !!dto.push.replies,
        follows: !!dto.push.follows,
        mentions: !!dto.push.mentions,
        newArticles: !!dto.push.newArticles,
        system: !!dto.push.system,
      },
      email: {
        digest: !!dto.email.digest,
        marketing: !!dto.email.marketing,
      },
      soundsEnabled: !!dto.soundsEnabled,
    };
    const saved = await this.trySaveNotifPrefsToDb(userId, shaped);
    if (!saved) {
      return store.setNotificationPrefs(userId, shaped);
    }
    const reloaded = (await this.tryLoadNotifPrefsFromDb(userId)) ?? shaped;
    store.setNotificationPrefs(userId, reloaded);
    return reloaded;
  }

  private async tryLoadSubscriptionFromDb(
    userId: string,
  ): Promise<SubscriptionShape | null> {
    try {
      const s = await (this.prisma as any).userSubscription?.findUnique({
        where: { userId },
      });
      if (!s) return null;
      const planName =
        s.planName === 'Pro' || s.planName === 'Teams' ? s.planName : 'Free';
      const status =
        s.status === 'trialing' ||
        s.status === 'past_due' ||
        s.status === 'canceled'
          ? s.status
          : 'active';
      return {
        planName,
        status,
        renewalDate: s.renewalDate ? new Date(s.renewalDate).toISOString() : undefined,
        cancelAtPeriodEnd: !!s.cancelAtPeriodEnd,
        features: {
          aiDrafts: Number(s.aiDrafts) || 0,
          customDomain: !!s.customDomain,
          analytics: !!s.analytics,
        },
      };
    } catch {
      return null;
    }
  }

  async getSubscription(userId: string): Promise<SubscriptionShape> {
    await this.getUserOrFail(userId);
    const fromDb = await this.tryLoadSubscriptionFromDb(userId);
    if (fromDb) {
      return fromDb;
    }
    return store.getSubscription(userId);
  }

  async restoreSubscription(userId: string): Promise<SubscriptionShape> {
    await this.getUserOrFail(userId);
    try {
      const s = await (this.prisma as any).userSubscription?.findUnique({
        where: { userId },
      });
      if (s) {
        await (this.prisma as any).userSubscription.update({
          where: { userId },
          data: { status: 'active', cancelAtPeriodEnd: false },
        });
      }
    } catch {}
    const fromDb = await this.tryLoadSubscriptionFromDb(userId);
    if (fromDb) return fromDb;
    return store.restoreSubscription(userId);
  }
}
