-- ============================================================
-- Migración 006: Asignaciones
-- Encuesta → Comunidad → Encuestador → Meta
-- ============================================================

CREATE TYPE assignment_status AS ENUM (
    'pending',    -- Asignación creada, pendiente de iniciar
    'active',     -- En campo
    'completed',  -- Meta alcanzada o período finalizado
    'cancelled'   -- Revocada por el administrador
);

CREATE TABLE survey_assignments (
    id             UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id      UUID              NOT NULL REFERENCES surveys(id) ON DELETE RESTRICT,
    community_id   UUID              NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
    enumerator_id  UUID              NOT NULL REFERENCES enumerators(id) ON DELETE RESTRICT,
    assigned_by    UUID              NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    interview_goal INTEGER           NOT NULL DEFAULT 0 CHECK (interview_goal >= 0),
    status         assignment_status NOT NULL DEFAULT 'pending',
    start_date     DATE,
    end_date       DATE,
    notes          TEXT,
    created_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    -- Un encuestador no puede tener la misma encuesta+comunidad duplicada mientras esté activo
    CONSTRAINT uq_assignment_active UNIQUE (survey_id, community_id, enumerator_id)
);

COMMENT ON TABLE survey_assignments IS 'Asignación de una comunidad específica a un encuestador para una encuesta.';
COMMENT ON COLUMN survey_assignments.interview_goal IS 'Meta de entrevistas para esta asignación específica.';
COMMENT ON COLUMN survey_assignments.status IS 'La autorización se comprueba en el backend al registrar cada entrevista.';

CREATE INDEX idx_assignments_survey     ON survey_assignments (survey_id);
CREATE INDEX idx_assignments_enumerator ON survey_assignments (enumerator_id);
CREATE INDEX idx_assignments_community  ON survey_assignments (community_id);
CREATE INDEX idx_assignments_status     ON survey_assignments (status);

CREATE TRIGGER survey_assignments_updated_at
    BEFORE UPDATE ON survey_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
