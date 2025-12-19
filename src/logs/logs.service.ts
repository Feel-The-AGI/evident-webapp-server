import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLogDto, UpdateLogDto, LogSource } from './logs.dto';

@Injectable()
export class LogsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateLogDto) {
    return this.prisma.log.create({
      data: {
        userId,
        date: new Date(dto.date),
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        activityType: dto.activityType,
        description: dto.description,
        reference: dto.reference,
        source: dto.source || LogSource.WEB,
        syncedAt: new Date(),
      },
    });
  }

  async syncLogs(userId: string, logs: CreateLogDto[]) {
    const created = await Promise.all(
      logs.map(log => this.create(userId, log))
    );
    return { synced: created.length, logs: created };
  }

  async findToday(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.log.findMany({
      where: {
        userId,
        date: { gte: today, lt: tomorrow },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findThisWeek(userId: string) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);

    return this.prisma.log.findMany({
      where: {
        userId,
        date: { gte: monday, lt: sunday },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  async findLastWeek(userId: string) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    thisMonday.setHours(0, 0, 0, 0);
    
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    return this.prisma.log.findMany({
      where: {
        userId,
        date: { gte: lastMonday, lt: thisMonday },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  async findByDateRange(userId: string, startDate: Date, endDate: Date) {
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 7) {
      throw new ForbiddenException('Date range cannot exceed 7 days');
    }

    return this.prisma.log.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  async update(userId: string, logId: string, dto: UpdateLogDto) {
    const log = await this.prisma.log.findFirst({
      where: { id: logId, userId },
    });

    if (!log) {
      throw new NotFoundException('Log not found');
    }

    return this.prisma.log.update({
      where: { id: logId },
      data: {
        ...(dto.startTime && { startTime: new Date(dto.startTime) }),
        ...(dto.endTime && { endTime: new Date(dto.endTime) }),
        ...(dto.activityType && { activityType: dto.activityType }),
        ...(dto.description && { description: dto.description }),
        ...(dto.reference !== undefined && { reference: dto.reference }),
      },
    });
  }

  async delete(userId: string, logId: string) {
    const log = await this.prisma.log.findFirst({
      where: { id: logId, userId },
    });

    if (!log) {
      throw new NotFoundException('Log not found');
    }

    await this.prisma.log.delete({ where: { id: logId } });
    return { deleted: true };
  }
}
