import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        subscriptionStatus: true,
        exportCount: true,
        trialExportUsed: true,
        createdAt: true,
      },
    });
    return user;
  }

  async canExport(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    if (user.subscriptionStatus === 'ACTIVE') {
      return { allowed: true };
    }

    if (user.subscriptionStatus === 'TRIAL' && !user.trialExportUsed) {
      return { allowed: true };
    }

    return { 
      allowed: false, 
      reason: 'Exporting summaries requires a subscription.' 
    };
  }

  async markTrialExportUsed(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { trialExportUsed: true },
    });
  }

  async incrementExportCount(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { exportCount: { increment: 1 } },
    });
  }
}
