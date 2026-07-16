import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HighlightsService } from './highlights.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CreateHighlightDto, UpdateHighlightDto } from './dto/highlights.dto';

@ApiTags('Highlights')
@Controller('api/highlights')
export class HighlightsController {
  constructor(private highlightsService: HighlightsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CREATOR, Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Create a highlight' })
  @ApiResponse({ status: 201, description: 'Highlight created' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async createHighlight(@Request() req: any, @Body() dto: CreateHighlightDto) {
    return this.highlightsService.createHighlight(req.user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a highlight by ID' })
  @ApiResponse({ status: 200, description: 'Highlight found' })
  @ApiResponse({ status: 404, description: 'Highlight not found' })
  async getHighlight(@Param('id') id: string, @Request() req?: any) {
    const userId = req?.user?.id;
    return this.highlightsService.getHighlight(id, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get highlights list' })
  @ApiResponse({ status: 200, description: 'Highlights retrieved' })
  async getHighlights(@Query('page') page?: number, @Query('limit') limit?: number, @Request() req?: any) {
    const userId = req?.user?.id;
    return this.highlightsService.getHighlights(page, limit, userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CREATOR, Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Update a highlight' })
  @ApiResponse({ status: 200, description: 'Highlight updated' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async updateHighlight(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateHighlightDto) {
    return this.highlightsService.updateHighlight(req.user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CREATOR, Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a highlight' })
  @ApiResponse({ status: 200, description: 'Highlight deleted' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async deleteHighlight(@Request() req: any, @Param('id') id: string) {
    return this.highlightsService.deleteHighlight(req.user.id, id);
  }
}