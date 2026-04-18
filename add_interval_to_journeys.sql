-- Adicionar colunas de intervalo à tabela journeys
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS interval_ini TIME;
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS interval_fim TIME;

-- Comentário para documentação
COMMENT ON COLUMN journeys.interval_ini IS 'Horário de início do intervalo (HH:MM)';
COMMENT ON COLUMN journeys.interval_fim IS 'Horário de término do intervalo (HH:MM)';
