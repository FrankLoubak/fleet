-- Adiciona coluna invited_by na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES profiles(id);

-- Atualiza o tipo de role para aceitar Root e Operador
-- (no Supabase o CHECK constraint precisa ser recriado)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('Root', 'Admin', 'Operador'));

-- Cria tabela de convites
CREATE TABLE IF NOT EXISTS invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  invited_by UUID REFERENCES profiles(id) NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Operador')),
  used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- RLS: apenas usuários autenticados podem criar convites
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins podem criar convites" ON invites
  FOR INSERT WITH CHECK (auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('Root', 'Admin')
  ));
CREATE POLICY "Convites são leitura pública pelo token" ON invites
  FOR SELECT USING (true);
CREATE POLICY "Convites podem ser atualizados pelo sistema" ON invites
  FOR UPDATE USING (true);
