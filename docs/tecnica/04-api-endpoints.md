# 4. Inventario de endpoints

Prefijo por defecto: `/api/v1`; puede cambiar con `API_VERSION`. Todos los endpoints montados bajo routers, salvo `/api/health`, pasan por rate limit general. Los routers de módulos (excepto autenticación, donde se aplica por ruta) requieren JWT/cookie en las operaciones indicadas. No se encontraron archivos OpenAPI/Swagger.

Ningún handler registrado lee `req.query`; no hay parámetros de consulta implementados. `:id`, `:surveyId` y `:communityId` se validan como UUID en las rutas que los reciben.

## Endpoints funcionales

| Método | Ruta | Middleware/permisos | Entrada/validación | Controlador → servicio | Tablas/entidades | Resultado y errores relevantes |
|---|---|---|---|---|---|---|
| GET | `/api/health` | Sin auth | Ninguna | inline `app.ts` | Ninguna | 200 `{success,status,timestamp,version,environment}`. Solo expresa estado HTTP; startup verifica DB. |
| POST | `/auth/login` | Rate limit global, sin auth | `{identifier,password}`; loginSchema | `login` → `AuthService.login` | users, user_roles, roles, enumerators, refresh_tokens | 200 `{success,user}` y cookies; 400 validación, 401 credenciales/cuenta desactivada. |
| POST | `/auth/refresh` | Rate limit global, sin auth | Refresh token de cookie; opcional body `{refreshToken}` | `refreshToken` → `refreshAccessToken` | refresh_tokens, users, roles, enumerators | 200 usuario y cookies rotadas; 401 ausente/inválido/revocado/expirado. |
| POST | `/auth/logout` | `authenticate` | Cookie/header JWT | `logout` → `AuthService.logout` | refresh_tokens | 200 mensaje y limpia cookies; 401 sin sesión. |
| GET | `/auth/me` | `authenticate` | Cookie/header JWT | `me` | Ninguna (payload JWT) | 200 usuario del JWT. |
| GET | `/users` | `authenticate`, `authorize(ADMIN)` | Sin query | `listUsers` → `UsersService.list` | users, user_roles, roles | 200 `{users}`. |
| POST | `/users` | ADMIN | username, email, fullName, phone?, role, password; Zod | `createUser` → `UsersService.create` | users, user_roles, roles, enumerators (ENUMERATOR) | 201 `{user}`; 400 validación, 409 duplicado. |
| PATCH | `/users/:id` | ADMIN | UUID; campos editables y password opcional | `updateUser` → `UsersService.update` | users, user_roles, roles, enumerators, refresh_tokens | 200; 400 validación, 404, 409 último admin/autodegradación. |
| PATCH | `/users/:id/activate` | ADMIN | UUID | `activateUser` → `UsersService.activate` | users, enumerators | 200; 404. |
| DELETE | `/users/:id` | ADMIN | UUID | `deactivateUser` → `UsersService.deactivate` | users, enumerators, refresh_tokens | 200 desactivado; 404, 409 último admin o propia cuenta. No elimina fila. |
| GET | `/surveys` | Auth; filtra por rol en servicio | Ninguna | `listSurveys` → `SurveysService.list` | surveys, municipalities, departments, interviews, survey_questions, question_options, survey_assignments, communities, enumerators, users | 200 `{surveys}`; admin ve no archivadas, encuestador requiere encuesta activa con asignación, supervisor ve activas. |
| POST | `/surveys` | ADMIN | Encuesta completa; `surveyInputSchema` | `createSurvey` → `SurveysService.create` | departments, municipalities, surveys, survey_versions, survey_questions, question_options, communities, survey_assignments, enumerators | 201 `{survey}`; 400 validación/encuestador. |
| PATCH | `/surveys/:id` | ADMIN | UUID y encuesta completa | `updateSurvey` → `SurveysService.update` | mismas entidades que create, actualiza survey y cancela asignaciones retiradas | 200; 400, 404. Crea versión nueva. |
| DELETE | `/surveys/:id` | ADMIN | UUID | `archiveSurvey` → `SurveysService.archive` | surveys | 200 archivada; 404. Conserva asignaciones e histórico. |
| PATCH | `/surveys/:id/restore` | ADMIN | UUID | `restoreSurvey` → `SurveysService.restore` | surveys, survey_assignments | 200 `{survey}` activa y reactiva la asignación cancelada más reciente por comunidad; 404 si no está archivada. |
| GET | `/interviews` | ADMIN, SUPERVISOR, ENUMERATOR | Ninguna | `listInterviews` → `InterviewsService.list` | interviews, surveys, municipalities, departments, enumerators, users, communities, answers, survey_questions, question_options, answer_option_selections | 200 `{interviews}`; admin/supervisor ven todas, encuestador solo propias. |
| POST | `/interviews` | ADMIN, ENUMERATOR | Payload entrevista; `interviewInputSchema` | `createInterview` → `InterviewsService.create` | survey_assignments, surveys, survey_versions, survey_questions, question_options, interviews, answers, answer_option_selections | 201 `{interview:{id,duplicate}}`; 400 validación/pregunta/respuesta; 403 asignación no disponible. |
| GET | `/assignments/health` | Auth | Ninguna | Inline route | Ninguna | 200 status `ready`. |
| POST | `/assignments/:surveyId` | ADMIN | UUID + `{name,assignedTo,quota}` Zod | Inline route → `AssignmentsService.create` | surveys, users, user_roles, roles, enumerators, municipalities, communities, survey_assignments | 201 comunidad; 400; 404 estudio; 409 estudio cerrado/nombre duplicado. |
| PATCH | `/assignments/:surveyId/:communityId` | ADMIN | UUIDs + `{name,assignedTo,quota}` Zod | Inline route → `AssignmentsService.reassign` | surveys, communities, users, user_roles, roles, enumerators, survey_assignments | 200 `{community}`; 400; 404; 409 estudio cerrado/asignación completada. |

## Endpoints stub registrados

Cada ruta exige autenticación y devuelve `{success:true,module,status:'stub - pendiente de implementación'}` (asignaciones usa `ready`):

| Método/ruta | Router |
|---|---|
| GET `/geography/health` | `geography.routes.ts` |
| GET `/enumerators/health` | `enumerators.routes.ts` |
| GET `/elections/health` | `elections.routes.ts` |
| GET `/candidates/health` | `candidates.routes.ts` |
| GET `/sync/health` | `synchronization/sync.routes.ts` |
| GET `/reports/health` | `reports.routes.ts` |

En total: **26 rutas Express registradas**. Veinte no son stubs: 18 operaciones de negocio y 2 health checks (`/api/health` y `/assignments/health`). Las otras seis rutas son health stubs de módulos.

## Esquemas representativos

Solicitud de login:

```json
{"identifier":"usuario@dominio.example","password":"<omitida>"}
```

Respuesta de login (tokens en cookies HttpOnly; no en JSON):

```json
{"success":true,"user":{"id":"<uuid>","username":"alias","fullName":"Nombre","roles":["ADMIN"],"enumeratorId":null}}
```

Solicitud de asignación:

```json
{"name":"Aldea de ejemplo","assignedTo":"aliasEncuestador","quota":100}
```

Solicitud de entrevista incluye `deviceUuid`, `surveyId`, `communityId`, `folio`, edad/género, latitud/longitud/accuracy, `interviewedAt` ISO y `answers: [{questionId,answerText}]`. Tipos/límites completos están en `backend/src/modules/interviews/interviews.validators.ts`.

La configuración real está distribuida entre `backend/src/app.ts`, `modules/*/*.routes.ts`, controladores y validators. No hay OpenAPI generado para comparar.
