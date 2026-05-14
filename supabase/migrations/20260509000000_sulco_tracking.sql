-- Adiciona rastreamento de profundidade de sulco (desgaste) nos pneus

-- Colunas de sulco por vida + km desde última medição
ALTER TABLE pneus
  ADD COLUMN IF NOT EXISTS profundidade_sulco_1vida NUMERIC,
  ADD COLUMN IF NOT EXISTS profundidade_sulco_2vida NUMERIC,
  ADD COLUMN IF NOT EXISTS profundidade_sulco_3vida NUMERIC,
  ADD COLUMN IF NOT EXISTS km_no_ultimo_sulco NUMERIC NOT NULL DEFAULT 0;

-- Motivo de sucateamento e sulco no momento da movimentação
ALTER TABLE movimentacoes_pneus
  ADD COLUMN IF NOT EXISTS motivo_sucateamento TEXT,
  ADD COLUMN IF NOT EXISTS profundidade_sulco NUMERIC;

-- Atualiza constraint de tipo para incluir medicao_sulco
ALTER TABLE movimentacoes_pneus
  DROP CONSTRAINT IF EXISTS movimentacoes_pneus_tipo_check;

ALTER TABLE movimentacoes_pneus
  ADD CONSTRAINT movimentacoes_pneus_tipo_check
  CHECK (tipo IN (
    'entrada_estoque','montagem','desmontagem',
    'saida_conserto','retorno_conserto','sucata','medicao_sulco'
  ));
