import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { LogsService } from './logs.service';
import { CreateLogDto, UpdateLogDto, SyncLogsDto } from './logs.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('logs')
@UseGuards(JwtAuthGuard)
export class LogsController {
  constructor(private logsService: LogsService) {}

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateLogDto,
  ) {
    return this.logsService.create(user.id, dto);
  }

  @Post('sync')
  async sync(
    @CurrentUser() user: { id: string },
    @Body() dto: SyncLogsDto,
  ) {
    return this.logsService.syncLogs(user.id, dto.logs);
  }

  @Get('today')
  async getToday(@CurrentUser() user: { id: string }) {
    return this.logsService.findToday(user.id);
  }

  @Get('this-week')
  async getThisWeek(@CurrentUser() user: { id: string }) {
    return this.logsService.findThisWeek(user.id);
  }

  @Get('last-week')
  async getLastWeek(@CurrentUser() user: { id: string }) {
    return this.logsService.findLastWeek(user.id);
  }

  @Get('range')
  async getByRange(
    @CurrentUser() user: { id: string },
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.logsService.findByDateRange(
      user.id,
      new Date(start),
      new Date(end),
    );
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateLogDto,
  ) {
    return this.logsService.update(user.id, id, dto);
  }

  @Delete(':id')
  async delete(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.logsService.delete(user.id, id);
  }
}
