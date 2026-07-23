# Despliegue en Railway

Este proyecto puede correr en Railway sin dejar de funcionar en Render.
Render sigue usando `render.yaml`; Railway usa `railway.json`.

## Configuracion requerida

Variables para Railway:

```text
NODE_ENV=production
DATA_DIR=/data
ODOO_URL=...
ODOO_DB=...
ODOO_USER=...
ODOO_API_KEY=...
JWT_SECRET=...
COMPANY_NAME=Altri Tempi
CONT_SHEETS_ID=...
CONT_SHEETS_GID=0
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
```

`PORT` no se debe fijar en Railway. Railway lo asigna automaticamente y
`proxy.js` ya lee `process.env.PORT`.

## Pasos con Railway CLI

En esta maquina el CLI quedo instalado en:

```powershell
C:\Users\Gabriel Ramirez\AppData\Roaming\npm\railway.cmd
```

Si `railway` no funciona en tu terminal, usa esa ruta completa en los comandos.

Desde esta carpeta:

```powershell
railway login --browserless
railway init --name dashboard-despachos
railway add --service dashboard-despachos
.\scripts\import-railway-env.ps1
railway volume add --service dashboard-despachos --mount-path /data
railway up --service dashboard-despachos --detach
railway domain --service dashboard-despachos
```

El script incluido importa las variables secretas desde `.env`:

```powershell
.\scripts\import-railway-env.ps1
```

El script solo importa variables de la app. No sube `RAILWAY_API_TOKEN` ni
`PORT`.

## Despues del primer despliegue

1. Abre el dominio que genere Railway.
2. Verifica `/api/health`.
3. Verifica `/historial.html`.
4. Mantén Render activo en `https://dashboard-despachos.onrender.com/historial.html`.

## Nota sobre datos

Railway necesita un volumen montado en `/data`. Sin ese volumen, tareas,
usuarios, sesiones, fotos y otros datos de runtime se perderian al redesplegar.

## TLS a PostgreSQL (PGSSL) — verificado jul-2026

La DB tiene dos rutas de acceso y cada una pide un modo TLS distinto
(`storage-pg.js` → `_pgSsl()`):

| Quién conecta | URL | Variables | Por qué |
|---|---|---|---|
| La app en Railway (producción) | `DATABASE_URL` → `postgres.railway.internal:5432` | **ninguna** (PGSSL sin definir) | Red privada del proyecto, ya cifrada por WireGuard. TLS aquí no aporta y el cert ni siquiera valida. **No definir PGSSL en el servicio.** |
| Tooling desde fuera (scripts locales, tests contra un `wwp_dev` remoto) | `DATABASE_PUBLIC_URL` → `sakura.proxy.rlwy.net:15198` | `PGSSL_CA_FILE=railway-pg-root.crt` | ⚠️ El proxy público **acepta conexiones sin TLS** (verificado: llega hasta la autenticación con `sslmode=disable`). Sin TLS del lado cliente, la contraseña y los datos van EN CLARO por internet. |
| Diagnóstico puntual sin la CA a mano | `DATABASE_PUBLIC_URL` | `PGSSL=insecure` | Cifra pero NO autentica el servidor (MITM posible). Solo a sabiendas; el boot lo avisa en el log. |

`PGSSL=1` (la semántica vieja: cifrar sin verificar, en silencio) **ya no existe** —
ahora corta el arranque con un error que trae estas mismas instrucciones.

### Obtener la CA (una vez, y si rota)

El Postgres de Railway (template `postgres-ssl`) genera su propia PKI en el
volumen: CA `root-ca` + cert de servidor `CN=localhost`. Railway NO expone la CA
en el dashboard, pero se extrae del volumen:

```bash
railway ssh --service Postgres -- cat /var/lib/postgresql/data/certs/root.crt > railway-pg-root.crt
```

Con eso, `PGSSL_CA_FILE=railway-pg-root.crt` da **verify-ca**: cadena verificada
contra la CA pinneada (un MITM necesitaría `root.key`, que solo vive en el
volumen). `verify-full` es imposible: el cert dice `localhost`, no
`*.proxy.rlwy.net` — por eso `_pgSsl()` anula el chequeo de hostname, igual que
`sslmode=verify-ca` de psql. Equivalente para psql directo:

```bash
psql "$DATABASE_PUBLIC_URL" --set=sslmode=verify-ca --set=sslrootcert=railway-pg-root.crt
```

El cert actual vence en **oct-2028** (`SSL_CERT_DAYS=820`). Si las conexiones con
CA empiezan a fallar con errores de certificado, el template lo regeneró:
re-extraer `root.crt` con el mismo comando.
