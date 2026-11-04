# 5. Base de datos

## Conexión y estrategia

- Motor configurado: **PostgreSQL** (`pg.Pool`). La guía raíz recomienda PostgreSQL 15+, pero ni versión ejecutada ni servidor se consultaron; no se deben tratar como comprobación del entorno activo.
- Archivo de conexión: [`backend/src/database/pool.ts`](../../backend/src/database/pool.ts). Usa `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_POOL_MIN` y `DATABASE_POOL_MAX`; los valores se validan en `backend/src/config/env.ts`.
- Formato declarado en `.env.example`: URL `postgresql://usuario:contraseña@host:puerto/base`. El host, puerto, nombre lógico y credenciales reales dependen de `backend/.env`/entorno y no se inspeccionaron ni publican.
- Driver y acceso: `pg`, consultas SQL parametrizadas (`query`) y transacciones explícitas (`withTransaction`). No hay ORM ni `schema.prisma`.
- El pool tiene defaults de 2–10 conexiones, timeout de conexión 5 s e idle timeout 30 s. Startup llama `testConnection()`.
- Migraciones existentes: `backend/database/migrations/001...014_*.sql`. Seed de roles y tipos en migraciones; la cuenta inicial debe crearse con `npm run seed:admin` y variables privadas.

## Modelo entidad-relación

```mermaid
erDiagram
  USERS ||--o{ USER_ROLES : tiene
  ROLES ||--o{ USER_ROLES : asigna
  USERS ||--o{ REFRESH_TOKENS : renueva
  USERS ||--o| ENUMERATORS : perfil
  DEPARTMENTS ||--o{ MUNICIPALITIES : contiene
  MUNICIPALITIES ||--o{ COMMUNITIES : contiene
  MUNICIPALITIES ||--o{ SURVEYS : ubica
  USERS ||--o{ SURVEYS : crea
  SURVEYS ||--o{ SURVEY_VERSIONS : versiona
  SURVEYS ||--o{ SURVEY_QUESTIONS : define
  SURVEY_QUESTIONS ||--o{ QUESTION_OPTIONS : ofrece
  SURVEYS ||--o{ SURVEY_ASSIGNMENTS : asigna
  COMMUNITIES ||--o{ SURVEY_ASSIGNMENTS : territorio
  ENUMERATORS ||--o{ SURVEY_ASSIGNMENTS : recibe
  SURVEYS ||--o{ INTERVIEWS : recibe
  SURVEY_ASSIGNMENTS ||--o{ INTERVIEWS : autoriza
  ENUMERATORS ||--o{ INTERVIEWS : realiza
  COMMUNITIES ||--o{ INTERVIEWS : ocurre
  RESPONDENTS o|--o{ INTERVIEWS : identifica
  SURVEY_VERSIONS o|--o{ INTERVIEWS : fija
  INTERVIEWS ||--o{ ANSWERS : contiene
  SURVEY_QUESTIONS ||--o{ ANSWERS : responde
  ANSWERS ||--o{ ANSWER_OPTION_SELECTIONS : selecciona
  QUESTION_OPTIONS ||--o{ ANSWER_OPTION_SELECTIONS : opción
  ELECTION_TYPES ||--o{ ELECTIONS : clasifica
  MUNICIPALITIES o|--o{ ELECTIONS : ubica
  ELECTIONS ||--o{ CANDIDATES : presenta
  POLITICAL_PARTIES o|--o{ CANDIDATES : postula
  USERS ||--o{ SYNC_OPERATIONS : inicia
  SYNC_OPERATIONS ||--o{ SYNC_LOGS : registra
  USERS o|--o{ AUDIT_LOGS : actor
```

El diagrama representa claves foráneas declaradas en migraciones, no confirma cardinalidades de negocio en una base activa. `survey_assignments.community_name` es un alias por asignación incorporado por la migración 013, mientras `communities.name` es el nombre del catálogo municipal.

## Diccionario de datos (columnas declaradas)

Columnas comunes indicadas abajo se agregan a las listas cuando corresponde: UUID con `gen_random_uuid()`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()` y triggers `update_updated_at_column()` donde la migración los declara.

| Tabla | Columnas y tipos principales | Claves, restricciones y propósito |
|---|---|---|
| `roles` | `id SMALLSERIAL`, `name VARCHAR(50)`, `description TEXT`, `created_at TIMESTAMPTZ` | PK; name unique. Roles iniciales ADMIN/ENUMERATOR; SUPERVISOR aparece en migración 011. |
| `users` | `id UUID`, `username VARCHAR(80)`, `email VARCHAR(255)`, `password_hash VARCHAR(255)`, `full_name VARCHAR(255)`, `is_active BOOLEAN`, `failed_attempts SMALLINT`, `locked_until TIMESTAMPTZ`, `created_at/updated_at TIMESTAMPTZ`, `last_login TIMESTAMPTZ`, `phone VARCHAR(30)` (011) | PK; username/email unique; índices por username/email/activo. Contraseña es bcrypt hash. |
| `user_roles` | `user_id UUID`, `role_id SMALLINT`, `assigned_at TIMESTAMPTZ`, `assigned_by UUID` | PK compuesta `(user_id,role_id)`; FKs users/roles, assigned_by nullable. |
| `refresh_tokens` | `id UUID`, `user_id UUID`, `token_hash VARCHAR(255)`, `expires_at`, `created_at`, `revoked_at`, `device_hint VARCHAR(255)` | PK; token_hash unique; user FK cascade; índices user/expiry. |
| `departments` | `id UUID`, `name VARCHAR(100)`, `code VARCHAR(10)`, `is_active BOOLEAN`, fechas | PK; name/code unique. |
| `municipalities` | `id UUID`, `department_id UUID`, `name VARCHAR(100)`, `code VARCHAR(10)`, `is_active BOOLEAN`, fechas | PK; FK departamento; name único dentro de departamento; code unique. |
| `communities` | `id UUID`, `municipality_id UUID`, `name VARCHAR(150)`, `code VARCHAR(20)`, `description TEXT`, `is_active BOOLEAN`, fechas | PK; FK municipio; nombre y código únicos por municipio. |
| `enumerators` | `id UUID`, `user_id UUID`, `code VARCHAR(20)`, `full_name VARCHAR(255)`, `phone VARCHAR(30)`, `notes TEXT`, `is_active BOOLEAN`, `created_at/updated_at`, `last_access` | PK; user_id unique FK users; code unique. Perfil enlazado a usuario. |
| `election_types` | `id UUID`, `name VARCHAR(100)`, `description TEXT`, `is_active BOOLEAN`, `created_at` | PK; name unique; tipos sembrados por SQL. |
| `elections` | `id UUID`, `election_type_id UUID`, `name VARCHAR(200)`, `municipality_id UUID nullable`, `election_date DATE`, `description TEXT`, `is_active BOOLEAN`, fechas | PK; FKs tipo y municipio (este último RESTRICT). |
| `political_parties` | `id UUID`, `name VARCHAR(150)`, `acronym VARCHAR(30)`, `color VARCHAR(7)`, `logo_url TEXT`, `is_active BOOLEAN`, fechas | PK; name unique. |
| `candidates` | `id UUID`, `election_id UUID`, `party_id UUID nullable`, `full_name VARCHAR(255)`, `code VARCHAR(30)`, `photo_url TEXT`, `sort_order SMALLINT`, `is_active BOOLEAN`, fechas | PK; elección RESTRICT; partido SET NULL. |
| `surveys` | `id UUID`, `created_by UUID`, `election_type_id UUID nullable`, `election_id UUID nullable`, `municipality_id UUID nullable`, `name VARCHAR(255)`, `description TEXT`, `status survey_status`, `current_version SMALLINT`, `start_date/end_date DATE`, `privacy_config JSONB`, fechas | PK; FKs; índices status y municipio. La app almacena `targetSample` dentro de `privacy_config`. |
| `survey_versions` | `id UUID`, `survey_id UUID`, `version_number SMALLINT`, `snapshot JSONB`, `created_at`, `created_by UUID`, `notes TEXT` | PK; survey cascade; unique `(survey_id,version_number)`; snapshot de questions/options. |
| `survey_questions` | `id UUID`, `survey_id UUID`, `version_number SMALLINT`, `question_text TEXT`, `question_type question_type`, `sort_order SMALLINT`, `is_required/is_active BOOLEAN`, `validation_rules JSONB`, `helper_text TEXT`, fechas | PK; survey cascade; índices survey/order/version. |
| `question_options` | `id UUID`, `question_id UUID`, `option_text TEXT`, `sort_order SMALLINT`, `is_active BOOLEAN`, `allows_other_text BOOLEAN`, `created_at`, `color VARCHAR(7)` (012) | PK; question cascade; índice question/order. |
| `survey_assignments` | `id UUID`, `survey_id/community_id/enumerator_id/assigned_by UUID`, `interview_goal INTEGER`, `status assignment_status`, `start_date/end_date DATE`, `notes TEXT`, fechas, `community_name VARCHAR(150)` (013) | PK; FKs restrict; cuota >= 0; unique `(survey_id,community_id,enumerator_id)`; índices por survey/enumerator/community/status. |
| `respondents` | `id UUID`, `full_name VARCHAR(255)`, `sex sex_type`, `age SMALLINT`, `education_level education_level`, `created_at` | PK; edad nullable y 0–120. El servicio actual de entrevistas no inserta esta tabla. |
| `interviews` | `id UUID`, `device_uuid UUID`, `survey_id/survey_version_id/assignment_id/enumerator_id/community_id/respondent_id UUID`, `status interview_status`, `sync_status sync_status`, timestamps de dispositivo/servidor, `latitude NUMERIC(10,7)`, `longitude NUMERIC(10,7)`, `gps_accuracy_meters NUMERIC(8,2)`, `gps_captured_at`, `gps_source/status VARCHAR(30)`, `privacy_accepted BOOLEAN`, `device_info JSONB`, `survey_version_used SMALLINT`, `notes TEXT`, fechas | PK; device_uuid unique; FKs; checks de coordenadas/accuracy; índices por encuesta, asignación, usuario, comunidad, status, fecha y GPS. |
| `answers` | `id UUID`, `interview_id UUID`, `question_id UUID`, `question_version SMALLINT`, `text_value TEXT`, `numeric_value NUMERIC`, `date_value DATE`, `created_at` | PK; entrevista cascade, pregunta restrict; unique `(interview_id,question_id)`. |
| `answer_option_selections` | `id UUID`, `answer_id UUID`, `option_id UUID`, `other_text TEXT`, `created_at` | PK; answer cascade, option restrict; unique `(answer_id,option_id)`. |
| `sync_operations` | `id UUID`, `user_id UUID`, `enumerator_id UUID nullable`, `device_fingerprint VARCHAR(64)`, `status sync_op_status`, contadores INTEGER, `rejection_details JSONB`, fechas | PK; FK user restrict, enumerator set null; índices user/status/fecha. No escritor funcional encontrado. |
| `sync_logs` | `id UUID`, `operation_id UUID`, `interview_device_uuid UUID`, `result VARCHAR(20)`, `error_code VARCHAR(50)`, `error_message TEXT`, `processed_at` | PK; FK operación cascade; índices operation/device uuid. |
| `audit_logs` | `id UUID`, `user_id UUID nullable`, `action VARCHAR(100)`, `entity_type VARCHAR(50)`, `entity_id UUID`, `changes JSONB`, `ip_address VARCHAR(45)`, `user_agent VARCHAR(500)`, `created_at` | PK; user SET NULL; índices usuario/entidad/acción/fecha. Middleware disponible no está conectado. |

Enums SQL: `survey_status` (draft, active, paused, finished, archived); `question_type` (yes_no, single_choice, multiple_choice, short_text, long_text, integer, decimal, date, age, choice_with_other); `assignment_status` (pending, active, completed, cancelled); `sync_status` (local_only, pending, syncing, synced, rejected, conflict); `interview_status` (in_progress, completed, partial, cancelled); `education_level` (none, primary_incomplete, primary_complete, basic, diversified, university, postgraduate, prefers_not_to_say); `sex_type` (male, female, prefers_not_to_say); `sync_op_status` (started, completed, partial, failed). Fuentes: migraciones 005–008.

### Índices y triggers declarados

Índices de migraciones: `users` (email, username, activo); `refresh_tokens` (user, expiración); `departments` (activo); `municipalities` (departamento, activo); `communities` (municipio, activo); `enumerators` (user, activo, code); `elections` (tipo, municipio); `candidates` (elección, partido); `surveys` (status, municipio); `survey_versions` (survey); `survey_questions` (survey, sort_order, versión); `question_options` (question, sort_order); `survey_assignments` (survey, enumerator, community, status); `interviews` (survey, assignment, enumerator, community, sync/status, fecha y parcial GPS); `answers` (interview, question); `answer_option_selections` (answer, option); `sync_operations` (user, status, fecha); `sync_logs` (operation, device UUID); `audit_logs` (user, entity, action, fecha). Las restricciones UNIQUE indicadas en el diccionario también crean índices únicos.

Triggers `updated_at` invocan `update_updated_at_column()` en users, departments, municipalities, communities, enumerators, elections, political_parties, candidates, surveys, survey_questions, survey_assignments e interviews, según sus migraciones.

## Acceso por módulo y persistencia

`AuthService` y `UsersService` trabajan con usuarios/roles/tokens; `SurveysService` mantiene versiones, preguntas, opciones, catálogo geográfico y asignaciones; `AssignmentsService` inserta/actualiza comunidades/asignaciones; `InterviewsService` inserta entrevistas, answers y selecciones, y lee joins para dashboard/mapa. SQL y relaciones exactos se localizan en `backend/database/migrations/*.sql` y `backend/src/modules/*/*.service.ts`.

## Observaciones para validar

- `SurveysService.list` y `getById` mapean `COALESCE(a.community_name,c.name)`, pero `InterviewsService.list` todavía presenta `c.name`. El alias editado por estudio puede no aparecer en el historial de entrevistas.
- Archivar cambia el estado del estudio sin alterar asignaciones nuevas; reactivar restaura en registros antiguos únicamente la asignación cancelada más reciente por comunidad para mantener una asignación vigente sin reactivar historial duplicado.
- No se leyó el estado de migraciones del servidor actual. La migración 013 está en el repositorio; aplicar o verificar migraciones corresponde al despliegue, y no se hizo como parte de esta documentación.
- El README en raíz indica PostgreSQL 15+ como requisito recomendado, no comprobado en runtime.
