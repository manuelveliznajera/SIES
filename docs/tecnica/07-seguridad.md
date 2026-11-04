# 7. Autenticación, autorización y seguridad

## Controles implementados

- Passwords se procesan con bcrypt (12 rounds) en `AuthService.hashPassword`; login compara hash, nunca devuelve tokens en JSON.
- Access JWT contiene id/username/roles/enumeratorId y se firma con `JWT_SECRET`; cookie `access_token` tiene HttpOnly, Secure configurable, SameSite configurable, 15 min.
- Refresh token aleatorio de 64 bytes; solo hash SHA-256 se persiste en `refresh_tokens`. Cookie HttpOnly de 7 días, path limitado a `/api/v1/auth/refresh`; renovación revoca el anterior y crea uno nuevo.
- `authenticate` admite cookie o `Authorization: Bearer`, valida JWT y adjunta payload al request. `authorize` compara roles exactos (`ADMIN`, `SUPERVISOR`, `ENUMERATOR`).
- Users, surveys, assignments e interviews comprueban permisos en backend. Las restricciones visuales del frontend son únicamente UX.
- Usuarios requieren password de 12–128 caracteres en create/update; validators de usuario, survey, interview usan Zod.
- Helmet con CSP, CORS limitado a origen(es) configurados y `credentials:true`; parser JSON/form limita cuerpos a 5 MB.
- Rate limiter general por defecto 100 requests / 15 min. `syncRateLimiter` está exportado pero no aplicado a rutas.
- Error handler no muestra detalles en producción; constraints PG se mapean a 409.
- logger Winston a consola y, en producción, archivos configurados `logs/error.log` y `logs/combined.log` con rotación.

## Controles no confirmados o riesgos verificables

1. **No hay incremento de `failed_attempts`/lockout en login.** La tabla tiene esos campos y el login los lee/resetea, pero la ruta de credenciales incorrectas no los incrementa y no consulta `locked_until`. El comentario de simulación bcrypt cubre usuario inexistente, no un control de bloqueo.
2. **Protección CSRF no identificada.** Las mutaciones autentican con cookies; CORS/SameSite ayudan pero no sustituyen token CSRF en toda configuración cross-site. Evaluar estrategia según dominios de despliegue.
3. **Refresh cookie path fijo `/api/v1/auth/refresh`** aunque `API_VERSION` es configurable. Si se cambia API_VERSION, puede no enviarse a la ruta nueva.
4. **API base fijada a `/api/v1` en clientes frontend**, mientras backend permite configurar `API_VERSION`; mantener ambos alineados.
5. **CSP connect-src solo `'self'`**, revisar si API se despliega en origen distinto. El README contempla frontend/backend separados.
6. **Middleware de auditoría no conectado.** `auditLog.ts` no se observa en pipeline y `audit_logs` no tiene escritura visible desde los módulos funcionales.
7. **Rate limit exclusivo de login no encontrado.** El endpoint depende del rate limit general; configuración puede elevar el máximo general.
8. **Permisos en ciertas vistas dependen de UI**, pero las mutaciones sensibles del backend sí aplican ADMIN. No confiar en ocultar navegación como control.
9. **Trazas pueden contener PII operacional:** logger reporta username/id de login y error handler registra stack/path/userId; revisar retención y acceso a logs del despliegue.

## Variables de entorno sensibles

`backend/src/config/env.ts` valida `DATABASE_URL`, `JWT_SECRET` (mínimo 32), `COOKIE_SECRET` (mínimo 32), configuración SSL/CORS/cookies y variables privadas para seed admin. Los valores reales deben mantenerse fuera de documentación y repositorio. El archivo `backend/.env` existe en el workspace, pero no fue leído.

`COOKIE_SAME_SITE=none` requiere `COOKIE_SECURE=true` por una refinación Zod. `backend/.env.example` documenta nombres sin valores operativos.

## Sesiones y roles

`users` + `user_roles` + `roles` son fuente de identidad. Roles sembrados en SQL son ADMIN y ENUMERATOR; SUPERVISOR lo añade migración 011. El backend lista encuestas con reglas específicas por rol y filtra entrevistas por `user_id` para ENUMERATOR.

Referencias: [`authenticate.ts`](../../backend/src/middleware/authenticate.ts), [`auth.service.ts`](../../backend/src/modules/auth/auth.service.ts), [`auth.controller.ts`](../../backend/src/modules/auth/auth.controller.ts), [`app.ts`](../../backend/src/app.ts), [`env.ts`](../../backend/src/config/env.ts), [`auditLog.ts`](../../backend/src/middleware/auditLog.ts).
