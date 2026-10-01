# Board Checkup

Sidekick tool para monday.com que diagnostica la salud de un tablero.

> **Sidekick, ¿qué está mal en este tablero?**
> → *Salud 62/100. 14 ítems duplicados, 31 sin responsable, 9 con fecha vencida
> y estado abierto. ¿Te muestro los duplicados?*

---

## Por qué existe

Los competidores del espacio hacen bien **una** cosa —deduplicar— y para usarlos
hay que instalar la app, abrirla y configurarla. Este hace un **diagnóstico
completo** y responde **donde el usuario ya está**: dentro de la conversación.

Ninguno de los diez competidores medidos en el marketplace expone un Sidekick
tool. El diferenciador no es el algoritmo, es la invocación.

## Restricciones que moldean el diseño

Todas medidas o verificadas, no supuestas. Ver `docs/`.

| Restricción | Consecuencia |
|---|---|
| Un Sidekick tool debe ser **síncrono** y responder en segundos | El escaneo en vivo se topa en 500 ítems (1.650 ms medidos) |
| Un solo bloque de acción por invocación | Cuatro tools separados, no uno genérico |
| **Crear un ítem cuesta 30.504 pts; leer 500 cuesta 7.020** | El diagnóstico es casi gratis, la corrección es cara |
| Free/Basic/Standard: **1.000 llamadas de API al día para toda la cuenta** | Escaneo programado semanal por defecto, no diario |
| Los servicios gratis de Render se duermen en 15 min y tardan ~1 min en despertar | Instancia de pago obligatoria |

De la tercera y la cuarta sale la regla más importante del producto:
**Sidekick solo diagnostica, nunca corrige.** No es prudencia, es que no cabe.

## Estructura

```
src/
  diagnostics/      logica pura, sin dependencias de monday ni de Nest
    normalize.ts      normalizacion de nombres (el corazon de duplicados)
    rules/            una regla por diagnostico, todas con el mismo contrato
  monday/           todo lo que toca la API de monday
    monday-api.client.ts   la consulta "afinada": 42% menos complejidad
    monday-jwt.guard.ts    verificacion del JWT que manda monday
  tools/            los Run URL de los bloques de accion
tools/              scripts de medicion y de siembra (no van al build)
docs/               datos de la app y resultados de las mediciones
```

Las reglas son funciones puras sobre `ItemDeTablero[]`: se prueban sin red, sin
mocks de HTTP y sin levantar Nest. Por eso los tests de `normalize` y de
duplicados corren en milisegundos.

## Correr

```bash
npm install
npm test
cp .env.example .env    # y rellenar los dos secretos desde la consola de monday
npm run start:dev
```

## Estado

- [x] Normalización de nombres, con tests
- [x] Regla de duplicados, con tests
- [x] Cliente de la API de monday con la consulta afinada
- [x] Guard del JWT de monday
- [x] Run URL de `diagnose-board`
- [x] HSTS y `monday-app-association.json`
- [x] Resolver el tablero por **nombre** y no por id — los usuarios dicen "el tablero de Marketing"
- [x] Las **nueve** reglas implementadas y registradas en el servicio, con tests
      (45 en verde): duplicados, etiquetas casi iguales, sin estado, sin responsable,
      estancado, vencido-abierto, responsable desactivado, campos vacíos, huérfanos
      (ver `docs/REGLAS.md` para la definición exacta de cada una)
- [ ] Registrar el bloque de acción en el Centro de desarrollo
- [ ] Vista de tablero con las acciones correctivas
- [ ] Escaneo programado e historial de puntaje (hoy no hay persistencia)


## Lo que falta confirmar

- **Qué secreto firma el JWT de un bloque de acción.** La documentación aclara
  que los webhooks de ciclo de vida usan el Client Secret y los de tablero el
  Signing Secret, pero no dice cuál usan las acciones. El guard prueba el
  Signing primero y cae al Client, y deja un log. En cuanto se vea en
  producción, se fija uno y se borra el fallback.
- **El timeout exacto** de una invocación de Sidekick. No está publicado.
