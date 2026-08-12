import { normalizarNombre } from '../normalize';
import { valor } from './helpers';
import { ContextoDeTablero, Hallazgo, ItemDeTablero, Regla } from './rule.types';

/**
 * Etiquetas de estado que solo difieren en mayusculas, tildes o espacios:
 * "En progreso" y "En Progreso" conviviendo en el mismo tablero.
 *
 * Es el hallazgo mas silencioso y de los mas daninos: parte los agrupamientos en
 * dos, y los dashboards muestran cifras que no suman lo que deberian.
 */
export class ReglaEtiquetasParecidas implements Regla {
  readonly id = 'etiquetas-parecidas';
  readonly peso = 1;

  evaluar(items: ItemDeTablero[], ctx: ContextoDeTablero): Hallazgo[] {
    if (!ctx.columnaEstado) return [];

    // forma normalizada -> variantes literales encontradas
    const grupos = new Map<string, Map<string, string[]>>();
    for (const item of items) {
      const etiqueta = valor(item, ctx.columnaEstado);
      if (!etiqueta) continue;
      const clave = normalizarNombre(etiqueta);
      if (!grupos.has(clave)) grupos.set(clave, new Map());
      const variantes = grupos.get(clave)!;
      if (!variantes.has(etiqueta)) variantes.set(etiqueta, []);
      variantes.get(etiqueta)!.push(item.id);
    }

    const hallazgos: Hallazgo[] = [];
    for (const variantes of grupos.values()) {
      if (variantes.size < 2) continue;
      const nombres = [...variantes.keys()];
      hallazgos.push({
        regla: this.id,
        severidad: 'media',
        itemIds: [...variantes.values()].flat(),
        resumen: `Etiquetas que son la misma escritas distinto: ${nombres.map((n) => `"${n}"`).join(' y ')}`,
      });
    }
    return hallazgos;
  }
}
