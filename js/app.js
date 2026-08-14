(function () {
  const els = {
    q: document.getElementById("q"),
    cat: document.getElementById("catChips"),
    vat: document.getElementById("vatChips"),
    list: document.getElementById("list"),
    meta: document.getElementById("resultMeta"),
    count: document.getElementById("entryCount"),
    source: document.getElementById("dataSource"),
    overlay: document.getElementById("overlay"),
    detailTitle: document.getElementById("detailTitle"),
    detailCat: document.getElementById("detailCat"),
    detailBody: document.getElementById("detailBody"),
    close: document.getElementById("closeDetail"),
    toast: document.getElementById("toast")
  };

  const state = {
    query: "",
    category: "전체",
    vat: "전체",
    entries: [],
    selectedId: null
  };

  let toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function load() {
    const data = JournalStore.loadEntries();
    state.entries = data.entries;
    els.count.textContent = data.entries.length + "건";
    if (els.source) {
      els.source.textContent = data.isCustom
        ? "관리자 저장 안내 · " + new Date(data.updatedAt).toLocaleString("ko-KR")
        : "기본 예시 안내";
    }
  }

  function filtered() {
    const q = state.query.toLowerCase();
    return state.entries.filter((e) => {
      if (state.category !== "전체" && e.category !== state.category) return false;
      if (state.vat !== "전체" && e.vat !== state.vat) return false;
      if (!q) return true;
      const vat = JournalStore.vatInfo(e.vat);
      const hay = [
        e.title, e.category, e.guide, e.caution, e.example, e.vatNote,
        vat.label, vat.short,
        ...(e.keywords || []),
        ...e.journal.map((l) => l.account + " " + l.memo)
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  function renderChips() {
    const cats = ["전체"].concat(JournalStore.CATEGORIES);
    els.cat.innerHTML = cats.map((c) =>
      `<button type="button" class="chip${state.category === c ? " active" : ""}" data-cat="${escapeHtml(c)}" role="listitem">${escapeHtml(c)}</button>`
    ).join("");
    const vats = [{ id: "전체", short: "부가세 전체" }].concat(JournalStore.vatList());
    els.vat.innerHTML = vats.map((v) =>
      `<button type="button" class="vat-chip${state.vat === v.id ? " active" : ""}" data-vat="${v.id}">
        ${v.id === "전체" ? "" : `<span class="badge ${v.tone}">●</span>`}${escapeHtml(v.short)}
      </button>`
    ).join("");
  }

  function journalPreview(entry) {
    const debit = entry.journal.filter((l) => l.side === "debit").map((l) => l.account);
    const credit = entry.journal.filter((l) => l.side === "credit").map((l) => l.account);
    if (!debit.length && !credit.length) return "분개 미등록";
    return "차 " + (debit.join(", ") || "-") + "  /  대 " + (credit.join(", ") || "-");
  }

  function renderList() {
    const list = filtered();
    els.meta.textContent = list.length + "건 표시";
    if (!list.length) {
      els.list.innerHTML = `<div class="empty"><strong>조건에 맞는 안내가 없습니다</strong>검색어를 바꾸거나 관리자 페이지에서 안내를 추가하세요.</div>`;
      return;
    }
    els.list.innerHTML = list.map((e) => {
      const vat = JournalStore.vatInfo(e.vat);
      return `<article class="card">
        <button type="button" class="entry" data-open="${escapeHtml(e.id)}">
          <div class="entry-top">
            <div>
              <div class="entry-cat">${escapeHtml(e.category)}</div>
              <h3>${escapeHtml(e.title)}</h3>
            </div>
            <span class="badge ${vat.tone}">${escapeHtml(vat.short)}</span>
          </div>
          <p class="entry-preview">${escapeHtml(e.vatNote || vat.summary)}</p>
          <p class="entry-journal">${escapeHtml(journalPreview(e))}</p>
        </button>
      </article>`;
    }).join("");
  }

  function journalTable(entry) {
    if (!entry.journal.length) return `<p class="hint">등록된 분개가 없습니다.</p>`;
    return `<table class="t-table">
      <thead><tr><th style="width:88px">구분</th><th>계정과목</th><th>적요 · 금액 기준</th></tr></thead>
      <tbody>
        ${entry.journal.map((l) => `
          <tr>
            <td class="${l.side === "debit" ? "side-debit" : "side-credit"}">${l.side === "debit" ? "차변" : "대변"}</td>
            <td class="account">${escapeHtml(l.account)}</td>
            <td>${escapeHtml(l.memo)}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;
  }

  function openDetail(id) {
    const entry = state.entries.find((e) => e.id === id);
    if (!entry) {
      showToast("해당 안내를 찾지 못했습니다.");
      return;
    }
    state.selectedId = id;
    const vat = JournalStore.vatInfo(entry.vat);
    els.detailCat.textContent = entry.category;
    els.detailTitle.textContent = entry.title;
    els.detailBody.innerHTML = `
      <section class="vat-callout ${vat.tone}">
        <div class="kicker">부가세 처리</div>
        <h3>${escapeHtml(vat.label)}</h3>
        <p>${escapeHtml(entry.vatNote || vat.summary)}</p>
      </section>
      <section class="panel">
        <h3>회계분개</h3>
        ${journalTable(entry)}
      </section>
      ${entry.example ? `<section class="panel"><h3>숫자 예시</h3><p class="example-text">${escapeHtml(entry.example)}</p></section>` : ""}
      ${entry.guide ? `<section class="panel"><h3>안내사항</h3><p class="guide-text">${escapeHtml(entry.guide)}</p></section>` : ""}
      ${entry.caution ? `<section class="panel"><h3>주의</h3><div class="caution-box">${escapeHtml(entry.caution)}</div></section>` : ""}
    `;
    els.overlay.hidden = false;
    els.overlay.classList.add("open");
    history.replaceState(null, "", "#" + encodeURIComponent(id));
  }

  function closeDetail() {
    els.overlay.classList.remove("open");
    els.overlay.hidden = true;
    state.selectedId = null;
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

  function refresh() {
    renderChips();
    renderList();
  }

  els.q.addEventListener("input", () => {
    state.query = els.q.value.trim();
    renderList();
  });
  els.cat.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    state.category = btn.dataset.cat;
    refresh();
  });
  els.vat.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-vat]");
    if (!btn) return;
    state.vat = btn.dataset.vat;
    refresh();
  });
  els.list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open]");
    if (!btn) return;
    openDetail(btn.dataset.open);
  });
  els.close.addEventListener("click", closeDetail);
  els.overlay.addEventListener("click", (e) => {
    if (e.target === els.overlay) closeDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetail();
  });

  load();
  refresh();
  const hash = decodeURIComponent((location.hash || "").replace(/^#/, ""));
  if (hash) openDetail(hash);
})();
