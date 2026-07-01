# Banco de dados (Supabase)

Scripts SQL para provisionar o backend do FinFam (Postgres + Auth + RLS).

## Como aplicar

### Opção A — SQL Editor (mais simples)

No painel do Supabase: **SQL Editor → New query** e execute os arquivos de
`migrations/` **na ordem numérica**:

1. `0001_initial_schema.sql` — ENUMs, tabelas, índices e gatilhos.
2. `0002_auth_functions.sql` — vínculo conta Google ↔ whitelist, bootstrap do
   primeiro admin, RPC `sync_current_user` e helpers de RLS.
3. `0003_rls_policies.sql` — ativa o Row Level Security e as políticas.
4. `0004_seed_categories.sql` — categorias iniciais (opcional).

### Opção B — Supabase CLI

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

### Recriar do zero (reset)

Se você já rodou uma versão anterior do schema, use [`reset.sql`](reset.sql)
para remover os objetos do projeto (tabelas, funções, gatilhos, tipos e
policies) e, em seguida, rode novamente `0001` → `0004`. O `reset.sql` fica
**fora** de `migrations/` de propósito, para a CLI não o tratar como migração.

> ⚠️ O reset apaga os dados de `categories`, `users` e `transactions`. Ele não
> remove contas em `auth.users` — há um comando opcional (comentado) no fim do
> arquivo para também zerar o login e fazer o bootstrap do primeiro admin de novo.

## Configurar o login com Google (obrigatório)

A aplicação aceita **exclusivamente** login via Google.

1. **Google Cloud Console** → crie credenciais OAuth 2.0 (Client ID/Secret).
   Em *Authorized redirect URIs*, adicione:
   `https://SEU-PROJETO.supabase.co/auth/v1/callback`
2. **Supabase → Authentication → Providers → Google**: cole o Client ID/Secret
   e **ative**.
3. **Supabase → Authentication → Providers → Email**: **desative** (não usamos
   senha local).
4. **Authentication → URL Configuration**: defina *Site URL* e *Redirect URLs*
   (ex.: `http://localhost:5173` e a URL de produção da Vercel).

## Modelo de dados

| Tabela         | Descrição                                                        |
| -------------- | ---------------------------------------------------------------- |
| `categories`   | Categorias (`name`, `icon`, `color`).                            |
| `users`        | Membros + **whitelist** (`email`, `role`, `status`, `auth_id`).  |
| `transactions` | Lançamentos (`date`, `description`, `amount`, `type`, `status`, `category_id`, `user_id`). |

## Whitelist (lista de permissões)

A tabela `users` **é** a whitelist. Um e-mail só acessa o sistema se já existir
ali um registro (criado por um Admin) com `status <> 'revoked'`.

- **Admin convida** → linha com `status = 'invited'` (sem `auth_id`).
- **Usuário faz login com Google** → a função `handle_new_user` (gatilho) e/ou
  `sync_current_user` (RPC, chamada pelo app) vinculam `auth_id` e marcam
  `status = 'active'`. Isso cobre os dois casos: *convite antes do login* e
  *login antes do convite*.
- **Sem convite** → nenhum perfil ativo → o RLS nega tudo e o app mostra a tela
  "Você precisa de um convite".
- **Bootstrap**: o **primeiro** usuário a entrar (tabela vazia) vira `admin`
  ativo automaticamente.

## Regras de acesso (RLS)

- **Somente membros ativos** leem qualquer dado. Por isso, **revogar é
  instantâneo**: ao definir `status = 'revoked'`, o RLS passa a negar toda
  leitura/escrita daquele usuário, mesmo com a sessão Google ainda válida.
- **Transações**: o autor (`user_id`) ou um `admin` editam/excluem.
- **Categorias** e **gestão de membros**: apenas `admin`.
