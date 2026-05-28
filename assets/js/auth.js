function apiBaseUrl() {
  return String(window.CRONOGRAMA_API_BASE_URL || "").trim().replace(/\/+$/, "");
}

function getAuthToken() {
  return String(localStorage.getItem("cronograma-auth-token") || "").trim();
}

function setAuthToken(token) {
  if (token) localStorage.setItem("cronograma-auth-token", token);
}

function clearAuthToken() {
  localStorage.removeItem("cronograma-auth-token");
}

function showAuthMessage(message, isError = false) {
  const el = document.getElementById("auth-message");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "var(--red)" : "var(--green)";
  el.style.display = "block";
}

async function verifySession() {
  const token = getAuthToken();
  if (!token) return false;
  try {
    const res = await fetch(`${apiBaseUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch (_err) {
    return false;
  }
}

async function redirectIfLoggedIn() {
  if (await verifySession()) {
    window.location.href = "index.html";
  }
}

async function submitLogin(event) {
  event.preventDefault();
  const email = String(document.getElementById("auth-email")?.value || "")
    .trim()
    .toLowerCase();
  const password = String(document.getElementById("auth-password")?.value || "");
  const btn = document.getElementById("auth-submit-btn");

  if (!email || !password) {
    return showAuthMessage("Informe email e senha", true);
  }

  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${apiBaseUrl()}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return showAuthMessage(data.error || "Falha no login", true);
    }
    setAuthToken(data.token);
    window.location.href = "index.html";
  } catch (_err) {
    showAuthMessage("Erro de conexao com a API", true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function submitRegister(event) {
  event.preventDefault();
  const nome = String(document.getElementById("auth-nome")?.value || "").trim();
  const email = String(document.getElementById("auth-email")?.value || "")
    .trim()
    .toLowerCase();
  const password = String(document.getElementById("auth-password")?.value || "");
  const btn = document.getElementById("auth-submit-btn");

  if (!nome || nome.length < 2) {
    return showAuthMessage("Informe seu nome (minimo 2 caracteres)", true);
  }
  if (!email || !password) {
    return showAuthMessage("Informe email e senha", true);
  }

  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${apiBaseUrl()}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return showAuthMessage(data.error || "Falha no cadastro", true);
    }
    setAuthToken(data.token);
    window.location.href = "index.html";
  } catch (_err) {
    showAuthMessage("Erro de conexao com a API", true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.dataset.page;
  if (!page) return;

  await redirectIfLoggedIn();

  const form = document.getElementById("auth-form");
  if (!form) return;

  if (page === "login") {
    form.addEventListener("submit", submitLogin);
  }
  if (page === "register") {
    form.addEventListener("submit", submitRegister);
  }
});
