const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

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

function show(login) {
  $("#view-login").classList.toggle("hidden", !login);
  $("#view-app").classList.toggle("hidden", login);
}

function tab(name) {
  $$("[data-panel]").forEach(p => p.classList.toggle("hidden", p.dataset.panel !== name));
  $$(".nav-btn").forEach(b => b.setAttribute("aria-current", b.dataset.tab === name ? "page" : "false"));
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
  if (!bots.length) { el.innerHTML = "<p class='muted'>Nenhum bot. Clique em Novo bot.</p>"; return; }
  el.innerHTML = `<table><thead><tr><th>Nome</th><th>Username</th><th></th></tr></thead><tbody>` +
    bots.map(b => `<tr><td>${esc(b.name)}</td><td class="mono">${esc(b.username)}</td>
      <td class="actions">
        <button class="btn btn-ghost" data-find-bot="${b.id}">Detectar grupos</button>
        <button class="btn btn-danger" data-del-bot="${b.id}">Excluir</button>
      </td></tr>`).join("") +
    `</tbody></table>`;
  $$("[data-del-bot]").forEach(btn => btn.onclick = async () => {
    if (!confirm("Excluir este bot?")) return;
    await fetch("/api/bots/" + btn.dataset.delBot, {method:"DELETE", credentials:"same-origin"});
    loadBots(); loadChannels();
  });
  $$("[data-find-bot]").forEach(btn => btn.onclick = () => runDiscover(btn.dataset.findBot, btn));
}

async function loadChannels() {
  const d = await api("/api/channels");
  channels = d.channels || [];
  const el = $("#list-channels");
  if (!channels.length) { el.innerHTML = "<p class='muted'>Nenhum canal. Cadastre um bot primeiro, depois o canal.</p>"; return; }
  el.innerHTML = channels.map(c => `
    <div class="card" style="margin-bottom:10px">
      <div class="row">
        <div>
          <strong>${esc(c.name)}</strong>
          <div class="muted mono">${esc(c.chat_id)} · ${esc(c.bot_username)}</div>
          <div class="muted">JSON: ${esc(c.json_url || "—")}</div>
          <div class="muted">${c.schedule_on ? "Agenda: " + esc(c.schedule || "—") : "Agenda: só manual"}</div>
          ${c.invite_link ? `<div class="muted">Convite: <span class="mono">${esc(c.invite_link)}</span></div>` : ""}
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-send="${c.id}">Enviar JSON agora</button>
          <button class="btn btn-ghost" data-edit="${c.id}">Editar</button>
          <button class="btn btn-danger" data-del-ch="${c.id}">Excluir</button>
        </div>
      </div>
    </div>`).join("");
  $$("[data-send]").forEach(b => b.onclick = () => sendNow(b.dataset.send, b));
  $$("[data-edit]").forEach(b => b.onclick = () => openChannel(channels.find(x => String(x.id)===b.dataset.edit)));
  $$("[data-del-ch]").forEach(b => b.onclick = async () => {
    if (!confirm("Excluir canal?")) return;
    await fetch("/api/channels/" + b.dataset.delCh, {method:"DELETE", credentials:"same-origin"});
    loadChannels();
  });
}

async function sendNow(id, btn) {
  btn.disabled = true;
  const d = await api("/api/channels/send", {method:"POST", body:{id: Number(id)}});
  btn.disabled = false;
  alert(d.ok ? `Enviados: ${d.sent.length}/${d.total}` + (d.errors?.length ? "\nErros: "+d.errors.join("\n") : "") : (d.error || "falhou"));
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}

function openBotForm() {
  const box = $("#form-bot");
  box.classList.remove("hidden");
  box.innerHTML = `
    <form id="bot-save">
      <label for="b-name">Nome</label><input id="b-name" required placeholder="Amanda RH">
      <label for="b-user">Username</label><input id="b-user" required placeholder="@rh_amanda_bot">
      <label for="b-token">Token (BotFather)</label><input id="b-token" required autocomplete="off">
      <div class="actions">
        <button class="btn btn-primary" type="submit">Salvar bot</button>
        <button class="btn btn-ghost" type="button" id="bot-cancel">Cancelar</button>
      </div>
    </form>`;
  $("#bot-cancel").onclick = () => box.classList.add("hidden");
  $("#bot-save").onsubmit = async (e) => {
    e.preventDefault();
    const d = await api("/api/bots", {method:"POST", body:{
      name: $("#b-name").value, username: $("#b-user").value, token: $("#b-token").value
    }});
    if (!d.ok) return alert("Falhou");
    box.classList.add("hidden");
    loadBots();
  };
}

function openChannel(existing) {
  const box = $("#form-channel");
  box.classList.remove("hidden");
  const opts = bots.map(b => `<option value="${b.id}" ${existing && existing.bot_id===b.id?"selected":""}>${esc(b.name)} (${esc(b.username)})</option>`).join("");
  box.innerHTML = `
    <form id="ch-save">
      <p class="muted">Não precisa do ID. Escolhe o bot, clica Detectar, escolhe o grupo pelo <strong>nome</strong>.</p>
      <label for="c-bot">Bot</label>
      <select id="c-bot" required>${opts || "<option value=''>Cadastre um bot antes</option>"}</select>
      <div class="actions" style="margin-bottom:14px">
        <button class="btn btn-ghost" type="button" id="c-detect">Detectar grupos deste bot</button>
      </div>
      <label for="c-pick">Grupo encontrado</label>
      <select id="c-pick"><option value="">— clique Detectar —</option></select>
      <p class="muted" id="c-hint">Coloca o bot como admin no Telegram. Manda qualquer mensagem no grupo. Aí Detectar.</p>
      <label for="c-link">Ou canal público (@nome ou t.me/nome)</label>
      <div class="actions" style="align-items:flex-end">
        <input id="c-link" placeholder="@empregosonline" style="flex:1;margin-bottom:0">
        <button class="btn btn-ghost" type="button" id="c-resolve">Resolver</button>
      </div>
      <p class="err" id="c-err"></p>
      <label for="c-name">Nome no painel</label>
      <input id="c-name" required value="${esc(existing?.name||"")}">
      <input type="hidden" id="c-chat" value="${esc(existing?.chat_id||"")}">
      <p class="muted mono" id="c-chat-vis">${existing?.chat_id ? "ID: "+esc(existing.chat_id) : "ID entra sozinho quando você escolhe o grupo."}</p>
      <label for="c-welcome">Mensagem de boas-vindas (use {name})</label>
      <textarea id="c-welcome">${esc(existing?.welcome_text||"Oi, {name}! Sou a Amanda do RH. Sua entrada já foi aprovada.\\n\\nMe manda seu WhatsApp com DDI.\\n+55 11 99391-1111")}</textarea>
      <label for="c-json">JSON (arquivo no repo ou URL)</label>
      <input id="c-json" value="${esc(existing?.json_url||"content/vagas.exemplo.json")}">
      <label><input type="checkbox" id="c-sched-on" ${existing?.schedule_on ? "checked" : ""}> Agenda ligada (lê o JSON sozinho nos horários)</label>
      <label for="c-sched">Horários (hora local deste PC)</label>
      <input id="c-sched" value="${esc(existing?.schedule||"08,11,14,17,20")}" placeholder="08,11,14,17,20">
      <p class="muted">Em cada horário o painel baixa o JSON de novo e envia. Uma vez por hora. Sem o painel aberto, não envia.</p>
      <div class="actions">
        <button class="btn btn-primary" type="submit">Salvar canal</button>
        <button class="btn btn-ghost" type="button" id="ch-cancel">Cancelar</button>
      </div>
    </form>`;
  $("#ch-cancel").onclick = () => box.classList.add("hidden");
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
      $("#c-err").textContent = "Escolhe um grupo na lista (Detectar) ou resolve um @público.";
      return;
    }
    const body = {
      name: $("#c-name").value,
      chat_id: $("#c-chat").value,
      bot_id: Number($("#c-bot").value),
      welcome_text: $("#c-welcome").value,
      json_url: $("#c-json").value,
      schedule: $("#c-sched").value,
      schedule_on: $("#c-sched-on").checked,
      active: true,
    };
    const d = existing
      ? await api("/api/channels/update", {method:"POST", body:{...body, id: existing.id}})
      : await api("/api/channels", {method:"POST", body});
    if (!d.ok) { $("#c-err").textContent = d.error || "Falhou"; return; }
    if (d.invite_link) alert("Canal salvo. Link com pedido:\n" + d.invite_link);
    box.classList.add("hidden");
    loadChannels();
  };
  if ($("#c-bot").value) fillDiscover($("#c-bot").value, true);
}

function applyChat(chat) {
  $("#c-chat").value = chat.chat_id;
  $("#c-chat-vis").textContent = "ID: " + chat.chat_id + " (preenchido)";
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
    if (!silent) $("#c-hint").textContent = "Nada ainda. Bot é admin? Manda uma mensagem no grupo e clica Detectar de novo.";
    return;
  }
  sel.innerHTML = "<option value=''>Escolhe o grupo pelo nome</option>" +
    chats.map(c => `<option value="${esc(c.chat_id)}" data-title="${esc(c.title)}">${esc(c.title)} (${esc(c.chat_type)})</option>`).join("");
  if (!silent) $("#c-hint").textContent = chats.length + " grupo(s). Escolhe na lista.";
}

async function runDiscover(botId, btn) {
  btn.disabled = true;
  const d = await api("/api/discover", {method:"POST", body:{bot_id: Number(botId)}});
  btn.disabled = false;
  const n = (d.chats || []).length;
  alert(d.ok
    ? (n ? n + " grupo(s). Abre Novo canal e escolhe o nome." : "Nenhum ainda. Bot como admin + uma mensagem no grupo, depois Detectar de novo.")
    : (d.error || "falhou"));
}

$("#btn-new-bot").onclick = openBotForm;
$("#btn-new-channel").onclick = () => openChannel(null);

async function loadDaemon() {
  const d = await api("/api/daemon");
  const on = !!d.on;
  $("#daemon-pill").textContent = on ? "ligado" : "parado";
  $("#daemon-pill").classList.toggle("off", !on);
  $("#daemon-status").textContent = d.status || "";
}

$("#btn-daemon-on").onclick = async () => { await api("/api/daemon/start", {method:"POST", body:{}}); loadDaemon(); };
$("#btn-daemon-off").onclick = async () => { await api("/api/daemon/stop", {method:"POST", body:{}}); loadDaemon(); };

async function loadLogs() {
  const d = await api("/api/events");
  const ev = d.events || [];
  $("#list-logs").innerHTML = ev.length
    ? ev.map(e => `<div class="log"><b>${esc(e.at)}</b> · ${esc(e.kind)} — ${esc(e.detail)}</div>`).join("")
    : "<p class='muted'>Sem eventos ainda.</p>";
}
$("#btn-refresh-logs").onclick = loadLogs;

async function loadAgenda() {
  const el = $("#list-agenda");
  if (!el) return;
  const d = await api("/api/agenda");
  const list = d.channels || [];
  if (!list.length) { el.innerHTML = "<p class='muted'>Nenhum canal. A agenda se configura em Canais → Editar.</p>"; return; }
  el.innerHTML = list.map(c => `
    <div class="row" style="margin-bottom:10px">
      <div>
        <strong>${esc(c.name)}</strong>
        <div class="muted">${c.schedule_on ? "Horários: " + esc((c.hours||[]).join(", ")||"—") : "Só envio manual"}</div>
        <div class="muted">Hoje já saiu: ${(c.sent_today||[]).join(", ") || "nada"} · agora ${esc(c.now_hour)}h</div>
      </div>
      <span class="pill ${c.schedule_on ? "" : "off"}">${c.schedule_on ? (c.due_now ? "vence agora" : "agendado") : "manual"}</span>
    </div>`).join("");
}
$("#btn-refresh-agenda") && ($("#btn-refresh-agenda").onclick = loadAgenda);

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
