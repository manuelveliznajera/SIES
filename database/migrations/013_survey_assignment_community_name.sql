-- Permite editar el nombre de una comunidad dentro de un estudio sin cambiar
-- el catálogo geográfico compartido por otros estudios.
ALTER TABLE survey_assignments
  ADD COLUMN community_name VARCHAR(150);
