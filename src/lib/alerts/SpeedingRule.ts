/**
 * ARQUIVO: src/lib/alerts/SpeedingRule.ts
 * O QUE FAZ: dispara alerta quando a velocidade da posição atual excede o limite
 *   configurado em alert_rules.speed_limit_kmh para aquele veículo.
 * PARA QUE SERVE: Rodada C / C2 — alerta de excesso de velocidade. Limite único por
 *   veículo, sem diferenciação por tipo de via (RESPOSTA confirmada na PARTE 7,
 *   pergunta 3).
 * MÓDULOS RELACIONADOS:
 *   - src/lib/alerts/AlertRule.ts — interface implementada aqui
 *   - supabase/migrations/20260916000005_alert_engine.sql — tabela alert_rules
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial (Rodada C / C2)
 */

import { supabase } from '../supabase';
import type { AlertEvaluation, AlertRule } from './AlertRule';
import type { VehiclePosition } from '../telemetry/TelemetryProvider';

export class SpeedingRule implements AlertRule {
  readonly ruleType = 'speeding' as const;

  async evaluate(vehicleId: string, position: VehiclePosition): Promise<AlertEvaluation> {
    if (position.speedKmh == null) {
      return { triggered: false };
    }

    const { data } = await supabase
      .from('alert_rules')
      .select('speed_limit_kmh, active')
      .eq('vehicle_id', vehicleId)
      .maybeSingle();

    if (!data || !data.active || data.speed_limit_kmh == null) {
      return { triggered: false };
    }

    if (position.speedKmh > data.speed_limit_kmh) {
      return {
        triggered: true,
        message: `Velocidade de ${position.speedKmh} km/h excede o limite de ${data.speed_limit_kmh} km/h.`,
        metadata: { speedKmh: position.speedKmh, limitKmh: data.speed_limit_kmh },
      };
    }

    return { triggered: false };
  }
}
