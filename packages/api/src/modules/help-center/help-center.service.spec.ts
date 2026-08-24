import { Test, TestingModule } from '@nestjs/testing';
import { HelpCenterService } from './help-center.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateTicketDto } from './dto/help-center.dto';
import { store } from '../shared/store';

describe('HelpCenterService — ticket creation and ownership', () => {
  let service: HelpCenterService;

  beforeEach(async () => {
    const prismaStub: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ name: 'Alice', handle: 'alice' }) },
      faqItem: { count: jest.fn(), findMany: jest.fn(), createMany: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HelpCenterService,
        { provide: PrismaService, useValue: prismaStub },
      ],
    }).compile();
    service = module.get(HelpCenterService);
  });

  describe('createTicket — enforces subject and body length validation', () => {
    const validBody =
      'When I try to upload an image the spinner just keeps going forever. ' +
      'Chrome latest, macOS 14. Clearing cache did not help.';

    const baseValid = (): CreateTicketDto => ({
      category: 'Technical',
      subject: 'Image upload hangs forever',
      body: validBody,
    });

    it('creates a ticket successfully at the boundary lengths (subject 3, body 10)', async () => {
      const dto: CreateTicketDto = {
        category: 'General',
        subject: 'abc',
        body: '1234567890',
      };
      const result = await service.createTicket('u1', dto);
      expect(result.subject).toBe('abc');
      expect(result.messages.length).toBe(1);
      expect(result.status).toBe('open');
      expect(result.ownerId).toBe('u1');
    });

    it('rejects subject shorter than 3 characters', async () => {
      const dto = baseValid();
      dto.subject = 'ab';
      await expect(service.createTicket('u1', dto)).rejects.toThrow(
        BadRequestException,
      );
      try {
        await service.createTicket('u1', dto);
      } catch (e: any) {
        expect(e.response?.message).toContain('Validation failed');
        expect(e.response?.errors?.subject).toBeDefined();
      }
    });

    it('rejects subject longer than 120 characters', async () => {
      const dto = baseValid();
      dto.subject = 'a'.repeat(121);
      await expect(service.createTicket('u1', dto)).rejects.toThrow(
        BadRequestException,
      );
      try {
        await service.createTicket('u1', dto);
      } catch (e: any) {
        expect(e.response?.errors?.subject).toBeDefined();
      }
    });

    it('rejects body shorter than 10 characters', async () => {
      const dto = baseValid();
      dto.body = 'too short';
      await expect(service.createTicket('u1', dto)).rejects.toThrow(
        BadRequestException,
      );
      try {
        await service.createTicket('u1', dto);
      } catch (e: any) {
        expect(e.response?.errors?.body).toBeDefined();
      }
    });

    it('rejects body longer than 2000 characters', async () => {
      const dto = baseValid();
      dto.body = 'x'.repeat(2001);
      await expect(service.createTicket('u1', dto)).rejects.toThrow(
        BadRequestException,
      );
      try {
        await service.createTicket('u1', dto);
      } catch (e: any) {
        expect(e.response?.errors?.body).toBeDefined();
      }
    });

    it('rejects an unknown category enum value', async () => {
      const dto: any = {
        category: 'NopeCategory',
        subject: 'Valid enough subject here',
        body: validBody,
      };
      await expect(service.createTicket('u1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('trims whitespace before applying length limits (does not count leading/trailing spaces)', async () => {
      const dto: CreateTicketDto = {
        category: 'Account',
        subject: '   ab   ',
        body: '   12345678   ',
      };
      await expect(service.createTicket('u1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates with all five allowed categories without reclassification', async () => {
      const cats: any[] = ['General', 'Account', 'Technical', 'Billing', 'Safety'];
      for (const cat of cats) {
        const dto: CreateTicketDto = {
          category: cat,
          subject: `Test ${cat} ticket`,
          body: validBody,
        };
        const r = await service.createTicket('u-cat-' + cat, dto);
        expect(r.category).toBe(cat);
      }
    });

    it('attaches the initial body as the first message authored by the owner', async () => {
      const dto = baseValid();
      const r = await service.createTicket('owner-1', dto);
      expect(r.messages.length).toBe(1);
      const first = r.messages[0];
      expect(first.body).toBe(dto.body);
      expect(first.authorId).toBe('owner-1');
      expect(first.authorName).toBeDefined();
    });
  });

  describe('getTicket — only returns ticket when owner matches', () => {
    let sharedTicketId: string;

    beforeAll(async () => {
      const t = store.createTicket({
        ownerId: 'owner-123',
        ownerName: 'Owner',
        category: 'General',
        subject: 'Shared test ticket',
        body:
          'This is a detailed description of the issue we are experiencing. ' +
          'More than ten characters for sure.',
      });
      sharedTicketId = t.id;
    });

    it('returns full ticket with messages when the requesting user IS the owner', async () => {
      const t = service.getTicket('owner-123', sharedTicketId);
      expect(t.id).toBe(sharedTicketId);
      expect(t.ownerId).toBe('owner-123');
      expect(Array.isArray(t.messages)).toBe(true);
      expect(t.messages.length).toBeGreaterThanOrEqual(1);
    });

    it('throws ForbiddenException when the requesting user is NOT the owner', () => {
      expect(() =>
        service.getTicket('stranger-456', sharedTicketId),
      ).toThrow(ForbiddenException);
    });

    it('throws NotFoundException for a ticket id that does not exist', () => {
      expect(() =>
        service.getTicket('owner-123', 'ticket-does-not-exist-999'),
      ).toThrow(NotFoundException);
    });

    it('ownership check is exact string match — no partial/substring grants', () => {
      expect(() =>
        service.getTicket('owner-12', sharedTicketId),
      ).toThrow(ForbiddenException);
      expect(() =>
        service.getTicket('owner-1234', sharedTicketId),
      ).toThrow(ForbiddenException);
    });

    it('listTickets only returns tickets belonging to the requesting user (scoped by ownerId)', async () => {
      await service.createTicket('alice-99', {
        category: 'General',
        subject: "Alice's private ticket",
        body: 'This message should be at least ten characters long indeed.',
      });
      await service.createTicket('bob-99', {
        category: 'Billing',
        subject: "Bob's invoice question",
        body: 'Also definitely longer than the ten character minimum body.',
      });
      const aliceView = service.listTickets({
        ownerId: 'alice-99',
        status: 'all',
        page: 1,
        perPage: 50,
      });
      const bobView = service.listTickets({
        ownerId: 'bob-99',
        status: 'all',
        page: 1,
        perPage: 50,
      });
      expect(aliceView.items.every((t) => t.ownerId === 'alice-99')).toBe(true);
      expect(bobView.items.every((t) => t.ownerId === 'bob-99')).toBe(true);
      const aliceSubjects = aliceView.items.map((t) => t.subject);
      expect(aliceSubjects).not.toContain("Bob's invoice question");
    });
  });
});
