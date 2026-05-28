# Deploy seguro (Backend + GitHub Pages)

## Checklist de seguranca (antes do deploy)

1. **Nunca** exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend.
2. Configure `CORS_ORIGIN` apenas com seu dominio de producao.
3. Rode o SQL `backend/supabase-schema.sql` (inclui constraints + RLS habilitado).
4. Use `NODE_ENV=production`.
5. Revise se `.env` nao foi commitado (`.gitignore` ja cobre isso).
6. Troque qualquer segredo que ja tenha sido compartilhado acidentalmente.

## 1) Subir para GitHub

No root do projeto:

```bash
git init
git add .
git commit -m "setup frontend and backend supabase api"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

## 2) Deploy da API no Render

1. Entre em [Render](https://render.com) e conecte seu GitHub.
2. Clique em **New +** > **Blueprint**.
3. Selecione este repositório (ele detecta `render.yaml`).
4. Preencha variaveis:
   - `NODE_ENV=production`
   - `RATE_LIMIT_MAX=300`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CORS_ORIGIN` (exemplo: `https://SEU_USUARIO.github.io`)
5. Deploy.

Quando subir, copie a URL da API:

`https://cronograma-backend.onrender.com`

## 3) Criar tabelas no Supabase

No SQL Editor, rode `backend/supabase-schema.sql`.

## 4) Apontar frontend para API

No arquivo `solinfitec-cronograma-v3.html`, troque:

```html
<script>
  window.CRONOGRAMA_API_BASE_URL = window.CRONOGRAMA_API_BASE_URL || "";
</script>
```

por:

```html
<script>
  window.CRONOGRAMA_API_BASE_URL = "https://SUA-API.onrender.com";
</script>
```

## 5) Publicar no GitHub Pages

1. No repo GitHub: **Settings** > **Pages**.
2. Source: **Deploy from a branch**.
3. Branch: `main` e folder `/ (root)`.
4. Salve e aguarde URL final.

URL esperada:

`https://SEU_USUARIO.github.io/SEU_REPO/`

## 6) Validar

- Abra `https://SUA-API.onrender.com/api/health` (deve retornar `ok: true`).
- Abra o Pages e marque checklist.
- Recarregue a pagina para confirmar persistencia.
- Teste de CORS: tente chamar API a partir de origem nao autorizada (deve falhar).
- Teste de payload invalido: envie `tag` invalida em `POST /api/notas` (deve retornar 400).
