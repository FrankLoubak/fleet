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
- `/src/types.ts`: Definições de interfaces TypeScript.
- `/src/utils.ts`: Funções utilitárias.

---

## 3. Regras de Negócio por Tabela (Entidade)

### 3.1. Tabela `profiles` (Usuários)
- **Inserção:** Ocorre via trigger do Supabase Auth ou cadastro manual.
- **Regras:**
    - `cpf`: Deve ser único e conter exatamente 11 dígitos numéricos.
    - `role`: Deve ser obrigatoriamente 'Admin' ou 'Motorista'.
    - `id`: Deve ser o UUID gerado pelo Supabase Auth.

### 3.2. Tabela `vehicles` (Veículos e Máquinas)
- **Regras:**
    - `plate`: Deve ser única.
    - `vehicle_type`: 'veiculo' (usa odômetro) ou 'maquina' (usa horímetro).
    - `last_odometer`: Deve ser atualizado sempre que uma jornada, abastecimento ou manutenção registrar um valor superior ao atual.

### 3.3. Tabela `journeys` (Jornadas / Parte Diária)
- **Regras de Inserção (Status 'aberta'):**
    - **Concorrência de Usuário:** Um usuário não pode iniciar uma jornada se já possuir outra com status 'aberta'.
    - **Concorrência de Veículo:** Um veículo não pode ser utilizado se já estiver vinculado a uma jornada 'aberta' de outro usuário.
    - **Validação de KM Inicial:** O `start_odometer` deve ser maior ou igual ao `last_odometer` do veículo na tabela `vehicles`.
- **Regras de Atualização (Status 'encerrada'):**
    - **Validação de KM Final:** O `end_odometer` deve ser estritamente maior que o `start_odometer`.
    - **Consistência de Dados:** O `end_odometer` não pode ser menor que o maior odômetro registrado em abastecimentos ou manutenções realizados durante o período da jornada.
    - **Atualização do Veículo:** Ao encerrar, o `last_odometer` do veículo deve ser atualizado para o valor do `end_odometer`.

### 3.4. Tabela `refuelings` (Abastecimentos)
- **Regras:**
    - `odometer`: Deve ser registrado no momento do abastecimento.
    - `vehicle_id`: Deve ser um UUID válido de um veículo existente.
    - **Atualização do Veículo:** Se o odômetro do abastecimento for maior que o `last_odometer` do veículo, este deve ser atualizado.

### 3.5. Tabela `maintenance_requests` (Solicitações)
- **Fluxo de Status:** `pendente` -> `aprovada` (gera registro em `maintenances`) -> `concluida`.
- **Regras:**
    - Motoristas podem criar solicitações apenas para o veículo que estão operando no momento (jornada aberta).

### 3.6. Tabela `maintenances` (Registros de Manutenção)
- **Regras:**
    - `status`: 'pendente' (autorizada mas não executada), 'executada' (serviço concluído), 'cancelada'.
    - **Atualização do Veículo:** Ao marcar como 'executada', se o `mileage` (KM da manutenção) for superior ao `last_odometer` do veículo, o registro do veículo deve ser atualizado.

---

## 4. Autenticação e Segurança
- O sistema utiliza o **Supabase Auth**.
- O login é baseado em e-mail e senha, mas a interface utiliza o **CPF** como identificador primário (mapeando internamente para um e-mail no formato `cpf@fleetmanager.com` ou buscando o e-mail real vinculado ao CPF na tabela `profiles`).
- **Níveis de Acesso:**
    - `Admin`: Acesso total (Dashboard, Relatórios, Gestão de Manutenção).
    - `Motorista`: Acesso restrito à Parte Diária e Perfil.

---

## 5. Manutenção e Build
- **Instalação:** `npm install`
- **Desenvolvimento:** `npm run dev`
- **Build de Produção:** `npm run build` (gera a pasta `/dist`)
- **Linting:** `npm run lint`

---

## 6. Observações Importantes para Novos Desenvolvedores
- **Responsividade:** Utilize sempre as classes utilitárias do Tailwind para garantir que tabelas e gráficos se adaptem a telas pequenas (ex: `overflow-x-auto`).
- **Sincronização:** O estado da aplicação depende fortemente do `localStorage` (`fleet_user`) para persistência de sessão rápida, mas a fonte da verdade é sempre o Supabase.
- **Alertas:** A lógica de alertas de manutenção no Dashboard e Sidebar deve ser mantida sincronizada com os status `pendente` das tabelas `maintenance_requests` e `maintenances`.
