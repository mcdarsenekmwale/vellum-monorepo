import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TicketStatus, TicketPriority, TicketType } from '@prisma/client';

@ApiTags('Help Center')
@Controller('api/help')
export class HelpController {
  constructor(private supportService: SupportService) {}

  // ─── Knowledge Base (Public) ─────────────────────────────────────────────

  @Get('kb/articles')
  @ApiOperation({ summary: 'List published KB articles (public)' })
  async listKbArticles(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.supportService.listKbArticles({
      category,
      search,
      published: true,
    });
  }

  @Get('kb/articles/:slug')
  @ApiOperation({ summary: 'Get KB article by slug (public)' })
  async getKbArticle(@Param('slug') slug: string) {
    return this.supportService.getKbArticleBySlug(slug);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List ticket categories (public)' })
  async listCategories() {
    return this.supportService.listCategories();
  }

  // ─── User Tickets (Authenticated) ────────────────────────────────────────

  @Get('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List my tickets' })
  async listMyTickets(
    @Req() req: { user: { id: string } },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: TicketStatus,
  ) {
    return this.supportService.listMyTickets(req.user.id, { page, limit, status });
  }

  @Get('tickets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get my ticket detail' })
  async getMyTicket(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.supportService.getMyTicket(req.user.id, id);
  }

  @Post('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a support ticket' })
  async createTicket(
    @Body() body: {
      subject: string;
      message: string;
      description?: string;
      type?: TicketType;
      priority?: TicketPriority;
      categoryId?: string;
    },
    @Req() req: { user: { id: string } },
  ) {
    return this.supportService.createTicket(req.user.id, body);
  }

  @Post('tickets/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Reply to my ticket' })
  async addMessage(
    @Param('id') id: string,
    @Body() body: { body: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.supportService.addMessageToMyTicket(req.user.id, id, body.body);
  }
}
