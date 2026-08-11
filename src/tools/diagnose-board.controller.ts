import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import { ContextoDeTablero } from '../diagnostics/rules/rule.types';
import { MondayApiClient, PresupuestoAgotadoError } from '../monday/monday-api.client';
import { MondayClaims, MondayJwtGuard } from '../monday/monday-jwt.guard';

/**
 * Run URL del bloque de accion "Diagnosticar tablero".
 *
 * Restricciones duras de un Sidekick tool, confirmadas en la documentacion:
 *  - solo bloques de accion en tiempo real, sincronos
 *  - un solo bloque por invocacion
 *  - hay que responder rapido o se rompe la conversacion
 *
 * monday reintenta durante 30 minutos si respondemos algo distinto de 200 o si
 * tardamos mas de un minuto. Por eso los errores esperables (presupuesto
 * agotado, tablero inaccesible) se responden con 200 y un mensaje para el
 * usuario: no son fallos nuestros y reintentarlos 30 minutos no arregla nada.
 */
@Controller('tools')
export class DiagnoseBoardController {
  private readonly log = new Logger(DiagnoseBoardController.name);

  constructor(
    private readonly api: MondayApiClient,
    private readonly diagnostics: DiagnosticsService,
    private readonly config: ConfigService,
  ) {}

  @Post('diagnose-board')
  @UseGuards(MondayJwtGuard)
  async diagnosticar(
    @Body() body: CuerpoDeAccion,
    @Req() req: Request & { monday: MondayClaims },
  ): Promise<{ severityCode?: number; runtimeMetadata?: unknown; output: Salida }> {
    const t0 = Date.now();
    const boardId = String(body?.payload?.inputFields?.boardId ?? '');
    if (!boardId) {
      return { output: { ok: false, mensaje: 'No entendi de que tablero hablas. Dime el nombre del tablero.' } };
    }

    const limite = Number(this.config.get('LIVE_SCAN_LIMIT') ?? 500);

    try {
      const lectura = await this.api.leerTablero(req.monday.shortLivedToken, boardId, limite);

      const ctx: ContextoDeTablero = {
        boardId: lectura.boardId,
        etiquetasCerradas: ['Listo', 'Done', 'Completado', 'Terminado'],
        diasParaEstancado: 30,
        ahora: new Date(),
      };

      const d = this.diagnostics.analizar(lectura.items, ctx);
      const ms = Date.now() - t0;
      this.log.log(`diagnose-board board=${boardId} items=${d.itemsAnalizados} ms=${ms} api=${lectura.msApi}`);

      return {
        output: {
          ok: true,
          tablero: lectura.nombre,
          puntaje: d.puntaje,
          itemsAnalizados: d.itemsAnalizados,
          // Honestidad de cobertura: si no leimos todo, se dice. Callarlo es la
          // via rapida a que alguien confie en un diagnostico incompleto.
          cobertura: lectura.parcial
            ? `Analice los primeros ${d.itemsAnalizados} de ${lectura.totalEnTablero} items`
            : 'Analice el tablero completo',
          hallazgos: d.hallazgos.slice(0, 5).map((h) => ({
            tipo: h.regla, severidad: h.severidad, resumen: h.resumen, items: h.itemIds.length,
          })),
          totalHallazgos: d.hallazgos.length,
        },
      };
    } catch (e) {
      if (e instanceof PresupuestoAgotadoError) {
        return { output: { ok: false, mensaje: 'Tu cuenta de monday agoto su cuota de API por este minuto. Intentalo de nuevo en un momento.' } };
      }
      this.log.error(`diagnose-board fallo board=${boardId}: ${(e as Error).message}`);
      return { output: { ok: false, mensaje: 'No pude leer ese tablero. Revisa que exista y que la app tenga acceso.' } };
    }
  }
}

interface CuerpoDeAccion {
  payload?: {
    blockKind?: string;
    inputFields?: Record<string, unknown>;
    inboundFieldValues?: Record<string, unknown>;
    recipeId?: number;
    integrationId?: number;
  };
  runtimeMetadata?: { actionUuid?: string; triggerUuid?: string };
}

type Salida =
  | { ok: false; mensaje: string }
  | {
      ok: true; tablero: string; puntaje: number; itemsAnalizados: number; cobertura: string;
      hallazgos: Array<{ tipo: string; severidad: string; resumen: string; items: number }>;
      totalHallazgos: number;
    };
