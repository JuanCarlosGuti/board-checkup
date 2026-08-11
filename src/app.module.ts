import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { MondayModule } from './monday/monday.module';
import { ToolsModule } from './tools/tools.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MondayModule, DiagnosticsModule, ToolsModule],
  controllers: [AppController],
})
export class AppModule {}
