import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpdateNotificationPreferencesDto } from './dto/settings.dto';

describe('SettingsService — updateNotificationPreferences validates all boolean keys', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const fakeUser = {
      id: 'any',
      email: 'test@example.com',
      handle: 'tester',
      name: 'Test User',
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
    const prismaStub = {
      user: { findUnique: jest.fn().mockResolvedValue(fakeUser) },
      userSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      notificationPreferences: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      userSubscription: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prismaStub as any },
      ],
    }).compile();
    service = module.get(SettingsService);
  });

  describe('putNotificationPreferences — validates all keys are boolean', () => {
    const fullValidDto: UpdateNotificationPreferencesDto = {
      push: {
        likes: true,
        comments: true,
        replies: false,
        follows: true,
        mentions: false,
        newArticles: true,
        system: true,
      },
      email: { digest: false, marketing: false },
      soundsEnabled: true,
    };

    it('accepts a fully valid payload and preserves every boolean key', async () => {
      const result = await service.putNotificationPreferences('u1', fullValidDto);
      expect(typeof result.push.likes).toBe('boolean');
      expect(typeof result.push.comments).toBe('boolean');
      expect(typeof result.push.replies).toBe('boolean');
      expect(typeof result.push.follows).toBe('boolean');
      expect(typeof result.push.mentions).toBe('boolean');
      expect(typeof result.push.newArticles).toBe('boolean');
      expect(typeof result.push.system).toBe('boolean');
      expect(typeof result.email.digest).toBe('boolean');
      expect(typeof result.email.marketing).toBe('boolean');
      expect(typeof result.soundsEnabled).toBe('boolean');

      expect(result.push.likes).toBe(true);
      expect(result.push.replies).toBe(false);
      expect(result.push.mentions).toBe(false);
      expect(result.email.digest).toBe(false);
      expect(result.soundsEnabled).toBe(true);
    });

    it('coerces truthy/falsy non-boolean values to strict booleans (defaults missing to false)', async () => {
      const weirdDto: any = {
        push: {
          likes: 1,
          comments: 0,
          replies: 'yes',
          follows: null,
          mentions: undefined,
          newArticles: NaN,
          system: {},
        },
        email: { digest: '', marketing: [] },
        soundsEnabled: undefined,
      };
      const result = await service.putNotificationPreferences('u1', weirdDto);
      expect(result.push).toEqual({
        likes: true,
        comments: false,
        replies: true,
        follows: false,
        mentions: false,
        newArticles: false,
        system: true,
      });
      expect(result.email).toEqual({ digest: false, marketing: true });
      expect(result.soundsEnabled).toBe(false);
    });

    it('round-trips every key individually — flips each to false and back', async () => {
      const allTrue: UpdateNotificationPreferencesDto = {
        push: {
          likes: true, comments: true, replies: true, follows: true,
          mentions: true, newArticles: true, system: true,
        },
        email: { digest: true, marketing: true },
        soundsEnabled: true,
      };
      const allFalse: UpdateNotificationPreferencesDto = {
        push: {
          likes: false, comments: false, replies: false, follows: false,
          mentions: false, newArticles: false, system: false,
        },
        email: { digest: false, marketing: false },
        soundsEnabled: false,
      };
      const r1 = await service.putNotificationPreferences('u2', allTrue);
      expect(r1.push.likes && r1.push.system && r1.email.digest).toBe(true);
      expect(r1.soundsEnabled).toBe(true);

      const r2 = await service.putNotificationPreferences('u2', allFalse);
      const anyTrue =
        Object.values(r2.push).some(Boolean) ||
        Object.values(r2.email).some(Boolean) ||
        r2.soundsEnabled;
      expect(anyTrue).toBe(false);
    });

    it('returns full 7 push + 2 email + sounds keys — never drops notification categories', async () => {
      const result = await service.putNotificationPreferences('u3', fullValidDto);
      const pushKeys = Object.keys(result.push).sort();
      expect(pushKeys).toEqual([
        'comments', 'follows', 'likes', 'mentions',
        'newArticles', 'replies', 'system',
      ]);
      const emailKeys = Object.keys(result.email).sort();
      expect(emailKeys).toEqual(['digest', 'marketing']);
      expect('soundsEnabled' in result).toBe(true);
    });

    it('isolation between users — state not shared across userIds', async () => {
      const alice: UpdateNotificationPreferencesDto = {
        push: {
          likes: true, comments: false, replies: true, follows: false,
          mentions: true, newArticles: false, system: true,
        },
        email: { digest: true, marketing: false },
        soundsEnabled: true,
      };
      const bob: UpdateNotificationPreferencesDto = {
        push: {
          likes: false, comments: true, replies: false, follows: true,
          mentions: false, newArticles: true, system: false,
        },
        email: { digest: false, marketing: true },
        soundsEnabled: false,
      };
      await service.putNotificationPreferences('alice', alice);
      await service.putNotificationPreferences('bob', bob);
      const a = await service.getNotificationPreferences('alice');
      const b = await service.getNotificationPreferences('bob');
      expect(a.push.likes).not.toBe(b.push.likes);
      expect(a.push.comments).not.toBe(b.push.comments);
      expect(a.email.marketing).not.toBe(b.email.marketing);
      expect(a.soundsEnabled).not.toBe(b.soundsEnabled);
    });
  });
});
