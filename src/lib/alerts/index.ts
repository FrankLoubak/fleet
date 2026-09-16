/**
 * ARQUIVO: src/lib/alerts/index.ts
 * O QUE FAZ: avalia todas as regras de alerta ativas para uma posição e grava em
 *   alert_events qualquer uma que dispare.
 * PARA QUE SERVE: ponto único que Dashboard.tsx (ou qualquer consumidor futuro) chama
 *   pra rodar o motor de alertas, sem precisar conhecer cada AlertRule individualmente.
 * MÓDULOS RELACIONADOS:
 *   - src/lib/alerts/SpeedingRule.ts, IgnitionEventRule.ts, GeofenceRule.ts
 *   - src/pages/Dashboard.tsx — consome runAlertRules()
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial (Rodada C / C2)
 */

import { supabase } from '../supabase';
import type { VehiclePosition } from '../telemetry/TelemetryProvider';
import type { AlertRule } from './AlertRule';
import { SpeedingRule } from './SpeedingRule';
import { IgnitionEventRule } from './IgnitionEventRule';
import { GeofenceRule } from './GeofenceRule';

export type { AlertRule, AlertEvaluation } from './AlertRule';

export const alertRules: AlertRule[] = [new SpeedingRule(), new IgnitionEventRule(), new GeofenceRule()];

export async function runAlertRules(vehicleId: string, position: VehiclePosition): Promise<void> {
  for (const rule of alertRules) {
    const result = await rule.evaluate(vehicleId, position);
    if (result.triggered) {
      await supabase.from('alert_events').insert([
        {
          vehicle_id: vehicleId,
          rule_type: rule.ruleType,
          message: result.message ?? '',
          metadata: result.metadata ?? null,
        },
      ]);
    }
  }
}
