# Panel reconocimiento — usuarios y zonas

## Acceso

1. Abre https://grupochispa.github.io/reconocimiento/ (tras deploy) o sirve esta carpeta en local.
2. Inicia sesión con un usuario de `mc_dashboard_users` **o** un correo de Supabase Auth (respaldo).
3. **Gestión (compensaciones):** https://grupochispa.github.io/reconocimiento/gestion.html — login **aparte** con usuarios de `mc_gestion_users` (no reutiliza la sesión del panel).

## Setup de base de datos (obligatorio para Admin + Zonas + Gestión)

En el SQL Editor del proyecto Supabase `zgbsrbjtjnozpzxifpua`, ejecuta en orden:

1. `sql/mc_dashboard_users.sql`
2. `sql/mc_gestion_users.sql`
3. `sql/mc_zonas.sql`

(O `sql/setup_all.sql` de una vez.)

Luego, desde `supabase-api`:

```bash
# Opcional: token de Management API para aplicar DDL automáticamente
set SUPABASE_ACCESS_TOKEN=sbp_...
set SEED_ADMIN_PASSWORD=12345
node scripts/setup-reconocimiento-schema.mjs
```

El script siembra:

- Usuarios de panel (`administrador@chispa.com`, `admin@gmail.com`, `acacio.marce@gmail.com`, …) con hash `sha256$salt$hex`
- Usuario de gestión (`gestion@chispa.com`) si `mc_gestion_users` está vacía
- Zonas del worksheet y asignación de ejecutivos

## Primer admin (bootstrap)

Si la tabla existe y está **vacía**, el login muestra **Crear primer admin** (panel o gestión, según la página).

## Navegación

Sidebar izquierdo:

- **Evidencias POP** / **Reconocimientos** / **Zonas** (lectura)
- **Admin** → Usuarios, **Usuarios gestión**, Vendedores, Asignar zonas, Productos, Materiales
- **Gestión avanzada** → `gestion.html` (requiere login de gestión)

## Admin → Usuarios

- Listar / crear / editar (cambiar contraseña) / desactivar / eliminar (`mc_dashboard_users`)
- Contraseñas nunca en texto plano

## Admin → Usuarios gestión

- Mismas acciones sobre `mc_gestion_users` para el login de `gestion.html`
- Sesión `mc_gestion_session_v1` independiente de `mc_dash_session_v1`

## Admin → Zonas

- Asignar ejecutivo a zona
- **Rodar**: intercambiar dos ejecutivos de zonas distintas
- **Mover** / **Quitar** de zona (historial en `mc_zona_vendedores`)

## Dashboards

- Filtro de rango de fechas (desde/hasta + presets 7d / 30d / Todo)
- Filtro por zona
- KPIs ampliados (prom. materiales, % con foto, tasa de aprobación, ticket promedio, etc.)
