import { PrismaClient, NotificationKind } from '@prisma/client';

describe('3 — Postgres enum FOLLOW persists across 2 PrismaClient connections', () => {
  let client1: PrismaClient;
  let client2: PrismaClient;
  const DB_URL = 'postgresql://mcdarsenemwale@127.0.0.1:5432/vellum_db?schema=public';

  let testActorId: string | null = null;
  let testTargetUserId: string | null = null;
  let createdNotifId: string | null = null;

  beforeAll(async () => {
    client1 = new PrismaClient({ datasourceUrl: DB_URL });
    client2 = new PrismaClient({ datasourceUrl: DB_URL });

    // Create two test users (actor + target) via client1
    const actor = await client1.user.upsert({
      where: { email: 'test_d_enum_actor@x.com' },
      update: {},
      create: {
        email: 'test_d_enum_actor@x.com',
        handle: 'test_d_enum_actor',
        name: 'Test D Enum Actor',
        passwordHash: '$2a$10$enum.actor.hash.placeholder',
      },
      select: { id: true, handle: true },
    });
    testActorId = actor.id;

    const target = await client1.user.upsert({
      where: { email: 'test_d_enum_target@x.com' },
      update: {},
      create: {
        email: 'test_d_enum_target@x.com',
        handle: 'test_d_enum_target',
        name: 'Test D Enum Target',
        passwordHash: '$2a$10$enum.target.hash.placeholder',
      },
      select: { id: true },
    });
    testTargetUserId = target.id;
  }, 30_000);

  afterAll(async () => {
    // Clean up notification + users matching test_d_*
    try {
      if (createdNotifId) {
        await client1.notification.deleteMany({ where: { id: createdNotifId } });
      }
    } catch { /* ok */ }
    await client1.$executeRaw`DELETE FROM "Notification" WHERE "actorId" IN (SELECT id FROM "User" WHERE handle LIKE 'test_d_%' OR email LIKE 'test_d_%')`;
    await client1.$executeRaw`DELETE FROM "User" WHERE email LIKE 'test_d_%' OR handle LIKE 'test_d_%'`;
    await client1.$disconnect();
    await client2.$disconnect();
  }, 30_000);

  it('client1 creates Notification kind=FOLLOW, client2 reads back kind === "FOLLOW" string enum', async () => {
    expect(testActorId).toBeDefined();
    expect(testTargetUserId).toBeDefined();

    // Connection 1: INSERT notification with kind FOLLOW (enum)
    const created = await client1.notification.create({
      data: {
        userId: testTargetUserId!,
        actorId: testActorId!,
        kind: NotificationKind.FOLLOW,
        body: 'Integrity test enum FOLLOW persisted',
      },
      select: { id: true, kind: true, actorId: true },
    });
    createdNotifId = created.id;
    expect(typeof created.id).toBe('string');
    expect(created.actorId).toBe(testActorId);
    // Connection 1 already sees it as FOLLOW (could be local cast)
    expect(created.kind).toBe(NotificationKind.FOLLOW);

    // Connection 2: SELECT the row back fresh, verify kind === FOLLOW (string enum)
    // Explicitly force a fresh read (no cache, new connection)
    const readBack = await client2.notification.findUnique({
      where: { id: created.id },
      select: { id: true, kind: true, userId: true, actorId: true },
    });
    expect(readBack).not.toBeNull();
    expect(readBack!.id).toBe(created.id);
    expect(readBack!.userId).toBe(testTargetUserId);
    expect(readBack!.actorId).toBe(testActorId);
    // The critical assertion: enum is the literal string 'FOLLOW' after being
    // written through connection #1 and read on a separate connection #2.
    // This proves Postgres stored the enum value and it persisted NOT NULL.
    expect(readBack!.kind).toBe('FOLLOW' as any);
    expect(readBack!.kind).toBe(NotificationKind.FOLLOW);
    expect(readBack!.kind).not.toBeNull();
    expect(readBack!.kind).not.toBeUndefined();
    expect(typeof readBack!.kind).toBe('string');
  }, 30_000);
});
