(function (global) {
  function inlineScript(code) {
    return String(code || "").replace(/<\/script/gi, "<\\/script");
  }

  function embeddedScript(entries) {
    const json = JSON.stringify(entries || []).replace(/</g, "\\u003c");
    return '<script id="embedded-data">window.JOURNAL_EMBEDDED = ' + json + ";</script>";
  }

  function standaloneMarkup() {
    return `<nav class="nav">
    <div class="wrap nav-inner">
      <a class="logo" href="#" data-view="guide" aria-label="홈">
        <span class="logo-mark" aria-hidden="true"></span>
        <span class="logo-text">분개<span>안내</span></span>
      </a>
      <div class="nav-links">
        <button type="button" class="btn btn-download" id="btnDownloadHtml">HTML 다운받기</button>
        <a class="nav-cta" href="#admin" data-view="admin">관리자</a>
      </div>
    </div>
  </nav>

  <header class="hero" id="heroGuide">
    <div class="wrap">
      <p class="eyebrow">현업 회계처리 가이드</p>
      <h1>이 거래, 어떻게 분개하고<br /><em>부가세는?</em></h1>
      <p class="hero-lead">거래 유형을 검색하면 분개와 부가세 처리 여부까지 바로 확인할 수 있어요.</p>
      <label class="hero-search" for="q">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input id="q" type="search" placeholder="접대비, 세금계산서, 택시, 급여, 수출…" autocomplete="off" />
      </label>
      <p class="hero-meta"><strong id="entryCount">0건</strong>의 안내가 준비되어 있습니다</p>
      <div class="hero-actions">
        <button type="button" class="btn btn-download" id="btnDownloadHtmlHero">HTML 다운받기</button>
      </div>
      <span id="dataSource" hidden>기본 예시 안내</span>
    </div>
  </header>

  <header class="hero" id="heroAdmin" hidden style="padding-bottom:8px">
    <div class="wrap">
      <p class="eyebrow">관리자</p>
      <h1>분개 · 부가세 안내를<br /><em>직접 등록</em>하세요</h1>
      <p class="hero-lead">비밀번호로 잠겨 있어요. 저장한 뒤 HTML로 다시 내려받으면 다른 PC에서도 쓸 수 있습니다.</p>
    </div>
  </header>

  <main class="layout">
    <div class="wrap">
      <section id="guideView">
        <section class="search-card" aria-label="필터">
          <div class="legend" id="catChips" role="list"></div>
          <div class="legend" id="vatChips" role="list" aria-label="부가세 처리"></div>
        </section>
        <div class="results-head">
          <h2>안내 목록</h2>
          <span id="resultMeta">0건</span>
        </div>
        <div class="grid" id="list"></div>
      </section>

      <section id="adminView" hidden>
        <section class="lock-screen" id="lockScreen">
          <div class="lock-box">
            <h2>관리자 비밀번호</h2>
            <p>안내 문구와 분개를 수정하려면 비밀번호를 입력하세요.</p>
            <form id="lockForm">
              <input id="password" type="password" autocomplete="current-password" placeholder="비밀번호" />
              <button type="submit" class="btn btn-ok">확인</button>
            </form>
          </div>
        </section>
        <section id="adminApp" hidden>
          <div class="note-box">
            이 파일 하나로 안내와 관리자를 모두 사용할 수 있습니다. 수정 후 다시 HTML 저장을 누르면 최신 내용이 파일에 담깁니다.
          </div>
          <div class="btn-row" style="margin-bottom:14px">
            <button type="button" class="btn btn-ok" id="btnNew">새 안내 추가</button>
            <button type="button" class="btn btn-download" id="btnDownloadHtml2">HTML 다운받기</button>
            <button type="button" class="btn btn-ghost" id="btnExport">JSON 내보내기</button>
            <label class="btn btn-ghost" for="fileImport" style="margin:0">JSON 가져오기
              <input id="fileImport" type="file" accept="application/json,.json" hidden />
            </label>
            <button type="button" class="btn btn-ghost" id="btnReset">기본 예시로 되돌리기</button>
          </div>
          <div class="admin-layout">
            <aside class="card list-card">
              <div class="card-head">
                <h2>등록 목록</h2>
                <span class="hint" id="listCount">0</span>
              </div>
              <div class="admin-list" id="adminList"></div>
            </aside>
            <form class="card form-card" id="entryForm">
              <div class="card-head">
                <h2>안내 내용</h2>
                <div class="btn-row">
                  <button type="button" class="btn btn-danger" id="btnDelete">삭제</button>
                  <button type="submit" class="btn btn-ok">저장</button>
                </div>
              </div>
              <div class="form-body">
                <input type="hidden" id="entryId" />
                <label class="field">거래명
                  <input id="title" required placeholder="예: 거래처 접대비 (세금계산서)" />
                </label>
                <div class="two-col">
                  <label class="field">분류
                    <select id="category"></select>
                  </label>
                  <label class="field">부가세 처리
                    <select id="vat"></select>
                  </label>
                </div>
                <label class="field">검색 키워드 (쉼표로 구분)
                  <input id="keywords" placeholder="접대, 식사, 불공제" />
                </label>
                <label class="field">부가세 안내
                  <textarea id="vatNote" placeholder="이 거래의 부가세 처리 방법을 적어 주세요."></textarea>
                </label>
                <div>
                  <div class="card-head" style="padding:0 0 8px; border:0">
                    <h2>회계분개</h2>
                    <button type="button" class="btn btn-ghost" id="btnAddLine">행 추가</button>
                  </div>
                  <div class="journal-editor" id="journalEditor"></div>
                </div>
                <label class="field">안내사항
                  <textarea id="guide" placeholder="현업에서 이렇게 처리하세요."></textarea>
                </label>
                <label class="field">주의
                  <textarea id="caution" placeholder="실수하기 쉬운 점, 회계팀 확인이 필요한 점"></textarea>
                </label>
                <label class="field">숫자 예시
                  <input id="example" placeholder="공급가 1,000,000 / 세액 100,000 / 합계 1,100,000" />
                </label>
              </div>
            </form>
          </div>
        </section>
      </section>
    </div>
  </main>

  <footer class="footer" id="guideFooter">
    <div class="wrap footer-inner">
      <span>이 HTML 파일만 브라우저로 열면 됩니다 · 최종 판단은 증빙과 회계팀 확인</span>
      <a href="#admin" data-view="admin">관리자</a>
    </div>
  </footer>

  <div class="overlay" id="overlay" hidden>
    <article class="modal" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
      <div class="modal-head">
        <div>
          <span class="entry-cat" id="detailCat"></span>
          <h2 id="detailTitle"></h2>
        </div>
        <button type="button" class="close-btn" id="closeDetail" aria-label="닫기">×</button>
      </div>
      <div class="modal-body" id="detailBody"></div>
    </article>
  </div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>`;
  }

  function viewScript() {
    return inlineScript(`(function(){
      function setView(view){
        var isAdmin = view === "admin";
        var guide = document.getElementById("guideView");
        var admin = document.getElementById("adminView");
        var heroG = document.getElementById("heroGuide");
        var heroA = document.getElementById("heroAdmin");
        var foot = document.getElementById("guideFooter");
        if (guide) guide.hidden = isAdmin;
        if (admin) admin.hidden = !isAdmin;
        if (heroG) heroG.hidden = isAdmin;
        if (heroA) heroA.hidden = !isAdmin;
        if (foot) foot.hidden = isAdmin;
        if (isAdmin && location.hash !== "#admin") location.hash = "admin";
        if (!isAdmin && location.hash === "#admin") history.replaceState(null, "", location.pathname + location.search);
      }
      document.addEventListener("click", function(e){
        var link = e.target.closest("[data-view]");
        if (!link) return;
        e.preventDefault();
        setView(link.getAttribute("data-view"));
      });
      setView(location.hash === "#admin" ? "admin" : "guide");
      window.addEventListener("hashchange", function(){
        setView(location.hash === "#admin" ? "admin" : "guide");
      });
    })();`);
  }

  function buildStandaloneHtml(parts) {
    const css = parts.css || "";
    const store = inlineScript(parts.store || "");
    const app = inlineScript(parts.app || "");
    const admin = inlineScript(parts.admin || "");
    const download = inlineScript(parts.download || "");
    const entries = parts.entries || [];
    return `<!DOCTYPE html>
<html lang="ko" data-standalone="1">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>회계분개 · 부가세 안내</title>
  <meta name="description" content="현업 거래별로 회계분개와 부가세 처리 여부를 안내합니다." />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
  <style>
${css}
  </style>
</head>
<body>
${standaloneMarkup()}
  ${embeddedScript(entries)}
  <script>
${store}
  </script>
  <script>
${app}
  </script>
  <script>
${admin}
  </script>
  <script>
${download}
  </script>
  <script>
${viewScript()}
  </script>
</body>
</html>
`;
  }

  async function loadText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + " 를 불러오지 못했습니다.");
    return res.text();
  }

  async function collectSources() {
    if (global.document && document.documentElement.getAttribute("data-standalone") === "1") {
      const css = Array.from(document.querySelectorAll("style")).map((n) => n.textContent).join("\n");
      const scripts = Array.from(document.querySelectorAll("script:not(#embedded-data)")).map((n) => n.textContent);
      return {
        css,
        store: scripts[0] || "",
        app: scripts[1] || "",
        admin: scripts[2] || "",
        download: scripts[3] || ""
      };
    }
    const [css, store, app, admin, download] = await Promise.all([
      loadText("css/app.css"),
      loadText("js/store.js"),
      loadText("js/app.js"),
      loadText("js/admin.js"),
      loadText("js/download.js")
    ]);
    return { css, store, app, admin, download };
  }

  async function downloadJournalHtml() {
    const entries = global.JournalStore
      ? JournalStore.loadEntries().entries
      : (global.JOURNAL_EMBEDDED || []);
    const parts = await collectSources();
    const html = buildStandaloneHtml({
      css: parts.css,
      store: parts.store,
      app: parts.app,
      admin: parts.admin,
      download: parts.download,
      entries
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "회계분개-부가세안내.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    return true;
  }

  global.buildStandaloneHtml = buildStandaloneHtml;
  global.downloadJournalHtml = downloadJournalHtml;

  if (global.document) {
    document.addEventListener("DOMContentLoaded", function () {
      ["btnDownloadHtml", "btnDownloadHtml2", "btnDownloadHtmlHero"].forEach(function (id) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener("click", function () {
          downloadJournalHtml().catch(function () {
            const a = document.createElement("a");
            a.href = "회계분개-부가세안내.html";
            a.download = "회계분개-부가세안내.html";
            document.body.appendChild(a);
            a.click();
            a.remove();
          });
        });
      });
    });
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { buildStandaloneHtml };
  }
})(typeof window !== "undefined" ? window : global);
