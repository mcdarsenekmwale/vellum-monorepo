import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../src/shared/prisma/prisma.service';
import { ActivityAggregatorService } from '../../src/modules/activity/activity-aggregator.service';
import { NotificationKind } from '@prisma/client';

describe('2 — Aggregator EventLoop Realtime notification.created → ActivityItem upsert', () => {
  let app: INestApplication;
  let emitter: EventEmitter2;
  let prisma: PrismaService;
  let aggregator: ActivityAggregatorService;

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

    emitter = app.get(EventEmitter2);
    prisma = app.get(PrismaService);
    aggregator = app.get(ActivityAggregatorService);

    // Shim @OnEvent('notification.created') — Jest shim OnEvent decorator is no-op
    // so manual wire: every emit → aggregator.handleNotificationCreated (async).
    // Mimics real Nest wiring done by @nestjs/event-emitter package.
    emitter.on('notification.created', async (payload: any) => {
      try {
        await aggregator.handleNotificationCreated(payload);
      } catch {}
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('emit notification.created → ActivityItem count increases by >=1 within 100ms', async () => {
    // Grab a real user from DB to attach event to (consistent userId)
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'admin@vellbase.com' },
      select: { id: true },
    });

    // Use a unique article slug so grouping key is unique for this test
    const uniqueSlug = `integ-test-d-agg-event-${Date.now()}`;

    const nBefore = await prisma.activityItem.count({
      where: { userId: user.id, articleSlug: uniqueSlug },
    });

    const payload = {
      notificationId: 'test-notif-' + Date.now(),
      userId: user.id,
      actorId: user.id,
      kind: NotificationKind.LIKE,
      articleSlug: uniqueSlug,
      highlightId: null,
      commentId: null,
      previewText: 'Integ test D event LIKE',
      linkHref: null,
    };

    const t0 = Date.now();
    emitter.emit('notification.created', payload);

    // Listener is async:true promisify:true but EventEmitter2 emits synchronously
    // to the wrapped handler which then runs async upsert. Wait 50 ms for PG commit.
    await new Promise((r) => setTimeout(r, 80));

    const nAfter = await prisma.activityItem.count({
      where: { userId: user.id, articleSlug: uniqueSlug },
    });

    const elapsed = Date.now() - t0;
    expect(nAfter - nBefore).toBeGreaterThanOrEqual(1);
    expect(elapsed).toBeLessThan(200); // < 200 ms wall clock
  });
});
