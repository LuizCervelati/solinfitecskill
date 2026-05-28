require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { supabase } = require("./supabase");

const app = express();
const port = Number(process.env.PORT || 8787);
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedTags = new Set(["descoberta", "importante", "revisao", "erro"]);
const allowedProjetos = new Set(["geral", "proj1", "proj2", "proj3"]);

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  throw new Error("CORS_ORIGIN e obrigatoria em producao.");
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

function validUserId(value) {
  return /^[a-zA-Z0-9_-]{3,64}$/.test(value);
}

function validateChecklistState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  const entries = Object.entries(state);
  if (entries.length > 5000) return false;
  return entries.every(([key, value]) => /^\d{1,6}$/.test(key) && typeof value === "boolean");
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "cronograma-backend" });
});

app.get("/api/notas", async (req, res) => {
  const projeto = req.query.projeto ? sanitizeText(req.query.projeto, 20) : "";
  if (projeto && !allowedProjetos.has(projeto)) {
    return res.status(400).json({ error: "projeto invalido" });
  }
  let query = supabase
    .from("study_notes")
    .select("id,titulo,conteudo,tag,projeto,created_at")
    .order("created_at", { ascending: false });

  if (projeto) query = query.eq("projeto", projeto);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

app.post("/api/notas", async (req, res) => {
  const { titulo = "", conteudo = "", tag = "descoberta", projeto = "geral" } = req.body || {};
  if (!conteudo || typeof conteudo !== "string") {
    return res.status(400).json({ error: "conteudo e obrigatorio" });
  }

  const payload = {
    titulo: sanitizeText(titulo, 140),
    conteudo: sanitizeText(conteudo, 4000),
    tag: sanitizeText(tag, 20),
    projeto: sanitizeText(projeto, 20),
  };
  if (!payload.conteudo) return res.status(400).json({ error: "conteudo e obrigatorio" });
  if (!allowedTags.has(payload.tag)) return res.status(400).json({ error: "tag invalida" });
  if (!allowedProjetos.has(payload.projeto)) return res.status(400).json({ error: "projeto invalido" });

  const { data, error } = await supabase
    .from("study_notes")
    .insert(payload)
    .select("id,titulo,conteudo,tag,projeto,created_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

app.delete("/api/notas/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id invalido" });

  const { error } = await supabase.from("study_notes").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
});

app.get("/api/checklist-state/:userId", async (req, res) => {
  const userId = sanitizeText(req.params.userId, 64);
  if (!validUserId(userId)) return res.status(400).json({ error: "userId invalido" });

  const { data, error } = await supabase
    .from("checklist_state")
    .select("user_id,state,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.json({ user_id: userId, state: {} });
  return res.json(data);
});

app.put("/api/checklist-state/:userId", async (req, res) => {
  const userId = sanitizeText(req.params.userId, 64);
  const state = req.body?.state;
  if (!validUserId(userId)) return res.status(400).json({ error: "userId invalido" });
  if (!validateChecklistState(state)) {
    return res.status(400).json({ error: "state invalido" });
  }

  const { data, error } = await supabase
    .from("checklist_state")
    .upsert(
      { user_id: userId, state, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select("user_id,state,updated_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

app.listen(port, () => {
  console.log(`API online em http://localhost:${port}`);
});

app.use((err, _req, res, _next) => {
  if (err?.message === "Origem nao permitida pelo CORS.") {
    return res.status(403).json({ error: err.message });
  }
  return res.status(500).json({ error: "erro interno" });
});
