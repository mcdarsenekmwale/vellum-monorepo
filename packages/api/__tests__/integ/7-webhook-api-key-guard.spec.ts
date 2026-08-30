import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/shared/prisma/prisma.service';
import * as request from 'supertest';

describe('7 — Webhook ApiKeyGuard: empty/invalid key → 401, valid → 202', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testUser: { id: string };
  const ORIG_KEY = process.env.ACTIVITY_WEBHOOK_API_KEY;
  const TEST_KEY = 'test_webhook_secret_123';

  beforeAll(async () => {
    process.env.DATABASE_URL =
      'postgresql://mcdarsenemwale@127.0.0.1:5432/vellum_db?schema=public';
    process.env.PGHOST = '127.0.0.1';
    process.env.PGDATABASE = 'vellum_db';
    process.env.PGUSER = 'mcdarsenemwale';
    // Set test webhook key
    process.env.ACTIVITY_WEBHOOK_API_KEY = TEST_KEY;

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
    const u = await prisma.user.findFirstOrThrow({
      where: { email: 'user1@example.com' },
      select: { id: true },
    });
    testUser = u;
  }, 60_000);

  afterAll(async () => {
    // Restore original env
    if (ORIG_KEY === undefined) delete process.env.ACTIVITY_WEBHOOK_API_KEY;
    else process.env.ACTIVITY_WEBHOOK_API_KEY = ORIG_KEY;
    await app?.close();
  });

  it('POST /api/activity/webhook-inbound NO header → 403 (rejected by guard)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/activity/webhook-inbound')
      .send({
        userId: testUser.id,
        kind: 'LIKE',
        previewText: 'no header',
      });
    // Default Nest guards → ForbiddenException(403) not 401 when canActivate=false
    expect([401, 403]).toContain(res.status);
    expect(res.status).toBe(403);
  });

  it('POST header X-Vell-Webhook-Key = "wrong" → 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/activity/webhook-inbound')
      .set('X-Vell-Webhook-Key', 'wrong')
      .send({
        userId: testUser.id,
        kind: 'LIKE',
        previewText: 'wrong key',
      });
    expect(res.status).toBe(403);
  });

  it('POST valid header X-Vell-Webhook-Key + valid DTO → HTTP 202 accepted', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/activity/webhook-inbound')
      .set('X-Vell-Webhook-Key', TEST_KEY)
      .send({
        userId: testUser.id,
        actorId: testUser.id,
        kind: 'LIKE',
        previewText: 'webhook integ test ' + Date.now(),
        articleSlug: 'test-d-webhook-' + Date.now(),
      });
    // Controller returns HTTP 202 ACCEPTED
    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(true);
    expect(typeof res.body.notificationId).toBe('string');
  });
});
