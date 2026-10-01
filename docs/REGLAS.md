# Las nueve reglas

Todas son funciones puras sobre `ItemDeTablero[]` + `ContextoDeTablero`, con el
mismo contrato (`Regla`), y todas ignoran los items cerrados salvo que se diga lo
contrario. Un item está cerrado cuando su estado coincide con alguna de las
`etiquetasCerradas` del contexto.

| id | Qué marca | Peso | Severidad |
|---|---|---|---|
| `duplicados` | Items cuyo nombre normalizado coincide (sin tildes, mayúsculas, espacios ni sufijos de copia). Un grupo = un hallazgo. | 3 | alta si el grupo pasa de 3 |
| `vencido-abierto` | Fecha límite en el pasado y el item sigue abierto. | 3 | alta si el más atrasado pasa de 30 días |
| `responsable-desactivado` | Items abiertos cuyos responsables, **todos**, son usuarios desactivados de la cuenta. Se cruza por nombre (la columna de personas se lee como texto). Si no se pudo consultar la lista de usuarios, la regla se calla. | 3 | alta si pasa del 10 % del tablero |
| `sin-responsable` | Items abiertos sin nadie asignado. | 2 | alta si pasa del 25 % |
| `estancado` | Items abiertos sin ninguna actualización en `diasParaEstancado` días (`updated_at`). | 2 | alta si triplica el umbral |
| `huerfanos` | Intersección de tres señales: abierto, **sin responsable, sin fecha y sin movimiento** en `diasParaEstancado` días. Es trabajo muerto que sigue contando como pendiente. Requiere que el tablero tenga columna de personas y de fecha. | 2 | alta siempre |
| `sin-estado` | Items con la columna de estado vacía (abiertos o no: sin estado no se sabe). | 1 | baja |
| `etiquetas-parecidas` | Etiquetas de estado que son la misma escrita distinto ("En progreso" / "En Progreso"). | 1 | media |
| `campos-vacios` | Items abiertos a los que les falta **la mitad o más** (mínimo dos) de las `columnasClave` del tablero: las de tipo estado, personas, fecha, cronograma, correo y teléfono. El resumen dice qué columnas son las que más faltan. Con menos de dos columnas clave la regla se calla. | 1 | media si pasa del 25 % |

## Qué necesita cada una del contexto

- `columnaEstado`, `columnaResponsable`, `columnaFecha`: ids descubiertos **por tipo**
  de columna, no por nombre (el cliente puede llamar "Fase" a su estado).
- `usuariosDesactivados`: nombres tal como los muestra monday, de
  `users(kind: all) { name enabled }`. Una consulta barata que no toca items. Si
  falla, el controlador sigue sin ella y deja un `warn`.
- `columnasClave`: `{ id, titulo }` de las columnas de tipo
  `status | people | person | date | timeline | email | phone` del tablero.

## Puntaje

`100 − Σ (items afectados por la regla / items totales) × peso × 10`, redondeado y
acotado a 0. Un mismo item puede descontar por varias reglas: es deliberado, un
item vencido, sin dueño y huérfano está peor que uno solo vencido.

## Lo que estas definiciones deciden (y se puede cambiar)

- **Huérfano** se definió como la intersección de tres reglas y no como "item sin
  grupo" porque en monday todo item tiene grupo; la señal útil es "a nadie le
  importa", y eso es lo que miden las tres juntas.
- **Responsable desactivado** cruza por nombre y no por id para no pedir el JSON
  de la columna de personas (42 % más de complejidad en la consulta medida). Dos
  personas con el mismo nombre en la misma cuenta es el caso raro que se acepta.
- **Campos vacíos** usa "la mitad o más" en vez de un número fijo para que un
  tablero con dos columnas clave y uno con siete se evalúen con el mismo criterio.
