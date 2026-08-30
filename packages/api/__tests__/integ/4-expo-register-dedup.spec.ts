import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import * as request from 'supertest';

describe('4 — Expo Push Token Register Dedup (integ)', () => {
  let app: INestApplication;
  let userToken: string;
  const TOKEN = 'ExponentPushToken[TEST_DEDUP_A]';

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

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'user1@example.com', password: 'password123' });
    userToken = login.body.accessToken;
  }, 60_000);

  afterAll(async () => {
    // Cleanup: unregister the test token so other tests are isolated
    try {
      await request(app.getHttpServer())
        .post('/api/activity/expo-push-token')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ action: 'unregister', token: TOKEN });
    } catch {}
    await app?.close();
  });

  it('First register → tokens array length = 1 (or >=1)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/activity/expo-push-token')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ action: 'register', token: TOKEN });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tokens)).toBe(true);
    expect(res.body.tokens).toContain(TOKEN);
    expect(res.body.tokens.length).toBeGreaterThanOrEqual(1);
  });

  it('Second register same token → array length DOES NOT INCREASE (dedup)', async () => {
    // Get baseline after first call
    const r1 = await request(app.getHttpServer())
      .post('/api/activity/expo-push-token')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ action: 'register', token: TOKEN });
    expect(r1.status).toBe(200);
    const firstLen = r1.body.tokens.length;

    const r2 = await request(app.getHttpServer())
      .post('/api/activity/expo-push-token')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ action: 'register', token: TOKEN });
    expect(r2.status).toBe(200);
    const secondLen = r2.body.tokens.length;

    // Length stays the same or <= previous (dedup)
    expect(secondLen).toBeLessThanOrEqual(firstLen);
    expect(secondLen).toBe(firstLen);
  });
});
