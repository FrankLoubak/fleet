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
- `/src/pages`: Páginas da aplicação (Dashboard, Login, DailyReport, Users, etc.).
- `/src/lib`: Configurações de bibliotecas externas (Supabase).
- `/src/migrations`: Scripts SQL para alterações no banco de dados.
- `/src/types.ts`: Definições de interfaces TypeScript.
- `/src/utils.ts`: Funções utilitárias e dados mock para seed.

---

## 3. Papéis de Usuário (Roles)

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

## 4. Regras de Negócio por Tabela (Entidade)

### 4.1. Tabela `profiles` (Usuários)
- **Inserção:** Ocorre via trigger `handle_new_user()` do Supabase Auth ao criar um usuário.
- **Regras:**
    - `cpf`: Deve ser único e conter exatamente 11 dígitos numéricos.
    - `role`: Deve ser obrigatoriamente `'Root'`, `'Admin'` ou `'Operador'`.
    - `id`: Deve ser o UUID gerado pelo Supabase Auth.
    - `invited_by`: UUID do usuário que enviou o convite (nullable).
- **Trigger `handle_new_user()`:** Usa `COALESCE` para garantir que `name` e `role` nunca sejam nulos (fallback: parte do e-mail e `'Operador'` respectivamente).

### 4.2. Tabela `invites`
- **Campos:** `id`, `token` (UUID único), `invited_by`, `role`, `used`, `used_by`, `created_at`, `expires_at`.
- **Validade:** 7 dias a partir da criação.
- **Uso único:** Após utilizado, `used = true` e `used_by` é preenchido com o UUID do novo usuário.

### 4.3. Tabela `vehicles` (Veículos e Máquinas)
- **Regras:**
    - `plate`: Deve ser única.
    - `vehicle_type`: `'veiculo'` (usa odômetro) ou `'maquina'` (usa horímetro).
    - `last_odometer`: Deve ser atualizado sempre que uma jornada, abastecimento ou manutenção registrar um valor superior ao atual.
    - `current_odometer`: Armazena a quilometragem atual para veículos do tipo `veiculo`.
    - `current_hourmeter`: Armazena o horímetro atual para veículos do tipo `maquina`.
    - `initial_odometer` / `initial_hourmeter`: Valores de referência no cadastro.

### 4.4. Tabela `journeys` (Jornadas / Parte Diária)
- **Regras de Inserção (Status 'aberta'):**
    - **Concorrência de Usuário:** Um usuário não pode iniciar uma jornada se já possuir outra com status `'aberta'`.
    - **Concorrência de Veículo:** Um veículo não pode ser utilizado se já estiver vinculado a uma jornada `'aberta'` de outro usuário.
    - **Validação de KM/Horímetro Inicial:** O `start_odometer` deve ser maior ou igual ao `current_odometer` ou `current_hourmeter` do veículo.
- **Regras de Atualização (Status 'encerrada'):**
    - **Validação de KM/Horímetro Final:** O `end_odometer` deve ser estritamente maior que o `start_odometer`.
    - **Consistência de Dados:** O `end_odometer` não pode ser menor que o maior valor registrado em abastecimentos ou manutenções da jornada.
    - **Atualização do Veículo:** Ao encerrar, `current_odometer` ou `current_hourmeter` do veículo é atualizado para o valor do `end_odometer`.

### 4.5. Tabela `refuelings` (Abastecimentos)
- **Regras:**
    - `odometer`: Deve ser registrado no momento do abastecimento.
    - `vehicle_id`: Deve ser um UUID válido de um veículo existente.
    - **Atualização do Veículo:** Se o odômetro/horímetro for maior que o atual do veículo, este deve ser atualizado.

### 4.6. Tabela `maintenance_requests` (Solicitações)
- **Fluxo de Status:** `pendente` → `aprovada` (gera registro em `maintenances`) → `concluida`.
- **Regras:**
    - Operadores podem criar solicitações apenas para o veículo que estão operando no momento (jornada aberta).

### 4.7. Tabela `maintenances` (Registros de Manutenção)
- **Regras:**
    - `status`: `'pendente'` (autorizada, não executada), `'executada'`, `'cancelada'`.
    - **Atualização do Veículo:** Ao marcar como `'executada'`, se o `mileage` for superior ao atual do veículo, o registro é atualizado.

---

## 5. Autenticação e Segurança
- O sistema utiliza o **Supabase Auth**.
- O login usa o **CPF** como identificador primário (mapeado internamente para `cpf@fleetmanager.com` ou e-mail real vinculado ao CPF na tabela `profiles`).
- **Cadastro:** Não há cadastro público. Todo acesso é feito via **link de convite** gerado por Root ou Admin na página `/users`.
- **A interface `User` em `types.ts` não contém o campo `password`.** Senhas nunca devem trafegar ou ser armazenadas no frontend.

---

## 6. Como adicionar um usuário Root

1. Acesse **Supabase → Authentication → Users → Add user** e crie o usuário com e-mail e senha.
2. Execute o SQL abaixo para promover o perfil criado:
```sql
UPDATE profiles
SET role = 'Root', name = 'Nome Completo', cpf = '00000000000'
WHERE email = 'email@dominio.com';
```

---

## 7. Manutenção e Build
- **Instalação:** `npm install`
- **Desenvolvimento:** `npm run dev`
- **Build de Produção:** `npm run build` (gera a pasta `/dist`)
- **Linting:** `npm run lint`
- **Migrations:** Scripts SQL em `/src/migrations/` — executar no Supabase SQL Editor.

---

## 8. Observações Importantes para Novos Desenvolvedores
- **Responsividade:** Utilize sempre as classes utilitárias do Tailwind para garantir que tabelas e gráficos se adaptem a telas pequenas (ex: `overflow-x-auto`).
- **Sincronização:** O estado da aplicação depende fortemente do `localStorage` (`fleet_user`) para persistência de sessão rápida, mas a fonte da verdade é sempre o Supabase.
- **Alertas:** A lógica de alertas de manutenção no Dashboard e Sidebar deve ser mantida sincronizada com os status `pendente` das tabelas `maintenance_requests` e `maintenances`.
- **Dados Mock:** `MOCK_VEHICLES`, `MOCK_PROVIDERS` e `MOCK_USERS` em `utils.ts` existem apenas para fins de seed do banco em ambiente de desenvolvimento. Não utilizar em lógica de produção.
- **Futuro:** Está prevista a implementação de um sistema de assinaturas recorrentes vinculado ao usuário `Root`.

---

## 9. Histórico de Correções

| Data | Versão | Descrição |
|---|---|---|
| 2026-03-30 | 1.1.0 | Segurança: removidos campos `password` em texto puro dos dados mock e da interface `User` |
| 2026-03-30 | 1.2.0 | Papéis atualizados: `Motorista` → `Operador`, adicionado `Root`. Cadastro público removido. Sistema de convites implementado. Campo `invited_by` adicionado em `profiles`. Tabela `invites` criada no banco. |
