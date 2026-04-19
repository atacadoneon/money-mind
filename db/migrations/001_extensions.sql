-- =============================================================================
-- MIGRATION 001: Extensions
-- Habilita extensões necessárias no PostgreSQL 16.
-- Idempotente.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS "btree_gin";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'btree_gin indisponível neste ambiente (não-crítico para dev): %', SQLERRM;
END $$;
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Schema auth (stub local para dev; no Supabase já existe)
CREATE SCHEMA IF NOT EXISTS auth;

-- Stub de auth.users só para ambiente local (no Supabase a tabela real existe)
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  encrypted_password TEXT,
  raw_user_meta_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stub auth.uid() — no Supabase é built-in; aqui lê session var app.current_user_id
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Função utilitária: trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
