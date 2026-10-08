(() => {
  const KEY = "rz_state";
  const get = () => new Promise(r => chrome.storage.local.get(KEY, d => r(d[KEY] || null)));
  const set = s => new Promise(r => chrome.storage.local.set({ [KEY]: s }, r));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function parseList(text) {
    const out = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parts = line.split(/\t|;|,/).map(p => p.trim()).filter(Boolean);
      let phone = "", name = "";
      for (const p of parts) {
        const d = p.replace(/\D/g, "");
        if (!phone && d.length >= 8 && d.length >= p.replace(/\s/g, "").length * 0.6) phone = d;
        else if (!name) name = p;
      }
      if (!phone) continue;
      if (phone.length === 10 || phone.length === 11) phone = "55" + phone;
      out.push({ phone, name });
    }
    return out;
  }

  function fill(msg, name) {
    const first = (name || "").split(/\s+/)[0] || "";
    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
    return msg.replace(/\{nome\}/gi, name || "").replace(/\{primeiro_nome\}/gi, cap(first));
  }

  // ---------- UI ----------
  const toggle = document.createElement("button");
  toggle.id = "rz-toggle"; toggle.textContent = "📨 Envio em massa";
  const panel = document.createElement("div");
  panel.id = "rz-panel";
  panel.innerHTML = `
    <h3>Recruta Zap · Envio em massa</h3>
    <label>Contatos <small>(cole da planilha: número e nome, uma pessoa por linha)</small></label>
    <textarea id="rz-list" rows="6" placeholder="11999998888	Maria Souza&#10;21988887777	João Lima"></textarea>
    <div id="rz-count"><small>0 contatos</small></div>
    <label>Mensagem <small>use {nome} ou {primeiro_nome}</small></label>
    <textarea id="rz-msg" rows="6" placeholder="Olá {primeiro_nome}! Temos uma vaga que combina com seu perfil..."></textarea>
    <div id="rz-row">
      <div><label>Intervalo mín (s)</label><input id="rz-min" type="number" value="15" min="3"></div>
      <div><label>Intervalo máx (s)</label><input id="rz-max" type="number" value="30" min="3"></div>
    </div>
    <div class="rz-btns">
      <button id="rz-start">Iniciar</button><button id="rz-stop">Parar</button><button id="rz-clear">Limpar</button>
    </div>
    <div id="rz-status">Pronto.</div>
    <div id="rz-bar"><i></i></div>
    <div id="rz-log"></div>`;
  document.body.append(toggle, panel);
  const $ = id => panel.querySelector("#" + id);
  toggle.onclick = () => panel.classList.toggle("open");

  chrome.storage.local.get(["rz_draft"], d => {
    const dr = d.rz_draft || {};
    $("rz-list").value = dr.list || ""; $("rz-msg").value = dr.msg || "";
    if (dr.min) $("rz-min").value = dr.min; if (dr.max) $("rz-max").value = dr.max;
    updCount();
  });
  const saveDraft = () => chrome.storage.local.set({ rz_draft: { list: $("rz-list").value, msg: $("rz-msg").value, min: $("rz-min").value, max: $("rz-max").value } });
  const updCount = () => { $("rz-count").innerHTML = `<small>${parseList($("rz-list").value).length} contatos válidos</small>`; };
  ["rz-list", "rz-msg", "rz-min", "rz-max"].forEach(id => $(id).addEventListener("input", () => { saveDraft(); updCount(); }));

  function render(s) {
    if (!s) { $("rz-status").textContent = "Pronto."; $("rz-bar").firstElementChild.style.width = "0"; $("rz-log").innerHTML = ""; return; }
    const total = s.queue.length;
    $("rz-status").textContent = s.running ? `Enviando ${Math.min(s.index + 1, total)} de ${total}...` : `Finalizado/parado: ${s.index} de ${total}`;
    $("rz-bar").firstElementChild.style.width = (total ? (s.index / total) * 100 : 0) + "%";
    $("rz-log").innerHTML = s.log.slice().reverse().map(l => `<div class="${l.ok ? "ok" : "err"}">${l.ok ? "✔" : "✖"} ${l.phone} ${l.name || ""}${l.err ? " - " + l.err : ""}</div>`).join("");
  }

  $("rz-start").onclick = async () => {
    const queue = parseList($("rz-list").value);
    const msg = $("rz-msg").value.trim();
    if (!queue.length) return alert("Cole ao menos um contato.");
    if (!msg) return alert("Escreva a mensagem.");
    const min = Math.max(3, +$("rz-min").value || 15), max = Math.max(min, +$("rz-max").value || 30);
    const s = { running: true, queue, msg, min, max, index: 0, log: [] };
    await set(s); render(s); goTo(s);
  };
  $("rz-stop").onclick = async () => { const s = await get(); if (s) { s.running = false; await set(s); render(s); } };
  $("rz-clear").onclick = async () => { await set(null); render(null); };

  function goTo(s) {
    const c = s.queue[s.index];
    const url = `https://web.whatsapp.com/send?phone=${c.phone}&text=${encodeURIComponent(fill(s.msg, c.name))}`;
    location.href = url;
  }

  function findSend() {
    return document.querySelector('[data-icon="send"]')?.closest("button,[role=button]") ||
      document.querySelector('[data-icon="wds-ic-send-filled"]')?.closest("button,[role=button]") ||
      document.querySelector('button[aria-label="Enviar"],button[aria-label="Send"]');
  }
  function invalidPopup() {
    const t = document.querySelector('[role="dialog"], [data-animate-modal-popup="true"]')?.innerText || "";
    return /inválido|invalid|não está no WhatsApp|isn't on WhatsApp/i.test(t);
  }

  async function processCurrent() {
    let s = await get();
    render(s);
    if (!s || !s.running) return;
    if (s.index >= s.queue.length) { s.running = false; await set(s); render(s); panel.classList.add("open"); return; }
    const c = s.queue[s.index];
    if (!location.href.includes("phone=" + c.phone)) { await sleep(3000); return goTo(s); }
    panel.classList.add("open");
    let ok = false, err = "";
    const start = Date.now();
    while (Date.now() - start < 45000) {
      if (invalidPopup()) { err = "número inválido"; break; }
      const b = findSend();
      if (b) { await sleep(800); b.click(); ok = true; await sleep(2500); break; }
      await sleep(700);
    }
    if (!ok && !err) err = "tempo esgotado";
    s = await get();
    if (!s) return;
    s.log.push({ phone: c.phone, name: c.name, ok, err });
    s.index++;
    if (s.index >= s.queue.length) s.running = false;
    await set(s); render(s);
    if (!s.running) return;
    const wait = (s.min + Math.random() * (s.max - s.min)) * 1000;
    const end = Date.now() + wait;
    while (Date.now() < end) {
      const cur = await get(); if (!cur || !cur.running) { render(cur); return; }
      $("rz-status").textContent = `Próximo envio em ${Math.ceil((end - Date.now()) / 1000)}s (${s.index}/${s.queue.length})`;
      await sleep(1000);
    }
    goTo(s);
  }

  setTimeout(processCurrent, 2000);
})();
