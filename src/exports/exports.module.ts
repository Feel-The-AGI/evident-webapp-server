import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { UsersModule } from '../users/users.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [UsersModule, LogsModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
