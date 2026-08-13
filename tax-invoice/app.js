/* 세금계산서 미처리현황 — 예상담당자 판정 및 현업 공유 */

const EMAIL_OWNERS = {
  "fatec@atecomputer.kr": "남부,중부사업부",
  "eatec@atecomputer.kr": "이은정(교육,전자칠판)",
  "tatec@ateccomputer.kr": "강소라(공공,수도권)",
  // 도메인 오탈자 보정
  "tatec@atecomputer.kr": "강소라(공공,수도권)",
};

const EMAIL_ALIASES = {
  "공급하는자이메일": "공급자이메일",
  "공급하는자 이메일": "공급자이메일",
  "공급자 이메일": "공급자이메일",
  "공급받는자 이메일": "공급받는자이메일",
  "공급받는자이메일1": "공급받는자이메일",
  "공급받는자 이메일1": "공급받는자이메일",
  "매입매출구분": "구분",
  "세금계산서구분": "구분",
  "거래처": "거래처명",
  "상호": "거래처명",
  "사업자번호": "거래처사업자번호",
  "사업자등록번호": "거래처사업자번호",
  "담당자": "처리담당자",
  "처리자": "처리담당자",
  "처리담당": "처리담당자",
};

const UNPROCESSED_HINTS = [
  "승인번호",
  "공급자이메일",
  "공급받는자이메일",
  "공급자상호",
  "공급받는자상호",
];
const HISTORY_HINTS = ["처리담당자", "처리일자", "거래처명", "거래처사업자번호"];

const state = {
  closeMonth: "2026-08",
  unprocessed: [],
  history: [],
  assigned: [],
  filters: {
    kind: "전체",
    owner: "전체",
    rank: "전체",
    query: "",
  },
  files: {
    unprocessed: null,
    history: null,
  },
};

function normalizeKey(key) {
  return String(key || "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, "")
    .trim();
}

function canonHeader(key) {
  const raw = String(key || "").replace(/^\uFEFF/, "").trim();
  const compact = normalizeKey(raw);
  if (EMAIL_ALIASES[raw]) return EMAIL_ALIASES[raw];
  if (EMAIL_ALIASES[compact]) return EMAIL_ALIASES[compact];
  return raw;
}

function normalizeEmail(value) {
  return String(value || "")
    .replace(/\u3000/g, " ")
    .trim()
    .toLowerCase();
}

function splitEmails(value) {
  return String(value || "")
    .split(/[;,\n|/]+/)
    .map(normalizeEmail)
    .filter(Boolean);
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeName(value) {
  return String(value || "")
    .replace(/\(주\)|주식회사|\(유\)|유한회사|\s+/g, "")
    .trim()
    .toLowerCase();
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value || "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function excelDate(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const utc = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4})[.\-/]?(\d{1,2})[.\-/]?(\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return s;
}

function formatMoney(n) {
  return `${Math.round(toNumber(n)).toLocaleString("ko-KR")}원`;
}

function formatCount(n) {
  return `${n.toLocaleString("ko-KR")}건`;
}

function detectKind(row) {
  const raw = String(row["구분"] || row["매입매출"] || "").trim();
  if (raw.includes("매입")) return "매입";
  if (raw.includes("매출")) return "매출";
  return "";
}

function counterpartOf(row, kind) {
  if (kind === "매출") {
    return {
      biz: row["공급받는자등록번호"] || row["거래처사업자번호"] || "",
      name: row["공급받는자상호"] || row["거래처명"] || "",
    };
  }
  if (kind === "매입") {
    return {
      biz: row["공급자등록번호"] || row["거래처사업자번호"] || "",
      name: row["공급자상호"] || row["거래처명"] || "",
    };
  }
  return {
    biz: row["거래처사업자번호"] || row["공급자등록번호"] || row["공급받는자등록번호"] || "",
    name: row["거래처명"] || row["공급자상호"] || row["공급받는자상호"] || "",
  };
}

function lookupEmail(row, kind) {
  if (kind === "매입") {
    return row["공급받는자이메일"] || row["공급받는자이메일1"] || "";
  }
  if (kind === "매출") {
    return row["공급자이메일"] || row["공급하는자이메일"] || "";
  }
  return row["공급받는자이메일"] || row["공급자이메일"] || "";
}

function matchEmailOwner(emailField) {
  for (const email of splitEmails(emailField)) {
    if (EMAIL_OWNERS[email]) {
      return { owner: EMAIL_OWNERS[email], email };
    }
  }
  return null;
}

function buildHistoryIndex(historyRows) {
  const byBiz = new Map();
  const byName = new Map();

  const push = (map, key, rec) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(rec);
  };

  historyRows.forEach((row, idx) => {
    const owner = String(row["처리담당자"] || "").trim();
    if (!owner) return;
    const rec = {
      owner,
      date: excelDate(row["처리일자"] || row["작성일자"]),
      kind: detectKind(row),
      biz: digitsOnly(row["거래처사업자번호"] || row["사업자번호"] || row["공급자등록번호"]),
      name: String(row["거래처명"] || row["상호"] || row["공급자상호"] || "").trim(),
      idx,
    };
    push(byBiz, rec.biz, rec);
    push(byName, normalizeName(rec.name), rec);
  });

  return { byBiz, byName };
}

function pickHistoryOwner(records) {
  if (!records || !records.length) return null;
  const tally = new Map();
  records.forEach((rec) => {
    const cur = tally.get(rec.owner) || { owner: rec.owner, count: 0, latest: "" };
    cur.count += 1;
    if (rec.date && rec.date >= cur.latest) cur.latest = rec.date;
    tally.set(rec.owner, cur);
  });
  const ranked = [...tally.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.latest !== b.latest) return a.latest < b.latest ? 1 : -1;
    return a.owner.localeCompare(b.owner, "ko");
  });
  const top = ranked[0];
  return {
    owner: top.owner,
    count: top.count,
    latest: top.latest,
    total: records.length,
  };
}

function assignOwner(row, historyIndex) {
  const kind = detectKind(row) || "미구분";
  const emailField = lookupEmail(row, kind === "미구분" ? "" : kind);
  const counterpart = counterpartOf(row, kind === "미구분" ? "" : kind);
  const emailHit = matchEmailOwner(emailField);

  let historyHit = null;
  let historyHow = "";
  const bizKey = digitsOnly(counterpart.biz);
  const nameKey = normalizeName(counterpart.name);
  if (bizKey && historyIndex.byBiz.has(bizKey)) {
    historyHit = pickHistoryOwner(historyIndex.byBiz.get(bizKey));
    historyHow = "사업자번호";
  } else if (nameKey && historyIndex.byName.has(nameKey)) {
    historyHit = pickHistoryOwner(historyIndex.byName.get(nameKey));
    historyHow = "거래처명";
  }

  if (emailHit) {
    return {
      owner: emailHit.owner,
      rank: 1,
      rankLabel: "1순위 · 이메일",
      reason: `${kind === "매입" ? "공급받는자" : "공급하는자"} 이메일 ${emailHit.email}`,
      emailUsed: emailHit.email,
      historyOwner: historyHit ? historyHit.owner : "",
      historyNote: historyHit
        ? `과거 ${historyHit.count}건(${historyHow}) · 최근 ${historyHit.latest || "-"}`
        : "",
    };
  }

  if (historyHit) {
    return {
      owner: historyHit.owner,
      rank: 2,
      rankLabel: "2순위 · 과거처리",
      reason: `${counterpart.name || "거래처"} ${historyHow} 매칭 · ${historyHit.count}건 · 최근 ${historyHit.latest || "-"}`,
      emailUsed: splitEmails(emailField)[0] || "",
      historyOwner: historyHit.owner,
      historyNote: `${historyHow} · ${historyHit.count}/${historyHit.total}건`,
    };
  }

  const leftoverEmail = splitEmails(emailField)[0] || "";
  return {
    owner: "미지정",
    rank: 0,
    rankLabel: "미지정",
    reason: leftoverEmail
      ? `이메일(${leftoverEmail}) 매핑 없음 · 과거 이력 없음`
      : "이메일 없음 · 과거 이력 없음",
    emailUsed: leftoverEmail,
    historyOwner: "",
    historyNote: "",
  };
}

function assignAll(unprocessed, history) {
  const index = buildHistoryIndex(history);
  return unprocessed.map((row, i) => {
    const kind = detectKind(row) || "미구분";
    const counterpart = counterpartOf(row, kind === "미구분" ? "" : kind);
    const judged = assignOwner(row, index);
    const supply = toNumber(row["공급가액"]);
    const vat = toNumber(row["세액"]);
    const total = toNumber(row["합계금액"]) || supply + vat;
    return {
      id: i + 1,
      kind,
      approval: String(row["승인번호"] || ""),
      writeDate: excelDate(row["작성일자"]),
      issueDate: excelDate(row["발행일자"]),
      counterpartName: counterpart.name,
      counterpartBiz: counterpart.biz,
      item: String(row["품목"] || ""),
      supply,
      vat,
      total,
      memo: String(row["비고"] || ""),
      status: String(row["상태"] || "미처리"),
      emailField: lookupEmail(row, kind === "미구분" ? "" : kind),
      ...judged,
      raw: row,
    };
  });
}

function requireXlsx() {
  if (typeof XLSX === "undefined") {
    throw new Error("엑셀(.xlsx)을 읽으려면 인터넷이 필요합니다. CSV로 저장해서 올려 주세요.");
  }
}

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const src = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === "," || ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      if (row.some((c) => String(c).trim())) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => String(c).trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map(canonHeader);
  return rows.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    return obj;
  });
}

function isCsvFile(file) {
  return /\.csv$/i.test(file.name || "") || /csv/i.test(file.type || "");
}

function sheetToObjects(sheet) {
  requireXlsx();
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
  return rows.map((row) => {
    const next = {};
    Object.entries(row).forEach(([key, value]) => {
      next[canonHeader(key)] = value;
    });
    return next;
  });
}

function guessSheetRole(sheetName, rows) {
  const name = String(sheetName || "");
  if (/과거|처리|이력|history/i.test(name)) return "history";
  if (/미처리|현황|세금/i.test(name)) return "unprocessed";
  if (!rows.length) return "unknown";
  const keys = Object.keys(rows[0]);
  const histScore = HISTORY_HINTS.filter((h) => keys.includes(h)).length;
  const openScore = UNPROCESSED_HINTS.filter((h) => keys.includes(h)).length;
  if (keys.includes("처리담당자") && histScore >= 2) return "history";
  if (openScore >= 2) return "unprocessed";
  return histScore > openScore ? "history" : "unprocessed";
}

function parseWorkbook(workbook) {
  const result = { unprocessed: [], history: [] };
  workbook.SheetNames.forEach((name) => {
    const rows = sheetToObjects(workbook.Sheets[name]);
    const role = guessSheetRole(name, rows);
    if (role === "history") result.history.push(...rows);
    else if (role === "unprocessed") result.unprocessed.push(...rows);
  });
  return result;
}

function loadSample() {
  const sample = window.TAX_SAMPLE;
  if (!sample) throw new Error("샘플 데이터가 없습니다.");
  state.closeMonth = sample.closeMonth || "2026-08";
  state.unprocessed = sample.unprocessed.slice();
  state.history = sample.history.slice();
  state.files.unprocessed = "세금계산서_미처리현황_샘플.xlsx (내장)";
  state.files.history = "과거_처리데이터_샘플.xlsx (내장)";
  refreshAssigned();
}

function refreshAssigned() {
  state.assigned = assignAll(state.unprocessed, state.history);
  renderAll();
}

function filteredRows() {
  const { kind, owner, rank, query } = state.filters;
  const q = query.trim().toLowerCase();
  return state.assigned.filter((row) => {
    if (kind !== "전체" && row.kind !== kind) return false;
    if (owner !== "전체" && row.owner !== owner) return false;
    if (rank === "1" && row.rank !== 1) return false;
    if (rank === "2" && row.rank !== 2) return false;
    if (rank === "0" && row.rank !== 0) return false;
    if (q) {
      const hay = [
        row.owner,
        row.counterpartName,
        row.counterpartBiz,
        row.item,
        row.approval,
        row.emailUsed,
        row.reason,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function summarize(rows) {
  const byOwner = new Map();
  const byKind = { 매출: { count: 0, supply: 0, vat: 0 }, 매입: { count: 0, supply: 0, vat: 0 } };
  const byRank = { 1: 0, 2: 0, 0: 0 };
  rows.forEach((row) => {
    const bucket = byOwner.get(row.owner) || {
      owner: row.owner,
      count: 0,
      supply: 0,
      vat: 0,
      total: 0,
      sales: 0,
      purchase: 0,
      rank1: 0,
      rank2: 0,
      unset: 0,
    };
    bucket.count += 1;
    bucket.supply += row.supply;
    bucket.vat += row.vat;
    bucket.total += row.total;
    if (row.kind === "매출") bucket.sales += 1;
    if (row.kind === "매입") bucket.purchase += 1;
    if (row.rank === 1) bucket.rank1 += 1;
    else if (row.rank === 2) bucket.rank2 += 1;
    else bucket.unset += 1;
    byOwner.set(row.owner, bucket);

    if (byKind[row.kind]) {
      byKind[row.kind].count += 1;
      byKind[row.kind].supply += row.supply;
      byKind[row.kind].vat += row.vat;
    }
    byRank[row.rank] = (byRank[row.rank] || 0) + 1;
  });

  const owners = [...byOwner.values()].sort((a, b) => {
    if (a.owner === "미지정") return 1;
    if (b.owner === "미지정") return -1;
    return b.count - a.count || a.owner.localeCompare(b.owner, "ko");
  });

  return {
    count: rows.length,
    supply: rows.reduce((s, r) => s + r.supply, 0),
    vat: rows.reduce((s, r) => s + r.vat, 0),
    total: rows.reduce((s, r) => s + r.total, 0),
    owners,
    byKind,
    byRank,
  };
}

function ownerTone(owner) {
  if (owner === "미지정") return "unset";
  if (owner.startsWith("남부")) return "south";
  if (owner.startsWith("이은정")) return "edu";
  if (owner.startsWith("강소라")) return "public";
  return "hist";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderKpis(sum) {
  document.getElementById("kpiCount").textContent = formatCount(sum.count);
  document.getElementById("kpiSupply").textContent = formatMoney(sum.supply);
  document.getElementById("kpiVat").textContent = formatMoney(sum.vat);
  document.getElementById("kpiUnset").textContent = formatCount(sum.byRank[0] || 0);
  document.getElementById("kpiSales").textContent = `${formatCount(sum.byKind.매출.count)} · ${formatMoney(sum.byKind.매출.supply)}`;
  document.getElementById("kpiPurchase").textContent = `${formatCount(sum.byKind.매입.count)} · ${formatMoney(sum.byKind.매입.supply)}`;
  document.getElementById("kpiRank").textContent = `1순위 ${sum.byRank[1] || 0} · 2순위 ${sum.byRank[2] || 0}`;
}

function renderOwnerCards(owners) {
  const box = document.getElementById("ownerCards");
  if (!owners.length) {
    box.innerHTML = `<p class="empty-inline">표시할 담당자가 없습니다.</p>`;
    return;
  }
  box.innerHTML = owners
    .map((o) => {
      const tone = ownerTone(o.owner);
      return `
        <button type="button" class="owner-card tone-${tone}" data-owner="${escapeHtml(o.owner)}">
          <div class="owner-card-top">
            <strong>${escapeHtml(o.owner)}</strong>
            <span>${formatCount(o.count)}</span>
          </div>
          <p>매출 ${o.sales} · 매입 ${o.purchase}</p>
          <p class="owner-money">${formatMoney(o.supply)}</p>
          <p class="owner-rank">1순위 ${o.rank1} · 2순위 ${o.rank2}${o.unset ? ` · 미지정 ${o.unset}` : ""}</p>
        </button>`;
    })
    .join("");
}

function renderOwnerFilter(owners) {
  const sel = document.getElementById("filterOwner");
  const current = state.filters.owner;
  const names = ["전체", ...owners.map((o) => o.owner)];
  sel.innerHTML = names
    .map((name) => `<option value="${escapeHtml(name)}"${name === current ? " selected" : ""}>${escapeHtml(name)}</option>`)
    .join("");
}

function renderTable(rows) {
  const body = document.getElementById("tableBody");
  document.getElementById("resultMeta").textContent = `표시 ${formatCount(rows.length)} / 전체 ${formatCount(state.assigned.length)}`;
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="11" class="empty-cell">조건에 맞는 건이 없습니다.</td></tr>`;
    return;
  }
  body.innerHTML = rows
    .map((row) => {
      const tone = ownerTone(row.owner);
      return `
        <tr>
          <td>${row.id}</td>
          <td><span class="pill kind-${row.kind}">${escapeHtml(row.kind)}</span></td>
          <td>
            <strong>${escapeHtml(row.counterpartName || "-")}</strong>
            <small>${escapeHtml(row.counterpartBiz || "")}</small>
          </td>
          <td>${escapeHtml(row.item || "-")}</td>
          <td class="num">${formatMoney(row.supply)}</td>
          <td class="num">${formatMoney(row.vat)}</td>
          <td>${escapeHtml(row.writeDate || "-")}</td>
          <td>
            <span class="pill tone-${tone}">${escapeHtml(row.owner)}</span>
          </td>
          <td><span class="pill rank-${row.rank}">${escapeHtml(row.rankLabel)}</span></td>
          <td class="reason">${escapeHtml(row.reason)}</td>
          <td class="memo">${escapeHtml(row.emailUsed || row.memo || "")}</td>
        </tr>`;
    })
    .join("");
}

function buildShareText(allRows) {
  const sum = summarize(allRows);
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const monthLabel = `${state.closeMonth.replace("-", "년 ")}월`;
  const lines = [];
  lines.push(`[회계 월마감] 세금계산서 미처리현황 공유 (${ymd})`);
  lines.push("");
  lines.push(`■ 마감월: ${monthLabel}`);
  lines.push(`■ 전체 미처리: ${formatCount(sum.count)} / 공급가액 ${formatMoney(sum.supply)} / 세액 ${formatMoney(sum.vat)}`);
  lines.push(`  - 매출 ${formatCount(sum.byKind.매출.count)} (${formatMoney(sum.byKind.매출.supply)})`);
  lines.push(`  - 매입 ${formatCount(sum.byKind.매입.count)} (${formatMoney(sum.byKind.매입.supply)})`);
  lines.push(`■ 담당자 판정: 1순위 이메일 ${sum.byRank[1] || 0}건 · 2순위 과거처리 ${sum.byRank[2] || 0}건 · 미지정 ${sum.byRank[0] || 0}건`);
  lines.push("");
  lines.push("■ 예상담당자별");
  sum.owners.forEach((o) => {
    lines.push(`  - ${o.owner}: ${formatCount(o.count)} (매출 ${o.sales} / 매입 ${o.purchase}) · 공급가액 ${formatMoney(o.supply)}`);
  });
  lines.push("");
  lines.push("■ 건별 (예상담당자 | 구분 | 거래처 | 품목 | 공급가액 | 판정)");
  allRows.forEach((row) => {
    lines.push(
      `  ${row.id}. ${row.owner} | ${row.kind} | ${row.counterpartName} | ${row.item} | ${formatMoney(row.supply)} | ${row.rankLabel}`
    );
  });
  lines.push("");
  lines.push("※ 1순위: 매입=공급받는자이메일, 매출=공급하는자이메일");
  lines.push("※ 1순위 없거나 매핑 없으면 과거 처리 담당자(사업자번호→거래처명, 다건이면 최다 처리)로 2순위 지정");
  lines.push("※ 확인 후 처리 또는 담당 정정 회신 부탁드립니다.");
  return lines.join("\n");
}

function renderShare() {
  document.getElementById("shareText").value = buildShareText(state.assigned);
}

function renderFileBadges() {
  document.getElementById("fileUnprocessed").textContent = state.files.unprocessed || "샘플 데이터 사용 중";
  document.getElementById("fileHistory").textContent = state.files.history || "샘플 데이터 사용 중";
  document.getElementById("historyCount").textContent = formatCount(state.history.length);
}

function renderAll() {
  const visible = filteredRows();
  const allSum = summarize(state.assigned);
  renderKpis(allSum);
  renderOwnerCards(allSum.owners);
  renderOwnerFilter(allSum.owners);
  renderTable(visible);
  renderShare();
  renderFileBadges();
  document.getElementById("closeMonthLabel").textContent = `${state.closeMonth.replace("-", ".")} 마감`;
}

async function readExcelFile(file) {
  requireXlsx();
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: "array", cellDates: true });
}

async function onUnprocessedFile(file) {
  let parsed;
  if (isCsvFile(file)) {
    const rows = parseCsvText(await file.text());
    parsed = { unprocessed: rows, history: [] };
  } else {
    parsed = parseWorkbook(await readExcelFile(file));
  }
  if (!parsed.unprocessed.length) {
    throw new Error("미처리현황 시트를 읽지 못했습니다. 승인번호·공급자/공급받는자 이메일 컬럼을 확인해 주세요.");
  }
  state.unprocessed = parsed.unprocessed;
  state.files.unprocessed = file.name;
  if (parsed.history.length && !state.files.history) {
    state.history = parsed.history;
    state.files.history = `${file.name} (이력 시트)`;
  }
  refreshAssigned();
}

async function onHistoryFile(file) {
  let rows;
  if (isCsvFile(file)) {
    rows = parseCsvText(await file.text());
  } else {
    const parsed = parseWorkbook(await readExcelFile(file));
    rows = parsed.history.length ? parsed.history : parsed.unprocessed;
  }
  if (!rows.length) throw new Error("과거 처리 데이터를 읽지 못했습니다. 처리담당자 컬럼을 확인해 주세요.");
  state.history = rows;
  state.files.history = file.name;
  refreshAssigned();
}

function exportAssignedXlsx() {
  requireXlsx();
  const rows = filteredRows().map((row) => ({
    예상담당자: row.owner,
    판정순위: row.rankLabel,
    판정근거: row.reason,
    구분: row.kind,
    승인번호: row.approval,
    작성일자: row.writeDate,
    거래처명: row.counterpartName,
    거래처사업자번호: row.counterpartBiz,
    품목: row.item,
    공급가액: row.supply,
    세액: row.vat,
    합계금액: row.total,
    판정이메일: row.emailUsed,
    과거처리담당: row.historyOwner,
    비고: row.memo,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "예상담당자");
  const ownerWs = XLSX.utils.json_to_sheet(
    summarize(state.assigned).owners.map((o) => ({
      예상담당자: o.owner,
      건수: o.count,
      매출: o.sales,
      매입: o.purchase,
      공급가액: o.supply,
      세액: o.vat,
      합계: o.total,
      "1순위": o.rank1,
      "2순위": o.rank2,
      미지정: o.unset,
    }))
  );
  XLSX.utils.book_append_sheet(wb, ownerWs, "담당자별집계");
  XLSX.writeFile(wb, `세금계산서_미처리_예상담당자_${state.closeMonth}.xlsx`);
}

function showToast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.classList.remove("show"), 2200);
}

function bindUi() {
  document.getElementById("filterKind").addEventListener("change", (e) => {
    state.filters.kind = e.target.value;
    renderAll();
  });
  document.getElementById("filterOwner").addEventListener("change", (e) => {
    state.filters.owner = e.target.value;
    renderAll();
  });
  document.getElementById("filterRank").addEventListener("change", (e) => {
    state.filters.rank = e.target.value;
    renderAll();
  });
  document.getElementById("filterQuery").addEventListener("input", (e) => {
    state.filters.query = e.target.value;
    renderTable(filteredRows());
    document.getElementById("resultMeta").textContent = `표시 ${formatCount(filteredRows().length)} / 전체 ${formatCount(state.assigned.length)}`;
  });
  document.getElementById("ownerCards").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-owner]");
    if (!btn) return;
    const owner = btn.dataset.owner;
    state.filters.owner = state.filters.owner === owner ? "전체" : owner;
    document.getElementById("filterOwner").value = state.filters.owner;
    renderAll();
  });
  document.getElementById("btnCopy").addEventListener("click", async () => {
    const text = document.getElementById("shareText").value;
    try {
      await navigator.clipboard.writeText(text);
      showToast("현업 공유 문구를 복사했습니다.");
    } catch {
      document.getElementById("shareText").select();
      document.execCommand("copy");
      showToast("현업 공유 문구를 복사했습니다.");
    }
  });
  document.getElementById("btnExport").addEventListener("click", () => {
    exportAssignedXlsx();
    showToast("예상담당자 엑셀을 내려받았습니다.");
  });
  document.getElementById("btnReset").addEventListener("click", () => {
    state.filters = { kind: "전체", owner: "전체", rank: "전체", query: "" };
    document.getElementById("filterKind").value = "전체";
    document.getElementById("filterRank").value = "전체";
    document.getElementById("filterQuery").value = "";
    loadSample();
    showToast("샘플 데이터로 다시 불러왔습니다.");
  });
  document.getElementById("fileOpen").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      await onUnprocessedFile(file);
      showToast("미처리현황을 반영했습니다.");
    } catch (err) {
      showToast(err.message || "파일을 읽지 못했습니다.");
    }
    e.target.value = "";
  });
  document.getElementById("fileHist").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      await onHistoryFile(file);
      showToast("과거 처리 데이터를 반영했습니다.");
    } catch (err) {
      showToast(err.message || "파일을 읽지 못했습니다.");
    }
    e.target.value = "";
  });
  document.getElementById("closeMonthInput").addEventListener("change", (e) => {
    if (e.target.value) {
      state.closeMonth = e.target.value;
      renderAll();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindUi();
  loadSample();
  const monthInput = document.getElementById("closeMonthInput");
  if (monthInput) monthInput.value = state.closeMonth;
});
