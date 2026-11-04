-- Datos de origen para auditar desde qué aplicación/origen se inició sesión.
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS origin VARCHAR(500);

-- Errores del backend y del cliente, consultables únicamente por ADMIN.
CREATE TABLE IF NOT EXISTS application_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(20) NOT NULL CHECK (source IN ('backend', 'frontend')),
  severity VARCHAR(20) NOT NULL DEFAULT 'error' CHECK (severity IN ('error', 'warning')),
  message TEXT NOT NULL,
  stack TEXT,
  path VARCHAR(1000),
  method VARCHAR(12),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_error_created_at
  ON application_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_error_source
  ON application_error_logs (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_error_user
  ON application_error_logs (user_id, created_at DESC);
