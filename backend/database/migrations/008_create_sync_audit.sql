-- ============================================================
-- Migración 008: Sincronización y Auditoría
-- ============================================================

-- ── OPERACIONES DE SINCRONIZACIÓN ────────────────────────────
CREATE TYPE sync_op_status AS ENUM (
    'started',
    'completed',
    'partial',  -- Algunos registros aceptados, otros rechazados
    'failed'
);

CREATE TABLE sync_operations (
    id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    enumerator_id     UUID           REFERENCES enumerators(id) ON DELETE SET NULL,
    device_fingerprint VARCHAR(64),  -- Hash del user-agent + pantalla (anonimizado, sin datos personales)
    status            sync_op_status NOT NULL DEFAULT 'started',
    records_sent      INTEGER        NOT NULL DEFAULT 0,
    records_accepted  INTEGER        NOT NULL DEFAULT 0,
    records_rejected  INTEGER        NOT NULL DEFAULT 0,
    rejection_details JSONB,         -- Motivos de rechazo sin datos sensibles
    started_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMPTZ
);

COMMENT ON TABLE sync_operations IS 'Registro de cada operación de sincronización. Permite auditar el historial.';
COMMENT ON COLUMN sync_operations.device_fingerprint IS 'Hash anonimizado del dispositivo. Sin contraseñas ni tokens.';

CREATE INDEX idx_sync_ops_user   ON sync_operations (user_id);
CREATE INDEX idx_sync_ops_status ON sync_operations (status);
CREATE INDEX idx_sync_ops_date   ON sync_operations (started_at);

-- ── LOGS DE SINCRONIZACIÓN (por entrevista) ───────────────────
CREATE TABLE sync_logs (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id         UUID        NOT NULL REFERENCES sync_operations(id) ON DELETE CASCADE,
    interview_device_uuid UUID       NOT NULL, -- UUID del dispositivo (sin FK para tolerar rechazos)
    result               VARCHAR(20) NOT NULL, -- 'accepted', 'rejected', 'duplicate'
    error_code           VARCHAR(50),
    error_message        TEXT,
    processed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sync_logs IS 'Resultado por entrevista de cada operación de sync.';
COMMENT ON COLUMN sync_logs.interview_device_uuid IS 'Sin FK: puede que el registro no se haya guardado si fue rechazado.';

CREATE INDEX idx_sync_logs_operation ON sync_logs (operation_id);
CREATE INDEX idx_sync_logs_uuid      ON sync_logs (interview_device_uuid);

-- ── LOGS DE AUDITORÍA ─────────────────────────────────────────
CREATE TABLE audit_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,    -- Ej: 'survey.create', 'interview.view', 'user.deactivate'
    entity_type VARCHAR(50),              -- Ej: 'survey', 'interview', 'enumerator'
    entity_id   UUID,
    changes     JSONB,                    -- Datos cambiados (campos sensibles redactados)
    ip_address  VARCHAR(45),             -- IPv4 o IPv6
    user_agent  VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS 'Registro de auditoría para trazabilidad de acciones administrativas.';
COMMENT ON COLUMN audit_logs.changes IS 'Contiene los cambios. Campos como password_hash aparecen como [REDACTED].';

CREATE INDEX idx_audit_logs_user       ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_entity     ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_action     ON audit_logs (action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);
