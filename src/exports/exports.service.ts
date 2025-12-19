import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LogsService } from '../logs/logs.service';
import { GenerateExportDto, ExportFormat } from './exports.dto';
import PDFDocument from 'pdfkit';

@Injectable()
export class ExportsService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private logsService: LogsService,
  ) {}

  async generate(userId: string, dto: GenerateExportDto) {
    const canExport = await this.usersService.canExport(userId);
    if (!canExport.allowed) {
      throw new ForbiddenException(canExport.reason);
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const format = dto.format || ExportFormat.TEXT;

    const logs = await this.logsService.findByDateRange(userId, startDate, endDate);
    const textContent = this.generateTextSummary(logs, startDate, endDate);

    const exportRecord = await this.prisma.export.create({
      data: {
        userId,
        startDate,
        endDate,
        format,
        textContent,
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.subscriptionStatus === 'TRIAL') {
      await this.usersService.markTrialExportUsed(userId);
    }
    await this.usersService.incrementExportCount(userId);

    return {
      id: exportRecord.id,
      format,
      textContent,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      logCount: logs.length,
    };
  }

  async getHistory(userId: string) {
    return this.prisma.export.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        format: true,
        createdAt: true,
      },
    });
  }

  private generateTextSummary(logs: any[], startDate: Date, endDate: Date): string {
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit', hour12: false 
    });

    let output = `WORK SUMMARY\n`;
    output += `${formatDate(startDate)} – ${formatDate(endDate)}\n`;
    output += `${'─'.repeat(50)}\n\n`;

    if (logs.length === 0) {
      output += 'No logs recorded for this period.\n';
      return output;
    }

    const groupedByDate = logs.reduce((acc, log) => {
      const dateKey = new Date(log.date).toDateString();
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(log);
      return acc;
    }, {} as Record<string, any[]>);

    for (const [dateKey, dayLogs] of Object.entries(groupedByDate)) {
      const date = new Date(dateKey);
      output += `${formatDate(date)}\n`;
      output += `${'─'.repeat(30)}\n`;

      for (const log of dayLogs as any[]) {
        const start = formatTime(new Date(log.startTime));
        const end = formatTime(new Date(log.endTime));
        const activity = log.activityType.charAt(0) + log.activityType.slice(1).toLowerCase();
        
        output += `${start} – ${end}  [${activity}]\n`;
        output += `  ${log.description}\n`;
        if (log.reference) {
          output += `  Ref: ${log.reference}\n`;
        }
        output += '\n';
      }
      output += '\n';
    }

    output += `${'─'.repeat(50)}\n`;
    output += `Generated with Evident\n`;

    return output;
  }

  async generatePdfBuffer(userId: string, dto: GenerateExportDto): Promise<Buffer> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const logs = await this.logsService.findByDateRange(userId, startDate, endDate);

    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit', hour12: false 
    });

    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(20).font('Helvetica-Bold').text('Work Summary', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text(`${formatDate(startDate)} – ${formatDate(endDate)}`, { align: 'center' });
      doc.moveDown(2);

      if (logs.length === 0) {
        doc.text('No logs recorded for this period.');
      } else {
        const groupedByDate = logs.reduce((acc, log) => {
          const dateKey = new Date(log.date).toDateString();
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push(log);
          return acc;
        }, {} as Record<string, any[]>);

        for (const [dateKey, dayLogs] of Object.entries(groupedByDate)) {
          const date = new Date(dateKey);
          doc.fontSize(14).font('Helvetica-Bold').text(formatDate(date));
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown(0.5);

          for (const log of dayLogs as any[]) {
            const start = formatTime(new Date(log.startTime));
            const end = formatTime(new Date(log.endTime));
            const activity = log.activityType.charAt(0) + log.activityType.slice(1).toLowerCase();
            
            doc.fontSize(11).font('Helvetica-Bold').text(`${start} – ${end}  [${activity}]`, { continued: false });
            doc.fontSize(11).font('Helvetica').text(`  ${log.description}`);
            if (log.reference) {
              doc.fontSize(10).fillColor('#666666').text(`  Ref: ${log.reference}`);
              doc.fillColor('#000000');
            }
            doc.moveDown(0.5);
          }
          doc.moveDown();
        }
      }

      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#888888').text('Generated with Evident', { align: 'center' });

      doc.end();
    });
  }

  async generatePdfHtml(userId: string, dto: GenerateExportDto): Promise<string> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const logs = await this.logsService.findByDateRange(userId, startDate, endDate);

    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit', hour12: false 
    });

    const groupedByDate = logs.reduce((acc, log) => {
      const dateKey = new Date(log.date).toDateString();
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(log);
      return acc;
    }, {} as Record<string, any[]>);

    let logsHtml = '';
    for (const [dateKey, dayLogs] of Object.entries(groupedByDate)) {
      const date = new Date(dateKey);
      logsHtml += `<div class="day-header">${formatDate(date)}</div>`;
      
      for (const log of dayLogs as any[]) {
        const start = formatTime(new Date(log.startTime));
        const end = formatTime(new Date(log.endTime));
        const activity = log.activityType.charAt(0) + log.activityType.slice(1).toLowerCase();
        
        logsHtml += `
          <div class="log-entry">
            <div class="time-block">${start} – ${end}</div>
            <div class="activity-pill">${activity}</div>
            <div class="description">${log.description}</div>
            ${log.reference ? `<div class="reference">Ref: ${log.reference}</div>` : ''}
          </div>
        `;
      }
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
    .header { margin-bottom: 30px; }
    .title { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
    .date-range { font-size: 14px; color: #666; }
    .day-header { font-size: 16px; font-weight: 600; margin: 24px 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; }
    .log-entry { margin-bottom: 16px; padding-left: 16px; }
    .time-block { font-family: monospace; font-size: 13px; color: #333; display: inline-block; }
    .activity-pill { display: inline-block; background: #f0f0f0; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 12px; }
    .description { margin-top: 4px; font-size: 14px; }
    .reference { font-size: 12px; color: #888; margin-top: 2px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Work Summary</div>
    <div class="date-range">${formatDate(startDate)} – ${formatDate(endDate)}</div>
  </div>
  ${logs.length === 0 ? '<p>No logs recorded for this period.</p>' : logsHtml}
  <div class="footer">Generated with Evident</div>
</body>
</html>`;
  }
}
