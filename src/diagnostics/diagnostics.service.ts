import { Injectable } from '@nestjs/common';
import { ReglaDuplicados } from './rules/duplicates.rule';
import { ReglaEtiquetasParecidas } from './rules/similar-labels.rule';
import { ReglaSinEstado } from './rules/missing-status.rule';
import { ReglaSinResponsable } from './rules/missing-owner.rule';
import { ReglaEstancado } from './rules/stale.rule';
import { ReglaVencidoAbierto } from './rules/overdue-open.rule';
import { ContextoDeTablero, Hallazgo, ItemDeTablero, Regla } from './rules/rule.types';

export interface Diagnostico {
  puntaje: number;              // 0-100
  hallazgos: Hallazgo[];
  itemsAnalizados: number;
}

/**
 * Corre todas las reglas y calcula el puntaje de salud.
 *
 * El puntaje es auditable a proposito: cada regla declara su peso y el descuento
 * es proporcional a la fraccion de items afectados. Si el usuario no puede
 * reconstruir de donde salio el numero, no confia en el, y con razon.
 */
@Injectable()
export class DiagnosticsService {
  // Al agregar una regla nueva, va aqui. Nada mas cambia.
  private readonly reglas: Regla[] = [
    new ReglaDuplicados(),
    new ReglaVencidoAbierto(),
    new ReglaSinResponsable(),
    new ReglaEstancado(),
    new ReglaSinEstado(),
    new ReglaEtiquetasParecidas(),
  ];

  analizar(items: ItemDeTablero[], ctx: ContextoDeTablero): Diagnostico {
    const hallazgos = this.reglas.flatMap((r) => r.evaluar(items, ctx));
    return {
      puntaje: this.calcularPuntaje(items.length, hallazgos),
      hallazgos: hallazgos.sort(porSeveridad),
      itemsAnalizados: items.length,
    };
  }

  private calcularPuntaje(totalItems: number, hallazgos: Hallazgo[]): number {
    if (totalItems === 0) return 100;

    let descuento = 0;
    for (const regla of this.reglas) {
      const afectados = new Set(
        hallazgos.filter((h) => h.regla === regla.id).flatMap((h) => h.itemIds),
      ).size;
      if (afectados === 0) continue;
      // fraccion de items que la regla marca, ponderada por el peso de la regla
      descuento += (afectados / totalItems) * regla.peso * 10;
    }
    return Math.max(0, Math.round(100 - descuento));
  }
}

const ORDEN = { alta: 0, media: 1, baja: 2 } as const;
const porSeveridad = (a: Hallazgo, b: Hallazgo) =>
  ORDEN[a.severidad] - ORDEN[b.severidad] || b.itemIds.length - a.itemIds.length;
