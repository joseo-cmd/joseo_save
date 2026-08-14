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
    pageTopics: document.getElementById("pageTopics"),
    pagePopular: document.getElementById("pagePopular"),
    pageAsks: document.getElementById("pageAsks"),
    viewTopics: document.getElementById("viewTopics"),
    viewPopular: document.getElementById("viewPopular"),
    viewAsks: document.getElementById("viewAsks"),
    popularForm: document.getElementById("popularForm"),
    popularList: document.getElementById("popularList"),
    popularPool: document.getElementById("popularPool"),
    popularCustom: document.getElementById("popularCustom"),
    btnAddPopular: document.getElementById("btnAddPopular"),
    welcomeForm: document.getElementById("welcomeForm"),
    welcomeText: document.getElementById("welcomeText"),
    askEmailForm: document.getElementById("askEmailForm"),
    askEmail: document.getElementById("askEmail"),
    askList: document.getElementById("askList"),
    btnPublish: document.getElementById("btnPublish"),
    btnPublish2: document.getElementById("btnPublish2"),
    btnPublishNav: document.getElementById("btnPublishNav"),
    toast: document.getElementById("toast")
  };

  const state = {
    data: null,
    topicId: null,
    tab: "question",
    page: "topics",
    editingNodeId: null
  };
  let askPoll = 0;

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

  function persist(okMsg) {
    readWelcomeIntoData();
    readAskEmailIntoData();
    JournalStore.saveData(state.data);
    state.data = JournalStore.loadData();
    if (state.page === "asks") renderAsks();
    showToast(okMsg || "이 컴퓨터에 저장했습니다. 다른 사람이 보려면 ‘다른 사람에게 보이기’를 눌러 주세요.");
  }

  function readWelcomeIntoData() {
    if (!els.welcomeText || els.welcomeText.dataset.ready !== "1") return;
    state.data.welcome = els.welcomeText.value;
  }

  function readAskEmailIntoData() {
    if (!els.askEmail) return;
    state.data.askEmail = els.askEmail.value.trim();
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

  function topicMemberIds() {
    const topic = currentTopic();
    if (!topic) return new Set();
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
    (topic.questionOrder || []).concat(topic.resultOrder || []).forEach((id) => {
      if (state.data.nodes[id]) seen.add(id);
    });
    return seen;
  }

  function topicNodes(type) {
    const topic = currentTopic();
    if (!topic) return [];
    const members = topicMemberIds();
    const orderKey = type === "result" ? "resultOrder" : "questionOrder";
    const order = Array.isArray(topic[orderKey]) ? topic[orderKey] : [];
    const result = [];
    const used = new Set();
    order.forEach((id) => {
      if (!members.has(id) || used.has(id)) return;
      const n = state.data.nodes[id];
      if (!n || (type && n.type !== type)) return;
      result.push(n);
      used.add(id);
    });
    Array.from(members).forEach((id) => {
      if (used.has(id)) return;
      const n = state.data.nodes[id];
      if (!n || (type && n.type !== type)) return;
      result.push(n);
    });
    return result;
  }

  function writeTabOrder(ids) {
    const topic = currentTopic();
    if (!topic) return;
    if (state.tab === "result") topic.resultOrder = ids.slice();
    else {
      topic.questionOrder = ids.slice();
      if (ids[0]) topic.startNodeId = ids[0];
    }
  }

  function moveNode(id, dir) {
    readCurrentNodeIntoData();
    const items = topicNodes(state.tab);
    const idx = items.findIndex((n) => n.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= items.length) return;
    const ids = items.map((n) => n.id);
    const cur = ids[idx];
    ids[idx] = ids[swap];
    ids[swap] = cur;
    writeTabOrder(ids);
    refreshEditor();
  }

  function currentTopic() {
    return state.data.topics.find((t) => t.id === state.topicId) || null;
  }

  function load() {
    state.data = JournalStore.loadData();
    if (!Array.isArray(state.data.popular)) state.data.popular = [];
    if (!state.topicId && state.data.topics[0]) state.topicId = state.data.topics[0].id;
    renderList();
    renderPopularEditor();
    renderAsks();
    const topic = currentTopic();
    if (topic) fillTopic(topic, { keepTab: true });
  }

  function setPage(page) {
    if (state.page === "topics") currentTopicPatch();
    state.page = page;
    els.pageTopics.classList.toggle("active", page === "topics");
    els.pagePopular.classList.toggle("active", page === "popular");
    if (els.pageAsks) els.pageAsks.classList.toggle("active", page === "asks");
    els.viewTopics.hidden = page !== "topics";
    els.viewPopular.hidden = page !== "popular";
    if (els.viewAsks) els.viewAsks.hidden = page !== "asks";
    if (askPoll) {
      clearInterval(askPoll);
      askPoll = 0;
    }
    if (page === "popular") renderPopularEditor();
    if (page === "asks") {
      renderAsks();
      JournalStore.pullSharedAsks().then(() => renderAsks());
      askPoll = setInterval(() => {
        JournalStore.pullSharedAsks().then(() => renderAsks());
      }, 8000);
    }
  }

  function renderAsks() {
    if (!els.askList) return;
    if (els.askEmail) els.askEmail.value = JournalStore.getAskEmail();
    const asks = JournalStore.getAsks();
    if (!asks.length) {
      els.askList.innerHTML = '<p class="hint" style="padding:8px 0">아직 문의가 없습니다.</p>';
      return;
    }
    els.askList.innerHTML = asks.map((ask) => {
      const when = ask.createdAt
        ? new Date(ask.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })
        : "";
      return `<article class="ask-item${ask.done ? " is-done" : ""}" data-ask-id="${escapeHtml(ask.id)}">
        <div class="ask-meta">${escapeHtml(ask.dept)} · ${escapeHtml(ask.nick)}${when ? `<span>${escapeHtml(when)}</span>` : ""}</div>
        <p>${escapeHtml(ask.text)}</p>
        <div class="ask-item-actions">
          <button type="button" class="btn btn-ghost" data-ask-done>${ask.done ? "미완료로" : "완료"}</button>
          <button type="button" class="btn btn-ghost" data-ask-del>삭제</button>
        </div>
      </article>`;
    }).join("");
  }

  function popularLabels() {
    return (state.data.popular || []).map((p) => p.label.toLowerCase());
  }

  function addPopularItem(label, topicId) {
    const text = String(label || "").trim();
    if (!text) return false;
    if (popularLabels().includes(text.toLowerCase())) {
      showToast("이미 있는 키워드입니다.");
      return false;
    }
    state.data.popular = state.data.popular || [];
    state.data.popular.push({ label: text, topicId: topicId || "" });
    renderPopularEditor();
    return true;
  }

  function matchTopicForLabel(label) {
    const q = String(label || "").trim().toLowerCase().replace(/\s+/g, "");
    const hits = (state.data.topics || []).filter((t) => {
      const hay = [t.title, ...(t.keywords || [])].join(" ").toLowerCase().replace(/\s+/g, "");
      return t.title.toLowerCase().replace(/\s+/g, "") === q || hay.includes(q);
    });
    return hits.length === 1 ? hits[0] : null;
  }

  function renderPopularEditor() {
    if (els.welcomeText) {
      els.welcomeText.value = state.data.welcome || JournalStore.getWelcome();
      els.welcomeText.dataset.ready = "1";
    }
    const items = state.data.popular || [];
    if (!items.length) {
      els.popularList.innerHTML = `<div class="hint" style="padding:8px 0">아직 없습니다. 왼쪽에서 고르거나 직접 입력하세요.</div>`;
    } else {
      els.popularList.innerHTML = items.map((item, i) => {
        const topic = item.topicId ? state.data.topics.find((t) => t.id === item.topicId) : null;
        const meta = topic ? "주제: " + topic.title : "키워드 검색";
        return `<div class="popular-row" data-idx="${i}">
          <span class="idx">${i + 1}</span>
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(meta)}</small>
          </div>
          <button type="button" class="icon-btn" data-pop-up ${i === 0 ? "disabled" : ""} aria-label="위로">↑</button>
          <button type="button" class="icon-btn" data-pop-down ${i === items.length - 1 ? "disabled" : ""} aria-label="아래로">↓</button>
          <button type="button" class="icon-btn" data-pop-del aria-label="삭제">×</button>
        </div>`;
      }).join("");
    }

    const used = new Set(popularLabels());
    const chips = [];
    (state.data.topics || []).forEach((t) => {
      if (!used.has(t.title.toLowerCase())) {
        chips.push({ label: t.title, topicId: t.id, kind: "주제" });
      }
      (t.keywords || []).forEach((k) => {
        if (!used.has(k.toLowerCase())) {
          chips.push({ label: k, topicId: t.id, kind: "키워드" });
        }
      });
    });
    const seen = new Set();
    const unique = chips.filter((c) => {
      const key = c.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    els.popularPool.innerHTML = unique.length
      ? unique.map((c) =>
          `<button type="button" class="chip ${c.kind === "주제" ? "chip-topic" : ""}" data-add-label="${escapeHtml(c.label)}" data-add-topic="${escapeHtml(c.topicId)}">${escapeHtml(c.label)}</button>`
        ).join("")
      : `<div class="hint">넣을 수 있는 키워드가 없습니다. 검색 주제의 키워드를 먼저 등록하세요.</div>`;
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
      ? "지금은 <b>파란 질문 탭</b>입니다. 왼쪽에서 위·아래로 순서를 바꾸세요. 맨 위가 검색 첫 질문입니다."
      : "지금은 <b>초록 결과 탭</b>입니다. 왼쪽에서 위·아래로 결과 순서를 바꿀 수 있습니다.";
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
    els.nodeList.innerHTML = items.map((n, i) => {
      const active = n.id === state.editingNodeId;
      const cls = active ? (n.type === "question" ? " active-q" : " active-r") : "";
      const label = n.type === "question" ? (n.prompt || "새 질문") : (n.title || "새 결과");
      const meta = n.type === "question"
        ? `보기 ${(n.options || []).length}개`
        : (JournalStore.vatInfo(n.vat).short || "");
      return `<div class="node-item${cls}">
        <button type="button" class="node-pick" data-node="${escapeHtml(n.id)}">
          <span class="tag ${n.type === "question" ? "tag-q" : "tag-r"}">${n.type === "question" ? "질문" : "결과"} ${i + 1}</span>
          ${n.id === startId ? '<span class="start-mark">검색 첫 질문</span>' : ""}
          <strong>${escapeHtml(label)}</strong>
          <small>${escapeHtml(meta)}</small>
        </button>
        <button type="button" class="icon-btn" data-node-up="${escapeHtml(n.id)}" ${i === 0 ? "disabled" : ""} aria-label="위로">↑</button>
        <button type="button" class="icon-btn" data-node-down="${escapeHtml(n.id)}" ${i === items.length - 1 ? "disabled" : ""} aria-label="아래로">↓</button>
      </div>`;
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
          <p class="hint">보기 하나 = 현업이 고르는 답. 위·아래로 보기 순서를 바꿀 수 있습니다.</p>
          <div class="option-editor" id="optionEditor">
            ${(node.options || []).map((o, i) => `
              <div class="option-row" data-idx="${i}">
                <input data-field="label" value="${escapeHtml(o.label)}" placeholder="보기 문구" />
                <select data-field="nextId">${nextSelect(o.nextId)}</select>
                <button type="button" class="icon-btn" data-opt-up ${i === 0 ? "disabled" : ""} aria-label="보기 위로">↑</button>
                <button type="button" class="icon-btn" data-opt-down ${(node.options || []).length - 1 === i ? "disabled" : ""} aria-label="보기 아래로">↓</button>
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
          <p class="hint">계정코드는 회사 계정과목표에 맞게 바꾸면 됩니다.</p>
          <div class="journal-editor" id="journalEditor">
            <div class="journal-cols" aria-hidden="true">
              <span>구분</span><span>계정코드</span><span>계정과목</span><span>적요</span><span></span>
            </div>
            ${(node.journal && node.journal.length ? node.journal : [{ side: "debit", code: "", account: "", memo: "" }]).map((l, i) => `
              <div class="journal-row" data-idx="${i}">
                <select data-field="side">
                  <option value="debit"${l.side === "debit" ? " selected" : ""}>차변</option>
                  <option value="credit"${l.side === "credit" ? " selected" : ""}>대변</option>
                </select>
                <input data-field="code" value="${escapeHtml(l.code || "")}" placeholder="예: 811" />
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
      if (asStart && asStart.checked && topic) {
        topic.startNodeId = node.id;
        const ids = topicNodes("question").map((n) => n.id).filter((id) => id !== node.id);
        ids.unshift(node.id);
        topic.questionOrder = ids;
      }
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
      code: row.querySelector('[data-field="code"]').value.trim(),
      account: row.querySelector('[data-field="account"]').value.trim(),
      memo: row.querySelector('[data-field="memo"]').value.trim()
    })).filter((l) => l.account || l.code || l.memo);
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
    topic.questionOrder = topicNodes("question").map((n) => n.id);
    topic.resultOrder = topicNodes("result").map((n) => n.id);
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
    if (fresh.type === "question") {
      topic.questionOrder = topicNodes("question").map((n) => n.id).concat([fresh.id]).filter((id, i, arr) => arr.indexOf(id) === i);
    } else {
      topic.resultOrder = topicNodes("result").map((n) => n.id).concat([fresh.id]).filter((id, i, arr) => arr.indexOf(id) === i);
    }
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
    if (topic) {
      topic.questionOrder = (topic.questionOrder || []).filter((nid) => nid !== id);
      topic.resultOrder = (topic.resultOrder || []).filter((nid) => nid !== id);
    }
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
    await JournalStore.hydrate();
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
  els.pageTopics.addEventListener("click", () => setPage("topics"));
  els.pagePopular.addEventListener("click", () => setPage("popular"));
  els.pageAsks?.addEventListener("click", () => setPage("asks"));

  els.askList?.addEventListener("click", (e) => {
    const item = e.target.closest(".ask-item");
    if (!item) return;
    const id = item.dataset.askId;
    if (e.target.closest("[data-ask-del]")) {
      JournalStore.removeAsk(id);
      if (state.data) state.data.asks = JournalStore.getAsks();
      persist("문의를 삭제했습니다.");
      return;
    }
    if (e.target.closest("[data-ask-done]")) {
      const ask = JournalStore.getAsks().find((a) => a.id === id);
      JournalStore.updateAsk(id, { done: !(ask && ask.done) });
      if (state.data) state.data.asks = JournalStore.getAsks();
      persist();
    }
  });
  els.btnAddNode.addEventListener("click", addNode);

  els.popularPool.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add-label]");
    if (!btn) return;
    addPopularItem(btn.dataset.addLabel, btn.dataset.addTopic);
  });

  els.btnAddPopular.addEventListener("click", () => {
    const label = els.popularCustom.value.trim();
    const topic = matchTopicForLabel(label);
    if (addPopularItem(label, topic ? topic.id : "")) els.popularCustom.value = "";
  });

  els.popularCustom.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    els.btnAddPopular.click();
  });

  els.popularList.addEventListener("click", (e) => {
    const row = e.target.closest(".popular-row");
    if (!row) return;
    const idx = Number(row.dataset.idx);
    const list = state.data.popular || [];
    if (e.target.closest("[data-pop-del]")) {
      list.splice(idx, 1);
      renderPopularEditor();
      return;
    }
    if (e.target.closest("[data-pop-up]") && idx > 0) {
      const cur = list[idx];
      list[idx] = list[idx - 1];
      list[idx - 1] = cur;
      renderPopularEditor();
      return;
    }
    if (e.target.closest("[data-pop-down]") && idx < list.length - 1) {
      const cur = list[idx];
      list[idx] = list[idx + 1];
      list[idx + 1] = cur;
      renderPopularEditor();
    }
  });

  els.popularForm.addEventListener("submit", (e) => {
    e.preventDefault();
    persist("자주 찾는 항목을 이 컴퓨터에 저장했습니다. 다른 사람이 보려면 ‘다른 사람에게 보이기’를 눌러 주세요.");
    renderPopularEditor();
  });

  if (els.welcomeForm) {
    els.welcomeForm.addEventListener("submit", (e) => {
      e.preventDefault();
      persist("첫 멘트를 이 컴퓨터에 저장했습니다. 다른 사람이 보려면 ‘다른 사람에게 보이기’를 눌러 주세요.");
      renderPopularEditor();
    });
  }

  els.nodeList.addEventListener("click", (e) => {
    const up = e.target.closest("[data-node-up]");
    if (up) {
      e.preventDefault();
      moveNode(up.dataset.nodeUp, -1);
      return;
    }
    const down = e.target.closest("[data-node-down]");
    if (down) {
      e.preventDefault();
      moveNode(down.dataset.nodeDown, 1);
      return;
    }
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
      node.journal.push({ side: "debit", code: "", account: "", memo: "" });
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
    const optUp = e.target.closest("[data-opt-up]");
    if (optUp) {
      readCurrentNodeIntoData();
      const idx = Number(optUp.closest(".option-row").dataset.idx);
      const opts = state.data.nodes[state.editingNodeId].options || [];
      if (idx > 0) {
        const cur = opts[idx];
        opts[idx] = opts[idx - 1];
        opts[idx - 1] = cur;
      }
      renderEditor();
      return;
    }
    const optDown = e.target.closest("[data-opt-down]");
    if (optDown) {
      readCurrentNodeIntoData();
      const idx = Number(optDown.closest(".option-row").dataset.idx);
      const opts = state.data.nodes[state.editingNodeId].options || [];
      if (idx < opts.length - 1) {
        const cur = opts[idx];
        opts[idx] = opts[idx + 1];
        opts[idx + 1] = cur;
      }
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

  function downloadGuide() {
    if (!isUnlocked()) {
      showToast("먼저 비밀번호를 입력해 주세요.");
      if (els.password) els.password.focus();
      return;
    }
    if (!state.data) {
      showToast("잠시 후 다시 눌러 주세요.");
      return;
    }
    if (state.page === "topics") currentTopicPatch();
    readWelcomeIntoData();
    const rec = JournalStore.saveData(state.data);
    state.data = JournalStore.loadData();
    const blob = new Blob([JSON.stringify(rec, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "guide.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("guide.json 파일을 받았어요. GitHub data 폴더에 올려 주세요.");
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    currentTopicPatch();
    if (!els.title.value.trim()) {
      showToast("주제 이름을 입력하세요.");
      return;
    }
    persist("이 컴퓨터에 저장했습니다. 다른 사람이 보려면 ‘다른 사람에게 보이기’를 눌러 주세요.");
    renderList();
    renderPopularEditor();
    refreshEditor();
  });

  els.btnDelete.addEventListener("click", () => {
    if (!state.topicId) return;
    if (!confirm("이 검색 주제를 삭제할까요? 질문·결과는 연결이 끊깁니다.")) return;
    state.data.topics = state.data.topics.filter((t) => t.id !== state.topicId);
    persist("삭제했습니다.");
    state.topicId = state.data.topics[0] ? state.data.topics[0].id : null;
    load();
  });

  els.btnReset.addEventListener("click", () => {
    if (!confirm("관리자가 저장한 내용을 지우고 기본값으로 되돌릴까요?")) return;
    state.data = JournalStore.resetToSeed();
    state.topicId = state.data.topics[0] ? state.data.topics[0].id : null;
    state.tab = "question";
    persist("기본값으로 되돌렸습니다.");
    load();
  });

  if (els.btnPublish) els.btnPublish.addEventListener("click", downloadGuide);
  if (els.btnPublish2) els.btnPublish2.addEventListener("click", downloadGuide);
  if (els.btnPublishNav) els.btnPublishNav.addEventListener("click", downloadGuide);

  applyLock();
  if (isUnlocked()) {
    JournalStore.hydrate().then(() => load());
  }
})();
