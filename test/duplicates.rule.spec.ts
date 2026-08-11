import { ReglaDuplicados } from '../src/diagnostics/rules/duplicates.rule';
import { ContextoDeTablero, ItemDeTablero } from '../src/diagnostics/rules/rule.types';

const ctx: ContextoDeTablero = {
  boardId: '1',
  etiquetasCerradas: ['Listo'],
  diasParaEstancado: 30,
  ahora: new Date('2026-08-11T00:00:00Z'),
};

const item = (id: string, name: string): ItemDeTablero => ({
  id, name, updatedAt: '2026-08-01T00:00:00Z', columnas: {},
});

describe('ReglaDuplicados', () => {
  const regla = new ReglaDuplicados();

  it('no reporta nada cuando todos los nombres son distintos', () => {
    const r = regla.evaluar([item('1', 'Uno'), item('2', 'Dos')], ctx);
    expect(r).toHaveLength(0);
  });

  it('agrupa un duplicado en UN hallazgo con los dos ids', () => {
    const r = regla.evaluar([item('1', 'Migrar pagos'), item('2', 'migrar  PAGOS')], ctx);
    expect(r).toHaveLength(1);
    expect(r[0].itemIds.sort()).toEqual(['1', '2']);
  });

  it('detecta las variantes que produce un humano de verdad', () => {
    const r = regla.evaluar([
      item('1', 'Migrar el módulo de pagos'),
      item('2', 'Migrar el modulo de pagos'),      // sin tilde
      item('3', 'MIGRAR EL MODULO DE PAGOS'),       // mayusculas
      item('4', '  Migrar el modulo de pagos  '),   // espacios
      item('5', 'Migrar el modulo de pagos (1)'),   // sufijo de copia
      item('6', 'Migrar el modulo de pagos - copia'),
    ], ctx);
    expect(r).toHaveLength(1);
    expect(r[0].itemIds).toHaveLength(6);
    expect(r[0].severidad).toBe('alta');
  });

  it('marca severidad media cuando son solo dos o tres', () => {
    const r = regla.evaluar([item('1', 'X'), item('2', 'x')], ctx);
    expect(r[0].severidad).toBe('media');
  });

  it('ordena los grupos mas grandes primero', () => {
    const r = regla.evaluar([
      item('1', 'A'), item('2', 'a'),
      item('3', 'B'), item('4', 'b'), item('5', 'B '),
    ], ctx);
    expect(r[0].itemIds).toHaveLength(3);
    expect(r[1].itemIds).toHaveLength(2);
  });

  it('ignora items sin nombre en vez de agruparlos entre si', () => {
    const r = regla.evaluar([item('1', ''), item('2', '   '), item('3', '(1)')], ctx);
    expect(r).toHaveLength(0);
  });
});
