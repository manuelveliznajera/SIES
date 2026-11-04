# Documentación técnica de SIES — Encuesta App

Esta guía describe la implementación que se encontró en el repositorio `EncuestaApp`. Se priorizan el código fuente, las rutas registradas y las migraciones SQL. El `README.md` raíz se usa para comandos e intención de despliegue, pero las afirmaciones que no coinciden con el código se señalan como no verificadas.

## Índice

1. [Arquitectura](01-arquitectura.md)
2. [Frontend](02-frontend.md)
3. [Backend](03-backend.md)
4. [Endpoints](04-api-endpoints.md)
5. [Base de datos](05-base-de-datos.md)
6. [Dependencias](06-dependencias.md)
7. [Seguridad](07-seguridad.md)
8. [Instalación y ejecución](08-instalacion.md)
9. [Flujos funcionales](09-flujos-funcionales.md)
10. [Mantenimiento](10-mantenimiento.md)
11. [Inventario de archivos](11-inventario-archivos.md)

## Alcance y límites de verificación

- Se inspeccionó el código en `frontend/src`, `backend/src`, `database/migrations`, manifests, lockfiles y configuración versionada.
- Se revisaron rutas de API, validadores, controladores, servicios SQL, middleware, flujos de formulario, configuración y dependencias bloqueadas.
- El motor configurado es PostgreSQL mediante `DATABASE_URL` y la librería `pg`. No se consultó el servidor desplegado; nombre de base de datos, host, puerto, versión activa, extensiones instaladas y estado de migraciones dependen del entorno.
- No se encontraron archivos Docker/Compose, OpenAPI/Swagger, manifiesto/service worker de PWA ni pruebas automatizadas en el árbol de `tests/` (el directorio está vacío). El script npm de pruebas no constituye evidencia de pruebas existentes.
- No se leyó ni se documentó `backend/.env`; no se incluyen credenciales.
- El alcance fue documental. No se modificó lógica funcional, dependencias ni configuración; no se ejecutaron migraciones.

## Resumen verificado

React + TypeScript + Vite forman un frontend de una sola aplicación React, principalmente concentrada en `frontend/src/App.tsx`. Express + TypeScript exponen una API REST en `backend/src`, con rutas, controladores y servicios para autenticación, usuarios, encuestas, asignaciones y entrevistas. PostgreSQL se accede con consultas SQL parametrizadas y transacciones de `pg`.

Las operaciones reales de usuarios, encuestas y entrevistas recorren API y servicios hasta PostgreSQL. Geografía, enumeradores, elecciones, candidatos, reportes y sincronización tienen endpoints autenticados `/health` marcados como pendientes, pero no operaciones funcionales implementadas. El paquete contiene dependencias de PWA, IndexedDB, React Router, React Query, formularios y Excel que no se importan en el código fuente inspeccionado.
