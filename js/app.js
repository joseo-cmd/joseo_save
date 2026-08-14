(function () {
  const els = {
    form: document.getElementById("searchForm"),
    q: document.getElementById("q"),
    popular: document.getElementById("popular"),
    thread: document.getElementById("thread"),
    restart: document.getElementById("btnRestart"),
    back: document.getElementById("btnBack"),
    toast: document.getElementById("toast"),
    updatedAt: document.getElementById("updatedAt"),
    btnAsk: document.getElementById("btnAsk"),
    askBoard: document.getElementById("askBoard"),
    askFeed: document.getElementById("askFeed"),
    askForm: document.getElementById("askForm"),
    askDept: document.getElementById("askDept"),
    askNick: document.getElementById("askNick"),
    askText: document.getElementById("askText"),
    btnAskClose: document.getElementById("btnAskClose")
  };

  const state = {
    history: [],
    nodeId: null
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    setTimeout(() => els.toast.classList.remove("show"), 1600);
  }

  function popularItems() {
    return JournalStore.getPopular();
  }

  function renderPopular() {
    els.popular.innerHTML = popularItems()
      .map((item) => `<button type="button" class="chip" data-popular-label="${escapeHtml(item.label)}" data-topic="${escapeHtml(item.topicId || "")}">${escapeHtml(item.label)}</button>`)
      .join("");
  }

  function formatUpdatedAt(iso) {
    const d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return "최근 업데이트 : " + y + ". " + m + ". " + day + ". " + h + ":" + min;
  }

  function renderUpdatedAt() {
    if (!els.updatedAt) return;
    const data = JournalStore.loadData();
    const text = data && data.isCustom ? formatUpdatedAt(data.updatedAt) : "";
    els.updatedAt.textContent = text;
    els.updatedAt.hidden = !text;
  }

  function formatWon(n) {
    return Number(n || 0).toLocaleString("ko-KR") + "원";
  }

  function journalCodes(node) {
    return (node.journal || []).map((l) => String(l.code || "").trim()).filter(Boolean).join("\n");
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return Promise.resolve();
  }

  function journalTable(node) {
    if (!node.journal || !node.journal.length) return `<p class="hint">등록된 분개가 없습니다.</p>`;
    return `<table class="t-table">
      <thead><tr><th style="width:64px">구분</th><th style="width:88px">계정코드</th><th>계정과목</th><th style="width:188px">금액</th></tr></thead>
      <tbody>
        ${node.journal.map((l) => {
          const ex = JournalStore.exampleAmount(l, node.vat);
          return `<tr>
            <td class="${l.side === "debit" ? "side-debit" : "side-credit"}">${l.side === "debit" ? "차변" : "대변"}</td>
            <td class="account-code">${escapeHtml(l.code || "")}</td>
            <td class="account">${escapeHtml(l.account)}</td>
            <td class="amount"><span class="amount-num">${formatWon(ex.amount)}</span><span class="amount-kind">(${escapeHtml(ex.label)})</span></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
  }

  function resultHtml(node) {
    const vat = JournalStore.vatInfo(node.vat);
    return `<div class="result-title"><span>${escapeHtml(node.title)}</span></div>
      <div class="result-grid">
        <section class="vat-callout ${vat.tone}">
          <div class="kicker">부가세</div>
          <h3>${escapeHtml(vat.label)}</h3>
        </section>
        <section class="panel journal-panel">
          <div class="journal-head">
            <h4>분개</h4>
            ${journalCodes(node) ? `<button type="button" class="copy-codes" data-copy-codes="${encodeURIComponent(journalCodes(node))}">계정코드 복사</button>` : ""}
          </div>
          ${journalTable(node)}
        </section>
      </div>
      ${node.guide ? `<section class="panel result-note"><h4>안내</h4><p class="guide-text">${escapeHtml(node.guide)}</p></section>` : ""}
      ${node.caution ? `<section class="panel result-note"><h4>주의</h4><div class="caution-box">${escapeHtml(node.caution)}</div></section>` : ""}`;
  }

  function questionCount() {
    return state.history.filter((m) => m.kind === "question").length;
  }

  function canGoBack() {
    if (!state.history.length) return false;
    const last = state.history[state.history.length - 1];
    if (last.kind === "result") return questionCount() >= 1;
    if (last.kind === "question") return questionCount() >= 2;
    return false;
  }

  function syncBackButton() {
    if (!els.back) return;
    els.back.hidden = !canGoBack();
  }

  function goBack() {
    if (!canGoBack()) return;
    const hist = state.history;
    const last = hist[hist.length - 1];
    if (last.kind === "result" || last.kind === "question" || last.kind === "bot") hist.pop();
    if (hist.length && hist[hist.length - 1].kind === "user") hist.pop();
    const prevQ = hist.slice().reverse().find((m) => m.kind === "question");
    state.nodeId = prevQ && prevQ.nodeId ? prevQ.nodeId : null;
    renderThread();
  }

  function push(msg) {
    state.history.push(msg);
    renderThread();
  }

  function renderThread() {
    if (!state.history.length) {
      els.thread.innerHTML = `<div class="msg bot"><div class="bubble"><p class="welcome-text">${escapeHtml(JournalStore.getWelcome())}</p></div></div>`;
      syncBackButton();
      return;
    }
    els.thread.innerHTML = state.history.map((m, idx) => {
      if (m.kind === "user") {
        return `<div class="msg user"><div class="bubble"><p>${escapeHtml(m.text)}</p></div></div>`;
      }
      if (m.kind === "question") {
        const latest = idx === state.history.length - 1;
        const options = (m.options || []).map((o, i) =>
          latest
            ? `<button type="button" class="choice" data-next="${escapeHtml(o.nextId)}" data-label="${escapeHtml(o.label)}">${escapeHtml(o.label)}</button>`
            : ""
        ).join("");
        return `<div class="msg bot"><div class="bubble">
          <p>${escapeHtml(m.text)}</p>
          ${latest && options ? `<div class="choices">${options}</div>` : ""}
          ${latest && canGoBack() ? `<button type="button" class="back-q" data-back>← 이전 질문</button>` : ""}
        </div></div>`;
      }
      if (m.kind === "result") {
        const latest = idx === state.history.length - 1;
        return `<div class="msg bot"><div class="bubble">${resultHtml(m.node)}${latest && canGoBack() ? `<button type="button" class="back-q" data-back>← 이전 질문</button>` : ""}</div></div>`;
      }
      return `<div class="msg bot"><div class="bubble"><p>${escapeHtml(m.text)}</p></div></div>`;
    }).join("");
    els.thread.parentElement.scrollTop = els.thread.parentElement.scrollHeight;
    syncBackButton();
  }

  function showNode(nodeId) {
    const node = JournalStore.getNode(nodeId);
    if (!node) {
      push({ kind: "bot", text: "이어서 연결할 안내가 아직 없습니다. 관리자에서 다음 질문을 등록해 주세요." });
      return;
    }
    state.nodeId = node.id;
    if (node.type === "question") {
      push({ kind: "question", text: node.prompt, options: node.options || [], nodeId: node.id });
      return;
    }
    push({ kind: "result", node });
  }

  function startTopic(topic) {
    state.history = [];
    push({ kind: "user", text: topic.title });
    push({ kind: "bot", text: `${topic.title} 관련해서 몇 가지만 확인할게요.` });
    showNode(topic.startNodeId);
  }

  function runSearch(raw) {
    const query = String(raw || "").trim();
    if (!query) return;
    els.q.value = query;
    const hits = JournalStore.searchTopics(query);
    state.history = [];
    push({ kind: "user", text: query });
    if (!hits.length) {
      push({
        kind: "question",
        text: "정확히 맞는 항목이 없어요. 아래 중에서 가까운 것을 골라 주세요.",
        options: JournalStore.loadData().topics.map((t) => ({ label: t.title, nextId: "topic:" + t.id }))
      });
      return;
    }
    if (hits.length === 1) {
      push({ kind: "bot", text: `${hits[0].title}로 찾아봤어요. 이어서 질문할게요.` });
      showNode(hits[0].startNodeId);
      return;
    }
    push({
      kind: "question",
      text: "여러 건이 나왔어요. 어떤 건가요?",
      options: hits.map((t) => ({ label: t.title, nextId: "topic:" + t.id }))
    });
  }

  function choose(nextId, label) {
    push({ kind: "user", text: label });
    if (String(nextId).indexOf("topic:") === 0) {
      const id = nextId.slice(6);
      const topic = JournalStore.loadData().topics.find((t) => t.id === id);
      if (!topic) {
        push({ kind: "bot", text: "주제를 찾지 못했습니다." });
        return;
      }
      showNode(topic.startNodeId);
      return;
    }
    showNode(nextId);
  }

  function reset() {
    state.history = [];
    state.nodeId = null;
    els.q.value = "";
    renderThread();
    els.q.focus();
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    runSearch(els.q.value);
  });
  els.popular.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-popular-label]");
    if (!btn) return;
    const topicId = btn.dataset.topic;
    if (topicId) {
      const topic = JournalStore.loadData().topics.find((t) => t.id === topicId);
      if (topic) {
        startTopic(topic);
        return;
      }
    }
    runSearch(btn.dataset.popularLabel);
  });
  els.thread.addEventListener("click", (e) => {
    if (e.target.closest("[data-back]")) {
      goBack();
      return;
    }
    const copyBtn = e.target.closest("[data-copy-codes]");
    if (copyBtn) {
      const text = decodeURIComponent(copyBtn.getAttribute("data-copy-codes") || "");
      if (!text) {
        showToast("복사할 계정코드가 없습니다.");
        return;
      }
      copyText(text).then(() => showToast("계정코드를 복사했어요")).catch(() => showToast("복사하지 못했어요"));
      return;
    }
    const btn = e.target.closest("[data-next]");
    if (!btn) return;
    choose(btn.dataset.next, btn.dataset.label);
  });
  els.restart.addEventListener("click", reset);
  if (els.back) els.back.addEventListener("click", goBack);

  function fillAskProfile() {
    const p = JournalStore.getAskProfile();
    if (els.askDept && !els.askDept.value) els.askDept.value = p.dept;
    if (els.askNick && !els.askNick.value) els.askNick.value = p.nick;
  }

  function formatAskWhen(iso) {
    const d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return "";
    return (d.getMonth() + 1) + "." + d.getDate() + " " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function renderAskBoard() {
    if (!els.askFeed) return;
    const asks = JournalStore.getAsks().filter((a) => !a.done);
    if (!asks.length) {
      els.askFeed.innerHTML = '<p class="ask-empty">아직 문의가 없습니다. 2~3줄로 남겨 주세요.</p>';
      return;
    }
    els.askFeed.innerHTML = asks.map((ask) => {
      const who = [ask.dept, ask.nick].filter(Boolean).join(" · ") || "익명";
      const when = formatAskWhen(ask.createdAt);
      return `<article class="ask-post">
        <div class="ask-post-meta"><span>${escapeHtml(who)}</span>${when ? `<span>${escapeHtml(when)}</span>` : ""}</div>
        <p>${escapeHtml(ask.text)}</p>
      </article>`;
    }).join("");
  }

  let askPoll = 0;

  function setAskBoardOpen(open) {
    if (!els.askBoard) return;
    els.askBoard.hidden = !open;
    if (els.btnAsk) els.btnAsk.classList.toggle("is-on", open);
    if (askPoll) {
      clearInterval(askPoll);
      askPoll = 0;
    }
    if (open) {
      fillAskProfile();
      renderAskBoard();
      JournalStore.pullSharedAsks().then(renderAskBoard);
      askPoll = setInterval(() => {
        JournalStore.pullSharedAsks().then(renderAskBoard);
      }, 8000);
      (els.askDept && els.askDept.value ? els.askText : els.askDept).focus();
    }
  }

  if (els.btnAsk && els.askBoard) {
    els.btnAsk.addEventListener("click", () => setAskBoardOpen(els.askBoard.hidden));
  }
  if (els.btnAskClose && els.askBoard) {
    els.btnAskClose.addEventListener("click", () => setAskBoardOpen(false));
  }
  if (els.askForm) {
    els.askForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const dept = els.askDept.value.trim();
      const nick = els.askNick.value.trim();
      const text = els.askText.value.trim();
      if (!dept || !nick || !text) {
        showToast("부서, 닉네임, 문의를 모두 적어 주세요.");
        return;
      }
      JournalStore.saveAskProfile(dept, nick);
      JournalStore.addAsk({ dept, nick, text });
      els.askText.value = "";
      renderAskBoard();
      if (els.askFeed) els.askFeed.scrollTop = 0;
      showToast("게시판에 남겼어요.");
    });
  }

  JournalStore.hydrate().then(() => {
    renderPopular();
    renderThread();
    renderUpdatedAt();
    renderAskBoard();
  });
  window.addEventListener("journal-tree-changed", () => {
    renderPopular();
    renderUpdatedAt();
    renderAskBoard();
    if (!state.history.length) renderThread();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === JournalStore.STORAGE_KEY || e.key === JournalStore.ASK_KEY) {
      renderPopular();
      renderUpdatedAt();
      renderAskBoard();
      if (!state.history.length) renderThread();
    }
  });
})();
