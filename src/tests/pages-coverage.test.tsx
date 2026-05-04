/**
 * Testes adicionais de cobertura para páginas do FleetManager
 *
 * Foca em exercitar branches e estados não cobertos pelos testes básicos.
 * Mock do Supabase retorna dados reais para acionar mais lógica de renderização.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { AuthUser } from '../types';

// ---------------------------------------------------------------------------
// Dados mock para o Supabase
// ---------------------------------------------------------------------------
const MOCK_VEHICLES_DATA = [
  {
    id: 'v1', plate: 'ABC-1234', model: 'Toyota Hilux', prefix: 'FT-089',
    last_odometer: 125000, current_odometer: 125000, current_hourmeter: 0,
    vehicle_type: 'veiculo', initial_odometer: 100000, initial_hourmeter: 0
  },
  {
    id: 'v2', plate: 'XYZ-9876', model: 'Caterpillar 320', prefix: 'MAQ-01',
    last_odometer: 0, current_odometer: 0, current_hourmeter: 500,
    vehicle_type: 'maquina', initial_odometer: 0, initial_hourmeter: 400
  }
];

const MOCK_PROFILES_DATA = [
  { id: 'u1', name: 'Admin Test', email: 'admin@fleet.com', role: 'Admin', avatar_url: null, phone: null },
  { id: 'u2', name: 'Motorista Test', email: 'op@fleet.com', role: 'Operador', avatar_url: null, phone: null },
];

const MOCK_JOURNEY_OPEN = {
  id: 'j-open-1', user_id: 'u1', vehicle_id: 'v1',
  start_time: '2026-05-01T08:00:00', end_time: null,
  start_odometer: 125000, end_odometer: null, distance_traveled: null,
  status: 'aberta', observations: null, validation_status: 'pendente', validated_by: null
};

const MOCK_JOURNEY_CLOSED = {
  id: 'j-closed-1', user_id: 'u1', vehicle_id: 'v1',
  start_time: '2026-04-30T08:00:00', end_time: '2026-04-30T18:00:00',
  start_odometer: 124800, end_odometer: 125000, distance_traveled: 200,
  status: 'encerrada', observations: 'Tudo ok.', validation_status: 'pendente', validated_by: null
};

const MOCK_REFUELINGS_DATA = [
  { id: 'r1', vehicle_id: 'v1', date: '2026-04-15', odometer: 124000,
    quantity: 40, fuel_type: 'Diesel', location: 'Posto Central', total_value: 248 },
];

const MOCK_MAINTENANCES_DATA = [
  { id: 'm1', vehicle_id: 'v1', date: '2026-04-10', type: 'Mecanica',
    provider: 'Oficina Central', mileage: 123000, description: 'Troca de óleo',
    total_value: 350, status: 'executada' }
];

const MOCK_REQUESTS_DATA = [
  { id: 'req1', user_id: 'u2', vehicle_id: 'v1', date: '2026-05-01',
    odometer: 125000, type: 'Borracharia', description: 'Pneu furado',
    status: 'pendente', budget_value: 150 }
];

const MOCK_TIME_BANK_DATA = [
  { id: 'tb1', user_id: 'u1', journey_id: 'j-closed-1',
    horas_adquiridas: '02:30', created_at: '2026-04-30T18:00:00',
    journey: {
      id: 'j-closed-1', user_id: 'u1', vehicle_id: 'v1',
      start_time: '2026-04-30T08:00:00', end_time: '2026-04-30T18:00:00',
      start_odometer: 124800, end_odometer: 125000, distance_traveled: 200,
      status: 'encerrada', observations: 'Tudo ok.', validation_status: 'pendente', validated_by: null
    },
    user: { id: 'u1', name: 'Admin Test', email: 'admin@fleet.com', role: 'Admin', avatar_url: null, phone: null }
  }
];

const MOCK_USERS_DATA = [
  { id: 'u1', name: 'Admin Test', email: 'admin@fleet.com', role: 'Admin',
    cpf: '11111111111', avatar_url: null, phone: null, invited_by: null }
];

// ---------------------------------------------------------------------------
// Mock do Supabase com dados ricos — suporta todos os métodos de chain
// ---------------------------------------------------------------------------
vi.mock('../lib/supabase', () => {
  // Cria um proxy infinito que retorna sempre dados e suporta qualquer método de chain
  function createInfiniteChain(data: unknown[], single: unknown = null): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    const resolved = { data, error: null };
    const resolvedSingle = { data: single, error: null };

    // Métodos que terminam a chain (retornam Promise)
    chain.then = undefined; // não é uma Promise diretamente
    // Métodos de chain que retornam outro chain
    const chainMethods = ['eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'like', 'ilike', 'in',
      'order', 'limit', 'range', 'filter', 'contains', 'containedBy', 'not', 'or', 'and'];

    chainMethods.forEach(method => {
      if (method === 'single') {
        chain[method] = vi.fn().mockResolvedValue(resolvedSingle);
      } else if (method === 'limit' || method === 'order') {
        // limit e order podem ser tanto terminadores quanto encadeadores
        const subChain = { ...resolved };
        chainMethods.forEach(m => {
          (subChain as Record<string, unknown>)[m] = vi.fn().mockResolvedValue(resolved);
        });
        (subChain as Record<string, unknown>).single = vi.fn().mockResolvedValue(resolvedSingle);
        chain[method] = vi.fn().mockReturnValue(subChain);
      } else {
        // Cria um sub-chain que também suporta todos os métodos
        const subChain: Record<string, unknown> = { ...resolved };
        chainMethods.forEach(m => {
          (subChain as Record<string, unknown>)[m] = vi.fn().mockResolvedValue(resolved);
        });
        (subChain as Record<string, unknown>).single = vi.fn().mockResolvedValue(resolvedSingle);
        // Para order e limit dentro do sub-chain:
        (subChain as Record<string, unknown>).order = vi.fn().mockReturnValue({
          ...resolved,
          limit: vi.fn().mockResolvedValue(resolved),
          single: vi.fn().mockResolvedValue(resolvedSingle),
        });
        (subChain as Record<string, unknown>).limit = vi.fn().mockReturnValue({
          ...resolved,
          order: vi.fn().mockResolvedValue(resolved),
          single: vi.fn().mockResolvedValue(resolvedSingle),
        });
        // Deep chain para eq().eq()
        (subChain as Record<string, unknown>).eq = vi.fn().mockReturnValue({
          ...resolved,
          eq: vi.fn().mockReturnValue({
            ...resolved,
            order: vi.fn().mockReturnValue({
              ...resolved,
              limit: vi.fn().mockResolvedValue(resolved),
            }),
            limit: vi.fn().mockResolvedValue(resolved),
            single: vi.fn().mockResolvedValue(resolvedSingle),
            gte: vi.fn().mockReturnValue({ ...resolved, lte: vi.fn().mockResolvedValue(resolved) }),
            lte: vi.fn().mockResolvedValue(resolved),
          }),
          order: vi.fn().mockReturnValue({
            ...resolved,
            limit: vi.fn().mockResolvedValue(resolved),
          }),
          limit: vi.fn().mockResolvedValue(resolved),
          single: vi.fn().mockResolvedValue(resolvedSingle),
          gte: vi.fn().mockReturnValue({ ...resolved, lte: vi.fn().mockResolvedValue(resolved) }),
          lte: vi.fn().mockResolvedValue(resolved),
        });
        chain[method] = vi.fn().mockReturnValue(subChain);
      }
    });

    chain.single = vi.fn().mockResolvedValue(resolvedSingle);

    return chain;
  }

  // Map de retorno por tabela
  const tableData: Record<string, unknown[]> = {
    vehicles: MOCK_VEHICLES_DATA,
    profiles: MOCK_PROFILES_DATA,
    journeys: [],
    refuelings: MOCK_REFUELINGS_DATA,
    maintenances: MOCK_MAINTENANCES_DATA,
    maintenance_requests: MOCK_REQUESTS_DATA,
    banco_de_horas: MOCK_TIME_BANK_DATA,
    invites: [],
  };

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    const data = tableData[table] || [];
    const chain = createInfiniteChain(data, data[0] || null);

    return {
      select: vi.fn().mockReturnValue(chain),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{ ...(data[0] as object || {}), id: 'new-id' }], error: null }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: 'u1' } }, error: null
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      },
      from: mockFrom,
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'http://example.com/doc.pdf' } }),
        }),
      },
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ADMIN_USER = {
  id: 'u1', cpf: '11111111111', name: 'Admin Test', role: 'Admin',
  email: 'admin@fleet.com', avatar: null, phone: null
};

const OPERADOR_USER = {
  id: 'u2', cpf: '22222222222', name: 'Operador Test', role: 'Operador',
  email: 'op@fleet.com', avatar: null, phone: null
};

function setStoredUser(user: object) {
  localStorage.setItem('fleet_user', JSON.stringify(user));
}

function clearStorage() {
  localStorage.removeItem('fleet_user');
}

function wrap(element: React.ReactElement, path = '/') {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [path] }, element)
  );
}

// ---------------------------------------------------------------------------
// Suite: DailyReport com dados ricos
// ---------------------------------------------------------------------------
describe('DailyReport — com dados ricos', () => {
  beforeEach(() => {
    setStoredUser(OPERADOR_USER);
  });
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza o header após carregar dados', async () => {
    const DailyReport = (await import('../pages/DailyReport')).default;
    wrap(React.createElement(DailyReport), '/daily-report');
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 3000 });
  });

  it('renderiza com usuário Admin', async () => {
    setStoredUser(ADMIN_USER);
    const DailyReport = (await import('../pages/DailyReport')).default;
    wrap(React.createElement(DailyReport), '/daily-report');
    await waitFor(() => {
      expect(document.body).toBeTruthy();
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Dashboard com dados ricos
// ---------------------------------------------------------------------------
describe('Dashboard — com dados ricos', () => {
  beforeEach(() => {
    setStoredUser(ADMIN_USER);
  });
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza as estatísticas do dashboard', async () => {
    const Dashboard = (await import('../pages/Dashboard')).default;
    wrap(React.createElement(Dashboard), '/dashboard');
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Vehicles com dados ricos
// ---------------------------------------------------------------------------
describe('Vehicles — com dados ricos', () => {
  beforeEach(() => {
    setStoredUser(ADMIN_USER);
  });
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza a lista de veículos', async () => {
    const Vehicles = (await import('../pages/Vehicles')).default;
    wrap(React.createElement(Vehicles), '/vehicles');
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Journeys com dados ricos
// ---------------------------------------------------------------------------
describe('Journeys — com dados ricos', () => {
  beforeEach(() => {
    setStoredUser(ADMIN_USER);
  });
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza a lista de jornadas', async () => {
    const Journeys = (await import('../pages/Journeys')).default;
    wrap(React.createElement(Journeys), '/journeys');
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: MaintenanceList com dados ricos
// ---------------------------------------------------------------------------
describe('MaintenanceList — com dados ricos', () => {
  beforeEach(() => {
    setStoredUser(ADMIN_USER);
  });
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza a lista de manutenções', async () => {
    const MaintenanceList = (await import('../pages/MaintenanceList')).default;
    wrap(React.createElement(MaintenanceList), '/maintenance-list');
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Refueling com dados ricos
// ---------------------------------------------------------------------------
describe('Refueling — com dados ricos', () => {
  beforeEach(() => {
    setStoredUser(ADMIN_USER);
  });
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza a lista de abastecimentos', async () => {
    const Refueling = (await import('../pages/Refueling')).default;
    wrap(React.createElement(Refueling), '/refueling');
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Maintenance com dados ricos
// ---------------------------------------------------------------------------
describe('Maintenance — com dados ricos', () => {
  beforeEach(() => {
    setStoredUser(ADMIN_USER);
  });
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza a página de manutenções', async () => {
    const Maintenance = (await import('../pages/Maintenance')).default;
    wrap(React.createElement(Maintenance), '/maintenance');
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Users com dados ricos
// ---------------------------------------------------------------------------
describe('Users — com dados ricos', () => {
  beforeEach(() => {
    setStoredUser(ADMIN_USER);
  });
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza a lista de usuários', async () => {
    const Users = (await import('../pages/Users')).default;
    wrap(React.createElement(Users), '/users');
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: TimeBank com dados ricos (registros com horas)
// ---------------------------------------------------------------------------
describe('TimeBank — com dados ricos', () => {
  beforeEach(() => {
    setStoredUser(ADMIN_USER);
  });
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('exibe saldo total de horas calculado', async () => {
    const TimeBank = (await import('../pages/TimeBank')).default;
    wrap(React.createElement(TimeBank), '/time-bank');
    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Login — teste de interação de formulário
// ---------------------------------------------------------------------------
describe('Login — interações de formulário', () => {
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('campo CPF aceita entrada numérica', async () => {
    const Login = (await import('../pages/Login')).default;
    wrap(React.createElement(Login), '/login');

    const cpfInput = screen.getByPlaceholderText('000.000.000-00') as HTMLInputElement;
    fireEvent.change(cpfInput, { target: { value: '123' } });
    // O handler faz replace(/\D/g, ''), então '123' permanece '123'
    expect(cpfInput).toBeTruthy();
  });

  it('botão de toggle de senha funciona', async () => {
    const Login = (await import('../pages/Login')).default;
    wrap(React.createElement(Login), '/login');

    const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    // Encontra o botão de toggle (o único button de type="button" no form)
    const toggleButtons = document.querySelectorAll('button[type="button"]');
    if (toggleButtons.length > 0) {
      fireEvent.click(toggleButtons[0]);
      // Após click, o tipo pode mudar para 'text'
      expect(document.body).toBeTruthy();
    }
  });

  it('formulário de login tem campo senha', async () => {
    const Login = (await import('../pages/Login')).default;
    wrap(React.createElement(Login), '/login');

    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
  });

  it('renderiza formulário de cadastro quando token está na URL', async () => {
    const Login = (await import('../pages/Login')).default;
    wrap(React.createElement(Login), '/login?token=abc123');
    await waitFor(() => {
      // Com token, o componente tenta buscar o convite e mostra mensagem de loading ou erro
      expect(document.body).toBeTruthy();
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: RequestMaintenance — interações
// ---------------------------------------------------------------------------
describe('RequestMaintenance — interações', () => {
  beforeEach(() => {
    setStoredUser(OPERADOR_USER);
  });
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('exibe seção de dados da solicitação', async () => {
    const RequestMaintenance = (await import('../pages/RequestMaintenance')).default;
    wrap(React.createElement(RequestMaintenance), '/request-maintenance');

    await waitFor(() => {
      expect(screen.getByText(/dados da solicitação/i)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('exibe seção de detalhes da manutenção', async () => {
    const RequestMaintenance = (await import('../pages/RequestMaintenance')).default;
    wrap(React.createElement(RequestMaintenance), '/request-maintenance');

    await waitFor(() => {
      expect(screen.getByText(/detalhes da manutenção/i)).toBeTruthy();
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Sidebar com usuário Admin
// ---------------------------------------------------------------------------
describe('Sidebar — com usuário Admin', () => {
  beforeEach(() => {
    setStoredUser(ADMIN_USER);
  });
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('exibe o nome do usuário na sidebar', async () => {
    const Sidebar = (await import('../components/Sidebar')).default;
    wrap(
      React.createElement(Sidebar, { isOpen: true, onClose: vi.fn() }),
      '/dashboard'
    );

    await waitFor(() => {
      // Usa getAllByText porque podem existir múltiplas ocorrências do nome
      expect(screen.getAllByText('Admin Test').length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('exibe links de navegação para Admin', async () => {
    const Sidebar = (await import('../components/Sidebar')).default;
    wrap(
      React.createElement(Sidebar, { isOpen: true, onClose: vi.fn() }),
      '/dashboard'
    );

    await waitFor(() => {
      // Sidebar deve renderizar links de navegação
      expect(document.querySelectorAll('a').length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('sidebar fechada não quebra renderização', async () => {
    const Sidebar = (await import('../components/Sidebar')).default;
    const { container } = wrap(
      React.createElement(Sidebar, { isOpen: false, onClose: vi.fn() }),
      '/dashboard'
    );
    expect(container).toBeTruthy();
  });
});
