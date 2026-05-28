# Backend API + Supabase

API Node/Express para conectar seu frontend (GitHub Pages) ao Supabase.

## Importante sobre GitHub Pages

GitHub Pages hospeda apenas arquivos estaticos (HTML/CSS/JS).  
A API deve rodar em outro lugar:

- Render
- Railway
- Fly.io
- Supabase Edge Functions

## Seguranca essencial

- Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- Em producao, use `NODE_ENV=production`.
- Defina `CORS_ORIGIN` com seu dominio real do Pages.
- Use o schema `supabase-schema.sql` (constraints + RLS habilitado).

## 1) Criar tabelas no Supabase

No SQL Editor do Supabase, rode o arquivo `supabase-schema.sql`.

## 2) Configurar ambiente

Copie `.env.example` para `.env` e preencha:

```bash
PORT=8787
NODE_ENV=production
RATE_LIMIT_MAX=300
JWT_SECRET=sua-chave-forte-com-32-ou-mais-caracteres
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SEU_SERVICE_ROLE_KEY
CORS_ORIGIN=https://SEU_USUARIO.github.io
```

## 3) Rodar local

```bash
npm install
npm run dev
```

API local: `http://localhost:8787`

## Endpoints

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/project-types`
- `POST /api/project-types`
- `GET /api/notas?projeto=proj1`
- `POST /api/notas`
- `DELETE /api/notas/:id`
- `GET /api/checklist-state`
- `PUT /api/checklist-state`

Todos os endpoints (exceto `/api/health`, `/api/auth/register` e `/api/auth/login`) exigem:

`Authorization: Bearer <token>`

### Exemplo POST /api/notas

```json
{
  "titulo": "Entendi JWT",
  "conteudo": "Fluxo do token no filtro do Spring Security.",
  "tag": "descoberta",
  "projeto": "proj1"
}
```

### Exemplo POST /api/project-types

```json
{
  "nome": "Projeto 04",
  "slug": "proj4",
  "descricao": "Novo tipo de projeto personalizado"
}
```

### Exemplo PUT /api/checklist-state/:userId

```json
{
  "state": {
    "0": true,
    "1": false,
    "2": true
  }
}
```
