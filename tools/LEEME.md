# Medición previa — app de monday.com

Antes de escribir una línea de producto medimos si el diseño cabe en la
restricción dura de Sidekick: **responder de forma síncrona en 2–3 segundos**.

## Cómo correrlo

1. Necesitas una cuenta de monday.com (sirve una gratis/trial para medir, pero
   ojo: las cuentas gratis tienen 1M de complejidad por minuto en vez de 10M).
2. Saca tu token: en monday, **avatar (abajo a la izquierda) → Developers →
   My access tokens → Show**.
3. En PowerShell, dentro de esta carpeta:

   ```powershell
   $env:MONDAY_TOKEN="pega_aqui_tu_token"
   node medir.mjs
   ```

   O en cmd:

   ```cmd
   set MONDAY_TOKEN=pega_aqui_tu_token
   node medir.mjs
   ```

4. Mándame el `resultados.json` que queda en esta carpeta.

**El token nunca se imprime ni se escribe en `resultados.json`.** Se lee de la
variable de entorno y se usa solo en la cabecera `Authorization`.

## Qué mide

| Paso | Qué responde |
|---|---|
| 0 | Presupuesto disponible y coste de una query trivial (línea base) |
| 1 | Cuál es el tablero más grande de la cuenta |
| 2 | Qué columnas relevantes tiene (estado, personas, fechas, correo, teléfono) |
| 3 | Escalera 100/250/500 ítems, comparando el caso **pesado** (todas las columnas + JSON crudo) contra el **afinado** (solo lo necesario, solo texto) |
| 4 | Cuántas llamadas y cuánto tiempo cuesta leer el tablero **completo** paginando — esto es lo que costaría el escaneo programado |

Cada medición se repite 3 veces y se reporta la mediana, para que un pico de red
no ensucie el resultado.

## El veredicto que buscamos

- **Afinado 500 por debajo de ~1.500 ms** → el diseño de la especificación se
  sostiene: escaneo en vivo dentro de la conversación de Sidekick.
- **Entre 1.500 y 3.000 ms** → bajar el tope a 250 ítems y apoyarse más en caché.
- **Por encima de 3.000 ms** → el escaneo en vivo no cabe. El producto pasa a ser
  *caché primero*: el tool responde desde el último escaneo programado y ofrece
  refrescar. No es peor producto, pero es otro, y es mejor saberlo hoy.

## El otro número que importa

El plan **Free / Basic / Standard tiene 1.000 llamadas de API por día para toda
la cuenta del cliente**, compartidas con cualquier otra app instalada. Pro son
10.000 y Enterprise 25.000 (ambos blandos). El paso 4 nos dice cuántas llamadas
nos costaría un escaneo completo — si es una fracción notable de esas 1.000,
el escaneo programado tiene que ser semanal por defecto en los planes chicos, no
diario, y con presupuesto configurable.
