# Panel reconocimiento — usuarios

## Acceso

1. Abre https://grupochispa.github.io/reconocimiento/
2. Inicia sesión con un usuario de `mc_dashboard_users` **o** un correo de Supabase Auth (respaldo).

## Primer admin (bootstrap)

Si la tabla `mc_dashboard_users` existe y está **vacía**, el login muestra **Crear primer admin**.

1. Ejecuta `sql/mc_dashboard_users.sql` en el SQL Editor de Supabase (proyecto `zgbsrbjtjnozpzxifpua`) si la tabla aún no existe.
2. Recarga el panel; usa **Crear primer admin** con usuario + contraseña (mín. 4 caracteres).
3. Alternativa: entra con un correo ya creado en Supabase Auth, luego ve a **Admin → Usuarios** y crea usuarios locales.

## Admin → Usuarios

Tras iniciar sesión: **Admin** → pestaña **Usuarios**.

- Listar (usuario, activo/inactivo, fecha de creación)
- **+ Agregar** — crear usuario + contraseña (hash `sha256$salt$hex`)
- **Editar** — renombrar o cambiar contraseña (vacío = no cambia)
- **Desactivar / Activar** — soft delete (`activo=false`)
- **Eliminar** — borrado permanente (confirma antes)

Las contraseñas nunca se guardan en texto plano.

## Notas

- `sorteo_admins` es un catálogo aparte (p. ej. admin de sorteos); el panel de reconocimiento usa `mc_dashboard_users`.
- Promotores en Supabase Auth siguen pudiendo entrar por correo si conocen su clave Auth; para gestionarlos desde este panel, créalos también en **Usuarios**.
