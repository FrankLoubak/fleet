-- Script para corrigir RLS e evitar recursão usando funções SECURITY DEFINER

-- 1. Criar funções auxiliares para verificar papéis sem disparar RLS recursivo
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_root()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'Root'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_root()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('Admin', 'Root')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Limpar políticas existentes para as tabelas principais
DROP POLICY IF EXISTS "Profiles_Select" ON profiles;
DROP POLICY IF EXISTS "Profiles_Update_Own" ON profiles;
DROP POLICY IF EXISTS "Profiles_Root_All" ON profiles;

DROP POLICY IF EXISTS "Vehicles_Select" ON vehicles;
DROP POLICY IF EXISTS "Vehicles_Admin_Root_All" ON vehicles;

-- 3. Aplicar novas políticas usando as funções
-- Profiles
CREATE POLICY "Profiles_Select_All" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles_Update_Own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles_Root_All" ON profiles FOR ALL USING (is_root());

-- Vehicles
CREATE POLICY "Vehicles_Select_All" ON vehicles FOR SELECT USING (true);
CREATE POLICY "Vehicles_Admin_Root_Insert" ON vehicles FOR INSERT WITH CHECK (is_admin_or_root());
CREATE POLICY "Vehicles_Admin_Root_Update" ON vehicles FOR UPDATE USING (is_admin_or_root());
CREATE POLICY "Vehicles_Admin_Root_Delete" ON vehicles FOR DELETE USING (is_admin_or_root());

-- Journeys
DROP POLICY IF EXISTS "Journeys_Select" ON journeys;
DROP POLICY IF EXISTS "Journeys_User_All" ON journeys;
DROP POLICY IF EXISTS "Journeys_Admin_Root_All" ON journeys;
CREATE POLICY "Journeys_Select_All" ON journeys FOR SELECT USING (true);
CREATE POLICY "Journeys_User_All" ON journeys FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Journeys_Admin_Root_All" ON journeys FOR ALL USING (is_admin_or_root());

-- Refuelings
DROP POLICY IF EXISTS "Refuelings_Select" ON refuelings;
DROP POLICY IF EXISTS "Refuelings_Insert" ON refuelings;
DROP POLICY IF EXISTS "Refuelings_Admin_Root_All" ON refuelings;
CREATE POLICY "Refuelings_Select_All" ON refuelings FOR SELECT USING (true);
CREATE POLICY "Refuelings_Insert_All" ON refuelings FOR INSERT WITH CHECK (true);
CREATE POLICY "Refuelings_Admin_Root_All" ON refuelings FOR ALL USING (is_admin_or_root());

-- Maintenances
DROP POLICY IF EXISTS "Maintenances_Select" ON maintenances;
DROP POLICY IF EXISTS "Maintenances_Insert" ON maintenances;
DROP POLICY IF EXISTS "Maintenances_Admin_Root_All" ON maintenances;
CREATE POLICY "Maintenances_Select_All" ON maintenances FOR SELECT USING (true);
CREATE POLICY "Maintenances_Insert_All" ON maintenances FOR INSERT WITH CHECK (true);
CREATE POLICY "Maintenances_Admin_Root_All" ON maintenances FOR ALL USING (is_admin_or_root());

-- Maintenance Requests
DROP POLICY IF EXISTS "MaintReq_Select" ON maintenance_requests;
DROP POLICY IF EXISTS "MaintReq_User_All" ON maintenance_requests;
DROP POLICY IF EXISTS "MaintReq_Admin_Root_All" ON maintenance_requests;
CREATE POLICY "MaintReq_Select_All" ON maintenance_requests FOR SELECT USING (true);
CREATE POLICY "MaintReq_User_All" ON maintenance_requests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "MaintReq_Admin_Root_All" ON maintenance_requests FOR ALL USING (is_admin_or_root());

-- Invites
DROP POLICY IF EXISTS "Invites_Root_All" ON invites;
DROP POLICY IF EXISTS "Invites_Public_Select" ON invites;
CREATE POLICY "Invites_Root_All" ON invites FOR ALL USING (is_root());
CREATE POLICY "Invites_Public_Select" ON invites FOR SELECT USING (true);

-- Banco de Horas
DROP POLICY IF EXISTS "TimeBank_Select" ON banco_de_horas;
DROP POLICY IF EXISTS "TimeBank_User_All" ON banco_de_horas;
DROP POLICY IF EXISTS "TimeBank_Admin_Root_All" ON banco_de_horas;
CREATE POLICY "TimeBank_Select_All" ON banco_de_horas FOR SELECT USING (true);
CREATE POLICY "TimeBank_User_All" ON banco_de_horas FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "TimeBank_Admin_Root_All" ON banco_de_horas FOR ALL USING (is_admin_or_root());

-- 4. Garantir que o usuário atual seja Root (baseado no email fornecido)
UPDATE profiles SET role = 'Root' WHERE email = 'frlbk@hotmail.com';

-- 5. Habilitar RLS explicitamente (caso tenha sido desabilitado)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
