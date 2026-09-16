-- ARQUIVO: supabase/migrations/20260916000002_driver_identification.sql
-- O QUE FAZ: cria driver_pins (PIN de identificação, hash bcrypt via pgcrypto) e
--   driver_checkins (registro de cada identificação bem-sucedida ao abrir uma jornada),
--   mais as funções set_driver_pin()/verify_driver_pin() que fazem hash/verificação
--   sempre no servidor — o hash nunca é lido pelo cliente.
-- PARA QUE SERVE: Rodada C / C1 — exigência de identificação do motorista antes da
--   partida (TR Salgueiro/PE, item 5.6.1-b). PIN de 4-6 dígitos porque o espaço de busca
--   é pequeno (até 10^6 combinações) — por isso a verificação SEMPRE roda como função
--   SQL no servidor (nunca comparação client-side) e a tabela nunca é exposta por SELECT
--   público, diferente do restante do schema (profiles é público, driver_pins não).
-- MÓDULOS RELACIONADOS:
--   - src/lib/drivers/DriverAuthProvider.ts — consome verify_driver_pin() via supabase.rpc
--   - src/pages/Profile.tsx — consome set_driver_pin() via supabase.rpc
--   - src/pages/Journeys.tsx — grava driver_checkins ao abrir jornada com identificação ok
-- ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial (Rodada C / C1)

-- Na imagem supabase/postgres real, pgcrypto já vem instalada no schema "extensions",
-- não em "public" — e authenticated/anon (usados pelo PostgREST) não têm "extensions" no
-- search_path por padrão. Por isso todo function abaixo que chama crypt()/gen_salt()
-- fixa SET search_path explicitamente, em vez de depender do search_path de quem chama.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE driver_pins (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE driver_pins ENABLE ROW LEVEL SECURITY;

-- Sem SELECT público (nem pra Admin/Root) — ninguém lê o hash de ninguém, nem o dono.
-- A única forma de usar o PIN é via verify_driver_pin(), que nunca retorna o hash.
CREATE POLICY "driver_pins_select_own" ON driver_pins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "driver_pins_insert_own" ON driver_pins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "driver_pins_update_own" ON driver_pins FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE driver_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID REFERENCES journeys(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES profiles(id),
  method TEXT NOT NULL DEFAULT 'pin',
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_credential_hash TEXT NOT NULL
);

ALTER TABLE driver_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_checkins_select" ON driver_checkins FOR SELECT
  USING (auth.uid() = driver_id OR is_admin_or_root());
CREATE POLICY "driver_checkins_insert" ON driver_checkins FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

-- Define/troca o PIN do próprio usuário autenticado. SECURITY INVOKER (não precisa de
-- privilégio elevado — RLS de driver_pins já garante que só dá pra escrever a própria
-- linha). Validação de formato aqui evita PIN vazio/não-numérico chegar ao hash.
CREATE OR REPLACE FUNCTION set_driver_pin(new_pin TEXT)
RETURNS void AS $$
BEGIN
  IF new_pin !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'PIN deve ter entre 4 e 6 dígitos numéricos';
  END IF;

  INSERT INTO driver_pins (user_id, pin_hash, updated_at)
  VALUES (auth.uid(), crypt(new_pin, gen_salt('bf')), now())
  ON CONFLICT (user_id) DO UPDATE
    SET pin_hash = crypt(new_pin, gen_salt('bf')), updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions;

-- Verifica o PIN do próprio usuário autenticado contra o hash salvo. Retorna false
-- (nunca erro) se o PIN ainda não foi definido, para o app tratar como "não identificado"
-- sem precisar distinguir "PIN errado" de "PIN nunca cadastrado" no fluxo de bloqueio.
CREATE OR REPLACE FUNCTION verify_driver_pin(pin TEXT)
RETURNS boolean AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT pin_hash INTO stored_hash FROM driver_pins WHERE user_id = auth.uid();
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  RETURN stored_hash = crypt(pin, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions;

-- Reverifica o PIN e, se válido, grava o check-in vinculado a uma jornada já criada
-- (não dá pra gravar antes — journey_id só existe depois do INSERT em journeys). O hash
-- salvo em driver_checkins.raw_credential_hash é só trilha de auditoria (sha256, sem
-- salt) — a defesa real é o bcrypt de driver_pins verificado aqui, não este hash.
CREATE OR REPLACE FUNCTION record_driver_checkin(p_journey_id UUID, pin TEXT)
RETURNS boolean AS $$
BEGIN
  IF NOT verify_driver_pin(pin) THEN
    RETURN false;
  END IF;

  INSERT INTO driver_checkins (journey_id, driver_id, method, raw_credential_hash)
  VALUES (p_journey_id, auth.uid(), 'pin', encode(digest(pin, 'sha256'), 'hex'));

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions;
