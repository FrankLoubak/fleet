import { describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

const { PinAuthProvider } = await import('../lib/drivers/PinAuthProvider');

describe('PinAuthProvider', () => {
  it('authenticate() reports success when verify_driver_pin returns true', async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null });
    const provider = new PinAuthProvider();

    const result = await provider.authenticate('vehicle-1', '1234');

    expect(result.success).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('verify_driver_pin', { pin: '1234' });
  });

  it('authenticate() reports failure with a clear message when the PIN is wrong or unset', async () => {
    rpcMock.mockResolvedValueOnce({ data: false, error: null });
    const provider = new PinAuthProvider();

    const result = await provider.authenticate('vehicle-1', '0000');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('authenticate() surfaces the Supabase error message on failure', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'network down' } });
    const provider = new PinAuthProvider();

    const result = await provider.authenticate('vehicle-1', '1234');

    expect(result.success).toBe(false);
    expect(result.error).toBe('network down');
  });

  it('setPin() validates the round-trip to set_driver_pin', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const provider = new PinAuthProvider();

    const result = await provider.setPin('123456');

    expect(result.success).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('set_driver_pin', { new_pin: '123456' });
  });

  it('recordCheckin() returns false without throwing when record_driver_checkin fails', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const provider = new PinAuthProvider();

    const recorded = await provider.recordCheckin('journey-1', '1234');

    expect(recorded).toBe(false);
  });

  it('recordCheckin() returns true when record_driver_checkin succeeds', async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null });
    const provider = new PinAuthProvider();

    const recorded = await provider.recordCheckin('journey-1', '1234');

    expect(recorded).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('record_driver_checkin', { p_journey_id: 'journey-1', pin: '1234' });
  });
});
