/**
 * ARQUIVO: src/lib/alerts/IgnitionEventRule.ts
 * O QUE FAZ: dispara alerta quando a ignição está desligada enquanto o veículo tem uma
 *   jornada aberta (indica motor desligado durante uso registrado, ou o inverso de uma
 *   parada não registrada).
 * PARA QUE SERVE: Rodada C / C2 — alerta de ignição (TR Salgueiro/PE, item 5.6.2-e).
 * MÓDULOS RELACIONADOS:
 *   - src/lib/alerts/AlertRule.ts — interface implementada aqui
 *   - src/lib/telemetry/TelemetryProvider.ts — VehiclePosition.ignitionOn consumido aqui
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial (Rodada C / C2)
 */

import { supabase } from '../supabase';
import type { AlertEvaluation, AlertRule } from './AlertRule';
import type { VehiclePosition } from '../telemetry/TelemetryProvider';

export class IgnitionEventRule implements AlertRule {
  readonly ruleType = 'ignition' as const;

  async evaluate(vehicleId: string, position: VehiclePosition): Promise<AlertEvaluation> {
    if (position.ignitionOn !== false) {
      return { triggered: false };
    }

    const { data } = await supabase
      .from('journeys')
      .select('id')
      .eq('vehicle_id', vehicleId)
      .eq('status', 'aberta')
      .limit(1)
      .maybeSingle();

    if (!data) {
      return { triggered: false };
    }

    return {
      triggered: true,
      message: 'Ignição desligada com jornada em andamento.',
      metadata: { journeyId: data.id },
    };
  }
}
