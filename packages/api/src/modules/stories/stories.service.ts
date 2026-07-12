import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class StoriesService {
  constructor(private prisma: PrismaService) {}

  async createStory(userId: string, image: string, caption?: string, duration?: number) {
    return this.prisma.story.create({
      data: {
        authorId: userId,
        image,
        caption,
        duration: duration || 5000,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  async getStories() {
    const now = new Date();
    return this.prisma.story.findMany({
      where: { expiresAt: { gt: now } },
      include: {
        author: { select: { id: true, handle: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStory(authorId: string, storyId: string, viewerId?: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: {
        author: { select: { id: true, handle: true, name: true, avatar: true } },
      },
    });

    if (!story || story.authorId !== authorId) {
      throw new NotFoundException('Story not found');
    }

    if (viewerId) {
      await this.prisma.storyView.upsert({
        where: { storyId_viewerId: { storyId, viewerId } },
        update: {},
        create: { storyId, viewerId },
      });
    }

    return story;
  }

  async getUserStories(authorId: string) {
    const now = new Date();
    return this.prisma.story.findMany({
      where: { authorId, expiresAt: { gt: now } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteStory(userId: string, storyId: string) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.authorId !== userId) {
      throw new NotFoundException('You can only delete your own stories');
    }

    await this.prisma.story.delete({ where: { id: storyId } });
    return { message: 'Story deleted successfully' };
  }

  async getStoryViewCount(storyId: string) {
    const count = await this.prisma.storyView.count({ where: { storyId } });
    return { count };
  }
}