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
  // Keep the launcher and its panel inside the viewport; remember user placement.
  let position = { x: 18, y: 18 };
  let drag = null;
  let suppressClick = false;
  let positionChanged = false;
  const clamp = (value, max) => Math.max(8, Math.min(value, Math.max(8, max)));
  function placePanel() {
    if (!panel.classList.contains("open")) return;
    const rect = toggle.getBoundingClientRect();
    panel.style.maxHeight = Math.max(80, window.innerHeight - rect.height - 32) + "px";
    const below = rect.bottom + 10;
    const y = below + panel.offsetHeight <= window.innerHeight - 8 ? below : rect.top - panel.offsetHeight - 10;
    panel.style.left = clamp(rect.left, window.innerWidth - panel.offsetWidth - 8) + "px";
    panel.style.top = clamp(y, window.innerHeight - panel.offsetHeight - 8) + "px";
  }
  function placeButton() {
    position.x = clamp(position.x, window.innerWidth - toggle.offsetWidth - 8);
    position.y = clamp(position.y, window.innerHeight - toggle.offsetHeight - 8);
    toggle.style.left = position.x + "px";
    toggle.style.top = position.y + "px";
    placePanel();
  }
  const savePosition = () => chrome.storage.local.set({ rz_button_position: position });
  toggle.title = "Arraste para reposicionar; clique para abrir";
  toggle.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    suppressClick = false;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: position.x, top: position.y, moved: false };
    toggle.setPointerCapture(event.pointerId);
  });
  toggle.addEventListener("pointermove", event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    positionChanged = true;
    suppressClick = true;
    toggle.classList.add("rz-dragging");
    position = { x: drag.left + dx, y: drag.top + dy };
    placeButton();
  });
  const finishDrag = event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.moved) savePosition();
    drag = null;
    toggle.classList.remove("rz-dragging");
  };
  toggle.addEventListener("pointerup", finishDrag);
  toggle.addEventListener("pointercancel", finishDrag);
  toggle.addEventListener("lostpointercapture", finishDrag);
  toggle.onclick = event => {
    if (suppressClick && event.detail !== 0) { suppressClick = false; return; }
    suppressClick = false;
    panel.classList.toggle("open");
    placePanel();
  };
  toggle.addEventListener("keydown", event => {
    const steps = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    positionChanged = true;
    position = { x: position.x + step[0], y: position.y + step[1] };
    placeButton();
    savePosition();
  });
  chrome.storage.local.get("rz_button_position", data => {
    const saved = data.rz_button_position;
    if (!positionChanged && saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) position = saved;
    placeButton();
  });
  window.addEventListener("resize", placeButton);
  new MutationObserver(placePanel).observe(panel, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });

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

  // WhatsApp Web removes "?phone=" from the address bar after loading, so the
  // contact being opened is remembered in storage instead of read from the URL.
  async function goTo(s) {
    const c = s.queue[s.index];
    const tries = s.pending && s.pending.index === s.index ? (s.pending.tries || 0) + 1 : 1;
    s.pending = { index: s.index, phone: c.phone, at: Date.now(), tries };
    await set(s);
    const url = `https://web.whatsapp.com/send?phone=${c.phone}&text=${encodeURIComponent(fill(s.msg, c.name))}`;
    location.href = url;
  }

  function findBox() {
    const boxes = [...document.querySelectorAll('#main footer div[contenteditable="true"], #main div[contenteditable="true"][role="textbox"]')];
    return boxes.find(box => box.getAttribute("aria-label")?.match(/mensagem|message/i)) || boxes.at(-1) || null;
  }
  function findSend() {
    const roots = [document.querySelector("#main footer"), document.querySelector("#main")].filter(Boolean);
    const selectors = [
      'button[aria-label="Enviar"]', 'button[aria-label="Send"]',
      '[role="button"][aria-label="Enviar"]', '[role="button"][aria-label="Send"]',
      'button[data-testid="compose-btn-send"]', '[data-testid="compose-btn-send"]',
      '[data-icon="send"]', '[data-icon="wds-ic-send-filled"]',
      '[data-icon*="send"]'
    ];
    for (const root of roots) {
      for (const selector of selectors) {
        const found = root.querySelector(selector);
        if (found) return found.closest("button,[role=button]") || found;
      }
      const labelled = [...root.querySelectorAll("button,[role=button]")].find(el =>
        /^(enviar|send)$/i.test((el.getAttribute("aria-label") || el.getAttribute("title") || "").trim())
      );
      if (labelled) return labelled;
    }
    return null;
  }
  function wakeComposer(box) {
    box.focus();
    box.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: "" }));
    box.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "" }));
    box.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: box.innerText || box.textContent || "" }));
  }
  function realClick(el) {
    el.scrollIntoView({ block: "center", inline: "center" });
    el.focus();
    el.click();
    for (const t of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      const EventType = t.startsWith("pointer") && window.PointerEvent ? PointerEvent : MouseEvent;
      el.dispatchEvent(new EventType(t, { bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: t.endsWith("down") ? 1 : 0 }));
    }
  }
  function pressEnter(box) {
    box.focus();
    const o = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    box.dispatchEvent(new KeyboardEvent("keydown", o));
    box.dispatchEvent(new KeyboardEvent("keypress", o));
    box.dispatchEvent(new KeyboardEvent("keyup", o));
  }
  async function trySend() {
    const box = findBox();
    const text = box?.innerText || box?.textContent || "";
    if (!box || !text.trim()) return false;
    wakeComposer(box);
    await sleep(900);
    let b = findSend();
    if (b) realClick(b); else pressEnter(box);
    await sleep(1800);
    let current = findBox();
    if ((current?.innerText || current?.textContent || "").trim()) {
      wakeComposer(current);
      b = findSend();
      if (b) realClick(b); else pressEnter(current);
      await sleep(1800);
    }
    current = findBox();
    return !(current?.innerText || current?.textContent || "").trim();
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
    const opened = s.pending && s.pending.index === s.index && s.pending.phone === c.phone && Date.now() - s.pending.at < 120000;
    if (!opened) {
      if (s.pending && s.pending.index === s.index && (s.pending.tries || 0) >= 2) {
        s.log.push({ phone: c.phone, name: c.name, ok: false, err: "conversa não abriu" });
        s.index++; s.pending = null;
        if (s.index >= s.queue.length) { s.running = false; await set(s); render(s); return; }
      }
      await sleep(1500); return goTo(s);
    }
    panel.classList.add("open");
    let ok = false, err = "";
    const start = Date.now();
    while (Date.now() - start < 60000) {
      if (invalidPopup()) { err = "número inválido"; break; }
      const box = findBox();
      if ((box?.innerText || box?.textContent || "").trim()) { await sleep(1200); ok = await trySend(); if (!ok) err = "não conseguiu clicar em enviar"; break; }
      await sleep(700);
    }
    if (!ok && !err) err = "tempo esgotado";
    s = await get();
    if (!s) return;
    s.log.push({ phone: c.phone, name: c.name, ok, err });
    s.pending = null;
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
