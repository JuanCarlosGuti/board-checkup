import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import { ContextoDeTablero } from '../diagnostics/rules/rule.types';
import { MondayApiClient, PresupuestoAgotadoError } from '../monday/monday-api.client';
import { MondayClaims, MondayJwtGuard } from '../monday/monday-jwt.guard';

/**
 * Run URL del bloque de accion "Diagnose board".
 *
 * Registrado en el Developer Center como:
 *   clave unica  crearcodecesars-team_board-checkup:diagnose_board
 *   entrada      boardId  (campo de tipo Board de monday, campo principal)
 *   salida       resumen  (Cadena)
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
    const campos = body?.payload?.inputFields ?? {};
    const texto = aplanarReferenciaDeTablero(campos.boardId ?? campos.boardName ?? campos.board);

    if (!texto) {
      return fallo('No entendi de que tablero hablas. Dime el nombre del tablero.');
    }

    const limite = Number(this.config.get('LIVE_SCAN_LIMIT') ?? 500);
    const token = req.monday.shortLivedToken;

    try {
      // Los usuarios dicen "el tablero de Marketing", no un id. Si viene un id
      // numerico lo usamos tal cual; si no, lo resolvemos por nombre.
      let boardId = texto;
      if (!/^\d+$/.test(texto)) {
        const r = await this.api.resolverTablero(token, texto);
        if (r.ambiguos) {
          const nombres = r.ambiguos.map((b) => `"${b.name}"`).join(', ');
          return fallo(`Hay varios tableros que encajan: ${nombres}. Cual de ellos?`);
        }
        if (!r.encontrado) {
          return fallo(`No encontre ningun tablero llamado "${texto}".`);
        }
        boardId = r.encontrado.id;
      }

      const lectura = await this.api.leerTablero(token, boardId, limite);

      // Las columnas se descubren por tipo, no por nombre: el tablero de un
      // cliente puede tener la columna de estado llamada "Fase" o "Pipeline".
      const porTipo = (...tipos: string[]) => lectura.columnas.find((c) => tipos.includes(c.type))?.id;

      const ctx: ContextoDeTablero = {
        boardId: lectura.boardId,
        columnaEstado: porTipo('status'),
        columnaResponsable: porTipo('people', 'person'),
        columnaFecha: porTipo('date'),
        etiquetasCerradas: ['Listo', 'Done', 'Completado', 'Terminado', 'Hecho', 'Finalizado'],
        diasParaEstancado: 30,
        ahora: new Date(),
      };

      const d = this.diagnostics.analizar(lectura.items, ctx);
      const ms = Date.now() - t0;
      this.log.log(`diagnose-board board=${lectura.boardId} items=${d.itemsAnalizados} ms=${ms} api=${lectura.msApi}`);

      const hallazgos = d.hallazgos.slice(0, 5).map((h) => ({
        tipo: h.regla, severidad: h.severidad, resumen: h.resumen, items: h.itemIds.length,
      }));

      // Honestidad de cobertura: si no leimos todo, se dice. Callarlo es la
      // via rapida a que alguien confie en un diagnostico incompleto.
      const cobertura = lectura.parcial
        ? `Analice los primeros ${d.itemsAnalizados} de ${lectura.totalEnTablero} items`
        : 'Analice el tablero completo';

      const parcial = {
        ok: true as const,
        tablero: lectura.nombre,
        puntaje: d.puntaje,
        itemsAnalizados: d.itemsAnalizados,
        cobertura,
        hallazgos,
        totalHallazgos: d.hallazgos.length,
      };

      return { output: { ...parcial, resumen: redactarResumen(parcial) } };
    } catch (e) {
      if (e instanceof PresupuestoAgotadoError) {
        return fallo('Tu cuenta de monday agoto su cuota de API por este minuto. Intentalo de nuevo en un momento.');
      }
      this.log.error(`diagnose-board fallo tablero="${texto}": ${(e as Error).message}`);
      return fallo('No pude leer ese tablero. Revisa que exista y que la app tenga acceso.');
    }
  }
}

/**
 * monday entrega el campo de tipo Board de varias formas segun el contexto:
 * a veces el id pelado ("123"), a veces un numero, a veces un objeto con el id
 * adentro. Sin aplanar, String({id:123}) produce "[object Object]", que luego
 * se busca como si fuera el nombre de un tablero y falla con un mensaje
 * desconcertante. Aplanamos antes de decidir nada.
 */
function aplanarReferenciaDeTablero(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  if (Array.isArray(v)) return v.length ? aplanarReferenciaDeTablero(v[0]) : '';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const clave of ['id', 'boardId', 'linkedPulseId', 'value']) {
      const x = o[clave];
      if (typeof x === 'string' || typeof x === 'number') return String(x).trim();
    }
    if (typeof o.name === 'string') return o.name.trim();
  }
  return '';
}

/**
 * Sidekick es un modelo de lenguaje leyendo campos de salida, y los campos de
 * salida de monday son escalares: un arreglo de objetos no le llega nunca. El
 * reporte estructurado se conserva para la vista de tablero y las pruebas, pero
 * lo que Sidekick lee de verdad es este texto.
 */
function redactarResumen(s: {
  tablero: string; puntaje: number; cobertura: string;
  hallazgos: Array<{ severidad: string; resumen: string; items: number }>;
  totalHallazgos: number;
}): string {
  const lineas = [`Tablero "${s.tablero}": puntaje ${s.puntaje}/100.`, `${s.cobertura}.`];

  if (s.totalHallazgos === 0) {
    lineas.push('No encontre problemas de calidad de datos.');
    return lineas.join('\n');
  }

  lineas.push(`${s.totalHallazgos} hallazgo(s). Los mas importantes:`);
  for (const h of s.hallazgos) {
    lineas.push(`- [${h.severidad}] ${h.resumen} (${h.items} item(s))`);
  }
  const restantes = s.totalHallazgos - s.hallazgos.length;
  if (restantes > 0) lineas.push(`Y ${restantes} hallazgo(s) mas de menor severidad.`);

  return lineas.join('\n');
}

/** Todo fallo esperable sale con 200 y con el mensaje tambien en `resumen`. */
function fallo(mensaje: string): { output: Salida } {
  return { output: { ok: false, mensaje, resumen: mensaje } };
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
  | { ok: false; mensaje: string; resumen: string }
  | {
      ok: true; tablero: string; puntaje: number; itemsAnalizados: number; cobertura: string;
      hallazgos: Array<{ tipo: string; severidad: string; resumen: string; items: number }>;
      totalHallazgos: number; resumen: string;
    };
