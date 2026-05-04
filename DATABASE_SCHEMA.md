# DATABASE_SCHEMA — FleetManager

> Última atualização: 2026-05-01  
> Gerado com base nas migrations em `supabase/migrations/`

---

## Tabelas

### profiles

Armazena os perfis de usuário vinculados ao Supabase Auth. Criado automaticamente via trigger `handle_new_user()` após cada novo registro em `auth.users`.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NOT NULL | — | PK; referencia `auth.users(id)`, CASCADE DELETE |
| name | TEXT | NOT NULL | — | Nome completo do usuário |
| email | TEXT | NOT NULL | — | E-mail do usuário |
| role | TEXT | NOT NULL | — | Papel: `'Root'`, `'Admin'` ou `'Operador'` (CHECK constraint) |
| avatar | TEXT | NULL | — | URL do avatar (opcional) |
| phone | TEXT | NULL | — | Telefone (opcional) |
| invited_by | UUID | NULL | — | FK para `profiles(id)`; UUID de quem enviou o convite |
| created_at | TIMESTAMPTZ | NOT NULL | `NOW()` UTC | Data de criação |

#### RLS — profiles
- **SELECT:** `USING (true)` — todos os perfis são visíveis por qualquer usuário autenticado.
- **UPDATE:** `USING (auth.uid() = id)` — cada usuário pode atualizar apenas o próprio perfil.
- **INSERT / DELETE:** Não há policy explícita; ocorre via trigger do Supabase Auth.

---

### vehicles

Armazena veículos e máquinas da frota.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK |
| plate | TEXT | NOT NULL | — | Placa do veículo (UNIQUE) |
| model | TEXT | NOT NULL | — | Modelo do veículo/máquina |
| prefix | TEXT | NOT NULL | — | Prefixo interno de identificação |
| last_odometer | INTEGER | NOT NULL | `0` | Último valor de odômetro registrado |
| created_at | TIMESTAMPTZ | NOT NULL | `NOW()` UTC | Data de criação |

#### RLS — vehicles
- **SELECT:** `USING (true)` — visível por todos.
- **ALL (INSERT/UPDATE/DELETE):** `USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin'))` — apenas Admins gerenciam veículos.

---

### journeys

Registra as jornadas (partes diárias) dos operadores com cada veículo.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK |
| user_id | UUID | NOT NULL | — | FK para `profiles(id)`, CASCADE DELETE |
| vehicle_id | UUID | NOT NULL | — | FK para `vehicles(id)`, CASCADE DELETE |
| start_time | TIMESTAMPTZ | NOT NULL | `NOW()` UTC | Início da jornada |
| end_time | TIMESTAMPTZ | NULL | — | Fim da jornada (nulo enquanto aberta) |
| start_odometer | INTEGER | NOT NULL | — | Odômetro/horímetro no início |
| end_odometer | INTEGER | NULL | — | Odômetro/horímetro no fim |
| distance_traveled | INTEGER | NULL | — | Distância percorrida calculada |
| status | TEXT | NOT NULL | `'aberta'` | Estado: `'aberta'` ou `'encerrada'` (CHECK) |
| observations | TEXT | NULL | — | Observações livres |
| validation_status | TEXT | NULL | `'validada'` | Estado de validação: `'pendente'` ou `'validada'` (CHECK) |
| validated_by | UUID | NULL | — | FK para `profiles(id)`; quem validou a jornada |
| created_at | TIMESTAMPTZ | NOT NULL | `NOW()` UTC | Data de criação |

#### RLS — journeys
- **SELECT:** `USING (true)` — visível por todos.
- **ALL:** `USING (auth.uid() = user_id)` — cada usuário gerencia suas próprias jornadas.

---

### refuelings

Registra os abastecimentos realizados nos veículos.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK |
| date | DATE | NOT NULL | `CURRENT_DATE` | Data do abastecimento |
| odometer | INTEGER | NOT NULL | — | Odômetro no momento do abastecimento |
| quantity | DECIMAL(10,2) | NOT NULL | — | Quantidade em litros |
| fuel_type | TEXT | NOT NULL | — | Tipo: `'Gasolina'`, `'Álcool'` ou `'Diesel'` (CHECK) |
| vehicle_id | UUID | NOT NULL | — | FK para `vehicles(id)`, CASCADE DELETE |
| location | TEXT | NULL | — | Local do abastecimento (opcional) |
| created_at | TIMESTAMPTZ | NOT NULL | `NOW()` UTC | Data de criação |

#### RLS — refuelings
- **SELECT:** `USING (true)` — visível por todos.
- **INSERT:** `WITH CHECK (true)` — qualquer usuário autenticado pode inserir.

---

### maintenances

Registra os serviços de manutenção executados nos veículos.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK |
| date | DATE | NOT NULL | `CURRENT_DATE` | Data da manutenção |
| type | TEXT | NOT NULL | — | Tipo: `'Mecanica'`, `'Eletrica'`, `'Acessórios'`, `'Borracharia'`, `'Ar de serviço'` (CHECK) |
| provider | TEXT | NOT NULL | — | Fornecedor/prestador do serviço |
| mileage | INTEGER | NOT NULL | — | Quilometragem/horímetro no momento |
| description | TEXT | NOT NULL | — | Descrição do serviço executado |
| vehicle_id | UUID | NOT NULL | — | FK para `vehicles(id)`, CASCADE DELETE |
| request_id | UUID | NULL | — | FK para `maintenance_requests(id)`; solicitação que originou este registro |
| status | TEXT | NULL | `'executada'` | Estado: `'pendente'` ou `'executada'` (CHECK) |
| created_at | TIMESTAMPTZ | NOT NULL | `NOW()` UTC | Data de criação |

#### RLS — maintenances
- **SELECT:** `USING (true)` — visível por todos.
- **INSERT:** `WITH CHECK (true)` — qualquer usuário autenticado pode inserir.

---

### maintenance_requests

Registra solicitações de manutenção iniciadas por operadores.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK |
| user_id | UUID | NOT NULL | — | FK para `profiles(id)`, CASCADE DELETE |
| vehicle_id | UUID | NOT NULL | — | FK para `vehicles(id)`, CASCADE DELETE |
| date | DATE | NOT NULL | `CURRENT_DATE` | Data da solicitação |
| odometer | INTEGER | NOT NULL | — | Odômetro/horímetro no momento |
| type | TEXT | NOT NULL | — | Tipo (mesmo CHECK de `maintenances`) |
| description | TEXT | NOT NULL | — | Descrição do problema |
| status | TEXT | NOT NULL | `'pendente'` | Estado: `'pendente'`, `'aprovada'`, `'rejeitada'` ou `'concluida'` (CHECK) |
| budget_value | NUMERIC(10,2) | NULL | — | Valor do orçamento aprovado |
| document_url | TEXT | NULL | — | URL do documento no Supabase Storage |
| service_request_number | TEXT | NULL | — | Número da requisição de serviço |
| material_request_number | TEXT | NULL | — | Número da requisição de material |
| created_at | TIMESTAMPTZ | NOT NULL | `NOW()` UTC | Data de criação |

#### RLS — maintenance_requests
- **SELECT:** `USING (true)` — visível por todos.
- **ALL:** `USING (auth.uid() = user_id)` — cada usuário gerencia suas próprias solicitações.
- **ALL (Admin):** `USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin'))` — Admins gerenciam todas as solicitações.

---

### banco_de_horas

Registra as horas extras adquiridas por operador a cada jornada encerrada.

> **Nota importante:** A coluna `horas_adquiridas` é do tipo `TEXT` no formato `"HH:MM"`. A migration v2 (`20260328000001`) substituiu o tipo original `DECIMAL(10,2)` por `TEXT` para melhorar a legibilidade e evitar erros de arredondamento de ponto flutuante em cálculos de tempo.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK |
| user_id | UUID | NOT NULL | — | FK para `profiles(id)`, CASCADE DELETE |
| journey_id | UUID | NOT NULL | — | FK para `journeys(id)`, CASCADE DELETE |
| horas_adquiridas | TEXT | NOT NULL | — | Horas extras no formato `"HH:MM"` |
| created_at | TIMESTAMPTZ | NOT NULL | `NOW()` UTC | Data de criação |

#### RLS — banco_de_horas
- **SELECT:** `USING (true)` — visível por todos.
- **ALL:** `USING (auth.uid() = user_id)` — cada usuário gerencia seu próprio banco de horas.
- **ALL (Admin):** `USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin'))` — Admins gerenciam todos os registros.

---

### invites

Registra tokens de convite gerados por Root ou Admin para novos usuários.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK |
| token | UUID | NOT NULL | `gen_random_uuid()` | Token único do convite (UNIQUE) |
| invited_by | UUID | NOT NULL | — | FK para `profiles(id)`; quem gerou o convite |
| role | TEXT | NOT NULL | — | Role atribuída ao convidado: `'Admin'` ou `'Operador'` (CHECK) |
| used | BOOLEAN | NOT NULL | `FALSE` | Se o convite já foi utilizado |
| used_by | UUID | NULL | — | FK para `profiles(id)`; UUID do usuário que usou o convite |
| created_at | TIMESTAMPTZ | NULL | `NOW()` | Data de criação |
| expires_at | TIMESTAMPTZ | NULL | `NOW() + 7 days` | Data de expiração (7 dias após criação) |

#### RLS — invites
- **INSERT:** `WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('Root', 'Admin')))` — apenas Root e Admin criam convites.
- **SELECT:** `USING (true)` — leitura pública (necessário para validação do token no fluxo de cadastro).
- **UPDATE:** `USING (true)` — atualização pelo sistema ao marcar convite como utilizado.

---

## Regras de Negócio

As regras abaixo governam a criação e encerramento de jornadas. A coluna "Implementação" indica onde a regra é verificada; "Ausente no banco" significa que não há constraint SQL correspondente — a proteção é feita somente no frontend.

| Regra | Implementação | Arquivo / Local |
|-------|--------------|-----------------|
| `start_odometer` >= `current_odometer` (ou `current_hourmeter`) do veículo | **Frontend** (pré-submit) + **Frontend** (pós-API) | `src/pages/DailyReport.tsx` — `handleStartJourney` |
| `end_odometer` > `start_odometer` | **Frontend** (pré-submit) | `src/pages/DailyReport.tsx` — `handleEndJourney`, `handleEndPreviousJourney` |
| `end_odometer` >= KM do último abastecimento da jornada | **Frontend** (pré-submit, consulta refuelings) | `src/pages/DailyReport.tsx` — `handleEndJourney` |
| `end_odometer` >= KM da última manutenção da jornada | **Frontend** (pré-submit, consulta maintenances) | `src/pages/DailyReport.tsx` — `handleEndJourney` |
| Apenas 1 jornada aberta por motorista | **Frontend** (consulta journeys por user_id) | `src/pages/DailyReport.tsx` — `handleStartJourney` (bloco 01) |
| Apenas 1 jornada aberta por veículo | **Frontend** (consulta journeys por vehicle_id) | `src/pages/DailyReport.tsx` — `handleStartJourney` (bloco 01.2) |
| Atualização de `current_odometer`/`current_hourmeter` ao iniciar jornada | **Frontend** (UPDATE vehicles após INSERT journey) | `src/pages/DailyReport.tsx` — `handleStartJourney` |
| Atualização de `current_odometer`/`current_hourmeter` ao encerrar jornada | **Frontend** (UPDATE vehicles após UPDATE journey) | `src/pages/DailyReport.tsx` — `handleEndJourney`, `handleEndPreviousJourney` |
| Máquina (`vehicle_type = 'maquina'`) usa `current_hourmeter` em vez de `current_odometer` | **Frontend** (ramificação por `vehicle_type`) | `src/pages/DailyReport.tsx` — todos os handlers; `src/pages/Journeys.tsx` — `handleSaveJourney` |
| Mensagens de erro diferenciadas PT-BR (odômetro vs horímetro) | **Frontend** | `src/pages/DailyReport.tsx` — modais de erro; `src/pages/Journeys.tsx` — modal de erro Admin |
| Jornadas > 8 h requerem validação do gestor (`validation_status = 'pendente'`) | **Frontend** (cálculo de duração + UPDATE) | `src/pages/DailyReport.tsx` — `handleEndJourney` |
| Admin pode validar jornada pendente (crédita banco de horas) | **Frontend** | `src/pages/Journeys.tsx` — `handleValidateJourney` |

> **Nota:** Nenhuma das regras acima possui constraint SQL equivalente no banco de dados (a migration inicial não inclui CHECK de odômetro). Recomenda-se adicionar constraints no Supabase para garantia de integridade mesmo em acessos diretos à API.

---

## Migrations

| Arquivo | Data | Descrição |
|---------|------|-----------|
| `20240309000000_initial_schema.sql` | 2024-03-09 | Schema inicial: tabelas `profiles`, `vehicles`, `journeys`, `refuelings`, `maintenances`; RLS e trigger `handle_new_user()` |
| `20240309000001_maintenance_requests.sql` | 2024-03-09 | Tabela `maintenance_requests` com RLS |
| `20260328000000_banco_de_horas.sql` | 2026-03-28 | Tabela `banco_de_horas` com `horas_adquiridas DECIMAL(10,2)` |
| `20260328000001_banco_de_horas_v2.sql` | 2026-03-28 | Recria `banco_de_horas` com `horas_adquiridas TEXT` ("HH:MM"); adiciona `validation_status` e `validated_by` em `journeys` |
| `20260401000000_maintenance_updates.sql` | 2026-04-01 | Colunas extras em `maintenance_requests` (budget, documento, números de requisição) e `maintenances` (status, request_id) |
| `20260402000000_invite_system.sql` | 2026-04-02 | Campo `invited_by` em `profiles`; atualização do CHECK de `role` para `Root/Admin/Operador`; tabela `invites` com RLS |
