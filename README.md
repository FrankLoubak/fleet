# FleetManager

Sistema web + Android de gestão de frotas para controle de jornadas, abastecimentos e manutenções.

## Stack

- React 18 · TypeScript · Vite · Tailwind CSS · Supabase · Capacitor (Android)

## Acesso em Produção

https://frota-swart.vercel.app (Admin e Operador)

## Setup Local

**Pré-requisitos:** Node 20+

1. Copiar o arquivo de variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```

2. Preencher as variáveis no `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

3. Instalar as dependências:
   ```bash
   npm install
   ```

4. Iniciar o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## Arquitetura

```
Frontend (React) → Supabase (PostgreSQL + Auth + RLS)
```

O `server.ts` é um thin proxy responsável por health check (`GET /api/health`) e por servir o SPA em produção.

## Documentação

- [Manual do Desenvolvedor](DEVELOPER_MANUAL.md)
- [Manual do Usuário](USER_MANUAL.md)

## CI/CD

O projeto utiliza GitHub Actions com dois pipelines automatizados:

**CI (`ci.yml`)** — Executa em todo push para qualquer branch e em pull requests para `main`:
- Instala dependências via `npm ci`
- Roda os testes com cobertura (`npm run test:coverage`)
- Realiza o build de produção (`npm run build`)

**Deploy (`deploy.yml`)** — Executa apenas em push para `main`:
- Instala dependências via `npm ci`
- Roda os testes com cobertura (bloqueia o deploy em caso de falha)
- Realiza o build de produção
- Faz o deploy automático para a Vercel em modo `--prod`

### GitHub Secrets necessários

| Secret | Descrição |
|--------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima do Supabase |
| `VERCEL_TOKEN` | Token de acesso da Vercel |
| `VERCEL_ORG_ID` | ID da organização na Vercel |
| `VERCEL_PROJECT_ID` | ID do projeto na Vercel |
