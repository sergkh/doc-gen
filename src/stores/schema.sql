CREATE TABLE IF NOT EXISTS course_results (
  id SERIAL PRIMARY KEY,
  no INTEGER NOT NULL,
  type VARCHAR(64) NOT NULL,
  name VARCHAR(2048) NOT NULL,
  specialty_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_course_results_no_type_specialty ON course_results (no, type, specialty_id);

CREATE TABLE IF NOT EXISTS courses(
  id SERIAL PRIMARY KEY,
  name VARCHAR(512) NOT NULL UNIQUE,
  teacher_id INTEGER,
  specialty_id INTEGER,
  data JSONB,
  generated JSONB,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_topics(
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL,
  index INTEGER NOT NULL,
  name VARCHAR(512) NOT NULL,
  lection TEXT NOT NULL,
  generated JSONB not null default '{}'::jsonb,
  data JSONB not null default '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teachers(
  id SERIAL PRIMARY KEY,
  name VARCHAR(512) NOT NULL UNIQUE,
  email VARCHAR(256) UNIQUE,
  position VARCHAR(512),
  academic_title VARCHAR(512),
  alt_names JSONB not null default '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS templates(
  id SERIAL PRIMARY KEY,
  name VARCHAR(512) NOT NULL UNIQUE,
  file VARCHAR(512) NOT NULL,
  data JSONB not null default '{}'::jsonb,
  prompts JSONB not null default '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS specialties(
  id SERIAL PRIMARY KEY,
  code VARCHAR(64),
  name VARCHAR(512) NOT NULL UNIQUE,
  old_code VARCHAR(64),
  old_name VARCHAR(512),
  area_code VARCHAR(64),
  area VARCHAR(512) NOT NULL,
  qualification VARCHAR(512) NOT NULL,
  data JSONB not null default '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teacher_publications(
  id SERIAL PRIMARY KEY,
  repo_id VARCHAR(64),
  teacher_id INTEGER NOT NULL,
  title VARCHAR(1024) NOT NULL,
  journal VARCHAR(1024),
  year INTEGER,
  publication_type VARCHAR(256),
  data JSONB not null default '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doc_version_records(
  id SERIAL PRIMARY KEY,
  object_id INTEGER NOT NULL,
  object_type VARCHAR(64) NOT NULL,
  type VARCHAR(64) NOT NULL,
  stamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  comment TEXT,
  data JSONB not null default '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_doc_version_records_object_id ON doc_version_records (object_id);
CREATE INDEX IF NOT EXISTS idx_doc_version_records_stamp ON doc_version_records (stamp);

CREATE TABLE IF NOT EXISTS prompts (
    id SERIAL PRIMARY KEY,
    index integer NOT NULL,
    type character varying(64) NOT NULL,
    field character varying(512) NOT NULL,
    system_prompt text NOT NULL,
    prompt text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    model character varying(64) DEFAULT 'gpt-4o'::character varying NOT NULL
);