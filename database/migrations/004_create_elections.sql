-- ============================================================
-- Migración 004: Elecciones, Partidos y Candidatos
-- ============================================================

-- ── TIPOS DE ELECCIÓN ─────────────────────────────────────────
CREATE TABLE election_types (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE election_types IS 'Ej: Presidencial, Diputado, Alcalde, Concejo Municipal';

INSERT INTO election_types (name, description) VALUES
    ('Presidencial',     'Elección del Presidente y Vicepresidente de la República'),
    ('Diputado',         'Elección de diputados al Congreso de la República'),
    ('Alcalde',          'Elección de alcalde y corporación municipal'),
    ('Concejo Municipal','Elección de miembros del concejo municipal'),
    ('Estudio Comunitario','Encuesta sobre problemas y necesidades comunitarias');

-- ── ELECCIONES ESPECÍFICAS ────────────────────────────────────
CREATE TABLE elections (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    election_type_id UUID         NOT NULL REFERENCES election_types(id) ON DELETE RESTRICT,
    name             VARCHAR(200) NOT NULL,
    municipality_id  UUID         REFERENCES municipalities(id) ON DELETE RESTRICT,
    election_date    DATE,
    description      TEXT,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE elections IS 'Una elección específica (p.ej. Alcalde Guazacapán 2027)';

CREATE INDEX idx_elections_type ON elections (election_type_id);
CREATE INDEX idx_elections_muni ON elections (municipality_id);

CREATE TRIGGER elections_updated_at
    BEFORE UPDATE ON elections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── PARTIDOS POLÍTICOS ────────────────────────────────────────
CREATE TABLE political_parties (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(150) NOT NULL UNIQUE,
    acronym     VARCHAR(30)  NOT NULL,
    color       VARCHAR(7),
    logo_url    TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE political_parties IS 'Partidos políticos registrados. Los datos son ficticios en demo.';
COMMENT ON COLUMN political_parties.color IS 'Código hexadecimal del color oficial del partido, p.ej. #1A73E8';

CREATE TRIGGER political_parties_updated_at
    BEFORE UPDATE ON political_parties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── CANDIDATOS ────────────────────────────────────────────────
CREATE TABLE candidates (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID         NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
    party_id    UUID         REFERENCES political_parties(id) ON DELETE SET NULL,
    full_name   VARCHAR(255) NOT NULL,
    code        VARCHAR(30),
    photo_url   TEXT,
    sort_order  SMALLINT     NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE candidates IS 'Candidatos por elección. NO codificar nombres directamente en el frontend.';
COMMENT ON COLUMN candidates.sort_order IS 'Orden de presentación en el formulario de encuesta';

CREATE INDEX idx_candidates_election ON candidates (election_id);
CREATE INDEX idx_candidates_party    ON candidates (party_id);

CREATE TRIGGER candidates_updated_at
    BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
