/**
 * Normalizacion de nombres de item.
 *
 * Es el corazon de la deteccion de duplicados y es donde se gana o se pierde
 * contra la competencia. Los duplicados reales que produce un humano casi nunca
 * son bytes identicos: son la misma frase con una mayuscula distinta, un espacio
 * de mas, una tilde que se comio, o el sufijo que agrega la funcion "duplicar".
 *
 * Deliberadamente NO hacemos coincidencia difusa (distancia de edicion). Un falso
 * positivo aqui significa proponerle a alguien que fusione dos items que en
 * realidad son distintos, y eso destruye la confianza mucho mas rapido de lo que
 * un duplicado no detectado la construye. Preferimos fallar por conservadores.
 */

/** Sufijos que agregan las herramientas y las personas al copiar algo. */
const SUFIJOS_DE_COPIA = [
  /\s*\(\d+\)$/,            // "Tarea (1)", "Tarea (2)"
  /\s*-\s*copia$/i,         // "Tarea - copia"
  /\s*-\s*copy$/i,          // "Tarea - copy"
  /\s*\(copia\)$/i,
  /\s*\(copy\)$/i,
  /\s*copy$/i,
];

/**
 * Reduce un nombre a su forma canonica para comparar.
 * Idempotente: normalize(normalize(x)) === normalize(x).
 */
export function normalizarNombre(nombre: string): string {
  let s = nombre ?? '';

  // 1. Unicode a forma descompuesta y fuera los diacriticos.
  //    "Migrar el módulo" y "Migrar el modulo" son el mismo item.
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 2. Espacios: colapsar cualquier secuencia (incluido tab y no-break space).
  s = s.replace(/\s+/g, ' ').trim();

  // 3. Sufijos de copia, repetidamente: "Tarea - copia (1)" tiene dos.
  let antes: string;
  do {
    antes = s;
    for (const patron of SUFIJOS_DE_COPIA) s = s.replace(patron, '').trim();
  } while (s !== antes);

  // 4. Minusculas al final, para no interferir con los patrones de arriba.
  return s.toLowerCase();
}

/** True si dos nombres son el mismo item a ojos de un humano. */
export function sonElMismo(a: string, b: string): boolean {
  return normalizarNombre(a) === normalizarNombre(b);
}
