-- ============================================================
-- Migración 002: Estructura Geográfica
-- Departamentos → Municipios → Comunidades
-- ============================================================

-- ── DEPARTAMENTOS ─────────────────────────────────────────────
CREATE TABLE departments (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    code       VARCHAR(10),
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_departments_name UNIQUE (name),
    CONSTRAINT uq_departments_code UNIQUE (code)
);

COMMENT ON TABLE departments IS 'Departamentos de Guatemala';

CREATE INDEX idx_departments_active ON departments (is_active);

CREATE TRIGGER departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── MUNICIPIOS ────────────────────────────────────────────────
CREATE TABLE municipalities (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID         NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    name          VARCHAR(100) NOT NULL,
    code          VARCHAR(10),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_municipalities_name_dept UNIQUE (department_id, name),
    CONSTRAINT uq_municipalities_code      UNIQUE (code)
);

COMMENT ON TABLE municipalities IS 'Municipios agrupados por departamento';

CREATE INDEX idx_municipalities_dept   ON municipalities (department_id);
CREATE INDEX idx_municipalities_active ON municipalities (is_active);

CREATE TRIGGER municipalities_updated_at
    BEFORE UPDATE ON municipalities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── COMUNIDADES ───────────────────────────────────────────────
CREATE TABLE communities (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID         NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
    name            VARCHAR(150) NOT NULL,
    code            VARCHAR(20)  NOT NULL,
    description     TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_communities_code_muni UNIQUE (municipality_id, code),
    CONSTRAINT uq_communities_name_muni UNIQUE (municipality_id, name)
);

COMMENT ON TABLE communities IS 'Comunidades/aldeas/colonias dentro de un municipio';

CREATE INDEX idx_communities_municipality ON communities (municipality_id);
CREATE INDEX idx_communities_active       ON communities (is_active);

CREATE TRIGGER communities_updated_at
    BEFORE UPDATE ON communities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
