import { estaCerrado, valor } from './helpers';
import { ContextoDeTablero, Hallazgo, ItemDeTablero, Regla } from './rule.types';

/**
 * Items abiertos a medio llenar: les falta la mitad o mas de las columnas
 * clave del tablero (estado, responsable, fechas, correo, telefono...).
 *
 * "Sin estado" y "sin responsable" ya tienen su propia regla; esta mira el
 * conjunto. Un item al que le falta UNA cosa es un descuido; uno al que le
 * faltan tres es un cascaron que alguien creo y abandono, y los cascarones
 * son los que ensucian los conteos de los dashboards.
 */
export class ReglaCamposVacios implements Regla {
  readonly id = 'campos-vacios';
  readonly peso = 1;

  evaluar(items: ItemDeTablero[], ctx: ContextoDeTablero): Hallazgo[] {
    const clave = ctx.columnasClave ?? [];
    // con menos de dos columnas clave la regla no distingue nada util
    if (clave.length < 2) return [];
    const minimoVacias = Math.max(2, Math.ceil(clave.length / 2));

    const faltantesPorColumna = new Map<string, number>();
    const cascarones = items.filter((item) => {
      if (estaCerrado(item, ctx)) return false;
      const vacias = clave.filter((c) => !valor(item, c.id));
      if (vacias.length < minimoVacias) return false;
      vacias.forEach((c) => faltantesPorColumna.set(c.titulo, (faltantesPorColumna.get(c.titulo) ?? 0) + 1));
      return true;
    });
    if (cascarones.length === 0) return [];

    const peores = [...faltantesPorColumna.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([titulo, n]) => `${titulo} (${n})`)
      .join(', ');
    return [{
      regla: this.id,
      severidad: cascarones.length > items.length * 0.25 ? 'media' : 'baja',
      itemIds: cascarones.map((i) => i.id),
      resumen: `${cascarones.length} items abiertos a medio llenar; lo que mas falta: ${peores}`,
    }];
  }
}
