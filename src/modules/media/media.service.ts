import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MediaType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MediaService {
  constructor(private prisma: PrismaService) {}

  async uploadMedia(userId: string, file: any) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/mov', 'video/webm'];
    
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 50MB');
    }

    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
    const storagePath = path.join(process.cwd(), 'uploads', filename);
    
    if (!fs.existsSync(path.join(process.cwd(), 'uploads'))) {
      fs.mkdirSync(path.join(process.cwd(), 'uploads'), { recursive: true });
    }

    fs.writeFileSync(storagePath, file.buffer);

    const url = `/uploads/${filename}`;
    const type = file.mimetype.startsWith('image') ? MediaType.IMAGE : MediaType.VIDEO;

    const media = await this.prisma.media.create({
      data: {
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        type,
        url,
        uploadedBy: userId,
      },
    });

    return media;
  }

  async getMedia(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      throw new BadRequestException('Media not found');
    }
    return media;
  }

  async getUserMedia(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [media, total] = await Promise.all([
      this.prisma.media.findMany({
        where: { uploadedBy: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.media.count({ where: { uploadedBy: userId } }),
    ]);

    return { data: media, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async deleteMedia(userId: string, id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });

    if (!media) {
      throw new BadRequestException('Media not found');
    }

    if (media.uploadedBy !== userId) {
      throw new BadRequestException('You can only delete your own media');
    }

    const filePath = path.join(process.cwd(), 'uploads', media.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.prisma.media.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Media deleted successfully' };
  }
}