/**
 * Rate limiter general para toda la API.
 * Límite: 100 peticiones por ventana de 15 minutos (configurable por env).
 */
export declare const generalRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Rate limiter para sincronización (más permisivo).
 * Los encuestadores pueden sincronizar varias veces en poco tiempo.
 */
export declare const syncRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
//# sourceMappingURL=rateLimiter.d.ts.map