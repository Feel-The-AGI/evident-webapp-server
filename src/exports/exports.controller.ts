import { Controller, Post, Get, Body, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExportsService } from './exports.service';
import { GenerateExportDto, ExportFormat } from './exports.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import PDFDocument from 'pdfkit';

@Controller('exports')
@UseGuards(JwtAuthGuard)
export class ExportsController {
  constructor(private exportsService: ExportsService) {}

  @Post('generate')
  async generate(
    @CurrentUser() user: { id: string },
    @Body() dto: GenerateExportDto,
  ) {
    return this.exportsService.generate(user.id, dto);
  }

  @Post('pdf')
  async generatePdf(
    @CurrentUser() user: { id: string },
    @Body() dto: GenerateExportDto,
    @Res() res: Response,
  ) {
    const pdfData = await this.exportsService.generatePdfBuffer(user.id, dto);
    
    const startDate = new Date(dto.startDate).toISOString().split('T')[0];
    const endDate = new Date(dto.endDate).toISOString().split('T')[0];
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="evident-summary-${startDate}-to-${endDate}.pdf"`,
    });
    
    res.send(pdfData);

    await this.exportsService.generate(user.id, { ...dto, format: ExportFormat.PDF });
  }

  @Get('history')
  async getHistory(@CurrentUser() user: { id: string }) {
    return this.exportsService.getHistory(user.id);
  }
}
