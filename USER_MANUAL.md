# Manual do Usuário - FleetManager

Bem-vindo ao **FleetManager**, sua solução completa para gestão inteligente de frotas. Este manual guiará você pelas principais funcionalidades do sistema.

---

## 1. Acesso ao Sistema

### Login
- **CPF:** Utilize seu CPF (apenas números) para identificação.
- **Senha:** Insira sua senha cadastrada.

### Como criar uma conta
O acesso ao sistema é feito exclusivamente por **link de convite**. Você receberá um link enviado pelo administrador ou pelo responsável pela sua organização. Ao clicar no link, será direcionado para a tela de cadastro com seu nível de acesso já definido.

### Níveis de acesso

| Nível | Quem é | O que pode fazer |
|---|---|---|
| **Root** | Responsável pela assinatura do sistema | Acesso total, gerencia administradores |
| **Admin** | Gestor da frota | Dashboard, relatórios, manutenções, usuários |
| **Operador** | Motorista ou operador de máquina | Parte diária, abastecimento, solicitação de manutenção |

---

## 2. Visão Geral (Dashboard) - *Admin e Root*
O Dashboard oferece uma visão analítica da frota:
- **Evolução de Gastos:** Gráfico comparativo entre combustível e manutenção.
- **Participação no Gasto:** Veja quanto cada veículo representa no custo total.
- **Alertas de Manutenção:** Notificações imediatas sobre solicitações pendentes ou manutenções autorizadas aguardando execução.
- **Filtros:** Você pode filtrar os dados por veículo específico e período de tempo.

---

## 3. Gestão de Veículos
Na tela de **Frota**, você pode:
- Visualizar todos os veículos e máquinas cadastrados.
- Verificar o odômetro/horímetro atual de cada unidade.
- Identificar o status e prefixo de cada veículo.

---

## 4. Operação Diária (Operador)

### Iniciar Jornada (Parte Diária)
1. Selecione o veículo ou máquina que irá utilizar.
2. Confira a data e o horário.
3. Insira o **Odômetro Inicial** (para veículos) ou **Horímetro Inicial** (para máquinas). O sistema validará se o valor é maior ou igual ao último registro conhecido.
4. Clique em **Iniciar Jornada**.

### Durante a Jornada
Com a jornada aberta, você terá acesso aos botões:
- **Incluir Abastecimento:** Registre litros, tipo de combustível e odômetro/horímetro no momento do abastecimento.
- **Solicitar Manutenção:** Se identificar um problema, envie uma solicitação descrevendo o defeito.
- **Incluir Manutenção:** Registre manutenções realizadas diretamente (se aplicável).

### Encerrar Jornada
1. Clique em **Encerrar Jornada**.
2. Insira o **Odômetro/Horímetro Final**.
3. O sistema verificará se o valor final é estritamente maior que o inicial e compatível com os registros da jornada.
4. Ao encerrar, o odômetro/horímetro do veículo será atualizado automaticamente.

---

## 5. Manutenções - *Admin e Root*
Gerencie o ciclo de vida das manutenções:
- **Pendentes:** Visualize solicitações feitas pelos operadores.
- **Autorizar:** Aprove uma solicitação para que ela se torne uma manutenção programada.
- **Executadas:** Marque as manutenções como concluídas após o serviço ser realizado.

---

## 6. Histórico de Jornadas - *Admin e Root*
Acesse o registro completo de todas as viagens realizadas, incluindo distâncias percorridas, operadores responsáveis e tempos de utilização.

---

## 7. Gestão de Usuários - *Admin e Root*
Na tela de **Usuários**, você pode:
- Visualizar todos os usuários cadastrados, seus papéis e quem os convidou.
- **Gerar link de convite** para novos Admins ou Operadores.
- O link gerado tem validade de **7 dias** e é de uso único.

---

## 8. Dicas de Uso
- **Modo Escuro:** O sistema se adapta automaticamente às configurações do seu dispositivo.
- **Responsividade:** Em dispositivos móveis, as tabelas podem ser deslizadas lateralmente para visualização completa.
- **Alertas:** Fique atento ao ícone de sino no topo da tela para notificações importantes.
- **Senha esquecida:** Entre em contato com o administrador do sistema para redefinição de senha.
