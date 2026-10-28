-- Up Migration
ALTER TABLE question_options ADD COLUMN color VARCHAR(7);

-- Down Migration
ALTER TABLE question_options DROP COLUMN color;
