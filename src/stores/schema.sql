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