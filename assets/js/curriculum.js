/* Curriculum: parse, render, load and edit project content (proj1–proj3) */

const CURRICULUM_PROJECTS = [
  { slug: "proj1", sectionId: "proj1", stepsId: "steps-p1", progNum: 1, dotBorder: "var(--green-mid)" },
  { slug: "proj2", sectionId: "proj2", stepsId: "steps-p2", progNum: 2, dotBorder: "var(--blue-mid)" },
  { slug: "proj3", sectionId: "proj3", stepsId: "steps-p3", progNum: 3, dotBorder: "var(--amber-mid)" },
];

let curriculumEditMode = false;
let curriculumUser = null;
const curriculumCache = {};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function curriculumApiBase() {
  return String(window.CRONOGRAMA_API_BASE_URL || "").trim().replace(/\/+$/, "");
}

function curriculumAuthHeaders() {
  const token = String(localStorage.getItem("cronograma-auth-token") || "").trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function canEditCurriculum() {
  return Boolean(curriculumUser?.id);
}

function checklistItemText(li) {
  const clone = li.cloneNode(true);
  clone.querySelector(".check-box")?.remove();
  return clone.textContent.trim();
}

function parseToolsList(el) {
  return [...el.querySelectorAll(".tool-item")].map((item) => ({
    abbr: item.querySelector(".tool-icon")?.textContent?.trim() || "",
    iconStyle: item.querySelector(".tool-icon")?.getAttribute("style") || "",
    name: item.querySelector(".tool-name")?.textContent?.trim() || "",
    use: item.querySelector(".tool-use")?.textContent?.trim() || "",
  }));
}

function parseClassBox(box) {
  const header = box.querySelector(".class-box-header");
  const stereotype = header?.querySelector(".stereotype")?.textContent?.trim() || "";
  const name = (header?.textContent || "").replace(stereotype, "").trim();
  return {
    stereotype,
    name,
    headerColor: header?.style.color || "",
    borderTop: box.style.borderTop || "",
    fields: [...box.querySelectorAll(".class-box-fields .class-field")].map((f) => ({
      ann: f.querySelector(".field-ann")?.textContent?.trim() || "",
      type: f.querySelector(".field-type")?.textContent?.trim() || "",
      name: f.querySelector(".field-name")?.textContent?.trim() || "",
    })),
    methods: [...box.querySelectorAll(".class-box-methods .class-method")].map((m) =>
      m.textContent.trim()
    ),
  };
}

function parseClassDiagram(section) {
  const title = section.querySelector(".diagram-title")?.textContent?.trim() || "";
  const diagram = section.querySelector(".class-diagram");
  const boxes = [];
  const connectors = [];
  if (!diagram) return { type: "class", title, boxes, connectors };
  for (const child of diagram.children) {
    if (child.classList.contains("class-box")) boxes.push(parseClassBox(child));
    else if (child.style?.display === "flex" || child.textContent?.trim().match(/^[⇐⇒⇦↔]/)) {
      connectors.push(child.textContent?.trim() || "⇐");
    }
  }
  return { type: "class", title, boxes, connectors };
}

function parseArchDiagram(section) {
  const title = section.querySelector(".diagram-title")?.textContent?.trim() || "";
  const diagram = section.querySelector(".arch-diagram");
  const nodes = [];
  const arrows = [];
  if (!diagram) return { type: "arch", title, nodes, arrows };
  for (const child of diagram.children) {
    if (child.classList.contains("arch-node-box")) {
      nodes.push({
        icon: child.querySelector(".arch-icon")?.textContent?.trim() || "",
        iconStyle: child.querySelector(".arch-icon")?.getAttribute("style") || "",
        label: (child.querySelector(".arch-label")?.innerHTML || "").replace(/<br\s*\/?>/gi, "\n"),
        sublabel: child.querySelector(".arch-sublabel")?.textContent?.trim() || "",
      });
    } else if (child.classList.contains("arch-arrow")) {
      arrows.push({ label: child.querySelector(".arch-arrow-label")?.textContent?.trim() || "" });
    }
  }
  return { type: "arch", title, nodes, arrows };
}

function parseDbDiagram(section) {
  const title = section.querySelector(".diagram-title")?.textContent?.trim() || "";
  const diagram = section.querySelector(".db-diagram");
  const tables = [];
  const relations = [];
  if (!diagram) return { type: "db", title, tables, relations };
  for (const child of diagram.children) {
    if (child.classList.contains("db-table")) {
      tables.push({
        name: (child.querySelector(".db-table-header")?.textContent || "").trim(),
        icon: child.querySelector(".tbl-icon")?.textContent?.trim() || "",
        headerColor: child.querySelector(".db-table-header")?.style.color || "",
        borderTop: child.style.borderTop || "",
        columns: [...child.querySelectorAll(".db-col")].map((col) => ({
          key: col.querySelector(".col-key")?.textContent?.trim() || "",
          keyStyle: col.querySelector(".col-key")?.getAttribute("style") || "",
          name: col.querySelector(".col-name")?.textContent?.trim() || "",
          type: col.querySelector(".col-type")?.textContent?.trim() || "",
          constraint: col.querySelector(".col-constraint")?.textContent?.trim() || "",
        })),
      });
    } else if (child.style?.flexDirection === "column" || child.querySelector("span")) {
      const label = child.querySelector("span")?.textContent?.trim() || "";
      const symbol = [...child.querySelectorAll("span")].pop()?.textContent?.trim() || "↔";
      const symbolColor = [...child.querySelectorAll("span")].pop()?.style.color || "";
      if (label || symbol !== "↔") relations.push({ label, symbol, symbolColor });
    }
  }
  return { type: "db", title, tables, relations };
}

function parseStepBlocks(sbg) {
  const blocks = [];
  if (!sbg) return blocks;
  for (const child of sbg.children) {
    const checklist = child.querySelector(".checklist");
    if (checklist) {
      blocks.push({
        type: "checklist",
        label: child.querySelector(".sub-label")?.textContent?.trim() || "Tarefas",
        items: [...checklist.querySelectorAll("li")].map(checklistItemText),
      });
      continue;
    }
    if (child.querySelector(".tools-list")) {
      blocks.push({
        type: "tools",
        label: child.querySelector(".sub-label")?.textContent?.trim() || "Ferramentas",
        items: parseToolsList(child),
      });
      continue;
    }
    if (child.classList.contains("deliverable")) {
      blocks.push({ type: "deliverable", html: child.innerHTML.trim() });
      continue;
    }
    if (child.classList.contains("folder-tree-wrap")) {
      blocks.push({
        type: "folder-tree",
        title: child.querySelector(".ft-title")?.textContent?.trim() || "",
        html: child.querySelector(".folder-tree")?.innerHTML?.trim() || "",
      });
      continue;
    }
    if (child.classList.contains("arch-section")) {
      if (child.querySelector(".arch-diagram")) blocks.push(parseArchDiagram(child));
      else if (child.querySelector(".class-diagram")) blocks.push(parseClassDiagram(child));
      else if (child.querySelector(".db-diagram")) blocks.push(parseDbDiagram(child));
    }
  }
  return blocks;
}

function parseStep(stepEl) {
  return {
    num: stepEl.querySelector(".step-num")?.textContent?.trim() || "",
    title: stepEl.querySelector(".step-title")?.textContent?.trim() || "",
    duration: stepEl.querySelector(".step-duration")?.textContent?.trim() || "",
    blocks: parseStepBlocks(stepEl.querySelector(".step-body .sbg")),
  };
}

function parseProjectHeader(section) {
  return {
    badge: section.querySelector(".proj-badge")?.textContent?.trim() || "",
    title: section.querySelector(".proj-title")?.textContent?.trim() || "",
    desc: section.querySelector(".proj-desc")?.textContent?.trim() || "",
    tags: [...section.querySelectorAll(".proj-tags .tag")].map((t) => t.textContent.trim()),
  };
}

function parseProjectFromDom(meta) {
  const section = document.getElementById(meta.sectionId);
  if (!section) return null;
  const stepsEl = document.getElementById(meta.stepsId);
  return {
    header: parseProjectHeader(section),
    steps: stepsEl ? [...stepsEl.querySelectorAll(".step")].map(parseStep) : [],
  };
}

function renderChecklistBlock(block, accentStyle) {
  const items = (block.items || [])
    .map(
      (text) =>
        `<li><span class="check-box"></span>${esc(text)}</li>`
    )
    .join("");
  return `<div>
    <div class="sub-label">${esc(block.label)}</div>
    <ul class="checklist">${items}</ul>
    ${curriculumEditMode ? `<button type="button" class="curriculum-add-btn" data-curriculum-add="checklist-item">+ subtópico</button>` : ""}
  </div>`;
}

function renderToolsBlock(block) {
  const items = (block.items || [])
    .map(
      (t) => `<div class="tool-item"><div class="tool-icon" style="${esc(t.iconStyle)}">${esc(t.abbr)}</div><div><div class="tool-name">${esc(t.name)}</div><div class="tool-use">${esc(t.use)}</div></div></div>`
    )
    .join("");
  return `<div>
    <div class="sub-label">${esc(block.label)}</div>
    <div class="tools-list">${items}</div>
  </div>`;
}

function renderArchBlock(block) {
  let html = "";
  const nodes = block.nodes || [];
  const arrows = block.arrows || [];
  nodes.forEach((node, i) => {
    const labelHtml = esc(node.label).replace(/\n/g, "<br>");
    html += `<div class="arch-node-box">
      <div class="arch-icon" style="${esc(node.iconStyle)}">${esc(node.icon)}</div>
      <div class="arch-label">${labelHtml}</div>
      <div class="arch-sublabel">${esc(node.sublabel)}</div>
    </div>`;
    if (i < arrows.length) {
      html += `<div class="arch-arrow"><div class="arch-arrow-line"></div><div class="arch-arrow-label">${esc(arrows[i].label)}</div></div>`;
    }
  });
  return `<div class="arch-section" data-curriculum-diagram="arch">
    <div class="diagram-title">${esc(block.title)}</div>
    <div class="arch-diagram">${html}</div>
    ${curriculumEditMode ? `<button type="button" class="curriculum-edit-diagram-btn" data-curriculum-diagram-edit="arch">Editar arquitetura</button>` : ""}
  </div>`;
}

function renderClassBlock(block) {
  let inner = "";
  const boxes = block.boxes || [];
  const connectors = block.connectors || [];
  boxes.forEach((box, i) => {
    const fields = (box.fields || [])
      .map(
        (f) =>
          `<div class="class-field"><span class="field-ann">${esc(f.ann)}</span><span class="field-type">${esc(f.type)}</span><span class="field-name">${esc(f.name)}</span></div>`
      )
      .join("");
    const methods = (box.methods || [])
      .map((m) => `<div class="class-method">${esc(m)}</div>`)
      .join("");
    inner += `<div class="class-box" style="${box.borderTop ? `border-top:${esc(box.borderTop)};` : ""}">
      <div class="class-box-header" style="color:${esc(box.headerColor)}">
        <span class="stereotype">${esc(box.stereotype)}</span> ${esc(box.name)}
      </div>
      <div class="class-box-fields">${fields}</div>
      <div class="class-box-methods">${methods}</div>
    </div>`;
    if (i < connectors.length) {
      inner += `<div style="display:flex;align-items:center;color:var(--green);font-size:18px;padding:0 4px">${esc(connectors[i])}</div>`;
    }
  });
  return `<div class="arch-section" data-curriculum-diagram="class">
    <div class="diagram-title">${esc(block.title)}</div>
    <div class="class-diagram">${inner}</div>
    ${curriculumEditMode ? `<button type="button" class="curriculum-edit-diagram-btn" data-curriculum-diagram-edit="class">Editar classes</button>` : ""}
  </div>`;
}

function renderDbBlock(block) {
  let inner = "";
  const tables = block.tables || [];
  const relations = block.relations || [];
  tables.forEach((tbl, i) => {
    const cols = (tbl.columns || [])
      .map(
        (c) =>
          `<div class="db-col"><span class="col-key" style="${esc(c.keyStyle)}">${esc(c.key)}</span><span class="col-name">${esc(c.name)}</span><span class="col-type">${esc(c.type)}</span><span class="col-constraint">${esc(c.constraint)}</span></div>`
      )
      .join("");
    inner += `<div class="db-table" style="${tbl.borderTop ? `border-top:${esc(tbl.borderTop)};` : ""}">
      <div class="db-table-header" style="color:${esc(tbl.headerColor)}"><span class="tbl-icon">${esc(tbl.icon)}</span>${esc(tbl.name)}</div>
      ${cols}
    </div>`;
    if (i < relations.length) {
      const rel = relations[i];
      inner += `<div style="display:flex;align-items:center;flex-direction:column;gap:4px;padding:0 8px">
        <span style="font-family:monospace;font-size:10px;color:var(--muted)">${esc(rel.label)}</span>
        <span style="color:${esc(rel.symbolColor || "var(--blue)")};font-size:16px">${esc(rel.symbol || "↔")}</span>
      </div>`;
    }
  });
  return `<div class="arch-section" data-curriculum-diagram="db">
    <div class="diagram-title">${esc(block.title)}</div>
    <div class="db-diagram">${inner}</div>
    ${curriculumEditMode ? `<button type="button" class="curriculum-edit-diagram-btn" data-curriculum-diagram-edit="db">Editar banco</button>` : ""}
  </div>`;
}

function renderBlock(block, accentStyle) {
  if (block.type === "checklist") return renderChecklistBlock(block, accentStyle);
  if (block.type === "tools") return renderToolsBlock(block);
  if (block.type === "deliverable") {
    return `<div class="deliverable" style="${accentStyle}">${block.html || ""}</div>`;
  }
  if (block.type === "folder-tree") {
    return `<div class="folder-tree-wrap">
      <div class="ft-title">${esc(block.title)}</div>
      <div class="folder-tree">${block.html || ""}</div>
    </div>`;
  }
  if (block.type === "arch") return renderArchBlock(block);
  if (block.type === "class") return renderClassBlock(block);
  if (block.type === "db") return renderDbBlock(block);
  return "";
}

function renderStep(step, meta) {
  const accentStyle = `border-left-color:var(--p${meta.progNum})`;
  const blocksHtml = (step.blocks || []).map((b) => renderBlock(b, accentStyle)).join("");
  return `<div class="step">
    <div class="step-dot" style="border-color:${meta.dotBorder}"></div>
    <div class="step-inner">
      <div class="step-head">
        <span class="step-num">${esc(step.num)}</span>
        <span class="step-title">${esc(step.title)}</span>
        <span class="step-duration">${esc(step.duration)}</span>
        <span class="step-arrow">›</span>
      </div>
      <div class="step-body"><div class="sbg">${blocksHtml}</div></div>
    </div>
  </div>`;
}

function renderProjectHeader(section, header) {
  if (!header) return;
  const badge = section.querySelector(".proj-badge");
  const title = section.querySelector(".proj-title");
  const desc = section.querySelector(".proj-desc");
  const tagsEl = section.querySelector(".proj-tags");
  if (badge && header.badge) badge.textContent = header.badge;
  if (title && header.title) title.textContent = header.title;
  if (desc && header.desc) desc.textContent = header.desc;
  if (tagsEl && Array.isArray(header.tags)) {
    tagsEl.innerHTML = header.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  }
}

function renderProject(meta, data) {
  const section = document.getElementById(meta.sectionId);
  const stepsEl = document.getElementById(meta.stepsId);
  if (!section || !stepsEl || !data) return;
  if (data.header) renderProjectHeader(section, data.header);
  stepsEl.innerHTML = (data.steps || []).map((s) => renderStep(s, meta)).join("");
  curriculumCache[meta.slug] = data;
  refreshChecklistAfterRender();
  if (typeof updateAllProgress === "function") updateAllProgress();
}

function refreshChecklistAfterRender() {
  try {
    const saved = JSON.parse(localStorage.getItem("soli-v2") || "{}");
    if (typeof applyChecklistState === "function") applyChecklistState(saved);
  } catch (_e) {}
  if (typeof loadChecklistFromApi === "function") loadChecklistFromApi();
}

function setCurriculumEditMode(on) {
  curriculumEditMode = on;
  document.body.classList.toggle("curriculum-editing", on);
  const fields = document.querySelectorAll(
    "#proj1 .step-title, #proj1 .step-duration, #proj1 .sub-label, #proj1 .checklist li, #proj1 .diagram-title, " +
      "#proj2 .step-title, #proj2 .step-duration, #proj2 .sub-label, #proj2 .checklist li, #proj2 .diagram-title, " +
      "#proj3 .step-title, #proj3 .step-duration, #proj3 .sub-label, #proj3 .checklist li, #proj3 .diagram-title, " +
      "#proj1 .proj-title, #proj1 .proj-desc, #proj2 .proj-title, #proj2 .proj-desc, #proj3 .proj-title, #proj3 .proj-desc"
  );
  fields.forEach((el) => {
    el.contentEditable = on ? "true" : "false";
  });
}

function showCurriculumStatus(msg, isError) {
  const el = document.getElementById("curriculum-status");
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "var(--red)" : "var(--green)";
}

async function fetchCurriculum(slug) {
  const base = curriculumApiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/curriculum/${slug}`, {
      headers: curriculumAuthHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.content || null;
  } catch (_e) {
    return null;
  }
}

async function saveCurriculumSlug(meta) {
  const base = curriculumApiBase();
  if (!base) {
    showCurriculumStatus("API nao configurada", true);
    return;
  }
  const content = parseProjectFromDom(meta);
  if (!content) return;
  try {
    const res = await fetch(`${base}/api/curriculum/${meta.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...curriculumAuthHeaders() },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) {
      showCurriculumStatus(data.error || "Erro ao salvar", true);
      return;
    }
    curriculumCache[meta.slug] = content;
    showCurriculumStatus(`${meta.slug} salvo com sucesso`);
  } catch (_e) {
    showCurriculumStatus("Erro de conexao", true);
  }
}

async function saveAllCurriculum() {
  for (const meta of CURRICULUM_PROJECTS) {
    await saveCurriculumSlug(meta);
  }
}

async function importAllCurriculumFromPage() {
  const base = curriculumApiBase();
  if (!base) {
    showCurriculumStatus("API nao configurada", true);
    return;
  }
  for (const meta of CURRICULUM_PROJECTS) {
    const content = parseProjectFromDom(meta);
    if (!content) continue;
    try {
      const res = await fetch(`${base}/api/curriculum/${meta.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...curriculumAuthHeaders() },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json();
        showCurriculumStatus(data.error || `Erro ao importar ${meta.slug}`, true);
        return;
      }
    } catch (_e) {
      showCurriculumStatus("Erro de conexao", true);
      return;
    }
  }
  showCurriculumStatus("Conteudo importado da pagina para a nuvem");
  await loadAllCurriculum();
}

async function loadAllCurriculum() {
  const base = curriculumApiBase();
  if (!base) return;
  for (const meta of CURRICULUM_PROJECTS) {
    const content = await fetchCurriculum(meta.slug);
    if (content && content.steps?.length) {
      renderProject(meta, content);
    }
  }
}

function openDiagramEditor(blockEl) {
  const step = blockEl.closest(".step");
  if (!step) return;
  const section = blockEl.closest(".arch-section");
  const type = section?.dataset?.curriculumDiagram || "arch";
  let block;
  if (type === "arch") block = parseArchDiagram(section);
  else if (type === "class") block = parseClassDiagram(section);
  else block = parseDbDiagram(section);

  const modal = document.getElementById("curriculum-diagram-modal");
  const textarea = document.getElementById("curriculum-diagram-json");
  if (!modal || !textarea) return;
  textarea.value = JSON.stringify(block, null, 2);
  modal.dataset.targetSectionId = section?.id || "";
  modal._targetSection = section;
  modal.style.display = "flex";
}

function applyDiagramFromModal() {
  const modal = document.getElementById("curriculum-diagram-modal");
  const textarea = document.getElementById("curriculum-diagram-json");
  const section = modal?._targetSection;
  if (!modal || !textarea || !section) return;
  try {
    const block = JSON.parse(textarea.value);
    const html = renderBlock(block, "");
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const newSection = tmp.firstElementChild;
    if (newSection) section.replaceWith(newSection);
    modal.style.display = "none";
    showCurriculumStatus("Diagrama atualizado (salve para persistir)");
  } catch (_e) {
    showCurriculumStatus("JSON invalido", true);
  }
}

function addChecklistItem(btn) {
  const ul = btn.closest("div")?.querySelector(".checklist");
  if (!ul) return;
  const li = document.createElement("li");
  li.innerHTML = '<span class="check-box"></span>Novo subtópico';
  if (curriculumEditMode) li.contentEditable = "true";
  ul.appendChild(li);
}

function setupCurriculumToolbar(user) {
  curriculumUser = user;
  const bar = document.getElementById("curriculum-toolbar");
  if (!bar) return;
  if (!canEditCurriculum()) {
    bar.style.display = "none";
    return;
  }
  bar.style.display = "flex";
}

function bindCurriculumEvents() {
  document.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]");
    if (!action || !canEditCurriculum()) return;
    const type = action.dataset.action;
    if (type === "curriculum-edit-toggle") {
      const on = !curriculumEditMode;
      setCurriculumEditMode(on);
      action.textContent = on ? "Sair do modo edição" : "Editar conteúdo";
      return;
    }
    if (type === "curriculum-save-all") {
      saveAllCurriculum();
      return;
    }
    if (type === "curriculum-import") {
      importAllCurriculumFromPage();
      return;
    }
    if (type === "curriculum-diagram-apply") {
      applyDiagramFromModal();
      return;
    }
    if (type === "curriculum-diagram-close") {
      const modal = document.getElementById("curriculum-diagram-modal");
      if (modal) modal.style.display = "none";
      return;
    }
    const diagramBtn = e.target.closest("[data-curriculum-diagram-edit]");
    if (diagramBtn && curriculumEditMode) {
      openDiagramEditor(diagramBtn.closest(".arch-section"));
      return;
    }
    const addBtn = e.target.closest("[data-curriculum-add]");
    if (addBtn && curriculumEditMode && addBtn.dataset.curriculumAdd === "checklist-item") {
      addChecklistItem(addBtn);
    }
  });
}

async function initCurriculumEditor(user) {
  curriculumUser = user;
  setupCurriculumToolbar(user);
  bindCurriculumEvents();
  await loadAllCurriculum();
}

window.initCurriculumEditor = initCurriculumEditor;
