import { estaCerrado, normalizarPersona, personasEn, valor } from './helpers';
import { ContextoDeTablero, Hallazgo, ItemDeTablero, Regla } from './rule.types';

/**
 * Items abiertos cuyo responsable ya no esta en la cuenta.
 *
 * Es el caso mas enganoso de todos: el tablero dice que alguien se encarga,
 * los filtros "sin responsable" no lo atrapan, y nadie va a hacer el trabajo
 * porque esa persona se fue hace meses. Por eso pesa igual que "vencido".
 *
 * Se compara por nombre, no por id: el cliente pide solo el texto de las
 * columnas para no gastar el presupuesto de complejidad del cliente, y el
 * texto de una columna de personas es "Ana Perez, Juan Gomez". Dos personas
 * con el mismo nombre en la misma cuenta es un caso raro que aceptamos a
 * cambio de no duplicar la consulta.
 */
export class ReglaResponsableDesactivado implements Regla {
  readonly id = 'responsable-desactivado';
  readonly peso = 3;

  evaluar(items: ItemDeTablero[], ctx: ContextoDeTablero): Hallazgo[] {
    if (!ctx.columnaResponsable) return [];
    const desactivados = new Set((ctx.usuariosDesactivados ?? []).map(normalizarPersona));
    if (desactivados.size === 0) return []; // no hay nadie desactivado, o no se pudo consultar

    const afectados: ItemDeTablero[] = [];
    const quienes = new Set<string>();
    for (const item of items) {
      if (estaCerrado(item, ctx)) continue;
      const personas = personasEn(valor(item, ctx.columnaResponsable));
      const idos = personas.filter((p) => desactivados.has(normalizarPersona(p)));
      // si al menos una persona activa sigue asignada, el item tiene dueno
      if (idos.length === 0 || idos.length < personas.length) continue;
      afectados.push(item);
      idos.forEach((p) => quienes.add(p));
    }
    if (afectados.length === 0) return [];

    const nombres = [...quienes].slice(0, 3).map((n) => `"${n}"`).join(', ');
    const mas = quienes.size > 3 ? ` y ${quienes.size - 3} mas` : '';
    return [{
      regla: this.id,
      severidad: afectados.length > items.length * 0.1 ? 'alta' : 'media',
      itemIds: afectados.map((i) => i.id),
      resumen: `${afectados.length} items abiertos asignados a personas que ya no estan en la cuenta (${nombres}${mas})`,
    }];
  }
}
