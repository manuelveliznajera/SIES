-- ============================================================
-- Migración 003: Encuestadores
-- Perfil extendido del encuestador, vinculado a users
-- ============================================================

CREATE TABLE enumerators (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    code        VARCHAR(20)  NOT NULL UNIQUE,
    full_name   VARCHAR(255) NOT NULL,
    phone       VARCHAR(20),
    notes       TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_access TIMESTAMPTZ
);

COMMENT ON TABLE enumerators IS 'Perfil extendido de encuestadores. Vinculado a users para autenticación.';
COMMENT ON COLUMN enumerators.code IS 'Código único de encuestador, p.ej. ENC-001. Solo identificador, NO es credencial.';
COMMENT ON COLUMN enumerators.user_id IS 'La autenticación se realiza a través de la tabla users.';

CREATE INDEX idx_enumerators_user   ON enumerators (user_id);
CREATE INDEX idx_enumerators_active ON enumerators (is_active);
CREATE INDEX idx_enumerators_code   ON enumerators (code);

CREATE TRIGGER enumerators_updated_at
    BEFORE UPDATE ON enumerators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
