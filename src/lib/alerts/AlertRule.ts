/**
 * ARQUIVO: src/lib/alerts/AlertRule.ts
 * O QUE FAZ: define o contrato comum a todos os tipos de alerta (velocidade, ignição,
 *   cerca eletrônica) — permite adicionar novos tipos sem alterar quem avalia as regras.
 * PARA QUE SERVE: Rodada C / C2 — motor de alertas configuráveis (TR Salgueiro/PE, item
 *   5.6.2-e), seguindo o mesmo padrão de interface desacoplada da PARTE 4.1.
 * MÓDULOS RELACIONADOS:
 *   - src/lib/alerts/SpeedingRule.ts, IgnitionEventRule.ts, GeofenceRule.ts —
 *     implementações concretas
 *   - src/lib/telemetry/TelemetryProvider.ts — VehiclePosition consumida por evaluate()
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial (Rodada C / C2)
 */

import type { VehiclePosition } from '../telemetry/TelemetryProvider';

export interface AlertEvaluation {
  triggered: boolean;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertRule {
  readonly ruleType: 'speeding' | 'ignition' | 'geofence';
  evaluate(vehicleId: string, position: VehiclePosition): Promise<AlertEvaluation>;
}
