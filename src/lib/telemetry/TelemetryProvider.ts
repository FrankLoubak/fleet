/**
 * ARQUIVO: src/lib/telemetry/TelemetryProvider.ts
 * O QUE FAZ: contrato de telemetria veicular (posição, velocidade, ignição).
 * PARA QUE SERVE: desacopla o resto do app de qualquer fornecedor real de rastreamento.
 * MÓDULOS RELACIONADOS:
 *   - src/lib/telemetry/MockTelemetryProvider.ts — única implementação concreta hoje
 *   - src/lib/alerts/SpeedingRule.ts, IgnitionEventRule.ts — consomem VehiclePosition
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — Rodada C / C2: adicionado ignitionOn
 */
export interface VehiclePosition {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  // Rodada C / C2: usado por IgnitionEventRule. null quando o provedor não reporta
  // estado de ignição (nem todo rastreador manda isso em toda posição).
  ignitionOn: boolean | null;
  recordedAt: string;
}

/**
 * Contrato de telemetria veicular, desacoplado de qualquer fornecedor
 * (SmartGPS ou outro). Segue o mesmo padrão de GeocodingProvider/RoutingProvider
 * do Rota33: a Rodada C (alertas, geofence, histórico de rota) consome esta
 * interface sem saber se os dados vêm de um mock ou de um webhook real.
 */
export interface TelemetryProvider {
  getLatestPosition(vehicleId: string): Promise<VehiclePosition | null>;
  getPositionHistory(vehicleId: string, from: Date, to: Date): Promise<VehiclePosition[]>;
}
