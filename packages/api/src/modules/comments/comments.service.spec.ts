import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('CommentsService — Security (Access Control)', () => {
  let service: CommentsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: PrismaService,
          useValue: {
            comment: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            article: { findUnique: jest.fn(), update: jest.fn() },
            highlight: { findUnique: jest.fn(), update: jest.fn() },
            notification: { create: jest.fn() },
          },
        },
      ],
    }).compile();
    service = module.get(CommentsService);
    prisma = module.get(PrismaService);
  });

  describe('deleteComment — ownership & role check', () => {
    it('throws NotFoundException when the comment does not exist', async () => {
      (prisma.comment.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.deleteComment('u1', 'missing', Role.USER)
      ).rejects.toThrow(NotFoundException);
    });

    it('allows the author to delete their own comment', async () => {
      (prisma.comment.findUnique as jest.Mock).mockResolvedValue({
        id: 'c1',
        authorId: 'u1',
        articleSlug: 'a-slug',
      });
      (prisma.comment.update as jest.Mock).mockResolvedValue({});
      (prisma.comment.count as jest.Mock).mockResolvedValue(0);
      (prisma.article.update as jest.Mock).mockResolvedValue({});

      const result = await service.deleteComment('u1', 'c1', Role.USER);
      expect(result).toEqual({ message: 'Comment deleted successfully' });
      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('denies a different USER from deleting another user’s comment', async () => {
      (prisma.comment.findUnique as jest.Mock).mockResolvedValue({
        id: 'c1',
        authorId: 'u-author',
        articleSlug: 'a-slug',
      });
      await expect(
        service.deleteComment('u-other', 'c1', Role.USER)
      ).rejects.toThrow(BadRequestException);
    });

    it('allows a MODERATOR to delete any comment', async () => {
      (prisma.comment.findUnique as jest.Mock).mockResolvedValue({
        id: 'c1',
        authorId: 'u-author',
        articleSlug: 'a-slug',
      });
      (prisma.comment.update as jest.Mock).mockResolvedValue({});
      (prisma.comment.count as jest.Mock).mockResolvedValue(0);
      (prisma.article.update as jest.Mock).mockResolvedValue({});

      const result = await service.deleteComment('u-mod', 'c1', Role.MODERATOR);
      expect(result).toEqual({ message: 'Comment deleted successfully' });
    });

    it('allows an ADMIN to delete any comment', async () => {
      (prisma.comment.findUnique as jest.Mock).mockResolvedValue({
        id: 'c1',
        authorId: 'u-author',
        articleSlug: 'a-slug',
      });
      (prisma.comment.update as jest.Mock).mockResolvedValue({});
      (prisma.comment.count as jest.Mock).mockResolvedValue(0);
      (prisma.article.update as jest.Mock).mockResolvedValue({});

      const result = await service.deleteComment('u-admin', 'c1', Role.ADMIN);
      expect(result).toEqual({ message: 'Comment deleted successfully' });
    });

    it('does not physically delete the comment (soft delete via deletedAt)', async () => {
      (prisma.comment.findUnique as jest.Mock).mockResolvedValue({
        id: 'c1',
        authorId: 'u1',
        articleSlug: 'a-slug',
      });
      (prisma.comment.update as jest.Mock).mockResolvedValue({});
      (prisma.comment.count as jest.Mock).mockResolvedValue(0);
      (prisma.article.update as jest.Mock).mockResolvedValue({});

      await service.deleteComment('u1', 'c1', Role.USER);

      const updateArgs = (prisma.comment.update as jest.Mock).mock.calls[0][0];
      // Must set deletedAt, NOT call delete() — preserves audit trail
      expect(updateArgs.data.deletedAt).toBeInstanceOf(Date);
      expect(prisma.comment.update).toHaveBeenCalled();
    });
  });

  describe('updateComment — ownership check', () => {
    it('throws NotFoundException when the comment does not exist', async () => {
      (prisma.comment.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.updateComment('u1', 'missing', 'edited')
      ).rejects.toThrow(NotFoundException);
    });

    it('denies a different user from editing another user’s comment', async () => {
      (prisma.comment.findUnique as jest.Mock).mockResolvedValue({
        id: 'c1',
        authorId: 'u-author',
      });
      await expect(
        service.updateComment('u-other', 'c1', 'edited')
      ).rejects.toThrow(BadRequestException);
    });

    it('allows the author to update their comment', async () => {
      (prisma.comment.findUnique as jest.Mock).mockResolvedValue({
        id: 'c1',
        authorId: 'u1',
      });
      (prisma.comment.update as jest.Mock).mockResolvedValue({
        id: 'c1',
        body: 'edited',
      });

      const result = await service.updateComment('u1', 'c1', 'edited');
      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { body: 'edited' },
      });
      expect(result.body).toBe('edited');
    });
  });

  describe('createComment — input validation', () => {
    it('requires either an articleSlug or a highlightId', async () => {
      await expect(
        service.createComment('u1', { body: 'hi' } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the parent comment does not exist', async () => {
      (prisma.comment.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.createComment('u1', {
          body: 'reply',
          articleSlug: 'a-slug',
          parentId: 'missing-parent',
        } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('truncates the notification body to prevent oversized payloads', async () => {
      (prisma.comment.findUnique as jest.Mock).mockResolvedValue(null); // no parent
      (prisma.comment.create as jest.Mock).mockResolvedValue({
        id: 'c1',
        authorId: 'u1',
      });
      (prisma.article.findUnique as jest.Mock).mockResolvedValue({
        authorId: 'u-other', // different from commenter → triggers notification
      });
      (prisma.comment.count as jest.Mock).mockResolvedValue(1);
      (prisma.article.update as jest.Mock).mockResolvedValue({});
      (prisma.notification.create as jest.Mock).mockResolvedValue({});

      const longBody = 'x'.repeat(500);
      await service.createComment('u1', {
        body: longBody,
        articleSlug: 'a-slug',
      } as any);

      const notifArgs = (prisma.notification.create as jest.Mock).mock.calls[0][0];
      expect(notifArgs.data.body.length).toBeLessThanOrEqual(200);
    });
  });
});
