-- ============================================================
-- Migración 007: Entrevistas, Respuestas y Geolocalización
-- Núcleo del sistema de recolección de datos
-- ============================================================

-- ── ENTREVISTADOS ─────────────────────────────────────────────
-- Tabla separada para proteger datos personales
CREATE TYPE education_level AS ENUM (
    'none',              -- Sin escolaridad
    'primary_incomplete',-- Primaria incompleta
    'primary_complete',  -- Primaria completa
    'basic',             -- Básico
    'diversified',       -- Diversificado
    'university',        -- Universitario
    'postgraduate',      -- Posgrado
    'prefers_not_to_say' -- Prefiere no responder
);

CREATE TYPE sex_type AS ENUM (
    'male',              -- Masculino
    'female',            -- Femenino
    'prefers_not_to_say' -- Prefiere no responder
);

CREATE TABLE respondents (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(255),   -- OPCIONAL según configuración de la encuesta
    sex             sex_type,
    age             SMALLINT        CHECK (age IS NULL OR (age >= 0 AND age <= 120)),
    education_level education_level,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE respondents IS 'Datos personales del entrevistado. Separados de las respuestas para privacidad.';
COMMENT ON COLUMN respondents.full_name IS 'Opcional. Nunca vincular públicamente con preferencias políticas.';

-- ── ESTADOS DE SINCRONIZACIÓN ─────────────────────────────────
CREATE TYPE sync_status AS ENUM (
    'local_only',   -- Solo en el dispositivo, sin conexión
    'pending',      -- En cola de sincronización
    'syncing',      -- Enviándose al servidor
    'synced',       -- Confirmado por el servidor
    'rejected',     -- Rechazado por el servidor (requiere revisión)
    'conflict'      -- Conflicto que requiere intervención administrativa
);

CREATE TYPE interview_status AS ENUM (
    'in_progress',  -- En curso
    'completed',    -- Completada correctamente
    'partial',      -- Incompleta (entrevistado no quiso terminar)
    'cancelled'     -- Cancelada
);

-- ── ENTREVISTAS ───────────────────────────────────────────────
CREATE TABLE interviews (
    id                    UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    device_uuid           UUID             NOT NULL UNIQUE, -- UUID generado en el dispositivo
    survey_id             UUID             NOT NULL REFERENCES surveys(id) ON DELETE RESTRICT,
    survey_version_id     UUID             REFERENCES survey_versions(id) ON DELETE RESTRICT,
    assignment_id         UUID             NOT NULL REFERENCES survey_assignments(id) ON DELETE RESTRICT,
    enumerator_id         UUID             NOT NULL REFERENCES enumerators(id) ON DELETE RESTRICT,
    community_id          UUID             NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
    respondent_id         UUID             REFERENCES respondents(id) ON DELETE SET NULL,
    status                interview_status NOT NULL DEFAULT 'in_progress',
    sync_status           sync_status      NOT NULL DEFAULT 'local_only',
    -- Tiempo
    interviewed_at_device TIMESTAMPTZ      NOT NULL, -- Hora del dispositivo
    received_at_server    TIMESTAMPTZ,               -- Hora de recepción en servidor
    -- Geolocalización (nullable: puede no estar disponible)
    latitude              NUMERIC(10, 7),
    longitude             NUMERIC(10, 7),
    gps_accuracy_meters   NUMERIC(8, 2),
    gps_captured_at       TIMESTAMPTZ,
    gps_source            VARCHAR(30),     -- 'gps', 'network', 'manual_authorized', 'unavailable'
    gps_status            VARCHAR(30),     -- 'ok', 'low_accuracy', 'unavailable', 'denied'
    -- Privacidad
    privacy_accepted      BOOLEAN          NOT NULL DEFAULT FALSE,
    -- Metadatos
    device_info           JSONB,           -- SO, versión del navegador, etc. (anonimizado)
    survey_version_used   SMALLINT,        -- Versión de la encuesta al momento de la entrevista
    notes                 TEXT,
    created_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    -- Validaciones de coordenadas
    CONSTRAINT chk_latitude  CHECK (latitude  IS NULL OR (latitude  BETWEEN -90  AND 90)),
    CONSTRAINT chk_longitude CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)),
    CONSTRAINT chk_accuracy  CHECK (gps_accuracy_meters IS NULL OR gps_accuracy_meters >= 0)
);

COMMENT ON TABLE interviews IS 'Núcleo del sistema. device_uuid garantiza idempotencia en sincronización.';
COMMENT ON COLUMN interviews.device_uuid IS 'UUID generado con crypto.randomUUID() en el dispositivo. UNIQUE en servidor.';
COMMENT ON COLUMN interviews.latitude IS 'Almacenado con 7 decimales (~1cm precisión). Nullable.';
COMMENT ON COLUMN interviews.gps_source IS 'Distingue coordenadas reales de ubicaciones manuales autorizadas.';
COMMENT ON COLUMN interviews.privacy_accepted IS 'El entrevistado debe aceptar el aviso de privacidad para continuar.';

CREATE INDEX idx_interviews_survey      ON interviews (survey_id);
CREATE INDEX idx_interviews_assignment  ON interviews (assignment_id);
CREATE INDEX idx_interviews_enumerator  ON interviews (enumerator_id);
CREATE INDEX idx_interviews_community   ON interviews (community_id);
CREATE INDEX idx_interviews_sync_status ON interviews (sync_status);
CREATE INDEX idx_interviews_status      ON interviews (status);
CREATE INDEX idx_interviews_date        ON interviews (interviewed_at_device);
-- Índice parcial para entrevistas geolocalizadas (consultas de mapa)
CREATE INDEX idx_interviews_geo ON interviews (latitude, longitude)
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE TRIGGER interviews_updated_at
    BEFORE UPDATE ON interviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RESPUESTAS ────────────────────────────────────────────────
CREATE TABLE answers (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id     UUID        NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    question_id      UUID        NOT NULL REFERENCES survey_questions(id) ON DELETE RESTRICT,
    question_version SMALLINT    NOT NULL DEFAULT 1, -- Versión de la pregunta al momento de responder
    -- Los valores se almacenan según el tipo de pregunta
    text_value       TEXT,        -- short_text, long_text, choice_with_other (texto libre)
    numeric_value    NUMERIC,     -- integer, decimal, age
    date_value       DATE,        -- date
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_answer_per_question UNIQUE (interview_id, question_id)
);

COMMENT ON TABLE answers IS 'Una respuesta por pregunta por entrevista. El texto original se conserva sin modificaciones.';
COMMENT ON COLUMN answers.text_value IS 'Para respuestas de texto: se conserva el original, nunca se sobrescribe con clasificaciones automáticas.';

CREATE INDEX idx_answers_interview ON answers (interview_id);
CREATE INDEX idx_answers_question  ON answers (question_id);

-- ── SELECCIONES DE OPCIONES ───────────────────────────────────
CREATE TABLE answer_option_selections (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id   UUID        NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
    option_id   UUID        NOT NULL REFERENCES question_options(id) ON DELETE RESTRICT,
    other_text  TEXT,       -- Solo cuando la opción tiene allows_other_text = TRUE
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_selection UNIQUE (answer_id, option_id)
);

COMMENT ON TABLE answer_option_selections IS 'Opciones seleccionadas. Soporta selección múltiple y opción "Otro".';

CREATE INDEX idx_selections_answer ON answer_option_selections (answer_id);
CREATE INDEX idx_selections_option ON answer_option_selections (option_id);
