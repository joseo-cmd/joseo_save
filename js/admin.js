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
    tabQuestion: document.getElementById("tabQuestion"),
    tabResult: document.getElementById("tabResult"),
    tabHelp: document.getElementById("tabHelp"),
    qCount: document.getElementById("qCount"),
    rCount: document.getElementById("rCount"),
    btnAddNode: document.getElementById("btnAddNode"),
    nodeList: document.getElementById("nodeList"),
    nodeEditor: document.getElementById("nodeEditor"),
    editorTitle: document.getElementById("editorTitle"),
    btnNew: document.getElementById("btnNew"),
    btnDelete: document.getElementById("btnDelete"),
    btnReset: document.getElementById("btnReset"),
    toast: document.getElementById("toast")
  };

  const state = {
    data: null,
    topicId: null,
    tab: "question",
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

  function topicNodes(type) {
    const topic = currentTopic();
    if (!topic) return [];
    const seen = new Set();
    const walk = (id) => {
      if (!id || seen.has(id) || !state.data.nodes[id]) return;
      seen.add(id);
      const n = state.data.nodes[id];
      if (n.type === "question") (n.options || []).forEach((o) => walk(o.nextId));
    };
    walk(topic.startNodeId);
    Object.keys(state.data.nodes).forEach((id) => {
      const n = state.data.nodes[id];
      if (n.topicId === topic.id) seen.add(id);
    });
    return Array.from(seen)
      .map((id) => state.data.nodes[id])
      .filter((n) => n && (!type || n.type === type));
  }

  function currentTopic() {
    return state.data.topics.find((t) => t.id === state.topicId) || null;
  }

  function load() {
    state.data = JournalStore.loadData();
    if (!state.topicId && state.data.topics[0]) state.topicId = state.data.topics[0].id;
    renderList();
    const topic = currentTopic();
    if (topic) fillTopic(topic, { keepTab: true });
  }

  function renderList() {
    els.list.innerHTML = state.data.topics.map((t) =>
      `<button type="button" class="admin-item${t.id === state.topicId ? " active" : ""}" data-id="${escapeHtml(t.id)}">
        <strong>${escapeHtml(t.title)}</strong>
        <span class="hint">${escapeHtml((t.keywords || []).slice(0, 4).join(", "))}</span>
      </button>`
    ).join("") || `<div class="hint" style="padding:16px">주제를 추가하세요.</div>`;
  }

  function nextSelect(selectedId) {
    const questions = topicNodes("question");
    const results = topicNodes("result");
    const allQ = Object.values(state.data.nodes).filter((n) => n.type === "question");
    const allR = Object.values(state.data.nodes).filter((n) => n.type === "result");
    const qSet = new Set(questions.map((n) => n.id));
    const rSet = new Set(results.map((n) => n.id));
    const extraQ = allQ.filter((n) => !qSet.has(n.id));
    const extraR = allR.filter((n) => !rSet.has(n.id));
    const opt = (n) => `<option value="${escapeHtml(n.id)}"${n.id === selectedId ? " selected" : ""}>${escapeHtml(n.type === "question" ? (n.prompt || "질문") : (n.title || "결과"))}</option>`;
    return `<option value="">연결 안 함</option>
      <optgroup label="질문">${questions.map(opt).join("")}${extraQ.length ? extraQ.map(opt).join("") : ""}</optgroup>
      <optgroup label="결과 (부가세·분개)">${results.map(opt).join("")}${extraR.length ? extraR.map(opt).join("") : ""}</optgroup>`;
  }

  function renderTabs() {
    const qn = topicNodes("question").length;
    const rn = topicNodes("result").length;
    els.qCount.textContent = String(qn);
    els.rCount.textContent = String(rn);
    els.tabQuestion.classList.toggle("active", state.tab === "question");
    els.tabResult.classList.toggle("active", state.tab === "result");
    els.tabHelp.innerHTML = state.tab === "question"
      ? "지금은 <b>파란 질문 탭</b>입니다. 현업에게 물을 말과 보기를 수정하세요."
      : "지금은 <b>초록 결과 탭</b>입니다. 부가세 처리와 분개를 수정하세요.";
    els.btnAddNode.textContent = state.tab === "question" ? "질문 추가" : "결과 추가";
  }

  function renderNodeList() {
    const topic = currentTopic();
    const items = topicNodes(state.tab);
    renderTabs();
    if (!items.length) {
      els.nodeList.innerHTML = `<div class="hint" style="padding:14px">${state.tab === "question" ? "질문을 추가하세요." : "결과를 추가하세요."}</div>`;
      return;
    }
    const startId = topic && topic.startNodeId;
    els.nodeList.innerHTML = items.map((n) => {
      const active = n.id === state.editingNodeId;
      const cls = active ? (n.type === "question" ? " active-q" : " active-r") : "";
      const label = n.type === "question" ? (n.prompt || "새 질문") : (n.title || "새 결과");
      const meta = n.type === "question"
        ? `보기 ${(n.options || []).length}개`
        : (JournalStore.vatInfo(n.vat).short || "");
      return `<button type="button" class="node-item${cls}" data-node="${escapeHtml(n.id)}">
        <span class="tag ${n.type === "question" ? "tag-q" : "tag-r"}">${n.type === "question" ? "질문" : "결과"}</span>
        ${n.id === startId ? '<span class="start-mark">검색 첫 질문</span>' : ""}
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(meta)}</small>
      </button>`;
    }).join("");
  }

  function renderEditor() {
    const node = state.data.nodes[state.editingNodeId];
    if (!node || node.type !== state.tab) {
      els.nodeEditor.innerHTML = `<div class="help-box">${state.tab === "question" ? "왼쪽에서 질문을 고르거나 질문 추가를 누르세요." : "왼쪽에서 결과를 고르거나 결과 추가를 누르세요."}</div>`;
      return;
    }
    if (node.type === "question") {
      const topic = currentTopic();
      const isStart = topic && topic.startNodeId === node.id;
      els.nodeEditor.innerHTML = `
        <div class="node-card">
          <div class="btn-row">
            <span class="tag tag-q">질문</span>
            <label class="hint" style="display:inline-flex;gap:6px;align-items:center;font-weight:700">
              <input type="checkbox" id="asStart"${isStart ? " checked" : ""} /> 검색하면 이 질문부터 시작
            </label>
          </div>
          <label class="field">현업에게 물어볼 말
            <input id="nodePrompt" value="${escapeHtml(node.prompt)}" placeholder="예: 식대인가요, 기타 복리후생인가요?" />
          </label>
          <p class="hint">보기 하나 = 현업이 고르는 답. 오른쪽에서 다음에 질문으로 갈지, 결과로 갈지 고릅니다.</p>
          <div class="option-editor" id="optionEditor">
            ${(node.options || []).map((o, i) => `
              <div class="option-row" data-idx="${i}">
                <input data-field="label" value="${escapeHtml(o.label)}" placeholder="보기 문구" />
                <select data-field="nextId">${nextSelect(o.nextId)}</select>
                <button type="button" class="icon-btn" data-del-opt aria-label="보기 삭제">×</button>
              </div>`).join("")}
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-ghost" id="btnAddOpt">보기 추가</button>
            <button type="button" class="btn btn-danger" id="btnDelNode">이 질문 삭제</button>
          </div>
        </div>`;
      return;
    }
    const vatOpts = JournalStore.vatList().map((v) =>
      `<option value="${v.id}"${node.vat === v.id ? " selected" : ""}>${escapeHtml(v.label)}</option>`
    ).join("");
    els.nodeEditor.innerHTML = `
      <div class="node-card">
        <span class="tag tag-r">결과 · 부가세와 분개</span>
        <label class="field">결과 제목
          <input id="resTitle" value="${escapeHtml(node.title)}" placeholder="예: 직원 식대 (공제 가능)" />
        </label>
        <label class="field">부가세 처리
          <select id="resVat">${vatOpts}</select>
        </label>
        <label class="field">부가세 안내
          <textarea id="resVatNote" placeholder="공제되는지, 예수금인지 적어 주세요.">${escapeHtml(node.vatNote)}</textarea>
        </label>
        <div>
          <div class="card-head" style="padding:0 0 8px;border:0">
            <h2>분개</h2>
            <button type="button" class="btn btn-ghost" id="btnAddLine">행 추가</button>
          </div>
          <div class="journal-editor" id="journalEditor">
            ${(node.journal && node.journal.length ? node.journal : [{ side: "debit", account: "", memo: "" }]).map((l, i) => `
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
        <button type="button" class="btn btn-danger" id="btnDelNode">이 결과 삭제</button>
      </div>`;
  }

  function readCurrentNodeIntoData() {
    const node = state.data.nodes[state.editingNodeId];
    if (!node) return;
    if (node.type === "question") {
      const prompt = document.getElementById("nodePrompt");
      if (!prompt) return;
      node.prompt = prompt.value.trim();
      node.options = Array.from(document.querySelectorAll("#optionEditor .option-row")).map((row) => ({
        label: row.querySelector('[data-field="label"]').value.trim(),
        nextId: row.querySelector('[data-field="nextId"]').value
      })).filter((o) => o.label);
      const asStart = document.getElementById("asStart");
      const topic = currentTopic();
      if (asStart && asStart.checked && topic) topic.startNodeId = node.id;
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

  function refreshEditor() {
    renderNodeList();
    renderEditor();
  }

  function fillTopic(topic, opts) {
    readCurrentNodeIntoData();
    state.topicId = topic.id;
    if (!opts || !opts.keepTab) state.tab = "question";
    const first = topicNodes(state.tab)[0];
    state.editingNodeId = first ? first.id : (state.tab === "question" ? topic.startNodeId : null);
    els.topicId.value = topic.id;
    els.title.value = topic.title || "";
    els.keywords.value = (topic.keywords || []).join(", ");
    els.editorTitle.textContent = topic.title ? topic.title + " 수정" : "주제 수정";
    renderList();
    refreshEditor();
  }

  function currentTopicPatch() {
    readCurrentNodeIntoData();
    const topic = currentTopic();
    if (!topic) return;
    topic.title = els.title.value.trim();
    topic.keywords = els.keywords.value.split(/[,/，、]+/).map((k) => k.trim()).filter(Boolean);
  }

  function setTab(tab) {
    readCurrentNodeIntoData();
    state.tab = tab;
    const items = topicNodes(tab);
    state.editingNodeId = items[0] ? items[0].id : null;
    refreshEditor();
  }

  function addNode() {
    readCurrentNodeIntoData();
    const topic = currentTopic();
    if (!topic) {
      showToast("주제를 먼저 만드세요.");
      return;
    }
    const fresh = state.tab === "question" ? JournalStore.emptyQuestion() : JournalStore.emptyResult();
    fresh.topicId = topic.id;
    if (fresh.type === "question") fresh.prompt = "";
    state.data.nodes[fresh.id] = fresh;
    if (fresh.type === "question" && !topic.startNodeId) topic.startNodeId = fresh.id;
    state.editingNodeId = fresh.id;
    refreshEditor();
  }

  function deleteNode() {
    const node = state.data.nodes[state.editingNodeId];
    if (!node) return;
    if (!confirm((node.type === "question" ? "이 질문을" : "이 결과를") + " 삭제할까요?")) return;
    const id = node.id;
    delete state.data.nodes[id];
    Object.keys(state.data.nodes).forEach((nid) => {
      const n = state.data.nodes[nid];
      if (n.type === "question") {
        n.options = (n.options || []).map((o) => o.nextId === id ? Object.assign({}, o, { nextId: "" }) : o);
      }
    });
    const topic = currentTopic();
    if (topic && topic.startNodeId === id) {
      const nextQ = topicNodes("question")[0];
      topic.startNodeId = nextQ ? nextQ.id : "";
    }
    const items = topicNodes(state.tab);
    state.editingNodeId = items[0] ? items[0].id : null;
    refreshEditor();
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

  els.tabQuestion.addEventListener("click", () => setTab("question"));
  els.tabResult.addEventListener("click", () => setTab("result"));
  els.btnAddNode.addEventListener("click", addNode);

  els.nodeList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-node]");
    if (!btn) return;
    readCurrentNodeIntoData();
    state.editingNodeId = btn.dataset.node;
    refreshEditor();
  });

  els.nodeEditor.addEventListener("click", (e) => {
    if (e.target.id === "btnAddOpt") {
      readCurrentNodeIntoData();
      const node = state.data.nodes[state.editingNodeId];
      node.options = node.options || [];
      node.options.push({ label: "", nextId: "" });
      renderEditor();
      return;
    }
    if (e.target.id === "btnAddLine") {
      readCurrentNodeIntoData();
      const node = state.data.nodes[state.editingNodeId];
      node.journal = node.journal || [];
      node.journal.push({ side: "debit", account: "", memo: "" });
      renderEditor();
      return;
    }
    if (e.target.id === "btnDelNode") {
      deleteNode();
      return;
    }
    const delOpt = e.target.closest("[data-del-opt]");
    if (delOpt) {
      readCurrentNodeIntoData();
      const idx = Number(delOpt.closest(".option-row").dataset.idx);
      state.data.nodes[state.editingNodeId].options.splice(idx, 1);
      renderEditor();
      return;
    }
    const delLine = e.target.closest("[data-del-line]");
    if (delLine) {
      readCurrentNodeIntoData();
      const idx = Number(delLine.closest(".journal-row").dataset.idx);
      state.data.nodes[state.editingNodeId].journal.splice(idx, 1);
      renderEditor();
    }
  });

  els.btnNew.addEventListener("click", () => {
    const made = JournalStore.emptyTopic();
    made.start.topicId = made.topic.id;
    made.start.prompt = "";
    state.data.nodes[made.start.id] = made.start;
    state.data.topics.unshift(made.topic);
    state.tab = "question";
    fillTopic(made.topic);
    els.title.focus();
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
    refreshEditor();
    showToast("저장했습니다. 안내 페이지 검색에 반영됩니다.");
  });

  els.btnDelete.addEventListener("click", () => {
    if (!state.topicId) return;
    if (!confirm("이 검색 주제를 삭제할까요? 질문·결과는 연결이 끊깁니다.")) return;
    state.data.topics = state.data.topics.filter((t) => t.id !== state.topicId);
    JournalStore.saveData(state.data);
    state.topicId = state.data.topics[0] ? state.data.topics[0].id : null;
    load();
    showToast("삭제했습니다.");
  });

  els.btnReset.addEventListener("click", () => {
    if (!confirm("관리자가 저장한 내용을 지우고 기본값으로 되돌릴까요?")) return;
    state.data = JournalStore.resetToSeed();
    state.topicId = state.data.topics[0] ? state.data.topics[0].id : null;
    state.tab = "question";
    load();
    showToast("기본값으로 되돌렸습니다.");
  });

  applyLock();
  if (isUnlocked()) load();
})();
