require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { supabase } = require("./supabase");

const app = express();
const port = Number(process.env.PORT || 8787);
const jwtSecret = process.env.JWT_SECRET || "";
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedTags = new Set(["descoberta", "importante", "revisao", "erro"]);

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  throw new Error("CORS_ORIGIN e obrigatoria em producao.");
}
if (process.env.NODE_ENV === "production" && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET precisa ter ao menos 32 caracteres em producao.");
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origem nao permitida pelo CORS."));
    },
  })
);
app.use(express.json({ limit: "1mb" }));

function sanitizeText(value, maxLen) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLen);
}

function validProjectSlug(value) {
  return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(value);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

function validPassword(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/.test(value);
}

function validateChecklistState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  const entries = Object.entries(state);
  if (entries.length > 5000) return false;
  return entries.every(([key, value]) => /^\d{1,6}$/.test(key) && typeof value === "boolean");
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, nome: user.nome, role: user.role },
    jwtSecret,
    { expiresIn: "7d" }
  );
}

function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || "");
  const [, token] = header.split(" ");
  if (!token) return res.status(401).json({ error: "token ausente" });
  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch (_err) {
    return res.status(401).json({ error: "token invalido" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "apenas administradores podem editar o conteudo" });
  }
  return next();
}

const curriculumSlugs = new Set(["proj1", "proj2", "proj3"]);

function validateCurriculumContent(content) {
  if (!content || typeof content !== "object" || Array.isArray(content)) return false;
  if (!Array.isArray(content.steps)) return false;
  if (content.steps.length > 40) return false;
  const size = JSON.stringify(content).length;
  if (size > 800000) return false;
  return content.steps.every((step) => {
    if (!step || typeof step !== "object") return false;
    if (typeof step.title !== "string" || step.title.length > 200) return false;
    if (!Array.isArray(step.blocks)) return false;
    return step.blocks.length <= 30;
  });
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "cronograma-backend" });
});

app.post("/api/auth/register", async (req, res) => {
  const nome = sanitizeText(req.body?.nome, 80);
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const password = String(req.body?.password || "");

  if (!nome || nome.length < 2) return res.status(400).json({ error: "nome invalido" });
  if (!validEmail(email)) return res.status(400).json({ error: "email invalido" });
  if (!validPassword(password)) {
    return res.status(400).json({ error: "senha deve ter 8+ chars, maiuscula, minuscula e numero" });
  }

  const senha_hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase
    .from("auth_users")
    .insert({ nome, email, senha_hash, role: "user" })
    .select("id,nome,email,role,created_at")
    .single();

  if (error?.code === "23505") return res.status(409).json({ error: "email ja cadastrado" });
  if (error) return res.status(500).json({ error: "erro ao cadastrar" });

  const token = signAccessToken(data);
  return res.status(201).json({ token, user: data });
});

app.post("/api/auth/login", async (req, res) => {
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const password = String(req.body?.password || "");
  if (!validEmail(email) || !password) return res.status(400).json({ error: "credenciais invalidas" });

  const { data: user, error } = await supabase
    .from("auth_users")
    .select("id,nome,email,role,senha_hash,ativo")
    .eq("email", email)
    .maybeSingle();

  if (error) return res.status(500).json({ error: "erro ao autenticar" });
  if (!user || !user.ativo) return res.status(401).json({ error: "credenciais invalidas" });

  const ok = await bcrypt.compare(password, user.senha_hash);
  if (!ok) return res.status(401).json({ error: "credenciais invalidas" });

  const token = signAccessToken(user);
  return res.json({
    token,
    user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
  });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("auth_users")
    .select("id,nome,email,role,created_at,ativo")
    .eq("id", req.user.sub)
    .maybeSingle();
  if (error) return res.status(500).json({ error: "erro ao buscar usuario" });
  if (!data) return res.status(404).json({ error: "usuario nao encontrado" });
  return res.json(data);
});

app.get("/api/project-types", requireAuth, async (_req, res) => {
  const { data, error } = await supabase
    .from("project_types")
    .select("id,nome,slug,descricao,ativo,created_at")
    .eq("ativo", true)
    .order("nome", { ascending: true });
  if (error) return res.status(500).json({ error: "erro ao listar tipos de projeto" });
  return res.json(data);
});

app.post("/api/project-types", requireAuth, async (req, res) => {
  const nome = sanitizeText(req.body?.nome, 80);
  const slug = sanitizeText(req.body?.slug, 40).toLowerCase();
  const descricao = sanitizeText(req.body?.descricao, 280);
  if (!nome || nome.length < 2) return res.status(400).json({ error: "nome invalido" });
  if (!validProjectSlug(slug)) return res.status(400).json({ error: "slug invalido" });

  const { data, error } = await supabase
    .from("project_types")
    .insert({ nome, slug, descricao, criado_por: req.user.sub })
    .select("id,nome,slug,descricao,ativo,created_at")
    .single();
  if (error?.code === "23505") return res.status(409).json({ error: "slug ja existe" });
  if (error) return res.status(500).json({ error: "erro ao criar tipo de projeto" });
  return res.status(201).json(data);
});

app.get("/api/notas", requireAuth, async (req, res) => {
  const projetoSlug = req.query.projeto ? sanitizeText(req.query.projeto, 40).toLowerCase() : "";
  if (projetoSlug && !validProjectSlug(projetoSlug)) {
    return res.status(400).json({ error: "projeto invalido" });
  }
  let query = supabase
    .from("study_notes")
    .select("id,titulo,conteudo,tag,projeto_slug,created_at")
    .eq("user_id", req.user.sub)
    .order("created_at", { ascending: false })
    .limit(500);

  if (projetoSlug) query = query.eq("projeto_slug", projetoSlug);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: "erro ao listar notas" });
  return res.json(data);
});

app.post("/api/notas", requireAuth, async (req, res) => {
  const { titulo = "", conteudo = "", tag = "descoberta", projeto = "geral" } = req.body || {};
  if (!conteudo || typeof conteudo !== "string") {
    return res.status(400).json({ error: "conteudo e obrigatorio" });
  }

  const payload = {
    user_id: req.user.sub,
    titulo: sanitizeText(titulo, 140),
    conteudo: sanitizeText(conteudo, 4000),
    tag: sanitizeText(tag, 20),
    projeto_slug: sanitizeText(projeto, 40).toLowerCase(),
  };
  if (!payload.conteudo) return res.status(400).json({ error: "conteudo e obrigatorio" });
  if (!allowedTags.has(payload.tag)) return res.status(400).json({ error: "tag invalida" });
  if (!validProjectSlug(payload.projeto_slug)) return res.status(400).json({ error: "projeto invalido" });

  const { data, error } = await supabase
    .from("study_notes")
    .insert(payload)
    .select("id,titulo,conteudo,tag,projeto_slug,created_at")
    .single();

  if (error?.code === "23503") return res.status(400).json({ error: "tipo de projeto nao existe" });
  if (error) return res.status(500).json({ error: "erro ao criar nota" });
  return res.status(201).json(data);
});

app.delete("/api/notas/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id invalido" });

  const { error } = await supabase
    .from("study_notes")
    .delete()
    .eq("id", id)
    .eq("user_id", req.user.sub);
  if (error) return res.status(500).json({ error: "erro ao excluir nota" });
  return res.status(204).send();
});

app.get("/api/checklist-state", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("checklist_state")
    .select("state,updated_at")
    .eq("user_id", req.user.sub)
    .maybeSingle();

  if (error) return res.status(500).json({ error: "erro ao buscar checklist" });
  if (!data) return res.json({ state: {} });
  return res.json(data);
});

app.put("/api/checklist-state", requireAuth, async (req, res) => {
  const state = req.body?.state;
  if (!validateChecklistState(state)) {
    return res.status(400).json({ error: "state invalido" });
  }

  const { data, error } = await supabase
    .from("checklist_state")
    .upsert(
      { user_id: req.user.sub, state, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select("state,updated_at")
    .single();

  if (error) return res.status(500).json({ error: "erro ao salvar checklist" });
  return res.json(data);
});

app.get("/api/curriculum", requireAuth, async (_req, res) => {
  const { data, error } = await supabase
    .from("project_curriculum")
    .select("slug,content,updated_at")
    .in("slug", ["proj1", "proj2", "proj3"]);
  if (error) return res.status(500).json({ error: "erro ao listar curriculum" });
  return res.json(data || []);
});

app.get("/api/curriculum/:slug", requireAuth, async (req, res) => {
  const slug = sanitizeText(req.params.slug, 40).toLowerCase();
  if (!curriculumSlugs.has(slug)) return res.status(400).json({ error: "projeto invalido" });

  const { data, error } = await supabase
    .from("project_curriculum")
    .select("slug,content,updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return res.status(500).json({ error: "erro ao buscar curriculum" });
  if (!data) return res.json({ slug, content: null, updated_at: null });
  return res.json(data);
});

app.put("/api/curriculum/:slug", requireAuth, async (req, res) => {
  const slug = sanitizeText(req.params.slug, 40).toLowerCase();
  if (!curriculumSlugs.has(slug)) return res.status(400).json({ error: "projeto invalido" });

  const content = req.body?.content;
  if (!validateCurriculumContent(content)) {
    return res.status(400).json({ error: "conteudo invalido" });
  }

  const { data, error } = await supabase
    .from("project_curriculum")
    .upsert(
      {
        slug,
        content,
        updated_by: req.user.sub,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select("slug,content,updated_at")
    .single();

  if (error) return res.status(500).json({ error: "erro ao salvar curriculum" });
  return res.json(data);
});

app.use((err, _req, res, _next) => {
  if (err?.message === "Origem nao permitida pelo CORS.") {
    return res.status(403).json({ error: err.message });
  }
  return res.status(500).json({ error: "erro interno" });
});

app.listen(port, () => {
  console.log(`API online em http://localhost:${port}`);
});
