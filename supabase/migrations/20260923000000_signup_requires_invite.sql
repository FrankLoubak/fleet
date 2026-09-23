-- =====================================================================================
-- Cadastro só por convite + papel imutável pelo próprio usuário (fix de segurança)
--
-- Antes desta migration:
--   1. handle_new_user() copiava raw_user_meta_data->>'role' para profiles.role — qualquer
--      anônimo com a anon key (pública no bundle JS) fazia POST /auth/v1/signup com
--      data.role='Root' e virava Root.
--   2. invites tinha SELECT USING (true) e UPDATE USING (true): qualquer anônimo listava
--      todos os tokens válidos e podia "desusar"/alterar convites.
--   3. "Users can update own profile" permitia UPDATE de qualquer coluna, inclusive role.
--
-- Depois:
--   - Cadastro via GoTrue exige data.invite_token de um convite existente, não usado e não expirado.
--     O papel e invited_by vêm do convite (nunca do cliente); o convite é marcado como
--     usado dentro da mesma transação do signup. Sem convite válido o signup falha.
--   - invites: leitura só Admin/Root; o Login consulta um convite pelo token via RPC
--     get_invite(token) (SECURITY DEFINER), que não permite listar. Sem UPDATE pelo cliente.
--   - profiles: role/cpf/email/invited_by só mudam por Root ou pelo backend (auth.uid()
--     nulo — SQL direto/service_role).
-- =====================================================================================

-- 1. Signup exige convite válido ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_invite public.invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM public.invites
  WHERE token::text = new.raw_user_meta_data->>'invite_token'
    AND used = false
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Bootstrap: quem cria usuário por SQL direto no banco (DBA) ainda define o papel
    -- via metadata — é o único jeito de criar o primeiro Root. O GoTrue conecta como
    -- supabase_auth_admin, então signup vindo da internet nunca cai aqui.
    IF session_user IN ('postgres', 'supabase_admin') THEN
      INSERT INTO public.profiles (id, name, email, role, cpf)
      VALUES (new.id, new.raw_user_meta_data->>'name', new.email,
              COALESCE(new.raw_user_meta_data->>'role', 'Operador'),
              new.raw_user_meta_data->>'cpf');
      RETURN new;
    END IF;
    RAISE EXCEPTION 'Cadastro exige um convite válido';
  END IF;

  INSERT INTO public.profiles (id, name, email, role, cpf, invited_by)
  VALUES (new.id, new.raw_user_meta_data->>'name', new.email, v_invite.role,
          new.raw_user_meta_data->>'cpf', v_invite.invited_by);

  UPDATE public.invites SET used = true, used_by = new.id WHERE id = v_invite.id;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. invites fechada; consulta pontual por token via RPC -------------------------------
DROP POLICY IF EXISTS "Convites são leitura pública pelo token" ON invites;
DROP POLICY IF EXISTS "Convites podem ser atualizados pelo sistema" ON invites;
DROP POLICY IF EXISTS "Admins podem criar convites" ON invites;

CREATE POLICY "invites_select_admin" ON invites FOR SELECT USING (is_admin_or_root());
CREATE POLICY "invites_insert_admin" ON invites FOR INSERT
  WITH CHECK (is_admin_or_root() AND invited_by = auth.uid());

CREATE OR REPLACE FUNCTION public.get_invite(p_token text)
RETURNS TABLE (id uuid, role text, used boolean, invited_by uuid, expires_at timestamptz) AS $$
  SELECT i.id, i.role, i.used, i.invited_by, i.expires_at
  FROM public.invites i
  WHERE i.token::text = p_token;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.get_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite(text) TO anon, authenticated;

-- 3. Colunas sensíveis de profiles imutáveis pelo próprio usuário ----------------------
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_root() THEN
    RETURN new;
  END IF;

  IF new.role IS DISTINCT FROM old.role
     OR new.cpf IS DISTINCT FROM old.cpf
     OR new.email IS DISTINCT FROM old.email
     OR new.invited_by IS DISTINCT FROM old.invited_by THEN
    RAISE EXCEPTION 'Sem permissão para alterar role/cpf/email/invited_by';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_profile_columns ON public.profiles;
CREATE TRIGGER protect_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();
