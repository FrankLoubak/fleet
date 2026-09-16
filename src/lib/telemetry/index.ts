import { MockTelemetryProvider } from './MockTelemetryProvider';
import type { TelemetryProvider } from './TelemetryProvider';

export type { TelemetryProvider, VehiclePosition } from './TelemetryProvider';

// Único ponto de troca quando uma integração real (ex.: SmartGPSProvider) existir.
export const telemetryProvider: TelemetryProvider = new MockTelemetryProvider();
