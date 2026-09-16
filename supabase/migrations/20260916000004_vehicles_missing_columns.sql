-- ARQUIVO: supabase/migrations/20260916000004_vehicles_missing_columns.sql
-- O QUE FAZ: adiciona vehicle_type/initial_odometer/current_odometer/
--   initial_hourmeter/current_hourmeter em vehicles — nenhuma das 5 existia em nenhuma
--   migration tracked, embora sejam usadas por src/pages/Vehicles.tsx (cadastro/edição
--   de veículo) e src/pages/DailyReport.tsx (validação de odômetro/horímetro ao abrir
--   jornada) desde sempre.
-- PARA QUE SERVE: bug pré-existente descoberto ao testar a Rodada C / C1 (mesma causa
--   raiz do profiles.cpf corrigido em 20260916000003 — colunas que só existiam no
--   Supabase original via alteração manual pelo dashboard, nunca capturadas como
--   migration tracked). Sem isso, "Iniciar Jornada" em DailyReport.tsx quebra sempre
--   (400 da PostgREST ao selecionar current_odometer/current_hourmeter/vehicle_type de
--   vehicles) — não é uma funcionalidade nova desta rodada, é a app já existente que
--   nunca funcionou contra um schema só com as migrations tracked.
-- MÓDULOS RELACIONADOS:
--   - src/pages/Vehicles.tsx — grava estas colunas no cadastro/edição de veículo
--   - src/pages/DailyReport.tsx — lê para validar odômetro/horímetro inicial
-- ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial

ALTER TABLE vehicles
  ADD COLUMN vehicle_type TEXT NOT NULL DEFAULT 'veiculo' CHECK (vehicle_type IN ('veiculo', 'maquina')),
  ADD COLUMN initial_odometer INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN current_odometer INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN initial_hourmeter INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN current_hourmeter INTEGER NOT NULL DEFAULT 0;
