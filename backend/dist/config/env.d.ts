export declare const env: {
    NODE_ENV: "development" | "production" | "test";
    PORT: number;
    API_VERSION: string;
    DATABASE_URL: string;
    DATABASE_SSL: boolean;
    DATABASE_POOL_MIN: number;
    DATABASE_POOL_MAX: number;
    JWT_SECRET: string;
    JWT_ACCESS_EXPIRY: string;
    JWT_REFRESH_EXPIRY: string;
    COOKIE_SECRET: string;
    COOKIE_SECURE: boolean;
    COOKIE_SAME_SITE: "strict" | "lax" | "none";
    CORS_ORIGIN: string;
    RATE_LIMIT_WINDOW_MS: number;
    RATE_LIMIT_MAX_REQUESTS: number;
    LOG_LEVEL: "error" | "warn" | "info" | "debug";
    REPORTS_TEMP_DIR: string;
    MAX_EXPORT_ROWS: number;
    ENUMERATOR_CODE_PREFIX: string;
    SEED_ADMIN_USERNAME?: string | undefined;
    SEED_ADMIN_EMAIL?: string | undefined;
    SEED_ADMIN_FULL_NAME?: string | undefined;
    SEED_ADMIN_PASSWORD?: string | undefined;
};
export type Env = typeof env;
//# sourceMappingURL=env.d.ts.map