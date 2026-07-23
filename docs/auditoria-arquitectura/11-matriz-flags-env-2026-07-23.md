# Matriz de configuración (env vars) — OpsAT

> F5.7 / GAP-09 del plan. Las **43 variables de entorno** que leen `proxy.js`,
> `storage-pg.js`, `media.js` y `boot.js`, con su efecto, default en código, y
> plan de retiro/gobierno. El valor REAL de producción vive en el dashboard de
> Railway (no en el repo) — aquí solo el contrato. Regenerar la lista:
> `grep -oE "process\.env\.[A-Z_]+" proxy.js storage-pg.js media.js boot.js | sort -u`.

## Críticas (sin ellas el sistema no opera bien o no es seguro)

| Flag | Efecto | Default en código | Nota / gobierno |
|---|---|---|---|
| `DATABASE_URL` | Activa PostgreSQL (modo real). Sin ella: modo archivos JSON | — (ausente → archivos) | En prod SIEMPRE presente. `node proxy.js` directo con ella hace exit(1) — usar `boot.js` |
| `DATA_DIR` | Directorio de datos persistentes (volumen) | `__dirname` | Prod = volumen `/data` montado. Local = `data-local/` |
| `JWT_SECRET` | Firma de los access tokens (HS256) | archivo `.jwt-secret` autogenerado si <32 chars | Rotarla invalida todas las sesiones. Custodia F3.7 |
| `ODOO_URL` / `ODOO_DB` / `ODOO_USER` / `ODOO_API_KEY` | Credenciales del ERP (JSON-RPC) | `''` (Odoo deshabilitado) | La key se ROTA en Odoo → actualizar aquí. Nunca al repo (SEC-01) |
| `WWP_TYPED` | Capa relacional: `off` \| `dual` \| `read` | `read` (25f6238) | Kill-switch del cutover. `off`→`read` fuerza backfill total (DB-01 corregido). Retiro del dual: D-7 |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `R2_ENDPOINT` | Cloudflare R2 para fotos. Faltando alguna → modo disco | — (ausente → disco) | Copia única hoy (DB-02): activar versioning + 2ª copia |
| `BACKUP_TOKEN` | Protege `/api/backup/*` (respaldo externo) | — (endpoint responde 401) | Necesario para el respaldo neutral (`backup.yml`) |
| `CODEX_BRIDGE_TOKEN` | Protege `/api/codex/*` (datos vivos para agentes) | — (fail-closed) | Timing-safe |

## Seguridad / política

| Flag | Efecto | Default | Nota |
|---|---|---|---|
| `WWP_FORCE_PW_CHANGE` | `1` = bloquea con modal a quien tenga contraseña semilla | apagado | Encender tras avisar al equipo (D-9). El rechazo de semillas server-side ya es duro (F2.5) |
| `ALLOWED_ORIGIN` | Origen extra permitido por CORS | same-origin/localhost | — |
| `NODE_ENV` | `production` activa HSTS incondicional | — | Railway lo setea |
| `PGSSL` | Fuerza SSL del pool PG | según URL | — |

## Integraciones opcionales

| Flag | Efecto | Default | Nota |
|---|---|---|---|
| `OPENAI_API_KEY` / `OPENAI_MODEL` | IA (gerente ops + auditor) | — (IA off) | La IA real corre con OpenAI |
| `CODEX_AUDITOR_MODEL` | Modelo del auditor | `gpt-5.5` | — |
| `ANTHROPIC_API_KEY` | SDK Anthropic (carga condicional) | — | Hoy sin uso; todo es OpenAI |
| `GOOGLE_MAPS_API_KEY` | Servida por `/api/maps-key` para el mapa GPS | — | Restricción por dominio en GCP (API-07, validar) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push | autogeneradas → `vapid-keys.json` | — |
| `COMPANY_NAME` | Nombre en la interfaz | — | — |

## Tuning operativo (rara vez se tocan)

| Flag | Efecto | Default |
|---|---|---|
| `PORT` | Puerto del server | `3000` |
| `TZ_OFFSET_HOURS` | Offset horario para fechas locales (RD) | -4 |
| `ODOO_RPC_TIMEOUT_MS` | Timeout de cada RPC a Odoo | 20000 |
| `WWP_ARCHIVE_DAYS` | Días para archivar tareas completadas | — |
| `DISK_ALERT_MIN_MB` | Umbral de alerta de disco (job 6 h) | — |
| `INV_WATCHDOG` | On/off del watchdog de inventario negativo | ON |
| `INV_SELLABLE_LOCATION_IDS` / `INV_PANO_RUN_TIMEOUT_MS` / `INV_TRANSIT_RECON_MINUTES` | Parámetros de inventario | — |
| `GEO_VERIFY_RADIUS_M` / `GEO_SILENT_HOURS` / `GEO_SILENT_GRACE_MIN` / `GEO_STALE_CHECK_MINUTES` | Geo-verificación GPS | — |
| `RAILWAY_ENVIRONMENT` | Detección de entorno Railway | — |

## Reglas de gobierno de flags (F5.7)

1. **Toda flag nueva se agrega aquí** con efecto + default + plan de retiro. Una
   flag sin fila en esta tabla es deuda.
2. **Los kill-switches tienen fecha de retiro** (`WWP_TYPED`→D-7; el dual-write no
   es permanente).
3. **Los secretos jamás en el repo** — solo en Railway/custodia (F3.7).
4. `.env.example` debe reflejar las flags no-secretas vigentes (hoy está
   desactualizado — pendiente menor).
