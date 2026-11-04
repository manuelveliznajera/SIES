# 3. Backend

## Arranque y composición

`backend/src/server.ts` ejecuta `testConnection()` sobre PostgreSQL, crea la app con `createApp()` y escucha en `env.PORT` (default 3001). Registra cierre ante SIGTERM/SIGINT y handlers de promesas/excepciones no capturadas.

`backend/src/app.ts` registra Helmet/CSP, CORS con credenciales, JSON y urlencoded hasta 5 MB, cookie-parser, Morgan, rate limit general, `GET /api/health`, routers y los manejadores 404/error globales. Prefijo configurable `API_VERSION` (default `v1`).

## Capas y módulos reales

| Módulo | Rutas / controller / service | Comportamiento comprobado |
|---|---|---|
| Auth | `modules/auth/auth.routes.ts`, `auth.controller.ts`, `auth.service.ts` | Login, refresh, logout, sesión actual; bcrypt, JWT, refresh token rotante persistido como hash. |
| Users | `modules/users/users.routes.ts`, `users.controller.ts`, `users.service.ts`, `users.validators.ts` | CRUD/estado de usuario y rol en transacciones SQL; sincroniza perfil enumerador al asignar/quitar rol. |
| Surveys | `modules/surveys/surveys.routes.ts`, controller, service, validators | Admin lista también archivadas; crea/actualiza versión y asignaciones; archiva y restaura encuestas. |
| Assignments | `modules/assignments/assignments.routes.ts`, `assignments.service.ts` | Crea comunidad/asignación y actualiza nombre/cuota/encuestador en transacción. Solo ADMIN para mutaciones. |
| Interviews | `modules/interviews/interviews.routes.ts`, controller, service, validators | Consulta entrevistas según rol; crea entrevista y respuestas con autorización de asignación e idempotencia por device UUID. |
| Geography, enumerators, elections, candidates, reports, synchronization | routers respectivos | Únicamente `GET /health` tras autenticación, marcado stub/pending; no controllers/services CRUD. |

Las rutas montan middleware/handlers; controladores extraen y validan entrada y traducen errores HTTP; servicios implementan reglas y SQL. El acceso a datos no está abstraído en repositorios: los servicios importan `query`/`withTransaction` desde `database/pool.ts`.

## Persistencia por servicio

- `AuthService`: `users`, `user_roles`, `roles`, `enumerators`, `refresh_tokens`.
- `UsersService`: `users`, `user_roles`, `roles`, `enumerators`, `refresh_tokens`; bcrypt delegado a `AuthService`.
- `SurveysService`: `departments`, `municipalities`, `surveys`, `survey_versions`, `survey_questions`, `question_options`, `communities`, `survey_assignments`, conteo de `interviews`.
- `AssignmentsService`: `surveys`, `communities`, `users`, `user_roles`, `roles`, `enumerators`, `survey_assignments`.
- `InterviewsService`: `survey_assignments`, encuesta/versiones/preguntas/opciones, `interviews`, `answers`, `answer_option_selections`; lectura agrega datos geográficos, encuestador y respuestas.

## Funciones públicas y efectos

| Servicio / función | Entrada | Efecto y retorno |
|---|---|---|
| `AuthService.login(identifier,password)` | Identificador y contraseña | Consulta usuario/roles/encuestador; retorna fallo genérico o user + access/refresh token; limpia lock fields y actualiza last_login solo en éxito. |
| `refreshAccessToken(refreshToken)` | Token refresh sin hash | Busca hash/expiración/revocación; valida usuario; rota refresh token y retorna nueva sesión o error tipado. |
| `logout(userId)` / `hashPassword(password)` | ID / contraseña | Revoca refresh vigentes del usuario / bcrypt hash con 12 rounds. |
| `UsersService.list()` | — | Lista los usuarios y rol; retorna `UserRecord[]`. |
| `create(input)` | `CreateUserInput` ya validado | Transacción: inserta cuenta, rol y perfil enumerator si aplica; retorna record sin hash. |
| `update(userId,input)` | UUID + `UpdateUserInput` | Transacción; evita quitar último admin, actualiza datos/rol, opcionalmente hash y sesiones; crea/actualiza perfil enumerator. Retorna null si no existe. |
| `deactivate(userId)` / `activate(userId)` | UUID | Cambia estado; sincroniza estado enumerator y revoca sesiones al desactivar; null si falta. |
| `SurveysService.list(userId,roles)` | Identidad y roles JWT | Filtra encuesta según rol; lee surveys y en paralelo preguntas/opciones + asignaciones activas; retorna `SurveyRecord[]`. |
| `create(input,userId)` | `SurveyInput` validado | Transacción: asegura departamento/municipio, survey, version 1, preguntas/opciones, comunidades y asignaciones; retorna `SurveyRecord`. |
| `update(surveyId,input,userId)` | UUID + encuesta completa | Bloquea survey, incrementa versión, desactiva preguntas/opciones previas, crea snapshot/versión y reconcilia asignaciones; null en no encontrada/archivada. |
| `archive(surveyId)` | UUID | Marca archived; conserva estado de asignaciones, que no se pueden usar mientras el survey no esté activo; boolean. |
| `restore(surveyId)` | UUID | Marca active y restaura las asignaciones canceladas más recientes por comunidad si no hay otra activa; retorna `SurveyRecord` o null. |
| `saveVersion`, `saveAssignments`, `ensureMunicipality`, `getById` | Helpers privados | SQL de snapshot, preguntas/options, catálogo y asignaciones; construye respuesta detallada. |
| `AssignmentsService.create(surveyId,name,alias,quota,assignedBy)` | Encuesta, nueva comunidad/cuota/encuestador | Transacción; valida estudio/estado/encuestador/nombre duplicado, crea/reusa entidad geográfica y asignación; retorna community DTO o `kind` de error. |
| `reassign(surveyId,communityId,name,alias,quota,assignedBy)` | Asignación existente y cambios | Transacción; valida survey, comunidad, enumerador, no completada; cancela asignación anterior e inserta/actualiza destino. |
| `InterviewsService.list(userId,roles)` | Usuario y roles | SELECT agregado; admin/supervisor listan todas, enum solo propias; mapea folio/GPS/respuestas a registros UI. |
| `create(input,userId,roles)` | `InterviewInput` validado + sesión | Comprueba asignación y versión; valida question IDs/respuestas requeridas; INSERT idempotente por device UUID; crea answers/options en transacción. Puede lanzar `InterviewSubmissionError` 400/403. |

Controladores exportados: Auth `login`, `refreshToken`, `logout`, `me`; Users `listUsers`, `createUser`, `updateUser`, `deactivateUser`, `activateUser`; Surveys `listSurveys`, `createSurvey`, `updateSurvey`, `archiveSurvey`; Interviews `listInterviews`, `createInterview`. El módulo de assignments implementa controladores inline en `assignments.routes.ts`; módulos stub no tienen controlador/service.

`withTransaction` inicia, confirma o revierte transacciones, registra fallo y siempre libera conexión. Las consultas parametrizan valores con `$1...`. `Pool` lee `DATABASE_URL`, SSL y límites del pool desde `env`.

## Validación y errores

Zod valida login, usuario, encuesta y entrevista. `surveys.controller.ts`, `users.controller.ts`, `interviews.controller.ts` transforman errores de validación y de negocio a 4xx; otros errores llegan a `errorHandler`. El middleware global normaliza unique (`23505`) y FK (`23503`) a 409 y no expone detalles internos salvo en desarrollo.

## Áreas declaradas pero no operativas

Las rutas de sincronización, reportes, geografía, enumeradores, candidatos y elecciones exponen solo salud del módulo. `auditLog.ts` y `syncRateLimiter` existen, pero no están montados en `app.ts`/routers inspeccionados. Las tablas de auditoría y sincronización existen en migraciones, pero no hay flujo que las escriba mediante estas rutas.

Referencias: [`server.ts` (bootstrap, L6)](../../backend/src/server.ts#L6), [`app.ts` (createApp y montaje, L24)](../../backend/src/app.ts#L24), [`pool.ts` (query/transacción, L30)](../../backend/src/database/pool.ts#L30), [`authenticate.ts`](../../backend/src/middleware/authenticate.ts), [`errorHandler.ts`](../../backend/src/middleware/errorHandler.ts), [`auth.service.ts` (login, L49)](../../backend/src/modules/auth/auth.service.ts#L49), [`users.service.ts` (list, L57)](../../backend/src/modules/users/users.service.ts#L57), [`surveys.service.ts` (list, L112)](../../backend/src/modules/surveys/surveys.service.ts#L112), [`interviews.service.ts` (list, L68)](../../backend/src/modules/interviews/interviews.service.ts#L68).
