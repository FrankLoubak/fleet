-- Script SQL para corrigir o banco de dados e implementar convites

-- 1. Atualizar a restrição de role na tabela profiles para incluir 'Root'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('Admin', 'Motorista', 'Root'));

-- 2. Adicionar colunas ausentes na tabela vehicles
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS initial_odometer INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS initial_hourmeter INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_odometer INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_hourmeter INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'veiculo' CHECK (vehicle_type IN ('veiculo', 'maquina'));

-- 3. Criar tabela de convites (invites)
CREATE TABLE IF NOT EXISTS invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('Admin', 'Motorista', 'Root')) DEFAULT 'Motorista',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (TIMEZONE('utc'::text, NOW()) + INTERVAL '24 hours'),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS para invites
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Políticas para invites
-- Root pode ver e criar convites
CREATE POLICY "Invites are viewable by Root" ON invites FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Root')
);
CREATE POLICY "Invites can be created by Root" ON invites FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Root')
);
-- Permitir leitura pública por token (necessário para o registro validar o convite)
CREATE POLICY "Invites are publicly readable by token" ON invites FOR SELECT USING (true);
