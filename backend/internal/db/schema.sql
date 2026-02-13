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

-- Performance-Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_transfers_job_id ON transfers(job_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_tokens_token_value ON tokens(token_value);
CREATE INDEX IF NOT EXISTS idx_tokens_agent_id ON tokens(agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- Migration: transport_mode und last_poll_at Spalten für Polling-Support (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agents' AND column_name='transport_mode') THEN
    ALTER TABLE agents ADD COLUMN transport_mode VARCHAR(20) NOT NULL DEFAULT 'websocket';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agents' AND column_name='last_poll_at') THEN
    ALTER TABLE agents ADD COLUMN last_poll_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Agent Message Queue für HTTP Long-Polling Fallback
CREATE TABLE IF NOT EXISTS agent_message_queue (
  id BIGSERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  message_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  acked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_agent_message_queue_agent_pending
  ON agent_message_queue (agent_id, created_at)
  WHERE acked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_agent_message_queue_cleanup
  ON agent_message_queue (acked_at)
  WHERE acked_at IS NOT NULL;

-- Erstelle einen Admin-Benutzer, falls keiner existiert
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin') THEN
    INSERT INTO users (name, email, password_hash, role)
    VALUES ('Admin', 'admin@fileflux.de', '$2a$10$pYCe9H.DBLyg77sT5d9PruqXEy8ZRlGIt7bGFWA9yHTwcLgGovzJC', 'admin');
  END IF;
END $$; 

-- Phase 2: Chunked transfer columns (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transfers' AND column_name='file_hash') THEN
    ALTER TABLE transfers ADD COLUMN file_hash VARCHAR(64);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transfers' AND column_name='compression') THEN
    ALTER TABLE transfers ADD COLUMN compression VARCHAR(10) DEFAULT 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transfers' AND column_name='chunk_size') THEN
    ALTER TABLE transfers ADD COLUMN chunk_size INTEGER DEFAULT 8388608;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transfers' AND column_name='total_chunks') THEN
    ALTER TABLE transfers ADD COLUMN total_chunks INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transfers' AND column_name='completed_chunks') THEN
    ALTER TABLE transfers ADD COLUMN completed_chunks INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transfers' AND column_name='bytes_transferred') THEN
    ALTER TABLE transfers ADD COLUMN bytes_transferred BIGINT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transfers' AND column_name='retry_count') THEN
    ALTER TABLE transfers ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transfers' AND column_name='max_retries') THEN
    ALTER TABLE transfers ADD COLUMN max_retries INTEGER DEFAULT 3;
  END IF;
END $$;

-- Phase 2: Transfer chunks table
CREATE TABLE IF NOT EXISTS transfer_chunks (
  id SERIAL PRIMARY KEY,
  transfer_id INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_hash VARCHAR(64) NOT NULL DEFAULT '',
  size_compressed INTEGER NOT NULL DEFAULT 0,
  size_original INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  received_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (transfer_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_transfer_chunks_transfer ON transfer_chunks(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_chunks_status ON transfer_chunks(transfer_id, status);

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