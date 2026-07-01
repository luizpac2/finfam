# Deploy em produção (Vercel + Supabase)

Guia para publicar o FinFam na Vercel com login Google seguro, funcionando em
**local**, nos **previews** da Vercel e em **produção**.

Projeto Supabase de referência: `hssfiveoldsckrgzolsw`
(URL: `https://hssfiveoldsckrgzolsw.supabase.co`).

---

## 1. Roteamento SPA (`vercel.json`)

O [`vercel.json`](vercel.json) já está configurado. O `rewrites` faz **todas** as
rotas caírem no `index.html`, para o React Router assumir o roteamento (sem 404
ao dar refresh em `/admin`, `/importar`, etc.). Também há cache imutável para os
assets com hash em `/assets/*`.

```jsonc
{
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/assets/(.*)", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
    ]}
  ]
}
```

---

## 2. Variáveis de ambiente na Vercel

Em **Vercel → seu projeto → Settings → Environment Variables**, adicione as
duas variáveis abaixo e marque os três ambientes (**Production**, **Preview** e
**Development**):

| Variável                 | Valor                                             | Ambientes                        |
| ------------------------ | ------------------------------------------------- | -------------------------------- |
| `VITE_SUPABASE_URL`      | `https://hssfiveoldsckrgzolsw.supabase.co`        | Production · Preview · Development |
| `VITE_SUPABASE_ANON_KEY` | a chave **anon/public** (Supabase → Settings → API) | Production · Preview · Development |

> ⚠️ Regras importantes
> - Use **somente** a chave `anon` (pública). **Nunca** exponha a `service_role`.
> - O prefixo `VITE_` é obrigatório — só variáveis com esse prefixo chegam ao
>   código do navegador.
> - Ao alterar variáveis, faça um **Redeploy** para que tenham efeito.

As **Build & Development Settings** são detectadas automaticamente (framework
Vite): Build `npm run build`, Output `dist`.

---

## 3. Autenticação Supabase — Redirect URLs e Origens

O fluxo é: o app chama `signInWithOAuth('google')` → Google → **callback do
Supabase** (`https://hssfiveoldsckrgzolsw.supabase.co/auth/v1/callback`) →
Supabase redireciona de volta para a **origem de onde o usuário veio**
(`redirectTo = window.location.origin`).

Por isso a permissão dos domínios (local, preview e produção) é configurada no
**Supabase**, não no Google — e o Supabase aceita **wildcards**, cobrindo os
previews da Vercel automaticamente.

### 3.1 Supabase → Authentication → URL Configuration

- **Site URL** (destino padrão pós-login): a URL de **produção**, ex.:
  ```
  https://SEU-PROJETO.vercel.app
  ```

- **Redirect URLs** (lista de permissões — adicione todas):
  ```
  http://localhost:5173/**
  https://SEU-PROJETO.vercel.app/**
  https://SEU-PROJETO-*.vercel.app/**
  ```
  - Linha 1 → desenvolvimento local (`http://localhost:5173`).
  - Linha 2 → produção.
  - Linha 3 → **previews da Vercel** (URLs do tipo
    `seu-projeto-git-branch-time.vercel.app` e `seu-projeto-hash-time.vercel.app`
    casam com o wildcard `*`).
  - Se usar **domínio próprio**, adicione também `https://app.seudominio.com/**`.
  - O `/**` no fim libera qualquer caminho da rota (SPA).

> Troque `SEU-PROJETO` pelo nome do projeto na Vercel. Evite `https://*.vercel.app`
> (amplo demais); mantenha o prefixo do seu projeto para segurança.

### 3.2 Supabase → Authentication → Providers → Google

- **Google** = **Enabled**, com o Client ID e Client Secret (ver passo 4).
- **Email** = **Disabled** (não usamos senha local).

---

## 4. Google Cloud — credenciais OAuth (feito uma única vez)

Como o Google só redireciona para o **callback do Supabase** (um endereço fixo),
você **não** precisa cadastrar cada URL de preview da Vercel aqui.

Em **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID**:

- **Authorized redirect URIs** (obrigatório):
  ```
  https://hssfiveoldsckrgzolsw.supabase.co/auth/v1/callback
  ```

- **Authorized JavaScript origins** (recomendado):
  ```
  http://localhost:5173
  https://SEU-PROJETO.vercel.app
  ```

Copie o **Client ID** e o **Client Secret** para o provider Google no Supabase
(passo 3.2). Confira também, em **OAuth consent screen**, que o app está
publicado (ou que os e-mails de teste estão liberados).

---

## 5. Passo a passo do deploy

1. Faça push do repositório para o GitHub.
2. Na Vercel: **Add New → Project** e importe o repositório (framework **Vite**
   detectado automaticamente).
3. Adicione as variáveis de ambiente do **passo 2**.
4. Configure o Supabase (**passo 3**) e o Google (**passo 4**).
5. **Deploy**. Ao terminar, copie a URL de produção e confirme que ela está no
   **Site URL** e nas **Redirect URLs** do Supabase.
6. Aplique as migrations do banco (ver [`supabase/README.md`](supabase/README.md))
   caso ainda não tenha feito.

---

## 6. Checklist final

- [ ] `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nos 3 ambientes da Vercel.
- [ ] Supabase **Site URL** = produção; **Redirect URLs** com localhost + prod +
      wildcard de preview.
- [ ] Provider **Google habilitado** / **Email desabilitado** no Supabase.
- [ ] Google OAuth com o **redirect URI do callback do Supabase**.
- [ ] Migrations `0001`→`0005` aplicadas.
- [ ] Primeiro login com Google vira **admin** (bootstrap) e libera o painel.
