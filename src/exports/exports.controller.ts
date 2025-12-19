import { Controller, Post, Get, Body, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExportsService } from './exports.service';
import { GenerateExportDto, ExportFormat } from './exports.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import puppeteer from 'puppeteer';

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
    const html = await this.exportsService.generatePdfHtml(user.id, dto);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    });
    
    await browser.close();

    const startDate = new Date(dto.startDate).toISOString().split('T')[0];
    const endDate = new Date(dto.endDate).toISOString().split('T')[0];
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="evident-summary-${startDate}-to-${endDate}.pdf"`,
    });
    
    res.send(pdf);

    await this.exportsService.generate(user.id, { ...dto, format: ExportFormat.PDF });
  }

  @Get('history')
  async getHistory(@CurrentUser() user: { id: string }) {
    return this.exportsService.getHistory(user.id);
  }
}
