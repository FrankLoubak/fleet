/**
 * ARQUIVO: src/lib/alerts/GeofenceRule.ts
 * O QUE FAZ: não avalia cerca por posição — sempre retorna { triggered: false }, de
 *   propósito. Os eventos de cerca NÃO são calculados pelo fleet: a própria SmartGPS
 *   detecta entrada/saída (alertas geofenceIn/geofenceOut) e o banco ingere esses
 *   disparos direto em alert_events (rule_type 'geofence'), via pg_cron a cada minuto.
 * PARA QUE SERVE: Rodada C / C2 pede consumir o evento de cerca JÁ CALCULADO pela
 *   SmartGPS, não recalcular geofence localmente (decisão reconfirmada pelo usuário em
 *   2026-09-24). Esta classe existe só para manter o contrato AlertRule; avaliar aqui
 *   duplicaria os eventos que já chegam da SmartGPS.
 * MÓDULOS RELACIONADOS:
 *   - src/lib/alerts/AlertRule.ts — interface implementada aqui
 *   - supabase/migrations/20260924000000_smartgps_sync.sql — smartgps.sync_geofence_events()
 *     (ingestão) e smartgps.sync_positions() (posições reais); contrato da API documentado lá
 *   - src/pages/Dashboard.tsx — card "Alertas Ativos" já exibe rule_type 'geofence'
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-24 — eventos passam a vir da SmartGPS pelo banco
 */

import type { AlertEvaluation, AlertRule } from './AlertRule';
import type { VehiclePosition } from '../telemetry/TelemetryProvider';

export class GeofenceRule implements AlertRule {
  readonly ruleType = 'geofence' as const;

  async evaluate(_vehicleId: string, _position: VehiclePosition): Promise<AlertEvaluation> {
    return { triggered: false };
  }
}
