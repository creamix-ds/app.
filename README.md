# Plataforma de agencia — servicios + contacto

Aplicación Node/Express con base de datos **interna** (SQLite en un solo archivo, `data/agencia.db`). No hace falta instalar ningún servidor de base de datos.

## Qué incluye

- **Sitio público** (`/`): lista los servicios publicados y un formulario de contacto.
- **Panel admin** (`/admin`), con login:
  - CRUD de servicios (nombre, descripción, categoría, precio y moneda, duración, imagen, orden, publicado/oculto).
  - Bandeja de mensajes: leído/no leído, estado (nuevo / en proceso / respondido / archivado), registro de la respuesta, notas internas, búsqueda y filtros, eliminar.
  - Cambio de contraseña.

## Puesta en marcha

```bash
npm install
npm run seed     # opcional: carga servicios y mensajes de ejemplo
npm start        # http://localhost:3000  ·  panel: http://localhost:3000/admin
```

Usuario inicial: **admin / admin123** (se crea la primera vez; cambialo desde "Mi cuenta").

Variables de entorno opcionales: `PORT`, `ADMIN_USER`, `ADMIN_PASS` (solo se usan al crear el usuario la primera vez), `SESSION_SECRET` (poné uno largo y aleatorio en producción).

## Estructura

```
server.js        rutas de la API y servidor
db.js            conexión SQLite + creación de tablas + usuario admin inicial
seed.js          datos de ejemplo
data/agencia.db  la base de datos (se crea sola; hacé backup de este archivo)
public/          index.html (sitio), admin.html (panel), styles.css
```

## API

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | /api/servicios | no | Servicios publicados |
| POST | /api/contacto | no | Enviar mensaje (máx. 5 cada 10 min por IP, honeypot anti-bots) |
| POST | /api/auth/login · /logout · GET /me · PUT /password | — | Sesión |
| GET/POST | /api/admin/servicios | sí | Listar / crear |
| GET/PUT/DELETE | /api/admin/servicios/:id | sí | Ver / editar / borrar |
| PATCH | /api/admin/servicios/:id/activo | sí | Publicar / ocultar |
| GET | /api/admin/mensajes?q=&estado=&leido= | sí | Bandeja con filtros |
| GET | /api/admin/mensajes/resumen | sí | Contadores para el dashboard |
| GET | /api/admin/mensajes/:id | sí | Detalle (marca como leído) |
| PATCH | /api/admin/mensajes/:id | sí | leido / estado / respuesta / notas |
| DELETE | /api/admin/mensajes/:id | sí | Eliminar |

## Backup

Copiá `data/agencia.db` (con el servidor detenido, o usá `sqlite3 data/agencia.db ".backup copia.db"`).
