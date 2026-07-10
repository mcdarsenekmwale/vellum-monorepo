import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async getAllCategories() {
    return this.prisma.retryOnConnectionError(() => this.prisma.category.findMany());
  }

  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.retryOnConnectionError(() =>
      this.prisma.category.findUnique({
        where: { slug },
        include: {
          articles: {
            where: { isPublished: true },
            include: {
              author: { select: { id: true, handle: true, name: true, avatar: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      })
    );

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async createCategory(name: string, tint?: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    return this.prisma.category.create({
      data: { name, slug, tint: tint || '#e5e5e5' },
    });
  }

  async deleteCategory(slug: string) {
    await this.prisma.category.delete({ where: { slug } });
    return { message: 'Category deleted successfully' };
  }
}