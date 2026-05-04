/**
 * Testes de src/App.tsx
 *
 * Importa e renderiza o componente real para aumentar cobertura.
 * O Supabase é completamente mockado.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type { AuthUser } from '../types';

// ---------------------------------------------------------------------------
// Mock do Supabase — deve vir antes de qualquer import que use '../lib/supabase'
// ---------------------------------------------------------------------------
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_ADMIN: AuthUser = {
  id: 'user-001',
  cpf: '12345678901',
  name: 'Admin Test',
  role: 'Admin',
};

function setStoredUser(user: object) {
  localStorage.setItem('fleet_user', JSON.stringify(user));
}

function clearStorage() {
  localStorage.removeItem('fleet_user');
}

// ---------------------------------------------------------------------------
// Suite: App component
// ---------------------------------------------------------------------------
describe('App component', () => {
  beforeEach(() => {
    clearStorage();
  });

  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it('renderiza null enquanto sessão não foi verificada (antes do getSession resolver)', async () => {
    // Retarda a resposta do getSession para manter o estado de loading
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.auth.getSession).mockImplementationOnce(
      () => new Promise(() => {}) // nunca resolve
    );

    const App = (await import('../App')).default;
    const { container } = render(React.createElement(App));
    // Enquanto sessionChecked = false, o componente retorna null
    expect(container.firstChild).toBeNull();
  });

  it('renderiza as rotas após verificar sessão (sem usuário → Login visível em /login)', async () => {
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as Parameters<typeof vi.mocked<typeof supabase.auth.getSession>>[0]);

    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      // Após checar sessão, a rota / redireciona para /login
      // FleetManager é o título exibido na página de login
      expect(screen.getByText('FleetManager')).toBeTruthy();
    });
  });

  it('limpa localStorage quando sessão Supabase expira (session null)', async () => {
    setStoredUser(VALID_ADMIN);
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as Parameters<typeof vi.mocked<typeof supabase.auth.getSession>>[0]);

    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      // Após verificar sessão null, fleet_user deve ser removido
      expect(localStorage.getItem('fleet_user')).toBeNull();
    });
  });

  it('chama onAuthStateChange no mount', async () => {
    const { supabase } = await import('../lib/supabase');
    const onAuthStateMock = vi.mocked(supabase.auth.onAuthStateChange);

    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      expect(onAuthStateMock).toHaveBeenCalled();
    });
  });

  it('desinscreve do onAuthStateChange quando desmontado', async () => {
    const unsubscribeMock = vi.fn();
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValueOnce({
      data: { subscription: { unsubscribe: unsubscribeMock } },
    });

    const App = (await import('../App')).default;
    const { unmount } = render(React.createElement(App));

    await waitFor(() => {
      expect(screen.getAllByText('FleetManager').length).toBeGreaterThan(0);
    });

    unmount();
    // Após unmount, a cleanup function deve ter sido chamada
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('mantém usuário no localStorage quando sessão Supabase está ativa', async () => {
    setStoredUser(VALID_ADMIN);
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: { user: { id: 'user-001' } } as unknown as import('@supabase/supabase-js').Session },
      error: null,
    });

    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      // Com sessão ativa, o localStorage é mantido
      expect(localStorage.getItem('fleet_user')).not.toBeNull();
    });
  });

  it('SIGNED_OUT event remove fleet_user do localStorage', async () => {
    setStoredUser(VALID_ADMIN);
    const { supabase } = await import('../lib/supabase');

    let authCallback: ((event: string) => void) | null = null;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementationOnce((callback: (event: string) => void) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      expect(authCallback).not.toBeNull();
    });

    // Simula evento SIGNED_OUT
    if (authCallback) {
      authCallback('SIGNED_OUT');
    }

    expect(localStorage.getItem('fleet_user')).toBeNull();
  });
});
