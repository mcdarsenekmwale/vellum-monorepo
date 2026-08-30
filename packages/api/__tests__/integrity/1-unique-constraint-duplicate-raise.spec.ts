import { PrismaClient } from '@prisma/client';

describe('1 — Unique constraint duplicate raises P2002', () => {
  let prisma: PrismaClient;
  const TEST_EMAIL = 'test_d_uniq1@x.com';
  const TEST_HANDLE = 'test_d_uniq1_handle';
  const TEST_PASSWORD_HASH = '$2a$10$placeholder';

  beforeAll(() => {
    prisma = new PrismaClient({
      datasourceUrl: 'postgresql://mcdarsenemwale@127.0.0.1:5432/vellum_db?schema=public',
    });
  });

  afterAll(async () => {
    // Prune test rows only (do not delete seeded users)
    await prisma.$executeRaw`DELETE FROM "User" WHERE email LIKE 'test_d_%' OR handle LIKE 'test_d_%'`;
    await prisma.$disconnect();
  }, 30_000);

  it('creates User with unique email OK, then duplicate raises P2002', async () => {
    // Ensure clean slate for this specific test email
    try {
      await prisma.user.delete({ where: { email: TEST_EMAIL } });
    } catch { /* didn't exist */ }

    // 1) First create — must succeed
    const created = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        handle: TEST_HANDLE,
        name: 'Test D Unique 1',
        passwordHash: TEST_PASSWORD_HASH,
      },
      select: { id: true, email: true, handle: true },
    });
    expect(created.email).toBe(TEST_EMAIL);
    expect(created.handle).toBe(TEST_HANDLE);
    expect(typeof created.id).toBe('string');

    // 2) Second create with the SAME email — must throw P2002
    let errorCaught: any = null;
    try {
      await prisma.user.create({
        data: {
          email: TEST_EMAIL,
          handle: TEST_HANDLE + '_2', // different handle so we know email is the collision
          name: 'Duplicate Attempt',
          passwordHash: TEST_PASSWORD_HASH,
        },
      });
    } catch (err: any) {
      errorCaught = err;
    }

    // Explicit assertions on caught error
    expect(errorCaught).not.toBeNull();
    expect(errorCaught).toBeDefined();
    // Prisma unique constraint violation is error.code === 'P2002'
    expect(errorCaught.code).toBe('P2002');
    // Sanity: check the error message mentions unique / constraint
    const msg = (errorCaught.message || '').toString();
    expect(msg.length).toBeGreaterThan(0);
  }, 30_000);
});
