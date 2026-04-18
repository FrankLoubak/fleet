-- Adicionar coluna tipo_transp na tabela journeys
ALTER TABLE journeys 
ADD COLUMN IF NOT EXISTS tipo_transp TEXT;

-- Comentário para documentação
COMMENT ON COLUMN journeys.tipo_transp IS 'Tipo de transporte realizado (Colaboradores, CBUQ, Solo, etc)';
