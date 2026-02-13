-- Benutzer-Tabelle
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Agenten-Tabelle
CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'server', 'client'
  status VARCHAR(50) NOT NULL DEFAULT 'offline', -- 'online', 'offline', 'error'
  ip_address VARCHAR(255),
  system VARCHAR(255),
  version VARCHAR(50),
  last_seen TIMESTAMP WITH TIME ZONE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Token-Tabelle
CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  token_value VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used TIMESTAMP WITH TIME ZONE,
  description TEXT
);

-- Jobs-Tabelle
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'push', 'pull'
  status VARCHAR(50) NOT NULL DEFAULT 'inactive', -- 'active', 'inactive', 'error', 'paused'
  schedule VARCHAR(255), -- Cron-Format
  source_path TEXT NOT NULL,
  destination_path TEXT NOT NULL,
  source_agent_id INTEGER REFERENCES agents(id),
  destination_agent_id INTEGER REFERENCES agents(id),
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Transfers-Tabelle
CREATE TABLE IF NOT EXISTS transfers (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  filename VARCHAR(255) NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL, -- 'pending', 'running', 'completed', 'failed'
  progress DOUBLE PRECISION NOT NULL DEFAULT 0,
  source_path TEXT NOT NULL,
  destination_path TEXT NOT NULL,
  source_agent_id INTEGER REFERENCES agents(id),
  destination_agent_id INTEGER REFERENCES agents(id),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Migration: progress-Spalte hinzufügen (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transfers' AND column_name='progress') THEN
    ALTER TABLE transfers ADD COLUMN progress DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Erstelle einen Admin-Benutzer, falls keiner existiert
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin') THEN
    INSERT INTO users (name, email, password_hash, role)
    VALUES ('Admin', 'admin@fileflux.de', '$2a$10$pYCe9H.DBLyg77sT5d9PruqXEy8ZRlGIt7bGFWA9yHTwcLgGovzJC', 'admin');
  END IF;
END $$; 

-- Erstelle einen Demo-Agenten mit Token für Docker-Entwicklung
DO $$
DECLARE
  v_agent_id INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Central-Agent') THEN
    INSERT INTO agents (name, type, status, description)
    VALUES ('Central-Agent', 'server', 'offline', 'Default agent for Docker development')
    RETURNING id INTO v_agent_id;

    INSERT INTO tokens (agent_id, name, token_value, description)
    VALUES (v_agent_id, 'central-agent-token', 'demo-agent-secret-token', 'Default token for Docker development');
  END IF;
END $$;