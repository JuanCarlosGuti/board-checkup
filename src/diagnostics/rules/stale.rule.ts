import { diasDesde, estaCerrado } from './helpers';
import { ContextoDeTablero, Hallazgo, ItemDeTablero, Regla } from './rule.types';

/**
 * Items abiertos sin ninguna actualizacion en N dias: trabajo zombi.
 *
 * Se apoya en updated_at, que monday da gratis en la misma consulta. Nota para
 * cuando toque probarlo: updated_at NO se puede falsificar por API, asi que este
 * diagnostico no se valida con datos sembrados hoy.
 */
export class ReglaEstancado implements Regla {
  readonly id = 'estancado';
  readonly peso = 2;

  evaluar(items: ItemDeTablero[], ctx: ContextoDeTablero): Hallazgo[] {
    const quietos = items.filter(
      (i) => !estaCerrado(i, ctx) && diasDesde(i.updatedAt, ctx.ahora) >= ctx.diasParaEstancado,
    );
    if (quietos.length === 0) return [];

    const peor = Math.max(...quietos.map((i) => diasDesde(i.updatedAt, ctx.ahora)));
    return [{
      regla: this.id,
      severidad: peor > ctx.diasParaEstancado * 3 ? 'alta' : 'baja',
      itemIds: quietos.map((i) => i.id),
      resumen: `${quietos.length} items sin movimiento hace mas de ${ctx.diasParaEstancado} dias (el mas quieto, ${peor})`,
    }];
  }
}
