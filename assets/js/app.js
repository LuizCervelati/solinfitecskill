window.CRONOGRAMA_API_BASE_URL = "https://solinfitecskill.onrender.com";
function toggle(el){
  el.classList.toggle('open');
  updateAllProgress();
}

function chk(e, li){
  e.stopPropagation();
  li.classList.toggle('done');
  li.querySelector('.check-box').textContent = li.classList.contains('done') ? '✓' : '';
  saveState();
  updateAllProgress();
}

function updateAllProgress(){
  [['p1',1],['p2',2],['p3',3]].forEach(([pid,n])=>{
    const sec = document.getElementById('steps-'+pid);
    if(!sec) return;
    const all = sec.querySelectorAll('.checklist li').length;
    const done = sec.querySelectorAll('.checklist li.done').length;
    const pct = all ? Math.round(done/all*100) : 0;
    const bar = document.getElementById('prog'+n+'-bar');
    const txt = document.getElementById('prog'+n+'-txt');
    if(bar) bar.style.width = pct+'%';
    if(txt) txt.textContent = pct+'%';
  });
}

function saveState(){
  const state = {};
  document.querySelectorAll('.checklist li').forEach((li,i)=>{ state[i]=li.classList.contains('done'); });
  try{ localStorage.setItem('soli-v2', JSON.stringify(state)); }catch(e){}
  scheduleChecklistSync(state);
}

window.addEventListener('DOMContentLoaded',()=>{
  bindUIEvents();
  stripInlineHandlers();
  try{
    const saved = JSON.parse(localStorage.getItem('soli-v2')||'{}');
    document.querySelectorAll('.checklist li').forEach((li,i)=>{
      if(saved[i]){
        li.classList.add('done');
        li.querySelector('.check-box').textContent='✓';
      }
    });
  }catch(e){}
  updateAllProgress();
  initAnki();
  loadChecklistFromApi();
});
function bindUIEvents() {
  // 1. Captura o clique no link "Cadastre-se" / "Voltar para o Login" de forma nativa
  document.addEventListener('click', (event) => {
      const toggleLink = event.target.closest('#auth-toggle-link');
      if (toggleLink) {
          event.preventDefault();
          toggleAuthMode(); // Chama a função que altera a tela
          return;
      }
  });

  // ... o restante do seu código original da função bindUIEvents continua aqui para baixo ...
}

function bindUIEvents(){
  document.addEventListener('click', (event) => {
    const checklistItem = event.target.closest('.checklist li');
    if(checklistItem){
      chk(event, checklistItem);
      return;
    }

    const step = event.target.closest('.step');
    if(step){
      toggle(step);
      return;
    }

    const tabButton = event.target.closest('#anki-tabs .anki-tab');
    if(tabButton){
      const tab = tabButton.dataset.tab;
      if(tab){
        ankiTab(tabButton, tab);
      }
      return;
    }

    const action = event.target.closest('[data-action]');
    if(!action){
      return;
    }

    const actionType = action.dataset.action;
    if(actionType === 'save-anota') saveAnota();
    if(actionType === 'save-fc') saveFC();
    if(actionType === 'flip-card') flipCard();
    if(actionType === 'rate-card') rateCard(action.dataset.rate);
    if(actionType === 'skip-card') skipCard();
    if(actionType === 'save-dv') saveDv();
    if(actionType === 'save-gls') saveGls();
    if(actionType === 'delete-anota') deleteAnota(Number(action.dataset.id));
    if(actionType === 'toggle-dv') toggleDv(Number(action.dataset.id));
    if(actionType === 'delete-dv') deleteDv(Number(action.dataset.id));
    if(actionType === 'delete-gls') deleteGls(Number(action.dataset.id));
  });
}

function stripInlineHandlers(){
  document.querySelectorAll('[onclick],[onchange]').forEach((node) => {
    node.removeAttribute('onclick');
    node.removeAttribute('onchange');
  });
}

function apiBaseUrl(){
  return String(window.CRONOGRAMA_API_BASE_URL || "").trim().replace(/\/+$/,"");
}

function getAuthToken(){
  return String(localStorage.getItem("cronograma-auth-token") || "").trim();
}

function applyChecklistState(state){
  document.querySelectorAll(".checklist li").forEach((li, i) => {
    const done = Boolean(state[i]);
    li.classList.toggle("done", done);
    const box = li.querySelector(".check-box");
    if(box) box.textContent = done ? "✓" : "";
  });
  updateAllProgress();
}

async function loadChecklistFromApi(){
  const base = apiBaseUrl();
  const token = getAuthToken();
  if(!token) return;
  if(!base) return;
  try{
    const res = await fetch(`${base}/api/checklist-state`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if(!res.ok) return;
    const data = await res.json();
    if(data && data.state && typeof data.state === "object"){
      applyChecklistState(data.state);
    }
  }catch(_err){}
}

let checklistSyncTimer = null;
function scheduleChecklistSync(state){
  const base = apiBaseUrl();
  const token = getAuthToken();
  if(!token) return;
  if(!base) return;
  if(checklistSyncTimer) clearTimeout(checklistSyncTimer);
  checklistSyncTimer = setTimeout(async () => {
    try{
      await fetch(`${base}/api/checklist-state`,{
        method: "PUT",
        headers: {
          "Content-Type":"application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ state }),
      });
    }catch(_err){}
  }, 500);
}

/* ══════════════════════════════════════════
   ANKI — Anotações, Flashcards, Dúvidas, Glossário
══════════════════════════════════════════ */
const AK = {
  notas: 'soli-anki-notas',
  fc: 'soli-anki-fc',
  dv: 'soli-anki-dv',
  gls: 'soli-anki-gls'
};
const projLabels = {geral:'Geral',proj1:'Proj 01',proj2:'Proj 02',proj3:'Proj 03'};
const tagEmoji = {descoberta:'💡',importante:'⚠',revisao:'🔁',erro:'🐛'};

function akLoad(k){ try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(e){return []} }
function akSave(k,v){ try{localStorage.setItem(k,JSON.stringify(v))}catch(e){} }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

function ankiTab(btn, tab){
  document.querySelectorAll('.anki-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.anki-pane').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('apane-'+tab).classList.add('active');
  if(tab==='flashcards') initDeck();
}

/* ── ANOTAÇÕES ── */
function saveAnota(){
  const title = document.getElementById('an-title').value.trim();
  const body = document.getElementById('an-body').value.trim();
  if(!body) return;
  const tag = document.getElementById('an-tag').value;
  const proj = document.getElementById('an-proj').value;
  const notas = akLoad(AK.notas);
  notas.unshift({id:Date.now(), title, body, tag, proj,
    date: new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})});
  akSave(AK.notas, notas);
  document.getElementById('an-title').value='';
  document.getElementById('an-body').value='';
  const s = document.getElementById('an-status');
  s.style.opacity='1'; s.textContent='✓ Salvo!';
  setTimeout(()=>s.style.opacity='0', 1800);
  renderNotas();
}

function deleteAnota(id){
  akSave(AK.notas, akLoad(AK.notas).filter(n=>n.id!==id));
  renderNotas();
}

function renderNotas(){
  const notas = akLoad(AK.notas);
  document.getElementById('an-count').textContent = notas.length;
  const el = document.getElementById('an-list');
  if(!notas.length){
    el.innerHTML='<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--muted);text-align:center;padding:32px 0;opacity:.6">Nenhuma anotação ainda</div>';
    return;
  }
  el.innerHTML = notas.map(n=>`
    <div class="anki-card">
      <div class="ac-head">
        <div class="ac-title">${esc(n.title||n.body.slice(0,60))}</div>
        <button class="anki-del" data-action="delete-anota" data-id="${n.id}" title="Remover">✕</button>
      </div>
      ${n.title ? `<div class="ac-body">${esc(n.body)}</div>` : ''}
      <div class="ac-meta">
        <span class="anki-badge ${n.tag}">${tagEmoji[n.tag]||''} ${n.tag}</span>
        <span class="anki-badge proj">${projLabels[n.proj]||n.proj}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--muted);margin-left:auto">${n.date||''}</span>
      </div>
    </div>`).join('');
}

/* ── FLASHCARDS ── */
let fcDeck = [], fcIdx = 0, fcFlipped = false, fcSession = {facil:0,dificil:0,errei:0};

function saveFC(){
  const front = document.getElementById('fc-front').value.trim();
  const back = document.getElementById('fc-back').value.trim();
  if(!front||!back) return;
  const proj = document.getElementById('fc-proj').value;
  const cards = akLoad(AK.fc);
  cards.push({id:Date.now(), front, back, proj, score:0});
  akSave(AK.fc, cards);
  document.getElementById('fc-front').value='';
  document.getElementById('fc-back').value='';
  initDeck();
}

function initDeck(){
  const cards = akLoad(AK.fc);
  fcDeck = [...cards].sort(()=>Math.random()-.5);
  fcIdx = 0; fcFlipped = false;
  fcSession = {facil:0,dificil:0,errei:0};
  showCard();
}

function showCard(){
  const frontEl = document.getElementById('fc-front-txt');
  const backEl = document.getElementById('fc-back-txt');
  const hint = document.getElementById('fc-hint');
  const actions = document.getElementById('fc-actions');
  const info = document.getElementById('fc-deck-info');
  const stats = document.getElementById('fc-stats');

  if(!fcDeck.length){
    frontEl.innerHTML='<div class="fc-empty">Nenhum flashcard ainda.<br>Crie cards ao lado!</div>';
    backEl.style.display='none';
    hint.style.display='none';
    actions.style.display='none';
    info.textContent='';
    return;
  }
  if(fcIdx >= fcDeck.length){
    frontEl.innerHTML=`<div style="font-size:13px;text-align:center"><div style="font-size:24px;margin-bottom:8px">🎉</div>Rodada concluída!<br><span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted)">${fcSession.facil} fácil · ${fcSession.dificil} difícil · ${fcSession.errei} errei</span></div>`;
    backEl.style.display='none';
    hint.style.display='none';
    actions.style.display='none';
    return;
  }
  const card = fcDeck[fcIdx];
  info.textContent = `Card ${fcIdx+1} de ${fcDeck.length} · ${projLabels[card.proj]||card.proj}`;
  frontEl.textContent = card.front;
  backEl.textContent = card.back;
  backEl.style.display='none';
  hint.style.display='block';
  actions.style.display='none';
  fcFlipped = false;
  stats.textContent = fcSession.facil+fcSession.dificil+fcSession.errei > 0
    ? `✓ ${fcSession.facil} fácil  ≈ ${fcSession.dificil} difícil  ✗ ${fcSession.errei} errei`
    : '';
}

function flipCard(){
  if(fcIdx >= fcDeck.length) return;
  if(!fcFlipped){
    document.getElementById('fc-back-txt').style.display='block';
    document.getElementById('fc-hint').style.display='none';
    document.getElementById('fc-actions').style.display='flex';
    fcFlipped = true;
  }
}

function rateCard(rate){
  fcSession[rate]++;
  const cards = akLoad(AK.fc);
  const c = fcDeck[fcIdx];
  const idx = cards.findIndex(x=>x.id===c.id);
  if(idx>=0){ cards[idx].score = rate==='facil' ? (cards[idx].score||0)+1 : (rate==='errei' ? 0 : cards[idx].score); }
  akSave(AK.fc, cards);
  fcIdx++;
  showCard();
}

function skipCard(){ fcIdx++; showCard(); }

/* ── DÚVIDAS ── */
function saveDv(){
  const body = document.getElementById('dv-body').value.trim();
  if(!body) return;
  const proj = document.getElementById('dv-proj').value;
  const items = akLoad(AK.dv);
  items.unshift({id:Date.now(), body, proj, resolved:false,
    date: new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})});
  akSave(AK.dv, items);
  document.getElementById('dv-body').value='';
  renderDv();
}

function toggleAuthMode() {
  const container = document.getElementById('auth-container'); 
  const title = document.querySelector('#auth-card h2') || document.querySelector('.login-container h2') || document.querySelector('h2');
  const submitBtn = document.querySelector('.btn-submit') || document.querySelector('button[type="submit"]') || document.querySelector('.btn');
  const toggleLink = document.getElementById('auth-toggle-link');
  const nameField = document.getElementById('name-field-container'); 

  const isLogin = submitBtn.textContent.trim().toLowerCase() === 'entrar';

  if (isLogin) {
      if(title) title.textContent = 'Criar Conta';
      if(submitBtn) submitBtn.textContent = 'Cadastrar';
      if(toggleLink) toggleLink.innerHTML = 'Já tem conta? Faça Login';
      if(nameField) nameField.style.display = 'block'; 
  } else {
      if(title) title.textContent = 'Acessar Cronograma';
      if(submitBtn) submitBtn.textContent = 'Entrar';
      if(toggleLink) toggleLink.innerHTML = 'Não tem conta? Cadastre-se';
      if(nameField) nameField.style.display = 'none'; 
  }
}

// COLE ESSE BLOCO EXATAMENTE AQUI (LOGO ABAIXO DA FUNÇÃO):
document.addEventListener('click', (event) => {
  const toggleLink = event.target.closest('#auth-toggle-link');
  if (toggleLink) {
      event.preventDefault();
      toggleAuthMode(); // Agora sim o clique vai disparar a função!
  }
});

function toggleDv(id){
  const items = akLoad(AK.dv).map(i=>i.id===id?{...i,resolved:!i.resolved}:i);
  akSave(AK.dv, items);
  renderDv();
}

function deleteDv(id){
  akSave(AK.dv, akLoad(AK.dv).filter(i=>i.id!==id));
  renderDv();
}

function renderDv(){
  const items = akLoad(AK.dv);
  const open = items.filter(i=>!i.resolved).length;
  document.getElementById('dv-open-count').textContent = open;
  const el = document.getElementById('dv-list');
  if(!items.length){
    el.innerHTML='<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--muted);text-align:center;padding:32px 0;opacity:.6">Nenhuma dúvida registrada</div>';
    return;
  }
  el.innerHTML = items.map(i=>`
    <div class="anki-dv-row">
      <input type="checkbox" ${i.resolved?'checked':''} data-action="toggle-dv" data-id="${i.id}">
      <div style="flex:1">
        <div class="anki-dv-label ${i.resolved?'resolved':''}" data-action="toggle-dv" data-id="${i.id}">${esc(i.body)}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--muted);margin-top:4px">${projLabels[i.proj]||i.proj} · ${i.date||''}</div>
      </div>
      <button class="anki-del" data-action="delete-dv" data-id="${i.id}">✕</button>
    </div>`).join('');
}

/* ── GLOSSÁRIO ── */
function saveGls(){
  const term = document.getElementById('gls-term').value.trim();
  const def = document.getElementById('gls-def').value.trim();
  if(!term||!def) return;
  const items = akLoad(AK.gls);
  items.unshift({id:Date.now(), term, def});
  akSave(AK.gls, items);
  document.getElementById('gls-term').value='';
  document.getElementById('gls-def').value='';
  renderGls();
}

function deleteGls(id){
  akSave(AK.gls, akLoad(AK.gls).filter(i=>i.id!==id));
  renderGls();
}

function renderGls(){
  const items = akLoad(AK.gls);
  document.getElementById('gls-count').textContent = items.length;
  const el = document.getElementById('gls-list');
  if(!items.length){
    el.innerHTML='<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--muted);text-align:center;padding:32px 0;opacity:.6">Adicione termos conforme estudar</div>';
    return;
  }
  el.innerHTML = items.map(i=>`
    <div class="gls-row">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="gls-term">${esc(i.term)}</div>
        <button class="anki-del" data-action="delete-gls" data-id="${i.id}">✕</button>
      </div>
      <div class="gls-def">${esc(i.def)}</div>
    </div>`).join('');
}

function initAnki(){
  const glsDefaults = [
    {id:1,term:'KafkaTemplate',def:'Classe do Spring Kafka usada no Producer para publicar mensagens em um tópico. Ex: kafkaTemplate.send("topico", objeto)'},
    {id:2,term:'@KafkaListener',def:'Anotação que marca um método como consumidor de um tópico Kafka. O método é chamado automaticamente quando uma mensagem chega.'},
    {id:3,term:'@ControllerAdvice',def:'Intercepta exceções em qualquer Controller e permite retornar erros padronizados em JSON. Evita expor stack trace para o cliente.'},
    {id:4,term:'Flyway',def:'Ferramenta de versionamento de banco. Executa arquivos SQL (V1__, V2__...) em ordem garantindo que o schema esteja sempre atualizado.'},
    {id:5,term:'SecurityFilterChain',def:'Forma atual (Spring 6+) de configurar o Spring Security. Substitui o antigo WebSecurityConfigurerAdapter que foi removido.'},
  ];
  if(!akLoad(AK.gls).length){ akSave(AK.gls, glsDefaults); }

  const fcDefaults = [
    {id:1,front:'Qual a diferença entre @Component, @Service e @Repository?',back:'São sinônimos funcionalmente — todas registram um bean. Mas têm semântica diferente: @Service = regras de negócio, @Repository = acesso a dados (+ tratamento de exceções JPA), @Component = uso genérico.',proj:'proj1',score:0},
    {id:2,front:'O que é um Consumer Group no Kafka?',back:'Grupo de consumers que dividem as partições de um tópico entre si. Garante que cada mensagem seja processada por apenas um consumer do grupo — útil para escalar o processamento.',proj:'proj2',score:0},
    {id:3,front:'Qual o fluxo de um request com JWT no Spring Security?',back:'1. Request chega → JwtFilter intercepta\n2. Extrai o token do header Authorization\n3. Valida e extrai o usuário\n4. Seta o Authentication no SecurityContext\n5. Request passa para o Controller',proj:'proj1',score:0},
  ];
  if(!akLoad(AK.fc).length){ akSave(AK.fc, fcDefaults); }

  renderNotas(); renderDv(); renderGls(); initDeck();
}

function handleLogout() {
  localStorage.removeItem("cronograma-auth-token");
  window.location.reload();
}
