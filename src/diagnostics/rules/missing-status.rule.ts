import { valor } from './helpers';
import { ContextoDeTablero, Hallazgo, ItemDeTablero, Regla } from './rule.types';

/**
 * Items sin estado. Rompen los agrupamientos, los dashboards y cualquier
 * automatizacion que dependa del estado, y son invisibles en los reportes.
 */
export class ReglaSinEstado implements Regla {
  readonly id = 'sin-estado';
  readonly peso = 1;

  evaluar(items: ItemDeTablero[], ctx: ContextoDeTablero): Hallazgo[] {
    if (!ctx.columnaEstado) return [];

    const vacios = items.filter((i) => !valor(i, ctx.columnaEstado));
    if (vacios.length === 0) return [];

    return [{
      regla: this.id,
      severidad: 'baja',
      itemIds: vacios.map((i) => i.id),
      resumen: `${vacios.length} items sin estado definido`,
    }];
  }
}
