import { describe, expect, it } from 'vitest';
import { RouteHistoryService } from '../lib/routes/RouteHistoryService';

describe('RouteHistoryService', () => {
  const service = new RouteHistoryService();
  const from = new Date('2026-09-16T08:00:00Z');
  const to = new Date('2026-09-16T09:00:00Z'); // 5 posições a cada 15min no mock

  it('returns the first page with the requested page size', async () => {
    const result = await service.getHistory('vehicle-1', from, to, 1, 2);

    expect(result.totalCount).toBe(5);
    expect(result.items).toHaveLength(2);
    expect(result.page).toBe(1);
  });

  it('returns the remaining items on the last page', async () => {
    const result = await service.getHistory('vehicle-1', from, to, 3, 2);

    expect(result.items).toHaveLength(1);
  });

  it('returns an empty page past the end of the range', async () => {
    const result = await service.getHistory('vehicle-1', from, to, 10, 2);

    expect(result.items).toHaveLength(0);
    expect(result.totalCount).toBe(5);
  });
});
