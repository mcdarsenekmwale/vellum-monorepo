import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { SETTINGS_DEFINITIONS, SETTINGS_VERSION } from './settings-definitions';

/**
 * Integration tests for AdminService settings methods.
 *
 * These tests exercise the real AdminService logic (caching, validation
 * delegation, upsert flow, idempotent seeding) against a mocked PrismaService
 * so we can assert the exact Prisma calls and cache behaviour without a
 * running database.
 */

describe('AdminService — settings', () => {
  let service: AdminService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = {
      systemSetting: {
        count: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: any) => {
              if (key === 'API_KEY_SECRET' || key === 'JWT_SECRET') return 'test-secret';
              return fallback;
            }),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            invalidatePattern: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AdminService);
  });

  /* ─── seedSettings ─── */

  describe('seedSettings', () => {
    it('seeds all definitions when no settings exist', async () => {
      (prisma.systemSetting.count as jest.Mock).mockResolvedValue(0);
      (prisma.systemSetting.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'id-' + data.key, ...data }),
      );

      const result = await service.seedSettings();

      expect(result.seeded).toBe(SETTINGS_DEFINITIONS.length);
      expect(result.message).toContain('Seeded');
      expect(prisma.systemSetting.create).toHaveBeenCalledTimes(SETTINGS_DEFINITIONS.length);
    });

    it('is a no-op when settings already exist', async () => {
      (prisma.systemSetting.count as jest.Mock).mockResolvedValue(42);

      const result = await service.seedSettings();

      expect(result.seeded).toBe(0);
      expect(result.message).toContain('already exist');
      expect(prisma.systemSetting.create).not.toHaveBeenCalled();
    });

    it('passes the current SETTINGS_VERSION to each created setting', async () => {
      (prisma.systemSetting.count as jest.Mock).mockResolvedValue(0);
      (prisma.systemSetting.create as jest.Mock).mockResolvedValue({});

      await service.seedSettings();

      const calls = (prisma.systemSetting.create as jest.Mock).mock.calls;
      for (const [{ data }] of calls) {
        expect(data.version).toBe(SETTINGS_VERSION);
      }
    });
  });

  /* ─── listSystemSettings (caching) ─── */

  describe('listSystemSettings', () => {
    it('groups settings by category', async () => {
      (prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([
        { key: 'a', value: '1', category: 'general', description: '', version: 1 },
        { key: 'b', value: '2', category: 'security', description: '', version: 1 },
        { key: 'c', value: '3', category: 'general', description: '', version: 1 },
      ]);

      const result = await service.listSystemSettings();

      expect(result.general).toHaveLength(2);
      expect(result.security).toHaveLength(1);
      expect(prisma.systemSetting.findMany).toHaveBeenCalledTimes(1);
    });

    it('caches results within the TTL window', async () => {
      (prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([]);

      await service.listSystemSettings();
      await service.listSystemSettings();

      expect(prisma.systemSetting.findMany).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after the cache is invalidated by an update', async () => {
      (prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.systemSetting.upsert as jest.Mock).mockResolvedValue({});

      await service.listSystemSettings();
      await service.updateSystemSetting('workspace.name', 'New Name');
      await service.listSystemSettings();

      expect(prisma.systemSetting.findMany).toHaveBeenCalledTimes(2);
    });
  });

  /* ─── updateSystemSetting ─── */

  describe('updateSystemSetting', () => {
    it('upserts a valid value', async () => {
      (prisma.systemSetting.upsert as jest.Mock).mockResolvedValue({
        key: 'workspace.name',
        value: 'Updated',
        category: 'general',
      });

      const result = await service.updateSystemSetting('workspace.name', 'Updated');

      expect(result.value).toBe('Updated');
      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'workspace.name' },
          update: expect.objectContaining({ value: 'Updated' }),
        }),
      );
    });

    it('passes the category when provided', async () => {
      (prisma.systemSetting.upsert as jest.Mock).mockResolvedValue({});

      await service.updateSystemSetting('workspace.name', 'Vellbase', 'general');

      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ value: 'Vellbase', category: 'general' }),
        }),
      );
    });

    it('rejects an invalid value via the validation layer', async () => {
      await expect(
        service.updateSystemSetting('auth.session_timeout', 'not-a-number'),
      ).rejects.toThrow('Invalid value');

      expect(prisma.systemSetting.upsert).not.toHaveBeenCalled();
    });

    it('rejects an unknown key', async () => {
      await expect(
        service.updateSystemSetting('totally.unknown.key', 'whatever'),
      ).rejects.toThrow('Invalid value');

      expect(prisma.systemSetting.upsert).not.toHaveBeenCalled();
    });

    it('invalidates the settings cache after a successful update', async () => {
      (prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.systemSetting.upsert as jest.Mock).mockResolvedValue({});

      await service.listSystemSettings(); // populate cache
      await service.updateSystemSetting('workspace.name', 'New');

      // A subsequent list should hit the database again
      await service.listSystemSettings();
      expect(prisma.systemSetting.findMany).toHaveBeenCalledTimes(2);
    });
  });

  /* ─── resetSettings ─── */

  describe('resetSettings', () => {
    it('deletes all settings then re-creates every definition', async () => {
      (prisma.systemSetting.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });
      (prisma.systemSetting.create as jest.Mock).mockResolvedValue({});

      const result = await service.resetSettings();

      expect(result.success).toBe(true);
      expect(result.message).toContain(String(SETTINGS_DEFINITIONS.length));
      expect(prisma.systemSetting.deleteMany).toHaveBeenCalledTimes(1);
      expect(prisma.systemSetting.create).toHaveBeenCalledTimes(SETTINGS_DEFINITIONS.length);
    });

    it('re-creates settings with the current version', async () => {
      (prisma.systemSetting.deleteMany as jest.Mock).mockResolvedValue({});
      (prisma.systemSetting.create as jest.Mock).mockResolvedValue({});

      await service.resetSettings();

      const calls = (prisma.systemSetting.create as jest.Mock).mock.calls;
      for (const [{ data }] of calls) {
        expect(data.version).toBe(SETTINGS_VERSION);
      }
    });

    it('invalidates the cache', async () => {
      (prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.systemSetting.deleteMany as jest.Mock).mockResolvedValue({});
      (prisma.systemSetting.create as jest.Mock).mockResolvedValue({});

      await service.listSystemSettings();
      await service.resetSettings();
      await service.listSystemSettings();

      expect(prisma.systemSetting.findMany).toHaveBeenCalledTimes(2);
    });
  });

  /* ─── getSettingByKey ─── */

  describe('getSettingByKey', () => {
    it('delegates to prisma.findUnique with the key', async () => {
      (prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue({
        key: 'workspace.name',
        value: 'Vellbase',
      });

      const result = await service.getSettingByKey('workspace.name');

      expect(result?.value).toBe('Vellbase');
      expect(prisma.systemSetting.findUnique).toHaveBeenCalledWith({ where: { key: 'workspace.name' } });
    });
  });

  /* ─── seed idempotency ─── */

  describe('idempotency', () => {
    it('seedSettings is safe to call repeatedly — second call is a no-op', async () => {
      (prisma.systemSetting.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(SETTINGS_DEFINITIONS.length);
      (prisma.systemSetting.create as jest.Mock).mockResolvedValue({});

      const first = await service.seedSettings();
      const second = await service.seedSettings();

      expect(first.seeded).toBe(SETTINGS_DEFINITIONS.length);
      expect(second.seeded).toBe(0);
      expect(prisma.systemSetting.create).toHaveBeenCalledTimes(SETTINGS_DEFINITIONS.length);
    });
  });
});
