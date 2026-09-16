-- Rodada B (B2) — Esquema de telemetria (rastreadores/posições).
--
-- Cria a base de dados para o motor de alertas/geofence da Rodada C, sem depender de
-- nenhum fornecedor real (SmartGPS ou outro): hoje não há credenciais nem hardware
-- (rastreador) instalado em nenhum veículo, então este schema é alimentado apenas por
-- um TelemetryProvider mock (ver src/lib/telemetry/) até que uma integração real exista.
--
-- vehicle_trackers: 1 rastreador por veículo (pode não existir ainda — por isso é uma
-- tabela separada, não colunas em vehicles). serial_number é o identificador do
-- fornecedor (ex.: IMEI do Queclink GV57), sem significado para o Fleet além de correlação.
--
-- vehicle_positions: histórico de posições. Sem PostGIS (não usado em nenhuma outra parte
-- do schema) — lat/lng como double precision é suficiente para a tela de histórico
-- tabular já decidida na Rodada C (RESPOSTA à pergunta sobre mapa: sem biblioteca de mapa).

CREATE TABLE IF NOT EXISTS vehicle_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'mock',
  serial_number TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id),
  UNIQUE (provider, serial_number)
);

CREATE TABLE IF NOT EXISTS vehicle_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id UUID NOT NULL REFERENCES vehicle_trackers(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed_kmh DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_positions_vehicle_recorded_idx
  ON vehicle_positions (vehicle_id, recorded_at DESC);

ALTER TABLE vehicle_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_positions ENABLE ROW LEVEL SECURITY;

-- Leitura pública (mesmo padrão de vehicles/pneus: qualquer autenticado pode ver a frota).
-- Escrita só Admin/Root — nenhum Operador escreve telemetria manualmente; quando uma
-- integração real existir, ela escreverá via service_role (que ignora RLS), não por aqui.
CREATE POLICY "vehicle_trackers_select" ON vehicle_trackers FOR SELECT USING (true);
CREATE POLICY "vehicle_trackers_write" ON vehicle_trackers FOR INSERT WITH CHECK (is_admin_or_root());
CREATE POLICY "vehicle_trackers_update" ON vehicle_trackers FOR UPDATE USING (is_admin_or_root());
CREATE POLICY "vehicle_trackers_delete" ON vehicle_trackers FOR DELETE USING (is_admin_or_root());

CREATE POLICY "vehicle_positions_select" ON vehicle_positions FOR SELECT USING (true);
CREATE POLICY "vehicle_positions_write" ON vehicle_positions FOR INSERT WITH CHECK (is_admin_or_root());
CREATE POLICY "vehicle_positions_update" ON vehicle_positions FOR UPDATE USING (is_admin_or_root());
CREATE POLICY "vehicle_positions_delete" ON vehicle_positions FOR DELETE USING (is_admin_or_root());
