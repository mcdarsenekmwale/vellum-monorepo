import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Categories')
@Controller('api/categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved' })
  async getAllCategories() {
    return this.categoriesService.getAllCategories();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get category by slug' })
  @ApiResponse({ status: 200, description: 'Category found' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getCategoryBySlug(@Param('slug') slug: string) {
    return this.categoriesService.getCategoryBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Create a category' })
  @ApiResponse({ status: 201, description: 'Category created' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async createCategory(@Body() body: { name: string; tint?: string }) {
    return this.categoriesService.createCategory(body.name, body.tint);
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a category' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async deleteCategory(@Param('slug') slug: string) {
    return this.categoriesService.deleteCategory(slug);
  }
}