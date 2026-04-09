-- Script SQL para corrigir o banco de dados e implementar convites

-- 1. Remover as restrições problemáticas primeiro para permitir a limpeza dos dados
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_type_check;

-- 2. Corrigir os dados na tabela profiles
-- Transforma variações de 'root' para 'Root'
UPDATE profiles 
SET role = 'Root' 
WHERE LOWER(role) = 'root';

-- Garante que todos os outros usuários tenham um cargo válido
UPDATE profiles 
SET role = 'Motorista' 
WHERE role NOT IN ('Admin', 'Motorista', 'Root') OR role IS NULL;

-- 3. Corrigir os dados na tabela vehicles
UPDATE vehicles
SET vehicle_type = 'veiculo'
WHERE vehicle_type NOT IN ('veiculo', 'maquina') OR vehicle_type IS NULL;

-- 4. Adicionar as novas restrições corretas
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('Admin', 'Motorista', 'Root'));
ALTER TABLE vehicles ADD CONSTRAINT vehicles_vehicle_type_check CHECK (vehicle_type IN ('veiculo', 'maquina'));

-- 5. Adicionar colunas ausentes na tabela vehicles
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS initial_odometer INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS initial_hourmeter INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_odometer INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_hourmeter INTEGER DEFAULT 0;

-- 6. Criar tabela de convites (invites)
CREATE TABLE IF NOT EXISTS invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('Admin', 'Motorista', 'Root')) DEFAULT 'Motorista',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (TIMEZONE('utc'::text, NOW()) + INTERVAL '24 hours'),
  used_at TIMESTAMP WITH TIME ZONE
);

-- 7. Configurar Segurança (RLS)
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para evitar erros de duplicidade
DROP POLICY IF EXISTS "Invites are viewable by Root" ON invites;
DROP POLICY IF EXISTS "Invites can be created by Root" ON invites;
DROP POLICY IF EXISTS "Invites are publicly readable by token" ON invites;

-- Criar novas políticas
CREATE POLICY "Invites are viewable by Root" ON invites FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Root')
);
CREATE POLICY "Invites can be created by Root" ON invites FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Root')
);
CREATE POLICY "Invites are publicly readable by token" ON invites FOR SELECT USING (true);
