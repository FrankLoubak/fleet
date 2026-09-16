export interface VehiclePosition {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speedKmh: number | null;
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
