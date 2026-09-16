-- ARQUIVO: supabase/migrations/20260916000005_alert_engine.sql
-- O QUE FAZ: schema do motor de alertas (C2): alert_rules (config de limite de
--   velocidade por veículo), alert_events (alertas disparados), geofences (zonas
--   cadastradas pelo gestor) + coluna ignition_on em vehicle_positions.
-- PARA QUE SERVE: Rodada C / C2 — alertas de velocidade, cerca eletrônica e ignição (TR
--   Salgueiro/PE, item 5.6.2-e).
-- MÓDULOS RELACIONADOS:
--   - src/lib/alerts/AlertRule.ts (interface) + SpeedingRule/IgnitionEventRule/GeofenceRule
--   - src/lib/telemetry/TelemetryProvider.ts — VehiclePosition ganhou ignitionOn
--   - src/pages/Geofences.tsx — cadastro de zonas
--   - src/pages/Dashboard.tsx — exibição de alertas ativos
-- ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial (Rodada C / C2)

ALTER TABLE vehicle_positions ADD COLUMN ignition_on BOOLEAN;

-- Uma linha por veículo — limite de velocidade único, sem diferenciação por tipo de via
-- (RESPOSTA confirmada na PARTE 7, pergunta 3). NULL = alerta de velocidade desligado
-- para aquele veículo.
CREATE TABLE alert_rules (
  vehicle_id UUID PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
  speed_limit_kmh INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('speeding', 'ignition', 'geofence')),
  message TEXT NOT NULL,
  metadata JSONB,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cerca circular (centro + raio) — mais simples que polígono e suficiente pra esta
-- rodada; sem conceito de "grupo de veículos" no schema atual, então é só por veículo
-- mesmo (RESPOSTA da pergunta 4 cita "por veículo ou por grupo" como opções, grupo não
-- existe hoje).
CREATE TABLE geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;

-- "motorista do veículo envolvido" (RESPOSTA da PARTE 7) = quem já teve alguma jornada
-- nesse veículo — não existe vínculo motorista↔veículo permanente no schema, só por
-- jornada.
CREATE POLICY "alert_rules_select" ON alert_rules FOR SELECT
  USING (is_admin_or_root() OR EXISTS (SELECT 1 FROM journeys WHERE journeys.vehicle_id = alert_rules.vehicle_id AND journeys.user_id = auth.uid()));
CREATE POLICY "alert_rules_write" ON alert_rules FOR ALL USING (is_admin_or_root());

CREATE POLICY "alert_events_select" ON alert_events FOR SELECT
  USING (is_admin_or_root() OR EXISTS (SELECT 1 FROM journeys WHERE journeys.vehicle_id = alert_events.vehicle_id AND journeys.user_id = auth.uid()));
CREATE POLICY "alert_events_write" ON alert_events FOR INSERT WITH CHECK (is_admin_or_root());

CREATE POLICY "geofences_select" ON geofences FOR SELECT
  USING (is_admin_or_root() OR EXISTS (SELECT 1 FROM journeys WHERE journeys.vehicle_id = geofences.vehicle_id AND journeys.user_id = auth.uid()));
CREATE POLICY "geofences_write" ON geofences FOR ALL USING (is_admin_or_root());
