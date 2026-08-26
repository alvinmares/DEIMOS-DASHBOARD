# DEIMOS Dashboard — Guía de Operación

Dashboard de operaciones de carriers para Nu México.
Trackea **Ticket Rate / 1k envíos** y **Delivery Rate** para DHL, Estafeta y 99 Minutos.

| | |
|---|---|
| **Dashboard** | https://alvinmares.github.io/DEIMOS-DASHBOARD/ |
| **Repo** | `alvinmares/DEIMOS-DASHBOARD` (público, GitHub Pages desde `main` / root) |
| **Owner** | Alvin Mares — carriers operations Nu México |
| **Autor original** | Carlos Torruco (transferido 10 ago 2026) |
| **Último corte** | 22 ago 2026 |

---

## 1. Estructura del repo

```
index.html   ← app: HTML + CSS + lógica de render. Casi nunca se toca.
data.js      ← TODA la data + el pie de estado. Único archivo que editas cada ciclo. (~11 KB)
README.md
```

`index.html` inyecta `data.js` con un timestamp en cada carga:

```html
<script>document.write('<scr'+'ipt src="data.js?t='+Date.now()+'"><\/scr'+'ipt>');</script>
```

> **No tienes que tocar nada de esto.** GitHub Pages manda `cache-control: max-age=600` en el HTML, así que un `index.html` cacheado podría servir datos de un ciclo anterior. El timestamp garantiza que `data.js` siempre se pida fresco, sin importar el caché del HTML.
>
> Si *tú* ves datos viejos justo después de publicar, es el caché de tu navegador con el HTML: un hard reload (`Cmd+Shift+R`) lo resuelve.

### Qué exporta `data.js`

| Constante | Contenido |
|---|---|
| `DATA_META` | Corte, publicación, estado de la corrida y caveats (ver §2) |
| `ALL_MONTHS` | Meses activos. `*` = mes parcial |
| `RAW` | Por carrier: `cr` (TR/1k), `tix` (tickets), `env` (envíos) — mensual |
| `DR_DATA` | Delivery Rate % mensual. `null` = mes aún inmaduro |
| `SEM_WEEKS` / `SEM_LABELS` | Semanas lunes–domingo (ISO) |
| `SEM_DATA` | `env` / `tix` / `tr` semanal por carrier |
| `QUEJAS_CATS` / `QUEJAS_MES` | Motivos de queja: catálogo y desglose mensual por carrier (ver §9) |
| `GEO_ESTADOS` / `GEO_MES` / `GEO_CP` | Geografía de las quejas: estado y CP (ver §10) |
| `DES_DIA` / `DES_LAG` / `DES_EST` | Desfase, cohortes y series diarias (ver §11) |

Todos los arrays de un mismo bloque deben tener **exactamente la misma longitud** que `ALL_MONTHS` (o `SEM_WEEKS`).

Al final de `data.js` hay un bloque de **presentación** (el pie de estado, §6). Es lo único que no es data: está ahí y no en `index.html` porque `data.js` es el único archivo que la actualización reescribe. Si algún día se mueve a `index.html`, se borra ese bloque completo — nada más depende de él.

### Secciones del dash

| Sección | Función JS |
|---|---|
| Resumen | `renderResumen()` |
| Tendencia | `renderTendencia()` |
| Por carrier | `renderCarrier()` |
| Tabla detalle | `renderTabla()` |
| ¿De qué se quejan? | `buildQuejasChart()` |
| Delivery Rate | `renderDelivery()` |
| Vista Semanal | `renderSemanal()` |

---

## 2. `DATA_META`

```js
const DATA_META = {
  corte: '2026-08-12',                      // último día con datos (envíos y tickets, alineados)
  publicado: '2026-08-13',
  etiqueta: '12 ago 2026',                  // alimenta los rangos de fecha visibles
  actualizado: '2026-08-13T12:38:00-06:00', // cuándo corrió la actualización
  ok: true,                                 // ¿la corrida terminó sin fallas?
  mensaje: 'Envíos e históricos sin drift · tickets alineados al corte',
  notas: ['...'],                           // caveats del ciclo → tooltip del pie
};
```

`etiqueta` es la que manda en los 5 nodos de `index.html` que muestran el rango de fechas
(`#sidebarPeriod`, el subtítulo de la dona y 3 `.card-sub` de "% del total de tickets").
Ese rango **estaba hardcodeado** y se quedaba atrás cada ciclo; ahora el bloque de
presentación lo reescribe al cargar. Son nodos estáticos: sobreviven los re-renders,
así que basta un pase.

`ok` lo escribe la corrida. Ponlo en `false` si una fuente falló, si no pudiste alinear
el corte de tickets con el de envíos, o si publicaste algo a medias — y explica qué pasó
en `mensaje`, porque esa línea se muestra en el dashboard.

---

## 3. Fuentes de datos

| Métrica | Fuente | Acceso |
|---|---|---|
| Tickets | Google Form → Sheet `1l-41UEE_CsqBuv5KsQ9b1BHHRmzBnI-c5xYeUgr1TNs` — *"Lifecycle - Problemas y dudas con envíos de tarjeta (Respuestas)"* | Owner: mayra.molina@nubank.com.mx |
| Envíos y DR | Databricks `etl.mx__contract.frodo__deliveries` | — |
| Metodología | Dashboard QuickSight de Patrick (data owner) | validación |
| Problemas de entrega | Databricks `etl.mx__contract.hel__delivery_problems` | solo pestaña §11 |

### Columnas del Sheet que importan

| Col | Campo |
|---|---|
| A | `Marca temporal` |
| H | `Elige la Mensajería` → `DHL` / `Estafeta` / `99 Minutos` |
| I | `¿Cómo te ayudamos?` (motivo de nivel 1) |
| J | `Estado registrado en el Shipping address` (código de 2 letras) |
| M | `CP verificado en SEPOMEX` |
| N | `Colonia` |
| O | `¿Qué escenario se presenta?` (detalle) |

La col. **I** es la que alimenta la dona de motivos. Tiene 5 valores vigentes, pero
llegan **6 cadenas distintas**: "Cambio de carrier" aparece con el texto mal escrito
(`Solosi`) hasta el 8 ago 2026 y bien escrito desde el 9. **Hay que fundirlas**, si no
el motivo sale partido en dos.

| Valor en col. I | Etiqueta en el dash |
|---|---|
| Tarjeta entregada, pero el cliente indica que no la recibió | Falsa entrega |
| Entregas cruzadas | Entregas cruzadas |
| Problemas con la Mensajería | Problemas con la mensajería |
| Cambio de carrier (`Solosi…` y `Solo si…`) | Cambio de carrier |
| Problemas internos | Problemas internos |

La col. **O** no es una taxonomía paralela: es el sub-desglose de *un solo* motivo.
Sus 3 valores suman exactamente los tickets de "Problemas con la Mensajería" (998 en
2026 YTD), y viene vacía en el resto. Hoy el dash no la usa.

⚠️ **Filtra siempre `H` a los tres nombres exactos.** Hay filas basura donde `H` trae un UUID en lugar del carrier (form mal versionado). Sin el filtro los conteos se inflan.

---

## 4. Flujo de actualización

### Paso 1 — Determinar el corte

Frodo va **~2 días atrás** del día actual. Consulta hasta dónde llega antes de nada:

```sql
SELECT DATE(CONVERT_TIMEZONE('UTC','America/Mexico_City', delivery__created_at)) AS dia,
       COUNT(*) AS envios
FROM etl.mx__contract.frodo__deliveries
WHERE CONVERT_TIMEZONE('UTC','America/Mexico_City', delivery__created_at) >= '2026-08-01'
  AND delivery__carrier IN ('delivery_carrier__dhl','delivery_carrier__estafeta','delivery_carrier__c99_minutos')
GROUP BY 1 ORDER BY 1
```

El último día con volumen normal es tu corte. **Corta tickets y envíos en la misma fecha** — si no, el TR/1k sale inflado (los tickets están al día, los envíos no).

> Los domingos tienen 0 envíos creados. Si tu corte cae en sábado, el domingo siguiente ya está "completo" y puedes cerrar la semana.
>
> Revisa también los días hábiles: si un lunes trae 0 envíos, no es normal. El 10 ago 2026 pasó exactamente eso y el volumen apareció corrido a los dos días siguientes (~26k vs ~19k de un día típico). Anótalo en `DATA_META.notas` y avisa al data owner.

### Paso 2 — Envíos y Delivery Rate (mensual)

```sql
SELECT
  DATE_FORMAT(CONVERT_TIMEZONE('UTC','America/Mexico_City', delivery__created_at),'yyyy-MM') AS mes,
  CASE
    WHEN delivery__carrier = 'delivery_carrier__dhl' THEN 'DHL'
    WHEN delivery__carrier = 'delivery_carrier__estafeta' THEN 'Estafeta'
    WHEN delivery__carrier = 'delivery_carrier__c99_minutos' THEN '99min'
  END AS carrier,
  COUNT(*) AS envios,
  ROUND(SUM(CASE WHEN delivery__status = 'delivery_status__delivered' THEN 1 ELSE 0 END)
        / COUNT(*) * 100, 2) AS dr_pct
FROM etl.mx__contract.frodo__deliveries
WHERE CONVERT_TIMEZONE('UTC','America/Mexico_City', delivery__created_at) >= '2026-01-01'
  AND CONVERT_TIMEZONE('UTC','America/Mexico_City', delivery__created_at) <  '2027-01-01'
  AND delivery__carrier IN ('delivery_carrier__dhl','delivery_carrier__estafeta','delivery_carrier__c99_minutos')
GROUP BY 1,2 ORDER BY 1,2
```

Corre **todos los meses, no solo el actual**: la tabla se rellena hacia atrás y los meses viejos se mueven. Compara los envíos históricos contra lo ya publicado; si un mes se mueve más de 5%, hubo backfill y hay que reportarlo.

### Paso 3 — Envíos semanales

```sql
SELECT
  DATE_FORMAT(DATE_TRUNC('week', CONVERT_TIMEZONE('UTC','America/Mexico_City', delivery__created_at)),'MM-dd') AS semana,
  CASE
    WHEN delivery__carrier = 'delivery_carrier__dhl' THEN 'DHL'
    WHEN delivery__carrier = 'delivery_carrier__estafeta' THEN 'Estafeta'
    WHEN delivery__carrier = 'delivery_carrier__c99_minutos' THEN '99min'
  END AS carrier,
  COUNT(*) AS envios
FROM etl.mx__contract.frodo__deliveries
WHERE CONVERT_TIMEZONE('UTC','America/Mexico_City', delivery__created_at) >= '2026-01-01'
  AND delivery__carrier IN ('delivery_carrier__dhl','delivery_carrier__estafeta','delivery_carrier__c99_minutos')
GROUP BY 1,2 ORDER BY 1,2
```

Nunca calcules los envíos semanales a mano a partir del mensual.

> `DATE_TRUNC('week', …)` mete los primeros días de enero en la semana del 29-dic-2025. `SEM_WEEKS` arranca en `01-05` a propósito: esa semana parcial no se publica.

### Paso 4 — Tickets, sin descargar el xlsx

En vez de bajar el archivo, se le pregunta al Sheet directamente con la **Google Visualization API**. Abre el Sheet en el navegador (para tener sesión) y corre:

```js
async function tq(q){
  const id = '1l-41UEE_CsqBuv5KsQ9b1BHHRmzBnI-c5xYeUgr1TNs';
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=0&tq=` + encodeURIComponent(q);
  return (await fetch(url, {credentials:'include'})).text();
}

// tickets por día y carrier (month() es 0-indexed: enero = 0)
await tq(`select month(A), day(A), H, count(A)
          where A >= date '2026-01-01'
            and (H='DHL' or H='Estafeta' or H='99 Minutos')
          group by month(A), day(A), H`);
```

Desde el detalle diario armas mes y semana (lunes–domingo) y cortas donde quieras. Requiere `tqx=out:csv` — `out:json` pide OAuth y falla.

> El CSV crudo son ~15 KB y no cabe de un jalón en la respuesta de la herramienta. Agrega en el mismo JS (arma los buckets de mes y semana ahí) y devuelve sólo los totales.

### Paso 5 — Calcular

```
TR/1k = (tickets / envíos) × 1,000     ← redondeado a 2 decimales
```

### Paso 6 — Editar `data.js` y publicar

Actualiza los arrays, `DATA_META` (incluyendo `actualizado`, `ok`, `mensaje` y `notas`), commit y push. GitHub Pages tarda ~1 min. `index.html` no se toca.

### Paso 7 — Verificar

Abre el dash con un query string nuevo (`?cb=loquesea`) para saltarte el caché y confirma en consola:

```js
DATA_META                              // corte correcto
RAW.DHL.cr.length === ALL_MONTHS.length
Object.keys(charts).length             // > 0, las gráficas se construyeron
document.getElementById('sidebarStatus').innerText   // pie: fecha + estado
```

Recorre las 7 secciones y revisa la consola.

> **Ruido conocido:** la página "Por carrier" tira ~8 excepciones de Chart.js
> (`Canvas is already in use`) porque el loop de mini-gráficas corre dos veces al
> cargar. Es cosmético — las 8 mini-gráficas quedan montadas y se ven bien. No es
> señal de que tu actualización rompió algo. Arreglarlo requiere tocar `index.html`.

---

## 5. Cierre de mes

1. Quita el `*` de `ALL_MONTHS` (`'Ago 26*'` → `'Ago 26'`) y del botón correspondiente en el sidebar de `index.html`.
2. Espera ~2–3 semanas y **entonces** llena el DR del mes (ver §6).
3. Agrega el nuevo mes parcial a `ALL_MONTHS`, un `null` al final de cada array de `DR_DATA`, y un botón nuevo en el sidebar.

---

## 6. Pie de estado y autovalidación

Al fondo del sidebar, en letras grises chicas:

```
Actualizado 13 ago 2026, 12:38
✓ Actualización exitosa
```

Sale de `DATA_META.actualizado` y `DATA_META.ok`. Los `notas` van en el tooltip.

Además, al cargar se **autovalida** la data: que todos los arrays de `RAW`, `DR_DATA` y
`SEM_DATA` cuadren con `ALL_MONTHS` / `SEM_WEEKS`, que `SEM_LABELS` cuadre con
`SEM_WEEKS`, y que se haya construido al menos una gráfica. Si algo no cuadra el pie
pasa a **⚠ Actualización con problemas** y nombra el array culpable, aunque hayas
puesto `ok: true`. Es la red que atrapa el error más fácil de cometer: agregar una
semana o un mes y olvidar extender uno de los nueve arrays.

Los dos estados están probados. Si ves el ⚠ después de publicar, el detalle está en la
segunda línea y en el tooltip.

---

## 7. ⚠️ El Delivery Rate madura

El DR se mide sobre la cohorte de envíos **creados** en el mes. Un envío creado el 30 de julio todavía no se ha entregado el 1 de agosto, así que cuenta como no-entregado.

Esto ya causó un error real: el dash publicaba julio 2026 en **76.05 / 80.15 / 77.67**. Al madurar la cohorte, los valores reales resultaron ser **84.39 / 91.35 / 90.87** — una diferencia de hasta 13 puntos.

**Regla:** deja el DR en `null` hasta que el mes tenga al menos ~3 semanas de cerrado. Un DR por debajo de ~70% en un mes reciente casi siempre es inmadurez, no un problema del carrier. Y cada ciclo, vuelve a correr el DR de los 2–3 meses previos: siguen subiendo.

> Referencia de cuánto se mueve: al 12 ago, julio ya llevaba 13 días cerrado y subió a
> **84.54 / 91.60 / 91.23** — arriba de lo que se publicó el ciclo anterior.

**DHL vive en la banda 84–87%**, contra ~91 de Estafeta y ~92 de 99min. Cuando DHL sale abajo de 85 en un mes maduro no es un evento nuevo, es su comportamiento normal. Vale la pena tenerlo como conversación de fondo con el carrier, no como alerta de cada ciclo.

---

## 8. Pendientes conocidos

- **Doble render en "Por carrier"** — las excepciones cosméticas de Chart.js (§4, paso 7). Se arregla destruyendo la instancia previa antes de recrear cada mini-gráfica.
- **El pie de estado vive en `data.js`** — su lugar natural es `index.html`. Está en `data.js` porque es el archivo que se reescribe cada ciclo y porque `index.html` (~86 KB) no se puede parchear por la API de GitHub sin retransmitirlo completo.

---

## 9. La pestaña de quejas y su filtro de periodo

Reconstruida el 25 ago 2026. Antes eran totales fijos heredados del ciclo de Carlos,
con una taxonomía que ya no existía en el formulario y una ventana de fechas que nadie
sabía cuál era. Hoy:

- **`QUEJAS_MES`** guarda el desglose **mensual** por carrier y motivo, alineado a
  `ALL_MONTHS`. Se regenera con la query documentada en el encabezado del bloque en
  `data.js` (col. I del Sheet, agrupada por mes, cortada en `DATA_META.corte`).
- **La autovalidación del pie** revisa que cada arreglo tenga el largo de `ALL_MONTHS`
  y que los motivos **sumen exactamente** `RAW[carrier].tix`. Si te sale
  ⚠ *Actualización con problemas* nombrando `QUEJAS_MES`, es que la agregación por
  motivo y la de tickets no cuadran: casi siempre es la doble cadena de
  "Cambio de carrier" (§3) o un corte de fechas distinto.
- **El filtro** vive en un bloque al final de `index.html`. Da presets
  (2026 YTD / últimos 3 meses / mes actual) y un rango libre mes-desde → mes-hasta,
  y con cada cambio recalcula la dona, los 4 KPIs y la tabla de detalle de los tres
  carriers. Si el último mes del rango es parcial lo avisa en naranja.
- El bloque **se desactiva solo** si `QUEJAS_MES` no existe, así que un `data.js`
  viejo no rompe la pestaña. `QUEJAS_DATA` sigue existiendo, derivado del acumulado
  del año, solo por compatibilidad.

> El markup hardcodeado de los 3 paneles **no se borró**: el render lo sobrescribe.
> Es deuda cosmética, no un riesgo — pero si algún día ves números viejos en los KPIs,
> es que el render no corrió, no que la data esté mal.

> Los verbatims del tercer card siguen siendo una muestra estática y **no** se filtran.
> Igual la nota metodológica del 81–91% en la caja de arriba: es un rango del año
> completo y no se recalcula por periodo.

---

## 10. Geografía de las quejas

Agregada el 25 ago 2026, dentro de cada panel de carrier de la pestaña de quejas.
Dos tarjetas: ranking de estados y drill-down al CP del estado seleccionado. Las
dos respetan el filtro de periodo de la §9.

### De dónde sale

Del mismo formulario, no de Frodo:

| Col. | Campo | Calidad |
|---|---|---|
| J | Estado | **Buena.** Códigos de 2 letras ya normalizados: llegan los 32 estados y nada más, sin variantes de texto libre. 86% de cobertura, estable mes a mes. |
| M | CP verificado en SEPOMEX | Buena, 80% de cobertura. |
| N | Colonia | Texto libre. Se usa **solo como etiqueta** del CP (la colonia más frecuente dentro de él). |

El 14% sin estado se publica como `ND` → "Sin dato", para que los totales cuadren
con `RAW.tix`. El validador del pie comprueba justamente eso.

### ⚠️ No hay denominador. Son conteos, no tasas.

Esto es lo más importante de la sección y por eso está escrito en la UI:

- `frodo__deliveries` **no tiene ninguna columna geográfica**.
- `logistics_information` tiene `delivery_address_state`, pero está **NULL en
  sus 55M filas**. La columna existe y nunca se pobló. No te ilusiones al verla.

Sin envíos por estado no hay TR/1k por estado. Un estado arriba del ranking puede
estar ahí solo porque ahí enviamos más tarjetas. **La única lectura de calidad que
sí es válida es la columna "vs. previo"**, que compara contra los N meses
inmediatos anteriores del mismo largo.

Si algún día se puebla `delivery_address_state` (o aparece otra fuente de envíos
por estado que no sea PII de clientes), lo que hay que hacer es sumar un TR/1k por
estado y reordenar el ranking por ahí. Ese es el upgrade natural.

### Por qué CP y no colonia

Se probó agrupar por colonia y **no funciona**: 10,250 colonias distintas para
16,373 tickets, mediana de **1 ticket**, y los nombres se repiten entre estados
("Centro", "Benito Juárez"). La colonia más grande del país son 63 tickets en 8
meses; la más grande de un carrier en un estado, 7.

El CP sí concentra, porque agrupa varias colonias. El caso que lo dejó claro:

> **CP 54715** (Valle de la Hacienda, Edo. de México) junta **113 tickets de
> 99minutos** en el año — 6.3% de todo el estado. Partido por colonia, ese mismo
> CP queda en pedazos de ≤30 y el patrón desaparece.

`GEO_CP` guarda solo pares `carrier|estado` con **≥40 tickets** y de cada uno el
**top 6** de CPs (61 pares, 366 filas). El resto de la cola no se guarda: son casi
todos de 1 ticket. `t` es el total mensual de tickets **con CP** del par, para
poder mostrar qué porcentaje cubre el top 6.

### Al regenerar

```sql
-- (gviz sobre el Sheet, ver §4 paso 4)
select month(A), H, J, M, N, count(A)
where A >= date '2026-01-01' and (H='DHL' or H='Estafeta' or H='99 Minutos')
group by month(A), H, J, M, N
```

Corta en `DATA_META.corte` y verifica que `GEO_MES` sume exactamente
`RAW[carrier].tix` (753 / 9,509 / 8,759 al corte del 22 ago). Si no cuadra, el pie
del dashboard lo va a gritar.

> El bloque `GEO_CP` son ~19 KB, así que `data.js` pasó de 24 a 48 KB. Sigue
> siendo editable por el editor web de GitHub, pero ya no es un archivo que quieras
> retransmitir completo por la API.

---

## 11. Desfase y picos

Agregada el 25 ago 2026. Responde tres cosas: cuánto tarda un ticket en llegar
después del evento del envío, si los envíos creados un día concreto generaron un
pico, y cuántos tickets entran por día, de qué carrier y de qué estado.

### ⚠️ Dos poblaciones en la misma pestaña

Esto es lo que hay que entender antes de mirar cualquier número:

| | `form` | `hel` |
|---|---|---|
| Qué es | Los tickets del Google Form | `hel__delivery_problems`, excepciones del sistema |
| Volumen 2026 | 19,021 | ~179,000 |
| ¿Alimenta el TR/1k? | **Sí** | No |
| Liga al envío | 68–95% vía código de guía | **100% vía `delivery_id`** |
| Motivo y geografía | Sí | No (`reason` viene NULL) |

**No son sumables ni comparables en nivel.** Cada panel dice de cuál viene, y la
caja amarilla arriba de la pestaña lo repite. Se usan las dos porque cada una
puede lo que la otra no: el form tiene geografía y motivo; hel tiene el vínculo
exacto al envío, que es lo único que permite armar cohortes por día de creación.

### Por qué la cohorte de creación usa hel y no el form

Para agrupar tickets del form por el día en que se creó su envío hay que unir el
código de la col. F contra Frodo. **El join sí funciona**, con cuatro llaves:

| Formato en col. F | Llave en Frodo | Share |
|---|---|---|
| `N######X######` | `delivery__reference_code` | 34% |
| 22 chars alfanum. | `delivery__carrier_code` (Estafeta) | 36% |
| 10 dígitos | `delivery__carrier_code` (DHL) | 3% |
| UUID | `delivery__package_id` | 24% |

Los UUIDs **no son basura**: son el `package_id` que el agente pegó en lugar del
número de guía. Con las cuatro llaves el match sale ~95%.

El problema no es el join, es la plomería: mover 19 mil códigos del Sheet a
Databricks solo puede pasar por el contexto del agente, y son ~590 KB de query
**por ciclo**. Con hel el mismo cálculo es una query de 20 líneas y sale gratis.
Si algún día se ingesta el form al warehouse, esto se puede rehacer con la
población del TR/1k y sería lo ideal.

### Los cuatro paneles

1. **Histograma de desfase**, 18 cubetas, con mediana y p90 por carrier, y toggle
   de fuente. Con `form` mide días entre la entrega que reporta el ticket
   (col. K) y su creación; con `hel`, entre la creación del envío y el alta del
   problema.
2. **Picos por día de creación del envío**: % de los envíos de cada día que
   acabaron con un problema. Numerador hel, denominador `DIA_DATA.env`. Marca en
   rojo lo que pasa de 2x la mediana.
3. **Tickets que entran por día** (form), con la serie por fecha de entrega
   reportada encima. La distancia horizontal entre las dos curvas *es* el desfase.
4. **Tickets por día y estado** (form), apilado, top 6 + otros + sin dato.

### Números de referencia al corte del 22 ago

- **form**: el ticket llega mediana **1 día** (DHL) o **2 días** (Estafeta, 99min)
  después de la entrega que reporta. p90 de 4 días en los tres. El 94% cae entre
  0 y 5 días.
- **hel**: el problema se levanta mediana 2–3 días después de crear el envío,
  p90 entre 5 y 7. Cero negativos por construcción.
- **Picos**: la mediana de un día es **4.08%** de sus envíos con problema. Los
  picos reales del año son **05-07 (37.26%)** y **06-04 (25.71%)**, muy por
  encima del resto.

### Caveats al regenerar

- El panel de picos **omite los días anteriores a `DIA_LOTE`** (120 días). En ese
  tramo los envíos se creaban en lote, así que la cohorte diaria daba ratios de
  hasta 89% que no significan nada y aplastaban la escala.
- La serie de `entregas` viene de `delivery__status_updated_at`, que también trae
  actualizaciones en lote: 5–6 días con picos, todos entre el 23-ene y el 23-mar
  salvo uno de 99min el 1-jul. Cero desde mayo.
- El desfase del form excluye **194 filas absurdas** (>400d o <-30d; 24 son error
  de año, escribieron 2025) y **sí incluye 426 negativos**, que salen en la cubeta
  `<0` y son error de captura del agente.
- La col. K solo está en el 86% de los tickets, así que el histograma `form`
  corre sobre 16,128 filas y no sobre las 19,021.

---

## 12. Severidad TR/1k

| Color | Rango | CSS |
|---|---|---|
| 🟢 Verde | < 5 | `cr-g` |
| 🟡 Amarillo | 5 – 7 | `cr-y` |
| 🟠 Naranja | 7 – 10 | `cr-o` |
| 🔴 Rojo | > 10 | `cr-r` |

Delivery Rate (higher is better): 🟢 ≥ 90 · 🟡 85–90 · 🟠 75–85 · 🔴 < 75

---

*Actualizado: 25 ago 2026 — datos al 22 ago 2026 (agosto parcial)*

*Última función agregada: desfase y picos (§11).*
