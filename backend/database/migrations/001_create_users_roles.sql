-- ============================================================
-- Migración 001: Usuarios y Roles
-- EncuestaApp — Sistema de Encuestas Electorales Guatemala
-- ============================================================

-- Extensión para UUIDs nativos
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ROLES ────────────────────────────────────────────────────
CREATE TABLE roles (
    id          SMALLSERIAL PRIMARY KEY,
    name        VARCHAR(50)  NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'Roles del sistema: ADMIN, ENUMERATOR';

INSERT INTO roles (name, description) VALUES
    ('ADMIN',      'Administrador con acceso total al sistema'),
    ('ENUMERATOR', 'Encuestador con acceso restringido a sus asignaciones');

-- ── USUARIOS ─────────────────────────────────────────────────
CREATE TABLE users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(80)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    failed_attempts SMALLINT   NOT NULL DEFAULT 0,
    locked_until  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_login    TIMESTAMPTZ
);

COMMENT ON COLUMN users.password_hash IS 'Hash bcrypt, nunca texto plano';
COMMENT ON COLUMN users.failed_attempts IS 'Contador de intentos fallidos de login';
COMMENT ON COLUMN users.locked_until IS 'Bloqueo temporal tras intentos excesivos';

CREATE INDEX idx_users_email    ON users (email);
CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_active   ON users (is_active);

-- ── RELACIÓN USUARIOS-ROLES ───────────────────────────────────
CREATE TABLE user_roles (
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     SMALLINT    NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID        REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);

COMMENT ON TABLE user_roles IS 'Relación muchos-a-muchos entre usuarios y roles';

-- ── REFRESH TOKENS ────────────────────────────────────────────
CREATE TABLE refresh_tokens (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    revoked_at  TIMESTAMPTZ,
    device_hint VARCHAR(255)
);

COMMENT ON TABLE refresh_tokens IS 'Refresh tokens rotantes para autenticación persistente';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'Hash SHA-256 del token, no el token en claro';

CREATE INDEX idx_refresh_tokens_user    ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);

-- ── FUNCIÓN: actualizar updated_at automáticamente ────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
