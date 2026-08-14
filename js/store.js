/**
 * 회계분개·부가세 안내 공통 저장소
 * - 기본 예시는 SEED
 * - 관리자가 저장하면 localStorage에 덮어씀 (같은 브라우저)
 */
(function (global) {
  const STORAGE_KEY = "atec-journal-guides-v1";
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
      label: "과세 · 매입공제",
      short: "매입공제",
      tone: "ok",
      summary: "세금계산서·신용카드 등 적격증빙이 있으면 세액을 부가세대급금으로 공제합니다."
    },
    zero_rate: {
      id: "zero_rate",
      label: "영세율",
      short: "영세율",
      tone: "zero",
      summary: "세금계산서는 발행하되 세액은 0원입니다. 수출 등 영세율 요건을 확인하세요."
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
      label: "매입세액 불공제",
      short: "불공제",
      tone: "warn",
      summary: "세금계산서가 있어도 매입세액을 공제하지 않습니다. 세액까지 비용(또는 자산)에 포함합니다."
    },
    not_applicable: {
      id: "not_applicable",
      label: "해당없음",
      short: "해당없음",
      tone: "mute",
      summary: "부가세 과세대상이 아닌 거래입니다. 부가세 계정은 사용하지 않습니다."
    },
    case_by_case: {
      id: "case_by_case",
      label: "건별 확인",
      short: "건별확인",
      tone: "check",
      summary: "거래 내용·증빙에 따라 공제 여부가 달라집니다. 안내사항을 꼭 확인하세요."
    }
  };

  const CATEGORIES = ["매출", "매입", "경비", "인건비", "자산", "금융", "세금", "기타"];

  const SEED = [
    {
      id: "g-sales-taxinvoice",
      title: "일반 매출 (세금계산서 발행)",
      category: "매출",
      keywords: ["매출", "세금계산서", "외상매출금", "발행"],
      vat: "taxable_sales",
      vatNote: "과세 매출입니다. 작성일 기준으로 공급가액은 매출, 세액은 부가세예수금, 합계는 외상매출금(또는 보통예금)으로 처리합니다.",
      journal: [
        { side: "debit", account: "외상매출금", memo: "합계금액 (공급가액 + 세액)" },
        { side: "credit", account: "제품매출(또는 상품매출)", memo: "공급가액" },
        { side: "credit", account: "부가세예수금", memo: "세액" }
      ],
      guide: "세금계산서 작성일 = 매출 인식일입니다. 청구 전이라도 작성일이 속한 과세기간에 신고해야 합니다. 현금·카드로 바로 받으면 차변을 보통예금 또는 신용카드수취채권으로 바꿉니다.",
      caution: "수정세금계산서는 당초 분개를 역분개하거나 차액만 반영합니다. 발행 누락은 가산세 대상입니다.",
      example: "공급가 1,000,000 / 세액 100,000 / 합계 1,100,000"
    },
    {
      id: "g-sales-card",
      title: "카드 매출 (VAN 입금)",
      category: "매출",
      keywords: ["카드", "VAN", "수수료", "매출"],
      vat: "taxable_sales",
      vatNote: "카드 매출도 과세 매출입니다. 고객에게 받은 금액(공급가+세액) 기준으로 매출·예수금을 인식합니다. VAN 수수료는 별도 비용입니다.",
      journal: [
        { side: "debit", account: "신용카드수취채권(또는 미수금)", memo: "매출 합계금액" },
        { side: "credit", account: "제품매출", memo: "공급가액" },
        { side: "credit", account: "부가세예수금", memo: "세액" },
        { side: "debit", account: "지급수수료", memo: "VAN 수수료 공급가액 (입금 시)" },
        { side: "debit", account: "부가세대급금", memo: "VAN 수수료 세액 (세금계산서 있는 경우)" },
        { side: "debit", account: "보통예금", memo: "실입금액" },
        { side: "credit", account: "신용카드수취채권", memo: "매출 합계금액" }
      ],
      guide: "매출 발생 시점에 카드 승인금액을 매출로 잡고, 입금일에 수수료를 차감 입금 처리합니다. VAN사 세금계산서가 있으면 수수료 부가세는 매입공제합니다.",
      caution: "입금액을 그대로 매출로 잡으면 매출·부가세가 과소계상됩니다. 반드시 승인(합계)금액 기준으로 매출 인식하세요.",
      example: "승인 1,100,000 / 수수료 22,000(부가세 포함) / 실입금 1,078,000"
    },
    {
      id: "g-export-zero",
      title: "수출 매출 (영세율)",
      category: "매출",
      keywords: ["수출", "영세율", "외화", "선적"],
      vat: "zero_rate",
      vatNote: "수출은 영세율입니다. 세금계산서(또는 수출실적 증빙)는 발행·보관하되 세액은 0원입니다. 부가세예수금 계정은 쓰지 않습니다.",
      journal: [
        { side: "debit", account: "외상매출금(외화)", memo: "외화금액 × 환율" },
        { side: "credit", account: "수출매출", memo: "공급가액 (세액 없음)" }
      ],
      guide: "영세율은 ‘세율이 0%인 과세’입니다. 면세와 달리 관련 매입세액은 공제·환급받을 수 있습니다. 환율은 거래일(선적일 등) 기준으로 적용하고, 입금 시 외환차손익을 인식합니다.",
      caution: "영세율 첨부서류(수출신고필증 등)가 없으면 일반과세로 추징될 수 있습니다. 로컬수출·중계무역은 요건이 다르니 회계팀에 확인하세요.",
      example: "USD 10,000 × 1,350원 = 13,500,000 (세액 0)"
    },
    {
      id: "g-sales-exempt",
      title: "면세 매출 (교육·도서 등)",
      category: "매출",
      keywords: ["면세", "계산서", "매출"],
      vat: "exempt",
      vatNote: "면세 매출은 부가세가 없습니다. 세금계산서가 아니라 계산서(또는 면세 전자세금계산서 아님, 계산서)를 발행하고 공급가액만 매출로 잡습니다.",
      journal: [
        { side: "debit", account: "외상매출금", memo: "공급가액 전액" },
        { side: "credit", account: "면세매출", memo: "공급가액" }
      ],
      guide: "과세·면세를 함께 취급하면 공통매입세액을 안분해야 합니다. 품목이 면세인지 계약서·품목코드를 먼저 확인하세요.",
      caution: "과세 품목을 면세로 발행하면 추징 대상입니다. 애매하면 발행 전에 회계팀에 문의하세요.",
      example: "공급가 500,000 / 세액 없음 / 합계 500,000"
    },
    {
      id: "g-purchase-taxinvoice",
      title: "일반 매입 · 비용 (세금계산서 수취, 공제)",
      category: "매입",
      keywords: ["매입", "세금계산서", "공제", "미지급금"],
      vat: "taxable_purchase",
      vatNote: "적격 세금계산서를 받으면 세액은 부가세대급금(매입세액)으로 공제하고, 공급가액만 비용 또는 자산으로 처리합니다.",
      journal: [
        { side: "debit", account: "원재료비(또는 해당 비용/자산)", memo: "공급가액" },
        { side: "debit", account: "부가세대급금", memo: "세액" },
        { side: "credit", account: "미지급금(또는 보통예금)", memo: "합계금액" }
      ],
      guide: "세금계산서 작성일이 속한 과세기간에 공제합니다. 재고로 입고되면 원재료·상품, 바로 쓰는 물건이면 해당 비용 계정(소모품비, 수선비 등)을 씁니다.",
      caution: "상호·사업자번호·작성일·공급가액이 틀린 세금계산서는 공제받지 못할 수 있습니다. 수령 즉시 기재 내용을 확인하세요.",
      example: "공급가 200,000 / 세액 20,000 / 합계 220,000"
    },
    {
      id: "g-purchase-no-invoice",
      title: "세금계산서 없는 매입 (간이영수증 등)",
      category: "매입",
      keywords: ["영수증", "간이", "불공제", "증빙"],
      vat: "no_deduct",
      vatNote: "세금계산서·신용카드 등 적격증빙이 없으면 매입세액을 공제할 수 없습니다. 지급액 전액을 비용으로 처리합니다.",
      journal: [
        { side: "debit", account: "해당 비용", memo: "지급액 전액 (부가세 포함)" },
        { side: "credit", account: "보통예금(또는 현금)", memo: "지급액 전액" }
      ],
      guide: "3만 원 이하 등 일부 예외는 영수증만으로 비용 인정되는 경우가 있으나, 부가세 공제와는 별개입니다. 가능하면 세금계산서·카드·현금영수증(지출증빙)을 받으세요.",
      caution: "부가세대급금을 임의로 떼어 분개하지 마세요. 공제 안 되는 세액을 대급금으로 잡으면 신고 때 문제가 됩니다.",
      example: "영수증 33,000원 → 비용 33,000원"
    },
    {
      id: "g-entertainment",
      title: "접대비 · 기업업무추진비",
      category: "경비",
      keywords: ["접대", "기업업무추진비", "식사", "선물"],
      vat: "no_deduct",
      vatNote: "접대비(기업업무추진비) 관련 매입세액은 원칙적으로 불공제입니다. 세금계산서가 있어도 세액까지 접대비로 처리합니다.",
      journal: [
        { side: "debit", account: "접대비", memo: "지급액 전액 (부가세 포함)" },
        { side: "credit", account: "보통예금(또는 미지급금)", memo: "지급액 전액" }
      ],
      guide: "거래처 향응·선물·골프 등은 접대비입니다. 직원 회식·야근식대는 복리후생비로 볼 수 있어 계정이 다릅니다. 1회 3만 원(경조사 20만 원) 초과 접대는 적격증빙이 있어야 손금으로 인정됩니다.",
      caution: "접대를 복리후생비나 광고선전비로 바꾸지 마세요. 한도 초과분은 세무조정 대상입니다. 애매하면 회계팀에 계정 확인을 요청하세요.",
      example: "거래처 식사 110,000원(세금계산서) → 접대비 110,000원, 부가세 공제 없음"
    },
    {
      id: "g-welfare-meal",
      title: "직원 식대 · 야근식대 (복리후생)",
      category: "경비",
      keywords: ["식대", "야근", "회식", "복리후생"],
      vat: "case_by_case",
      vatNote: "직원 복리후생 목적의 식대는 세금계산서·카드가 있으면 매입세액 공제가 가능한 경우가 많습니다. 거래처 접대성 식사는 접대비라 불공제입니다.",
      journal: [
        { side: "debit", account: "복리후생비", memo: "공급가액 (공제 가능한 경우)" },
        { side: "debit", account: "부가세대급금", memo: "세액 (적격증빙 + 공제 가능한 경우)" },
        { side: "credit", account: "보통예금", memo: "합계금액" }
      ],
      guide: "야근 피자, 구내식당, 직원 생일 케이크처럼 ‘우리 직원’을 위한 지출은 복리후생비입니다. 거래처가 함께한 식사는 접대비로 재분류하세요.",
      caution: "공제 가능 여부가 애매하면 부가세대급금을 넣지 말고 전액을 복리후생비로 처리한 뒤 회계팀에 확인하세요.",
      example: "야근식대 카드 55,000원 → (공제 시) 복리후생비 50,000 / 대급금 5,000"
    },
    {
      id: "g-travel",
      title: "출장비 · 교통비 · 택시",
      category: "경비",
      keywords: ["출장", "택시", "교통", "KTX", "주유"],
      vat: "case_by_case",
      vatNote: "KTX·항공·세금계산서 있는 숙박은 공제 가능한 경우가 많고, 택시비·버스·지하철은 보통 불공제 또는 해당없음입니다. 증빙 종류를 보고 판단합니다.",
      journal: [
        { side: "debit", account: "여비교통비", memo: "공급가액 또는 지급 전액" },
        { side: "debit", account: "부가세대급금", memo: "공제 가능한 세액만" },
        { side: "credit", account: "보통예금(또는 미지급금)", memo: "지급액" }
      ],
      guide: "출장 여비 규정에 따라 실비 또는 일비를 처리합니다. 숙박 세금계산서·카드 매출전표는 공제 검토, 택시 영수증은 보통 전액 여비교통비입니다.",
      caution: "개인 출퇴근 교통비는 복리후생/급여 성격일 수 있습니다. 고속도로 통행료·주유는 업무용 차량 여부와 승용차 불공제 규정을 함께 보세요.",
      example: "택시 12,000원 → 여비교통비 12,000원 (부가세 공제 없음)"
    },
    {
      id: "g-rent",
      title: "사무실 임차료 (세금계산서)",
      category: "경비",
      keywords: ["임차", "월세", "임대료", "사무실"],
      vat: "taxable_purchase",
      vatNote: "사업용 부동산 임대는 과세입니다. 세금계산서를 받으면 세액을 매입공제하고 공급가액만 임차료로 처리합니다. (주택 임대 등 면세 임대는 제외)",
      journal: [
        { side: "debit", account: "임차료", memo: "공급가액" },
        { side: "debit", account: "부가세대급금", memo: "세액" },
        { side: "credit", account: "보통예금", memo: "합계금액" }
      ],
      guide: "보증금은 임차보증금(자산)이며 부가세가 없습니다. 월 임차료와 관리비를 구분해 세금계산서 내역대로 분개하세요. 관리비가 별도 세금계산서면 각각 처리합니다.",
      caution: "보증금을 임차료로 잡지 마세요. 선급 임차료는 선급비용으로 두고 해당 월에 비용 대체합니다.",
      example: "월세 공급가 2,000,000 / 세액 200,000 / 합계 2,200,000"
    },
    {
      id: "g-utility",
      title: "전기료 · 통신비 · 가스료",
      category: "경비",
      keywords: ["전기", "통신", "인터넷", "가스", "공과금"],
      vat: "taxable_purchase",
      vatNote: "사업자 앞으로 발행된 세금계산서·카드 증빙이 있으면 매입세액 공제합니다. 공급가액은 해당 비용, 세액은 부가세대급금입니다.",
      journal: [
        { side: "debit", account: "통신비(또는 수도광열비)", memo: "공급가액" },
        { side: "debit", account: "부가세대급금", memo: "세액" },
        { side: "credit", account: "보통예금", memo: "합계금액" }
      ],
      guide: "한전·통신사 세금계산서의 작성월이 귀속월입니다. 개인 명의 휴대폰은 업무 사용분 증빙이 없으면 공제·비용 모두 문제 될 수 있습니다.",
      caution: "고지서 금액에 부가세가 포함돼 있어도, 세금계산서를 받지 못하면 공제하지 말고 전액 비용 처리하세요.",
      example: "통신비 공급가 50,000 / 세액 5,000 / 합계 55,000"
    },
    {
      id: "g-supplies",
      title: "사무용품 · 소모품 구입",
      category: "경비",
      keywords: ["사무용품", "소모품", "문구", "토너"],
      vat: "taxable_purchase",
      vatNote: "사업용 소모품은 세금계산서·카드(사업자 지출증빙)가 있으면 매입공제합니다. 소액이라도 증빙을 남기세요.",
      journal: [
        { side: "debit", account: "소모품비(또는 사무용품비)", memo: "공급가액" },
        { side: "debit", account: "부가세대급금", memo: "세액" },
        { side: "credit", account: "보통예금", memo: "합계금액" }
      ],
      guide: "1년 넘게 쓰는 고가 비품(노트북, 모니터 등)은 소모품이 아니라 비품·공구와기구 등 자산으로 처리합니다. 회사 자산 기준금액(예: 100만 원 또는 내부 규정)을 따르세요.",
      caution: "개인 물품을 회사 카드로 결제하지 마세요. 업무 무관 지출은 불공제·손금불산입입니다.",
      example: "토너 공급가 80,000 / 세액 8,000 / 합계 88,000"
    },
    {
      id: "g-car-maintain",
      title: "업무용 승용차 주유 · 수리 · 보험",
      category: "경비",
      keywords: ["차량", "주유", "수리", "보험", "승용차"],
      vat: "no_deduct",
      vatNote: "개별소비세 대상 승용차의 구입·임차·유지(주유, 수리, 주차 등) 매입세액은 원칙적으로 불공제입니다. 화물차·경차 등 예외는 별도입니다.",
      journal: [
        { side: "debit", account: "차량유지비", memo: "지급액 전액 (부가세 포함)" },
        { side: "credit", account: "보통예금", memo: "지급액 전액" }
      ],
      guide: "자동차보험료는 부가세 해당없음(면세)이라 전액 보험료(또는 차량유지비)입니다. 운행일지를 작성해야 비용 인정 한도를 적용받을 수 있습니다.",
      caution: "승용차 관련 세금계산서를 받았다고 부가세대급금을 넣지 마세요. 화물차·9인승 이상 등 공제 대상 차량만 회계팀 확인 후 공제합니다.",
      example: "주유 55,000원 → 차량유지비 55,000원"
    },
    {
      id: "g-fixed-asset",
      title: "비품 · 설비 등 고정자산 구입",
      category: "자산",
      keywords: ["비품", "자산", "설비", "노트북", "기계"],
      vat: "taxable_purchase",
      vatNote: "과세 사업에 사용하는 자산 구입은 세금계산서가 있으면 매입세액 공제합니다. 공급가액은 자산원가, 세액은 부가세대급금입니다. (승용차 등 불공제 자산 제외)",
      journal: [
        { side: "debit", account: "비품(또는 기계장치 등)", memo: "공급가액 + 취득부대비용" },
        { side: "debit", account: "부가세대급금", memo: "세액 (공제 가능한 경우)" },
        { side: "credit", account: "보통예금(또는 미지급금)", memo: "합계금액" }
      ],
      guide: "설치비·운임 등 취득에 들어간 부대비용도 자산원가에 산입합니다. 감가상각은 취득한 다음 달부터(회사 정책에 따름) 별도 분개합니다.",
      caution: "부가세는 자산원가에 넣지 않습니다(공제 대상인 경우). 불공제 자산(업무무관, 면세사업, 승용차 등)만 세액을 자산원가에 포함합니다.",
      example: "노트북 공급가 1,200,000 / 세액 120,000 → 비품 1,200,000 / 대급금 120,000"
    },
    {
      id: "g-depreciation",
      title: "감가상각비 계상",
      category: "자산",
      keywords: ["감가", "상각", "감가상각누계액"],
      vat: "not_applicable",
      vatNote: "감가상각은 내부 회계 처리이며 부가세와 무관합니다. 부가세 계정을 사용하지 않습니다.",
      journal: [
        { side: "debit", account: "감가상각비", memo: "당월 상각액" },
        { side: "credit", account: "감가상각누계액", memo: "당월 상각액" }
      ],
      guide: "자산 종류별 내용연수·상각방법을 따릅니다. 월할 상각이 일반적입니다. 매각·폐기 시 누계액을 제거합니다.",
      caution: "상각 대상에서 부가세대급금을 빼지 않았는지(취득원가 확인) 한 번 더 보세요.",
      example: "비품 취득원가 1,200,000 / 내용연수 5년 → 연 240,000, 월 20,000"
    },
    {
      id: "g-payroll",
      title: "급여 지급 (원천세·사회보험 공제)",
      category: "인건비",
      keywords: ["급여", "임금", "원천세", "사대보험"],
      vat: "not_applicable",
      vatNote: "급여·상여·원천세·4대보험은 부가세 과세대상이 아닙니다. 부가세 계정을 사용하지 않습니다.",
      journal: [
        { side: "debit", account: "급여", memo: "지급총액(세전)" },
        { side: "credit", account: "예수금-소득세", memo: "원천징수 소득세" },
        { side: "credit", account: "예수금-지방소득세", memo: "원천징수 지방소득세" },
        { side: "credit", account: "예수금-국민연금(근로자)", memo: "근로자 부담분" },
        { side: "credit", account: "예수금-건강보험(근로자)", memo: "근로자 부담분" },
        { side: "credit", account: "예수금-고용보험(근로자)", memo: "근로자 부담분" },
        { side: "credit", account: "보통예금", memo: "실지급액" }
      ],
      guide: "회사 부담 4대보험은 별도 분개(복리후생비 또는 보험료)합니다. 급여일은 세전 총액을 비용으로 인식하고, 공제액은 예수금으로 두었다가 납부일에 소멸합니다.",
      caution: "실수령액만 급여로 잡으면 인건비·예수금이 모두 틀립니다. 반드시 지급총액 기준으로 분개하세요.",
      example: "세전 3,000,000 / 공제 400,000 / 실지급 2,600,000"
    },
    {
      id: "g-insurance-company",
      title: "4대보험 회사부담분 및 납부",
      category: "인건비",
      keywords: ["4대보험", "국민연금", "건강", "고용", "산재"],
      vat: "not_applicable",
      vatNote: "사회보험료는 부가세 해당없음입니다. 공제·예수 개념의 부가세와 섞지 마세요.",
      journal: [
        { side: "debit", account: "복리후생비(또는 보험료)", memo: "회사 부담분 합계" },
        { side: "credit", account: "미지급금-사회보험", memo: "회사 부담분" },
        { side: "debit", account: "미지급금-사회보험", memo: "납부 시 회사분" },
        { side: "debit", account: "예수금-국민연금 등", memo: "납부 시 근로자분" },
        { side: "credit", account: "보통예금", memo: "고지서 납부액" }
      ],
      guide: "매월 급여 귀속에 맞춰 회사분을 비용 처리하고, 익월 납부 시 예수금·미지급금을 함께 정리합니다. 산재는 전액 회사 부담입니다.",
      caution: "고지서 합계를 한 계정으로만 넣으면 근로자 예수금이 남아 장부가 맞질 않습니다.",
      example: "회사분 350,000 + 근로자분 300,000 = 납부 650,000"
    },
    {
      id: "g-interest",
      title: "대출이자 지급",
      category: "금융",
      keywords: ["이자", "대출", "금융비용"],
      vat: "not_applicable",
      vatNote: "금융 이자는 부가세 면세(해당없음)입니다. 부가세 계정을 사용하지 않습니다.",
      journal: [
        { side: "debit", account: "이자비용", memo: "이자 금액" },
        { side: "credit", account: "보통예금", memo: "이자 금액" }
      ],
      guide: "원금 상환과 이자를 반드시 구분합니다. 원금은 차입금(부채) 감소, 이자만 비용입니다. 선지급 이자는 선급비용 후 기간 안분합니다.",
      caution: "상환 전액을 이자비용으로 처리하지 마세요.",
      example: "상환 1,000,000 = 원금 800,000 + 이자 200,000"
    },
    {
      id: "g-bank-fee",
      title: "은행 이체수수료 · 계좌관리수수료",
      category: "금융",
      keywords: ["이체", "수수료", "은행"],
      vat: "not_applicable",
      vatNote: "은행 수수료는 금융용역으로 부가세가 없습니다. 지급액 전액을 지급수수료(또는 금융비용)로 처리합니다.",
      journal: [
        { side: "debit", account: "지급수수료", memo: "수수료 전액" },
        { side: "credit", account: "보통예금", memo: "수수료 전액" }
      ],
      guide: "통장에 수수료로 빠진 금액을 누락하지 마세요. 통장 잔액 대사 시 함께 잡힙니다.",
      caution: "VAN·PG 등 비은행 결제수수료는 과세라서 세금계산서가 있으면 매입공제 대상입니다. 은행 수수료와 구분하세요.",
      example: "이체수수료 500원 → 지급수수료 500원"
    },
    {
      id: "g-prepay",
      title: "선급금 지급 후 입고·정산",
      category: "매입",
      keywords: ["선급금", "선금", "계약금"],
      vat: "case_by_case",
      vatNote: "선금만 보낼 때는 보통 세금계산서가 없어 부가세 처리가 없습니다. 이후 세금계산서를 받는 시점에 매입세액을 인식합니다.",
      journal: [
        { side: "debit", account: "선급금", memo: "선지급액 (세금계산서 전)" },
        { side: "credit", account: "보통예금", memo: "선지급액" },
        { side: "debit", account: "원재료(또는 비용/자산)", memo: "공급가액 (정산 시)" },
        { side: "debit", account: "부가세대급금", memo: "세액 (세금계산서 수취 시)" },
        { side: "credit", account: "선급금", memo: "기존 선급금 대체" },
        { side: "credit", account: "보통예금(또는 미지급금)", memo: "잔금" }
      ],
      guide: "선급금은 자산입니다. 물건을 받거나 용역이 끝나면 해당 계정으로 대체합니다. 세금계산서 작성일에 맞춰 부가세를 넣으세요.",
      caution: "선금 송금 시점에 부가세대급금을 추정해 넣지 마세요. 증빙 수취 시점에 처리합니다.",
      example: "선금 1,100,000 송금 → 이후 세금계산서 공급가 2,000,000 / 세액 200,000, 잔금 1,100,000"
    },
    {
      id: "g-advance-sales",
      title: "선수금 수령 후 매출 인식",
      category: "매출",
      keywords: ["선수금", "계약금", "선수"],
      vat: "case_by_case",
      vatNote: "계약금만 받은 시점에는 세금계산서를 아직 안 쓰는 경우가 많습니다. 세금계산서 작성일(공급 시기)에 매출과 부가세예수금을 인식합니다.",
      journal: [
        { side: "debit", account: "보통예금", memo: "선수금 입금" },
        { side: "credit", account: "선수금", memo: "선수금 입금" },
        { side: "debit", account: "선수금", memo: "매출 대체" },
        { side: "debit", account: "외상매출금(또는 보통예금)", memo: "잔금" },
        { side: "credit", account: "제품매출", memo: "공급가액" },
        { side: "credit", account: "부가세예수금", memo: "세액" }
      ],
      guide: "돈 들어온 날이 곧 매출일이 아닙니다. 인도·검수·작성일 등 공급 시기를 따릅니다. 선금 받을 때 세금계산서를 이미 발행했다면 그때 매출·예수금을 인식합니다.",
      caution: "선수금을 바로 매출로 잡으면 부가세 신고 시기가 앞당겨지거나 어긋날 수 있습니다.",
      example: "계약금 550,000 입금(선수금) → 인도 시 공급가 1,000,000 / 세액 100,000"
    },
    {
      id: "g-vat-return",
      title: "부가세 신고 후 납부(또는 환급)",
      category: "세금",
      keywords: ["부가세", "신고", "납부", "환급", "예수금", "대급금"],
      vat: "not_applicable",
      vatNote: "부가세 납부 자체는 새로운 과세거래가 아닙니다. 예수금과 대급금을 상계하고 차액을 납부하거나 미수금(환급)으로 돌립니다.",
      journal: [
        { side: "debit", account: "부가세예수금", memo: "해당 과세기간 매출세액 합계" },
        { side: "credit", account: "부가세대급금", memo: "해당 과세기간 매입세액 합계" },
        { side: "credit", account: "미지급금-부가세(또는 보통예금)", memo: "납부할 세액" }
      ],
      guide: "환급이면 차변이 더 커지므로 미수금-부가세(또는 보통예금 입금)로 처리합니다. 신고 후 계정 잔액이 0이 되는지 확인하세요.",
      caution: "납부액을 세금과공과로 비용 처리하지 마세요. 부가세는 비용이 아니라 채권·채무의 정산입니다.",
      example: "예수금 5,000,000 − 대급금 3,200,000 = 납부 1,800,000"
    },
    {
      id: "g-withholding-pay",
      title: "원천세 납부",
      category: "세금",
      keywords: ["원천세", "소득세", "지방소득세", "납부"],
      vat: "not_applicable",
      vatNote: "원천세 납부는 부가세와 무관합니다. 급여 때 잡아 둔 예수금을 소멸시킵니다.",
      journal: [
        { side: "debit", account: "예수금-소득세", memo: "납부 소득세" },
        { side: "debit", account: "예수금-지방소득세", memo: "납부 지방소득세" },
        { side: "credit", account: "보통예금", memo: "원천세 합계" }
      ],
      guide: "매월 10일(또는 반기) 납부 스케줄에 맞춥니다. 납부서가 소득세·지방소득세로 나뉘므로 계정과 맞추세요.",
      caution: "원천세를 법인세나 부가세 계정에 넣지 마세요.",
      example: "소득세 180,000 + 지방소득세 18,000 = 198,000"
    },
    {
      id: "g-suspense",
      title: "가지급금 · 가수금 (계정 불명 자금)",
      category: "기타",
      keywords: ["가지급", "가수금", "전도금", "개인"],
      vat: "not_applicable",
      vatNote: "내용을 모르면 부가세를 추정하지 않습니다. 일단 가지급금(나간 돈) 또는 가수금(들어온 돈)으로 두고, 증빙이 나오면 본계정·부가세를 대체합니다.",
      journal: [
        { side: "debit", account: "가지급금", memo: "용도 미확인 출금" },
        { side: "credit", account: "보통예금", memo: "출금액" },
        { side: "debit", account: "보통예금", memo: "용도 미확인 입금" },
        { side: "credit", account: "가수금", memo: "입금액" }
      ],
      guide: "임직원 개인 사용이 확인되면 상여·가지급 회수·소득처분 이슈가 있습니다. 빠른 정산이 중요합니다.",
      caution: "가지급금에 부가세대급금을 미리 넣지 마세요. 영수증을 받는 시점에 올바른 비용·자산·부가세로 대체합니다.",
      example: "용도 미확인 출금 220,000 → 가지급금 220,000"
    }
  ];

  function clone(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeEntry(raw, index) {
    if (!raw || typeof raw !== "object") return null;
    const vat = VAT[raw.vat] ? raw.vat : "case_by_case";
    const journal = Array.isArray(raw.journal)
      ? raw.journal
          .map((line) => ({
            side: line && line.side === "credit" ? "credit" : "debit",
            account: String((line && line.account) || "").trim(),
            memo: String((line && line.memo) || "").trim()
          }))
          .filter((line) => line.account)
      : [];
    const keywords = Array.isArray(raw.keywords)
      ? raw.keywords.map((k) => String(k).trim()).filter(Boolean)
      : String(raw.keywords || "")
          .split(/[,/，、\s]+/)
          .map((k) => k.trim())
          .filter(Boolean);
    return {
      id: String(raw.id || ("g-" + Date.now() + "-" + index)),
      title: String(raw.title || "제목 없음").trim() || "제목 없음",
      category: String(raw.category || "기타").trim() || "기타",
      keywords,
      vat,
      vatNote: String(raw.vatNote || "").trim(),
      journal,
      guide: String(raw.guide || "").trim(),
      caution: String(raw.caution || "").trim(),
      example: String(raw.example || "").trim(),
      updatedAt: raw.updatedAt || nowIso()
    };
  }

  function loadRecord() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.entries)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function saveRecord(entries, meta) {
    const record = {
      version: 1,
      updatedAt: nowIso(),
      source: (meta && meta.source) || "admin",
      entries: entries.map((e, i) => normalizeEntry(e, i)).filter(Boolean)
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
      throw new Error("이 브라우저에 저장할 수 없습니다. JSON으로 내보내 보관하세요.");
    }
    return record;
  }

  const api = {
    STORAGE_KEY,
    ADMIN_UNLOCK_KEY,
    APP_PASS_SHA256,
    VAT,
    CATEGORIES,
    SEED,

    vatList() {
      return Object.keys(VAT).map((id) => VAT[id]);
    },

    vatInfo(id) {
      return VAT[id] || VAT.case_by_case;
    },

    seedEntries() {
      const embedded = global.JOURNAL_EMBEDDED;
      const source = Array.isArray(embedded) && embedded.length ? embedded : SEED;
      return clone(source).map((e, i) => normalizeEntry(e, i));
    },

    loadEntries() {
      const record = loadRecord();
      if (record) {
        return {
          entries: record.entries.map((e, i) => normalizeEntry(e, i)).filter(Boolean),
          updatedAt: record.updatedAt,
          source: record.source || "local",
          isCustom: true
        };
      }
      return {
        entries: api.seedEntries(),
        updatedAt: null,
        source: "seed",
        isCustom: false
      };
    },

    saveEntries(entries) {
      return saveRecord(entries, { source: "admin" });
    },

    resetToSeed() {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      return api.loadEntries();
    },

    exportPayload(entries) {
      return {
        version: 1,
        exportedAt: nowIso(),
        entries: (entries || api.loadEntries().entries).map((e, i) => normalizeEntry(e, i))
      };
    },

    importPayload(payload, mode) {
      const list = Array.isArray(payload)
        ? payload
        : payload && Array.isArray(payload.entries)
          ? payload.entries
          : null;
      if (!list) throw new Error("가져올 안내 목록을 찾지 못했습니다.");
      const incoming = list.map((e, i) => normalizeEntry(e, i)).filter(Boolean);
      if (mode === "merge") {
        const current = api.loadEntries().entries;
        const map = new Map(current.map((e) => [e.id, e]));
        incoming.forEach((e) => map.set(e.id, e));
        return saveRecord(Array.from(map.values()), { source: "import-merge" });
      }
      return saveRecord(incoming, { source: "import" });
    },

    newId() {
      return "g-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    },

    emptyEntry() {
      return {
        id: api.newId(),
        title: "",
        category: "경비",
        keywords: [],
        vat: "taxable_purchase",
        vatNote: "",
        journal: [
          { side: "debit", account: "", memo: "" },
          { side: "credit", account: "", memo: "" }
        ],
        guide: "",
        caution: "",
        example: "",
        updatedAt: nowIso()
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
