const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const HOURS = ["08","11","14","17","20","23"];

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}
async function api(path, opt={}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: {"Content-Type": "application/json"},
    ...opt,
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  const data = await res.json().catch(() => ({ok:false}));
  if (res.status === 401) return {ok:false, auth:false, ...data};
  return data;
}
function toast(msg, bad) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.toggle("bad", !!bad);
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 4000);
}
function show(login) {
  $("#view-login").classList.toggle("hidden", !login);
  $("#view-app").classList.toggle("hidden", login);
}
function tab(name) {
  $$("[data-panel]").forEach(p => p.classList.toggle("hidden", p.dataset.panel !== name));
  $$(".nav-btn").forEach(b => b.setAttribute("aria-current", b.dataset.tab === name ? "page" : "false"));
  if (name === "conteudo") loadAgenda();
  if (name === "logs") loadLogs();
}
function openModal(html) {
  $("#modal-card").innerHTML = html;
  $("#modal").classList.remove("hidden");
  const f = $("#modal-card").querySelector("input,select,textarea,button");
  if (f) f.focus();
}
function closeModal() { $("#modal").classList.add("hidden"); }
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

function empty(title, text, cta) {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${cta?`<button class="btn btn-primary" type="button" id="empty-cta">${esc(cta)}</button>`:""}</div>`;
}

$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#login-err").textContent = "";
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  const data = await api("/api/login", {method:"POST", body:{ user: $("#user").value, password: $("#password").value }});
  btn.disabled = false;
  if (!data.ok) { $("#login-err").textContent = data.error || "Usuário ou senha"; return; }
  show(false); boot();
});
$("#btn-logout").addEventListener("click", async () => {
  await api("/api/logout", {method:"POST", body:{}});
  show(true);
});
$$(".nav-btn").forEach(b => b.addEventListener("click", () => tab(b.dataset.tab)));

let bots = [];
let channels = [];

async function loadBots() {
  bots = (await api("/api/bots")).bots || [];
  const el = $("#list-bots");
  if (!bots.length) {
    el.innerHTML = empty("Nenhum bot", "Cria no BotFather (username termina em bot) e cola o token.", "Novo bot");
    $("#empty-cta") && ($("#empty-cta").onclick = openBotForm);
    return;
  }
  el.innerHTML = bots.map(b => `
    <div class="row">
      <h3>${esc(b.name)}</h3>
      <span class="meta">${esc(b.username)}</span>
      <span></span>
      <div class="actions">
        <button class="btn btn-ghost" data-find-bot="${b.id}">Detectar grupos</button>
        <button class="btn btn-danger" data-del-bot="${b.id}">Excluir</button>
      </div>
    </div>`).join("");
  $$("[data-del-bot]").forEach(btn => btn.onclick = async () => {
    if (!confirm("Excluir este bot?")) return;
    await fetch("/api/bots/"+btn.dataset.delBot, {method:"DELETE", credentials:"same-origin"});
    toast("Bot excluído"); loadBots(); loadChannels();
  });
  $$("[data-find-bot]").forEach(btn => btn.onclick = () => runDiscover(btn.dataset.findBot, btn));
}

async function loadChannels() {
  channels = (await api("/api/channels")).channels || [];
  const el = $("#list-channels");
  if (!channels.length) {
    el.innerHTML = empty("Nenhum canal", "Bot como admin no grupo → Detectar → escolhe pelo nome.", "Novo canal");
    $("#empty-cta") && ($("#empty-cta").onclick = () => openChannel(null));
    return;
  }
  el.innerHTML = channels.map(c => `
    <div class="row">
      <div>
        <h3>${esc(c.name)}</h3>
        ${c.invite_link ? `<div class="meta">${esc(c.invite_link)}</div>` : ""}
      </div>
      <span class="meta">${esc(c.bot_username||"")}</span>
      <div class="hours-mini">${
        c.schedule_on
          ? String(c.schedule||"").split(",").filter(Boolean).map(h => `<span class="tag on">${esc(h.trim())}h</span>`).join("")
          : `<span class="tag">manual</span>`
      }</div>
      <div class="actions">
        <button class="btn btn-primary" data-send="${c.id}">Enviar</button>
        <button class="btn btn-ghost" data-edit="${c.id}">Editar</button>
        <button class="btn btn-danger" data-del-ch="${c.id}">Excluir</button>
      </div>
    </div>`).join("");
  $$("[data-send]").forEach(b => b.onclick = () => sendNow(b.dataset.send, b));
  $$("[data-edit]").forEach(b => b.onclick = () => openChannel(channels.find(x => String(x.id)===b.dataset.edit)));
  $$("[data-del-ch]").forEach(b => b.onclick = async () => {
    if (!confirm("Excluir canal?")) return;
    await fetch("/api/channels/"+b.dataset.delCh, {method:"DELETE", credentials:"same-origin"});
    toast("Canal excluído"); loadChannels();
  });
}

async function sendNow(id, btn) {
  btn.disabled = true; btn.textContent = "Enviando…";
  const d = await api("/api/channels/send", {method:"POST", body:{id: Number(id)}});
  btn.disabled = false; btn.textContent = "Enviar";
  if (!d.ok) return toast(d.error || "falhou", true);
  toast(`Enviados ${d.sent.length}/${d.total}`);
}

function openBotForm() {
  openModal(`
    <div class="sheet-h"><h3>Novo bot</h3></div>
    <div class="sheet-b">
      <form id="bot-save">
        <label for="b-name">Nome</label>
        <input id="b-name" required placeholder="Amanda RH">
        <label for="b-user">Username</label>
        <input id="b-user" required placeholder="@rh_amanda_bot">
        <p class="hint">Tem que terminar em bot.</p>
        <label for="b-token">Token</label>
        <input id="b-token" required autocomplete="off">
      </form>
    </div>
    <div class="sheet-f">
      <button class="btn btn-ghost" type="button" id="bot-cancel">Cancelar</button>
      <button class="btn btn-primary" type="submit" form="bot-save">Salvar</button>
    </div>`);
  $("#bot-cancel").onclick = closeModal;
  $("#bot-save").onsubmit = async (e) => {
    e.preventDefault();
    const d = await api("/api/bots", {method:"POST", body:{
      name: $("#b-name").value, username: $("#b-user").value, token: $("#b-token").value
    }});
    if (!d.ok) return toast("Não salvou", true);
    closeModal(); toast("Bot salvo"); loadBots();
  };
}

let wiz = null;

function openChannel(existing) {
  const sel = new Set(String(existing?.schedule || "08,11,14,17,20").split(",").map(s => s.trim()).filter(Boolean));
  wiz = {
    step: 1,
    existing,
    bot_id: existing?.bot_id || (bots[0] && bots[0].id) || "",
    name: existing?.name || "",
    chat_id: existing?.chat_id || "",
    welcome: existing?.welcome_text || "Oi, {name}! Sou a Amanda do RH. Sua entrada já foi aprovada.",
    json: existing?.json_url || "content/vagas.exemplo.json",
    schedule_on: !!existing?.schedule_on,
    hours: sel,
    err: "",
    hint: "Bot como admin + uma mensagem no grupo, depois Detectar.",
  };
  renderWiz();
}

function renderWiz() {
  if (!wiz) return;
  const opts = bots.map(b => `<option value="${b.id}" ${String(wiz.bot_id)===String(b.id)?"selected":""}>${esc(b.name)} (${esc(b.username)})</option>`).join("");
  const steps = ["Grupo","Conteúdo","Agenda"].map((l,i) => `<span class="${wiz.step===i+1?"on":""}">${i+1} ${l}</span>`).join("");
  let body = "";
  if (wiz.step === 1) {
    body = `
      <label for="c-bot">Bot</label>
      <select id="c-bot" required>${opts || "<option value=''>Cadastre um bot antes</option>"}</select>
      <button class="btn btn-ghost" type="button" id="c-detect" style="margin-bottom:14px">Detectar grupos deste bot</button>
      <label for="c-pick">Grupo encontrado</label>
      <select id="c-pick"><option value="">— Detectar —</option></select>
      <p class="hint" id="c-hint">${esc(wiz.hint)}</p>
      <label for="c-link">Ou @público / t.me/nome</label>
      <div class="input-row">
        <input id="c-link" placeholder="@empregosonline">
        <button class="btn btn-ghost" type="button" id="c-resolve">Resolver</button>
      </div>
      <p class="err" id="c-err" role="alert">${esc(wiz.err)}</p>
      <label for="c-name">Nome no painel</label>
      <input id="c-name" required value="${esc(wiz.name)}">
      <input type="hidden" id="c-chat" value="${esc(wiz.chat_id)}">
      <p class="hint" id="c-chat-vis">${wiz.chat_id ? "Grupo ligado." : "O ID entra sozinho quando você escolhe o grupo."}</p>`;
  } else if (wiz.step === 2) {
    body = `
      <label for="c-welcome">Boas-vindas no particular</label>
      <textarea id="c-welcome">${esc(wiz.welcome)}</textarea>
      <p class="hint">{name} vira o primeiro nome de quem pediu.</p>
      <label for="c-json">JSON (arquivo ou URL)</label>
      <input id="c-json" value="${esc(wiz.json)}">
      <p class="hint">text / photo / video — todo post com botão e link.</p>`;
  } else {
    body = `
      <label class="switch"><input type="checkbox" id="c-sched-on" ${wiz.schedule_on?"checked":""}> Agenda ligada</label>
      <p class="hint">Horário deste computador. Uma vez por hora.</p>
      <div class="hours" id="c-hours">
        ${HOURS.map(h => `<button type="button" aria-pressed="${wiz.hours.has(h)}" data-h="${h}">${h}h</button>`).join("")}
      </div>
      <p class="hint">Pra enviar com o painel fechado: Agenda → Instalar no sistema.</p>`;
  }
  openModal(`
    <div class="sheet-h">
      <h3>${wiz.existing ? "Editar canal" : "Novo canal"}</h3>
      <div class="steps">${steps}</div>
    </div>
    <div class="sheet-b">${body}</div>
    <div class="sheet-f">
      <button class="btn btn-ghost" type="button" id="wiz-back">${wiz.step===1?"Cancelar":"Voltar"}</button>
      <button class="btn btn-primary" type="button" id="wiz-next">${wiz.step===3?"Salvar":"Continuar"}</button>
    </div>`);
  bindWiz();
}

function readWizFields() {
  if (wiz.step === 1) {
    wiz.bot_id = $("#c-bot")?.value || wiz.bot_id;
    wiz.name = $("#c-name")?.value ?? wiz.name;
    wiz.chat_id = $("#c-chat")?.value ?? wiz.chat_id;
  }
  if (wiz.step === 2) {
    wiz.welcome = $("#c-welcome")?.value ?? wiz.welcome;
    wiz.json = $("#c-json")?.value ?? wiz.json;
  }
  if (wiz.step === 3) {
    wiz.schedule_on = !!$("#c-sched-on")?.checked;
  }
}

function bindWiz() {
  $("#wiz-back").onclick = () => {
    readWizFields();
    if (wiz.step === 1) { closeModal(); return; }
    wiz.step -= 1; wiz.err = ""; renderWiz();
  };
  $("#wiz-next").onclick = async () => {
    readWizFields();
    if (wiz.step === 1) {
      if (!wiz.chat_id) { wiz.err = "Escolhe um grupo na lista ou resolve um @público."; renderWiz(); return; }
      if (!wiz.name) wiz.name = "Canal";
      wiz.step = 2; wiz.err = ""; renderWiz(); return;
    }
    if (wiz.step === 2) { wiz.step = 3; renderWiz(); return; }
    const body = {
      name: wiz.name, chat_id: wiz.chat_id, bot_id: Number(wiz.bot_id),
      welcome_text: wiz.welcome, json_url: wiz.json,
      schedule: [...wiz.hours].join(",") || "08,11,14,17,20",
      schedule_on: wiz.schedule_on, active: true,
    };
    const d = wiz.existing
      ? await api("/api/channels/update", {method:"POST", body:{...body, id: wiz.existing.id}})
      : await api("/api/channels", {method:"POST", body});
    if (!d.ok) { toast(d.error || "Falhou", true); return; }
    closeModal();
    toast(d.invite_link ? "Canal salvo. Link com pedido gerado." : "Canal salvo");
    loadChannels();
  };
  if (wiz.step === 1) {
    $("#c-detect") && ($("#c-detect").onclick = () => fillDiscover($("#c-bot").value));
    $("#c-resolve") && ($("#c-resolve").onclick = async () => {
      const d = await api("/api/resolve", {method:"POST", body:{bot_id: Number($("#c-bot").value), link: $("#c-link").value}});
      if (!d.ok) { $("#c-err").textContent = d.error || "Não resolvi"; return; }
      applyChat(d);
    });
    $("#c-pick") && ($("#c-pick").onchange = () => {
      const o = $("#c-pick").selectedOptions[0];
      if (!o?.value) return;
      applyChat({chat_id: o.value, title: o.dataset.title || o.textContent});
    });
    if (wiz.bot_id) fillDiscover(wiz.bot_id, true);
  }
  if (wiz.step === 3) {
    $$("#c-hours button").forEach(btn => btn.onclick = () => {
      const h = btn.dataset.h;
      if (wiz.hours.has(h)) wiz.hours.delete(h); else wiz.hours.add(h);
      btn.setAttribute("aria-pressed", wiz.hours.has(h) ? "true" : "false");
    });
  }
}

function applyChat(chat) {
  wiz.chat_id = chat.chat_id;
  if (chat.title && !wiz.name) wiz.name = chat.title;
  if ($("#c-chat")) $("#c-chat").value = chat.chat_id;
  if ($("#c-name") && !$("#c-name").value && chat.title) $("#c-name").value = chat.title;
  if ($("#c-chat-vis")) $("#c-chat-vis").textContent = "Grupo ligado.";
  if ($("#c-err")) $("#c-err").textContent = "";
}

async function fillDiscover(botId, silent) {
  if (!botId) return;
  const d = silent
    ? await api("/api/discovered?bot_id=" + botId)
    : await api("/api/discover", {method:"POST", body:{bot_id: Number(botId)}});
  const chats = d.chats || [];
  const sel = $("#c-pick");
  if (!sel) return;
  if (!chats.length) {
    sel.innerHTML = "<option value=''>Nenhum grupo ainda</option>";
    if (!silent && $("#c-hint")) $("#c-hint").textContent = "Nada ainda. Bot é admin? Mensagem no grupo, Detectar de novo.";
    return;
  }
  sel.innerHTML = "<option value=''>Escolhe o grupo pelo nome</option>" +
    chats.map(c => `<option value="${esc(c.chat_id)}" data-title="${esc(c.title)}">${esc(c.title)} (${esc(c.chat_type)})</option>`).join("");
  if (!silent) toast(chats.length + " grupo(s)");
}

async function runDiscover(botId, btn) {
  btn.disabled = true;
  const d = await api("/api/discover", {method:"POST", body:{bot_id: Number(botId)}});
  btn.disabled = false;
  const n = (d.chats || []).length;
  if (!d.ok) return toast(d.error || "falhou", true);
  toast(n ? n + " grupo(s). Novo canal → escolhe o nome." : "Nenhum ainda. Bot admin + mensagem no grupo.");
}

$("#btn-new-bot").onclick = openBotForm;
$("#btn-new-channel").onclick = () => openChannel(null);

async function loadDaemon() {
  const d = await api("/api/daemon");
  const on = !!d.on;
  const pill = $("#daemon-pill");
  if (pill) { pill.textContent = on ? "ligado" : "parado"; pill.classList.toggle("on", on); pill.classList.toggle("off", !on); }
  if ($("#daemon-status")) $("#daemon-status").textContent = d.status || "";
  const live = $("#side-live");
  if (live) { live.classList.toggle("on", on); live.querySelector("span").textContent = on ? "aprovação on" : "aprovação off"; }
}
$("#btn-daemon-on").onclick = async () => { await api("/api/daemon/start", {method:"POST", body:{}}); loadDaemon(); toast("Aprovação ligada"); };
$("#btn-daemon-off").onclick = async () => { await api("/api/daemon/stop", {method:"POST", body:{}}); loadDaemon(); toast("Aprovação desligada"); };

async function loadLogs() {
  const ev = (await api("/api/events")).events || [];
  $("#list-logs").innerHTML = ev.length
    ? ev.map(e => `<div class="log-row"><span class="kind ${esc(e.kind)}">${esc(e.kind)}</span><span>${esc(e.detail)}</span><time>${esc(e.at)}</time></div>`).join("")
    : empty("Sem eventos", "Quando aprovar ou enviar, aparece aqui.");
}
$("#btn-refresh-logs").onclick = loadLogs;

async function loadAgenda() {
  const d = await api("/api/agenda");
  const cron = d.cron || {};
  if ($("#cron-title")) $("#cron-title").textContent = cron.installed ? "Cron instalado · " + (cron.how || "") : "Cron não instalado";
  if ($("#cron-status")) $("#cron-status").textContent = cron.installed
    ? (cron.detail || cron.how)
    : "Sem isso a agenda só roda com o painel aberto.";
  const list = d.channels || [];
  const el = $("#list-agenda");
  if (!list.length) {
    el.innerHTML = empty("Nada na agenda", "Liga a agenda no canal (Editar → passo 3).", "Ir para canais");
    $("#empty-cta") && ($("#empty-cta").onclick = () => tab("canais"));
    return;
  }
  el.innerHTML = list.map(c => `
    <div class="row">
      <h3>${esc(c.name)}</h3>
      <span class="status ${c.schedule_on?"on":""}">${c.schedule_on ? (c.due_now?"vence agora":"agendado") : "manual"}</span>
      <div class="hours-mini">${(c.hours||[]).map(h => `<span class="tag ${(c.sent_today||[]).includes(h)?"on":""}">${esc(h)}h</span>`).join("") || `<span class="tag">—</span>`}</div>
      <span class="meta">hoje ${(c.sent_today||[]).join(",") || "nada"} · ${esc(c.now_hour)}h</span>
    </div>`).join("");
}
$("#btn-refresh-agenda").onclick = loadAgenda;
$("#btn-cron-on").onclick = async () => {
  const d = await api("/api/agenda/install", {method:"POST", body:{}});
  if (!d.ok) return toast(d.error || "Não instalei", true);
  toast("Cron instalado"); loadAgenda();
};
$("#btn-cron-off").onclick = async () => {
  const d = await api("/api/agenda/uninstall", {method:"POST", body:{}});
  if (!d.ok) return toast(d.error || "Não removi", true);
  toast("Cron removido"); loadAgenda();
};

async function boot() {
  await loadBots(); await loadChannels(); await loadDaemon(); await loadLogs(); await loadAgenda();
  tab("canais");
}
(async () => {
  const me = await api("/api/me");
  if (me.ok) { show(false); boot(); } else show(true);
})();
