# Board Checkup — identificadores

Registrada el 11 de agosto de 2026 en el Centro de desarrollo de monday.

| Dato | Valor |
|---|---|
| Nombre | Board Checkup |
| Slug (PERMANENTE, no se puede cambiar) | `crearcodecesars-team_board-checkup` |
| App ID | `11872289` |
| Client ID (publico por diseno) | `7ce83fbbf1ecf2cbd2c545305396b442` |
| Cuenta de desarrollo | `crearcodecesars-team.monday.com` |
| Tablero de pruebas | "Banco de pruebas", id `18426090306`, 520 items |
| Version | v1 (borrador) |
| Descripcion corta | Find duplicates, stale items and gaps in your boards |

## Secretos — NO van aqui ni en ningun repo

`Client Secret` y `Signing Secret` viven solo en la consola de monday.
Cuando exista el backend, van como variables de entorno en Render.

## Archivo de asociacion de dominio

Contenido verificado (formato confirmado contra un proveedor que lo sirve en
produccion; el ejemplo de la documentacion de monday sale truncado):

```json
{"apps":[{"clientID":"7ce83fbbf1ecf2cbd2c545305396b442"}]}
```

Debe responder 200, sin auth, sin redireccion y con `Content-Type: application/json`
en CADA dominio que use la app:

- `https://crearcodecesar.com/monday-app-association.json`  (hoy devuelve `{}`)
- `https://app.crearcodecesar.com/monday-app-association.json`  (cuando exista)

## Columnas del tablero de pruebas

| Columna | id | tipo |
|---|---|---|
| Responsable | `project_owner` | people |
| Estado | `project_status` | status |
| Vencimiento | `date` | date |
| Prioridad | `priority_1` | status |

Etiquetas de Estado: En curso, Listo, Detenido, No iniciado.

## Numeros medidos (11-ago-2026, cuenta trial, desde Valledupar)

| Operacion | Tiempo | Complejidad |
|---|---|---|
| Query trivial (latencia pura) | 517 ms | 11 |
| Leer 500 items, afinado | 1.650 ms | 7.020 |
| Leer 500 items, todas las columnas + value | 1.890 ms | 12.020 |
| Crear UN item | - | 30.504 |

Presupuesto: 1M/min en trial y free, 10M/min token personal normal,
5M/min lectura + 5M/min escritura para tokens de app.
Llamadas diarias: 1.000 en Free/Basic/Standard, 10.000 Pro, 25.000 Enterprise.
