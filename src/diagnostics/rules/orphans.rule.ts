import { diasDesde, estaCerrado, valor } from './helpers';
import { ContextoDeTablero, Hallazgo, ItemDeTablero, Regla } from './rule.types';

/**
 * Items huerfanos: abiertos, sin responsable, sin fecha limite y sin ninguna
 * actualizacion desde hace mas del umbral de estancamiento.
 *
 * Es la interseccion de tres senales que por separado ya tienen regla. Juntas
 * significan otra cosa: nadie es dueno, nada lo va a vencer y nadie lo ha
 * tocado. Ese item no esta atrasado ni olvidado; esta muerto, y seguira
 * contando como "trabajo pendiente" en cada dashboard hasta que alguien lo
 * archive. Por eso se reporta aparte y con severidad alta: es lo primero que
 * conviene limpiar.
 */
export class ReglaHuerfanos implements Regla {
  readonly id = 'huerfanos';
  readonly peso = 2;

  evaluar(items: ItemDeTablero[], ctx: ContextoDeTablero): Hallazgo[] {
    // sin columna de personas o de fecha no se puede afirmar que a nadie le importa
    if (!ctx.columnaResponsable || !ctx.columnaFecha) return [];

    const huerfanos = items.filter(
      (i) =>
        !estaCerrado(i, ctx) &&
        !valor(i, ctx.columnaResponsable) &&
        !valor(i, ctx.columnaFecha) &&
        diasDesde(i.updatedAt, ctx.ahora) >= ctx.diasParaEstancado,
    );
    if (huerfanos.length === 0) return [];

    const peor = Math.max(...huerfanos.map((i) => diasDesde(i.updatedAt, ctx.ahora)));
    return [{
      regla: this.id,
      severidad: 'alta',
      itemIds: huerfanos.map((i) => i.id),
      resumen: `${huerfanos.length} items huerfanos: sin responsable, sin fecha y sin movimiento hace mas de ${ctx.diasParaEstancado} dias (el mas viejo, ${peor})`,
    }];
  }
}
