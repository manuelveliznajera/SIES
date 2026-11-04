# 8. Instalación, ejecución y despliegue

Los comandos de desarrollo y build siguientes están definidos en `package.json`; los requisitos de Node/npm/PostgreSQL provienen del README raíz y no declaran `engines` en manifests. Ajustar versiones a los lockfiles del proyecto.

## Requisitos declarados

- README raíz: Node.js 20+, npm 10+, PostgreSQL 15+.
- Frontend y backend tienen instalación independiente y sus propios `package-lock.json`.
- No se encontraron Dockerfile, Docker Compose, workflow CI, manifiesto Vercel/Railway/Render ni definición de infraestructura en el árbol fuente.

## Configuración inicial

1. Instalar en las carpetas `frontend` y `backend` con `npm ci` para respetar lockfiles.
2. Configurar `backend/.env` desde la plantilla `.env.example` ubicada en raíz. `env.ts` carga `.env` desde el `process.cwd()`, así que iniciar los comandos backend desde `backend/` como indica README.
3. Definir como mínimo `DATABASE_URL`, `JWT_SECRET` y `COOKIE_SECRET`. Revisar `backend/src/config/env.ts` y [seguridad](07-seguridad.md); no copiar secretos en documentos.
4. Configurar la base PostgreSQL y ejecutar `npm run migrate` desde `backend/` únicamente en el entorno autorizado. Las migraciones están dentro de `backend/database/migrations` para que el paquete del backend pueda desplegarse de forma independiente; el comando precarga `.env` con `dotenv`.
5. Según README, `npm run seed:admin` crea el administrador inicial desde variables `SEED_ADMIN_*`, solo si aún no hay admin. No hay password admin por defecto confirmado por las migraciones actuales.

## Comandos reales

En `backend/`:

```bash
npm run dev          # tsx watch src/server.ts; puerto default 3001
npm run build        # prebuild ejecuta migraciones; luego tsc -> dist; postbuild permite seed inicial con RUN_ADMIN_SEED=true
npm start            # node dist/server.js
npm run typecheck    # tsc --noEmit
npm run migrate      # node-pg-migrate --migrations-dir database/migrations up
npm run migrate:down
npm run seed:admin
npm run reset:admin-password
npm run unlock:admin
```

En `frontend/`:

```bash
npm run dev          # Vite
npm run build        # tsc -b && vite build
npm run preview
npm run lint         # oxlint
```

Vite proxy envía `/api` a `http://localhost:3001`. `VITE_API_URL` está soportada por clientes API; si frontend/backend comparten origen puede quedar vacía. Para cross-origin, establecerla antes del build y configurar `CORS_ORIGIN`, HTTPS y cookies Secure/SameSite en backend. Confirmar CSP connect-src al usar otro origen.

## Seeds, pruebas y logging

- `npm run seed` apunta a `backend/database/seeds/run.ts`, archivo que no aparece en el repositorio inspeccionado; el comando no se puede confirmar ejecutable.
- El README raíz refiere a `docs/instalacion.md`, ruta no encontrada en el inventario actual; esta guía contiene la instalación verificada contra manifests.
- `npm test` de backend es Jest y busca `backend/tests/**/*.test.ts`; esa carpeta/archivos no están presentes. La carpeta raíz `tests/` no contiene archivos detectables.
- Logs de desarrollo son consola; producción añade `logs/error.log` y `logs/combined.log`.
- Backups/restores y despliegue no están definidos en el repositorio. Deben documentarse en el runbook de infraestructura específico.

## Diagnóstico inicial

- Backend no arranca: verificar que `.env` se encuentra bajo CWD `backend`, variables requeridas y conexión PostgreSQL. `server.ts` termina si `testConnection()` falla.
- API 401: verificar cookies, refresh token, origen, CORS y que ambas capas usan `/api/v1`.
- Error de validación: revisar schema Zod del módulo y payload del cliente.
- Cambio de esquema: comparar migraciones SQL existentes con `npm run migrate`; comprobar estado DB por canal administrativo, nunca asumiendo que el archivo fue aplicado.
