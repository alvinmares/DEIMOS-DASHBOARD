# DEIMOS Dashboard — Guía de Operación

Dashboard de operaciones de carriers para Nu México.
Trackea **Ticket Rate / 1k envíos** y **Delivery Rate** para DHL, Estafeta y 99 Minutos.

| | |
|---|---|
| **Dashboard** | https://alvinmares.github.io/DEIMOS-DASHBOARD/ |
| **Repo** | `alvinmares/DEIMOS-DASHBOARD` (público, GitHub Pages desde `main` / root) |
| **Owner** | Alvin Mares — carriers operations Nu México |
| **Autor original** | Carlos Torruco (transferido 10 ago 2026) |
| **Último corte** | 9 ago 2026 |

---

## 1. Estructura del repo

```
index.html   ← app: HTML + CSS + lógica de render. Casi nunca se toca.
data.js      ← TODA la data. Este es el único archivo que editas cada ciclo. (~5 KB)
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
| `DATA_META` | Fecha de corte y de publicación (aparece en los headers) |
| `ALL_MONTHS` | Meses activos. `*` = mes parcial |
| `RAW` | Por carrier: `cr` (TR/1k), `tix` (tickets), `env` (envíos) — mensual |
| `DR_DATA` | Delivery Rate % mensual. `null` = mes aún inmaduro |
| `SEM_WEEKS` / `SEM_LABELS` | Semanas lunes–domingo (ISO) |
| `SEM_DATA` | `env` / `tix` / `tr` semanal por carrier |
| `QUEJAS_DATA` | Dona de motivos de queja (ver §6 — pendiente) |

Todos los arrays de un mismo bloque deben tener **exactamente la misma longitud** que `ALL_MONTHS` (o `SEM_WEEKS`).

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

## 2. Fuentes de datos

| Métrica | Fuente | Acceso |
|---|---|---|
| Tickets | Google Form → Sheet `1l-41UEE_CsqBuv5KsQ9b1BHHRmzBnI-c5xYeUgr1TNs` — *"Lifecycle - Problemas y dudas con envíos de tarjeta (Respuestas)"* | Owner: mayra.molina@nubank.com.mx |
| Envíos y DR | Databricks `etl.mx__contract.frodo__deliveries` | — |
| Metodología | Dashboard QuickSight de Patrick (data owner) | validación |

### Columnas del Sheet que importan

| Col | Campo |
|---|---|
| A | `Marca temporal` |
| H | `Elige la Mensajería` → `DHL` / `Estafeta` / `99 Minutos` |
| I | `¿Cómo te ayudamos?` (motivo de nivel 1) |
| O | `¿Qué escenario se presenta?` (detalle) |

⚠️ **Filtra siempre `H` a los tres nombres exactos.** Hay filas basura donde `H` trae un UUID en lugar del carrier (form mal versionado). Sin el filtro los conteos se inflan.

---

## 3. Flujo de actualización

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

Corre **todos los meses, no solo el actual**: la tabla se rellena hacia atrás y los meses viejos se mueven.

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
WHERE CONVERT_TIMEZONE('UTC','America/Mexico_City', delivery__created_at) >= '2026-07-01'
  AND delivery__carrier IN ('delivery_carrier__dhl','delivery_carrier__estafeta','delivery_carrier__c99_minutos')
GROUP BY 1,2 ORDER BY 1,2
```

Nunca calcules los envíos semanales a mano a partir del mensual.

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

### Paso 5 — Calcular

```
TR/1k = (tickets / envíos) × 1,000     ← redondeado a 2 decimales
```

### Paso 6 — Editar `data.js` y publicar

Actualiza los arrays de `data.js` (incluyendo `DATA_META`), commit y push. GitHub Pages tarda ~1 min. `index.html` no se toca.

### Paso 7 — Verificar

Abre el dash con un query string nuevo (`?cb=loquesea`) para saltarte el caché y confirma en consola:

```js
DATA_META                    // corte correcto
RAW.DHL.cr.length === ALL_MONTHS.length
Object.keys(charts).length   // > 0, las gráficas se construyeron
```

Recorre las 7 secciones y revisa que no haya errores en consola.

---

## 4. Cierre de mes

1. Quita el `*` de `ALL_MONTHS` (`'Ago 26*'` → `'Ago 26'`) y del botón correspondiente en el sidebar de `index.html`.
2. Espera ~2–3 semanas y **entonces** llena el DR del mes (ver §5).
3. Agrega el nuevo mes parcial a `ALL_MONTHS`, un `null` al final de cada array de `DR_DATA`, y un botón nuevo en el sidebar.

---

## 5. ⚠️ El Delivery Rate madura

El DR se mide sobre la cohorte de envíos **creados** en el mes. Un envío creado el 30 de julio todavía no se ha entregado el 1 de agosto, así que cuenta como no-entregado.

Esto ya causó un error real: el dash publicaba julio 2026 en **76.05 / 80.15 / 77.67**. Al madurar la cohorte, los valores reales resultaron ser **84.39 / 91.35 / 90.87** — una diferencia de hasta 13 puntos.

**Regla:** deja el DR en `null` hasta que el mes tenga al menos ~3 semanas de cerrado. Un DR por debajo de ~70% en un mes reciente casi siempre es inmadurez, no un problema del carrier. Y cada ciclo, vuelve a correr el DR de los 2–3 meses previos: siguen subiendo.

---

## 6. Pendientes conocidos

- **Chart "¿De qué se quejan?"** — usa una taxonomía (*Sin cobertura*, *Múltiples intentos*, *Punto forzado*, *Sobre abierto*…) que ya no existe en el form actual. El form vigente solo tiene 5 categorías en la col. I y 3 en la col. O. Los números en `QUEJAS_DATA` vienen del ciclo de Carlos y **no son reproducibles**. Hay que redefinir el mapeo con la estructura actual del form y documentarlo.
- **Ventana de la dona** — sin definir. Cuando se rehaga, fijarla explícitamente (ej. 2026 YTD).

---

## 7. Severidad TR/1k

| Color | Rango | CSS |
|---|---|---|
| 🟢 Verde | < 5 | `cr-g` |
| 🟡 Amarillo | 5 – 7 | `cr-y` |
| 🟠 Naranja | 7 – 10 | `cr-o` |
| 🔴 Rojo | > 10 | `cr-r` |

Delivery Rate (higher is better): 🟢 ≥ 90 · 🟡 85–90 · 🟠 75–85 · 🔴 < 75

---

*Actualizado: 10 ago 2026 — datos al 9 ago 2026 (agosto parcial)*
