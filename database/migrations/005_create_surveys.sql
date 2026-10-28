-- ============================================================
-- Migración 005: Encuestas, Preguntas y Opciones
-- Con soporte de versiones para no alterar registros históricos
-- ============================================================

-- ── ENCUESTAS ─────────────────────────────────────────────────
CREATE TYPE survey_status AS ENUM (
    'draft',      -- Borrador: solo visible al admin
    'active',     -- Activa: encuestadores pueden registrar
    'paused',     -- Pausada: sin nuevas entrevistas temporalmente
    'finished',   -- Finalizada: período de campo completado
    'archived'    -- Archivada: solo consulta histórica
);

CREATE TABLE surveys (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by       UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    election_type_id UUID          REFERENCES election_types(id) ON DELETE SET NULL,
    election_id      UUID          REFERENCES elections(id) ON DELETE SET NULL,
    municipality_id  UUID          REFERENCES municipalities(id) ON DELETE RESTRICT,
    name             VARCHAR(255)  NOT NULL,
    description      TEXT,
    status           survey_status NOT NULL DEFAULT 'draft',
    current_version  SMALLINT      NOT NULL DEFAULT 1,
    start_date       DATE,
    end_date         DATE,
    privacy_config   JSONB         NOT NULL DEFAULT '{"show_respondent_name": false, "require_gps": false, "min_age": 18}'::jsonb,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE surveys IS 'Encuestas configurables. El administrador crea y publica.';
COMMENT ON COLUMN surveys.current_version IS 'Versión activa de la encuesta. Incrementa al publicar cambios.';
COMMENT ON COLUMN surveys.privacy_config IS 'Configuración de privacidad: mostrar nombre, requerir GPS, edad mínima, etc.';

CREATE INDEX idx_surveys_status ON surveys (status);
CREATE INDEX idx_surveys_muni   ON surveys (municipality_id);

CREATE TRIGGER surveys_updated_at
    BEFORE UPDATE ON surveys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── VERSIONES DE ENCUESTA ─────────────────────────────────────
CREATE TABLE survey_versions (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id      UUID        NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    version_number SMALLINT    NOT NULL,
    snapshot       JSONB       NOT NULL, -- Copia completa de preguntas/opciones en ese momento
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes          TEXT,
    CONSTRAINT uq_survey_version UNIQUE (survey_id, version_number)
);

COMMENT ON TABLE survey_versions IS 'Historial de versiones. El snapshot permite reproducir la encuesta exactamente como era.';
COMMENT ON COLUMN survey_versions.snapshot IS 'JSON con preguntas y opciones vigentes al crear la versión.';

CREATE INDEX idx_survey_versions_survey ON survey_versions (survey_id);

-- ── TIPOS DE PREGUNTA ─────────────────────────────────────────
CREATE TYPE question_type AS ENUM (
    'yes_no',           -- Sí / No
    'single_choice',    -- Selección única
    'multiple_choice',  -- Selección múltiple
    'short_text',       -- Texto corto
    'long_text',        -- Texto largo
    'integer',          -- Número entero
    'decimal',          -- Número decimal
    'date',             -- Fecha
    'age',              -- Edad en años
    'choice_with_other' -- Selección con opción "Otro" + texto
);

-- ── PREGUNTAS ─────────────────────────────────────────────────
CREATE TABLE survey_questions (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id        UUID          NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    version_number   SMALLINT      NOT NULL DEFAULT 1,
    question_text    TEXT          NOT NULL,
    question_type    question_type NOT NULL,
    sort_order       SMALLINT      NOT NULL DEFAULT 0,
    is_required      BOOLEAN       NOT NULL DEFAULT TRUE,
    is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
    validation_rules JSONB         NOT NULL DEFAULT '{}'::jsonb,
    helper_text      TEXT,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE survey_questions IS 'Preguntas de una encuesta. El version_number permite mantener historial.';
COMMENT ON COLUMN survey_questions.validation_rules IS 'Ej: {"min": 18, "max": 120} para preguntas de edad.';

CREATE INDEX idx_questions_survey  ON survey_questions (survey_id);
CREATE INDEX idx_questions_order   ON survey_questions (survey_id, sort_order);
CREATE INDEX idx_questions_version ON survey_questions (survey_id, version_number);

CREATE TRIGGER survey_questions_updated_at
    BEFORE UPDATE ON survey_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── OPCIONES DE RESPUESTA ─────────────────────────────────────
CREATE TABLE question_options (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id       UUID        NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
    option_text       TEXT        NOT NULL,
    sort_order        SMALLINT    NOT NULL DEFAULT 0,
    is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
    allows_other_text BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE question_options IS 'Opciones de respuesta para preguntas de selección.';
COMMENT ON COLUMN question_options.allows_other_text IS 'TRUE para la opción "Otro" que habilita campo de texto adicional.';

CREATE INDEX idx_options_question ON question_options (question_id, sort_order);
