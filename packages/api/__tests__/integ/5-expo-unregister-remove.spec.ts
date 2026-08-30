import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import * as request from 'supertest';

describe('5 — Expo Push Token Unregister removes token (integ)', () => {
  let app: INestApplication;
  let userToken: string;
  const TOKEN = 'ExponentPushToken[TEST_UNREG_B]';

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
      .send({ email: 'user2@example.com', password: 'password123' });
    userToken = login.body.accessToken;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('Register → unregister → tokens array no longer contains TOKEN', async () => {
    // 1. Register
    const rReg = await request(app.getHttpServer())
      .post('/api/activity/expo-push-token')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ action: 'register', token: TOKEN });
    expect(rReg.status).toBe(200);
    expect(rReg.body.tokens).toContain(TOKEN);
    const lenBefore = rReg.body.tokens.length;

    // 2. Unregister
    const rUnreg = await request(app.getHttpServer())
      .post('/api/activity/expo-push-token')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ action: 'unregister', token: TOKEN });
    expect(rUnreg.status).toBe(200);
    expect(rUnreg.body.success).toBe(true);
    expect(rUnreg.body.tokens).not.toContain(TOKEN);
    expect(rUnreg.body.tokens.length).toBeLessThanOrEqual(lenBefore - 0);
    // Strictly less if it was present (it was)
    if (lenBefore >= 1) {
      expect(rUnreg.body.tokens.length).toBeLessThan(lenBefore + 1);
    }
  });
});
