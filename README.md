# Panel reconocimiento — usuarios y zonas

## Acceso

1. Abre https://grupochispa.github.io/reconocimiento/ (tras deploy) o sirve esta carpeta en local.
2. Inicia sesión con un usuario de `mc_dashboard_users` **o** un correo de Supabase Auth (respaldo).

## Setup de base de datos (obligatorio para Admin + Zonas)

En el SQL Editor del proyecto Supabase `zgbsrbjtjnozpzxifpua`, ejecuta en orden:

1. `sql/mc_dashboard_users.sql`
2. `sql/mc_zonas.sql`

Luego, desde `supabase-api`:

```bash
# Opcional: token de Management API para aplicar DDL automáticamente
set SUPABASE_ACCESS_TOKEN=sbp_...
set SEED_ADMIN_PASSWORD=12345
node scripts/setup-reconocimiento-schema.mjs
```

El script siembra:

- Usuarios de panel (`administrador@chispa.com`, `admin@gmail.com`, `acacio.marce@gmail.com`, …) con hash `sha256$salt$hex`
- Zonas del worksheet y asignación de ejecutivos

## Primer admin (bootstrap)

Si la tabla existe y está **vacía**, el login muestra **Crear primer admin**.

## Navegación

Sidebar izquierdo:

- **Evidencias POP** / **Reconocimientos** / **Zonas** (lectura)
- **Admin** → Usuarios, Vendedores, Asignar zonas, Productos, Materiales

## Admin → Usuarios

- Listar / crear / editar (cambiar contraseña) / desactivar / eliminar
- Contraseñas nunca en texto plano

## Admin → Zonas

- Asignar ejecutivo a zona
- **Rodar**: intercambiar dos ejecutivos de zonas distintas
- **Mover** / **Quitar** de zona (historial en `mc_zona_vendedores`)

## Dashboards

- Filtro de rango de fechas (desde/hasta + presets 7d / 30d / Todo)
- Filtro por zona
- KPIs ampliados (prom. materiales, % con foto, tasa de aprobación, ticket promedio, etc.)
