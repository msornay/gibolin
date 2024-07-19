CREATE USER gibolin WITH PASSWORD 'gibolin';
CREATE DATABASE gibolin;
GRANT ALL PRIVILEGES ON DATABASE gibolin TO gibolin;
\connect gibolin;
GRANT CREATE ON SCHEMA public TO gibolin;
