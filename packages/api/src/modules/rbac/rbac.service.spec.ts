import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from './rbac.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';

describe('RbacService', () => {
  let service: RbacService;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<CacheService>;

  const mockPermissions = [
    { key: 'users.view', granted: true, permission: { key: 'users.view' } },
    { key: 'articles.create', granted: true, permission: { key: 'articles.create' } },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        {
          provide: PrismaService,
          useValue: {
            userRoleAssignment: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn(), updateMany: jest.fn() },
            roleAssignmentHistory: { create: jest.fn(), findMany: jest.fn() },
            userPermissionOverride: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
            permissionGroup: { create: jest.fn(), count: jest.fn(), findMany: jest.fn() },
            permission: { create: jest.fn(), findMany: jest.fn() },
            user: { findUnique: jest.fn(), findMany: jest.fn() },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(RbacService);
    prisma = module.get(PrismaService);
    cache = module.get(CacheService);
  });

  describe('getEffectivePermissions', () => {
    it('should return role-based permissions', async () => {
      (prisma.userRoleAssignment.findMany as jest.Mock).mockResolvedValue([
        {
          role: {
            permissions: mockPermissions,
            parent: null,
          },
        },
      ]);
      (prisma.userPermissionOverride.findMany as jest.Mock).mockResolvedValue([]);

      const perms = await service.getEffectivePermissions('user-1');
      expect(perms.has('users.view')).toBe(true);
      expect(perms.has('articles.create')).toBe(true);
    });

    it('should apply user deny overrides over role grants', async () => {
      (prisma.userRoleAssignment.findMany as jest.Mock).mockResolvedValue([
        {
          role: {
            permissions: [{ granted: true, permission: { key: 'users.view' } }],
            parent: null,
          },
        },
      ]);
      (prisma.userPermissionOverride.findMany as jest.Mock).mockResolvedValue([
        { granted: false, permission: { key: 'users.view' } },
      ]);

      const perms = await service.getEffectivePermissions('user-1');
      expect(perms.has('users.view')).toBe(false);
    });

    it('should apply user allow overrides', async () => {
      (prisma.userRoleAssignment.findMany as jest.Mock).mockResolvedValue([
        { role: { permissions: [], parent: null } },
      ]);
      (prisma.userPermissionOverride.findMany as jest.Mock).mockResolvedValue([
        { granted: true, permission: { key: 'articles.publish' } },
      ]);

      const perms = await service.getEffectivePermissions('user-1');
      expect(perms.has('articles.publish')).toBe(true);
    });

    it('should use cache when available', async () => {
      (cache.get as jest.Mock).mockResolvedValue(['users.view', 'roles.view']);
      const perms = await service.getEffectivePermissions('user-1');
      expect(perms.has('users.view')).toBe(true);
      expect(prisma.userRoleAssignment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has permission', async () => {
      jest.spyOn(service, 'getEffectivePermissions').mockResolvedValue(new Set(['users.view']));
      expect(await service.hasPermission('user-1', 'users.view')).toBe(true);
    });

    it('should return false when user lacks permission', async () => {
      jest.spyOn(service, 'getEffectivePermissions').mockResolvedValue(new Set([]));
      expect(await service.hasPermission('user-1', 'users.delete')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if any permission matches', async () => {
      jest.spyOn(service, 'getEffectivePermissions').mockResolvedValue(new Set(['tickets.view']));
      expect(await service.hasAnyPermission('user-1', ['tickets.view', 'tickets.delete'])).toBe(true);
    });
  });
});
