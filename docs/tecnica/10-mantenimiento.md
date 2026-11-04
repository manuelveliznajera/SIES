# 10. Guía de mantenimiento

## Mapa rápido de cambios

| Necesidad | Archivos a revisar/modificar |
|---|---|
| Pantalla, navegación o estado de UI | `frontend/src/App.tsx`; CSS en `frontend/src/index.css` y, si aplica, `App.css`. |
| Campo/formulario de usuario | Formulario/handlers en `App.tsx`; `frontend/src/usersApi.ts`; schema `backend/src/modules/users/users.validators.ts`; controller/service; tabla `users`/migración si persiste un campo nuevo. |
| Pregunta u opción de encuesta | UI/handlers en `App.tsx`; `surveysApi.ts`; `surveys.validators.ts`; `surveys.controller.ts`; `surveys.service.ts`; `survey_questions`/`question_options`. |
| Endpoint nuevo o cambio de HTTP | `backend/src/modules/<módulo>/<módulo>.routes.ts`; `app.ts` para registrar un router nuevo; controller/validator/service. Luego frontend API client. |
| Autorización | Middleware `authenticate.ts` y `authorize`; router asociado. Revisar también filtrado de datos en service y UI por rol. |
| Consulta SQL | Servicio bajo `backend/src/modules/*/*.service.ts`; pool común `backend/src/database/pool.ts`; schema fuente en `backend/database/migrations/*.sql`. |
| Comunidad/asignación | `assignmentsApi.ts`, sección `supervisors` de `App.tsx`; assignments route/service; `SurveysService.list/getById/saveAssignments`; migraciones 006 y 013. |
| Entrevista/GPS/respuestas | Terminal y `handleSaveInterview`/`handleCaptureGps` en `App.tsx`; `interviewsApi.ts`; `interviews.validators.ts`, controller/service; migración 007. |
| Gráficas/estadísticas | Vistas dashboard y `currentSurveyInterviews` en `App.tsx`; confirmar agregación frontend y fuente real. |
| Mapa | `App.tsx` (`FitMapToInterviews`, `TileLayer`), `interviewsApi.ts`, `InterviewsService.list`; migración 007 índice GPS. |
| PDF | `generateInterviewPdf`/modal en `App.tsx`; `frontend/public/logo.png`, jsPDF/AutoTable. |
| Conexión/configuración | `backend/src/config/env.ts`, `backend/src/database/pool.ts`, `.env.example`, `frontend/vite.config.ts`. No documentar secretos. |
| Errores/logging | `backend/src/middleware/errorHandler.ts`, `utils/logger.ts`; errores de dominio se traducen inicialmente en controllers. |
| Build/comandos | `frontend/package.json`, `backend/package.json`, lockfiles, tsconfigs y Vite config. |

## Cambios de persistencia de extremo a extremo

1. Identificar el DTO del cliente y schema Zod del servidor.
2. Revisar roles en router y filtros/propiedad en service.
3. Añadir migración SQL compatible con datos existentes; documentar up/down y restricciones.
4. Actualizar sentencias SQL de lectura y escritura, tipos TypeScript del resultado y transacción cuando haya varias tablas.
5. Cambiar schemas de respuesta Zod y mapping en `*Api.ts`.
6. Cambiar formularios/estado de `App.tsx` y presentar estados de carga/error.
7. Revisar todos los consumidores del dato (listados, PDF, mapas, estadísticas e historial) y flujos por rol.

## Depuración

- API no escucha: revisar `server.ts`, `.env` cargado por CWD, log de `testConnection`, puerto y `createApp`.
- 404: verificar `app.use('/api/${API_VERSION}/...')` y path registrado en router.
- 401/403: inspeccionar expiración/refresh cookie, payload roles y orden `authenticate` antes de `authorize`.
- Respuesta 400: comparar JSON con validator Zod y mensajes `errors[].field`.
- Registro no visible: seguir controlador → servicio → SQL SELECT; revisar status, filtros de role y joins (un join puede ocultar filas sin relación).
- Error de SQL: revisar logs redactados y constraint en migración; `errorHandler` produce 409 en claves duplicadas/FK.
- Cambio de encuesta: tomar en cuenta `current_version`; entrevistas quedan ligadas a `survey_version_id`/`survey_version_used`.

## Dependencias y regresiones a revisar

La UI concentra muchos módulos en un solo `App.tsx`; cambios de estado compartido pueden afectar menú, dashboard, GPS y terminal. Los contratos de API están duplicados como schemas Zod en frontend y backend y deben mantenerse sincronizados. `API_VERSION` configurable no coincide automáticamente con el `/api/v1` hardcoded del cliente. Alias comunitario 013 no se refleja actualmente en todos los SELECTs de historial/getById (ver [base de datos](05-base-de-datos.md)).
