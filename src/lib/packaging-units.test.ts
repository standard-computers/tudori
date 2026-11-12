import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), insert: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mocks }));
import { createDeliveryPackages } from './packaging-units';

describe('createDeliveryPackages', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  it('creates exactly the requested number of uniquely numbered units for the selected delivery', async () => {
    await createDeliveryPackages('company', 'delivery', 3);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('create_delivery_packages', {
      p_company_id: 'company', p_delivery_id: 'delivery', p_count: 3,
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('rejects fractional, empty, and invalid package counts without creating units', async () => {
    for (const count of [0, -1, 2.5, NaN, Infinity]) {
      await expect(createDeliveryPackages('company', 'delivery', count)).rejects.toThrow('positive whole number');
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('reports transaction failures without falling back to non-atomic inserts', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to create packages' } });
    await expect(createDeliveryPackages('company', 'delivery', 3)).rejects.toThrow('Failed to create packages');
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});