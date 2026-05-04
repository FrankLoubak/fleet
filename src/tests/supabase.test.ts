/**
 * Testes de src/lib/supabase.ts
 *
 * O arquivo cria um cliente Supabase com variáveis de ambiente.
 * Aqui verificamos que o módulo exporta corretamente o cliente.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock do @supabase/supabase-js para evitar chamadas reais
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  }),
}));

describe('supabase client', () => {
  it('exporta o objeto supabase', async () => {
    const { supabase } = await import('../lib/supabase');
    expect(supabase).toBeDefined();
    expect(supabase).not.toBeNull();
  });

  it('supabase tem método auth', async () => {
    const { supabase } = await import('../lib/supabase');
    expect(supabase.auth).toBeDefined();
  });

  it('supabase tem método from', async () => {
    const { supabase } = await import('../lib/supabase');
    expect(supabase.from).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });

  it('createClient é chamado com URL e chave (podendo ser strings vazias)', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    // createClient foi chamado na inicialização do módulo
    expect(createClient).toHaveBeenCalled();
  });
});
