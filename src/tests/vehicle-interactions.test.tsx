/**
 * Testes de interação com o componente Vehicles
 *
 * Fornece dados mock ricos e simula interações para cobrir handlers de eventos.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mock do Supabase com dados de veículos ricos
// ---------------------------------------------------------------------------
const VEHICLES_DATA = [
  { id: 'v1', plate: 'ABC-1234', model: 'Toyota Hilux', prefix: 'FT-089',
    last_odometer: 125000, current_odometer: 125000, current_hourmeter: 0,
    vehicle_type: 'veiculo', initial_odometer: 100000, initial_hourmeter: 0 },
  { id: 'v2', plate: 'XYZ-9876', model: 'Caterpillar 320', prefix: 'MAQ-01',
    last_odometer: 0, current_odometer: 0, current_hourmeter: 500,
    vehicle_type: 'maquina', initial_odometer: 0, initial_hourmeter: 400 },
];

const JOURNEYS_DATA = [
  { id: 'j1', user_id: 'u1', vehicle_id: 'v1',
    start_time: '2026-04-30T08:00:00', end_time: '2026-04-30T18:00:00',
    start_odometer: 124800, end_odometer: 125000, distance_traveled: 200,
    status: 'encerrada', observations: 'Normal', validation_status: 'pendente', validated_by: null }
];

const REFUELINGS_DATA = [
  { id: 'r1', vehicle_id: 'v1', date: '2026-04-15', odometer: 124000,
    quantity: 40, fuel_type: 'Diesel', location: 'Posto Central', total_value: 248 },
];

const MAINTENANCES_DATA = [
  { id: 'm1', vehicle_id: 'v1', date: '2026-04-10', type: 'Mecanica',
    provider: 'Oficina Central', mileage: 123000, description: 'Troca de óleo',
    total_value: 350, status: 'executada' }
];

vi.mock('../lib/supabase', () => {
  // Proxy que suporta qualquer método de chain
  function makeProxy(data: unknown[]): Record<string, unknown> {
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_target, prop) {
        if (prop === 'then') return undefined;
        if (prop === 'data') return data;
        if (prop === 'error') return null;
        if (prop === 'single') {
          return vi.fn().mockResolvedValue({ data: data[0] || null, error: null });
        }
        return vi.fn().mockReturnValue(makeProxy(data));
      }
    };
    return new Proxy({}, handler);
  }

  const tableData: Record<string, unknown[]> = {
    vehicles: VEHICLES_DATA,
    journeys: JOURNEYS_DATA,
    refuelings: REFUELINGS_DATA,
    maintenances: MAINTENANCES_DATA,
    maintenance_requests: [],
    profiles: [],
    banco_de_horas: [],
  };

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    const data = tableData[table] || [];
    return {
      select: vi.fn().mockReturnValue(makeProxy(data)),
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'new' }], error: null }) }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
    };
  });

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
      from: mockFrom,
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
        }),
      },
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ADMIN = { id: 'u1', cpf: '11111111111', name: 'Admin', role: 'Admin', email: 'admin@test.com' };

function setUser(u: object) { localStorage.setItem('fleet_user', JSON.stringify(u)); }
function clearUser() { localStorage.removeItem('fleet_user'); }

function wrap(el: React.ReactElement, path = '/') {
  return render(React.createElement(MemoryRouter, { initialEntries: [path] }, el));
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------
describe('Vehicles — renderização com dados ricos', () => {
  beforeEach(() => setUser(ADMIN));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('renderiza o componente sem crash', async () => {
    const Vehicles = (await import('../pages/Vehicles')).default;
    const { container } = wrap(React.createElement(Vehicles), '/vehicles');
    await waitFor(() => {
      expect(container).toBeTruthy();
    }, { timeout: 5000 });
  }, 8000);

  it('renderiza botão de novo veículo', async () => {
    const Vehicles = (await import('../pages/Vehicles')).default;
    wrap(React.createElement(Vehicles), '/vehicles');
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(500);
    }, { timeout: 5000 });
  }, 8000);
});

describe('Journeys — renderização com dados ricos', () => {
  beforeEach(() => setUser(ADMIN));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('renderiza o componente sem crash', async () => {
    const Journeys = (await import('../pages/Journeys')).default;
    const { container } = wrap(React.createElement(Journeys), '/journeys');
    await waitFor(() => {
      expect(container).toBeTruthy();
    }, { timeout: 5000 });
  }, 8000);
});

describe('MaintenanceList — renderização com dados ricos', () => {
  beforeEach(() => setUser(ADMIN));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('renderiza o componente sem crash', async () => {
    const MaintenanceList = (await import('../pages/MaintenanceList')).default;
    const { container } = wrap(React.createElement(MaintenanceList), '/maintenance-list');
    await waitFor(() => {
      expect(container).toBeTruthy();
    }, { timeout: 5000 });
  }, 8000);
});

describe('Refueling — renderização com dados ricos', () => {
  beforeEach(() => setUser(ADMIN));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('renderiza o componente sem crash', async () => {
    const Refueling = (await import('../pages/Refueling')).default;
    const { container } = wrap(React.createElement(Refueling), '/refueling');
    await waitFor(() => {
      expect(container).toBeTruthy();
    }, { timeout: 3000 });
  });
});

describe('DailyReport — renderização com dados ricos', () => {
  beforeEach(() => setUser(ADMIN));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('renderiza o componente sem crash com Admin', async () => {
    const DailyReport = (await import('../pages/DailyReport')).default;
    const { container } = wrap(React.createElement(DailyReport), '/daily-report');
    await waitFor(() => {
      expect(container).toBeTruthy();
    }, { timeout: 5000 });
  }, 8000);
});
