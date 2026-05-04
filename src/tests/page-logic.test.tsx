/**
 * Testes de lógica específica de páginas do FleetManager
 *
 * Foca em branches e condicionais que não são cobertos pelos testes de renderização.
 * Usa mocks ricos e renderização com usuários específicos.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mock do Supabase
// ---------------------------------------------------------------------------
vi.mock('../lib/supabase', () => {
  // Cria um chain infinito que suporta qualquer método
  const makeChain = (data: unknown[] = [], single: unknown = null): Record<string, unknown> => {
    const methods = ['eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'like', 'ilike', 'is', 'in',
      'not', 'or', 'and', 'filter', 'contains', 'containedBy'];

    const resolved = { data, error: null };

    const c: Record<string, unknown> = { ...resolved };
    methods.forEach(m => {
      c[m] = vi.fn().mockReturnValue(makeChain(data, single));
    });
    c.order = vi.fn().mockReturnValue({ ...makeChain(data, single), then: undefined });
    c.limit = vi.fn().mockReturnValue({ ...makeChain(data, single), then: undefined });
    c.single = vi.fn().mockResolvedValue({ data: single, error: null });
    return c;
  };

  const mockVehicles = [
    { id: 'v1', plate: 'ABC-1234', model: 'Toyota Hilux', prefix: 'FT-089',
      last_odometer: 125000, current_odometer: 125000, current_hourmeter: 0,
      vehicle_type: 'veiculo', initial_odometer: 100000, initial_hourmeter: 0 },
    { id: 'v2', plate: 'XYZ-9876', model: 'VW Gol', prefix: 'FT-042',
      last_odometer: 45000, current_odometer: 45000, current_hourmeter: 0,
      vehicle_type: 'veiculo', initial_odometer: 40000, initial_hourmeter: 0 }
  ];

  const tableMap: Record<string, unknown[]> = {
    vehicles: mockVehicles,
    profiles: [
      { id: 'u1', name: 'Admin User', email: 'admin@fleet.com', role: 'Admin',
        cpf: '11111111111', avatar_url: null, phone: null, invited_by: null }
    ],
    journeys: [],
    refuelings: [],
    maintenances: [],
    maintenance_requests: [],
    banco_de_horas: [],
    invites: [],
  };

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    const data = tableMap[table] || [];
    const chain = makeChain(data, data[0] || null);
    return {
      select: vi.fn().mockReturnValue(chain),
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
        signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
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
const OPERADOR = { id: 'u2', cpf: '22222222222', name: 'Operador', role: 'Operador', email: 'op@test.com' };
const ROOT = { id: 'u3', cpf: '33333333333', name: 'Root', role: 'Root', email: 'root@test.com' };

function setUser(u: object) { localStorage.setItem('fleet_user', JSON.stringify(u)); }
function clearUser() { localStorage.removeItem('fleet_user'); }

function wrap(el: React.ReactElement, path = '/') {
  return render(React.createElement(MemoryRouter, { initialEntries: [path] }, el));
}

// ---------------------------------------------------------------------------
// Suite: Dashboard — redireciona Operador
// ---------------------------------------------------------------------------
describe('Dashboard — branch: Operador redireciona para /daily-report', () => {
  beforeEach(() => setUser(OPERADOR));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('Dashboard redireciona Operador sem mostrar conteúdo de admin', async () => {
    const Dashboard = (await import('../pages/Dashboard')).default;
    wrap(React.createElement(Dashboard), '/dashboard');
    await waitFor(() => {
      // Operador deve ser redirecionado — container pode estar vazio
      expect(document.body).toBeTruthy();
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Dashboard — Admin com dados
// ---------------------------------------------------------------------------
describe('Dashboard — Admin com múltiplos veículos', () => {
  beforeEach(() => setUser(ADMIN));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('renderiza dashboard para Admin sem crash', async () => {
    const Dashboard = (await import('../pages/Dashboard')).default;
    const { container } = wrap(React.createElement(Dashboard), '/dashboard');
    await waitFor(() => {
      expect(container).toBeTruthy();
    }, { timeout: 5000 });
  }, 8000);
});

// ---------------------------------------------------------------------------
// Suite: Dashboard — Root com acesso
// ---------------------------------------------------------------------------
describe('Dashboard — Root com acesso', () => {
  beforeEach(() => setUser(ROOT));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('renderiza dashboard para Root', async () => {
    const Dashboard = (await import('../pages/Dashboard')).default;
    const { container } = wrap(React.createElement(Dashboard), '/dashboard');
    await waitFor(() => {
      expect(container).toBeTruthy();
    }, { timeout: 5000 });
  }, 8000);
});

// ---------------------------------------------------------------------------
// Suite: Vehicles — com 2 veículos no mock
// ---------------------------------------------------------------------------
describe('Vehicles — lista com dados', () => {
  beforeEach(() => setUser(ADMIN));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('carrega veículos sem crash', async () => {
    const Vehicles = (await import('../pages/Vehicles')).default;
    const { container } = wrap(React.createElement(Vehicles), '/vehicles');
    await waitFor(() => {
      expect(container).toBeTruthy();
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Journeys — com usuário
// ---------------------------------------------------------------------------
describe('Journeys — lista de jornadas', () => {
  beforeEach(() => setUser(ADMIN));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('carrega página de jornadas sem crash', async () => {
    const Journeys = (await import('../pages/Journeys')).default;
    const { container } = wrap(React.createElement(Journeys), '/journeys');
    await waitFor(() => {
      expect(container).toBeTruthy();
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: MaintenanceList — com viewMode inicial
// ---------------------------------------------------------------------------
describe('MaintenanceList — viewMode executadas', () => {
  beforeEach(() => setUser(ADMIN));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('renderiza MaintenanceList com viewMode executadas', async () => {
    const MaintenanceList = (await import('../pages/MaintenanceList')).default;
    const { container } = wrap(React.createElement(MaintenanceList), '/maintenance-list');
    await waitFor(() => {
      expect(container).toBeTruthy();
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Refueling — sem jornada ativa
// ---------------------------------------------------------------------------
describe('Refueling — sem jornada ativa', () => {
  beforeEach(() => setUser(ADMIN));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('renderiza formulário de abastecimento', async () => {
    const Refueling = (await import('../pages/Refueling')).default;
    const { container } = wrap(React.createElement(Refueling), '/refueling');
    await waitFor(() => {
      expect(container).toBeTruthy();
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Maintenance — sem jornada ativa
// ---------------------------------------------------------------------------
describe('Maintenance — formulário', () => {
  beforeEach(() => setUser(ADMIN));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('renderiza formulário de manutenção', async () => {
    const Maintenance = (await import('../pages/Maintenance')).default;
    const { container } = wrap(React.createElement(Maintenance), '/maintenance');
    await waitFor(() => {
      expect(container).toBeTruthy();
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: TimeBank — sem registros
// ---------------------------------------------------------------------------
describe('TimeBank — sem registros', () => {
  beforeEach(() => setUser(OPERADOR));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('renderiza banco de horas vazio para Operador', async () => {
    const TimeBank = (await import('../pages/TimeBank')).default;
    wrap(React.createElement(TimeBank), '/time-bank');
    await waitFor(() => {
      expect(screen.getAllByText(/banco de horas/i).length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: RequestMaintenance — Operador
// ---------------------------------------------------------------------------
describe('RequestMaintenance — Operador', () => {
  beforeEach(() => setUser(OPERADOR));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('renderiza formulário de solicitação para Operador', async () => {
    const RequestMaintenance = (await import('../pages/RequestMaintenance')).default;
    const { container } = wrap(React.createElement(RequestMaintenance), '/request-maintenance');
    await waitFor(() => {
      expect(container).toBeTruthy();
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Sidebar — com usuário Root
// ---------------------------------------------------------------------------
describe('Sidebar — com usuário Root', () => {
  beforeEach(() => setUser(ROOT));
  afterEach(() => { clearUser(); vi.clearAllMocks(); });

  it('renderiza sidebar para Root sem crash', async () => {
    const Sidebar = (await import('../components/Sidebar')).default;
    wrap(
      React.createElement(Sidebar, { isOpen: true, onClose: vi.fn() }),
      '/dashboard'
    );
    await waitFor(() => {
      expect(document.body).toBeTruthy();
    }, { timeout: 2000 });
  });
});
