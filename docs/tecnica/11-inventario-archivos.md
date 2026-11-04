# 11. Inventario de archivos relevantes

Inventario de fuente y configuración revisada; excluye `node_modules`, `dist`, cachés y artefactos generados. Archivos principales:

## Raíz

| Ruta | Responsabilidad |
|---|---|
| `README.md` | Resumen, requisitos y procedimientos declarados; algunas capacidades deben contrastarse con el código. |
| `.env.example` | Plantilla de nombres de configuración, sin valores reales. |
| `.gitignore` | Ignora logs, dependencias, build y archivos locales de editor. |
| `frontend/` | Cliente React/Vite. |
| `backend/` | API Node/Express. Contiene `backend/.env` local no inspeccionado. |
| `database/migrations/` | DDL y seeds SQL, migraciones 001–013. |
| `tests/` | Directorio vacío en el inventario inspeccionado. |
| `docs/tecnica/` | Esta documentación. |

## Frontend

| Ruta | Responsabilidad |
|---|---|
| `frontend/index.html` | Documento Vite y root React. |
| `frontend/vite.config.ts` | Plugin React, proxy `/api` → `localhost:3001`. |
| `frontend/tsconfig*.json` | Compilación TypeScript app y config. |
| `frontend/package.json`, `package-lock.json` | Scripts/dependencias/lock. |
| `frontend/src/main.tsx` | Punto de entrada React, StrictMode, CSS Leaflet y global. |
| `frontend/src/App.tsx` | Vistas, handlers, estado, formularios, mapa y PDF. |
| `frontend/src/{authApi,usersApi,surveysApi,interviewsApi,assignmentsApi}.ts` | Clientes HTTP y schemas de respuesta. |
| `frontend/src/index.css` | Tokens, layout, controles y responsive. |
| `frontend/src/App.css` | Estilos starter Vite. |
| `frontend/public/logo.png` | Logo usado por la UI y boleta. Otros PNG/SVG públicos son recursos visuales. |

## Backend

| Ruta | Responsabilidad |
|---|---|
| `backend/src/server.ts` | Bootstrap, health DB antes de escuchar y cierre de proceso. |
| `backend/src/app.ts` | Middleware, health API, montaje de routers y error handling. |
| `backend/src/config/env.ts` | Carga `.env` desde CWD y valida variables Zod. |
| `backend/src/database/pool.ts` | PostgreSQL Pool, query, client, transacciones y prueba conexión. |
| `backend/src/database/{seedAdmin,resetAdminPassword,unlockAdmin}.ts` | Tareas de administración de credenciales; requieren variables locales. |
| `backend/src/middleware/{authenticate,errorHandler,rateLimiter,auditLog}.ts` | JWT/roles, errores, rate limit; audit middleware no conectado en pipeline visible. |
| `backend/src/utils/logger.ts` | Winston desarrollo/producción. |
| `backend/src/modules/auth/*` | Login, refresh, logout y me. |
| `backend/src/modules/users/*` | CRUD lógico de usuarios, validación y transacciones. |
| `backend/src/modules/surveys/*` | Encuestas, versiones, preguntas, opciones y asignaciones iniciales. |
| `backend/src/modules/assignments/*` | Crear/editar/reasignar comunidades de encuesta. |
| `backend/src/modules/interviews/*` | Lectura y alta idempotente de entrevistas y respuestas. |
| `backend/src/modules/{geography,enumerators,elections,candidates,reports,synchronization}/*` | Routers de salud stub únicamente. |
| `backend/package.json`, lock, `tsconfig.json` | Scripts, dependencias, compilación y tests configurados. |

## Base de datos

| Ruta | Contenido |
|---|---|
| `database/migrations/001_create_users_roles.sql` | Usuarios, roles, user_roles, refresh_tokens, helper updated_at. |
| `002_create_geography.sql` | Departments, municipalities, communities. |
| `003_create_enumerators.sql` | Perfil de encuestador. |
| `004_create_elections.sql` | Tipos de elección, elecciones, partidos, candidatos. |
| `005_create_surveys.sql` | Encuestas, versiones, preguntas y opciones. |
| `006_create_assignments.sql` | Enum y asignaciones por survey/community/enumerator. |
| `007_create_interviews.sql` | Entrevistados, entrevistas, respuestas y selecciones. |
| `008_create_sync_audit.sql` | Sync operations/logs y audit logs. |
| `009_seed_default_admin.sql`, `010_remove_legacy_default_admin.sql` | No crean credenciales activas por defecto; la cuenta se provisiona por script seguro. |
| `011_users_module_fields.sql` | Phone y rol SUPERVISOR. |
| `012_survey_option_colors.sql` | Color de opción de encuesta. |
| `013_survey_assignment_community_name.sql` | Alias de comunidad dentro de asignación/estudio. |

## Archivos/configuración no encontrados

No se encontraron Docker/Compose, OpenAPI/Swagger, GitHub Actions, `vercel.json`, `render.yaml`, archivos Railway, schema ORM, service worker ni pruebas `*.test`/`*.spec`. Las rutas y estado real del entorno de despliegue requieren acceso independiente.
