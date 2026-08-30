import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/shared/prisma/prisma.service';
import * as request from 'supertest';

describe('8 — AdminGuard: consumer user → 403; admin → 200 on /admin/activity/fire-event', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let consumerToken: string;
  let targetUserId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      'postgresql://mcdarsenemwale@127.0.0.1:5432/vellum_db?schema=public';
    process.env.PGHOST = '127.0.0.1';
    process.env.PGDATABASE = 'vellum_db';
    process.env.PGUSER = 'mcdarsenemwale';

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Login ADMIN
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@vellbase.com', password: 'password123' });
    adminToken = adminLogin.body.accessToken;

    // Login CONSUMER (user1@example.com has role USER, not ADMIN — AdminGuard rejects)
    const consumerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'user1@example.com', password: 'password123' });
    consumerToken = consumerLogin.body.accessToken;

    // Fire event body targets this user (any user id — valid UUID required)
    const u = await prisma.user.findFirstOrThrow({
      where: { email: 'user2@example.com' },
      select: { id: true },
    });
    targetUserId = u.id;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('CONSUMER bearer POST /api/admin/activity/fire-event → HTTP 403 FORBIDDEN', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/activity/fire-event')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({
        userId: targetUserId,
        kind: 'LIKE',
        previewText: 'consumer forbidden test',
      });
    expect(res.status).toBe(403);
  });

  it('ADMIN bearer POST /api/admin/activity/fire-event → HTTP 200/201 with id field', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/activity/fire-event')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: targetUserId,
        kind: 'LIKE',
        previewText: 'admin guard success integ ' + Date.now(),
      });
    // Default POST Nest returns 201 unless explicit @HttpCode(OK) is set (this endpoint doesn't set one)
    expect([200, 201]).toContain(res.status);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.id).toBe('string');
    expect(res.body.id.length).toBeGreaterThan(10); // UUID style
  });
});
