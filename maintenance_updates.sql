-- Script SQL para atualizar as tabelas de manutenção no Supabase

-- 1. Alterações na tabela maintenance_requests
ALTER TABLE maintenance_requests ADD COLUMN budget_value NUMERIC(10, 2);
ALTER TABLE maintenance_requests ADD COLUMN document_url TEXT;
ALTER TABLE maintenance_requests ADD COLUMN service_request_number TEXT;
ALTER TABLE maintenance_requests ADD COLUMN material_request_number TEXT;

-- 2. Alterações na tabela maintenances
-- Adiciona a chave estrangeira para maintenance_requests
ALTER TABLE maintenances ADD COLUMN request_id UUID REFERENCES maintenance_requests(id);
-- Adiciona a coluna status com valores permitidos
ALTER TABLE maintenances ADD COLUMN status TEXT CHECK (status IN ('pendente', 'executada')) DEFAULT 'executada';

-- 3. Atualizar registros existentes (opcional)
UPDATE maintenances SET status = 'executada' WHERE status IS NULL;

-- 4. Instruções para Storage (Supabase Dashboard)
-- Você deve criar um bucket chamado 'maintenance_documents' no Supabase Storage.
-- Certifique-se de que as políticas de RLS permitam upload e leitura para usuários autenticados.
