/**
 * 질문 트리 기반 회계분개·부가세 안내
 */
(function (global) {
  const STORAGE_KEY = "atec-journal-tree-v1";
  const ADMIN_UNLOCK_KEY = "atec-journal-admin-unlocked";
  const APP_PASS_SHA256 = "4ec9599fc203d176a301536c2e091a19bc852759b255bd6818810a42c5fed14a";

  const VAT = {
    taxable_sales: {
      id: "taxable_sales",
      label: "과세 · 매출세액",
      short: "과세(매출)",
      tone: "sales",
      summary: "세금계산서를 발행하고, 세액은 부가세예수금으로 처리합니다."
    },
    taxable_purchase: {
      id: "taxable_purchase",
      label: "매입세액 공제 가능",
      short: "공제 가능",
      tone: "ok",
      summary: "적격증빙이 있으면 세액을 부가세대급금으로 공제합니다."
    },
    zero_rate: {
      id: "zero_rate",
      label: "영세율",
      short: "영세율",
      tone: "zero",
      summary: "세금계산서는 발행하되 세액은 0원입니다."
    },
    exempt: {
      id: "exempt",
      label: "면세",
      short: "면세",
      tone: "exempt",
      summary: "부가세가 없습니다. 공급가액만 매출 또는 비용으로 인식합니다."
    },
    no_deduct: {
      id: "no_deduct",
      label: "매입세액 공제 불가",
      short: "공제 불가",
      tone: "warn",
      summary: "세액까지 비용(또는 자산)에 포함합니다. 부가세대급금을 쓰지 마세요."
    },
    not_applicable: {
      id: "not_applicable",
      label: "해당없음",
      short: "해당없음",
      tone: "mute",
      summary: "부가세 과세대상이 아닌 거래입니다."
    },
    case_by_case: {
      id: "case_by_case",
      label: "건별 확인",
      short: "건별확인",
      tone: "check",
      summary: "증빙·용도에 따라 공제 여부가 달라집니다."
    }
  };

  const ACCOUNT_CODE_HINTS = [
    ["신용카드수취채권", "113"],
    ["예수금-지방소득세", "254"],
    ["예수금-소득세", "254"],
    ["예수금-4대보험", "254"],
    ["미지급금-사회보험", "253"],
    ["미지급금-부가세", "253"],
    ["감가상각누계액", "215"],
    ["부가세대급금", "135"],
    ["부가세예수금", "255"],
    ["외상매출금", "108"],
    ["복리후생비", "811"],
    ["여비교통비", "812"],
    ["지급수수료", "817"],
    ["차량유지비", "843"],
    ["사무용품비", "821"],
    ["소모품비", "821"],
    ["수도광열비", "814"],
    ["감가상각비", "851"],
    ["보통예금", "103"],
    ["수출매출", "403"],
    ["면세매출", "401"],
    ["제품매출", "401"],
    ["상품매출", "401"],
    ["원재료비", "501"],
    ["이자비용", "931"],
    ["통신비", "813"],
    ["임차료", "830"],
    ["접대비", "833"],
    ["선급금", "120"],
    ["선수금", "256"],
    ["가지급금", "146"],
    ["미지급금", "253"],
    ["원재료", "147"],
    ["예수금", "254"],
    ["비품", "214"],
    ["기계장치", "212"],
    ["급여", "801"]
  ];

  function defaultAccountCode(account) {
    const name = String(account || "");
    let best = "";
    let bestPos = Infinity;
    let bestLen = 0;
    for (let i = 0; i < ACCOUNT_CODE_HINTS.length; i++) {
      const key = ACCOUNT_CODE_HINTS[i][0];
      const pos = name.indexOf(key);
      if (pos < 0) continue;
      if (pos < bestPos || (pos === bestPos && key.length > bestLen)) {
        best = ACCOUNT_CODE_HINTS[i][1];
        bestPos = pos;
        bestLen = key.length;
      }
    }
    return best;
  }

  function exampleAmount(line, vatId) {
    const memo = String((line && line.memo) || "");
    const account = String((line && line.account) || "");
    const vat = String(vatId || "");
    const splitVat = vat === "taxable_purchase" || vat === "taxable_sales" || vat === "case_by_case";
    const taxInCost = vat === "no_deduct";
    const isTax = /부가세(대급금|예수금)/.test(account) || (/세액/.test(memo) && !/포함|전액|합계/.test(memo));
    const isTotal = /합계|전액|실지급|실입금|고지서 납부|출금액/.test(memo)
      || (line && line.side === "credit" && /보통예금|미지급금/.test(account) && !/부가세/.test(account))
      || (line && line.side === "debit" && /외상매출금|신용카드수취/.test(account) && /합계/.test(memo));
    if (isTax) return { amount: splitVat ? 1000 : 0, label: "세액" };
    if (isTotal || (taxInCost && /포함|전액/.test(memo))) {
      return { amount: (splitVat || taxInCost) ? 11000 : 10000, label: "합계" };
    }
    return { amount: 10000, label: "공급가액" };
  }

  function withAccountCodes(journal) {
    return (journal || []).map((line) => ({
      side: line.side,
      code: String(line.code || defaultAccountCode(line.account) || "").trim(),
      account: line.account,
      memo: line.memo
    }));
  }

  function result(id, title, vat, vatNote, journal, guide, caution, example) {
    return {
      id,
      type: "result",
      title,
      vat,
      vatNote,
      journal: withAccountCodes(journal),
      guide: guide || "",
      caution: caution || "",
      example: example || ""
    };
  }

  function question(id, prompt, options) {
    return { id, type: "question", prompt, options };
  }

  function opt(label, nextId) {
    return { label, nextId };
  }

  const SEED_NODES = [
    question("n-welfare-who", "누구를 위한 비용인가요?", [
      opt("우리 직원만 (부서 회식·야근·복지)", "n-welfare-kind"),
      opt("거래처·외부 손님 접대", "n-entertain"),
      opt("직원과 거래처가 함께한 식사", "n-entertain"),
      opt("잘 모르겠어요", "n-welfare-kind")
    ]),
    question("n-welfare-kind", "식대인가요, 아니면 기타 복리후생인가요?", [
      opt("식대 (야근식대, 구내식당, 직원 식사)", "n-welfare-meal-doc"),
      opt("기타 복리후생 (경조사, 생일, 동호회, 선물)", "n-welfare-other-doc"),
      opt("회식인데 거래처도 있었음", "n-entertain")
    ]),
    question("n-welfare-meal-doc", "세금계산서나 회사 카드(지출증빙)가 있나요?", [
      opt("있음", "n-welfare-meal-ok"),
      opt("영수증만 있거나 없음", "n-welfare-meal-no")
    ]),
    question("n-welfare-other-doc", "세금계산서나 회사 카드(지출증빙)가 있나요?", [
      opt("있음", "n-welfare-other-ok"),
      opt("영수증만 있거나 없음", "n-welfare-other-no")
    ]),
    result(
      "n-welfare-meal-ok",
      "직원 식대 · 야근식대 (적격증빙 있음)",
      "taxable_purchase",
      "직원 복리후생 목적 식대는 세금계산서·카드가 있으면 매입세액 공제가 가능한 경우가 많습니다. 공급가액은 복리후생비, 세액은 부가세대급금입니다.",
      [
        { side: "debit", account: "복리후생비", memo: "공급가액" },
        { side: "debit", account: "부가세대급금", memo: "세액" },
        { side: "credit", account: "보통예금", memo: "합계금액" }
      ],
      "야근 피자, 구내식당, 직원만의 식사는 복리후생비입니다. 거래처가 함께했다면 접대비로 다시 분류하세요.",
      "공제 가능 여부가 애매하면 부가세대급금을 넣지 말고 회계팀에 확인하세요.",
      "카드 55,000원 → 복리후생비 50,000 / 대급금 5,000"
    ),
    result(
      "n-welfare-meal-no",
      "직원 식대 (적격증빙 없음)",
      "no_deduct",
      "영수증만 있으면 매입세액을 공제할 수 없습니다. 지급액 전액을 복리후생비로 처리합니다.",
      [
        { side: "debit", account: "복리후생비", memo: "지급액 전액 (부가세 포함)" },
        { side: "credit", account: "보통예금", memo: "지급액 전액" }
      ],
      "가능하면 회사 카드나 세금계산서를 받으세요. 공제와 비용 인정은 별개입니다.",
      "부가세대급금을 임의로 떼어 분개하지 마세요.",
      "영수증 33,000원 → 복리후생비 33,000원"
    ),
    result(
      "n-welfare-other-ok",
      "기타 복리후생 (적격증빙 있음)",
      "taxable_purchase",
      "직원 대상 경조사·생일·동호회 등도 복리후생입니다. 적격증빙이 있으면 매입세액 공제를 검토합니다.",
      [
        { side: "debit", account: "복리후생비", memo: "공급가액" },
        { side: "debit", account: "부가세대급금", memo: "세액" },
        { side: "credit", account: "보통예금", memo: "합계금액" }
      ],
      "거래처 경조사는 접대비입니다. 대상이 우리 직원인지 한 번 더 확인하세요.",
      "고액 상품권·현금성 복지는 급여 이슈가 있을 수 있습니다.",
      "직원 경조사 화환 110,000원 → 복리후생비 100,000 / 대급금 10,000"
    ),
    result(
      "n-welfare-other-no",
      "기타 복리후생 (적격증빙 없음)",
      "no_deduct",
      "증빙이 약하면 공제하지 않고 전액을 복리후생비로 처리합니다.",
      [
        { side: "debit", account: "복리후생비", memo: "지급액 전액" },
        { side: "credit", account: "보통예금", memo: "지급액 전액" }
      ],
      "3만 원 이하 등 일부는 영수증으로 비용 인정될 수 있으나 부가세 공제와는 별개입니다.",
      "",
      "현금 20,000원 → 복리후생비 20,000원"
    ),
    result(
      "n-entertain",
      "접대비 · 기업업무추진비",
      "no_deduct",
      "접대비 관련 매입세액은 원칙적으로 불공제입니다. 세금계산서가 있어도 세액까지 접대비로 처리합니다.",
      [
        { side: "debit", account: "접대비", memo: "지급액 전액 (부가세 포함)" },
        { side: "credit", account: "보통예금(또는 미지급금)", memo: "지급액 전액" }
      ],
      "거래처 향응·선물·골프는 접대비입니다. 1회 3만 원(경조사 20만 원) 초과는 적격증빙이 있어야 손금으로 인정됩니다.",
      "접대를 복리후생비나 광고선전비로 바꾸지 마세요.",
      "거래처 식사 110,000원 → 접대비 110,000원, 부가세 공제 없음"
    ),

    question("n-sales-kind", "어떤 매출인가요?", [
      opt("일반 매출 (세금계산서 발행)", "n-sales-tax"),
      opt("카드 매출 (VAN 입금)", "n-sales-card"),
      opt("수출 (영세율)", "n-sales-export"),
      opt("면세 매출 (교육·도서 등)", "n-sales-exempt")
    ]),
    result(
      "n-sales-tax",
      "일반 매출 (세금계산서 발행)",
      "taxable_sales",
      "작성일 기준으로 공급가액은 매출, 세액은 부가세예수금, 합계는 외상매출금(또는 보통예금)입니다.",
      [
        { side: "debit", account: "외상매출금", memo: "합계금액 (공급가액 + 세액)" },
        { side: "credit", account: "제품매출(또는 상품매출)", memo: "공급가액" },
        { side: "credit", account: "부가세예수금", memo: "세액" }
      ],
      "세금계산서 작성일 = 매출 인식일입니다. 현금·카드로 바로 받으면 차변을 보통예금으로 바꿉니다.",
      "수정세금계산서는 역분개하거나 차액만 반영합니다.",
      "공급가 1,000,000 / 세액 100,000 / 합계 1,100,000"
    ),
    result(
      "n-sales-card",
      "카드 매출 (VAN 입금)",
      "taxable_sales",
      "카드 매출도 과세 매출입니다. 승인(합계)금액으로 매출·예수금을 잡고, VAN 수수료는 별도 비용입니다.",
      [
        { side: "debit", account: "신용카드수취채권", memo: "매출 합계금액" },
        { side: "credit", account: "제품매출", memo: "공급가액" },
        { side: "credit", account: "부가세예수금", memo: "세액" },
        { side: "debit", account: "지급수수료", memo: "VAN 수수료 공급가액 (입금 시)" },
        { side: "debit", account: "부가세대급금", memo: "VAN 수수료 세액 (세금계산서 있는 경우)" },
        { side: "debit", account: "보통예금", memo: "실입금액" },
        { side: "credit", account: "신용카드수취채권", memo: "매출 합계금액" }
      ],
      "입금액을 그대로 매출로 잡으면 매출·부가세가 과소계상됩니다.",
      "",
      "승인 1,100,000 / 수수료 22,000 / 실입금 1,078,000"
    ),
    result(
      "n-sales-export",
      "수출 매출 (영세율)",
      "zero_rate",
      "수출은 영세율입니다. 세금계산서(또는 수출실적 증빙)는 보관하되 세액은 0원, 부가세예수금은 쓰지 않습니다.",
      [
        { side: "debit", account: "외상매출금(외화)", memo: "외화금액 × 환율" },
        { side: "credit", account: "수출매출", memo: "공급가액 (세액 없음)" }
      ],
      "영세율은 세율 0%인 과세라서 관련 매입세액은 공제·환급받을 수 있습니다. 면세와 다릅니다.",
      "첨부서류가 없으면 일반과세로 추징될 수 있습니다.",
      "USD 10,000 × 1,350원 = 13,500,000 (세액 0)"
    ),
    result(
      "n-sales-exempt",
      "면세 매출",
      "exempt",
      "부가세가 없습니다. 계산서를 발행하고 공급가액만 매출로 잡습니다.",
      [
        { side: "debit", account: "외상매출금", memo: "공급가액 전액" },
        { side: "credit", account: "면세매출", memo: "공급가액" }
      ],
      "과세·면세를 함께 취급하면 공통매입세액을 안분해야 합니다.",
      "과세 품목을 면세로 발행하지 마세요.",
      "공급가 500,000 / 세액 없음"
    ),

    question("n-buy-doc", "매입·비용 증빙이 어떻게 되나요?", [
      opt("세금계산서를 받았고, 공제 가능한 비용/자산", "n-buy-ok"),
      opt("세금계산서·카드 등 적격증빙이 없음", "n-buy-no"),
      opt("접대성 지출 같다", "n-entertain")
    ]),
    result(
      "n-buy-ok",
      "일반 매입 · 비용 (공제)",
      "taxable_purchase",
      "적격 세금계산서를 받으면 세액은 부가세대급금, 공급가액만 비용 또는 자산입니다.",
      [
        { side: "debit", account: "원재료비(또는 해당 비용/자산)", memo: "공급가액" },
        { side: "debit", account: "부가세대급금", memo: "세액" },
        { side: "credit", account: "미지급금(또는 보통예금)", memo: "합계금액" }
      ],
      "작성일이 속한 과세기간에 공제합니다. 상호·사업자번호·금액이 맞는지 확인하세요.",
      "",
      "공급가 200,000 / 세액 20,000 / 합계 220,000"
    ),
    result(
      "n-buy-no",
      "세금계산서 없는 매입",
      "no_deduct",
      "적격증빙이 없으면 매입세액을 공제할 수 없습니다. 지급액 전액이 비용입니다.",
      [
        { side: "debit", account: "해당 비용", memo: "지급액 전액 (부가세 포함)" },
        { side: "credit", account: "보통예금", memo: "지급액 전액" }
      ],
      "가능하면 세금계산서·카드·현금영수증(지출증빙)을 받으세요.",
      "부가세대급금을 임의로 떼지 마세요.",
      "영수증 33,000원 → 비용 33,000원"
    ),

    question("n-travel-kind", "어떤 출장·교통 비용인가요?", [
      opt("택시·버스·지하철", "n-travel-taxi"),
      opt("KTX·항공·숙박 (세금계산서/카드)", "n-travel-ok"),
      opt("업무용 승용차 주유·통행료", "n-car")
    ]),
    result(
      "n-travel-taxi",
      "택시 · 대중교통",
      "no_deduct",
      "택시·버스·지하철은 보통 매입세액 공제가 안 됩니다. 전액 여비교통비입니다.",
      [
        { side: "debit", account: "여비교통비", memo: "지급액 전액" },
        { side: "credit", account: "보통예금(또는 미지급금)", memo: "지급액" }
      ],
      "출장 여비 규정(실비/일비)을 따르세요. 출퇴근 교통비는 성격이 다를 수 있습니다.",
      "",
      "택시 12,000원 → 여비교통비 12,000원"
    ),
    result(
      "n-travel-ok",
      "KTX · 항공 · 숙박 (적격증빙)",
      "taxable_purchase",
      "사업 출장의 KTX·항공·숙박은 세금계산서·카드가 있으면 매입세액 공제를 검토합니다.",
      [
        { side: "debit", account: "여비교통비", memo: "공급가액" },
        { side: "debit", account: "부가세대급금", memo: "세액" },
        { side: "credit", account: "보통예금", memo: "합계금액" }
      ],
      "개인 여행이 섞이면 안 됩니다. 숙박 세금계산서 명의를 확인하세요.",
      "",
      "숙박 공급가 80,000 / 세액 8,000"
    ),
    result(
      "n-rent",
      "사무실 임차료 (세금계산서)",
      "taxable_purchase",
      "사업용 부동산 임대는 과세입니다. 세액은 매입공제, 공급가액만 임차료입니다. 보증금은 부가세가 없습니다.",
      [
        { side: "debit", account: "임차료", memo: "공급가액" },
        { side: "debit", account: "부가세대급금", memo: "세액" },
        { side: "credit", account: "보통예금", memo: "합계금액" }
      ],
      "보증금은 임차보증금(자산)입니다. 선급 임차료는 선급비용 후 월별 대체합니다.",
      "",
      "월세 공급가 2,000,000 / 세액 200,000"
    ),
    result(
      "n-utility",
      "전기료 · 통신비 · 가스료",
      "taxable_purchase",
      "사업자 앞으로 된 세금계산서·카드가 있으면 매입세액 공제합니다.",
      [
        { side: "debit", account: "통신비(또는 수도광열비)", memo: "공급가액" },
        { side: "debit", account: "부가세대급금", memo: "세액" },
        { side: "credit", account: "보통예금", memo: "합계금액" }
      ],
      "개인 명의 휴대폰은 업무 사용 증빙이 없으면 공제·비용 모두 문제 될 수 있습니다.",
      "",
      "통신비 공급가 50,000 / 세액 5,000"
    ),
    question("n-supply-kind", "소액 소모품인가요, 오래 쓰는 비품인가요?", [
      opt("사무용품·소모품 (토너, 문구 등)", "n-supply"),
      opt("노트북·모니터 등 고정자산", "n-asset")
    ]),
    result(
      "n-supply",
      "사무용품 · 소모품",
      "taxable_purchase",
      "사업용 소모품은 세금계산서·카드가 있으면 매입공제합니다.",
      [
        { side: "debit", account: "소모품비(또는 사무용품비)", memo: "공급가액" },
        { side: "debit", account: "부가세대급금", memo: "세액" },
        { side: "credit", account: "보통예금", memo: "합계금액" }
      ],
      "회사 자산 기준금액(내부 규정)을 넘는 고가 비품은 자산으로 처리합니다.",
      "",
      "토너 공급가 80,000 / 세액 8,000"
    ),
    result(
      "n-car",
      "업무용 승용차 주유 · 수리 · 보험",
      "no_deduct",
      "개별소비세 대상 승용차의 구입·임차·유지 매입세액은 원칙적으로 불공제입니다. 보험료는 부가세 해당없음입니다.",
      [
        { side: "debit", account: "차량유지비", memo: "지급액 전액 (부가세 포함)" },
        { side: "credit", account: "보통예금", memo: "지급액 전액" }
      ],
      "화물차·경차 등 예외 차량만 회계팀 확인 후 공제합니다. 운행일지를 작성하세요.",
      "승용차 세금계산서를 받았다고 부가세대급금을 넣지 마세요.",
      "주유 55,000원 → 차량유지비 55,000원"
    ),
    result(
      "n-asset",
      "비품 · 설비 등 고정자산 구입",
      "taxable_purchase",
      "과세 사업에 쓰는 자산은 세금계산서가 있으면 매입세액 공제합니다. 공급가액은 자산원가, 세액은 부가세대급금입니다. (승용차 등 불공제 자산 제외)",
      [
        { side: "debit", account: "비품(또는 기계장치)", memo: "공급가액 + 취득부대비용" },
        { side: "debit", account: "부가세대급금", memo: "세액" },
        { side: "credit", account: "보통예금", memo: "합계금액" }
      ],
      "설치비·운임도 자산원가에 넣습니다. 공제 대상이면 부가세는 자산원가에 넣지 않습니다.",
      "",
      "노트북 공급가 1,200,000 / 세액 120,000"
    ),
    result(
      "n-dep",
      "감가상각비 계상",
      "not_applicable",
      "감가상각은 내부 회계 처리이며 부가세와 무관합니다.",
      [
        { side: "debit", account: "감가상각비", memo: "당월 상각액" },
        { side: "credit", account: "감가상각누계액", memo: "당월 상각액" }
      ],
      "자산 종류별 내용연수·상각방법을 따릅니다.",
      "",
      "취득원가 1,200,000 / 5년 → 월 20,000"
    ),
    result(
      "n-pay",
      "급여 지급 (원천세·사회보험 공제)",
      "not_applicable",
      "급여·상여·원천세·4대보험은 부가세 과세대상이 아닙니다.",
      [
        { side: "debit", account: "급여", memo: "지급총액(세전)" },
        { side: "credit", account: "예수금-소득세", memo: "원천징수 소득세" },
        { side: "credit", account: "예수금-지방소득세", memo: "원천징수 지방소득세" },
        { side: "credit", account: "예수금-4대보험(근로자)", memo: "근로자 부담분" },
        { side: "credit", account: "보통예금", memo: "실지급액" }
      ],
      "실수령액만 급여로 잡으면 인건비·예수금이 모두 틀립니다. 세전 총액 기준입니다.",
      "",
      "세전 3,000,000 / 공제 400,000 / 실지급 2,600,000"
    ),
    result(
      "n-ins",
      "4대보험 회사부담분 및 납부",
      "not_applicable",
      "사회보험료는 부가세 해당없음입니다.",
      [
        { side: "debit", account: "복리후생비(또는 보험료)", memo: "회사 부담분" },
        { side: "credit", account: "미지급금-사회보험", memo: "회사 부담분" },
        { side: "debit", account: "미지급금-사회보험", memo: "납부 시 회사분" },
        { side: "debit", account: "예수금-4대보험", memo: "납부 시 근로자분" },
        { side: "credit", account: "보통예금", memo: "고지서 납부액" }
      ],
      "산재는 전액 회사 부담입니다. 고지서 합계를 한 계정으로만 넣지 마세요.",
      "",
      "회사분 350,000 + 근로자분 300,000 = 650,000"
    ),
    result(
      "n-int",
      "대출이자 지급",
      "not_applicable",
      "금융 이자는 부가세 면세(해당없음)입니다.",
      [
        { side: "debit", account: "이자비용", memo: "이자 금액" },
        { side: "credit", account: "보통예금", memo: "이자 금액" }
      ],
      "원금 상환과 이자를 구분하세요. 원금은 차입금 감소입니다.",
      "",
      "상환 1,000,000 = 원금 800,000 + 이자 200,000"
    ),
    result(
      "n-bank",
      "은행 이체수수료",
      "not_applicable",
      "은행 수수료는 금융용역으로 부가세가 없습니다. VAN·PG 수수료는 과세라서 다릅니다.",
      [
        { side: "debit", account: "지급수수료", memo: "수수료 전액" },
        { side: "credit", account: "보통예금", memo: "수수료 전액" }
      ],
      "",
      "",
      "이체수수료 500원 → 지급수수료 500원"
    ),
    result(
      "n-prepay",
      "선급금 지급 후 입고·정산",
      "case_by_case",
      "선금만 보낼 때는 보통 부가세가 없습니다. 세금계산서를 받는 시점에 매입세액을 인식합니다.",
      [
        { side: "debit", account: "선급금", memo: "선지급액" },
        { side: "credit", account: "보통예금", memo: "선지급액" },
        { side: "debit", account: "원재료(또는 비용/자산)", memo: "공급가액 (정산 시)" },
        { side: "debit", account: "부가세대급금", memo: "세액 (세금계산서 수취 시)" },
        { side: "credit", account: "선급금", memo: "기존 선급금 대체" },
        { side: "credit", account: "보통예금", memo: "잔금" }
      ],
      "선급금은 자산입니다. 증빙 수취 시점에 부가세를 넣으세요.",
      "선금 송금 때 부가세를 추정해 넣지 마세요.",
      ""
    ),
    result(
      "n-advance",
      "선수금 수령 후 매출 인식",
      "case_by_case",
      "계약금만 받은 시점이 곧 매출일이 아닙니다. 세금계산서 작성일(공급 시기)에 매출과 부가세예수금을 인식합니다.",
      [
        { side: "debit", account: "보통예금", memo: "선수금 입금" },
        { side: "credit", account: "선수금", memo: "선수금 입금" },
        { side: "debit", account: "선수금", memo: "매출 대체" },
        { side: "debit", account: "외상매출금", memo: "잔금" },
        { side: "credit", account: "제품매출", memo: "공급가액" },
        { side: "credit", account: "부가세예수금", memo: "세액" }
      ],
      "선금 받을 때 이미 세금계산서를 발행했다면 그때 매출·예수금을 인식합니다.",
      "",
      "계약금 550,000 → 인도 시 공급가 1,000,000 / 세액 100,000"
    ),
    result(
      "n-vatpay",
      "부가세 신고 후 납부(또는 환급)",
      "not_applicable",
      "부가세 납부는 새로운 과세거래가 아닙니다. 예수금과 대급금을 상계하고 차액을 납부하거나 환급받습니다.",
      [
        { side: "debit", account: "부가세예수금", memo: "매출세액 합계" },
        { side: "credit", account: "부가세대급금", memo: "매입세액 합계" },
        { side: "credit", account: "미지급금-부가세(또는 보통예금)", memo: "납부할 세액" }
      ],
      "납부액을 세금과공과로 비용 처리하지 마세요. 부가세는 채권·채무 정산입니다.",
      "",
      "예수금 5,000,000 − 대급금 3,200,000 = 납부 1,800,000"
    ),
    result(
      "n-wh",
      "원천세 납부",
      "not_applicable",
      "원천세 납부는 부가세와 무관합니다. 급여 때 잡아 둔 예수금을 소멸시킵니다.",
      [
        { side: "debit", account: "예수금-소득세", memo: "납부 소득세" },
        { side: "debit", account: "예수금-지방소득세", memo: "납부 지방소득세" },
        { side: "credit", account: "보통예금", memo: "원천세 합계" }
      ],
      "",
      "",
      "소득세 180,000 + 지방소득세 18,000 = 198,000"
    ),
    result(
      "n-suspense",
      "가지급금 · 가수금",
      "not_applicable",
      "내용을 모르면 부가세를 추정하지 않습니다. 증빙이 나오면 본계정·부가세로 대체합니다.",
      [
        { side: "debit", account: "가지급금", memo: "용도 미확인 출금" },
        { side: "credit", account: "보통예금", memo: "출금액" }
      ],
      "임직원 개인 사용이 확인되면 상여·회수 이슈가 있습니다. 빨리 정산하세요.",
      "가지급금에 부가세대급금을 미리 넣지 마세요.",
      "미확인 출금 220,000 → 가지급금 220,000"
    )
  ];

  const SEED_TOPICS = [
    { id: "t-welfare", title: "복리후생비", keywords: ["복리후생", "식대", "야근", "회식", "복지", "직원식사", "경조사", "구내식당"], startNodeId: "n-welfare-who" },
    { id: "t-entertain", title: "접대비", keywords: ["접대", "기업업무추진비", "거래처식사", "골프", "선물"], startNodeId: "n-entertain" },
    { id: "t-sales", title: "매출", keywords: ["매출", "세금계산서", "발행", "카드매출", "수출", "영세율", "면세매출"], startNodeId: "n-sales-kind" },
    { id: "t-buy", title: "매입 · 비용", keywords: ["매입", "비용", "세금계산서", "영수증", "공제"], startNodeId: "n-buy-doc" },
    { id: "t-travel", title: "출장 · 교통비", keywords: ["출장", "교통", "택시", "KTX", "항공", "숙박", "여비"], startNodeId: "n-travel-kind" },
    { id: "t-rent", title: "임차료", keywords: ["임차", "월세", "임대료", "사무실", "보증금"], startNodeId: "n-rent" },
    { id: "t-utility", title: "전기 · 통신 · 공과금", keywords: ["전기", "통신", "인터넷", "가스", "공과금", "한전"], startNodeId: "n-utility" },
    { id: "t-supply", title: "사무용품 · 비품", keywords: ["사무용품", "소모품", "문구", "토너", "비품", "노트북"], startNodeId: "n-supply-kind" },
    { id: "t-car", title: "차량유지비", keywords: ["차량", "주유", "수리", "보험", "승용차", "주차"], startNodeId: "n-car" },
    { id: "t-asset", title: "고정자산", keywords: ["자산", "설비", "기계", "취득"], startNodeId: "n-asset" },
    { id: "t-dep", title: "감가상각", keywords: ["감가", "상각", "감가상각누계액"], startNodeId: "n-dep" },
    { id: "t-pay", title: "급여", keywords: ["급여", "임금", "원천세", "상여"], startNodeId: "n-pay" },
    { id: "t-ins", title: "4대보험", keywords: ["4대보험", "국민연금", "건강", "고용", "산재"], startNodeId: "n-ins" },
    { id: "t-int", title: "대출이자", keywords: ["이자", "대출", "금융비용"], startNodeId: "n-int" },
    { id: "t-bank", title: "은행 수수료", keywords: ["이체", "은행", "수수료"], startNodeId: "n-bank" },
    { id: "t-prepay", title: "선급금", keywords: ["선급금", "선금", "계약금"], startNodeId: "n-prepay" },
    { id: "t-advance", title: "선수금", keywords: ["선수금", "선수", "선수금입금"], startNodeId: "n-advance" },
    { id: "t-vatpay", title: "부가세 납부", keywords: ["부가세신고", "부가세납부", "환급", "예수금", "대급금"], startNodeId: "n-vatpay" },
    { id: "t-wh", title: "원천세 납부", keywords: ["원천세", "소득세", "지방소득세"], startNodeId: "n-wh" },
    { id: "t-suspense", title: "가지급금 · 가수금", keywords: ["가지급", "가수금", "전도금"], startNodeId: "n-suspense" }
  ];

  const SEED_POPULAR = SEED_TOPICS.slice(0, 8).map((t) => ({
    label: t.title,
    topicId: t.id
  }));

  function clone(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeNode(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.type === "question") {
      return {
        id: String(raw.id || api.newId("n")),
        type: "question",
        topicId: String(raw.topicId || "").trim(),
        prompt: String(raw.prompt || "").trim() || "다음 중 어떤 경우인가요?",
        options: (Array.isArray(raw.options) ? raw.options : [])
          .map((o) => ({
            label: String((o && o.label) || "").trim(),
            nextId: String((o && o.nextId) || "").trim()
          }))
          .filter((o) => o.label)
      };
    }
    const vat = VAT[raw.vat] ? raw.vat : "case_by_case";
    const journal = Array.isArray(raw.journal)
      ? raw.journal
          .map((line) => ({
            side: line && line.side === "credit" ? "credit" : "debit",
            code: String((line && line.code) || "").trim(),
            account: String((line && line.account) || "").trim(),
            memo: String((line && line.memo) || "").trim()
          }))
          .filter((line) => line.account || line.code)
      : [];
    return {
      id: String(raw.id || api.newId("n")),
      type: "result",
      topicId: String(raw.topicId || "").trim(),
      title: String(raw.title || "안내").trim() || "안내",
      vat,
      vatNote: String(raw.vatNote || "").trim(),
      journal,
      guide: String(raw.guide || "").trim(),
      caution: String(raw.caution || "").trim(),
      example: String(raw.example || "").trim()
    };
  }

  function normalizeTopic(raw) {
    if (!raw || typeof raw !== "object") return null;
    const keywords = Array.isArray(raw.keywords)
      ? raw.keywords.map((k) => String(k).trim()).filter(Boolean)
      : String(raw.keywords || "").split(/[,/，、]+/).map((k) => k.trim()).filter(Boolean);
    return {
      id: String(raw.id || api.newId("t")),
      title: String(raw.title || "새 주제").trim() || "새 주제",
      keywords,
      startNodeId: String(raw.startNodeId || "").trim(),
      questionOrder: Array.isArray(raw.questionOrder) ? raw.questionOrder.map((id) => String(id || "").trim()).filter(Boolean) : [],
      resultOrder: Array.isArray(raw.resultOrder) ? raw.resultOrder.map((id) => String(id || "").trim()).filter(Boolean) : []
    };
  }

  function defaultPopular(topics) {
    return (topics || []).slice(0, 8).map((t) => ({
      label: t.title,
      topicId: t.id
    }));
  }

  function normalizePopularItem(raw) {
    if (typeof raw === "string") {
      const label = raw.trim();
      return label ? { label, topicId: "" } : null;
    }
    if (!raw || typeof raw !== "object") return null;
    const label = String(raw.label || "").trim();
    if (!label) return null;
    return {
      label,
      topicId: String(raw.topicId || "").trim()
    };
  }

  function normalizePopular(raw, topics) {
    if (!Array.isArray(raw)) return defaultPopular(topics);
    return raw.map(normalizePopularItem).filter(Boolean);
  }

  function seedData() {
    const nodes = {};
    SEED_NODES.forEach((n) => {
      const node = normalizeNode(n);
      nodes[node.id] = node;
    });
    const topics = SEED_TOPICS.map((t) => normalizeTopic(t));
    return {
      topics,
      nodes,
      popular: normalizePopular(SEED_POPULAR, topics)
    };
  }

  const DATA_PATH = "data/guide.json";
  const DATA_REPO = { owner: "joseo-cmd", repo: "joseo_save" };
  const DATA_BRANCHES = ["cursor/popular-keywords-admin-4d7f", "main"];

  let memory = null;
  let hydratePromise = null;

  function loadRecord() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.topics) || !parsed.nodes) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function notify() {
    try { global.dispatchEvent(new CustomEvent("journal-tree-changed")); } catch {}
  }

  function materialize(rec, extra) {
    const nodes = {};
    Object.keys((rec && rec.nodes) || {}).forEach((id) => {
      const node = normalizeNode(rec.nodes[id]);
      if (node) nodes[node.id] = node;
    });
    const topics = ((rec && rec.topics) || []).map(normalizeTopic).filter(Boolean);
    return Object.assign({
      topics,
      nodes,
      popular: normalizePopular(rec && rec.popular, topics),
      isCustom: !!(rec && rec.topics),
      updatedAt: (rec && rec.updatedAt) || null
    },     extra || {});
  }

  function inferRefs() {
    const refs = [];
    try {
      const href = String(global.location && location.href || "");
      const fromPreview = href.match(/joseo_save\/(?:blob|raw|tree)\/([^/]+)\//);
      if (fromPreview) refs.push(decodeURIComponent(fromPreview[1]));
      if (location.hostname && location.hostname.endsWith("github.io")) refs.push("main");
    } catch {}
    DATA_BRANCHES.forEach((b) => refs.push(b));
    const seen = new Set();
    return refs.filter((r) => {
      if (!r || seen.has(r)) return false;
      seen.add(r);
      return true;
    });
  }

  function sharedUrls() {
    const stamp = Date.now();
    const urls = [DATA_PATH + "?t=" + stamp];
    inferRefs().forEach((ref) => {
      urls.push("https://raw.githubusercontent.com/" + DATA_REPO.owner + "/" + DATA_REPO.repo + "/" + ref + "/" + DATA_PATH + "?t=" + stamp);
    });
    return urls;
  }

  async function fetchJson(url) {
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
    try {
      const res = await fetch(url, { cache: "no-store", signal: ctrl ? ctrl.signal : undefined });
      if (!res.ok) return null;
      const parsed = await res.json();
      if (!parsed || !Array.isArray(parsed.topics) || !parsed.nodes) return null;
      return parsed;
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function fetchShared() {
    const urls = sharedUrls();
    for (let i = 0; i < urls.length; i++) {
      const parsed = await fetchJson(urls[i]);
      if (parsed) return parsed;
    }
    return null;
  }

  const api = {
    STORAGE_KEY,
    ADMIN_UNLOCK_KEY,
    APP_PASS_SHA256,
    VAT,
    DATA_REPO,
    DATA_PATH,

    newId(prefix) {
      return (prefix || "id") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
    },

    vatInfo(id) {
      return VAT[id] || VAT.case_by_case;
    },

    vatList() {
      return Object.keys(VAT).map((id) => VAT[id]);
    },

    exampleAmount,

    seedData,

    hydrate() {
      if (hydratePromise) return hydratePromise;
      hydratePromise = (async () => {
        const shared = await fetchShared();
        const local = loadRecord();
        const sharedAt = shared && shared.updatedAt ? String(shared.updatedAt) : "";
        const localAt = local && local.updatedAt ? String(local.updatedAt) : "";
        if (local && (!shared || localAt >= sharedAt)) memory = local;
        else if (shared) memory = shared;
      })();
      return hydratePromise;
    },

    loadData() {
      const rec = memory || loadRecord();
      if (rec) return materialize(rec, { isCustom: true });
      return Object.assign({ isCustom: false, updatedAt: null }, seedData());
    },

    saveData(data) {
      const built = materialize(data, { isCustom: true });
      const record = {
        version: 1,
        updatedAt: nowIso(),
        topics: built.topics,
        nodes: built.nodes,
        popular: built.popular
      };
      memory = record;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch {}
      notify();
      return record;
    },

    resetToSeed() {
      memory = null;
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      notify();
      return api.loadData();
    },

    getPopular() {
      const data = api.loadData();
      return Array.isArray(data.popular) ? data.popular : [];
    },

    searchTopics(query) {
      const data = api.loadData();
      const q = String(query || "").trim().toLowerCase().replace(/\s+/g, "");
      if (!q) return data.topics;
      return data.topics.filter((t) => {
        const hay = [t.title, ...(t.keywords || [])].join(" ").toLowerCase().replace(/\s+/g, "");
        return hay.includes(q) || q.includes(hay);
      });
    },

    getNode(id) {
      const data = api.loadData();
      return data.nodes[id] || null;
    },

    emptyQuestion() {
      return { id: api.newId("n"), type: "question", prompt: "", options: [{ label: "", nextId: "" }, { label: "", nextId: "" }] };
    },

    emptyResult() {
      return {
        id: api.newId("n"),
        type: "result",
        title: "",
        vat: "case_by_case",
        vatNote: "",
        journal: [
          { side: "debit", code: "", account: "", memo: "" },
          { side: "credit", code: "", account: "", memo: "" }
        ],
        guide: "",
        caution: "",
        example: ""
      };
    },

    emptyTopic() {
      const start = api.emptyQuestion();
      start.prompt = "어떤 경우인가요?";
      return {
        topic: { id: api.newId("t"), title: "", keywords: [], startNodeId: start.id, questionOrder: [start.id], resultOrder: [] },
        start
      };
    },

    sha256hexSync(text) {
      function rrot(n, x) { return (x >>> n) | (x << (32 - n)); }
      const msg = unescape(encodeURIComponent(String(text || "")));
      const len = msg.length;
      const bitLen = len * 8;
      const bytes = [];
      for (let i = 0; i < len; i++) bytes.push(msg.charCodeAt(i) & 0xff);
      bytes.push(0x80);
      while ((bytes.length % 64) !== 56) bytes.push(0);
      const hi = Math.floor(bitLen / 0x100000000);
      const lo = bitLen >>> 0;
      bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
      bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);
      const k = [
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
      ];
      let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
      let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
      const w = new Array(64);
      for (let i = 0; i < bytes.length; i += 64) {
        for (let t = 0; t < 16; t++) {
          const j = i + t * 4;
          w[t] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
        }
        for (let t = 16; t < 64; t++) {
          const s0 = rrot(7, w[t - 15]) ^ rrot(18, w[t - 15]) ^ (w[t - 15] >>> 3);
          const s1 = rrot(17, w[t - 2]) ^ rrot(19, w[t - 2]) ^ (w[t - 2] >>> 10);
          w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
        for (let t = 0; t < 64; t++) {
          const S1 = rrot(6, e) ^ rrot(11, e) ^ rrot(25, e);
          const ch = (e & f) ^ (~e & g);
          const temp1 = (h + S1 + ch + k[t] + w[t]) >>> 0;
          const S0 = rrot(2, a) ^ rrot(13, a) ^ rrot(22, a);
          const maj = (a & b) ^ (a & c) ^ (b & c);
          const temp2 = (S0 + maj) >>> 0;
          h = g; g = f; f = e; e = (d + temp1) >>> 0;
          d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
        }
        h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
      }
      return [h0, h1, h2, h3, h4, h5, h6, h7].map((n) => ("00000000" + n.toString(16)).slice(-8)).join("");
    },

    async sha256hex(text) {
      if (global.crypto && crypto.subtle) {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text || "")));
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
      return api.sha256hexSync(text);
    },

    async checkPassword(password) {
      const hex = await api.sha256hex(String(password || ""));
      return hex === APP_PASS_SHA256;
    }
  };

  global.JournalStore = api;
})(window);
