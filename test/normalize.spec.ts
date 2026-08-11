import { normalizarNombre, sonElMismo } from '../src/diagnostics/normalize';

describe('normalizarNombre', () => {
  it('colapsa espacios y recorta los extremos', () => {
    expect(normalizarNombre('  Migrar   el   modulo  ')).toBe('migrar el modulo');
  });

  it('ignora mayusculas', () => {
    expect(normalizarNombre('MIGRAR EL MODULO')).toBe('migrar el modulo');
  });

  it('ignora tildes', () => {
    expect(normalizarNombre('Migrar el módulo')).toBe('migrar el modulo');
  });

  it('quita el sufijo numerico de copia', () => {
    expect(normalizarNombre('Migrar el modulo (1)')).toBe('migrar el modulo');
    expect(normalizarNombre('Migrar el modulo (23)')).toBe('migrar el modulo');
  });

  it('quita sufijos de copia en espanol y en ingles', () => {
    expect(normalizarNombre('Migrar el modulo - copia')).toBe('migrar el modulo');
    expect(normalizarNombre('Migrar el modulo - copy')).toBe('migrar el modulo');
    expect(normalizarNombre('Migrar el modulo (copia)')).toBe('migrar el modulo');
  });

  it('quita sufijos encadenados', () => {
    expect(normalizarNombre('Migrar el modulo - copia (1)')).toBe('migrar el modulo');
  });

  it('es idempotente', () => {
    const entradas = ['  Migrar el módulo (1) ', 'TAREA - copia', 'algo normal'];
    for (const e of entradas) {
      expect(normalizarNombre(normalizarNombre(e))).toBe(normalizarNombre(e));
    }
  });

  it('no colapsa nombres que de verdad son distintos', () => {
    expect(sonElMismo('Migrar el modulo de pagos', 'Migrar el modulo de envios')).toBe(false);
    // un digito dentro del nombre NO es un sufijo de copia
    expect(sonElMismo('Sprint 1', 'Sprint 2')).toBe(false);
    // "(1)" solo se quita al final
    expect(normalizarNombre('Fase (1) del plan')).toBe('fase (1) del plan');
  });

  it('aguanta entradas vacias o raras', () => {
    expect(normalizarNombre('')).toBe('');
    expect(normalizarNombre('   ')).toBe('');
    expect(normalizarNombre('(1)')).toBe('');
  });
});
