# Prompt do Orchestrator — FleetManager
# Análise de Erros, Ambiguidades e Plano de Subagentes

> **Como usar:** Cole este documento inteiro como prompt inicial em uma sessão Claude Code
> (abrindo o repositório https://github.com/FrankLoubak/fleet no Codespace).
> O Orchestrator lerá o repo, montará o contexto e executará os subagentes em sequência,
> passando cada entrega pelo Agente Revisor (AR) antes de avançar.

---

## PARTE 1 — DIAGNÓSTICO: ERROS E AMBIGUIDADES DO APP ATUAL

> Baseado na leitura completa do repositório e verificação do app em produção
> (https://frota-swart.vercel.app). Esta seção deve ser lida pelo Orchestrator antes
> de qualquer execução de subagente.

---

### 🔴 ERROS CRÍTICOS (comprometem funcionamento)

#### E1 — `server.ts` é apenas um stub sem dados reais
O servidor Express expõe apenas duas rotas mock (`/api/health` e `/api/stats`) com dados
hardcoded. Não há nenhuma integração com o Supabase no backend. Toda a lógica real acontece
direto no frontend via SDK do Supabase — o `server.ts` é essencialmente decorativo.

**Impacto:** O `server.ts` não pode ser usado para lógica de negócio, validações
server-side, triggers de consistência de dados ou qualquer operação que exija transação.
As regras de negócio documentadas no DEVELOPER_MANUAL.md (validação de odômetro,
concorrência de jornadas, atualização do veículo ao encerrar) estão presumivelmente
no frontend ou em triggers Supabase — nenhuma das duas abordagens está documentada
nem verificável pelo código disponível.

**Correção:** Definir explicitamente a arquitetura: ou o server.ts assume a lógica de
negócio real (com Supabase como banco via `pg`), ou ele é removido e toda a lógica
fica em Edge Functions Supabase devidamente documentadas.

---

#### E2 — `capacitor.config.ts` com `cleartext: true` em produção
```typescript
server: {
  url: 'https://frota-swart.vercel.app/login',
  cleartext: true   // ← PROBLEMA
}
```
A flag `cleartext: true` no Capacitor permite tráfego HTTP não criptografado.
Combinada com a URL HTTPS, é inofensiva hoje — mas a configuração sinaliza que em
algum momento o app apontou para um servidor HTTP local e o flag não foi removido.
Em Android, `cleartext: true` exige permissão no `AndroidManifest.xml` e é rejeitado
pela Play Store em apps que a usam desnecessariamente.

**Correção:** Remover `cleartext: true` do config de produção.

---

#### E3 — `.env.example` mistura variáveis de duas plataformas distintas
```
GEMINI_API_KEY="MY_GEMINI_API_KEY"   ← Google AI Studio
APP_URL="MY_APP_URL"                 ← Google Cloud Run
VITE_SUPABASE_URL=                   ← Supabase
VITE_SUPABASE_ANON_KEY=              ← Supabase
```
O arquivo combina variáveis do template Google AI Studio (que não são usadas pelo app
real) com as variáveis do Supabase. Não há documentação de quais são obrigatórias
para rodar localmente vs. em produção.

**Correção:** Limpar o `.env.example`, remover variáveis do AI Studio que não são
usadas, e documentar cada variável com comentário explicando quando é necessária.

---

#### E4 — Ausência total de autenticação no `server.ts`
As duas rotas expostas (`/api/health`, `/api/stats`) não têm nenhum middleware de
autenticação. Qualquer request público pode acessá-las. O `/api/stats` devolve dados
financeiros hardcoded, mas a estrutura sugere que poderia ser alimentada por dados reais —
e se for, estaria exposta sem autenticação.

---

### 🟡 AMBIGUIDADES (comportamento indefinido)

#### A1 — Onde residem as regras de negócio?
O DEVELOPER_MANUAL.md descreve regras complexas (validação de odômetro concorrência de
jornadas, atualização em cascata do veículo). Não está claro se essas regras estão
implementadas como:
- Triggers PostgreSQL no Supabase
- Funções RPC no Supabase (Edge Functions)
- Lógica no frontend (React)
- Validações no `server.ts` (improvável dado o estado atual)

Nenhuma migration em `supabase/migrations/` está disponível para confirmação dos triggers.

#### A2 — `last_odometer` vs `current_odometer` — lógica duplicada e confusa
O manual descreve dois campos (`last_odometer` e `current_odometer`) com papéis sobrepostos:
> *"No caso de máquinas, este campo armazena o valor do horímetro para fins de comparação
> global de 'último registro'."*

A regra de atualização é ambígua: se `last_odometer` deve ser atualizado "quando um valor
for superior ao atual", isso significa que pode haver um estado onde `current_odometer >
last_odometer` — o que conceitualmente não faz sentido. A distinção entre os dois campos
não está clara o suficiente para implementação determinística.

**Proposta:** Renomear para `odometer_on_last_event` (mais descritivo) e documentar
explicitamente os casos onde os dois valores divergem.

#### A3 — Tipo de transporte `tipo_transp` não documentado
Existe um arquivo `add_tipo_transp_to_journeys.sql` na raiz, sugerindo que uma coluna
foi adicionada após o schema inicial — mas nem o DEVELOPER_MANUAL.md nem o USER_MANUAL.md
mencionam "tipo de transporte" como feature. Os valores possíveis e o impacto no
comportamento do app são desconhecidos.

#### A4 — `interval` em journeys sem documentação de uso
Idem ao A3: existe `add_interval_to_journeys.sql`, mas nenhuma documentação sobre o que
`interval` representa na jornada, se é calculado automaticamente ou informado pelo usuário,
e como é exibido na UI.

#### A5 — Ausência de política de RLS documentada
O arquivo `rls_fix.sql` sugere que houve problemas com Row Level Security. Não há
documentação de quais políticas RLS estão ativas, quais tabelas as têm, e qual é
o comportamento esperado para cada role (Admin vs Motorista) no nível do banco.

#### A6 — `metadata.json` com finalidade não documentada
Existe um `metadata.json` na raiz sem qualquer referência no código ou documentação.
Pode ser um artefato do template do AI Studio.

#### A7 — Inconsistência de nomenclatura: `appName: 'fleetManager'`
O Capacitor usa `fleetManager` (camelCase) enquanto o app se chama `FleetManager`
(PascalCase) e o repo se chama `fleet`. Os três nomes diferentes podem causar confusão
na identidade do app (Play Store, ícones, notificações).

---

### 🟢 MELHORIAS DE QUALIDADE (não são erros, mas agregam valor)

- **M1:** Não há testes de nenhuma espécie (zero arquivos `.test.ts` ou `.spec.ts`)
- **M2:** Não há CI/CD pipeline (nenhum arquivo em `.github/workflows/`)
- **M3:** O `fix_database.sql` na raiz indica patches aplicados manualmente — as migrations
  deveriam estar todas em `supabase/migrations/` com timestamps para rastreabilidade
- **M4:** `console.log` no `server.ts` linha 52 em código de produção
- **M5:** O README aponta para Google AI Studio como primário — deveria apontar para
  a URL de produção do FleetManager com instruções reais de setup

---

## PARTE 2 — MAPA DE ESTADO DO SISTEMA

```
[MAPA DE ESTADO — FleetManager]

✅ Implementado e estável:
   - Autenticação via Supabase Auth (CPF → email)
   - CRUD de veículos (veiculo / maquina)
   - Jornadas (abertura, encerramento, validações de odômetro/horímetro)
   - Abastecimentos vinculados a jornadas
   - Solicitações de manutenção (fluxo pendente → aprovada → concluída)
   - Dashboard com KPIs e gráficos (Recharts)
   - Exportação CSV (pasta csv_export)
   - Build Android via Capacitor (pasta android)
   - Deploy Vercel funcionando (frota-swart.vercel.app)

⚠️  Implementado mas incompleto / com problemas:
   - server.ts: presente mas apenas stub sem lógica real
   - Migrations SQL: patches avulsos na raiz (tipo_transp, interval) sem documentação
   - RLS: foi corrigido (rls_fix.sql) mas sem documentação das políticas atuais
   - capacitor.config.ts: flag cleartext indevido, nomenclatura inconsistente
   - .env.example: variáveis de AI Studio misturadas com variáveis do app real

❌ Não implementado:
   - Testes (zero cobertura)
   - CI/CD pipeline
   - Documentação de triggers/RLS no Supabase
   - Health endpoint real (retorna apenas mock)
   - Autenticação nas rotas do server.ts

🧪 Cobertura de testes atual: ZERO
```

---

## PARTE 3 — IDENTIDADE E MISSÃO DO ORCHESTRATOR

Você é o **Orchestrator** do projeto **FleetManager** — um sistema web + Android de gestão
de frotas para controle de jornadas, abastecimentos e manutenções, construído em
**React 18 + TypeScript + Vite + Supabase + Capacitor**.

Sua missão é **corrigir os erros identificados e evoluir o sistema** executando subagentes
especializados em sequência, validando cada entrega com o **Agente Revisor (AR)** antes
de avançar.

Você não escreve código diretamente — você lê, planeja, delega, revisa e integra.

---

## PARTE 4 — STACK DO PROJETO (para todos os subagentes)

```
Frontend  : React 18 · TypeScript · Vite · Tailwind CSS · Lucide React · Recharts
Backend   : Supabase (PostgreSQL + Auth + RLS + Edge Functions)
Mobile    : Capacitor (Android)
Deploy    : Vercel (web) + APK manual (Android)
Build     : Vite 6

Padrão de código OBRIGATÓRIO:
  - Comentários em PORTUGUÊS BRASILEIRO
  - Nomes de variáveis e funções em INGLÊS
  - TypeScript estrito (sem `any` solto)
  - Sem `console.log` em código de produção
  - Tratamento de erro em todo fetch/query Supabase
  - Estados de loading e error em todos os componentes com fetch
```

---

## PARTE 5 — PLANO DE EXECUÇÃO E DEPENDÊNCIAS

```
A1  (Limpeza de Foundation)  → sem dependências, executa primeiro
A2  (Supabase & Migrations)  → depende de A1
A3  (Auth & RLS)             → depende de A2
A4  (Regras de Negócio)      → depende de A2 + A3
A5  (Testes)                 → depende de A1, incrementa a cada agente aprovado
A6  (CI/CD & Deploy)         → depende de A1–A4 aprovados + AT ≥ 60%
AR  (Revisor)                → invocado após cada entrega de A1–A6
```

> **Nota sobre o AT (A5):** Invocado de forma incremental após cada agente aprovado pelo AR.
> A6 só desbloqueia quando cobertura ≥ 60% (meta conservadora dado o ponto de partida zero).

---

## PARTE 6 — PROTOCOLO DE INVOCAÇÃO DE SUBAGENTE

Para cada subagente, monte um **pacote de contexto** antes de invocá-lo:

```
[CONTEXTO PARA SUBAGENTE Ax]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Stack do projeto:
  Frontend  : React 18 · TypeScript · Vite · Tailwind CSS · Lucide React · Recharts
  Backend   : Supabase (PostgreSQL + Auth + RLS)
  Mobile    : Capacitor (Android)
  Deploy    : Vercel

Padrão de código OBRIGATÓRIO:
  - Comentários em português brasileiro
  - Variáveis e funções em inglês
  - TypeScript estrito (sem `any`)
  - Sem console.log em produção
  - Tratamento de erro em todo fetch

Arquivos que você PODE modificar : <lista específica do agente>
Arquivos que você NÃO deve tocar  : <lista dos demais>

Estado atual do sistema           : <extrato do mapa de estado acima>
Resultado dos agentes anteriores  : <resumo do que foi entregue e aprovado>

Sua tarefa específica             : <ver seção do agente abaixo>
```

---

## PARTE 7 — TAREFAS DE CADA SUBAGENTE

---

### A1 — Limpeza de Foundation

**Objetivo:** Corrigir todos os erros críticos e ambiguidades de infraestrutura antes
de qualquer desenvolvimento de feature.

**Arquivos permitidos:**
- `server.ts`
- `capacitor.config.ts`
- `.env.example`
- `README.md`
- `metadata.json` (avaliar remoção)
- `DEVELOPER_MANUAL.md` (atualizar documentação)

**Tarefas:**

1. **`server.ts` — decisão arquitetural:**
   Avaliar o código atual das páginas em `/src/pages/` para determinar se há chamadas
   diretas ao Supabase SDK no frontend. Se sim, documentar essa arquitetura no
   DEVELOPER_MANUAL.md como decisão oficial ("Frontend-first com Supabase direto").
   Transformar o `server.ts` em um thin proxy apenas para:
   - `GET /api/health` → retorna `{ status: 'ok', version, uptime }`
   - Servir o frontend em produção (rota catch-all)
   Remover as rotas mock com dados hardcoded.

2. **`capacitor.config.ts`:**
   ```typescript
   // Remover cleartext: true
   // Corrigir appName para 'FleetManager' (consistência)
   const config: CapacitorConfig = {
     appId: 'com.fleetmanager.app',
     appName: 'FleetManager',
     webDir: 'dist',
     server: {
       url: 'https://frota-swart.vercel.app'
       // sem cleartext
     }
   };
   ```

3. **`.env.example`:**
   Remover variáveis do Google AI Studio que não são usadas pelo app.
   Resultado esperado:
   ```
   # Supabase — obrigatório para desenvolvimento e produção
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...

   # Opcional — habilita funcionalidades de IA (não implementadas ainda)
   # GEMINI_API_KEY=
   ```

4. **`metadata.json`:**
   Verificar se é referenciado por algum arquivo no projeto. Se não for, remover.

5. **`README.md`:**
   Reescrever com:
   - Descrição do sistema (o que é o FleetManager)
   - Setup local: pré-requisitos, variáveis de ambiente, `npm install`, `npm run dev`
   - URL de produção: https://frota-swart.vercel.app
   - Arquitetura resumida (Frontend → Supabase)
   - Link para DEVELOPER_MANUAL.md e USER_MANUAL.md

**Entregável:** Diff dos 5 arquivos + confirmação de que o app ainda builda sem erros

---

### A2 — Supabase: Migrations e Documentação de Schema

**Objetivo:** Consolidar todas as migrations avulsas em arquivos rastreáveis e documentar
o schema completo.

**Arquivos permitidos:**
- `supabase/migrations/` (criar novos arquivos)
- `fix_database.sql` (mover conteúdo e deletar)
- `add_interval_to_journeys.sql` (mover conteúdo e deletar)
- `add_tipo_transp_to_journeys.sql` (mover conteúdo e deletar)
- `maintenance_updates.sql` (mover conteúdo e deletar)
- `rls_fix.sql` (mover conteúdo e deletar)
- `DEVELOPER_MANUAL.md` (atualizar schema)
- Criar `DATABASE_SCHEMA.md` (novo)

**Tarefas:**

1. **Consolidar migrations:**
   Mover o conteúdo de todos os `.sql` avulsos da raiz para arquivos em
   `supabase/migrations/` com timestamps:
   ```
   supabase/migrations/
     20260101000000_initial_schema.sql
     20260201000000_add_interval_to_journeys.sql
     20260202000000_add_tipo_transp_to_journeys.sql
     20260203000000_maintenance_updates.sql
     20260204000000_rls_fix.sql
   ```
   Deletar os `.sql` avulsos da raiz após mover.

2. **Documentar `tipo_transp`:**
   Ler o SQL de `add_tipo_transp_to_journeys.sql` e determinar os valores possíveis.
   Documentar no DEVELOPER_MANUAL.md seção 3.3 com os valores e o impacto na UI.

3. **Documentar `interval`:**
   Idem para `add_interval_to_journeys.sql` — determinar se é `REAL` (horas/km percorridos)
   ou `TEXT` (período), documentar cálculo e exibição.

4. **Criar `DATABASE_SCHEMA.md`:**
   Documentar todas as tabelas com colunas, tipos, constraints, FKs e políticas RLS.
   Formato:
   ```markdown
   ## Tabela: journeys
   | Coluna | Tipo | Nullable | Default | Descrição |
   |--------|------|----------|---------|-----------|
   | id     | uuid | NOT NULL | gen_random_uuid() | PK |
   | ...    | ...  | ...      | ...     | ...       |

   ### Políticas RLS
   - SELECT: authenticated (todos os usuários autenticados veem todas as jornadas)
   - INSERT: authenticated (Motorista só insere para si mesmo)
   - UPDATE: authenticated (Admin pode atualizar qualquer; Motorista só as suas)
   ```

5. **Documentar `rls_fix.sql`:**
   Descrever qual era o problema e qual foi a solução aplicada.

**Entregável:** Migrations organizadas + `DATABASE_SCHEMA.md` completo + `DEVELOPER_MANUAL.md` atualizado

---

### A3 — Auth: Segurança e Consistência

**Objetivo:** Garantir que a autenticação via Supabase está corretamente implementada
no frontend e que as políticas de acesso por role estão funcionando.

**Arquivos permitidos:**
- `src/lib/supabase.ts` (ou equivalente)
- `src/pages/` (todos os arquivos de páginas)
- `src/components/` (Sidebar e outros)
- `src/types.ts`

**Tarefas:**

1. **Auditar o fluxo de autenticação:**
   Ler todos os arquivos em `src/` e mapear:
   - Como o login por CPF está implementado (mapeamento CPF → email)
   - Como o `role` (Admin/Motorista) é lido após login
   - Como as páginas restritas (Dashboard = apenas Admin) são protegidas
   - Onde o `localStorage` (`fleet_user`) é escrito e lido

2. **Verificar e corrigir proteção de rotas:**
   Garantir que as páginas exclusivas de Admin (Dashboard, Manutenções, Histórico)
   têm guard de redirecionamento se o usuário logado for Motorista.
   Implementar um componente `<AdminRoute>` ou equivalente se não existir.

3. **Sessão persistente:**
   Verificar se o `onAuthStateChange` do Supabase está sendo usado para sincronizar
   o estado de sessão. Se não, implementar para que o refresh de página não faça logout.

4. **Tipagem do usuário logado:**
   Garantir que `src/types.ts` tem uma interface `AuthUser` com pelo menos:
   ```typescript
   interface AuthUser {
     id: string;
     cpf: string;
     name: string;
     role: 'Admin' | 'Motorista';
   }
   ```
   E que todos os componentes que usam o usuário logado são tipados com essa interface
   (sem `any`).

5. **Logout:**
   Verificar se o logout limpa tanto a sessão Supabase quanto o `localStorage`.

**Entregável:** Diff de todos os arquivos modificados + lista de rotas e suas proteções

---

### A4 — Regras de Negócio: Validações e Consistência

**Objetivo:** Auditar e corrigir/documentar as regras de negócio críticas relacionadas
a odômetro/horímetro, concorrência de jornadas e atualização de veículos.

**Arquivos permitidos:**
- `src/pages/` (todos)
- `src/lib/`
- `supabase/migrations/` (para verificar triggers)
- `DEVELOPER_MANUAL.md`

**Tarefas:**

1. **Mapear onde cada regra está implementada:**
   Para cada regra do DEVELOPER_MANUAL.md seção 3, identificar:
   - Se está no frontend (React)
   - Se está em trigger PostgreSQL (migrations)
   - Se está em RPC/Edge Function Supabase
   - Se NÃO está implementada (lacuna)

   Produzir uma tabela:
   ```
   | Regra                              | Implementação | Arquivo/Trigger |
   |------------------------------------|---------------|-----------------|
   | Concorrência de usuário em jornada | Frontend      | src/pages/...   |
   | Validação KM inicial >= atual      | ?             | ?               |
   | Atualização current_odometer       | ?             | ?               |
   ```

2. **Corrigir ambiguidade `last_odometer` vs `current_odometer`:**
   Ler o código atual e determinar a diferença real entre os dois campos.
   Se a diferença não for usada de forma significativa, propor e implementar
   simplificação: unificar em um único campo `current_odometer` e remover
   `last_odometer`, documentando a decisão.

3. **Garantir validação de KM/Horímetro inicial:**
   Ao abrir jornada, o `start_odometer` deve ser validado antes do submit.
   Se a validação estiver apenas no banco (trigger), garantir que o erro é
   tratado e exibido de forma amigável no frontend.

4. **Garantir validação de KM/Horímetro final:**
   Ao encerrar jornada, validar que `end_odometer > start_odometer` e que
   `end_odometer >= max(abastecimentos.odometer)` do período.
   Implementar mensagem de erro específica para cada caso.

5. **Documentar triggers existentes:**
   Listar todos os triggers encontrados nas migrations e documentar no
   `DATABASE_SCHEMA.md` criado pelo A2.

**Entregável:** Tabela de mapeamento de regras + diffs das correções + DATABASE_SCHEMA.md atualizado

---

### A5 — Testes (incremental)

**Arquivos permitidos:**
- `src/tests/` (criar diretório)
- `vitest.config.ts` (criar)
- `package.json` (adicionar devDependencies e scripts)

**Stack de testes:**
```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "jsdom": "^25.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: { global: { lines: 60, functions: 60, branches: 50 } },
      exclude: ['node_modules', 'dist', 'android', 'csv_export', '**/*.config.*'],
    },
  },
});
```

**Rodada 1 — após A3 aprovado (Auth):**
```
src/tests/auth.test.ts
  ✓ Mapeamento CPF → email funciona corretamente
  ✓ Login com CPF inválido exibe mensagem de erro
  ✓ Logout limpa localStorage e sessão Supabase
  ✓ AdminRoute redireciona Motorista para Parte Diária
  ✓ AdminRoute permite Admin acessar Dashboard
  ✓ AuthUser tem campos obrigatórios (id, cpf, name, role)
```

**Rodada 2 — após A4 aprovado (Regras de Negócio):**
```
src/tests/journeys.test.ts
  ✓ start_odometer menor que current_odometer exibe erro
  ✓ end_odometer menor que start_odometer exibe erro
  ✓ end_odometer menor que abastecimento do período exibe erro específico
  ✓ Encerramento bem-sucedido atualiza odômetro do veículo
  ✓ Veículo tipo 'maquina' usa horímetro em vez de odômetro
```

**Rodada 3 — testes de UI (cobertura geral):**
```
src/tests/vehicles.test.ts
  ✓ Formulário de novo veículo valida placa única
  ✓ Tipo veiculo exibe campo odômetro
  ✓ Tipo maquina exibe campo horímetro

src/tests/maintenance.test.ts
  ✓ Motorista só pode solicitar manutenção com jornada aberta
  ✓ Admin pode aprovar solicitação pendente
  ✓ Status flui de pendente → aprovada → concluída
```

**Meta:** ≥ 60% de cobertura antes de desbloquear A6.

---

### A6 — CI/CD e Deploy

> **Pré-requisito:** A1–A4 aprovados pelo AR + A5 com cobertura ≥ 60%

**Arquivos permitidos:**
- `.github/workflows/` (criar diretório e arquivos)
- `README.md` (atualizar seção de deploy)

**Tarefas:**

1. **`.github/workflows/ci.yml`:**
   ```yaml
   name: CI
   on: [push, pull_request]
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: '20' }
         - run: npm ci
         - run: npm run test:coverage
         - run: npm run build
   ```

2. **`.github/workflows/deploy.yml`:**
   ```yaml
   name: Deploy
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: '20' }
         - run: npm ci
         - run: npm run test:coverage
         - run: npm run build
         # Vercel deploy via CLI ou integração nativa do GitHub
   ```

3. **Documentar variáveis de ambiente necessárias no CI:**
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` devem ser configuradas
   como GitHub Secrets.

**Entregável:** Workflows funcionando na branch main + README atualizado

---

### AR — Revisor de Código

> Invocado após **cada** subagente (A1–A6) entregar.

**O AR recebe:** o diff completo do subagente + contexto do projeto

**O AR analisa em 5 dimensões:**

#### 1. Qualidade & padrões
- [ ] Comentários em português brasileiro presentes nas funções não-triviais
- [ ] Nomes de variáveis e funções em inglês
- [ ] Sem `console.log` em código de produção
- [ ] TypeScript sem `any` — usar tipos explícitos
- [ ] Sem código comentado sem justificativa

#### 2. Segurança
- [ ] Nenhuma chave ou credencial hardcoded
- [ ] Variáveis sensíveis lidas de `import.meta.env` (Vite) ou `process.env`
- [ ] Policies RLS no Supabase cobrindo todas as tabelas com dados sensíveis
- [ ] Inputs de usuário validados antes de enviar ao Supabase

#### 3. Banco de dados (Supabase)
- [ ] Foreign keys declaradas nas migrations
- [ ] Índices nas colunas usadas em `WHERE` frequente (ex: `journeys.user_id`, `journeys.vehicle_id`)
- [ ] Operações multi-step usando transações (RPC no Supabase ou `BEGIN/COMMIT` em migrations)
- [ ] `DATABASE_SCHEMA.md` atualizado se nova tabela ou coluna foi criada
- [ ] Migrations com timestamp único e sem `DROP TABLE` destrutivo

#### 4. Frontend & UX
- [ ] Estados de `loading` e `error` tratados em todo fetch/query Supabase
- [ ] Componentes novos em arquivos separados (não acumular em App.tsx)
- [ ] Acessibilidade: `aria-label` em botões de ícone, navegação por Tab
- [ ] Responsividade: tabelas com `overflow-x-auto`, grid adaptável a mobile
- [ ] Consistência visual com a paleta e componentes já existentes

#### 5. Consistência com o projeto
- [ ] Nenhuma feature já funcionando foi quebrada
- [ ] Interfaces em `src/types.ts` atualizadas para novos campos
- [ ] `DEVELOPER_MANUAL.md` atualizado com mudanças de arquitetura
- [ ] `DATABASE_SCHEMA.md` atualizado (se aplicável)

#### Veredito

```
APROVADO  → Orchestrator faz merge e invoca o A5 para escrever testes desta entrega
DEVOLVIDO → AR emite relatório com:
              - Dimensão(ões) com falha
              - Lista de itens específicos a corrigir
              - Sugestão de correção para cada item
            → Orchestrator repassa ao mesmo subagente para correção
            → Após reentrega, AR reavalia (ciclo pode repetir até aprovação)
```

---

## PARTE 8 — PROTOCOLO DE FECHAMENTO

Após A6 aprovado e CI/CD rodando, o Orchestrator executa:

```bash
# Verificar cobertura final
npm run test:coverage

# Verificar build sem erros TypeScript
npm run build

# Verificar que não há console.log em produção
grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx" | grep -v "//.*console"

# Verificar que não há 'any' solto
grep -rn ": any" src/ --include="*.ts" --include="*.tsx"
```

Em seguida, atualiza `DEVELOPER_MANUAL.md` com:
- Data de conclusão desta rodada de correções
- Lista de todos os agentes executados e o que cada um entregou
- Percentual final de cobertura de testes
- Pendências conhecidas para próxima iteração

---

## PARTE 9 — REFERÊNCIA RÁPIDA

| Agente | Foco                    | Depende de       | Entrega para          |
|--------|-------------------------|------------------|-----------------------|
| A1     | Limpeza de Foundation   | —                | AR → A2               |
| A2     | Migrations e Schema     | A1               | AR → A3               |
| A3     | Auth e RLS              | A2               | AR → A5(R1) → A4      |
| A4     | Regras de Negócio       | A2 + A3          | AR → A5(R2) → A6      |
| A5     | Testes (incremental)    | cada aprovado    | AR → A6 quando ≥ 60%  |
| A6     | CI/CD e Deploy          | A1–A4 + A5≥60%  | AR → produção         |
| AR     | Revisão de código       | cada entrega     | merge ou devolução    |

**Esforço total estimado:** ~28h
(A1 ~3h · A2 ~5h · A3 ~6h · A4 ~7h · A5 ~4h · A6 ~3h · AR distribuído ~5h · Orchestrator ~3h)

---

## PARTE 10 — CONTEXTO ADICIONAL DO APP (para os subagentes)

### App em produção
- URL: https://frota-swart.vercel.app
- Acesso: CPF + senha (login)
- A tela inicial após login para Admin é o Dashboard
- A tela inicial após login para Motorista é a Parte Diária

### Características importantes do domínio
- **Veículos** (`veiculo`): controlados por odômetro (km). Campos: `current_odometer`, `initial_odometer`
- **Máquinas** (`maquina`): controladas por horímetro (horas). Campos: `current_hourmeter`, `initial_hourmeter`
- **Jornada aberta**: motorista saiu com o veículo, ainda não retornou. Apenas uma jornada aberta por motorista e por veículo.
- **Jornada encerrada**: motorista retornou, odômetro/horímetro final registrado, veículo liberado.
- **Parte Diária**: termo do domínio para "registro de uso diário do veículo" — é a jornada.

### Arquitetura de acesso ao banco
O app usa o **Supabase JS SDK direto no frontend** (sem API intermediária).
O `server.ts` existe apenas para servir o SPA em produção e expor o health check.
Toda a lógica de negócio deve ser implementada como:
1. Validações no frontend (React) — para feedback imediato ao usuário
2. Constraints/triggers no PostgreSQL — como última linha de defesa dos dados

---

*Documento gerado em 30/04/2026 — baseado na análise do repositório FrankLoubak/fleet*
*e verificação do app em https://frota-swart.vercel.app*
