-- =====================================================================================
-- ARQUIVO: supabase/migrations/20260924000000_smartgps_sync.sql
-- O QUE FAZ: integração SmartGPS rodando DENTRO do Postgres (pg_cron + extensão http):
--   a cada minuto sincroniza posições reais para vehicle_positions e ingere os disparos
--   de cerca (geofenceIn/geofenceOut) calculados pela própria SmartGPS em alert_events.
-- PARA QUE SERVE: Rodada C / C2 — GeofenceRule consome o evento de cerca JÁ CALCULADO
--   pela SmartGPS (decisão do usuário em 2026-09-24: eventos da SmartGPS, não cálculo
--   próprio). Roda no banco porque o frontend é SPA estático na Vercel (a senha da
--   SmartGPS não pode ir pro navegador) e o EasyPanel apaga arquivos não gerenciados do
--   compose — uma migration versionada é o único lugar estável para esse código.
-- CONTRATO DA API (https://smartgps.com.br/api/docs/openapi, servidor https://api.ach.ar):
--   - Login password: POST /auth/login {email,password} → {idToken, expiresIn} (~1h)
--   - Login demo:     POST /auth/demo-session → {token} (custom token Firebase), trocado em
--     identitytoolkit accounts:signInWithCustomToken → {idToken, expiresIn}. Conta demo é
--     somente leitura, 1 veículo, sem cercas — serve para validar login e posições.
--   - GET /positions/realtime?imeis=a,b (máx 20) → {"0": {imei, lat, lng, spd, ign, dt(ms)}, ...}
--   - GET /alerts/events?from=ISO&to=ISO&page=N&pageSize≤50 → {events:[{id, alertId,
--     alertName, legacyType, imei, channel, firedAt, success}], totalPages}. É log de
--     ENTREGA por canal: um disparo gera uma linha por canal → deduplicado por
--     alertId+imei+firedAt (alert_events.external_id).
--   - Alerta de cerca na SmartGPS: POST /alerts {legacyType: geofenceIn|geofenceOut,
--     params: {geofenceId}, imeis} — criado no painel deles por enquanto.
-- A VERIFICAR com conta real (a demo não tem nenhum disparo): se legacyType do evento vem
--   como geofenceIn/geofenceOut ou genérico "geofence" (exemplo da spec) — no genérico a
--   direção fica null no metadata.
-- MÓDULOS RELACIONADOS:
--   - src/lib/alerts/GeofenceRule.ts — não avalia por posição; eventos chegam por aqui
--   - 20260916000001_telemetry_schema.sql — vehicle_trackers (provider='smartgps',
--     serial_number = IMEI) / vehicle_positions
-- ATIVAR: SELECT smartgps.configure('demo');  ou  SELECT smartgps.configure('password',
--   'email@x', 'senha');  (senha vai para o supabase_vault)
-- =====================================================================================

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

CREATE SCHEMA IF NOT EXISTS smartgps;
REVOKE ALL ON SCHEMA smartgps FROM PUBLIC;

-- Uma única linha de configuração/estado
CREATE TABLE smartgps.config (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  enabled BOOLEAN NOT NULL DEFAULT false,
  auth_mode TEXT NOT NULL DEFAULT 'demo' CHECK (auth_mode IN ('demo', 'password')),
  email TEXT,
  api_base TEXT NOT NULL DEFAULT 'https://api.ach.ar',
  -- chave pública do app web Firebase da SmartGPS (a mesma embutida no site deles)
  firebase_api_key TEXT NOT NULL DEFAULT 'AIzaSyA1HCHRbADSMLyaTeGthgsV4FTkKAl4PqE',
  id_token TEXT,
  token_expires_at TIMESTAMPTZ,
  events_cursor TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_error TEXT
);
INSERT INTO smartgps.config DEFAULT VALUES;

-- Evento externo idempotente
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS alert_events_external_id_key
  ON alert_events (external_id) WHERE external_id IS NOT NULL;

-- HTTP ----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION smartgps.http_json(p_method TEXT, p_url TEXT, p_body JSONB DEFAULT NULL,
                                              p_bearer TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_headers extensions.http_header[] := ARRAY[extensions.http_header('Referer', 'https://smartgps.com.br/')];
  v_res extensions.http_response;
BEGIN
  IF p_bearer IS NOT NULL THEN
    v_headers := v_headers || extensions.http_header('Authorization', 'Bearer ' || p_bearer);
  END IF;
  PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT', '20');
  v_res := extensions.http((p_method, p_url, v_headers,
                            CASE WHEN p_body IS NULL THEN NULL ELSE 'application/json' END,
                            p_body::text)::extensions.http_request);
  IF v_res.status NOT IN (200, 201) THEN
    RAISE EXCEPTION 'SmartGPS % % → HTTP %: %', p_method, p_url, v_res.status, left(v_res.content, 300);
  END IF;
  RETURN v_res.content::jsonb;
END;
$$ LANGUAGE plpgsql;

-- Token (cache até ~2 min antes de expirar) ----------------------------------------------
CREATE OR REPLACE FUNCTION smartgps.get_token()
RETURNS TEXT AS $$
DECLARE
  c smartgps.config;
  v_login JSONB;
  v_custom TEXT;
  v_password TEXT;
BEGIN
  SELECT * INTO c FROM smartgps.config;
  IF c.id_token IS NOT NULL AND c.token_expires_at > now() + interval '2 minutes' THEN
    RETURN c.id_token;
  END IF;

  IF c.auth_mode = 'password' THEN
    SELECT decrypted_secret INTO v_password FROM vault.decrypted_secrets WHERE name = 'smartgps_password';
    IF c.email IS NULL OR v_password IS NULL THEN
      RAISE EXCEPTION 'SmartGPS: modo password sem email/senha — use smartgps.configure()';
    END IF;
    v_login := smartgps.http_json('POST', c.api_base || '/auth/login',
                                  jsonb_build_object('email', c.email, 'password', v_password));
  ELSE
    v_custom := smartgps.http_json('POST', c.api_base || '/auth/demo-session', '{}'::jsonb)->>'token';
    v_login := smartgps.http_json('POST',
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' || c.firebase_api_key,
      jsonb_build_object('token', v_custom, 'returnSecureToken', true));
  END IF;

  UPDATE smartgps.config
     SET id_token = v_login->>'idToken',
         token_expires_at = now() + make_interval(secs => COALESCE((v_login->>'expiresIn')::int, 3600));
  RETURN v_login->>'idToken';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION smartgps.api_get(p_path TEXT)
RETURNS JSONB AS $$
  SELECT smartgps.http_json('GET', (SELECT api_base FROM smartgps.config) || p_path, NULL, smartgps.get_token());
$$ LANGUAGE sql;

-- Posições ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION smartgps.sync_positions()
RETURNS INTEGER AS $$
DECLARE
  v_batch TEXT[];
  v_resp JSONB;
  v_pos JSONB;
  v_tracker vehicle_trackers;
  v_count INTEGER := 0;
BEGIN
  FOR v_batch IN
    SELECT array_agg(serial_number) FROM (
      SELECT serial_number, (row_number() OVER (ORDER BY serial_number) - 1) / 20 AS grp
      FROM vehicle_trackers WHERE provider = 'smartgps' AND active
    ) t GROUP BY grp
  LOOP
    v_resp := smartgps.api_get('/positions/realtime?imeis=' || array_to_string(v_batch, ','));
    FOR v_pos IN SELECT value FROM jsonb_each(v_resp) WHERE jsonb_typeof(value) = 'object' AND value ? 'lat'
    LOOP
      SELECT * INTO v_tracker FROM vehicle_trackers
       WHERE provider = 'smartgps' AND serial_number = v_pos->>'imei';
      CONTINUE WHEN NOT FOUND OR v_pos->>'dt' IS NULL;

      INSERT INTO vehicle_positions (tracker_id, vehicle_id, latitude, longitude, speed_kmh, ignition_on, recorded_at)
      SELECT v_tracker.id, v_tracker.vehicle_id, (v_pos->>'lat')::float8, (v_pos->>'lng')::float8,
             (v_pos->>'spd')::float8, (v_pos->>'ign')::boolean, to_timestamp((v_pos->>'dt')::bigint / 1000.0)
      WHERE NOT EXISTS (
        SELECT 1 FROM vehicle_positions
         WHERE tracker_id = v_tracker.id AND recorded_at = to_timestamp((v_pos->>'dt')::bigint / 1000.0));
      IF FOUND THEN v_count := v_count + 1; END IF;
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Eventos de cerca ----------------------------------------------------------------------
-- Janela [cursor - 5 min, agora]: a sobreposição cobre eventos gravados com atraso, e o
-- external_id único descarta o que já entrou.
CREATE OR REPLACE FUNCTION smartgps.sync_geofence_events()
RETURNS INTEGER AS $$
DECLARE
  v_from TIMESTAMPTZ := COALESCE((SELECT events_cursor FROM smartgps.config), now() - interval '1 hour')
                        - interval '5 minutes';
  v_to TIMESTAMPTZ := now();
  v_page INTEGER := 1;
  v_resp JSONB;
  v_ev JSONB;
  v_tracker vehicle_trackers;
  v_dir TEXT;
  v_count INTEGER := 0;
BEGIN
  LOOP
    v_resp := smartgps.api_get(format('/alerts/events?from=%s&to=%s&page=%s&pageSize=50',
      to_char(v_from AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      to_char(v_to AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), v_page));

    FOR v_ev IN SELECT value FROM jsonb_array_elements(COALESCE(v_resp->'events', '[]'::jsonb))
    LOOP
      CONTINUE WHEN v_ev->>'legacyType' NOT IN ('geofenceIn', 'geofenceOut', 'geofence');
      SELECT * INTO v_tracker FROM vehicle_trackers
       WHERE provider = 'smartgps' AND serial_number = v_ev->>'imei';
      CONTINUE WHEN NOT FOUND;

      v_dir := CASE v_ev->>'legacyType' WHEN 'geofenceIn' THEN 'entrada' WHEN 'geofenceOut' THEN 'saida' END;

      INSERT INTO alert_events (vehicle_id, rule_type, message, metadata, triggered_at, external_id)
      VALUES (
        v_tracker.vehicle_id,
        'geofence',
        CASE v_dir WHEN 'entrada' THEN 'Entrou na cerca' WHEN 'saida' THEN 'Saiu da cerca' ELSE 'Evento de cerca' END
          || COALESCE(' — ' || (v_ev->>'alertName'), ''),
        jsonb_build_object('source', 'smartgps', 'direction', v_dir, 'legacyType', v_ev->>'legacyType',
                           'alertId', v_ev->>'alertId', 'alertName', v_ev->>'alertName',
                           'imei', v_ev->>'imei', 'firedAt', v_ev->>'firedAt'),
        (v_ev->>'firedAt')::timestamptz,
        format('smartgps:%s:%s:%s', v_ev->>'alertId', v_ev->>'imei', v_ev->>'firedAt')
      )
      ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING;
      IF FOUND THEN v_count := v_count + 1; END IF;
    END LOOP;

    EXIT WHEN v_page >= COALESCE((v_resp->>'totalPages')::int, 0) OR v_page >= 20;
    v_page := v_page + 1;
  END LOOP;

  UPDATE smartgps.config SET events_cursor = v_to;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Orquestração (pg_cron, 1x/min) ---------------------------------------------------------
CREATE OR REPLACE FUNCTION smartgps.run_sync()
RETURNS JSONB AS $$
DECLARE
  v_positions INTEGER;
  v_events INTEGER;
  v_errors TEXT[] := '{}';
BEGIN
  IF NOT (SELECT enabled FROM smartgps.config) THEN
    RETURN jsonb_build_object('skipped', 'disabled');
  END IF;

  -- Cada parte isolada: falha em posições não impede eventos e vice-versa
  BEGIN
    v_positions := smartgps.sync_positions();
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('positions: ' || SQLERRM);
  END;
  BEGIN
    v_events := smartgps.sync_geofence_events();
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || ('events: ' || SQLERRM);
  END;

  UPDATE smartgps.config
     SET last_run_at = now(),
         last_error = NULLIF(array_to_string(v_errors, ' | '), '');
  RETURN jsonb_build_object('positions', v_positions, 'geofenceEvents', v_events, 'errors', v_errors);
END;
$$ LANGUAGE plpgsql;

-- Ativação / troca de credencial ---------------------------------------------------------
CREATE OR REPLACE FUNCTION smartgps.configure(p_mode TEXT, p_email TEXT DEFAULT NULL, p_password TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  IF p_mode = 'password' THEN
    IF p_email IS NULL OR p_password IS NULL THEN
      RAISE EXCEPTION 'modo password exige email e senha';
    END IF;
    DELETE FROM vault.secrets WHERE name = 'smartgps_password';
    PERFORM vault.create_secret(p_password, 'smartgps_password', 'Senha da conta SmartGPS (login da API)');
  END IF;
  UPDATE smartgps.config
     SET auth_mode = p_mode, email = p_email, enabled = true,
         id_token = NULL, token_expires_at = NULL, last_error = NULL;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON ALL TABLES IN SCHEMA smartgps FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA smartgps FROM PUBLIC;

SELECT cron.schedule('smartgps-sync', '* * * * *', 'SELECT smartgps.run_sync()');
