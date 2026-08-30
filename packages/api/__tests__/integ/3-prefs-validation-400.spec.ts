import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import * as request from 'supertest';

describe('3 — Preferences validation: invalid input → HTTP 400; valid → 200', () => {
  let app: INestApplication;
  let adminToken: string;

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
      .send({ email: 'admin@vellbase.com', password: 'password123' });
    adminToken = login.body.accessToken;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('PUT /api/activity/preferences with numeric quietHoursStart (not string) → 400', async () => {
    // Pass a non-string number → @IsString() fails → validator → BadRequest 400
    const res = await request(app.getHttpServer())
      .put('/api/activity/preferences')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quietHoursStart: 12345 } as any); // explicit wrong type
    expect(res.status).toBe(400);
  });

  it('PUT /api/activity/preferences quietHoursStart len=6 "25:990" → 400 (MaxLength(5))', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/activity/preferences')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quietHoursStart: '25:990' }); // length 6 > 5 → @MaxLength(5) fails
    expect(res.status).toBe(400);
  });

  it('PUT /api/activity/preferences happy case 07:30 / 23:00 → HTTP 200 persisted matches', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/activity/preferences')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        quietHoursStart: '07:30',
        quietHoursEnd: '23:00',
        groupLikes: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.quietHoursStart).toBe('07:30');
    expect(res.body.quietHoursEnd).toBe('23:00');
  });
});
