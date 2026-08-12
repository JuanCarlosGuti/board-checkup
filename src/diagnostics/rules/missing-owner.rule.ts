import { estaCerrado, valor } from './helpers';
import { ContextoDeTablero, Hallazgo, ItemDeTablero, Regla } from './rule.types';

/**
 * Items abiertos sin nadie asignado: trabajo que nadie va a hacer.
 * Los items ya cerrados se ignoran; que una tarea terminada no tenga
 * responsable no le importa a nadie.
 */
export class ReglaSinResponsable implements Regla {
  readonly id = 'sin-responsable';
  readonly peso = 2;

  evaluar(items: ItemDeTablero[], ctx: ContextoDeTablero): Hallazgo[] {
    if (!ctx.columnaResponsable) return []; // el tablero no tiene columna de personas

    const huerfanos = items.filter((i) => !estaCerrado(i, ctx) && !valor(i, ctx.columnaResponsable));
    if (huerfanos.length === 0) return [];

    return [{
      regla: this.id,
      severidad: huerfanos.length > items.length * 0.25 ? 'alta' : 'media',
      itemIds: huerfanos.map((i) => i.id),
      resumen: `${huerfanos.length} items abiertos sin responsable asignado`,
    }];
  }
}
