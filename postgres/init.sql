CREATE USER gibolin WITH PASSWORD 'gibolin';

-- needed for django to create dbs for unit test
ALTER USER gibolin CREATEDB;

CREATE DATABASE gibolin;
GRANT ALL PRIVILEGES ON DATABASE gibolin TO gibolin;
\connect gibolin;
GRANT CREATE ON SCHEMA public TO gibolin;

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TEXT SEARCH CONFIGURATION simple_unaccent (COPY = simple);
ALTER TEXT SEARCH CONFIGURATION simple_unaccent
    ALTER MAPPING FOR hword, hword_part, word
    WITH unaccent, simple;
