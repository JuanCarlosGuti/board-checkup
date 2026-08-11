import { Module } from '@nestjs/common';
import { DiagnosticsModule } from '../diagnostics/diagnostics.module';
import { MondayModule } from '../monday/monday.module';
import { DiagnoseBoardController } from './diagnose-board.controller';

@Module({ imports: [MondayModule, DiagnosticsModule], controllers: [DiagnoseBoardController] })
export class ToolsModule {}
