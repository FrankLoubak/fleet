import { describe, expect, it } from 'vitest';
import { MockTelemetryProvider } from '../lib/telemetry/MockTelemetryProvider';

describe('MockTelemetryProvider', () => {
  const provider = new MockTelemetryProvider();

  it('returns a plausible latest position for any vehicle id', async () => {
    const position = await provider.getLatestPosition('vehicle-1');
    expect(position).not.toBeNull();
    expect(position!.vehicleId).toBe('vehicle-1');
    expect(position!.latitude).toBeGreaterThan(-90);
    expect(position!.latitude).toBeLessThan(90);
    expect(position!.longitude).toBeGreaterThan(-180);
    expect(position!.longitude).toBeLessThan(180);
    expect(position!.speedKmh).toBeGreaterThanOrEqual(0);
  });

  it('returns a history covering the requested window at 15-minute steps', async () => {
    const from = new Date('2026-09-16T08:00:00Z');
    const to = new Date('2026-09-16T09:00:00Z');
    const history = await provider.getPositionHistory('vehicle-1', from, to);

    expect(history.length).toBe(5);
    expect(history[0].recordedAt).toBe(from.toISOString());
    expect(history.every((p) => p.vehicleId === 'vehicle-1')).toBe(true);
  });

  it('is deterministic for the same vehicle and timestamp', async () => {
    const at = new Date('2026-09-16T08:00:00Z');
    const [first] = await provider.getPositionHistory('vehicle-1', at, at);
    const [second] = await provider.getPositionHistory('vehicle-1', at, at);
    expect(first).toEqual(second);
  });
});
