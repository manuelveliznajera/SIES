# 6. Dependencias y tecnologías

Las versiones “bloqueadas” se leyeron de los lockfiles locales. La dependencia declarada puede usar semver `^` o `~`; version fija de lock es reproducible por npm ci. Producción/desarrollo se refiere a cada `package.json`.

## Frontend (`frontend/package.json`)

| Paquete | Declarada / lock | Tipo | Uso real identificado |
|---|---|---|---|
| `react`, `react-dom` | ^19.3.1 / 19.3.1 | Producción | Vistas y estado. |
| `vite` | ^8.3.4 / 8.3.4 | Desarrollo | Dev server, proxy `/api`, build. |
| `@vitejs/plugin-react` | ^6.1.2 / 6.1.2 | Desarrollo | Transformación React en Vite. |
| `typescript` | ~7.0.2 / 7.0.2 | Desarrollo | Typecheck/build. |
| `zod` | ^4.6.7 / 4.6.7 | Producción | Validar respuestas de API. |
| `lucide-react` | ^1.59.0 / 1.59.0 | Producción | Iconos. |
| `recharts` | ^3.10.1 / 3.10.1 | Producción | Gráficas del dashboard. |
| `leaflet`, `react-leaflet` | ^1.9.4 / 1.9.4; ^5.0.0 / 5.0.0 | Producción | Mapa y marcadores GPS. |
| `jspdf`, `jspdf-autotable` | ^4.2.1 / 4.2.1; ^5.0.9 / 5.0.9 | Producción | Boletas PDF en cliente. |
| `sweetalert2` | ^11.26.25 / 11.26.25 | Producción | Alertas y confirmaciones; CSS importado. |
| `@types/leaflet`, React types, Node types | varias / lockfile | Desarrollo | Tipos TS. |
| `oxlint` | ^1.88.0 / lockfile | Desarrollo | Script lint. |

También declaradas pero sin import/uso encontrado en `frontend/src` (declarada / lock): `@hookform/resolvers` ^6.0.0 / 6.0.0; `@tanstack/react-query` ^5.104.5 / 5.104.5; `axios` ^1.20.0 / 1.20.0; `clsx` ^2.1.1 / 2.1.1; `date-fns` ^4.4.0 / 4.4.0; `dexie` ^4.4.6 / 4.4.6; `dexie-react-hooks` ^4.4.0 / 4.4.0; `exceljs` ^4.4.0 / 4.4.0; `react-hook-form` ^7.90.0 / 7.90.0; `react-router-dom` ^7.18.4 / 7.18.4; `tailwind-merge` ^3.7.0 / 3.7.0; `uuid` ^14.0.3 / 14.0.3; `workbox-window` ^7.4.1 / 7.4.1; `zustand` ^5.0.15 / 5.0.15. No se concluye que estén sin uso fuera del código inspeccionado. README menciona Tailwind y ShadCN/UI, aunque no aparecen como dependencias directas ni se detectan sus componentes.

## Backend (`backend/package.json`)

| Paquete | Declarada / lock | Tipo | Uso real identificado |
|---|---|---|---|
| `express` | ^4.19.2 / 4.22.3 | Producción | API y routers. |
| `pg` | ^8.13.1 / 8.23.1 | Producción | PostgreSQL, Pool y transacciones. |
| `zod` | ^3.23.8 / 3.25.76 | Producción | Validación y env. |
| `bcrypt` | ^5.1.1 / 5.1.1 | Producción | Hash y comparación password. |
| `jsonwebtoken` | ^9.0.2 / 9.0.3 | Producción | JWT de acceso. |
| `helmet` | ^8.0.0 / 8.3.0 | Producción | Hardening HTTP/CSP. |
| `cors`, `cookie-parser`, `morgan` | ^2.8.5 / 2.8.6; ^1.4.7 / 1.4.7; ^1.10.0 / 1.12.1 | Producción | CORS, cookies, request log. |
| `express-rate-limit` | ^7.4.1 / 7.5.1 | Producción | Límite general. |
| `winston` | ^3.15.0 / 3.19.0 | Producción | Logs. |
| `node-pg-migrate` | ^7.5.2 / 7.9.1 | Producción | Script npm para migraciones SQL. |
| `dotenv` | no declarado en el package visible | Import utilizado | `env.ts` importa dotenv; la instalación debe verificarse contra lock/árbol transitorio. |
| `typescript`, `tsx` | ^5.7.2 / 5.9.3; ^4.19.2 / 4.23.15 | Desarrollo | Compilación, dev runner, scripts administrativos. |
| `jest`, `ts-jest`, tipos ESLint/middleware | varias | Desarrollo | Tooling configurado; pruebas no encontradas. |

`exceljs` ^4.4.0 / 4.4.0, `pdfkit` ^0.15.2 / 0.15.2 y `uuid` ^10.0.0 / 10.0.0 aparecen declaradas pero no se importan en `backend/src`; los reportes están stub, por lo que no se confirma exportación backend. `dotenv` se importa en `backend/src/config/env.ts` pero no figura como dependencia directa en `backend/package.json`; puede estar disponible transitivamente en el lockfile y conviene declarar dependencias runtime directas explícitamente.

## Configuración de herramientas

- Frontend TypeScript usa targets ES2023, modo bundler, JSX React, no emite y activa `noUnusedLocals`/`noUnusedParameters` (`tsconfig.app.json`).
- Backend TypeScript compila CommonJS ES2022 desde `src` a `dist`, strict (`backend/tsconfig.json`).
- Lockfiles: `frontend/package-lock.json`, `backend/package-lock.json`.
- Comandos y límites de ejecución: [instalación](08-instalacion.md).
