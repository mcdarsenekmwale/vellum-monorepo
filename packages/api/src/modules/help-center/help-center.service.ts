import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  CreateTicketDto,
  CreateTicketMessageDto,
  TicketCategory,
  TicketStatusFilter,
} from './dto/help-center.dto';
import {
  store,
  FaqItemShape,
  UserTicketShape,
  UserTicketMessageShape,
} from '../shared/store';

@Injectable()
export class HelpCenterService {
  private readonly logger = new Logger(HelpCenterService.name);

  constructor(private prisma: PrismaService) {}

  async listFaqs(params: {
    category?: string;
    search?: string;
    page: number;
    perPage: number;
  }) {
    const dbItems = await this.tryListFaqsFromDb(params);
    if (dbItems) return dbItems;
    return store.listFaqs(params);
  }

  private async tryListFaqsFromDb(params: {
    category?: string;
    search?: string;
    page: number;
    perPage: number;
  }): Promise<{
    items: FaqItemShape[];
    total: number;
    page: number;
    perPage: number;
  } | null> {
    try {
      const where: any = {};
      if (params.category) {
        where.category = {
          equals: params.category,
          mode: 'insensitive',
        };
      }
      if (params.search) {
        where.OR = [
          { question: { contains: params.search, mode: 'insensitive' } },
          { answer: { contains: params.search, mode: 'insensitive' } },
        ];
      }
      const [total, rows] = await Promise.all([
        (this.prisma as any).faqItem.count({ where }),
        (this.prisma as any).faqItem.findMany({
          where,
          skip: (params.page - 1) * params.perPage,
          take: params.perPage,
          orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
          select: {
            id: true,
            category: true,
            question: true,
            answer: true,
            updatedAt: true,
          },
        }),
      ]);
      const items: FaqItemShape[] = rows.map((r: any) => ({
        id: r.id,
        category: r.category,
        question: r.question,
        answer: r.answer,
        updatedAt: new Date(r.updatedAt).toISOString(),
      }));
      return { items, total, page: params.page, perPage: params.perPage };
    } catch (e) {
      return null;
    }
  }

  private async ensureFaqsSeededInDb(): Promise<void> {
    try {
      const count = await (this.prisma as any).faqItem.count();
      if (count > 0) return;
      const now = new Date();
      const seed = store.listFaqs({ page: 1, perPage: 100 });
      const data = seed.items.map((f) => ({
        id: f.id,
        category: f.category,
        question: f.question,
        answer: f.answer,
        updatedAt: now,
        createdAt: now,
      }));
      await (this.prisma as any).faqItem.createMany({ data });
    } catch {}
  }

  async onApplicationBootstrap() {
    try {
      await this.ensureFaqsSeededInDb();
    } catch {}
  }

  private async resolveUserName(userId: string): Promise<string> {
    try {
      const u = await (this.prisma as any).user?.findUnique({
        where: { id: userId },
        select: { name: true, handle: true },
      });
      return u?.name || u?.handle || 'User';
    } catch {
      return 'User';
    }
  }

  listTickets(params: {
    ownerId: string;
    status: TicketStatusFilter;
    page: number;
    perPage: number;
  }) {
    return store.listTickets({
      ownerId: params.ownerId,
      status: params.status,
      page: params.page,
      perPage: params.perPage,
    });
  }

  getTicket(ownerId: string, ticketId: string) {
    const t = store.getTicket(ticketId);
    if (!t) throw new NotFoundException('Ticket not found');
    if (t.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this ticket');
    }
    return t;
  }

  async createTicket(
    ownerId: string,
    dto: CreateTicketDto,
  ): Promise<UserTicketShape> {
    const subject = dto.subject.trim();
    const body = dto.body.trim();
    if (subject.length < 3 || subject.length > 120) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: {
          subject:
            'subject must be between 3 and 120 characters (after trimming)',
        },
      });
    }
    if (body.length < 10 || body.length > 2000) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: {
          body: 'body must be between 10 and 2000 characters (after trimming)',
        },
      });
    }
    const categories: TicketCategory[] = [
      'General',
      'Account',
      'Technical',
      'Billing',
      'Safety',
    ];
    if (!categories.includes(dto.category)) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: {
          category:
            'category must be one of: General, Account, Technical, Billing, Safety',
        },
      });
    }

    const ownerName = await this.resolveUserName(ownerId);
    const created = store.createTicket({
      ownerId,
      ownerName,
      category: dto.category,
      subject,
      body,
    });
    return created;
  }

  async addTicketMessage(
    ownerId: string,
    ticketId: string,
    dto: CreateTicketMessageDto,
  ): Promise<UserTicketMessageShape> {
    const body = dto.body.trim();
    if (body.length < 1 || body.length > 2000) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: {
          body: 'body must be between 1 and 2000 characters (after trimming)',
        },
      });
    }
    const t = store.getTicket(ticketId);
    if (!t) throw new NotFoundException('Ticket not found');
    if (t.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this ticket');
    }
    const authorName = await this.resolveUserName(ownerId);
    const msg = store.addMessage({
      ticketId,
      authorId: ownerId,
      authorName,
      body,
    });
    if (!msg) throw new NotFoundException('Ticket not found');
    return msg;
  }
}
