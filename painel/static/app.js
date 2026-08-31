const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

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
  toast._t = setTimeout(() => el.classList.add("hidden"), 4200);
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
}
function closeModal() { $("#modal").classList.add("hidden"); }
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

function empty(title, text, cta, onclick) {
  return `<div class="card empty">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
    ${cta ? `<button class="btn btn-primary" type="button" id="empty-cta">${esc(cta)}</button>` : ""}
  </div>`;
}

$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#login-err").textContent = "";
  const data = await api("/api/login", {method:"POST", body:{
    user: $("#user").value, password: $("#password").value
  }});
  if (!data.ok) { $("#login-err").textContent = data.error || "Falhou"; return; }
  show(false);
  boot();
});

$("#btn-logout").addEventListener("click", async () => {
  await api("/api/logout", {method:"POST", body:{}});
  show(true);
});

$$(".nav-btn").forEach(b => b.addEventListener("click", () => tab(b.dataset.tab)));

let bots = [];
let channels = [];

async function loadBots() {
  const d = await api("/api/bots");
  bots = d.bots || [];
  const el = $("#list-bots");
  if (!bots.length) {
    el.innerHTML = empty("Nenhum bot", "Cria no BotFather, username termina em bot, cola o token.", "Novo bot");
    const cta = $("#empty-cta"); if (cta) cta.onclick = openBotForm;
    return;
  }
  el.innerHTML = bots.map(b => `
    <article class="entity">
      <div class="avatar" aria-hidden="true">${esc((b.name||"B")[0].toUpperCase())}</div>
      <div>
        <h3>${esc(b.name)}</h3>
        <div class="chips"><span class="chip mono">${esc(b.username)}</span></div>
      </div>
      <div class="actions">
        <button class="btn btn-ghost btn-sm" data-find-bot="${b.id}">Detectar grupos</button>
        <button class="btn btn-danger btn-sm" data-del-bot="${b.id}">Excluir</button>
      </div>
    </article>`).join("");
  $$("[data-del-bot]").forEach(btn => btn.onclick = async () => {
    if (!confirm("Excluir este bot?")) return;
    await fetch("/api/bots/" + btn.dataset.delBot, {method:"DELETE", credentials:"same-origin"});
    toast("Bot excluído");
    loadBots(); loadChannels();
  });
  $$("[data-find-bot]").forEach(btn => btn.onclick = () => runDiscover(btn.dataset.findBot, btn));
}

async function loadChannels() {
  const d = await api("/api/channels");
  channels = d.channels || [];
  const el = $("#list-channels");
  if (!channels.length) {
    el.innerHTML = empty("Nenhum canal", "Cadastre um bot, coloque como admin no grupo, Detectar, escolha pelo nome.", "Novo canal");
    const cta = $("#empty-cta"); if (cta) cta.onclick = () => openChannel(null);
    return;
  }
  el.innerHTML = channels.map(c => `
    <article class="entity">
      <div class="avatar">${esc((c.name||"C")[0].toUpperCase())}</div>
      <div>
        <h3>${esc(c.name)}</h3>
        <div class="chips">
          <span class="chip">${esc(c.bot_username || "bot")}</span>
          <span class="chip ${c.schedule_on ? "on" : ""}">${c.schedule_on ? "Agenda " + esc(c.schedule||"") : "só manual"}</span>
        </div>
        ${c.invite_link ? `<p class="muted mono" style="margin:8px 0 0">${esc(c.invite_link)}</p>` : ""}
      </div>
      <div class="actions">
        <button class="btn btn-primary btn-sm" data-send="${c.id}">Enviar agora</button>
        <button class="btn btn-ghost btn-sm" data-edit="${c.id}">Editar</button>
        <button class="btn btn-danger btn-sm" data-del-ch="${c.id}">Excluir</button>
      </div>
    </article>`).join("");
  $$("[data-send]").forEach(b => b.onclick = () => sendNow(b.dataset.send, b));
  $$("[data-edit]").forEach(b => b.onclick = () => openChannel(channels.find(x => String(x.id)===b.dataset.edit)));
  $$("[data-del-ch]").forEach(b => b.onclick = async () => {
    if (!confirm("Excluir canal?")) return;
    await fetch("/api/channels/" + b.dataset.delCh, {method:"DELETE", credentials:"same-origin"});
    toast("Canal excluído");
    loadChannels();
  });
}

async function sendNow(id, btn) {
  btn.disabled = true;
  const d = await api("/api/channels/send", {method:"POST", body:{id: Number(id)}});
  btn.disabled = false;
  if (!d.ok) return toast(d.error || "falhou", true);
  toast(`Enviados ${d.sent.length}/${d.total}` + (d.errors?.length ? " · " + d.errors[0] : ""));
}

function openBotForm() {
  openModal(`
    <h3>Novo bot</h3>
    <p class="muted">Username tem que terminar em bot. Token do BotFather.</p>
    <form id="bot-save">
      <label for="b-name">Nome</label><input id="b-name" required placeholder="Amanda RH">
      <label for="b-user">Username</label><input id="b-user" required placeholder="@rh_amanda_bot">
      <label for="b-token">Token</label><input id="b-token" required autocomplete="off">
      <div class="actions">
        <button class="btn btn-primary" type="submit">Salvar bot</button>
        <button class="btn btn-ghost" type="button" id="bot-cancel">Cancelar</button>
      </div>
    </form>`);
  $("#bot-cancel").onclick = closeModal;
  $("#bot-save").onsubmit = async (e) => {
    e.preventDefault();
    const d = await api("/api/bots", {method:"POST", body:{
      name: $("#b-name").value, username: $("#b-user").value, token: $("#b-token").value
    }});
    if (!d.ok) return toast("Não salvou", true);
    closeModal();
    toast("Bot salvo");
    loadBots();
  };
}

const HOURS = ["08","11","14","17","20","23"];

function openChannel(existing) {
  const opts = bots.map(b => `<option value="${b.id}" ${existing && existing.bot_id===b.id?"selected":""}>${esc(b.name)} (${esc(b.username)})</option>`).join("");
  const sel = new Set(String(existing?.schedule || "08,11,14,17,20").split(",").map(s => s.trim()).filter(Boolean));
  openModal(`
    <h3>${existing ? "Editar canal" : "Novo canal"}</h3>
    <p class="muted">Não cola ID. Bot admin → Detectar → escolhe pelo nome.</p>
    <form id="ch-save">
      <p class="step">1 · Bot e grupo</p>
      <label for="c-bot">Bot</label>
      <select id="c-bot" required>${opts || "<option value=''>Cadastre um bot antes</option>"}</select>
      <div class="actions" style="margin-bottom:12px">
        <button class="btn btn-ghost btn-sm" type="button" id="c-detect">Detectar grupos deste bot</button>
      </div>
      <label for="c-pick">Grupo encontrado</label>
      <select id="c-pick"><option value="">— Detectar —</option></select>
      <p class="muted" id="c-hint">Bot como admin + uma mensagem no grupo, depois Detectar.</p>
      <label for="c-link">Canal público (@nome ou t.me/nome)</label>
      <div class="input-row">
        <input id="c-link" placeholder="@empregosonline">
        <button class="btn btn-ghost" type="button" id="c-resolve">Resolver</button>
      </div>
      <p class="err" id="c-err"></p>
      <label for="c-name">Nome no painel</label>
      <input id="c-name" required value="${esc(existing?.name||"")}">
      <input type="hidden" id="c-chat" value="${esc(existing?.chat_id||"")}">
      <p class="muted mono" id="c-chat-vis">${existing?.chat_id ? "ID preenchido" : "ID entra sozinho."}</p>

      <p class="step">2 · Mensagem e JSON</p>
      <label for="c-welcome">Boas-vindas ({name} = primeiro nome)</label>
      <textarea id="c-welcome">${esc(existing?.welcome_text||"Oi, {name}! Sou a Amanda do RH. Sua entrada já foi aprovada.")}</textarea>
      <label for="c-json">JSON (arquivo ou URL)</label>
      <input id="c-json" value="${esc(existing?.json_url||"content/vagas.exemplo.json")}">

      <p class="step">3 · Agenda</p>
      <label class="switch"><input type="checkbox" id="c-sched-on" ${existing?.schedule_on ? "checked" : ""}> Agenda ligada</label>
      <div class="hours" id="c-hours">
        ${HOURS.map(h => `<button type="button" aria-pressed="${sel.has(h)}" data-h="${h}">${h}h</button>`).join("")}
      </div>
      <input type="hidden" id="c-sched" value="${esc([...sel].join(","))}">
      <p class="muted">Instala o cron em Agenda JSON pra enviar com o painel fechado.</p>
      <div class="actions">
        <button class="btn btn-primary" type="submit">Salvar canal</button>
        <button class="btn btn-ghost" type="button" id="ch-cancel">Cancelar</button>
      </div>
    </form>`);
  $("#ch-cancel").onclick = closeModal;
  $$("#c-hours button").forEach(btn => btn.onclick = () => {
    btn.setAttribute("aria-pressed", btn.getAttribute("aria-pressed") === "true" ? "false" : "true");
    $("#c-sched").value = $$("#c-hours button").filter(b => b.getAttribute("aria-pressed")==="true").map(b => b.dataset.h).join(",");
  });
  $("#c-detect").onclick = () => fillDiscover($("#c-bot").value);
  $("#c-resolve").onclick = async () => {
    $("#c-err").textContent = "";
    const d = await api("/api/resolve", {method:"POST", body:{bot_id: Number($("#c-bot").value), link: $("#c-link").value}});
    if (!d.ok) { $("#c-err").textContent = d.error || "Não resolvi"; return; }
    applyChat(d);
  };
  $("#c-pick").onchange = () => {
    const o = $("#c-pick").selectedOptions[0];
    if (!o || !o.value) return;
    applyChat({chat_id: o.value, title: o.dataset.title || o.textContent});
  };
  $("#ch-save").onsubmit = async (e) => {
    e.preventDefault();
    $("#c-err").textContent = "";
    if (!$("#c-chat").value) {
      $("#c-err").textContent = "Escolhe um grupo na lista ou resolve um @público.";
      return;
    }
    const body = {
      name: $("#c-name").value,
      chat_id: $("#c-chat").value,
      bot_id: Number($("#c-bot").value),
      welcome_text: $("#c-welcome").value,
      json_url: $("#c-json").value,
      schedule: $("#c-sched").value || "08,11,14,17,20",
      schedule_on: $("#c-sched-on").checked,
      active: true,
    };
    const d = existing
      ? await api("/api/channels/update", {method:"POST", body:{...body, id: existing.id}})
      : await api("/api/channels", {method:"POST", body});
    if (!d.ok) { $("#c-err").textContent = d.error || "Falhou"; return; }
    closeModal();
    toast(d.invite_link ? "Canal salvo. Link com pedido gerado." : "Canal salvo");
    loadChannels();
  };
  if ($("#c-bot").value) fillDiscover($("#c-bot").value, true);
}

function applyChat(chat) {
  $("#c-chat").value = chat.chat_id;
  $("#c-chat-vis").textContent = "ID preenchido";
  if (chat.title && !$("#c-name").value) $("#c-name").value = chat.title;
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
    if (!silent) $("#c-hint").textContent = "Nada ainda. Bot é admin? Mensagem no grupo, Detectar de novo.";
    return;
  }
  sel.innerHTML = "<option value=''>Escolhe o grupo pelo nome</option>" +
    chats.map(c => `<option value="${esc(c.chat_id)}" data-title="${esc(c.title)}">${esc(c.title)} (${esc(c.chat_type)})</option>`).join("");
  if (!silent) { $("#c-hint").textContent = chats.length + " grupo(s). Escolhe na lista."; toast(chats.length + " grupo(s) encontrado(s)"); }
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
  $("#daemon-pill").textContent = on ? "ligado" : "parado";
  $("#daemon-pill").classList.toggle("off", !on);
  $("#daemon-status").textContent = d.status || "";
  const h = $("#daemon-h"); if (h) h.textContent = on ? "Aprovação ligada" : "Aprovação parada";
  const live = $("#side-live");
  if (live) {
    live.classList.toggle("on", on);
    live.querySelector("span").textContent = on ? "aprovação ligada" : "aprovação parada";
  }
}
$("#btn-daemon-on").onclick = async () => { await api("/api/daemon/start", {method:"POST", body:{}}); loadDaemon(); toast("Aprovação ligada"); };
$("#btn-daemon-off").onclick = async () => { await api("/api/daemon/stop", {method:"POST", body:{}}); loadDaemon(); toast("Aprovação desligada"); };

async function loadLogs() {
  const d = await api("/api/events");
  const ev = d.events || [];
  $("#list-logs").innerHTML = ev.length
    ? ev.map(e => `<div class="log-row">
        <span class="kind ${esc(e.kind)}">${esc(e.kind)}</span>
        <span>${esc(e.detail)}</span>
        <time>${esc(e.at)}</time>
      </div>`).join("")
    : "<p class='muted' style='padding:16px'>Sem eventos ainda.</p>";
}
$("#btn-refresh-logs").onclick = loadLogs;

async function loadAgenda() {
  const d = await api("/api/agenda");
  const cron = d.cron || {};
  const st = $("#cron-status");
  const title = $("#cron-title");
  if (title) title.textContent = cron.installed ? "Instalado · " + (cron.how || "") : "Não instalado";
  if (st) {
    st.textContent = cron.installed
      ? (cron.detail || cron.how || "rodando no sistema")
      : "Sem isso a agenda só roda com o painel aberto.";
  }
  const el = $("#list-agenda");
  const list = d.channels || [];
  if (!list.length) {
    el.innerHTML = empty("Nada na agenda", "Liga a agenda no canal (Editar → passo 3).", "Ir para canais");
    const cta = $("#empty-cta"); if (cta) cta.onclick = () => tab("canais");
    return;
  }
  el.innerHTML = list.map(c => `
    <article class="entity">
      <div class="avatar">${esc((c.name||"C")[0].toUpperCase())}</div>
      <div>
        <h3>${esc(c.name)}</h3>
        <div class="chips">
          ${(c.hours||[]).map(h => `<span class="chip ${(c.sent_today||[]).includes(h)?"on":""}">${esc(h)}h</span>`).join("") || `<span class="chip">manual</span>`}
        </div>
        <p class="muted" style="margin:8px 0 0">Hoje: ${(c.sent_today||[]).join(", ") || "nada"} · agora ${esc(c.now_hour)}h</p>
      </div>
      <span class="pill ${c.schedule_on ? "" : "off"}">${c.schedule_on ? (c.due_now ? "vence agora" : "agendado") : "manual"}</span>
    </article>`).join("");
}
$("#btn-refresh-agenda").onclick = loadAgenda;
$("#btn-cron-on").onclick = async () => {
  const d = await api("/api/agenda/install", {method:"POST", body:{}});
  if (!d.ok) return toast(d.error || "Não instalei", true);
  toast("Cron instalado no sistema");
  loadAgenda();
};
$("#btn-cron-off").onclick = async () => {
  const d = await api("/api/agenda/uninstall", {method:"POST", body:{}});
  if (!d.ok) return toast(d.error || "Não removi", true);
  toast("Cron removido");
  loadAgenda();
};

async function boot() {
  await loadBots();
  await loadChannels();
  await loadDaemon();
  await loadLogs();
  await loadAgenda();
  tab("canais");
}

(async () => {
  const me = await api("/api/me");
  if (me.ok) { show(false); boot(); }
  else show(true);
})();
