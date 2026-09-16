import { describe, expect, it, vi } from 'vitest';
import type { VehiclePosition } from '../lib/telemetry/TelemetryProvider';

const fromMock = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

const { SpeedingRule } = await import('../lib/alerts/SpeedingRule');
const { IgnitionEventRule } = await import('../lib/alerts/IgnitionEventRule');
const { GeofenceRule } = await import('../lib/alerts/GeofenceRule');

function makePosition(overrides: Partial<VehiclePosition> = {}): VehiclePosition {
  return {
    vehicleId: 'vehicle-1',
    latitude: -23.5,
    longitude: -46.6,
    speedKmh: 50,
    ignitionOn: true,
    recordedAt: new Date().toISOString(),
    ...overrides,
  };
}

function mockAlertRulesRow(row: { speed_limit_kmh: number | null; active: boolean } | null) {
  fromMock.mockReturnValueOnce({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: row, error: null }),
      }),
    }),
  });
}

function mockOpenJourneyRow(row: { id: string } | null) {
  fromMock.mockReturnValueOnce({
    select: () => ({
      eq: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: () => Promise.resolve({ data: row, error: null }),
          }),
        }),
      }),
    }),
  });
}

describe('SpeedingRule', () => {
  it('does not trigger when speed is within the configured limit', async () => {
    mockAlertRulesRow({ speed_limit_kmh: 80, active: true });
    const rule = new SpeedingRule();

    const result = await rule.evaluate('vehicle-1', makePosition({ speedKmh: 60 }));

    expect(result.triggered).toBe(false);
  });

  it('triggers when speed exceeds the configured limit', async () => {
    mockAlertRulesRow({ speed_limit_kmh: 80, active: true });
    const rule = new SpeedingRule();

    const result = await rule.evaluate('vehicle-1', makePosition({ speedKmh: 95 }));

    expect(result.triggered).toBe(true);
    expect(result.metadata).toEqual({ speedKmh: 95, limitKmh: 80 });
  });

  it('does not trigger when no rule is configured for the vehicle', async () => {
    mockAlertRulesRow(null);
    const rule = new SpeedingRule();

    const result = await rule.evaluate('vehicle-1', makePosition({ speedKmh: 200 }));

    expect(result.triggered).toBe(false);
  });
});

describe('IgnitionEventRule', () => {
  it('does not trigger when ignition is on', async () => {
    const rule = new IgnitionEventRule();
    const result = await rule.evaluate('vehicle-1', makePosition({ ignitionOn: true }));
    expect(result.triggered).toBe(false);
  });

  it('does not trigger when ignition is off but there is no open journey', async () => {
    mockOpenJourneyRow(null);
    const rule = new IgnitionEventRule();

    const result = await rule.evaluate('vehicle-1', makePosition({ ignitionOn: false }));

    expect(result.triggered).toBe(false);
  });

  it('triggers when ignition is off while a journey is open', async () => {
    mockOpenJourneyRow({ id: 'journey-1' });
    const rule = new IgnitionEventRule();

    const result = await rule.evaluate('vehicle-1', makePosition({ ignitionOn: false }));

    expect(result.triggered).toBe(true);
    expect(result.metadata).toEqual({ journeyId: 'journey-1' });
  });
});

describe('GeofenceRule', () => {
  it('never triggers yet — pendente de acesso ao webhook real da SmartGPS', async () => {
    const rule = new GeofenceRule();
    const result = await rule.evaluate('vehicle-1', makePosition());
    expect(result.triggered).toBe(false);
  });
});
