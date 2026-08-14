(function () {
  const els = {
    lock: document.getElementById("lockScreen"),
    app: document.getElementById("adminApp"),
    formLock: document.getElementById("lockForm"),
    password: document.getElementById("password"),
    list: document.getElementById("adminList"),
    listCount: document.getElementById("listCount"),
    form: document.getElementById("entryForm"),
    id: document.getElementById("entryId"),
    title: document.getElementById("title"),
    category: document.getElementById("category"),
    vat: document.getElementById("vat"),
    keywords: document.getElementById("keywords"),
    vatNote: document.getElementById("vatNote"),
    journal: document.getElementById("journalEditor"),
    guide: document.getElementById("guide"),
    caution: document.getElementById("caution"),
    example: document.getElementById("example"),
    btnNew: document.getElementById("btnNew"),
    btnDelete: document.getElementById("btnDelete"),
    btnAddLine: document.getElementById("btnAddLine"),
    btnExport: document.getElementById("btnExport"),
    btnReset: document.getElementById("btnReset"),
    fileImport: document.getElementById("fileImport"),
    toast: document.getElementById("toast")
  };

  const state = {
    entries: [],
    selectedId: null
  };

  let toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2000);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isUnlocked() {
    try { return sessionStorage.getItem(JournalStore.ADMIN_UNLOCK_KEY) === "1"; }
    catch { return false; }
  }

  function setUnlocked(on) {
    try { sessionStorage.setItem(JournalStore.ADMIN_UNLOCK_KEY, on ? "1" : "0"); }
    catch {}
  }

  function applyLock() {
    const on = isUnlocked();
    els.lock.hidden = on;
    els.app.hidden = !on;
  }

  function fillSelects() {
    els.category.innerHTML = JournalStore.CATEGORIES.map((c) =>
      `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
    ).join("");
    els.vat.innerHTML = JournalStore.vatList().map((v) =>
      `<option value="${v.id}">${escapeHtml(v.label)}</option>`
    ).join("");
  }

  function loadEntries() {
    state.entries = JournalStore.loadEntries().entries;
    if (!state.selectedId && state.entries[0]) state.selectedId = state.entries[0].id;
    renderList();
    const current = state.entries.find((e) => e.id === state.selectedId);
    if (current) fillForm(current);
    else fillForm(JournalStore.emptyEntry());
  }

  function renderList() {
    els.listCount.textContent = state.entries.length + "건";
    els.list.innerHTML = state.entries.map((e) => {
      const vat = JournalStore.vatInfo(e.vat);
      return `<button type="button" class="admin-item${e.id === state.selectedId ? " active" : ""}" data-id="${escapeHtml(e.id)}">
        <strong>${escapeHtml(e.title)}</strong>
        <span class="hint">${escapeHtml(e.category)} · ${escapeHtml(vat.short)}</span>
      </button>`;
    }).join("") || `<div class="empty" style="border:0;box-shadow:none"><strong>아직 없습니다</strong>새 안내를 추가하세요.</div>`;
  }

  function renderJournal(lines) {
    const rows = (lines && lines.length ? lines : [{ side: "debit", account: "", memo: "" }]);
    els.journal.innerHTML = rows.map((line, i) => `
      <div class="journal-row" data-idx="${i}">
        <select data-field="side">
          <option value="debit"${line.side === "debit" ? " selected" : ""}>차변</option>
          <option value="credit"${line.side === "credit" ? " selected" : ""}>대변</option>
        </select>
        <input data-field="account" value="${escapeHtml(line.account)}" placeholder="계정과목" />
        <input data-field="memo" value="${escapeHtml(line.memo)}" placeholder="적요 · 금액 기준" />
        <button type="button" class="icon-btn" data-del-line aria-label="행 삭제">×</button>
      </div>
    `).join("");
  }

  function readJournal() {
    return Array.from(els.journal.querySelectorAll(".journal-row")).map((row) => ({
      side: row.querySelector('[data-field="side"]').value,
      account: row.querySelector('[data-field="account"]').value.trim(),
      memo: row.querySelector('[data-field="memo"]').value.trim()
    })).filter((l) => l.account || l.memo);
  }

  function fillForm(entry) {
    els.id.value = entry.id;
    els.title.value = entry.title || "";
    els.category.value = JournalStore.CATEGORIES.includes(entry.category) ? entry.category : "기타";
    els.vat.value = JournalStore.VAT[entry.vat] ? entry.vat : "case_by_case";
    els.keywords.value = (entry.keywords || []).join(", ");
    els.vatNote.value = entry.vatNote || "";
    els.guide.value = entry.guide || "";
    els.caution.value = entry.caution || "";
    els.example.value = entry.example || "";
    renderJournal(entry.journal);
    state.selectedId = entry.id;
    renderList();
  }

  function readForm() {
    const keywords = els.keywords.value.split(/[,/，、]+/).map((k) => k.trim()).filter(Boolean);
    return {
      id: els.id.value || JournalStore.newId(),
      title: els.title.value.trim(),
      category: els.category.value,
      keywords,
      vat: els.vat.value,
      vatNote: els.vatNote.value.trim(),
      journal: readJournal(),
      guide: els.guide.value.trim(),
      caution: els.caution.value.trim(),
      example: els.example.value.trim(),
      updatedAt: new Date().toISOString()
    };
  }

  function persist(next, message) {
    const record = JournalStore.saveEntries(next);
    state.entries = record.entries;
    renderList();
    if (typeof window.refreshJournalGuide === "function") window.refreshJournalGuide();
    if (message) showToast(message);
  }

  els.formLock.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await JournalStore.checkPassword(els.password.value);
    els.password.value = "";
    if (!ok) {
      showToast("비밀번호가 일치하지 않습니다.");
      return;
    }
    setUnlocked(true);
    applyLock();
    loadEntries();
  });

  els.list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-id]");
    if (!btn) return;
    const entry = state.entries.find((x) => x.id === btn.dataset.id);
    if (entry) fillForm(entry);
  });

  els.btnNew.addEventListener("click", () => {
    const blank = JournalStore.emptyEntry();
    fillForm(blank);
    els.title.focus();
  });

  els.btnAddLine.addEventListener("click", () => {
    const lines = readJournal();
    lines.push({ side: lines.length % 2 ? "credit" : "debit", account: "", memo: "" });
    renderJournal(lines);
  });

  els.journal.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del-line]");
    if (!btn) return;
    const row = btn.closest(".journal-row");
    row.remove();
    if (!els.journal.querySelector(".journal-row")) renderJournal([]);
  });

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const entry = readForm();
    if (!entry.title) {
      showToast("거래명을 입력하세요.");
      return;
    }
    const next = state.entries.filter((x) => x.id !== entry.id);
    const existed = state.entries.some((x) => x.id === entry.id);
    if (existed) {
      const idx = state.entries.findIndex((x) => x.id === entry.id);
      next.splice(Math.max(idx, 0), 0, entry);
    } else {
      next.unshift(entry);
    }
    state.selectedId = entry.id;
    persist(next, "저장했습니다. 안내 목록에 바로 반영됩니다.");
    fillForm(entry);
  });

  els.btnDelete.addEventListener("click", () => {
    const id = els.id.value;
    if (!id || !state.entries.some((e) => e.id === id)) {
      fillForm(JournalStore.emptyEntry());
      return;
    }
    if (!confirm("이 안내를 삭제할까요?")) return;
    const next = state.entries.filter((e) => e.id !== id);
    state.selectedId = next[0] ? next[0].id : null;
    persist(next, "삭제했습니다.");
    if (next[0]) fillForm(next[0]);
    else fillForm(JournalStore.emptyEntry());
  });

  els.btnExport.addEventListener("click", () => {
    const payload = JournalStore.exportPayload(state.entries);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "회계분개-부가세안내.json";
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("JSON 파일을 내려받았습니다.");
  });

  els.fileImport.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const merge = confirm("기존 안내와 합칠까요?\n확인: 합치기 / 취소: 가져온 내용으로 바꾸기");
      const record = JournalStore.importPayload(payload, merge ? "merge" : "replace");
      state.entries = record.entries;
      state.selectedId = state.entries[0] ? state.entries[0].id : null;
      renderList();
      if (state.entries[0]) fillForm(state.entries[0]);
      if (typeof window.refreshJournalGuide === "function") window.refreshJournalGuide();
      showToast("가져오기를 반영했습니다.");
    } catch (err) {
      showToast(err.message || "JSON을 읽지 못했습니다.");
    }
  });

  els.btnReset.addEventListener("click", () => {
    if (!confirm("관리자가 저장한 내용을 지우고 기본 예시로 되돌릴까요?")) return;
    const data = JournalStore.resetToSeed();
    state.entries = data.entries;
    state.selectedId = state.entries[0] ? state.entries[0].id : null;
    renderList();
    if (state.entries[0]) fillForm(state.entries[0]);
    if (typeof window.refreshJournalGuide === "function") window.refreshJournalGuide();
    showToast("기본 예시로 되돌렸습니다.");
  });

  fillSelects();
  applyLock();
  if (isUnlocked()) loadEntries();
})();
