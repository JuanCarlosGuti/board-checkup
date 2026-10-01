import { DiagnosticsService } from '../src/diagnostics/diagnostics.service';
import { ReglaResponsableDesactivado } from '../src/diagnostics/rules/deactivated-owner.rule';
import { ReglaCamposVacios } from '../src/diagnostics/rules/empty-fields.rule';
import { normalizarPersona, personasEn } from '../src/diagnostics/rules/helpers';
import { ReglaHuerfanos } from '../src/diagnostics/rules/orphans.rule';
import { ContextoDeTablero, ItemDeTablero } from '../src/diagnostics/rules/rule.types';

const AHORA = new Date('2026-08-11T00:00:00Z');

const ctx: ContextoDeTablero = {
  boardId: '1',
  columnaEstado: 'estado',
  columnaResponsable: 'duenio',
  columnaFecha: 'fecha',
  etiquetasCerradas: ['Listo'],
  diasParaEstancado: 30,
  usuariosDesactivados: ['Pedro Gómez'],
  columnasClave: [
    { id: 'estado', titulo: 'Estado' },
    { id: 'duenio', titulo: 'Responsable' },
    { id: 'fecha', titulo: 'Vencimiento' },
    { id: 'correo', titulo: 'Correo' },
  ],
  ahora: AHORA,
};

const item = (
  id: string,
  o: { estado?: string; duenio?: string; fecha?: string; correo?: string; actualizado?: string } = {},
): ItemDeTablero => ({
  id,
  name: 'Item ' + id,
  updatedAt: o.actualizado ?? '2026-08-10T00:00:00Z',
  columnas: {
    estado: o.estado ?? null,
    duenio: o.duenio ?? null,
    fecha: o.fecha ?? null,
    correo: o.correo ?? null,
  },
});

describe('helpers de personas', () => {
  it('separa los nombres que monday entrega por coma', () => {
    expect(personasEn('Ana Perez, Juan Gomez')).toEqual(['Ana Perez', 'Juan Gomez']);
    expect(personasEn(null)).toEqual([]);
    expect(personasEn('  ')).toEqual([]);
  });

  it('compara nombres sin tildes, mayusculas ni espacios de sobra', () => {
    expect(normalizarPersona('  Pedro   GÓMEZ ')).toBe(normalizarPersona('pedro gomez'));
  });
});

describe('ReglaResponsableDesactivado', () => {
  const r = new ReglaResponsableDesactivado();

  it('marca los items abiertos cuyo unico responsable esta desactivado', () => {
    const h = r.evaluar([item('1', { duenio: 'Pedro Gomez' }), item('2', { duenio: 'Ana Perez' })], ctx);
    expect(h).toHaveLength(1);
    expect(h[0].itemIds).toEqual(['1']);
    expect(h[0].resumen).toContain('Pedro Gomez');
  });

  it('NO marca si queda al menos una persona activa asignada', () => {
    expect(r.evaluar([item('1', { duenio: 'Pedro Gomez, Ana Perez' })], ctx)).toHaveLength(0);
  });

  it('NO marca los cerrados', () => {
    expect(r.evaluar([item('1', { duenio: 'Pedro Gomez', estado: 'Listo' })], ctx)).toHaveLength(0);
  });

  it('se calla si no hay usuarios desactivados o no se pudieron consultar', () => {
    expect(r.evaluar([item('1', { duenio: 'Pedro Gomez' })], { ...ctx, usuariosDesactivados: [] })).toHaveLength(0);
    expect(r.evaluar([item('1', { duenio: 'Pedro Gomez' })], { ...ctx, usuariosDesactivados: undefined })).toHaveLength(0);
  });

  it('sube a severidad alta cuando pasa del 10% del tablero', () => {
    const items = [item('1', { duenio: 'Pedro Gomez' }), item('2', { duenio: 'Ana' }), item('3', { duenio: 'Ana' })];
    expect(r.evaluar(items, ctx)[0].severidad).toBe('alta');
    const muchos = [item('1', { duenio: 'Pedro Gomez' }), ...Array.from({ length: 20 }, (_, i) => item('a' + i, { duenio: 'Ana' }))];
    expect(r.evaluar(muchos, ctx)[0].severidad).toBe('media');
  });
});

describe('ReglaCamposVacios', () => {
  const r = new ReglaCamposVacios();

  it('marca los abiertos a los que les falta la mitad o mas de las columnas clave', () => {
    // 4 columnas clave => se necesitan 2 vacias
    const h = r.evaluar([
      item('1', { estado: 'En curso' }),                                   // faltan 3
      item('2', { estado: 'En curso', duenio: 'Ana', fecha: '2026-09-01' }), // falta 1
    ], ctx);
    expect(h).toHaveLength(1);
    expect(h[0].itemIds).toEqual(['1']);
  });

  it('dice que columnas son las que mas faltan', () => {
    const h = r.evaluar([item('1', { estado: 'En curso' }), item('2', { estado: 'En curso', correo: 'x@y.z' })], ctx);
    expect(h[0].resumen).toContain('Responsable (2)');
    expect(h[0].resumen).toContain('Vencimiento (2)');
  });

  it('NO marca los cerrados aunque esten vacios', () => {
    expect(r.evaluar([item('1', { estado: 'Listo' })], ctx)).toHaveLength(0);
  });

  it('se calla con menos de dos columnas clave', () => {
    expect(r.evaluar([item('1')], { ...ctx, columnasClave: [{ id: 'estado', titulo: 'Estado' }] })).toHaveLength(0);
    expect(r.evaluar([item('1')], { ...ctx, columnasClave: undefined })).toHaveLength(0);
  });
});

describe('ReglaHuerfanos', () => {
  const r = new ReglaHuerfanos();

  it('marca los abiertos sin responsable, sin fecha y sin movimiento', () => {
    const h = r.evaluar([item('1', { estado: 'En curso', actualizado: '2026-05-01T00:00:00Z' })], ctx);
    expect(h).toHaveLength(1);
    expect(h[0].itemIds).toEqual(['1']);
    expect(h[0].severidad).toBe('alta');
  });

  it('NO marca si alguna de las tres senales falta', () => {
    const viejo = '2026-05-01T00:00:00Z';
    expect(r.evaluar([item('1', { duenio: 'Ana', actualizado: viejo })], ctx)).toHaveLength(0);          // tiene dueno
    expect(r.evaluar([item('1', { fecha: '2026-12-01', actualizado: viejo })], ctx)).toHaveLength(0);     // tiene fecha
    expect(r.evaluar([item('1', { actualizado: '2026-08-09T00:00:00Z' })], ctx)).toHaveLength(0);         // se toco hace poco
    expect(r.evaluar([item('1', { estado: 'Listo', actualizado: viejo })], ctx)).toHaveLength(0);         // cerrado
  });

  it('se calla si el tablero no tiene columna de personas o de fecha', () => {
    const viejo = item('1', { actualizado: '2026-05-01T00:00:00Z' });
    expect(r.evaluar([viejo], { ...ctx, columnaResponsable: undefined })).toHaveLength(0);
    expect(r.evaluar([viejo], { ...ctx, columnaFecha: undefined })).toHaveLength(0);
  });
});

describe('DiagnosticsService con las nueve reglas', () => {
  const svc = new DiagnosticsService();

  it('registra las nueve reglas', () => {
    expect(svc.reglasActivas().sort()).toEqual([
      'campos-vacios', 'duplicados', 'estancado', 'etiquetas-parecidas', 'huerfanos',
      'responsable-desactivado', 'sin-estado', 'sin-responsable', 'vencido-abierto',
    ]);
  });

  it('un tablero sano da 100 y uno con un huerfano lo descuenta', () => {
    const sano = svc.analizar([item('1', { estado: 'En curso', duenio: 'Ana', fecha: '2026-12-01', correo: 'a@b.c' })], ctx);
    expect(sano.puntaje).toBe(100);
    expect(sano.hallazgos).toHaveLength(0);

    const d = svc.analizar([item('1', { estado: 'En curso', actualizado: '2026-05-01T00:00:00Z' })], ctx);
    expect(d.puntaje).toBeLessThan(100);
    expect(d.hallazgos.map((h) => h.regla)).toContain('huerfanos');
    expect(d.hallazgos[0].severidad).toBe('alta'); // los de severidad alta van primero
  });
});
