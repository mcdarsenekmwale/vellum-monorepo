import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';

describe('RbacController (e2e)', () => {
  let app: INestApplication;
  let rbacService: jest.Mocked<RbacService>;

  beforeAll(async () => {
    rbacService = {
      listPermissionGroups: jest.fn(),
      listPermissions: jest.fn(),
      listRoles: jest.fn(),
      getRole: jest.fn(),
      createRole: jest.fn(),
      updateRole: jest.fn(),
      deleteRole: jest.fn(),
      restoreRole: jest.fn(),
      duplicateRole: jest.fn(),
      assignPermissionsToRole: jest.fn(),
      getPermission: jest.fn(),
      createPermission: jest.fn(),
      updatePermission: jest.fn(),
      deletePermission: jest.fn(),
      getUserRoles: jest.fn(),
      assignRoleToUser: jest.fn(),
      removeRoleFromUser: jest.fn(),
      bulkAssignRole: jest.fn(),
      getUserEffectivePermissions: jest.fn(),
      getRoleHistory: jest.fn(),
      setUserPermissionOverride: jest.fn(),
      removeUserPermissionOverride: jest.fn(),
      seedRbac: jest.fn(),
      assignDefaultRolesToUsers: jest.fn(),
      getEffectivePermissions: jest.fn(),
      hasPermission: jest.fn(),
      hasAnyPermission: jest.fn(),
      hasAllPermissions: jest.fn(),
      invalidateUserCache: jest.fn(),
    } as unknown as jest.Mocked<RbacService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RbacController],
      providers: [{ provide: RbacService, useValue: rbacService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /api/rbac/permission-groups', () => {
    it('returns 200 with permission groups from RbacService.listPermissionGroups()', async () => {
      const groups = [
        {
          id: 'g1',
          key: 'content',
          name: 'Content Management',
          sortOrder: 0,
          deletedAt: null,
          permissions: [
            { id: 'p1', key: 'articles.view', name: 'View Articles', groupId: 'g1', sortOrder: 0, deletedAt: null },
            { id: 'p2', key: 'articles.create', name: 'Create Articles', groupId: 'g1', sortOrder: 1, deletedAt: null },
          ],
        },
        {
          id: 'g2',
          key: 'users',
          name: 'User Management',
          sortOrder: 1,
          deletedAt: null,
          permissions: [
            { id: 'p3', key: 'users.view', name: 'View Users', groupId: 'g2', sortOrder: 0, deletedAt: null },
          ],
        },
      ];
      rbacService.listPermissionGroups.mockResolvedValue(groups as any);

      const res = await request(app.getHttpServer()).get('/api/rbac/permission-groups');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(groups);
      expect(rbacService.listPermissionGroups).toHaveBeenCalledTimes(1);
    });
  });
});
