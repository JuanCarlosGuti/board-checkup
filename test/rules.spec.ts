import { ReglaSinResponsable } from '../src/diagnostics/rules/missing-owner.rule';
import { ReglaSinEstado } from '../src/diagnostics/rules/missing-status.rule';
import { ReglaVencidoAbierto } from '../src/diagnostics/rules/overdue-open.rule';
import { ContextoDeTablero, ItemDeTablero } from '../src/diagnostics/rules/rule.types';
import { ReglaEtiquetasParecidas } from '../src/diagnostics/rules/similar-labels.rule';
import { ReglaEstancado } from '../src/diagnostics/rules/stale.rule';

const AHORA = new Date('2026-08-11T00:00:00Z');

const ctx: ContextoDeTablero = {
  boardId: '1',
  columnaEstado: 'estado',
  columnaResponsable: 'duenio',
  columnaFecha: 'fecha',
  etiquetasCerradas: ['Listo'],
  diasParaEstancado: 30,
  ahora: AHORA,
};

const item = (
  id: string,
  o: { estado?: string; duenio?: string; fecha?: string; actualizado?: string } = {},
): ItemDeTablero => ({
  id,
  name: 'Item ' + id,
  updatedAt: o.actualizado ?? '2026-08-10T00:00:00Z',
  columnas: { estado: o.estado ?? null, duenio: o.duenio ?? null, fecha: o.fecha ?? null },
});

describe('ReglaSinResponsable', () => {
  const r = new ReglaSinResponsable();

  it('marca los items abiertos sin responsable', () => {
    const h = r.evaluar([item('1'), item('2', { duenio: 'Juan' })], ctx);
    expect(h[0].itemIds).toEqual(['1']);
  });

  it('NO marca los que ya estan cerrados', () => {
    // que una tarea terminada no tenga dueno no le importa a nadie
    const h = r.evaluar([item('1', { estado: 'Listo' })], ctx);
    expect(h).toHaveLength(0);
  });

  it('no dice nada si el tablero no tiene columna de personas', () => {
    expect(r.evaluar([item('1')], { ...ctx, columnaResponsable: undefined })).toHaveLength(0);
  });
});

describe('ReglaVencidoAbierto', () => {
  const r = new ReglaVencidoAbierto();

  it('marca fecha pasada con item abierto', () => {
    const h = r.evaluar([item('1', { fecha: '2026-07-01', estado: 'En curso' })], ctx);
    expect(h[0].itemIds).toEqual(['1']);
    expect(h[0].severidad).toBe('alta'); // 41 dias de atraso
  });

  it('NO marca fecha pasada si ya esta cerrado', () => {
    expect(r.evaluar([item('1', { fecha: '2026-01-01', estado: 'Listo' })], ctx)).toHaveLength(0);
  });

  it('NO marca fechas futuras', () => {
    expect(r.evaluar([item('1', { fecha: '2026-12-01', estado: 'En curso' })], ctx)).toHaveLength(0);
  });

  it('NO marca items sin fecha', () => {
    expect(r.evaluar([item('1', { estado: 'En curso' })], ctx)).toHaveLength(0);
  });
});

describe('ReglaEstancado', () => {
  const r = new ReglaEstancado();

  it('marca los abiertos sin movimiento hace mas del umbral', () => {
    const h = r.evaluar([item('1', { actualizado: '2026-06-01T00:00:00Z', estado: 'En curso' })], ctx);
    expect(h[0].itemIds).toEqual(['1']);
  });

  it('NO marca los recien tocados', () => {
    expect(r.evaluar([item('1', { actualizado: '2026-08-09T00:00:00Z' })], ctx)).toHaveLength(0);
  });

  it('NO marca los cerrados por viejos que sean', () => {
    // una tarea terminada en enero no esta "estancada"
    expect(r.evaluar([item('1', { actualizado: '2026-01-01T00:00:00Z', estado: 'Listo' })], ctx)).toHaveLength(0);
  });
});

describe('ReglaSinEstado', () => {
  it('marca los items con la columna de estado vacia', () => {
    const h = new ReglaSinEstado().evaluar([item('1'), item('2', { estado: 'Listo' })], ctx);
    expect(h[0].itemIds).toEqual(['1']);
  });
});

describe('ReglaEtiquetasParecidas', () => {
  const r = new ReglaEtiquetasParecidas();

  it('detecta la misma etiqueta escrita distinto', () => {
    const h = r.evaluar([
      item('1', { estado: 'En progreso' }),
      item('2', { estado: 'En Progreso' }),
      item('3', { estado: 'en  progreso' }),
    ], ctx);
    expect(h).toHaveLength(1);
    expect(h[0].itemIds.sort()).toEqual(['1', '2', '3']);
  });

  it('no se queja cuando las etiquetas son consistentes', () => {
    const h = r.evaluar([item('1', { estado: 'Listo' }), item('2', { estado: 'Listo' })], ctx);
    expect(h).toHaveLength(0);
  });

  it('no confunde etiquetas que de verdad son distintas', () => {
    const h = r.evaluar([item('1', { estado: 'En curso' }), item('2', { estado: 'Detenido' })], ctx);
    expect(h).toHaveLength(0);
  });
});
