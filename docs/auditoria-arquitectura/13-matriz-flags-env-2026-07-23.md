# Matriz de variables de entorno (flags) — OpsAT · 2026-07-23

> F5.7 del plan [`10-plan-fases-remediacion`](10-plan-fases-remediacion-2026-07-23.md) (GAP-09).
> Antes no existía registro de qué flag hace qué, su default en código, ni su valor real en producción.
> Sin esto, el valor real de cada flag solo vive en la consola de Railway y nadie más lo sabe.
>
> **Columna "Valor en prod":** ⚠ = requiere que Filippo lo confirme en la consola de Railway (no verificable desde el repo). El resto se deriva del default en código.
> **Defaults** verificados contra el código el 23-jul (proxy.js / storage-pg.js / media.js / boot.js / scripts).

## Secretos / credenciales (nunca en el repo — solo en Railway)

| Flag | Propósito | Default | Obligatorio en prod |
|---|---|---|---|
| `DATABASE_URL` | Conexión PostgreSQL. Su presencia activa el backend PG (si falta → modo archivos JSON) | — | ✅ (define el modo) |
| `JWT_SECRET` | Firma de tokens de sesión. Si falta, se genera y persiste en `.jwt-secret` | autogenera | ✅ (o autogenera) |
| `ODOO_URL` · `ODOO_DB` · `ODOO_USER` · `ODOO_API_KEY` | Credenciales del ERP Odoo (la key fue **rotada 23-jul**) | — | ✅ |
| `R2_ACCOUNT_ID` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` · `R2_BUCKET` | Cloudflare R2 (fotos). Los 4 presentes → media va a R2; si falta uno → disco | — | ✅ (evidencia) |
| `R2_ENDPOINT` | Override del endpoint S3 (buckets con jurisdicción EU/FedRAMP) | derivado de account id | ⚠ opcional |
| `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` | Web Push. Si faltan, se generan y persisten en `vapid-keys.json` | autogenera | ⚠ opcional |
| `BACKUP_TOKEN` / `WWP_BACKUP_TOKEN` | Token del respaldo externo (`/api/backup/*`). El script lee `WWP_BACKUP_TOKEN`; el server valida `BACKUP_TOKEN` | — | ✅ (respaldo) |
| `CODEX_BRIDGE_TOKEN` | Auth del Codex Bridge (`/api/codex/*`). Sin él, esos endpoints responden 503 (fail-closed) | — | ⚠ opcional |
| `OPENAI_API_KEY` | IA (Gerente de Operaciones + Auditor). Sin él, las features de IA se desactivan | — | ⚠ opcional |
| `GOOGLE_MAPS_API_KEY` | Mapa GPS (servido por `/api/maps-key`, restringido por dominio en GCP) | `''` | ⚠ (mapa) |
| `ANTHROPIC_API_KEY` | **Muerto** — el SDK de Anthropic se retiró; la IA es OpenAI. No hace nada | — | ❌ retirar |

## Control de comportamiento (los que definen cómo opera el sistema)

| Flag | Propósito | Default | Valor recomendado en prod | Plan de retiro |
|---|---|---|---|---|
| `WWP_TYPED` | Modo del cutover relacional: `off`\|`dual`\|`read` | `read` | `read` | Tras F5.8 (retiro dual-write) el default `read` basta; la var puede quitarse |
| `WWP_FORCE_PW_CHANGE` | `1` = el modal de cambio de contraseña semilla es BLOQUEANTE | apagado | **`1`** (encender el día del aviso al equipo — F2.5) | Permanente |
| `INV_WATCHDOG` | `0` desactiva el watchdog de inventario negativo (08:00 RD) | `1` (ON) | `1` | Permanente |
| `ODOO_RPC_TIMEOUT_MS` | Timeout por llamada a Odoo | `20000` | 8000–10000 recomendado (F4.1) | Permanente |
| `ODOO_BREAKER_COOLDOWN_MS` | Ventana de fail-fast del circuit breaker de Odoo (F4.1, nuevo) | `60000` | `60000` | Permanente |
| `GEO_VERIFY_RADIUS_M` | Radio de geo-verificación de entrega | `300` | según operación | Permanente |
| `GEO_STALE_CHECK_MINUTES` | Frecuencia del chequeo de señal GPS perdida (`0` = off) | `30` | `30` | Permanente |
| `GEO_SILENT_HOURS` · `GEO_SILENT_GRACE_MIN` | Umbrales de la alerta "chofer sin señal" | `4` · `45` | según operación | Permanente |
| `WWP_ARCHIVE_DAYS` | Días tras los que una cadena de tareas cerrada se archiva del listado | (ver código) | — | Permanente |
| `INV_TRANSIT_RECON_MINUTES` | Frecuencia de la reconciliación de tránsito | (ver código) | — | Permanente |
| `INV_SELLABLE_LOCATION_IDS` · `INV_PANO_RUN_TIMEOUT_MS` | Config del dashboard de inventario | — | ⚠ | Permanente |
| `DISK_ALERT_MIN_MB` | Umbral de la alerta "disco casi lleno" | (ver código) | — | Permanente |
| `ALLOWED_ORIGIN` | Origen CORS permitido en producción | `''` | el dominio real | Permanente |
| `TZ_OFFSET_HOURS` | Offset horario para los watchdogs (RD = -4) | (ver código) | -4 | Permanente |
| `COMPANY_NAME` | Nombre de empresa en la UI | — | `Altri Tempi` | Permanente |
| `DATA_DIR` | Directorio de datos persistentes | `__dirname` | `/data` (volumen Railway) | Permanente |
| `WWP_BACKUP_BASE_URL` · `WWP_BACKUP_DEST` | Config del script de respaldo (URL de prod + destino OneDrive). **La URL default se corrigió a `opsat.up.railway.app` (F1.1)** | ver script | ⚠ | Permanente |
| `DEPLOY_URL` | URL que verifica `deploy.mjs` tras el deploy | derivado | — | Permanente |
| `PGSSL` | Modo TLS del PostgreSQL (endurecido a fail-closed en el merge PGSSL) | ver storage-pg | ⚠ | Permanente |
| `RAILWAY_ENVIRONMENT` | Lo setea Railway; el código lo lee para detectar entorno | (Railway) | — | Permanente |

## Acción para Filippo (una sola pasada por la consola de Railway)

Confirmar el valor real de las marcadas ⚠ y, sobre todo, decidir/encender:
1. **`WWP_FORCE_PW_CHANGE=1`** — el día que avises al equipo (expulsa las contraseñas semilla).
2. **`ODOO_RPC_TIMEOUT_MS=9000`** — para que el breaker actúe rápido (hoy 20 s por default).
3. Retirar **`ANTHROPIC_API_KEY`** si está seteada (no hace nada).
4. Anotar aquí el valor real de las ⚠ para que el dev nuevo no tenga que abrir Railway.
