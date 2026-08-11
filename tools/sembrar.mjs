/**
 * Siembra un tablero de pruebas realista en monday.com  (v2, con control de presupuesto)
 *
 * Uso:  $env:MONDAY_TOKEN="..."; node sembrar.mjs
 *
 * Por que v2: la v1 murio a los 20 items con COMPLEXITY_BUDGET_EXHAUSTED.
 * Las MUTACIONES son carisimas: en una cuenta trial/free el presupuesto es de
 * 1.000.000 de puntos por minuto y 20 create_item se lo comieron entero.
 * Esta version mide el coste real, se autorregula y reintenta sola.
 */

const TOKEN = process.env.MONDAY_TOKEN;
if (!TOKEN || TOKEN.trim().length < 40) {
  console.error('\n  Falta MONDAY_TOKEN.\n');
  process.exit(1);
}

const ENDPOINT   = 'https://api.monday.com/v2';
const OBJETIVO   = 520;   // >500 para poder probar la paginacion de items_page
const LOTE       = 10;    // conservador; se ajusta solo segun el coste medido
const NOMBRE_TABLERO = 'Banco de pruebas';
const RESERVA    = 120000; // si queda menos presupuesto que esto, esperamos al reset

let llamadas = 0, esperas = 0, costeMedioMutacion = null;
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

async function gql(query, intento = 0) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': TOKEN },
    body: JSON.stringify({ query })
  });
  llamadas++;
  const json = await res.json();

  if (json.errors) {
    const e = json.errors[0];
    const code = e?.extensions?.code;
    if (code === 'COMPLEXITY_BUDGET_EXHAUSTED' && intento < 12) {
      const s = (e.extensions.retry_in_seconds ?? 60) + 3;
      esperas++;
      process.stdout.write('\r  presupuesto agotado, esperando ' + s + ' s...                    ');
      await dormir(s * 1000);
      return gql(query, intento + 1);
    }
    throw new Error(JSON.stringify(json.errors).slice(0, 500));
  }
  return json.data;
}

// --- generador de nombres --------------------------------------------------
const VERBOS  = ['Migrar','Revisar','Documentar','Corregir','Desplegar','Refactorizar',
  'Automatizar','Auditar','Integrar','Optimizar','Validar','Configurar'];
const OBJETOS = ['el modulo de pagos','la pasarela','el pipeline de CI','los reportes de cierre',
  'el login con OAuth','la base de datos','el catalogo de productos','las notificaciones',
  'el panel de administracion','la exportacion a Excel','el motor de busqueda','las plantillas de correo',
  'la facturacion electronica','el control de inventario','la sincronizacion nocturna'];
const SUFIJOS = ['','','','',' - fase 2',' (urgente)',' v2',' FINAL',' - pendiente'];

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const nombreBase = () => `${rnd(VERBOS)} ${rnd(OBJETOS)}${rnd(SUFIJOS)}`;
const ensuciar = (n) => rnd([
  (s) => s, (s) => s.toUpperCase(), (s) => s + ' ', (s) => '  ' + s,
  (s) => s + ' (1)', (s) => s.replace('o','ó'), (s) => s + ' - copia',
])(n);

const hoy = new Date();
const fechaRelativa = (d) => new Date(hoy.getTime() + d * 86400000).toISOString().slice(0, 10);

(async () => {
  console.log('\n=== Sembrando tablero de pruebas (v2) ===\n');

  const yo = await gql('query { me { id name } }');
  const miId = yo.me.id;

  const bs = await gql('query { boards(limit: 50, state: active) { id name items_count } }');
  const tablero = bs.boards.find(b => b.name === NOMBRE_TABLERO) || bs.boards[0];
  if (!tablero) { console.error('  No hay tableros.'); process.exitCode = 1; return; }

  const yaHay = tablero.items_count || 0;
  const faltan = Math.max(0, OBJETIVO - yaHay);
  console.log('  Usuario:  ' + yo.me.name);
  console.log('  Tablero:  "' + tablero.name + '" (id ' + tablero.id + ')');
  console.log('  Tiene ' + yaHay + ' items; objetivo ' + OBJETIVO + ' -> faltan ' + faltan + '\n');
  if (faltan === 0) { console.log('  Ya esta sembrado. Corre:  node medir.mjs\n'); return; }

  const cs = await gql(`query { boards(ids: [${tablero.id}]) { columns { id title type settings_str } } }`);
  const cols = cs.boards[0].columns;
  const buscar = (t) => cols.find(c => c.type === t);
  const colEstado    = cols.find(c => c.type === 'status' && /estado|status/i.test(c.title)) || buscar('status');
  const colPersona   = buscar('people') || buscar('person');
  const colFecha     = buscar('date');
  const colPrioridad = cols.find(c => c.type === 'status' && c !== colEstado);

  let etiquetas = [];
  try { etiquetas = Object.values(JSON.parse(colEstado.settings_str).labels).filter(Boolean); } catch {}
  const abiertos = etiquetas.filter(l => !/listo|done|termin|complet/i.test(l));
  const cerrados = etiquetas.filter(l =>  /listo|done|termin|complet/i.test(l));
  let etiquetasPrio = [];
  try { etiquetasPrio = Object.values(JSON.parse(colPrioridad.settings_str).labels).filter(Boolean); } catch {}

  console.log('  Columnas -> estado: ' + colEstado?.id + ' | persona: ' + colPersona?.id +
              ' | fecha: ' + colFecha?.id + ' | prioridad: ' + colPrioridad?.id);

  // nombres, con duplicados deliberados
  const base  = Array.from({ length: Math.floor(faltan * 0.88) }, nombreBase);
  const items = [...base];
  const cuantosDup = faltan - base.length;
  for (let i = 0; i < cuantosDup; i++) items.push(ensuciar(rnd(base)));
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [items[i],items[j]]=[items[j],items[i]]; }

  let sinDuenio = 0, vencidosAbiertos = 0, sinEstado = 0;
  const valoresPara = () => {
    const v = {};
    if (colPersona && Math.random() > 0.15) v[colPersona.id] = { personsAndTeams: [{ id: Number(miId), kind: 'person' }] };
    else sinDuenio++;

    let etiqueta = null;
    const r = Math.random();
    if (etiquetas.length) {
      if (r < 0.10) sinEstado++;
      else { etiqueta = (r < 0.22 && abiertos.length) ? rnd(abiertos) : rnd(etiquetas); v[colEstado.id] = { label: etiqueta }; }
    }
    if (colFecha) {
      const rF = Math.random();
      if (rF < 0.18) { v[colFecha.id] = { date: fechaRelativa(-Math.ceil(Math.random()*120)) }; if (!etiqueta || !cerrados.includes(etiqueta)) vencidosAbiertos++; }
      else if (rF < 0.85) v[colFecha.id] = { date: fechaRelativa(Math.ceil(Math.random()*90)) };
    }
    if (etiquetasPrio.length && Math.random() > 0.3) v[colPrioridad.id] = { label: rnd(etiquetasPrio) };
    return v;
  };

  console.log('\n  Creando ' + items.length + ' items. Las mutaciones son caras, esto va a');
  console.log('  pausarse solo cada vez que se agote el presupuesto del minuto. Dejalo correr.\n');

  const t0 = Date.now();
  let creados = 0;

  for (let i = 0; i < items.length; i += LOTE) {
    const trozo = items.slice(i, i + LOTE);
    const cuerpo = trozo.map((nombre, k) =>
      `m${k}: create_item(board_id: ${tablero.id}, item_name: ${JSON.stringify(nombre)}, ` +
      `column_values: ${JSON.stringify(JSON.stringify(valoresPara()))}, create_labels_if_missing: false) { id }`
    ).join('\n  ');

    const d = await gql(`mutation {\n  complexity { after reset_in_x_seconds }\n  ${cuerpo}\n}`);
    creados += trozo.length;

    const quedan = d?.complexity?.after;
    const resetEn = d?.complexity?.reset_in_x_seconds;
    if (costeMedioMutacion === null && quedan != null) {
      costeMedioMutacion = Math.round((1000000 - quedan) / trozo.length);
    }
    const pct = Math.round(creados / items.length * 100);
    process.stdout.write('\r  ' + creados + '/' + items.length + '  (' + pct + '%)  ' +
      (quedan != null ? 'presupuesto: ' + quedan.toLocaleString() : '') + '            ');

    // autorregulacion: si queda poco, esperamos al reset en vez de chocar
    if (quedan != null && quedan < RESERVA && resetEn) {
      esperas++;
      process.stdout.write('\r  pausa preventiva ' + (resetEn + 2) + ' s (presupuesto bajo)...        ');
      await dormir((resetEn + 2) * 1000);
    } else {
      await dormir(400);
    }
  }

  const seg = Math.round((Date.now() - t0) / 1000);
  console.log('\n\n=== Listo ===');
  console.log('  ' + creados + ' items creados en ' + Math.floor(seg/60) + ' min ' + (seg%60) + ' s');
  console.log('  Llamadas HTTP: ' + llamadas + '   Pausas por presupuesto: ' + esperas);
  if (costeMedioMutacion) {
    console.log('\n  DATO CLAVE: cada create_item costo ~' + costeMedioMutacion.toLocaleString() + ' puntos de complejidad.');
    console.log('  Con 1M/min (trial/free) eso son ~' + Math.floor(1000000/costeMedioMutacion) + ' escrituras por minuto.');
    console.log('  Con 5M/min (token de app) serian ~' + Math.floor(5000000/costeMedioMutacion) + ' por minuto.');
  }
  console.log('\n  Sembrado a proposito:');
  console.log('   - ~' + cuantosDup + ' duplicados  |  ' + sinDuenio + ' sin responsable  |  ' +
              sinEstado + ' sin estado  |  ~' + vencidosAbiertos + ' vencidos y abiertos');
  console.log('\n  Ahora:  node medir.mjs\n');
})().catch(e => { console.error('\n  FALLO: ' + e.message + '\n'); process.exitCode = 1; });
