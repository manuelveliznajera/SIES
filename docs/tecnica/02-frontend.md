# 2. Frontend

## Estructura y navegación

La entrada es `frontend/index.html` → `frontend/src/main.tsx`, que monta `<App />` bajo `React.StrictMode` e importa Leaflet CSS y `index.css`. La lógica funcional y las vistas residen principalmente en `frontend/src/App.tsx`; la navegación es estado local `activeTab` y no hay router de URL.

| Vista/módulo | Archivo | Responsabilidad y estado/datos |
|---|---|---|
| Login | `App.tsx` | Alias/correo y contraseña; llama `login`, presenta errores y restaura sesión mediante `getCurrentSession`. |
| Dashboard | `App.tsx` | Encuesta seleccionada, conteos, resultados por preguntas y selector de gráficos Recharts; usa entrevistas de API. |
| Terminal de Campo | `App.tsx` | Comunidad asignada, edad, género, respuestas, GPS y envío de entrevista. Requiere GPS actualizado y conexión marcada como online. |
| Constructor | `App.tsx` | Datos generales, comunidades, cuotas, asignación de encuestadores, preguntas/opciones y publicar/editar. Preview plegable. |
| Estudios Guardados | `App.tsx` | Lista, edición y archivado de encuestas guardadas. |
| Comunidades y Asignaciones | `App.tsx` | Elige estudio, agrega comunidad y asignación, edita nombre/cuota y reasigna; API de asignaciones. |
| Usuarios | `App.tsx` | Formulario y tabla de cuentas; administración visual restringida por rol y API de usuarios. |
| Mapa GPS | `App.tsx` | Leaflet para entrevistas con coordenadas; OSM como tile layer. |
| Boleta PDF | `App.tsx` | Modal y generación de PDF con logo de `frontend/public/logo.png`, jsPDF y AutoTable. |

No hay componentes visuales de páginas en archivos independientes detectados: `App.tsx` contiene vistas, estado, handlers y elementos de mapa (incluye `FitMapToInterviews`). Estilos globales están en `src/index.css`; `App.css` conserva estilos del starter Vite.

## Estado y funciones relevantes

La app usa `useState`, `useEffect`, `useMemo`; no se detectaron hooks personalizados, Redux, Zustand o React Query en uso. Los estados importantes incluyen `authenticatedSession`, `activeTab`, `usersList`, `surveys`, `selectedSurveyId`, `interviews`, `builderQuestions`, `builderCommunities`, `fieldAnswers`, `gpsLocation` y estados de carga/error.

`surveys` inicia vacío y se llena desde `listSurveys`. El constructor inicializa `builderQuestions` con `createGuazacapanQuestionTemplate`; es una plantilla local de formulario para una nueva encuesta, no un estudio persistido.

Handlers principales de `App.tsx`:

- `handleLogin` / `handleLogout`: autenticación; actualiza sesión y vista.
- `handleSaveSurveyFromBuilder`: arma payload y llama `createSurvey` o `updateSurvey`.
- `handleStartEditSurvey` / `handleDeleteSurvey`: carga una encuesta al constructor o la archiva vía API.
- `handleAddCommunity`, `handleAddNewQuestion`, `handleAddOption`, `handleUpdateOption`, `handleRemoveQuestion`: cambios del borrador local del constructor; persisten al guardar encuesta.
- `handleCreateAssignedCommunity`, `handleEditAssignedCommunity`, `handleReassignActiveSurveyCommunity`: CRUD/reasignación de comunidad vinculada a estudio mediante `assignmentsApi.ts`.
- `handleCreateUser`, `handleStartEditUser`, `handleActivateUser`, `handleDeleteUser`: usan `usersApi.ts`.
- `handleCaptureGps`: Geolocation API con alta precisión y timeout de 15 s.
- `handleSaveInterview`: valida GPS, respuestas requeridas y comunidad; llama `createInterview`.
- `handleRefreshInterviews`, `generateInterviewPdf`: actualiza lista y genera PDF en cliente.

Los formularios del constructor y de usuarios son formularios React controlados. El backend valida también los datos con Zod; la validación del cliente no es el límite de seguridad. SweetAlert2 presenta confirmaciones y errores. El envío de entrevista usa Zod en cliente y servidor.

## Servicios HTTP

Los servicios se encuentran en `frontend/src/{authApi,usersApi,surveysApi,interviewsApi,assignmentsApi}.ts`. Usan `fetch`, JSON y `credentials: 'include'`. En respuestas 401, servicios de usuarios/encuestas/entrevistas/asignaciones intentan `POST /auth/refresh` y reintentan; `authApi.getCurrentSession` consulta `/me` y luego renueva. Las respuestas se validan con schemas Zod y los errores se convierten a `Error` usando el `message` del API.

| Servicio | Operaciones |
|---|---|
| `authApi.ts` | `login`, `getCurrentSession`, `logout`. |
| `usersApi.ts` | `listUsers`, `createUser`, `updateUser`, `deactivateUser`, `activateUser`; traduce roles entre modelo UI y API. |
| `surveysApi.ts` | `listSurveys`, `createSurvey`, `updateSurvey`, `archiveSurvey`; mapea entradas a tipos API. |
| `interviewsApi.ts` | `listInterviews`, `createInterview`. |
| `assignmentsApi.ts` | `createCommunityAssignment`, `updateCommunityAssignment`. |

## GPS, mapas, archivos y modo offline

- GPS: `navigator.geolocation.getCurrentPosition`; el estado GPS debe actualizarse antes de guardar desde terminal de campo.
- Mapa: `MapContainer`, marcadores y `TileLayer` de OpenStreetMap, usando coordenadas retornadas por entrevistas.
- Archivos: PDF generado localmente; no se sube a un almacenamiento remoto.
- `isOnline` es un estado de UI que se puede alternar. La entrevista se envía al servidor directamente; si está desactivado muestra error, no existe cola offline comprobada.
- No se encontró uso de Dexie/IndexedDB, Workbox, service worker o sincronización offline aunque figuran dependencias y el README menciona PWA. No documentar esos comportamientos como activos.

Referencias: [`App.tsx` (navegación/estado, L335)](../../frontend/src/App.tsx#L335), [`App.tsx` (envío entrevista, L569)](../../frontend/src/App.tsx#L569), [`App.tsx` (asignaciones, L887)](../../frontend/src/App.tsx#L887), [`App.tsx` (guardar encuesta, L1090)](../../frontend/src/App.tsx#L1090), [`App.tsx` (GPS, L1154)](../../frontend/src/App.tsx#L1154), [`authApi.ts`](../../frontend/src/authApi.ts), [`usersApi.ts`](../../frontend/src/usersApi.ts), [`surveysApi.ts`](../../frontend/src/surveysApi.ts), [`interviewsApi.ts`](../../frontend/src/interviewsApi.ts), [`assignmentsApi.ts`](../../frontend/src/assignmentsApi.ts), [`index.css`](../../frontend/src/index.css).
