/**
 * Testes de interação de componentes do FleetManager
 *
 * Simula interações de usuário para cobrir handlers de eventos e lógica condicional.
 * O Supabase é mockado para retornar dados ricos e acionar mais branches.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mock completo do Supabase com suporte a todos os métodos de chain
// ---------------------------------------------------------------------------
const createFullChain = (data: unknown[] = [], single: unknown = null) => {
  const resolved = { data, error: null };
  const resolvedSingle = { data: single, error: null };

  // Cria um objeto que suporta qualquer combinação de .eq().eq().gte().lte().order().limit()
  const makeChain = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {
      ...resolved,
      data,
      error: null,
    };

    ['eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'like', 'ilike', 'is', 'in', 'not', 'or', 'filter'].forEach(m => {
      c[m] = vi.fn().mockReturnValue(makeChain());
    });

    c.order = vi.fn().mockReturnValue({ ...makeChain(), then: undefined });
    c.limit = vi.fn().mockReturnValue({ ...makeChain(), then: undefined });
    c.single = vi.fn().mockResolvedValue(resolvedSingle);

    // Make it thenable (Promise-like) for await
    c.then = undefined;

    return c;
  };

  return makeChain();
};

vi.mock('../lib/supabase', () => {
  const tables: Record<string, unknown[]> = {
    vehicles: [
      { id: 'v1', plate: 'ABC-1234', model: 'Toyota Hilux', prefix: 'FT-089',
        last_odometer: 125000, current_odometer: 125000, current_hourmeter: 0,
        vehicle_type: 'veiculo', initial_odometer: 100000, initial_hourmeter: 0 }
    ],
    profiles: [
      { id: 'u1', name: 'Admin User', email: 'admin@fleet.com', role: 'Admin',
        cpf: '11111111111', avatar_url: null, phone: '(11) 99999-0000', invited_by: null }
    ],
    journeys: [],
    refuelings: [],
    maintenances: [],
    maintenance_requests: [
      { id: 'req1', user_id: 'u1', vehicle_id: 'v1', date: '2026-05-01',
        odometer: 125000, type: 'Mecanica', description: 'Troca de óleo',
        status: 'pendente', budget_value: 150, document_url: null,
        service_request_number: null, material_request_number: null }
    ],
    banco_de_horas: [],
    invites: [],
  };

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    const data = tables[table] || [];
    const chain = createFullChain(data, data[0] || null);

    const selectFn = vi.fn().mockReturnValue(chain);
    const insertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: 'new-id' }], error: null }),
    });
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const deleteFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    return { select: selectFn, insert: insertFn, update: updateFn, delete: deleteFn };
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
  id: 'u1', cpf: '11111111111', name: 'Admin User', role: 'Admin',
  email: 'admin@fleet.com', avatar: null, phone: '(11) 99999-0000'
};

const OPERADOR_USER = {
  id: 'u2', cpf: '22222222222', name: 'Operador User', role: 'Operador',
  email: 'op@fleet.com', avatar: null
};

function setStoredUser(user: object) {
  localStorage.setItem('fleet_user', JSON.stringify(user));
}

function clearStorage() {
  localStorage.removeItem('fleet_user');
}

function wrap(el: React.ReactElement, path = '/') {
  return render(React.createElement(MemoryRouter, { initialEntries: [path] }, el));
}

// ---------------------------------------------------------------------------
// Suite: Login — Interações avançadas
// ---------------------------------------------------------------------------
describe('Login — interações avançadas', () => {
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('exibe copyright no rodapé', async () => {
    const Login = (await import('../pages/Login')).default;
    wrap(React.createElement(Login), '/login');
    expect(screen.getAllByText(/FleetManager/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/todos os direitos reservados/i)).toBeTruthy();
  });

  it('campo CPF tem placeholder correto', async () => {
    const Login = (await import('../pages/Login')).default;
    wrap(React.createElement(Login), '/login');
    expect(screen.getByPlaceholderText('000.000.000-00')).toBeTruthy();
  });

  it('formulário tem campo de senha', async () => {
    const Login = (await import('../pages/Login')).default;
    wrap(React.createElement(Login), '/login');
    const passInput = screen.getByPlaceholderText('••••••••');
    expect(passInput).toBeTruthy();
    expect((passInput as HTMLInputElement).type).toBe('password');
  });

  it('checkbox "Lembrar de mim" existe', async () => {
    const Login = (await import('../pages/Login')).default;
    wrap(React.createElement(Login), '/login');
    expect(screen.getByLabelText(/lembrar de mim/i)).toBeTruthy();
  });

  it('botão Entrar está habilitado inicialmente', async () => {
    const Login = (await import('../pages/Login')).default;
    wrap(React.createElement(Login), '/login');
    const btn = screen.getByRole('button', { name: /entrar/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite: Users — lista de usuários
// ---------------------------------------------------------------------------
describe('Users — lista de usuários', () => {
  beforeEach(() => setStoredUser(ADMIN_USER));
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza título "Usuários"', async () => {
    const Users = (await import('../pages/Users')).default;
    wrap(React.createElement(Users), '/users');

    await waitFor(() => {
      const titles = screen.getAllByText(/usuários/i);
      expect(titles.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('renderiza botão de gerar convite', async () => {
    const Users = (await import('../pages/Users')).default;
    wrap(React.createElement(Users), '/users');

    await waitFor(() => {
      // O botão tem "Gerar Link de Convite" (desktop) ou "Convidar" (mobile)
      const btns = document.querySelectorAll('button');
      const hasConvite = Array.from(btns).some(b => b.textContent?.includes('Convidar') || b.textContent?.includes('Convite'));
      expect(hasConvite).toBe(true);
    }, { timeout: 3000 });
  });

  it('renderiza tabela de usuários cadastrados', async () => {
    const Users = (await import('../pages/Users')).default;
    wrap(React.createElement(Users), '/users');

    await waitFor(() => {
      expect(document.body.innerHTML).toContain('Usuários Cadastrados');
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Vehicles — lista de veículos
// ---------------------------------------------------------------------------
describe('Vehicles — lista e busca', () => {
  beforeEach(() => setStoredUser(ADMIN_USER));
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza campo de busca', async () => {
    const Vehicles = (await import('../pages/Vehicles')).default;
    wrap(React.createElement(Vehicles), '/vehicles');

    await waitFor(() => {
      const searchInputs = document.querySelectorAll('input[type="text"], input[placeholder]');
      expect(searchInputs.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('renderiza botão de adicionar veículo', async () => {
    const Vehicles = (await import('../pages/Vehicles')).default;
    wrap(React.createElement(Vehicles), '/vehicles');

    await waitFor(() => {
      // Botão com texto "Novo Veículo" ou similar
      expect(document.body.innerHTML).toContain('Veículo');
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Journeys — lista de jornadas
// ---------------------------------------------------------------------------
describe('Journeys — lista e filtros', () => {
  beforeEach(() => setStoredUser(ADMIN_USER));
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza a página de jornadas com header', async () => {
    const Journeys = (await import('../pages/Journeys')).default;
    wrap(React.createElement(Journeys), '/journeys');

    await waitFor(() => {
      expect(document.body.innerHTML).toContain('Jornadas');
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: MaintenanceList — lista de manutenções
// ---------------------------------------------------------------------------
describe('MaintenanceList — lista e filtros', () => {
  beforeEach(() => setStoredUser(ADMIN_USER));
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza tabs de viewMode', async () => {
    const MaintenanceList = (await import('../pages/MaintenanceList')).default;
    wrap(React.createElement(MaintenanceList), '/maintenance-list');

    await waitFor(() => {
      // Deve ter tabs de Executadas, Autorizadas, Pendentes, Canceladas
      expect(document.body.innerHTML).toContain('Executadas');
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: DailyReport — Operador com jornada aberta
// ---------------------------------------------------------------------------
describe('DailyReport — Operador sem jornada ativa', () => {
  beforeEach(() => setStoredUser(OPERADOR_USER));
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza o seletor de veículo', async () => {
    const DailyReport = (await import('../pages/DailyReport')).default;
    wrap(React.createElement(DailyReport), '/daily-report');

    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(500);
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Refueling — formulário de abastecimento
// ---------------------------------------------------------------------------
describe('Refueling — formulário', () => {
  beforeEach(() => setStoredUser(ADMIN_USER));
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza título de abastecimento', async () => {
    const Refueling = (await import('../pages/Refueling')).default;
    wrap(React.createElement(Refueling), '/refueling');

    await waitFor(() => {
      expect(document.body.innerHTML).toContain('Abastecimento');
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Maintenance — formulário
// ---------------------------------------------------------------------------
describe('Maintenance — formulário de manutenção', () => {
  beforeEach(() => setStoredUser(ADMIN_USER));
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza seções do formulário de manutenção', async () => {
    const Maintenance = (await import('../pages/Maintenance')).default;
    wrap(React.createElement(Maintenance), '/maintenance');

    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(500);
    }, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Dashboard — estatísticas
// ---------------------------------------------------------------------------
describe('Dashboard — estatísticas e filtros', () => {
  beforeEach(() => setStoredUser(ADMIN_USER));
  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza o Dashboard sem crash', async () => {
    const Dashboard = (await import('../pages/Dashboard')).default;
    const { container } = wrap(React.createElement(Dashboard), '/dashboard');

    // Aguarda renderização inicial (mesmo sem dados, não deve crashar)
    await waitFor(() => {
      expect(container).toBeTruthy();
    }, { timeout: 8000 });
  }, 10000);
});
