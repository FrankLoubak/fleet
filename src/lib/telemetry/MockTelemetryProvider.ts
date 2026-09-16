import type { TelemetryProvider, VehiclePosition } from './TelemetryProvider';

// Coordenada base usada só pelo mock (região metropolitana de São Paulo).
const BASE_LAT = -23.55;
const BASE_LNG = -46.63;

function hashSeed(vehicleId: string): number {
  let hash = 0;
  for (let i = 0; i < vehicleId.length; i++) {
    hash = (hash * 31 + vehicleId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function positionAt(vehicleId: string, at: Date): VehiclePosition {
  const seed = hashSeed(vehicleId) + Math.floor(at.getTime() / 60000);
  const jitterLat = (pseudoRandom(seed) - 0.5) * 0.1;
  const jitterLng = (pseudoRandom(seed + 1) - 0.5) * 0.1;
  return {
    vehicleId,
    latitude: BASE_LAT + jitterLat,
    longitude: BASE_LNG + jitterLng,
    speedKmh: Math.round(pseudoRandom(seed + 2) * 80),
    recordedAt: at.toISOString(),
  };
}

/**
 * Sem credenciais/hardware SmartGPS (ou de qualquer outro fornecedor) até hoje —
 * gera posições sintéticas determinísticas em vez de ler vehicle_positions, que
 * hoje não recebe nenhum dado real. Troque por um SmartGPSProvider real (mesma
 * interface TelemetryProvider) quando houver rastreador físico instalado.
 */
export class MockTelemetryProvider implements TelemetryProvider {
  async getLatestPosition(vehicleId: string): Promise<VehiclePosition | null> {
    return positionAt(vehicleId, new Date());
  }

  async getPositionHistory(vehicleId: string, from: Date, to: Date): Promise<VehiclePosition[]> {
    const positions: VehiclePosition[] = [];
    const stepMs = 15 * 60 * 1000;
    for (let t = from.getTime(); t <= to.getTime(); t += stepMs) {
      positions.push(positionAt(vehicleId, new Date(t)));
    }
    return positions;
  }
}
