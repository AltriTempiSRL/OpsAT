# RUNBOOK — incidentes y operación de OpsAT

> F3.4 del plan (docs/auditoria-arquitectura/10-plan-fases-remediacion). Objetivo:
> que un tercero autorizado opere el sistema SIN la memoria de Gabriel.
> Prod: **https://opsat.up.railway.app** (Railway, servicio `dashboard-despachos`,
> 1 proceso Node + volumen `/data` + PostgreSQL addon + Cloudflare R2 `opsat-media`).
> Primer reflejo SIEMPRE: `curl -s https://opsat.up.railway.app/api/health` — campos
> `ok`, `storage`, `odoo`, `media` dicen qué subsistema duele.

## 0. Accesos que necesitas (custodia F3.7)
Railway (dashboard + CLI `railway login`), Cloudflare R2, Odoo (admin para API keys),
GitHub del repo, y en Railway las env: `DATABASE_URL`, `DATA_DIR`, `JWT_SECRET`,
`ODOO_*`, `R2_*`, `BACKUP_TOKEN`, `WWP_TYPED`. Sin alguno de estos, escalar a Gabriel.

## 1. Deploy (y deploy de emergencia desde cualquier máquina)
```bash
git clone <repo> && cd OpsAT && npm install
railway login && railway link   # proyecto OpsAT · env production · servicio dashboard-despachos
node scripts/deploy.mjs         # exige árbol limpio + suite verde; taggea deploy-vNNN y verifica
```
- Si hay cambios de frontend: `node scripts/stamp.mjs --bump` + commit ANTES.
- **Rollback:** `git checkout deploy-vANTERIOR && node scripts/deploy.mjs` (los tags
  `deploy-v*` son la trazabilidad; `git tag -l 'deploy-*'`).

## 2. PostgreSQL caído
Síntomas: health `storage.mode=pg` con error, o boot con `[boot] FATAL: PostgreSQL no disponible`.
1. Railway dashboard → addon Postgres → estado/metrics; reiniciarlo si está colgado.
2. El proceso web NO arranca sin PG (por diseño, para no servir vacío). Si PG va a
   tardar: modo archivos temporal = quitar `DATABASE_URL` del servicio (Railway) →
   redeploy; el server usa el export JSON del volumen (última hora). **Anotar la hora**:
   al volver PG, todo lo escrito en modo archivos vive solo en JSON/volumen — ver §6
   para reconciliar, y NO alternar a la ligera.
3. Al restaurar PG: reponer `DATABASE_URL`, redeploy, verificar health + `GET
   /api/admin/db/typed-parity` (admin) = paridad 24/24.

## 3. Volumen /data lleno
Síntomas: notificación del watchdog de disco (job cada 6 h) o errores de escritura.
1. `railway run df -h` (o shell del servicio) → confirmar.
2. Espacio rápido: borrar snapshots viejos `DATA_DIR/backups/snap_*` (quedan 24 por
   diseño; en emergencia dejar 6) y `*.bak` antiguos.
3. Causa típica histórica: media en disco. Verificar health `media.mode=r2`; si está
   en `disk`, R2 se cayó o perdió credenciales (§4).

## 4. R2 caído o sin credenciales
Síntomas: health `media.mode=disk` (fail-open) o fotos nuevas 404.
1. status.cloudflare.com + dashboard R2 → token/llaves vigentes.
2. El sistema degrada solo a disco (las fotos nuevas caen al volumen). Al volver R2:
   `node scripts/migrate-media-to-r2.mjs` (idempotente) sube lo acumulado.
3. Verificar: subir una foto de prueba y GET a su URL.

## 5. Odoo caído o key inválida
Síntomas: health `odoo.ok=false` / `lastOdooOkAt` viejo; gates de picking lentos.
1. ¿Odoo vivo? altritempi.odoo.com a mano.
2. ¿Key? Odoo → Ajustes → Seguridad → API Keys; rotar → actualizar `ODOO_API_KEY` en
   Railway → redeploy. Verificar health `odoo.ok=true`.
3. La bodega NO se detiene: los gates hacen fail-open auditado (`out_gate_fail_open`
   en el audit log). Tras recuperar Odoo, revisar esos eventos y conciliar.

## 6. Restaurar desde el respaldo (drill F1.5 — practicarlo ANTES del desastre)
El respaldo nocturno (OneDrive `Respaldos-WWP/`, y copia neutral del workflow
`backup.yml`) guarda `collections.json.gz` (+ `.enc` si `BACKUP_ENC_KEY`) + manifest + fotos de disco.
```bash
mkdir restaurar && cd restaurar
# 1. Descomprimir el snapshot más reciente (si .enc: node scripts/backup-decrypt.mjs <archivo>)
gunzip -k collections.json.gz
# 2. Sembrar un DATA_DIR limpio con esos JSON (un archivo por colección, ver manifest)
# 3. Boot local en modo archivos:
DATA_DIR=$(pwd)/data-restaurada PORT=3900 node /ruta/repo/proxy.js
# 4. Verificar: /api/health, login, conteos de tareas/SDV vs manifest
```
Para prod: sembrar el volumen vía Railway shell o boot con backfill (PG se rellena
desde los JSON con el backfill de `storage-pg.js`). **Cronometrar y anotar en MEMORIA.**

## 7. "La máquina del dev murió"
Nada de producción vive en ella (deploy = §1 desde cualquier máquina; respaldo
neutral = workflow `backup.yml`). Recuperar: accesos §0 + clonar repo + §1.
El respaldo nocturno de OneDrive corre en esa máquina: activar la copia neutral
(secrets `BACKUP_TOKEN` en GitHub) si no lo estaba, y verificar la alerta de
frescura de 48 h del server.

## 8. Render (producción fantasma — hasta ejecutar D-2)
`dashboard-despachos.onrender.com` tiene datos congelados de jun-2026 y AÚN acepta
logins; **no atender usuarios ahí**. Si alguien reporta "datos viejos", casi seguro
entró a Render: mandarlo a opsat.up.railway.app. Pendiente D-2: snapshot final de su
disco → apagar o dejar 302 (render.yaml).

## 9. El WS/notificaciones no conectan
Desde F2.1 el WS exige ticket (`POST /api/wwp/realtime/ticket`). Un cliente viejo
(HTML cacheado pre-v229) reintenta sin ticket cada 2,5 s y cae a SSE/polling — feo
pero funcional; se cura con el version-gate al publicar build nuevo. Verificar:
consola del navegador + `smoke-08-realtime` en local.

## 10. Dónde está todo
- Decisiones e historia: `MEMORIA-PROYECTO.md` · Guía del repo: `CLAUDE.md`
- Plan vigente: `docs/auditoria-arquitectura/10-plan-fases-remediacion-2026-07-23.md`
  (+ auditoría 09 con los 132 hallazgos)
- Suite: `cd tests/e2e && npx playwright test` · Deploy: `scripts/deploy.mjs`
- CI: pestaña Actions (tests en cada push; `backup.yml` nocturno; `uptime.yml` cada 5 min)
