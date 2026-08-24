import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { HelpCenterService } from './help-center.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ListFaqsQuery,
  ListTicketsQuery,
  CreateTicketDto,
  CreateTicketMessageDto,
} from './dto/help-center.dto';

@ApiTags('Help Center (v1)')
@Controller('api/v1/help')
export class HelpCenterController {
  constructor(private readonly helpCenterService: HelpCenterService) {}

  @Get('faqs')
  @ApiOperation({ summary: 'List FAQs (public) with category filter and search' })
  @ApiResponse({ status: 200, description: 'Paginated FAQs' })
  async listFaqs(@Query() query: ListFaqsQuery) {
    const page = Number(query.page) || 1;
    const perPage = Number(query.perPage) || 12;
    return this.helpCenterService.listFaqs({
      category: query.category,
      search: query.search,
      page,
      perPage,
    });
  }

  @Get('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List current user's support tickets" })
  @ApiResponse({ status: 200, description: "User's tickets" })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listTickets(
    @Req() req: { user: { id: string } },
    @Query() query: ListTicketsQuery,
  ) {
    const page = Number(query.page) || 1;
    const perPage = Number(query.perPage) || 20;
    const status = query.status ?? 'all';
    return this.helpCenterService.listTickets({
      ownerId: req.user.id,
      status,
      page,
      perPage,
    });
  }

  @Get('tickets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get ticket detail (owner only) including messages" })
  @ApiResponse({ status: 200, description: 'Ticket with messages' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the owner' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getTicket(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.helpCenterService.getTicket(req.user.id, id);
  }

  @Post('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new support ticket' })
  @ApiResponse({ status: 201, description: 'Ticket created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createTicket(
    @Req() req: { user: { id: string } },
    @Body() dto: CreateTicketDto,
  ) {
    return this.helpCenterService.createTicket(req.user.id, dto);
  }

  @Post('tickets/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(201)
  @ApiOperation({ summary: 'Add message to ticket (owner only)' })
  @ApiResponse({ status: 201, description: 'Message added' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the owner' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async addMessage(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: CreateTicketMessageDto,
  ) {
    return this.helpCenterService.addTicketMessage(req.user.id, id, dto);
  }
}
