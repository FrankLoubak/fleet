/**
 * ARQUIVO: src/lib/alerts/GeofenceRule.ts
 * O QUE FAZ: NÃO avalia cerca eletrônica de verdade ainda — sempre retorna
 *   { triggered: false }. Existe só pra satisfazer AlertRule e permitir que o resto do
 *   app (cadastro de geofences, tela de alertas) seja construído sem esperar a
 *   integração real.
 * PARA QUE SERVE: Rodada C / C2 pede para este tipo consumir eventos de cerca JÁ
 *   CALCULADOS pela SmartGPS via webhook (não recalcular geofence localmente) —
 *   mas o formato exato do payload desse webhook está atrás do portal
 *   smartgps.com.br/docs, que exige conta/login que não temos (confirmado: só a doc
 *   pública de comandos de equipamento em wiki.smartgps.com.br está acessível, sem
 *   nenhuma página de webhooks/API). Regra do projeto (PARTE 4/C2): nunca inventar
 *   contrato de API externa — reportado ao usuário como pendência em vez de assumir um
 *   formato de payload ou implementar cálculo de point-in-polygon por conta própria sem
 *   aprovação explícita.
 * MÓDULOS RELACIONADOS:
 *   - src/lib/alerts/AlertRule.ts — interface implementada aqui
 *   - supabase/migrations/20260916000005_alert_engine.sql — tabela geofences (schema
 *     pronto, só falta o consumo do evento real)
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial (Rodada C / C2), stub pendente
 */

import type { AlertEvaluation, AlertRule } from './AlertRule';
import type { VehiclePosition } from '../telemetry/TelemetryProvider';

export class GeofenceRule implements AlertRule {
  readonly ruleType = 'geofence' as const;

  async evaluate(_vehicleId: string, _position: VehiclePosition): Promise<AlertEvaluation> {
    return { triggered: false };
  }
}
