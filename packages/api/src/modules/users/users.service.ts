import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpdateUserDto, UpdateUserSettingsDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        handle: true,
        name: true,
        avatar: true,
        bio: true,
        website: true,
        location: true,
        publication: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        settings: true,
        articles: {
          where: { isPublished: true },
          select: { id: true, title: true, slug: true, cover: true, readMinutes: true, likesCount: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const followerCount = await this.prisma.follow.count({
      where: { followingId: userId },
    });

    const followingCount = await this.prisma.follow.count({
      where: { followerId: userId },
    });

    return {
      ...user,
      followerCount,
      followingCount,
      articleCount: user.articles.length,
    };
  }

  /**
   * Admin-detail lookup by numeric/UUID `id`. This is what the admin dashboard
   * user detail page (/users/$userId) calls — it passes the User.id, not the
   * handle. Separate from getProfile / getUserByHandle so privilege & visibility
   * rules stay honest and route-confusion (handle-vs-UUID) disappears.
   */
  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        handle: true,
        name: true,
        avatar: true,
        bio: true,
        website: true,
        location: true,
        publication: true,
        role: true,
        isActive: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [followerCount, followingCount] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: user.id } }),
      this.prisma.follow.count({ where: { followerId: user.id } }),
    ]);

    return {
      ...user,
      followerCount,
      followingCount,
    };
  }

  async getUserByHandle(handle: string) {
    const user = await this.prisma.user.findUnique({
      where: { handle },
      select: {
        id: true,
        handle: true,
        name: true,
        avatar: true,
        bio: true,
        website: true,
        location: true,
        publication: true,
        role: true,
        createdAt: true,
        settings: true,
        articles: {
          where: { isPublished: true },
          select: { id: true, title: true, slug: true, cover: true, readMinutes: true, likesCount: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const followerCount = await this.prisma.follow.count({
      where: { followingId: user.id },
    });

    const followingCount = await this.prisma.follow.count({
      where: { followerId: user.id },
    });

    return {
      ...user,
      followerCount,
      followingCount,
      articleCount: user.articles.length,
    };
  }

  async updateUser(userId: string, dto: UpdateUserDto) {
    if (dto.handle) {
      const existingUser = await this.prisma.user.findFirst({
        where: { handle: dto.handle, id: { not: userId } },
      });

      if (existingUser) {
        throw new BadRequestException('Handle already taken');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true, email: true, handle: true, name: true, avatar: true, bio: true,
        website: true, location: true, publication: true, role: true, isActive: true,
        emailVerified: true, createdAt: true, updatedAt: true,
      },
    });

    return user;
  }

  async updateSettings(userId: string, dto: UpdateUserSettingsDto) {
    const settings = await this.prisma.userSettings.update({
      where: { userId },
      data: dto,
    });

    return settings;
  }

  async getSettings(userId: string) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      throw new NotFoundException('Settings not found');
    }

    return settings;
  }

  async searchUsers(query: string, limit = 10) {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { handle: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
        isActive: true,
      },
      select: {
        id: true,
        handle: true,
        name: true,
        avatar: true,
        bio: true,
      },
      take: limit,
    });

    return users;
  }

  async deleteUser(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return { message: 'Account deactivated successfully' };
  }
}