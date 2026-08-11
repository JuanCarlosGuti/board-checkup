import { normalizarNombre } from '../normalize';
import { ContextoDeTablero, Hallazgo, ItemDeTablero, Regla } from './rule.types';

/**
 * Agrupa items cuyo nombre normalizado coincide.
 *
 * Un grupo de 3 items iguales es UN hallazgo con 3 ids, no tres hallazgos.
 * Esa distincion importa: el usuario quiere saber "tienes 14 duplicados", no
 * recibir 42 lineas.
 */
export class ReglaDuplicados implements Regla {
  readonly id = 'duplicados';
  readonly peso = 3;

  evaluar(items: ItemDeTablero[], _ctx: ContextoDeTablero): Hallazgo[] {
    const grupos = new Map<string, ItemDeTablero[]>();

    for (const item of items) {
      const clave = normalizarNombre(item.name);
      if (!clave) continue; // items sin nombre no son duplicados de nada
      const grupo = grupos.get(clave);
      if (grupo) grupo.push(item);
      else grupos.set(clave, [item]);
    }

    const hallazgos: Hallazgo[] = [];
    for (const grupo of grupos.values()) {
      if (grupo.length < 2) continue;
      hallazgos.push({
        regla: this.id,
        severidad: grupo.length > 3 ? 'alta' : 'media',
        itemIds: grupo.map((i) => i.id),
        resumen: `${grupo.length} items con el mismo nombre: "${grupo[0].name.trim()}"`,
      });
    }

    // los grupos mas grandes primero: es lo que el usuario quiere ver antes
    return hallazgos.sort((a, b) => b.itemIds.length - a.itemIds.length);
  }
}
