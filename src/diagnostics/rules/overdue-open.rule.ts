import { diasDesde, estaCerrado, valor } from './helpers';
import { ContextoDeTablero, Hallazgo, ItemDeTablero, Regla } from './rule.types';

/**
 * Fecha limite en el pasado y el item sigue abierto. Es el tablero que miente:
 * el mas danino de todos, porque alguien esta tomando decisiones mirandolo.
 */
export class ReglaVencidoAbierto implements Regla {
  readonly id = 'vencido-abierto';
  readonly peso = 3;

  evaluar(items: ItemDeTablero[], ctx: ContextoDeTablero): Hallazgo[] {
    if (!ctx.columnaFecha) return [];

    const vencidos = items.filter((i) => {
      if (estaCerrado(i, ctx)) return false;
      const f = valor(i, ctx.columnaFecha);
      if (!f) return false;
      return diasDesde(f, ctx.ahora) > 0;
    });
    if (vencidos.length === 0) return [];

    const peor = Math.max(...vencidos.map((i) => diasDesde(valor(i, ctx.columnaFecha)!, ctx.ahora)));
    return [{
      regla: this.id,
      severidad: peor > 30 ? 'alta' : 'media',
      itemIds: vencidos.map((i) => i.id),
      resumen: `${vencidos.length} items abiertos con fecha vencida (el mas atrasado, ${peor} dias)`,
    }];
  }
}
