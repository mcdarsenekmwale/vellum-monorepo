import { Controller, Get, Post, Delete, Param, Query, UseGuards, Request, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Media')
@Controller('api/media')
export class MediaController {
  constructor(private mediaService: MediaService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload media file' })
  @ApiResponse({ status: 201, description: 'Media uploaded' })
  async uploadMedia(@Request() req: any, @UploadedFile() file: any) {
    return this.mediaService.uploadMedia(req.user.id, file);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get media by ID' })
  @ApiResponse({ status: 200, description: 'Media found' })
  async getMedia(@Param('id') id: string) {
    return this.mediaService.getMedia(id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user media' })
  @ApiResponse({ status: 200, description: 'Media retrieved' })
  async getUserMedia(@Param('userId') userId: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.mediaService.getUserMedia(userId, page, limit);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete media' })
  @ApiResponse({ status: 200, description: 'Media deleted' })
  async deleteMedia(@Request() req: any, @Param('id') id: string) {
    return this.mediaService.deleteMedia(req.user.id, id);
  }
}