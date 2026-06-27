# Plan de escala — AdScreenPro

> Qué vigilar y cuándo actuar cuando lleguen el volumen y los usuarios.
> No hay que reconstruir nada: la arquitectura ya escala por diseño. Esto es el
> mapa de las afinaciones de infraestructura para cuando crezcas.

---

## ✅ Lo que YA está resuelto (no requiere acción)

La base está bien posicionada para escalar:

- **Arquitectura serverless.** Frontend estático por CDN + Supabase (Postgres + PostgREST + edge functions). No hay un servidor monolítico de "un usuario a la vez": cada TV y cada usuario es un cliente independiente.
- **Connection pooling.** Lo maneja Supabase (Supavisor/PgBouncer). No es algo que mantengamos nosotros.
- **Caché del lado cliente.** React Query (en ~20 pantallas) cachea, deduplica requests y refetchea inteligente.
- **Índices en las tablas calientes.** `ad_logs`, `ad_clicks`, selfies, partners, y los **compuestos** para los reportes (`ad_logs(ad_id, created_at)`, `coupon_claims(coupon_id, claimed_at)`).
- **Realtime push, no polling.** El player usa 2 canales de Supabase Realtime (comandos + nuevos ads) en vez de machacar el servidor con consultas periódicas.
- **Queries paralelas** en el reporte (2 fases en vez de 4 roundtrips en fila).
- **Anti-abuso** en selfies y cupones (límites por fingerprint + IP), con tests automatizados.

---

## ⚠️ Riesgos de infraestructura — vigilar y actuar

Ninguno es "la app se rompe". Son umbrales de "subir de plan / afinar" cuando crezcas.

| # | Señal a vigilar | Cuándo importa | Acción |
|---|---|---|---|
| 1 | **Tier de Supabase** (CPU, RAM, conexiones del dashboard) | Cuando el uso de compute pase ~70% sostenido, o las queries empiecen a tardar | Subir de plan (Pro → siguiente). Es config + dinero, no código. |
| 2 | **Conexiones Realtime** | Cada TV mantiene **2 canales**. Con N pantallas = 2N conexiones concurrentes. Vigila el límite de tu plan | Subir tier de Realtime, o consolidar a 1 canal por pantalla si hiciera falta |
| 3 | **Crecimiento de `ad_logs`** (cada impresión = 1 fila; es la tabla que más rápido crece) | Cuando llegue a millones de filas y los reportes se sientan lentos pese a los índices | Política de retención: archivar/agregar logs viejos a una tabla resumen mensual; borrar el detalle > N meses |
| 4 | **APIs externas** (ESPN, Open-Meteo, IA de selfies) | Picos simultáneos de muchos players, o costo de la IA de selfies subiendo | Ya hay caché y límites anti-abuso. A escala: cachear clima/deportes server-side 1 vez y servirlo a todas las TVs en vez de que cada una llame |
| 5 | **Storage** (videos de SalesAd/teaser + selfies) | Cuando el bucket crezca mucho | Los selfies ya expiran a 60 min. Confirmar limpieza periódica de renders viejos |

---

## 🔧 Pendiente accionable ahora

- [ ] **Aplicar la migración de índices** `20260626000000_report_query_indexes.sql` contra la base de datos (`supabase db push` o el flujo normal). El código ya está desplegado; los índices son la otra mitad y **no se aplican solos** al hacer push del código.

---

## 📊 Cómo monitorear (dashboard de Supabase)

Revisar de vez en cuando, sobre todo tras campañas de alta de partners/advertisers:

- **Database → Reports:** uso de CPU/RAM, conexiones activas, queries lentas.
- **Realtime → Inspector:** conexiones concurrentes vs. el límite del plan.
- **Database → tamaño de tablas:** vigilar el crecimiento de `ad_logs`.
- **Logs de edge functions:** errores o timeouts en `transform-selfie`, `claim-coupon`, `render-all`.

La regla: **mide antes de optimizar.** Si una métrica se acerca al límite de tu plan, ahí actúas — no antes.

---

*Mantener este documento al día a medida que crezca el sistema y cambien los umbrales reales.*
