import { Module } from '@nestjs/common';
import { MondayApiClient } from './monday-api.client';
import { MondayJwtGuard } from './monday-jwt.guard';

@Module({
  providers: [MondayApiClient, MondayJwtGuard],
  exports: [MondayApiClient, MondayJwtGuard],
})
export class MondayModule {}
