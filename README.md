# FleetManager

Sistema web de gestão inteligente de frotas, com controle de jornadas, abastecimentos e manutenções.

## Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Estilo:** Tailwind CSS + Lucide React
- **Gráficos:** Recharts
- **Backend/BD:** Supabase (PostgreSQL + Auth)

## Como rodar localmente

**Pré-requisitos:** Node.js

1. Instalar dependências:
   ```bash
   npm install
   ```

2. Criar o arquivo `.env` na raiz com as variáveis:
   ```
   VITE_SUPABASE_URL=sua_url_aqui
   VITE_SUPABASE_ANON_KEY=sua_chave_aqui
   ```

3. Iniciar o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## Perfis de acesso

| Perfil | Acesso |
|---|---|
| **Admin** | Dashboard, relatórios, frota, manutenções, histórico de jornadas |
| **Motorista** | Parte diária (jornada, abastecimento, solicitação de manutenção) |

## Scripts disponíveis

| Comando | Ação |
|---|---|
| `npm run dev` | Inicia em modo desenvolvimento |
| `npm run build` | Gera build de produção na pasta `/dist` |
| `npm run lint` | Verifica erros de TypeScript |
