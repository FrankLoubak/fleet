# DATABASE_SCHEMA — FleetManager

> Última atualização: 2026-09-22 (Rodada C — fechamento formal, ver seção "Rodada B/C")  
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
| cpf | TEXT | NULL | — | CPF do usuário (UNIQUE); usado para login por CPF em `Login.tsx` (migration `20260916000003_profiles_cpf_column.sql`) |
| created_at | TIMESTAMPTZ | NOT NULL | `NOW()` UTC | Data de criação |

#### RLS — profiles
- **SELECT:** `USING (true)` — todos os perfis são visíveis por qualquer usuário autenticado.
- **UPDATE:** `USING (auth.uid() = id)` — cada usuário pode atualizar apenas o próprio perfil.
- **INSERT / DELETE:** Não há policy explícita; ocorre via trigger do Supabase Auth.

#### Funções auxiliares (usadas em RLS de várias tabelas abaixo)
`is_admin_or_root()` e `is_root()` — `SECURITY DEFINER STABLE`, criadas em
`20260916000000_rls_hardening.sql` — evitam repetir `EXISTS (SELECT 1 FROM profiles WHERE
id = auth.uid() AND role IN (...))` em cada policy. Antes desta migration, várias policies
checavam só `role = 'Admin'`, deixando o papel `Root` bloqueado nas mesmas ações que um
Admin deveria poder fazer (achado corrigido na Rodada B).

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
| config_id | UUID | NULL | — | FK para `vehicle_configs(id)`, `ON DELETE SET NULL` (módulo de pneus, `20260508000000_modulo_pneus.sql` — fora do escopo desta atualização de doc) |
| vehicle_type | TEXT | NOT NULL | `'veiculo'` | `'veiculo'` ou `'maquina'` (CHECK); define se a jornada valida por odômetro ou horímetro |
| initial_odometer | INTEGER | NOT NULL | `0` | Odômetro no cadastro do veículo |
| current_odometer | INTEGER | NOT NULL | `0` | Odômetro atual, atualizado a cada jornada |
| initial_hourmeter | INTEGER | NOT NULL | `0` | Horímetro no cadastro (só relevante se `vehicle_type = 'maquina'`) |
| current_hourmeter | INTEGER | NOT NULL | `0` | Horímetro atual |

As 5 colunas `vehicle_type`.._`current_hourmeter` foram adicionadas em
`20260916000004_vehicles_missing_columns.sql` — eram usadas por `Vehicles.tsx`/
`DailyReport.tsx` desde sempre, mas nunca existiram em nenhuma migration tracked (só no
banco Supabase original, alterado manualmente). Bug pré-existente descoberto ao validar a
Rodada C, não uma feature nova desta rodada.

#### RLS — vehicles
- **SELECT:** `USING (true)` — visível por todos.
- **ALL (INSERT/UPDATE/DELETE):** `USING (is_admin_or_root())` — Admin ou Root gerenciam veículos.

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

## Rodada B / Rodada C — Telemetria, Motorista e Alertas

Tabelas abaixo criadas nas Rodadas B (telemetria mock) e C (identificação de motorista,
motor de alertas) — documentadas aqui pela primeira vez (pendência registrada nos
breakpoints anteriores). Ver `DEVELOPER_MANUAL.md` seção 12 para o módulo de relatórios
(C4), que só lê estas tabelas, não cria nenhuma nova.

### vehicle_trackers

1 rastreador por veículo. Hoje só existe o mock (`provider = 'mock'`) — não há hardware
nem credencial real instalada em nenhum veículo (ver `src/lib/telemetry/`).

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK |
| vehicle_id | UUID | NOT NULL | — | FK para `vehicles(id)`, CASCADE DELETE, UNIQUE (1 rastreador por veículo) |
| provider | TEXT | NOT NULL | `'mock'` | Fornecedor de rastreamento (`'mock'` até integração real) |
| serial_number | TEXT | NOT NULL | — | Identificador do fornecedor (ex.: IMEI); UNIQUE junto com `provider` |
| active | BOOLEAN | NOT NULL | `true` | Se o rastreador está em uso |
| created_at | TIMESTAMPTZ | NOT NULL | `now()` | Data de criação |

#### RLS — vehicle_trackers
- **SELECT:** `USING (true)` — leitura pública, mesmo padrão de `vehicles`.
- **INSERT/UPDATE/DELETE:** `is_admin_or_root()`.

### vehicle_positions

Histórico de posições. Sem PostGIS — lat/lng em `DOUBLE PRECISION` (decisão da Rodada C:
tela de histórico é tabular, sem mapa).

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK |
| tracker_id | UUID | NOT NULL | — | FK para `vehicle_trackers(id)`, CASCADE DELETE |
| vehicle_id | UUID | NOT NULL | — | FK para `vehicles(id)`, CASCADE DELETE |
| latitude / longitude | DOUBLE PRECISION | NOT NULL | — | Coordenadas |
| speed_kmh | DOUBLE PRECISION | NULL | — | Velocidade no momento do registro |
| ignition_on | BOOLEAN | NULL | — | Estado da ignição (adicionado em `20260916000005_alert_engine.sql` / C2); `NULL` quando o provedor não reporta |
| recorded_at | TIMESTAMPTZ | NOT NULL | — | Quando a posição foi capturada |
| created_at | TIMESTAMPTZ | NOT NULL | `now()` | Quando foi gravada no banco |

Índice `(vehicle_id, recorded_at DESC)` para a consulta paginada de histórico.

#### RLS — vehicle_positions
- **SELECT:** `USING (true)`. **INSERT/UPDATE/DELETE:** `is_admin_or_root()` — nenhum
  Operador escreve telemetria manualmente; uma integração real escreveria via
  `service_role` (ignora RLS), não por aqui.

### driver_pins

PIN de 4-6 dígitos para identificação do motorista antes de abrir jornada em tempo real
(TR Salgueiro/PE, item 5.6.1-b). Hash bcrypt via `pgcrypto`, sempre calculado/verificado no
servidor — nunca há comparação client-side nem leitura do hash pelo cliente.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| user_id | UUID | NOT NULL | — | PK; FK para `profiles(id)`, CASCADE DELETE |
| pin_hash | TEXT | NOT NULL | — | Hash bcrypt do PIN (`crypt(pin, gen_salt('bf'))`) |
| updated_at | TIMESTAMPTZ | NOT NULL | `now()` | Última troca de PIN |

#### RLS — driver_pins
- **SELECT/INSERT/UPDATE:** `auth.uid() = user_id` — **sem exceção para Admin/Root**: ninguém lê o hash de ninguém, nem o dono. A única forma de usar o PIN é via `verify_driver_pin()`, que nunca retorna o hash.

#### Funções RPC (`SECURITY INVOKER`, chamadas via `supabase.rpc(...)`)
- `set_driver_pin(new_pin TEXT)` — valida formato (`^[0-9]{4,6}$`) e grava o hash do próprio usuário autenticado.
- `verify_driver_pin(pin TEXT)` — retorna `boolean`; `false` (nunca erro) tanto para PIN errado quanto para PIN nunca cadastrado, de propósito, pra o app não precisar distinguir os dois casos no fluxo de bloqueio.
- `record_driver_checkin(p_journey_id UUID, pin TEXT)` — reverifica o PIN e, se válido, grava a linha em `driver_checkins`.

### driver_checkins

Registro de cada identificação bem-sucedida ao abrir uma jornada.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK |
| journey_id | UUID | NULL | — | FK para `journeys(id)`, CASCADE DELETE |
| driver_id | UUID | NOT NULL | — | FK para `profiles(id)` |
| method | TEXT | NOT NULL | `'pin'` | Método de identificação usado |
| verified_at | TIMESTAMPTZ | NOT NULL | `now()` | Quando foi verificado |
| raw_credential_hash | TEXT | NOT NULL | — | SHA-256 do PIN, só trilha de auditoria — a defesa real é o bcrypt de `driver_pins` |

#### RLS — driver_checkins
- **SELECT:** `auth.uid() = driver_id OR is_admin_or_root()`. **INSERT:** `auth.uid() = driver_id`.

### alert_rules

Configuração de limite de velocidade por veículo (1 linha por veículo). `NULL` em
`speed_limit_kmh` = alerta de velocidade desligado para aquele veículo. Sem diferenciação
por tipo de via (decisão da Rodada C).

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| vehicle_id | UUID | NOT NULL | — | PK; FK para `vehicles(id)`, CASCADE DELETE |
| speed_limit_kmh | INTEGER | NULL | — | Limite de velocidade configurado |
| active | BOOLEAN | NOT NULL | `true` | Se a regra está ativa |
| created_at | TIMESTAMPTZ | NOT NULL | `now()` | Data de criação |

#### RLS — alert_rules
- **SELECT:** `is_admin_or_root() OR` (o usuário já teve alguma jornada nesse veículo — não existe vínculo motorista↔veículo permanente no schema, só por jornada). **ALL (escrita):** `is_admin_or_root()`.

### alert_events

Alertas disparados pelo motor (`src/lib/alerts/`) — velocidade, ignição ou cerca eletrônica.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK |
| vehicle_id | UUID | NOT NULL | — | FK para `vehicles(id)`, CASCADE DELETE |
| rule_type | TEXT | NOT NULL | — | `'speeding'`, `'ignition'` ou `'geofence'` (CHECK) |
| message | TEXT | NOT NULL | — | Mensagem gerada pela regra que disparou |
| metadata | JSONB | NULL | — | Dados extras da regra (ex.: velocidade registrada) |
| triggered_at | TIMESTAMPTZ | NOT NULL | `now()` | Quando o alerta foi disparado |

#### RLS — alert_events
- **SELECT:** mesmo padrão de `alert_rules`. **INSERT:** `is_admin_or_root()` — a
  gravação parte do próprio motor de alertas rodando no cliente Admin/Root que está com o
  dashboard aberto (`runAlertRules()`), não de um Operador.

### geofences

Cerca circular (centro + raio) cadastrada pelo gestor. Mais simples que polígono; sem
conceito de "grupo de veículos" no schema atual (é só por veículo).

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID | NOT NULL | `gen_random_uuid()` | PK |
| vehicle_id | UUID | NOT NULL | — | FK para `vehicles(id)`, CASCADE DELETE |
| name | TEXT | NOT NULL | — | Nome da zona |
| center_lat / center_lng | DOUBLE PRECISION | NOT NULL | — | Centro da cerca |
| radius_meters | INTEGER | NOT NULL | — | Raio em metros |
| active | BOOLEAN | NOT NULL | `true` | Se a cerca está ativa |
| created_at | TIMESTAMPTZ | NOT NULL | `now()` | Data de criação |

#### RLS — geofences
- **SELECT:** mesmo padrão de `alert_rules`/`alert_events`. **ALL (escrita):** `is_admin_or_root()`.

**Pendência conhecida, não decidida aqui:** `GeofenceRule` (`src/lib/alerts/GeofenceRule.ts`)
é um stub que sempre retorna `{ triggered: false }` — o cálculo de ponto-dentro-do-círculo
usando `geofences` ainda não está implementado, bloqueado até acesso ao portal
`smartgps.com.br/docs` (formato do payload de webhook) ou decisão explícita por
point-in-polygon local.

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
| `20260916000000_rls_hardening.sql` | 2026-09-16 | Rodada B — funções `is_admin_or_root()`/`is_root()`; inclui `Root` em policies que só checavam `Admin`; hardening do módulo de pneus (leitura pública + escrita Admin/Root) |
| `20260916000001_telemetry_schema.sql` | 2026-09-16 | Rodada B — tabelas `vehicle_trackers`, `vehicle_positions` com RLS |
| `20260916000002_driver_identification.sql` | 2026-09-16 | Rodada C / C1 — tabelas `driver_pins`, `driver_checkins`; funções `set_driver_pin()`/`verify_driver_pin()`/`record_driver_checkin()` |
| `20260916000003_profiles_cpf_column.sql` | 2026-09-16 | Bug fix — coluna `profiles.cpf` (nunca existia), `handle_new_user()` atualizada |
| `20260916000004_vehicles_missing_columns.sql` | 2026-09-16 | Bug fix — `vehicles.vehicle_type`/`initial_odometer`/`current_odometer`/`initial_hourmeter`/`current_hourmeter` (nunca existiam) |
| `20260916000005_alert_engine.sql` | 2026-09-16 | Rodada C / C2 — tabelas `alert_rules`, `alert_events`, `geofences`; coluna `vehicle_positions.ignition_on` |

> Migrations do módulo de pneus (`20260508000000_modulo_pneus.sql`,
> `20260509000000_sulco_tracking.sql`) existem no repositório mas ainda não foram
> documentadas nesta tabela nem nas seções acima — gap pré-existente, anterior às Rodadas
> B/C, fora do escopo deste fechamento.
