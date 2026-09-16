-- ARQUIVO: supabase/migrations/20260916000003_profiles_cpf_column.sql
-- O QUE FAZ: adiciona a coluna profiles.cpf (nunca existiu em nenhuma migration tracked)
--   e atualiza handle_new_user() para copiá-la de raw_user_meta_data, igual já faz com
--   name/role.
-- PARA QUE SERVE: bug pré-existente descoberto ao testar a Rodada C / C1 (não é parte do
--   escopo original de C1-C4, mas bloqueava a validação de qualquer fluxo de login real):
--   src/pages/Login.tsx sempre manda cpf em raw_user_meta_data no signUp(), e
--   src/App.tsx#readStoredUser() sempre exige profiles.cpf como string pra aceitar a
--   sessão — mas a coluna nunca existiu, então TODO usuário criado via convite ficava
--   sem sessão válida após logar (redirecionado de volta pra /login em qualquer rota
--   protegida). Mascarado até agora porque MOCK_USERS (dados de teste no frontend, sem
--   passar pelo banco) já tem cpf hardcoded, e login via CPF só "funcionava" pelo
--   fallback de e-mail sintético (<cpf>@fleetmanager.com), nunca pela busca real em
--   profiles.cpf (que sempre falhava silenciosamente, ver Login.tsx linha ~148-152).
-- MÓDULOS RELACIONADOS:
--   - src/pages/Login.tsx — signUp()/lookup por cpf, ambos dependem desta coluna
--   - src/App.tsx (readStoredUser) — exige profiles.cpf como string
--   - src/pages/Profile.tsx, src/pages/Users.tsx — exibem profiles.cpf
-- ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial

ALTER TABLE profiles ADD COLUMN cpf TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, cpf)
  VALUES (new.id, new.raw_user_meta_data->>'name', new.email, COALESCE(new.raw_user_meta_data->>'role', 'Motorista'), new.raw_user_meta_data->>'cpf');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
