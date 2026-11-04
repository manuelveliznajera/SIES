-- Up Migration
-- Elimina el administrador de demostración inseguro de la migración 009.
DELETE FROM users
WHERE username = 'Mveliz'
  AND email = 'mveliz@encuestas.gt'
  AND password_hash = '$2b$12$RT/JU4gW4a5MAMal98N39uC5n1UmmE4RxSE0mxJLcY1doaXZHWpSC';

-- Down Migration
SELECT 1;
