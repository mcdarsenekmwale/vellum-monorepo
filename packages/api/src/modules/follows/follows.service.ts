import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationKind } from '@prisma/client';

@Injectable()
export class FollowsService {
  constructor(private prisma: PrismaService) {}

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const existingFollow = await this.prisma.follow.findUnique({
          where: { followerId_followingId: { followerId, followingId } },
        });

        if (existingFollow) {
          try {
            await this.prisma.follow.delete({ where: { id: existingFollow.id } });
          } catch (deleteError: any) {
            if (deleteError?.code === 'P2025') {
              return { following: false };
            }
            throw deleteError;
          }
          return { following: false };
        }

        try {
          await this.prisma.follow.create({ data: { followerId, followingId } });
        } catch (createError: any) {
          if (createError?.code === 'P2002') {
            return { following: true };
          }
          throw createError;
        }

        await this.prisma.notification.create({
          data: {
            userId: followingId,
            actorId: followerId,
            kind: NotificationKind.FOLLOW,
          },
        });

        return { following: true };
      } catch (error: any) {
        const isRetryable =
          error?.code === 'P2002' ||
          error?.code === 'P2025' ||
          error?.code === 'P2034';

        if (isRetryable && attempt < MAX_RETRIES) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to toggle follow after multiple attempts');
  }

  async getFollowers(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followingId: userId },
        include: { follower: { select: { id: true, handle: true, name: true, avatar: true, bio: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.follow.count({ where: { followingId: userId } }),
    ]);

    return {
      data: follows.map((f) => f.follower),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getFollowing(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        include: { following: { select: { id: true, handle: true, name: true, avatar: true, bio: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);

    return {
      data: follows.map((f) => f.following),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async isFollowing(followerId: string, followingId: string) {
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    return { following: !!follow };
  }
}