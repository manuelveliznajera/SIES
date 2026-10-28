-- Up Migration
ALTER TABLE users ADD COLUMN phone VARCHAR(30);
ALTER TABLE enumerators ALTER COLUMN phone TYPE VARCHAR(30);
UPDATE users u
SET phone = e.phone
FROM enumerators e
WHERE e.user_id = u.id AND u.phone IS NULL;

INSERT INTO roles (name, description)
VALUES ('SUPERVISOR', 'Supervisor con acceso de supervisión');

-- Down Migration
DELETE FROM user_roles WHERE role_id = (SELECT id FROM roles WHERE name = 'SUPERVISOR');
DELETE FROM roles WHERE name = 'SUPERVISOR';
ALTER TABLE users DROP COLUMN phone;
ALTER TABLE enumerators ALTER COLUMN phone TYPE VARCHAR(20);
