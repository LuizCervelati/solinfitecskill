# Verificacao de seguranca - API + Banco

## Escopo verificado

- API Node/Express em `backend/src/server.js`
- Conexao Supabase em `backend/src/supabase.js`
- Schema SQL em `backend/supabase-schema.sql`
- Configuracao de deploy em `render.yaml` e `DEPLOY.md`

## Itens corrigidos

- CORS restrito por allowlist (`CORS_ORIGIN`), sem `*` em producao.
- Headers de seguranca com `helmet`.
- Rate limit em `/api` com `express-rate-limit`.
- Validacao forte de entrada:
  - `tag` e `projeto` com whitelist.
  - limites de tamanho em texto.
  - validacao de formato para `userId`.
  - validacao estrutural do objeto `state`.
- Tratamento de erro padronizado sem vazar stack trace.
- Constraints no banco para reforco de validacao.
- RLS habilitado nas tabelas (camada extra de protecao).

## Riscos residuais (importante)

1. O backend atual nao exige autenticacao de usuario (JWT) para ler/escrever.
2. Como usa service role key no servidor, protecao principal depende da API e do deploy.
3. Para nivel enterprise, evoluir para:
   - login de usuario (Supabase Auth),
   - JWT obrigatorio em endpoints de escrita,
   - escopo por usuario/tenant.

## Testes manuais recomendados

1. `GET /api/health` retorna 200.
2. `POST /api/notas` com `tag` invalida retorna 400.
3. `PUT /api/checklist-state/:userId` com state invalido retorna 400.
4. Chamada de origem nao permitida bloqueada por CORS.
5. Burst de requests dispara rate limit (429).
