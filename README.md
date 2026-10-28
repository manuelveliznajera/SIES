# EncuestaApp — Sistema de Encuestas Electorales y Municipales

Sistema web profesional para administrar y realizar encuestas electorales, municipales y comunitarias en Guatemala.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS + ShadCN/UI |
| Backend | Node.js + Express + TypeScript |
| Base de datos | PostgreSQL (VPS propio) |
| Offline | PWA + Service Worker (Workbox) + IndexedDB (Dexie) |
| Mapas | Leaflet + OpenStreetMap |
| Despliegue | Vercel (frontend) + Railway/Render (backend) |

## Estructura del proyecto

```
EncuestaApp/
├── frontend/      # Aplicación React PWA
├── backend/       # API REST Node.js/Express
├── database/      # Migraciones y seeds SQL
├── tests/         # Pruebas automatizadas
├── docs/          # Documentación
└── .env.example   # Variables de entorno (sin credenciales)
```

## Inicio rápido

### 1. Requisitos previos
- Node.js 20+
- PostgreSQL 15+
- npm 10+

### 2. Clonar y configurar

```bash
git clone <repositorio>
cd EncuestaApp

# Configurar variables de entorno
cp .env.example backend/.env
# Editar backend/.env con los valores reales
```

### 3. Base de datos

```bash
cd backend
npm install
npm run migrate        # Ejecuta todas las migraciones
npm run seed:admin     # Crea el primer administrador desde backend/.env
npm run seed           # Datos de demostración (opcional)
```

Para crear el primer administrador, define `SEED_ADMIN_USERNAME`, `SEED_ADMIN_EMAIL`,
`SEED_ADMIN_FULL_NAME` y `SEED_ADMIN_PASSWORD` en `backend/.env`. La contraseña debe
tener al menos 12 caracteres. El comando `npm run seed:admin` guarda únicamente su
hash bcrypt y solo funciona si todavía no existe un administrador.

Si el administrador ya existe y necesitas cambiar su contraseña, define en
`backend/.env` el username o email que ya tiene esa cuenta y establece una nueva
`SEED_ADMIN_PASSWORD` de al menos 12 caracteres. Luego ejecuta:

```bash
cd backend
npm run reset:admin-password
```

El comando cambia la contraseña de la cuenta existente, limpia bloqueos por intentos
fallidos y revoca sus refresh tokens. No crea usuarios ni activa cuentas deshabilitadas.

Para limpiar únicamente los intentos fallidos y el bloqueo, sin cambiar la contraseña,
define `SEED_ADMIN_USERNAME` o `SEED_ADMIN_EMAIL` con el identificador de la cuenta y
ejecuta:

```bash
cd backend
npm run unlock:admin
```

La sección **Gestión de usuarios** requiere una sesión de administrador y se conecta a
`/api/v1/users` para listar, crear, editar, desactivar y reactivar cuentas. Al crear una
cuenta, establece una contraseña inicial de al menos 12 caracteres. Desactivar conserva
el historial y revoca las sesiones activas de esa cuenta.

El **Constructor (Admin)** guarda las encuestas, versiones de preguntas y asignaciones
en PostgreSQL mediante `/api/v1/surveys`. Aplica las migraciones pendientes antes de
usar estos endpoints con `cd backend && npm run migrate`. Archivar una encuesta conserva
sus preguntas, asignaciones e historial de entrevistas.

### 4. Backend

```bash
cd backend
npm run dev            # http://localhost:3001
```

### 5. Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

En desarrollo, Vite reenvía `/api` al backend local en `http://localhost:3001`, así que
`VITE_API_URL` puede quedar sin definir. Si el frontend y backend están desplegados en
orígenes distintos, define `VITE_API_URL` con la URL base del backend antes de compilar
el frontend y configura `CORS_ORIGIN` en `backend/.env` con el origen del frontend. Si
están en sitios distintos, configura también `COOKIE_SAME_SITE=none` y
`COOKIE_SECURE=true` en `backend/.env` para permitir las cookies de sesión por HTTPS.

## Fases de desarrollo

- [x] Fase 1: Diseño y planificación
- [ ] Fase 2: Infraestructura ← en progreso
- [ ] Fase 3: Administración
- [ ] Fase 4: Recolección de datos
- [ ] Fase 5: Geolocalización
- [ ] Fase 6: Modo offline
- [ ] Fase 7: Reportes
- [ ] Fase 8: Seguridad y despliegue

## Documentación

Ver la carpeta `docs/` para documentación completa.

## Seguridad

**Nunca** commites archivos `.env` con credenciales reales.
Revisa `docs/instalacion.md` para instrucciones de configuración segura.

---

> ⚠️ Los datos de demostración incluidos en `database/seeds/` son ficticios y están identificados como tales.
