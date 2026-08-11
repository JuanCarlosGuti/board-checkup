/**
 * Medición del presupuesto de los 3 segundos — API GraphQL de monday.com
 *
 * Uso (PowerShell):
 *   $env:MONDAY_TOKEN="tu_token"; node medir.mjs
 * Uso (cmd):
 *   set MONDAY_TOKEN=tu_token && node medir.mjs
 *
 * El token se lee de la variable de entorno. NUNCA se imprime ni se guarda
 * en resultados.json. Requiere Node 18+ (usa fetch global).
 */

const TOKEN = process.env.MONDAY_TOKEN;
if (!TOKEN) {
  console.error('\n  Falta MONDAY_TOKEN.\n');
  console.error('  PowerShell:  $env:MONDAY_TOKEN="tu_token"; node medir.mjs');
  console.error('  cmd:         set MONDAY_TOKEN=tu_token && node medir.mjs\n');
  console.error('  El token se saca en monday: avatar > Developers > My access tokens\n');
  process.exit(1);
}

const PLACEHOLDERS = ['tu_token', 'pega_aqui_tu_token', 'TU_TOKEN', 'xxx'];
if (PLACEHOLDERS.includes(TOKEN.trim())) {
  console.error('\n  Ese es el texto de ejemplo, no tu token real.\n');
  console.error('  Sacalo en monday: avatar (abajo izquierda) > Developers > My access tokens > Show\n');
  console.error('  Luego:  $env:MONDAY_TOKEN="eyJhbGciOi..."; node medir.mjs\n');
  process.exit(1);
}
if (TOKEN.trim().length < 40) {
  console.error('\n  El token parece demasiado corto (' + TOKEN.trim().length + ' caracteres).');
  console.error('  Un token de monday es un JWT largo que empieza por "eyJ".\n');
  process.exit(1);
}

const ENDPOINT = 'https://api.monday.com/v2';
const REPS = 3;                 // repeticiones por medición, se reporta la mediana
const MAX_ITEMS_PAGINACION = 5000;  // tope para no quemar la cuota diaria

let llamadas = 0;
const resultados = { generado: new Date().toISOString(), llamadasTotales: 0, mediciones: [] };

const mediana = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

async function gql(query, intento = 0) {
  const t0 = performance.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': TOKEN },
    body: JSON.stringify({ query })
  });
  const ms = performance.now() - t0;
  llamadas++;
  const json = await res.json();
  if (json.errors && json.errors[0]?.extensions?.code === 'COMPLEXITY_BUDGET_EXHAUSTED' && intento < 12) {
    const s = (json.errors[0].extensions.retry_in_seconds ?? 60) + 3;
    console.log('     (presupuesto agotado, esperando ' + s + ' s y reintentando)');
    await dormir(s * 1000);
    return gql(query, intento + 1);
  }
  if (json.errors) {
    const codigo = json.errors[0]?.extensions?.code;
    if (codigo === 'NOT_AUTHENTICATED') {
      throw new Error('monday rechazo el token. Revisa que sea el token real y completo,\n         y que la variable este puesta en ESTA misma ventana de PowerShell.');
    }
    throw new Error('Error de la API: ' + JSON.stringify(json.errors).slice(0, 400));
  }
  return { ms, data: json.data, complejidad: json.data?.complexity ?? null };
}

async function medir(nombre, query, extraerConteo) {
  const tiempos = [];
  let complejidad = null, conteo = null;
  for (let i = 0; i < REPS; i++) {
    const r = await gql(query);
    tiempos.push(r.ms);
    complejidad = r.complejidad?.query ?? complejidad;
    if (extraerConteo) conteo = extraerConteo(r.data);
    await new Promise(r => setTimeout(r, 300)); // no atropellar el límite por minuto
  }
  const fila = {
    nombre,
    msMediana: Math.round(mediana(tiempos)),
    msMin: Math.round(Math.min(...tiempos)),
    msMax: Math.round(Math.max(...tiempos)),
    complejidad,
    itemsDevueltos: conteo
  };
  resultados.mediciones.push(fila);
  console.log(
    '  ' + nombre.padEnd(34) +
    String(fila.msMediana + ' ms').padStart(10) +
    String(fila.complejidad ?? '-').padStart(12) + ' pts' +
    (conteo !== null ? String('  ' + conteo + ' items') : '')
  );
  return fila;
}

const CAMPO_COMPLEJIDAD = 'complexity { before query after reset_in_x_seconds }';

(async () => {
  console.log('\n=== Medición API monday.com ===\n');

  // --- 0. Línea base -------------------------------------------------------
  console.log('0) Línea base');
  const base = await gql(`query { ${CAMPO_COMPLEJIDAD} me { id name } }`);
  console.log('  Presupuesto disponible: ' + base.complejidad.before.toLocaleString() + ' pts');
  console.log('  Reinicia en: ' + base.complejidad.reset_in_x_seconds + ' s');
  console.log('  Query trivial: ' + Math.round(base.ms) + ' ms, ' + base.complejidad.query + ' pts\n');
  resultados.presupuestoInicial = base.complejidad.before;
  resultados.queryTrivial = { ms: Math.round(base.ms), complejidad: base.complejidad.query };

  // --- 1. Elegir el tablero más grande ------------------------------------
  console.log('1) Buscando el tablero más grande');
  const bs = await gql(`query { ${CAMPO_COMPLEJIDAD} boards(limit: 100, state: active) { id name items_count } }`);
  const tableros = (bs.data.boards || []).filter(b => b.items_count != null);
  if (!tableros.length) {
    console.error('\n  No hay tableros en esta cuenta. Crea uno con datos y vuelve a correr.\n');
    process.exitCode = 1;
    return;
  }
  tableros.sort((a, b) => b.items_count - a.items_count);
  const tablero = tableros[0];
  console.log('  ' + tableros.length + ' tableros. El mayor: "' + tablero.name + '" con ' + tablero.items_count + ' ítems (id ' + tablero.id + ')');
  resultados.tablero = { id: tablero.id, nombre: tablero.name, items: tablero.items_count };
  if (tablero.items_count < 100) {
    console.log('  AVISO: el tablero más grande tiene menos de 100 ítems.');
    console.log('  La medición servirá, pero no dice nada sobre tableros reales de cliente.\n');
  } else { console.log(''); }

  // --- 2. Columnas ---------------------------------------------------------
  console.log('2) Columnas del tablero');
  const cols = await gql(`query { boards(ids: [${tablero.id}]) { columns { id title type } } }`);
  const columnas = cols.data.boards[0].columns;
  const tiposUtiles = ['status', 'people', 'person', 'date', 'timeline', 'email', 'phone'];
  const utiles = columnas.filter(c => tiposUtiles.includes(c.type)).slice(0, 6);
  const idsUtiles = utiles.map(c => '"' + c.id + '"').join(', ');
  console.log('  ' + columnas.length + ' columnas en total; ' + utiles.length + ' relevantes para los diagnósticos:');
  utiles.forEach(c => console.log('    - ' + c.title + ' (' + c.id + ', ' + c.type + ')'));
  resultados.columnas = { total: columnas.length, relevantes: utiles };
  console.log('');

  // --- 3. Escalera: caso pesado vs afinado --------------------------------
  console.log('3) Escalera de medición\n');
  console.log('  ' + 'medición'.padEnd(34) + 'tiempo'.padStart(10) + 'complejidad'.padStart(15) + '\n  ' + '-'.repeat(70));

  const contarItems = (d) => d?.boards?.[0]?.items_page?.items?.length ?? null;

  for (const limite of [100, 250, 500]) {
    // Caso pesado: todas las columnas, con el JSON crudo
    await medir(`pesado ${limite} (todo + value)`, `query {
      ${CAMPO_COMPLEJIDAD}
      boards(ids: [${tablero.id}]) {
        items_page(limit: ${limite}) {
          cursor
          items { id name updated_at group { id title } column_values { id type text value } }
        }
      }
    }`, contarItems);

    // Caso afinado: solo columnas relevantes, solo texto
    const seleccion = idsUtiles ? `column_values(ids: [${idsUtiles}]) { id text }` : `column_values { id text }`;
    await medir(`afinado ${limite} (solo lo necesario)`, `query {
      ${CAMPO_COMPLEJIDAD}
      boards(ids: [${tablero.id}]) {
        items_page(limit: ${limite}) {
          cursor
          items { id name updated_at ${seleccion} }
        }
      }
    }`, contarItems);
  }

  // --- 4. Coste de leer el tablero COMPLETO (para el escaneo programado) ---
  console.log('\n4) Tablero completo con paginación (esto es lo que costaría el escaneo programado)');
  if (tablero.items_count > MAX_ITEMS_PAGINACION) {
    console.log('  Omitido: ' + tablero.items_count + ' ítems supera el tope de seguridad de ' + MAX_ITEMS_PAGINACION + '.');
  } else {
    const seleccion = idsUtiles ? `column_values(ids: [${idsUtiles}]) { id text }` : `column_values { id text }`;
    const t0 = performance.now();
    let cursor = null, total = 0, paginas = 0, complejidadTotal = 0;
    do {
      const q = cursor
        ? `query { ${CAMPO_COMPLEJIDAD} next_items_page(limit: 500, cursor: "${cursor}") { cursor items { id name updated_at ${seleccion} } } }`
        : `query { ${CAMPO_COMPLEJIDAD} boards(ids: [${tablero.id}]) { items_page(limit: 500) { cursor items { id name updated_at ${seleccion} } } } }`;
      const r = await gql(q);
      const pagina = cursor ? r.data.next_items_page : r.data.boards[0].items_page;
      total += pagina.items.length;
      complejidadTotal += r.complejidad?.query ?? 0;
      cursor = pagina.cursor;
      paginas++;
      if (paginas > 40) { console.log('  Corte de seguridad a las 40 páginas.'); break; }
    } while (cursor);
    const ms = Math.round(performance.now() - t0);
    console.log('  ' + total + ' ítems en ' + paginas + ' llamadas, ' + ms + ' ms, ' + complejidadTotal.toLocaleString() + ' pts');
    console.log('  Proyección: un tablero de 5.000 ítems costaría ~' + Math.ceil(5000 / 500) + ' llamadas.');
    resultados.tableroCompleto = { items: total, llamadas: paginas, ms, complejidad: complejidadTotal };
  }

  // --- Cierre --------------------------------------------------------------
  const fin = await gql(`query { ${CAMPO_COMPLEJIDAD} me { id } }`);
  resultados.llamadasTotales = llamadas;
  resultados.presupuestoFinal = fin.complejidad.after;
  resultados.complejidadConsumida = resultados.presupuestoInicial - fin.complejidad.after;

  console.log('\n=== Resumen ===');
  console.log('  Llamadas gastadas en toda la medición: ' + llamadas);
  console.log('  Complejidad consumida: ' + resultados.complejidadConsumida.toLocaleString() + ' pts');
  console.log('  (Recuerda: plan Free/Basic/Standard = 1.000 llamadas/día para toda la cuenta)');

  const fs = await import('node:fs/promises');
  await fs.writeFile('resultados.json', JSON.stringify(resultados, null, 2));
  console.log('\n  Escrito resultados.json — mándame ese archivo.\n');
})().catch(e => { console.error('\n  FALLO: ' + e.message + '\n'); process.exitCode = 1; });
