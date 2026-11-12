import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), insert: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mocks }));
import { createDeliveryPackages } from './packaging-units';

describe('createDeliveryPackages', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it('creates exactly the requested number of uniquely numbered units for the selected delivery', async () => {
    for (const number of ['PU-001', 'PU-002', 'PU-003']) {
      mocks.rpc.mockResolvedValueOnce({ data: number, error: null });
    }
    await createDeliveryPackages('company', 'delivery', 3);
    expect(mocks.rpc).toHaveBeenCalledTimes(3);
    expect(mocks.insert).toHaveBeenCalledExactlyOnceWith(['PU-001', 'PU-002', 'PU-003'].map(pu_number => ({
      pu_number, company_id: 'company', delivery_id: 'delivery', product_id: null, quantity: 0, status: 'active',
    })));
  });

  it('rejects fractional, empty, and invalid package counts without creating units', async () => {
    for (const count of [0, -1, 2.5, NaN, Infinity]) {
      await expect(createDeliveryPackages('company', 'delivery', count)).rejects.toThrow('positive whole number');
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('does not insert partial packages when number generation fails', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 'PU-001', error: null });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed' } });
    await expect(createDeliveryPackages('company', 'delivery', 3)).rejects.toThrow('Failed to generate');
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});