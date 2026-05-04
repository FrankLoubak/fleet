# Manual do Desenvolvedor - FleetManager

Este documento descreve a arquitetura, o stack tecnológico e as regras de negócio essenciais para a manutenção e evolução do sistema **FleetManager**.

---

## 1. Stack Tecnológico
- **Frontend:** React 18+ com TypeScript.
- **Build Tool:** Vite.
- **Estilização:** Tailwind CSS.
- **Ícones:** Lucide React.
- **Gráficos:** Recharts.
- **Backend & Banco de Dados:** Supabase (PostgreSQL + Auth).
- **Utilitários:** clsx, tailwind-merge.

---

## 2. Estrutura de Pastas
- `/src/components`: Componentes reutilizáveis (Sidebar, etc.).
- `/src/pages`: Páginas da aplicação (Dashboard, Login, DailyReport, etc.).
- `/src/lib`: Configurações de bibliotecas externas (Supabase).
- `/supabase/migrations`: Scripts SQL de migrations (fonte de verdade do schema).
- `/src/types.ts`: Definições de interfaces TypeScript.
- `/src/utils.ts`: Funções utilitárias.

---

## 3. Regras de Negócio por Tabela (Entidade)

| Role | Descrição | Como é criado |
|---|---|---|
| `Root` | Dono da assinatura. Acesso total ao sistema. | Inserido manualmente no Supabase |
| `Admin` | Gestor da frota. Acesso a dashboard, relatórios, manutenções e usuários. | Via link de convite enviado por Root ou Admin |
| `Operador` | Motorista/operador de máquina. Acesso restrito à parte diária. | Via link de convite enviado por Root ou Admin |

### Hierarquia de convites
- `Root` pode convidar: `Admin` e `Operador`
- `Admin` pode convidar: `Admin` e `Operador`
- `Operador` não pode convidar ninguém

### Rastreamento de convites
- Tabela `invites`: registra token, quem convidou, role destinada, validade (7 dias) e se foi utilizado.
- Campo `invited_by` em `profiles`: registra o UUID de quem enviou o convite para aquele usuário.

---

## 4. Schema do Banco de Dados

A documentação completa de todas as tabelas, colunas, tipos, valores permitidos e políticas RLS está centralizada em:

**[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** — fonte de verdade do schema do banco.

> Sempre que uma nova migration for adicionada em `supabase/migrations/`, o `DATABASE_SCHEMA.md` deve ser atualizado para refletir as mudanças.

---

## 5. Regras de Negócio por Tabela (Entidade)

### 4.1. Tabela `profiles` (Usuários)
- **Inserção:** Ocorre via trigger `handle_new_user()` do Supabase Auth ao criar um usuário.
- **Regras:**
    - `cpf`: Deve ser único e conter exatamente 11 dígitos numéricos.
    - `role`: Deve ser obrigatoriamente 'Admin' ou 'Motorista'.
    - `id`: Deve ser o UUID gerado pelo Supabase Auth.

### 3.2. Tabela `vehicles` (Veículos e Máquinas)
- **Regras:**
    - `plate`: Deve ser única.
    - `vehicle_type`: 'veiculo' (usa odômetro) ou 'maquina' (usa horímetro).
    - `last_odometer`: Deve ser atualizado sempre que uma jornada, abastecimento ou manutenção registrar um valor superior ao atual. Esta regra aplica-se a todos os tipos de veículos (`veiculo` e `maquina`). No caso de máquinas, este campo armazena o valor do horímetro para fins de comparação global de "último registro".
    - `current_odometer`: Armazena a quilometragem atual para veículos do tipo `veiculo`.
    - `current_hourmeter`: Armazena o horímetro atual para veículos do tipo `maquina`.
    - `initial_odometer` / `initial_hourmeter`: Valores de referência no cadastro.

### 3.3. Tabela `journeys` (Jornadas / Parte Diária)
- **Regras de Inserção (Status 'aberta'):**
    - **Concorrência de Usuário:** Um usuário não pode iniciar uma jornada se já possuir outra com status 'aberta'.
    - **Concorrência de Veículo:** Um veículo não pode ser utilizado se já estiver vinculado a uma jornada 'aberta' de outro usuário.
    - **Validação de KM/Horímetro Inicial:** O `start_odometer` deve ser maior ou igual ao `current_odometer` (para veículos) ou `current_hourmeter` (para máquinas) do veículo na tabela `vehicles`.
- **Regras de Atualização (Status 'encerrada'):**
    - **Validação de KM/Horímetro Final:** O `end_odometer` deve ser estritamente maior que o `start_odometer`.
    - **Consistência de Dados:** O `end_odometer` não pode ser menor que o maior odômetro/horímetro registrado em abastecimentos ou manutenções realizados durante o período da jornada.
    - **Atualização do Veículo:** Ao encerrar, o `current_odometer` ou `current_hourmeter` do veículo deve ser atualizado para o valor do `end_odometer`, e o `last_odometer` deve ser atualizado se o valor for superior.

### 3.4. Tabela `refuelings` (Abastecimentos)
- **Regras:**
    - `odometer`: Deve ser registrado no momento do abastecimento (ou horímetro para máquinas).
    - `vehicle_id`: Deve ser um UUID válido de um veículo existente.
    - **Atualização do Veículo:** Se o odômetro/horímetro do abastecimento for maior que o atual do veículo (`current_odometer` ou `current_hourmeter`), este deve ser atualizado, assim como o `last_odometer`.

### 3.5. Tabela `maintenance_requests` (Solicitações)
- **Fluxo de Status:** `pendente` -> `aprovada` (gera registro em `maintenances`) -> `concluida`.
- **Regras:**
    - Motoristas podem criar solicitações apenas para o veículo que estão operando no momento (jornada aberta).

### 3.6. Tabela `maintenances` (Registros de Manutenção)
- **Regras:**
    - `status`: 'pendente' (autorizada mas não executada), 'executada' (serviço concluído), 'cancelada'.
    - **Atualização do Veículo:** Ao marcar como 'executada', se o `mileage` (KM ou Horímetro da manutenção) for superior ao atual do veículo (`current_odometer` ou `current_hourmeter`), o registro do veículo deve ser atualizado, assim como o `last_odometer`.

---

## 6. Autenticação e Segurança
- O sistema utiliza o **Supabase Auth**.
- O login é baseado em e-mail e senha, mas a interface utiliza o **CPF** como identificador primário (mapeando internamente para um e-mail no formato `cpf@fleetmanager.com` ou buscando o e-mail real vinculado ao CPF na tabela `profiles`).
- **Níveis de Acesso:**
    - `Admin`: Acesso total (Dashboard, Relatórios, Gestão de Manutenção).
    - `Motorista`: Acesso restrito à Parte Diária e Perfil.

---

## 7. Como adicionar um usuário Root

1. Acesse **Supabase → Authentication → Users → Add user** e crie o usuário com e-mail e senha.
2. Execute o SQL abaixo para promover o perfil criado:
```sql
UPDATE profiles
SET role = 'Root', name = 'Nome Completo', cpf = '00000000000'
WHERE email = 'email@dominio.com';
```

---

## 8. Manutenção e Build
- **Instalação:** `npm install`
- **Desenvolvimento:** `npm run dev`
- **Build de Produção:** `npm run build` (gera a pasta `/dist`)
- **Linting:** `npm run lint`
- **Migrations:** Scripts SQL em `/supabase/migrations/` — executar no Supabase SQL Editor ou via `supabase db push`.

---

## 9. Observações Importantes para Novos Desenvolvedores
- **Responsividade:** Utilize sempre as classes utilitárias do Tailwind para garantir que tabelas e gráficos se adaptem a telas pequenas (ex: `overflow-x-auto`).
- **Sincronização:** O estado da aplicação depende fortemente do `localStorage` (`fleet_user`) para persistência de sessão rápida, mas a fonte da verdade é sempre o Supabase.
- **Alertas:** A lógica de alertas de manutenção no Dashboard e Sidebar deve ser mantida sincronizada com os status `pendente` das tabelas `maintenance_requests` e `maintenances`.
- **Dados Mock:** `MOCK_VEHICLES`, `MOCK_PROVIDERS` e `MOCK_USERS` em `utils.ts` existem apenas para fins de seed do banco em ambiente de desenvolvimento. Não utilizar em lógica de produção.
- **Futuro:** Está prevista a implementação de um sistema de assinaturas recorrentes vinculado ao usuário `Root`.

---

## 10. Histórico de Correções

| Data | Versão | Descrição |
|---|---|---|
| 2026-03-30 | 1.1.0 | Segurança: removidos campos `password` em texto puro dos dados mock e da interface `User` |
| 2026-03-30 | 1.2.0 | Papéis atualizados: `Motorista` → `Operador`, adicionado `Root`. Cadastro público removido. Sistema de convites implementado. Campo `invited_by` adicionado em `profiles`. Tabela `invites` criada no banco. |
| 2026-05-01 | 2.0.0 | Rodada de correções Orchestrator (A1–A6). Ver seção 11 para detalhes. |

---

## 11. Rodada de Correções — Orchestrator (2026-05-01)

Execução completa dos agentes A1–A6 com revisão do AR após cada entrega.

### Agentes e entregas

| Agente | Entrega |
|--------|---------|
| **A1 — Foundation** | `server.ts` simplificado para thin proxy; `capacitor.config.ts` corrigido (removido `cleartext`, appName → `FleetManager`); `.env.example` limpo; `metadata.json` removido; `README.md` reescrito |
| **A2 — Migrations** | `maintenance_updates.sql` e `src/migrations/001_invite_system.sql` movidos para `supabase/migrations/`; `DATABASE_SCHEMA.md` criado com documentação de 8 tabelas; `DEVELOPER_MANUAL.md` atualizado |
| **A3 — Auth** | `ProtectedRoute` e `AdminRoute` implementados em `App.tsx`; `onAuthStateChange` adicionado para sessão persistente; logout corrigido em Sidebar, DailyReport e RequestMaintenance para chamar `supabase.auth.signOut()`; interface `AuthUser` adicionada em `types.ts`; `any` removido de Login.tsx |
| **A4 — Regras de Negócio** | Validação pré-submit de odômetro/horímetro com mensagens específicas em PT-BR e valores concretos; diferenciação entre `veiculo` (km) e `maquina` (h); `console.error` e `any` removidos de DailyReport.tsx e Journeys.tsx; seção "Regras de Negócio" adicionada ao DATABASE_SCHEMA.md |
| **A5 — Testes** | Vitest configurado; 280 testes em 17 arquivos; cobertura final: **60.59% statements, 81.83% branches** |
| **A6 — CI/CD** | `.github/workflows/ci.yml` (push/PR) e `.github/workflows/deploy.yml` (push main → Vercel) criados |

### Cobertura de testes final

```
Statements : 60.59%
Branches   : 81.83%
Functions  : 39.76%
Lines      : 60.59%
Total tests: 280 (17 arquivos)
```

### Pendências para próxima iteração

- Configurar os 5 GitHub Secrets no repositório para ativar os workflows: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- Remover `console.error` remanescentes em catch blocks de Vehicles.tsx, Dashboard.tsx, Users.tsx, Refueling.tsx, Maintenance.tsx, MaintenanceList.tsx (pré-existentes, fora do escopo desta rodada)
- Remover `any` remanescentes em seedData.ts, Refueling.tsx, Users.tsx (pré-existentes)
- Aumentar cobertura de funções (atual: 39.76%) com testes de interação nos componentes grandes
