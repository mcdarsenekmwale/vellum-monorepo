import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

/**
 * E2E tests for the settings HTTP endpoints exposed by AdminController.
 *
 * The auth guards are stubbed to allow all requests through so we can focus
 * on the routing, body parsing, and response contracts for the settings API.
 * The AdminService is mocked so the controller is tested in isolation from
 * the database.
 */

describe('AdminController — settings (e2e)', () => {
  let app: INestApplication;
  let adminService: jest.Mocked<AdminService>;

  beforeAll(async () => {
    adminService = {
      listSystemSettings: jest.fn(),
      updateSystemSetting: jest.fn(),
      seedSettings: jest.fn(),
      resetSettings: jest.fn(),
    } as unknown as jest.Mocked<AdminService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: adminService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  /* ─── GET /api/admin/settings ─── */

  describe('GET /api/admin/settings', () => {
    it('returns settings grouped by category', async () => {
      const grouped = {
        general: [
          { id: '1', key: 'workspace.name', value: 'Vellbase', category: 'general', description: '', version: 1 },
        ],
        security: [
          { id: '2', key: 'security.require_2fa', value: 'false', category: 'security', description: '', version: 1 },
        ],
      };
      adminService.listSystemSettings.mockResolvedValue(grouped);

      const res = await request(app.getHttpServer()).get('/api/admin/settings');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(grouped);
      expect(adminService.listSystemSettings).toHaveBeenCalledTimes(1);
    });

    it('returns an empty object when no settings exist', async () => {
      adminService.listSystemSettings.mockResolvedValue({});

      const res = await request(app.getHttpServer()).get('/api/admin/settings');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });
  });

  /* ─── PUT /api/admin/settings ─── */

  describe('PUT /api/admin/settings', () => {
    it('updates a setting and returns the result', async () => {
      const updated = { id: '1', key: 'workspace.name', value: 'New Name', category: 'general', version: 1 };
      adminService.updateSystemSetting.mockResolvedValue(updated as any);

      const res = await request(app.getHttpServer())
        .put('/api/admin/settings')
        .send({ key: 'workspace.name', value: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
      expect(adminService.updateSystemSetting).toHaveBeenCalledWith('workspace.name', 'New Name', undefined);
    });

    it('forwards the optional category field', async () => {
      adminService.updateSystemSetting.mockResolvedValue({} as any);

      await request(app.getHttpServer())
        .put('/api/admin/settings')
        .send({ key: 'workspace.name', value: 'Vellbase', category: 'general' });

      expect(adminService.updateSystemSetting).toHaveBeenCalledWith('workspace.name', 'Vellbase', 'general');
    });

    it('returns 500 when validation fails (service throws)', async () => {
      adminService.updateSystemSetting.mockRejectedValue(new Error('Invalid value for bad.key'));

      const res = await request(app.getHttpServer())
        .put('/api/admin/settings')
        .send({ key: 'bad.key', value: 'x' });

      expect(res.status).toBeGreaterThanOrEqual(500);
    });
  });

  /* ─── POST /api/admin/settings/seed ─── */

  describe('POST /api/admin/settings/seed', () => {
    it('seeds settings and reports the count', async () => {
      adminService.seedSettings.mockResolvedValue({
        message: 'Seeded 67 system settings',
        seeded: 67,
      });

      const res = await request(app.getHttpServer()).post('/api/admin/settings/seed');

      expect(res.status).toBe(201);
      expect(res.body.seeded).toBe(67);
      expect(res.body.message).toContain('Seeded');
      expect(adminService.seedSettings).toHaveBeenCalledTimes(1);
    });

    it('reports a no-op when settings already exist', async () => {
      adminService.seedSettings.mockResolvedValue({
        message: '67 settings already exist, skipping seed',
        seeded: 0,
      });

      const res = await request(app.getHttpServer()).post('/api/admin/settings/seed');

      expect(res.status).toBe(201);
      expect(res.body.seeded).toBe(0);
    });
  });

  /* ─── POST /api/admin/settings/reset ─── */

  describe('POST /api/admin/settings/reset', () => {
    it('resets settings to defaults', async () => {
      adminService.resetSettings.mockResolvedValue({
        success: true,
        message: 'Settings reset to 67 defaults',
      });

      const res = await request(app.getHttpServer()).post('/api/admin/settings/reset');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(adminService.resetSettings).toHaveBeenCalledTimes(1);
    });
  });
});
