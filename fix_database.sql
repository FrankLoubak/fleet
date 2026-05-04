-- Script SQL consolidado para correções de esquema, RLS e novas funcionalidades

-- 1. LIMPEZA E AJUSTE DE CONSTRAINTS
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_type_check;

UPDATE profiles SET role = 'Root' WHERE LOWER(role) = 'root';
UPDATE profiles SET role = 'Motorista' WHERE role NOT IN ('Admin', 'Motorista', 'Root') OR role IS NULL;
UPDATE vehicles SET vehicle_type = 'veiculo' WHERE vehicle_type NOT IN ('veiculo', 'maquina') OR vehicle_type IS NULL;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('Admin', 'Motorista', 'Root'));
ALTER TABLE vehicles ADD CONSTRAINT vehicles_vehicle_type_check CHECK (vehicle_type IN ('veiculo', 'maquina'));

-- 2. ADIÇÃO DE COLUNAS FALTANTES
-- Veículos
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS initial_odometer INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS initial_hourmeter INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_odometer INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_hourmeter INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_odometer INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS prefix TEXT;

-- Solicitações de Manutenção
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS budget_value DECIMAL(10,2);
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS service_request_number TEXT;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS material_request_number TEXT;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Manutenções
ALTER TABLE maintenances ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES maintenance_requests(id) ON DELETE SET NULL;
ALTER TABLE maintenances ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'executada';

-- 3. TABELA DE CONVITES
CREATE TABLE IF NOT EXISTS invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('Admin', 'Motorista', 'Root')) DEFAULT 'Motorista',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (TIMEZONE('utc'::text, NOW()) + INTERVAL '24 hours'),
  used_at TIMESTAMP WITH TIME ZONE
);

-- 4. POLÍTICAS DE SEGURANÇA (RLS)
-- Habilitar RLS
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Limpar políticas existentes para evitar conflitos
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- --- DEFINIÇÃO DE POLÍTICAS ---

-- Profiles
CREATE POLICY "Profiles_Select" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles_Update_Own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles_Root_All" ON profiles FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Root'));

-- Vehicles
CREATE POLICY "Vehicles_Select" ON vehicles FOR SELECT USING (true);
CREATE POLICY "Vehicles_Admin_Root_All" ON vehicles FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Root')));

-- Journeys
CREATE POLICY "Journeys_Select" ON journeys FOR SELECT USING (true);
CREATE POLICY "Journeys_User_All" ON journeys FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Journeys_Admin_Root_All" ON journeys FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Root')));

-- Refuelings
CREATE POLICY "Refuelings_Select" ON refuelings FOR SELECT USING (true);
CREATE POLICY "Refuelings_Insert" ON refuelings FOR INSERT WITH CHECK (true);
CREATE POLICY "Refuelings_Admin_Root_All" ON refuelings FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Root')));

-- Maintenances
CREATE POLICY "Maintenances_Select" ON maintenances FOR SELECT USING (true);
CREATE POLICY "Maintenances_Insert" ON maintenances FOR INSERT WITH CHECK (true);
CREATE POLICY "Maintenances_Admin_Root_All" ON maintenances FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Root')));

-- Maintenance Requests
CREATE POLICY "MaintReq_Select" ON maintenance_requests FOR SELECT USING (true);
CREATE POLICY "MaintReq_User_All" ON maintenance_requests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "MaintReq_Admin_Root_All" ON maintenance_requests FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Root')));

-- Invites
CREATE POLICY "Invites_Root_All" ON invites FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Root'));
CREATE POLICY "Invites_Public_Select" ON invites FOR SELECT USING (true);

-- Banco de Horas
CREATE POLICY "TimeBank_Select" ON banco_de_horas FOR SELECT USING (true);
CREATE POLICY "TimeBank_User_All" ON banco_de_horas FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "TimeBank_Admin_Root_All" ON banco_de_horas FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Root')));
