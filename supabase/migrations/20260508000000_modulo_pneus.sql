-- Tabela TB01: configurações de eixos por tipo de veículo
CREATE TABLE vehicle_configs (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT    NOT NULL,
  eixo_1        INTEGER NOT NULL CHECK (eixo_1 >= 2 AND eixo_1 % 2 = 0),
  eixo_2        INTEGER          CHECK (eixo_2 IS NULL OR (eixo_2 >= 2 AND eixo_2 % 2 = 0)),
  eixo_3        INTEGER          CHECK (eixo_3 IS NULL OR (eixo_3 >= 2 AND eixo_3 % 2 = 0)),
  eixo_4        INTEGER          CHECK (eixo_4 IS NULL OR (eixo_4 >= 2 AND eixo_4 % 2 = 0)),
  pneus_reserva INTEGER NOT NULL DEFAULT 0 CHECK (pneus_reserva >= 0),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Adiciona FK de configuração na tabela de veículos
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS config_id UUID REFERENCES vehicle_configs(id) ON DELETE SET NULL;

-- Tabela TB02: pneus
CREATE TABLE pneus (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_fogo     TEXT    UNIQUE NOT NULL,
  marca           TEXT    NOT NULL,
  medida          TEXT    NOT NULL,
  data_compra     DATE    NOT NULL,
  data_1_reforma  DATE,
  data_2_reforma  DATE,
  km_total        NUMERIC NOT NULL DEFAULT 0,
  status          TEXT    NOT NULL DEFAULT 'estoque'
                    CHECK (status IN ('estoque','montado','conserto','sucata')),
  vehicle_id      UUID    REFERENCES vehicles(id) ON DELETE SET NULL,
  posicao         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela TB03: histórico de movimentações de pneus
CREATE TABLE movimentacoes_pneus (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  pneu_id          UUID    NOT NULL REFERENCES pneus(id) ON DELETE CASCADE,
  tipo             TEXT    NOT NULL
                     CHECK (tipo IN (
                       'entrada_estoque','montagem','desmontagem',
                       'saida_conserto','retorno_conserto','sucata'
                     )),
  vehicle_id       UUID    REFERENCES vehicles(id) ON DELETE SET NULL,
  posicao_anterior TEXT,
  posicao_nova     TEXT,
  data             DATE    NOT NULL DEFAULT CURRENT_DATE,
  km_total_pneu    NUMERIC,
  houve_recape     BOOLEAN NOT NULL DEFAULT FALSE,
  observacao       TEXT,
  user_id          UUID    REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX idx_pneus_vehicle_id  ON pneus(vehicle_id);
CREATE INDEX idx_pneus_status      ON pneus(status);
CREATE INDEX idx_mov_pneu_id       ON movimentacoes_pneus(pneu_id);
CREATE INDEX idx_mov_vehicle_id    ON movimentacoes_pneus(vehicle_id);

-- RLS
ALTER TABLE vehicle_configs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pneus                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_pneus   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vc_all"    ON vehicle_configs      FOR ALL USING (true);
CREATE POLICY "pneu_all"  ON pneus                FOR ALL USING (true);
CREATE POLICY "mov_all"   ON movimentacoes_pneus  FOR ALL USING (true);
