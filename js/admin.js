(function () {
  const els = {
    lock: document.getElementById("lockScreen"),
    app: document.getElementById("adminApp"),
    formLock: document.getElementById("lockForm"),
    password: document.getElementById("password"),
    list: document.getElementById("topicList"),
    form: document.getElementById("topicForm"),
    topicId: document.getElementById("topicId"),
    title: document.getElementById("title"),
    keywords: document.getElementById("keywords"),
    tree: document.getElementById("treeEditor"),
    btnNew: document.getElementById("btnNew"),
    btnDelete: document.getElementById("btnDelete"),
    btnReset: document.getElementById("btnReset"),
    toast: document.getElementById("toast")
  };

  const state = {
    data: null,
    topicId: null,
    editingNodeId: null
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  function isUnlocked() {
    try { return sessionStorage.getItem(JournalStore.ADMIN_UNLOCK_KEY) === "1"; }
    catch { return false; }
  }

  function applyLock() {
    const on = isUnlocked();
    els.lock.hidden = on;
    els.app.hidden = !on;
  }

  function load() {
    state.data = JournalStore.loadData();
    if (!state.topicId && state.data.topics[0]) state.topicId = state.data.topics[0].id;
    renderList();
    const topic = state.data.topics.find((t) => t.id === state.topicId);
    if (topic) fillTopic(topic);
  }

  function renderList() {
    els.list.innerHTML = state.data.topics.map((t) =>
      `<button type="button" class="admin-item${t.id === state.topicId ? " active" : ""}" data-id="${escapeHtml(t.id)}">
        <strong>${escapeHtml(t.title)}</strong>
        <span class="hint">${escapeHtml((t.keywords || []).slice(0, 4).join(", "))}</span>
      </button>`
    ).join("") || `<div class="hint" style="padding:16px">주제를 추가하세요.</div>`;
  }

  function nodeSelect(selectedId) {
    const nodes = state.data.nodes;
    const opts = Object.keys(nodes).map((id) => {
      const n = nodes[id];
      const label = n.type === "question" ? "질문 · " + (n.prompt || id) : "결과 · " + (n.title || id);
      return `<option value="${escapeHtml(id)}"${id === selectedId ? " selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
    return `<option value="">(이어서 만들기)</option>${opts}`;
  }

  function renderTree() {
    const topic = state.data.topics.find((t) => t.id === state.topicId);
    if (!topic) {
      els.tree.innerHTML = "";
      return;
    }
    const node = state.data.nodes[state.editingNodeId] || state.data.nodes[topic.startNodeId];
    if (!node) {
      els.tree.innerHTML = `<p class="hint">시작 질문이 없습니다.</p>`;
      return;
    }
    state.editingNodeId = node.id;
    if (node.type === "question") {
      els.tree.innerHTML = `
        <div class="node-card">
          <strong>질문</strong>
          <label class="field">현업에게 물어볼 말
            <input id="nodePrompt" value="${escapeHtml(node.prompt)}" />
          </label>
          <div class="option-editor" id="optionEditor">
            ${(node.options || []).map((o, i) => `
              <div class="option-row" data-idx="${i}">
                <input data-field="label" value="${escapeHtml(o.label)}" placeholder="보기 (예: 식대인가요?)" />
                <select data-field="nextId">${nodeSelect(o.nextId)}</select>
                <button type="button" class="icon-btn" data-del-opt>×</button>
              </div>`).join("")}
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-ghost" id="btnAddOpt">보기 추가</button>
            <button type="button" class="btn btn-ghost" id="btnNewQ">이 질문 뒤에 새 질문</button>
            <button type="button" class="btn btn-ghost" id="btnNewR">이 질문 뒤에 새 결과</button>
            <button type="button" class="btn btn-ghost" id="btnToResult">이 노드를 결과로 바꾸기</button>
          </div>
        </div>`;
      return;
    }
    const vatOpts = JournalStore.vatList().map((v) =>
      `<option value="${v.id}"${node.vat === v.id ? " selected" : ""}>${escapeHtml(v.label)}</option>`
    ).join("");
    els.tree.innerHTML = `
      <div class="node-card">
        <strong>최종 안내 (부가세 · 분개)</strong>
        <label class="field">결과 제목
          <input id="resTitle" value="${escapeHtml(node.title)}" />
        </label>
        <label class="field">부가세 처리
          <select id="resVat">${vatOpts}</select>
        </label>
        <label class="field">부가세 안내
          <textarea id="resVatNote">${escapeHtml(node.vatNote)}</textarea>
        </label>
        <div>
          <div class="card-head" style="padding:0 0 8px;border:0">
            <h2>분개</h2>
            <button type="button" class="btn btn-ghost" id="btnAddLine">행 추가</button>
          </div>
          <div class="journal-editor" id="journalEditor">
            ${(node.journal || []).map((l, i) => `
              <div class="journal-row" data-idx="${i}">
                <select data-field="side">
                  <option value="debit"${l.side === "debit" ? " selected" : ""}>차변</option>
                  <option value="credit"${l.side === "credit" ? " selected" : ""}>대변</option>
                </select>
                <input data-field="account" value="${escapeHtml(l.account)}" placeholder="계정과목" />
                <input data-field="memo" value="${escapeHtml(l.memo)}" placeholder="적요" />
                <button type="button" class="icon-btn" data-del-line>×</button>
              </div>`).join("")}
          </div>
        </div>
        <label class="field">안내사항
          <textarea id="resGuide">${escapeHtml(node.guide)}</textarea>
        </label>
        <label class="field">주의
          <textarea id="resCaution">${escapeHtml(node.caution)}</textarea>
        </label>
        <label class="field">숫자 예시
          <input id="resExample" value="${escapeHtml(node.example)}" />
        </label>
        <button type="button" class="btn btn-ghost" id="btnToQuestion">이 노드를 질문으로 바꾸기</button>
      </div>`;
  }

  function readCurrentNodeIntoData() {
    const node = state.data.nodes[state.editingNodeId];
    if (!node) return;
    if (node.type === "question") {
      const prompt = document.getElementById("nodePrompt");
      if (prompt) node.prompt = prompt.value.trim();
      node.options = Array.from(document.querySelectorAll("#optionEditor .option-row")).map((row) => ({
        label: row.querySelector('[data-field="label"]').value.trim(),
        nextId: row.querySelector('[data-field="nextId"]').value
      })).filter((o) => o.label);
      return;
    }
    const title = document.getElementById("resTitle");
    if (!title) return;
    node.title = title.value.trim();
    node.vat = document.getElementById("resVat").value;
    node.vatNote = document.getElementById("resVatNote").value.trim();
    node.guide = document.getElementById("resGuide").value.trim();
    node.caution = document.getElementById("resCaution").value.trim();
    node.example = document.getElementById("resExample").value.trim();
    node.journal = Array.from(document.querySelectorAll("#journalEditor .journal-row")).map((row) => ({
      side: row.querySelector('[data-field="side"]').value,
      account: row.querySelector('[data-field="account"]').value.trim(),
      memo: row.querySelector('[data-field="memo"]').value.trim()
    })).filter((l) => l.account || l.memo);
  }

  function fillTopic(topic) {
    state.topicId = topic.id;
    state.editingNodeId = topic.startNodeId;
    els.topicId.value = topic.id;
    els.title.value = topic.title || "";
    els.keywords.value = (topic.keywords || []).join(", ");
    renderList();
    renderTree();
  }

  function currentTopicPatch() {
    readCurrentNodeIntoData();
    const topic = state.data.topics.find((t) => t.id === state.topicId);
    if (!topic) return;
    topic.title = els.title.value.trim();
    topic.keywords = els.keywords.value.split(/[,/，、]+/).map((k) => k.trim()).filter(Boolean);
  }

  els.formLock.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await JournalStore.checkPassword(els.password.value);
    els.password.value = "";
    if (!ok) {
      showToast("비밀번호가 일치하지 않습니다.");
      return;
    }
    try { sessionStorage.setItem(JournalStore.ADMIN_UNLOCK_KEY, "1"); } catch {}
    applyLock();
    load();
  });

  els.list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-id]");
    if (!btn) return;
    currentTopicPatch();
    const topic = state.data.topics.find((t) => t.id === btn.dataset.id);
    if (topic) fillTopic(topic);
  });

  els.btnNew.addEventListener("click", () => {
    const made = JournalStore.emptyTopic();
    state.data.nodes[made.start.id] = made.start;
    state.data.topics.unshift(made.topic);
    fillTopic(made.topic);
    els.title.focus();
  });

  els.tree.addEventListener("click", (e) => {
    if (e.target.id === "btnAddOpt") {
      readCurrentNodeIntoData();
      const node = state.data.nodes[state.editingNodeId];
      node.options = node.options || [];
      node.options.push({ label: "", nextId: "" });
      renderTree();
      return;
    }
    if (e.target.id === "btnNewQ" || e.target.id === "btnNewR") {
      readCurrentNodeIntoData();
      const fresh = e.target.id === "btnNewQ" ? JournalStore.emptyQuestion() : JournalStore.emptyResult();
      if (fresh.type === "question") fresh.prompt = "다음으로 확인할 것은?";
      state.data.nodes[fresh.id] = fresh;
      const node = state.data.nodes[state.editingNodeId];
      const empty = (node.options || []).find((o) => !o.nextId);
      if (empty) empty.nextId = fresh.id;
      else node.options.push({ label: "다음", nextId: fresh.id });
      state.editingNodeId = fresh.id;
      renderTree();
      return;
    }
    if (e.target.id === "btnToResult") {
      readCurrentNodeIntoData();
      const prev = state.data.nodes[state.editingNodeId];
      const res = JournalStore.emptyResult();
      res.id = prev.id;
      res.title = prev.prompt || "안내";
      state.data.nodes[res.id] = res;
      renderTree();
      return;
    }
    if (e.target.id === "btnToQuestion") {
      readCurrentNodeIntoData();
      const prev = state.data.nodes[state.editingNodeId];
      const q = JournalStore.emptyQuestion();
      q.id = prev.id;
      q.prompt = prev.title || "어떤 경우인가요?";
      state.data.nodes[q.id] = q;
      renderTree();
      return;
    }
    if (e.target.id === "btnAddLine") {
      readCurrentNodeIntoData();
      const node = state.data.nodes[state.editingNodeId];
      node.journal = node.journal || [];
      node.journal.push({ side: "debit", account: "", memo: "" });
      renderTree();
      return;
    }
    const delOpt = e.target.closest("[data-del-opt]");
    if (delOpt) {
      readCurrentNodeIntoData();
      const row = delOpt.closest(".option-row");
      const idx = Number(row.dataset.idx);
      const node = state.data.nodes[state.editingNodeId];
      node.options.splice(idx, 1);
      renderTree();
      return;
    }
    const delLine = e.target.closest("[data-del-line]");
    if (delLine) {
      readCurrentNodeIntoData();
      const row = delLine.closest(".journal-row");
      const idx = Number(row.dataset.idx);
      const node = state.data.nodes[state.editingNodeId];
      node.journal.splice(idx, 1);
      renderTree();
    }
  });

  els.tree.addEventListener("change", (e) => {
    const sel = e.target.closest('select[data-field="nextId"]');
    if (!sel) return;
    readCurrentNodeIntoData();
    if (sel.value) {
      state.editingNodeId = sel.value;
      renderTree();
    }
  });

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    currentTopicPatch();
    if (!els.title.value.trim()) {
      showToast("주제 이름을 입력하세요.");
      return;
    }
    JournalStore.saveData(state.data);
    state.data = JournalStore.loadData();
    renderList();
    showToast("저장했습니다. 안내 페이지 검색에 바로 반영됩니다.");
  });

  els.btnDelete.addEventListener("click", () => {
    if (!state.topicId) return;
    if (!confirm("이 주제를 삭제할까요?")) return;
    state.data.topics = state.data.topics.filter((t) => t.id !== state.topicId);
    JournalStore.saveData(state.data);
    state.topicId = state.data.topics[0] ? state.data.topics[0].id : null;
    load();
    showToast("삭제했습니다.");
  });

  els.btnReset.addEventListener("click", () => {
    if (!confirm("관리자가 저장한 질문 트리를 지우고 기본값으로 되돌릴까요?")) return;
    state.data = JournalStore.resetToSeed();
    state.topicId = state.data.topics[0] ? state.data.topics[0].id : null;
    load();
    showToast("기본값으로 되돌렸습니다.");
  });

  applyLock();
  if (isUnlocked()) load();
})();
