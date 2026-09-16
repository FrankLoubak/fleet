-- Rodada B (B1) — Hardening de RLS.
--
-- Achados corrigidos aqui:
-- 1. "Admins can manage X" em vehicles/banco_de_horas/maintenance_requests checava só
--    role = 'Admin' — o papel Root (adicionado depois, v1.2.0) nunca foi incluído nessas
--    políticas. Resultado: um usuário Root (que deveria ter acesso total) era bloqueado
--    pelo banco ao tentar gerenciar veículos, banco de horas ou solicitações de manutenção,
--    mesmo passando pelo AdminRoute no frontend (que já permite Admin E Root).
-- 2. vehicle_configs/pneus/movimentacoes_pneus (módulo de pneus, migration
--    20260508000000) foram criadas com policy única "USING (true)" para TODAS as
--    operações — qualquer usuário autenticado (inclusive Operador) pode inserir, editar
--    ou excluir direto pela API do Supabase, sem passar pela tela de Admin. Restringido
--    aqui a leitura pública + escrita só Admin/Root, mesmo padrão das demais tabelas.
--
-- Funções auxiliares SECURITY DEFINER evitam repetir a mesma subquery em profiles em cada
-- policy (e evitam recursão de RLS se um dia forem usadas numa policy DA PRÓPRIA tabela
-- profiles — não é o caso hoje, profiles.SELECT já é USING (true) público).

CREATE OR REPLACE FUNCTION public.is_admin_or_root()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('Admin', 'Root')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_root()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Root'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1. Inclui Root nas policies que hoje só permitem Admin ------------------------------
DROP POLICY IF EXISTS "Admins can manage vehicles" ON vehicles;
CREATE POLICY "Admins can manage vehicles" ON vehicles FOR ALL USING (is_admin_or_root());

DROP POLICY IF EXISTS "Admins can manage all banco de horas" ON banco_de_horas;
CREATE POLICY "Admins can manage all banco de horas" ON banco_de_horas FOR ALL USING (is_admin_or_root());

DROP POLICY IF EXISTS "Admins can manage all maintenance requests" ON maintenance_requests;
CREATE POLICY "Admins can manage all maintenance requests" ON maintenance_requests FOR ALL USING (is_admin_or_root());

-- 2. Módulo de pneus: leitura pública, escrita só Admin/Root --------------------------
DROP POLICY IF EXISTS "vc_all" ON vehicle_configs;
CREATE POLICY "vehicle_configs_select" ON vehicle_configs FOR SELECT USING (true);
CREATE POLICY "vehicle_configs_write" ON vehicle_configs FOR INSERT WITH CHECK (is_admin_or_root());
CREATE POLICY "vehicle_configs_update" ON vehicle_configs FOR UPDATE USING (is_admin_or_root());
CREATE POLICY "vehicle_configs_delete" ON vehicle_configs FOR DELETE USING (is_admin_or_root());

DROP POLICY IF EXISTS "pneu_all" ON pneus;
CREATE POLICY "pneus_select" ON pneus FOR SELECT USING (true);
CREATE POLICY "pneus_write" ON pneus FOR INSERT WITH CHECK (is_admin_or_root());
CREATE POLICY "pneus_update" ON pneus FOR UPDATE USING (is_admin_or_root());
CREATE POLICY "pneus_delete" ON pneus FOR DELETE USING (is_admin_or_root());

DROP POLICY IF EXISTS "mov_all" ON movimentacoes_pneus;
CREATE POLICY "movimentacoes_pneus_select" ON movimentacoes_pneus FOR SELECT USING (true);
CREATE POLICY "movimentacoes_pneus_write" ON movimentacoes_pneus FOR INSERT WITH CHECK (is_admin_or_root());
CREATE POLICY "movimentacoes_pneus_update" ON movimentacoes_pneus FOR UPDATE USING (is_admin_or_root());
CREATE POLICY "movimentacoes_pneus_delete" ON movimentacoes_pneus FOR DELETE USING (is_admin_or_root());
