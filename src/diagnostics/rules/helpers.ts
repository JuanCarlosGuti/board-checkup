import { ContextoDeTablero, ItemDeTablero } from './rule.types';

/** Texto de una columna del item, o null si no esta o viene vacia. */
export function valor(item: ItemDeTablero, columnaId?: string): string | null {
  if (!columnaId) return null;
  const v = item.columnas[columnaId];
  return v && v.trim() ? v.trim() : null;
}

/**
 * True si el item ya esta cerrado.
 *
 * Importa muchisimo para no dar falsos positivos: una tarea terminada hace tres
 * meses NO esta estancada, y una con fecha pasada pero ya lista NO esta vencida.
 * Sin esta comprobacion, el diagnostico de un tablero sano y viejo sale en rojo
 * y el usuario desinstala.
 */
export function estaCerrado(item: ItemDeTablero, ctx: ContextoDeTablero): boolean {
  const estado = valor(item, ctx.columnaEstado);
  if (!estado) return false;
  return ctx.etiquetasCerradas.some((e) => e.toLowerCase() === estado.toLowerCase());
}

/** Dias completos entre una fecha ISO y el momento del analisis. */
export function diasDesde(iso: string, ahora: Date): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.floor((ahora.getTime() - t) / 86400000);
}
