CREATE USER gibolin WITH PASSWORD 'gibolin';

-- needed for django to create dbs for unit test
ALTER USER gibolin CREATEDB;

CREATE DATABASE gibolin;
GRANT ALL PRIVILEGES ON DATABASE gibolin TO gibolin;
\connect gibolin;
GRANT CREATE ON SCHEMA public TO gibolin;



