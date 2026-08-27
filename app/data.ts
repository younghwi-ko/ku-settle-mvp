export type Bilingual = { en: string; ko: string };
export type LifecycleStage = "before-arrival" | "first-weeks" | "campus-life" | "departure";
export type OfficialGuidance = { message: Bilingual; link: { href: string; label: Bilingual } };
export type TaskAction =
  | { kind: "external"; href: string; label: Bilingual }
  | { kind: "internal"; target: "guide"; guideCategory: "Hospital" | "Food"; label: Bilingual }
  | { kind: "internal"; target: "marketplace"; marketMode: "incoming" | "leaving"; label: Bilingual };
export type Task = { id: string; stage: LifecycleStage; category: Bilingual; title: Bilingual; description: Bilingual; needs: Bilingual[]; time: string; tip: Bilingual; action?: TaskAction; officialGuidance?: OfficialGuidance };
export type ProductCategory = "Home" | "Kitchen" | "Electronics" | "Bedding";
export type ProductIcon = "cooking" | "lamp" | "bed" | "kettle" | "fan" | "box";
export type MarketProduct = { id: number | string; name: Bilingual; price: string; category: ProductCategory; condition: Bilingual; pickup: Bilingual; seller: Bilingual; status: "Available" | "Reserved"; icon: ProductIcon; userCreated?: boolean };

export const lifecycleStages: { id: LifecycleStage; label: Bilingual; number: string }[] = [
  { id: "before-arrival", label: { en: "Before Arrival", ko: "입국 전" }, number: "01" },
  { id: "first-weeks", label: { en: "First Weeks", ko: "입국 직후" }, number: "02" },
  { id: "campus-life", label: { en: "Campus Life", ko: "학교생활" }, number: "03" },
  { id: "departure", label: { en: "Departure", ko: "귀국 준비" }, number: "04" }
];

const external = (href: string, en: string, ko: string): TaskAction => ({ kind: "external", href, label: { en, ko } });
const guide = (guideCategory: "Hospital" | "Food"): TaskAction => ({ kind: "internal", target: "guide", guideCategory, label: { en: "View Local Guide", ko: "로컬 가이드 보기" } });
const market = (marketMode: "incoming" | "leaving"): TaskAction => ({ kind: "internal", target: "marketplace", marketMode, label: { en: marketMode === "incoming" ? "Browse Marketplace" : "List an item", ko: marketMode === "incoming" ? "마켓 둘러보기" : "물품 등록하기" } });

export const tasks: Task[] = [
  {
    id: "housing-reserve", stage: "before-arrival", category: { en: "Housing", ko: "주거" }, title: { en: "Reserve housing", ko: "기숙사·주거 확정" },
    description: { en: "Confirm where you will stay and keep your housing confirmation easy to find.", ko: "머물 곳을 확정하고 주거 확인 자료를 쉽게 찾을 수 있도록 보관하세요." },
    needs: [{ en: "Housing confirmation", ko: "주거 확인 자료" }, { en: "Move-in contact", ko: "입주 문의 연락처" }], time: "15–30",
    tip: { en: "Review the latest information provided by your dormitory or housing contact.", ko: "기숙사 또는 주거 담당자가 제공한 최신 안내를 확인하세요." }
  },
  {
    id: "sim-compare", stage: "before-arrival", category: { en: "Connectivity", ko: "통신" }, title: { en: "Compare SIM options", ko: "SIM 선택 가이드" },
    description: { en: "Compare general prepaid and postpaid options before choosing a plan after arrival.", ko: "입국 후 요금제를 선택하기 전에 선불·후불 방식의 일반적인 차이를 비교하세요." },
    needs: [{ en: "Unlocked phone status", ko: "휴대폰 잠금 해제 여부" }, { en: "Expected data use", ko: "예상 데이터 사용량" }], time: "10–20",
    tip: { en: "Check current eligibility and identification requirements before purchasing.", ko: "현재 가입 조건과 신분증 요건을 확인한 뒤 구매하세요." }
  },
  {
    id: "airport-route", stage: "before-arrival", category: { en: "Arrival Route", ko: "입국 이동" }, title: { en: "Plan your airport route", ko: "공항 이동 방법 확인" },
    description: { en: "Choose a general route from the airport to your housing and save a backup option.", ko: "공항에서 주거지까지 이동할 기본 경로와 대체 경로를 준비하세요." },
    needs: [{ en: "Housing address", ko: "주거지 주소" }, { en: "Offline route note", ko: "오프라인 이동 메모" }], time: "15–25",
    tip: { en: "Check current transport information close to your arrival date.", ko: "입국일이 가까워지면 최신 교통 정보를 다시 확인하세요." }
  },
  {
    id: "arrival-essentials", stage: "before-arrival", category: { en: "Preparation", ko: "준비" }, title: { en: "Prepare arrival essentials", ko: "준비물 체크리스트" },
    description: { en: "Collect the documents, contact details, and first-day essentials you expect to use.", ko: "필요한 서류와 연락처, 첫날 사용할 필수품을 한곳에 준비하세요." },
    needs: [{ en: "Travel documents", ko: "여행 서류" }, { en: "Important contacts", ko: "주요 연락처" }, { en: "First-day essentials", ko: "첫날 필수품" }], time: "20–40",
    tip: { en: "Keep digital copies separate from your original documents.", ko: "원본 서류와 별도로 디지털 사본을 보관하세요." }
  },
  {
    id: "dorm", stage: "first-weeks", category: { en: "Housing", ko: "주거" }, title: { en: "Dormitory check-in", ko: "기숙사 체크인" },
    description: { en: "Complete your dormitory arrival steps and review the current residence guidance.", ko: "기숙사 입사 절차를 완료하고 현재 생활 안내를 확인하세요." },
    needs: [{ en: "Dormitory confirmation", ko: "기숙사 확인서" }, { en: "Required identification", ko: "요청된 신분증" }], time: "20–30",
    tip: { en: "Use the instructions sent by the dormitory as the source of truth.", ko: "기숙사에서 제공한 안내를 최종 기준으로 확인하세요." }
  },
  {
    id: "residence", stage: "first-weeks", category: { en: "Housing", ko: "주거" }, title: { en: "Residence confirmation", ko: "거주지 확인" },
    description: { en: "Confirm your current housing details and keep any supporting residence information.", ko: "현재 거주 정보를 확인하고 필요한 거주 증빙 자료를 보관하세요." },
    needs: [{ en: "Current housing details", ko: "현재 거주 정보" }, { en: "Housing contact", ko: "주거 담당자 연락처" }], time: "10–15",
    tip: { en: "Check official guidance before preparing documents for an administrative application.", ko: "행정 신청 서류를 준비하기 전에 공식 안내를 확인하세요." }
  },
  {
    id: "arc", stage: "first-weeks", category: { en: "Stay Registration", ko: "체류 등록" }, title: { en: "ARC registration", ko: "ARC 등록 절차" },
    description: { en: "Review the current official guidance for registering your stay in Korea.", ko: "한국 체류 등록을 위한 최신 공식 안내를 확인하세요." },
    needs: [{ en: "Current official guidance", ko: "최신 공식 안내" }, { en: "Documents requested for your status", ko: "체류 자격에 맞는 요청 서류" }], time: "30–60",
    tip: { en: "Use HiKorea as the source of truth because requirements can change.", ko: "요건이 변경될 수 있으므로 HiKorea를 최종 기준으로 확인하세요." },
    action: external("https://www.hikorea.go.kr/", "Open official guide", "공식 안내 열기"),
    officialGuidance: { message: { en: "Requirements and procedures may change. Check the latest information on HiKorea before applying.", ko: "요건과 절차는 변경될 수 있습니다. 신청 전 HiKorea에서 최신 정보를 확인하세요." }, link: { href: "https://www.hikorea.go.kr/", label: { en: "Visit HiKorea", ko: "HiKorea 방문" } } }
  },
  {
    id: "bank", stage: "first-weeks", category: { en: "Banking", ko: "은행" }, title: { en: "Open a bank account", ko: "은행 계좌 개설" },
    description: { en: "Check current account-opening requirements before visiting a bank.", ko: "은행을 방문하기 전에 현재 계좌 개설 요건을 확인하세요." },
    needs: [{ en: "Identification requested by the bank", ko: "은행이 요청하는 신분증" }, { en: "Current eligibility information", ko: "현재 가입 조건 안내" }], time: "40–60",
    tip: { en: "Requirements and language support can differ, so confirm them before visiting.", ko: "요건과 언어 지원은 다를 수 있으므로 방문 전에 확인하세요." }
  },
  {
    id: "sim", stage: "first-weeks", category: { en: "Connectivity", ko: "통신" }, title: { en: "Get a Korean SIM", ko: "통신사 개통" },
    description: { en: "Choose a current mobile option that fits your identification status and usage.", ko: "현재 신분증 상태와 사용량에 맞는 통신 옵션을 선택하세요." },
    needs: [{ en: "Unlocked phone", ko: "통신사 잠금 해제 휴대폰" }, { en: "Current identification", ko: "현재 보유 신분증" }], time: "20–40",
    tip: { en: "Confirm current plan terms and identification requirements before signing up.", ko: "가입 전에 최신 요금 조건과 신분증 요건을 확인하세요." }
  },
  {
    id: "account", stage: "first-weeks", category: { en: "KU Systems", ko: "학교 시스템" }, title: { en: "Activate your KU account", ko: "학교 시스템 활성화" },
    description: { en: "Set up access to the KU portal and the digital services available to you.", ko: "고려대 포털과 이용 가능한 학교 디지털 서비스 접근을 설정하세요." },
    needs: [{ en: "Student identification information", ko: "학생 식별 정보" }, { en: "KU account guidance", ko: "고려대 계정 안내" }], time: "10–15",
    tip: { en: "Follow the current instructions from KU Digital Information Services.", ko: "고려대학교 디지털정보처의 최신 안내를 따르세요." }, action: external("https://ic.korea.ac.kr/ic/about/account.do", "Open official guide", "공식 안내 열기")
  },
  {
    id: "courses", stage: "first-weeks", category: { en: "Courses", ko: "수강" }, title: { en: "Confirm your course schedule", ko: "수강신청 및 시간표 확인" },
    description: { en: "Review your registered courses, classrooms, and current notices in KU systems.", ko: "고려대 시스템에서 수강 과목, 강의실과 최신 공지를 확인하세요." },
    needs: [{ en: "KU portal access", ko: "고려대 포털 접근" }, { en: "Current course plan", ko: "현재 수강 계획" }], time: "20–30",
    tip: { en: "Use current KU notices rather than relying on saved dates.", ko: "저장해 둔 날짜보다 고려대의 최신 공지를 기준으로 확인하세요." }, action: external("https://portal.korea.ac.kr/p/PR/", "Open KU Portal", "KU 포털 열기")
  },
  {
    id: "healthcare", stage: "campus-life", category: { en: "Healthcare", ko: "의료" }, title: { en: "Find foreign-language-friendly healthcare", ko: "외국어 가능 병원 찾기" },
    description: { en: "Explore demo listings that indicate whether language support may be available.", ko: "외국어 지원 가능 여부를 표시한 데모 의료기관 목록을 확인하세요." },
    needs: [{ en: "Local Guide", ko: "로컬 가이드" }, { en: "Personal health notes", ko: "개인 건강 메모" }], time: "10–15",
    tip: { en: "Contact a provider directly to confirm current services and language support.", ko: "현재 진료와 언어 지원 여부는 기관에 직접 확인하세요." }, action: guide("Hospital")
  },
  {
    id: "campus-dining", stage: "campus-life", category: { en: "Dining", ko: "식사" }, title: { en: "Explore campus dining", ko: "캠퍼스 식당 정보 확인" },
    description: { en: "Use the Local Guide to explore demo food listings around campus.", ko: "로컬 가이드에서 캠퍼스 주변 데모 식당 정보를 살펴보세요." },
    needs: [{ en: "Dietary preferences", ko: "식단 선호" }, { en: "Local Guide", ko: "로컬 가이드" }], time: "10–15",
    tip: { en: "Confirm current menus and ingredients directly before visiting.", ko: "방문 전에 현재 메뉴와 식재료를 직접 확인하세요." }, action: guide("Food")
  },
  {
    id: "household-essentials", stage: "campus-life", category: { en: "Daily Life", ko: "생활" }, title: { en: "Find household essentials", ko: "생활용품 구매처 확인" },
    description: { en: "Browse demo marketplace listings for items useful in student housing.", ko: "학생 주거생활에 필요한 물품을 데모 마켓에서 찾아보세요." },
    needs: [{ en: "Shopping list", ko: "구매 목록" }, { en: "Pickup plan", ko: "픽업 계획" }], time: "10–20",
    tip: { en: "Listings and transactions in this prototype are demo-only.", ko: "이 프로토타입의 상품과 거래는 데모용입니다." }, action: market("incoming")
  },
  {
    id: "student-marketplace", stage: "campus-life", category: { en: "Student Marketplace", ko: "학생 마켓" }, title: { en: "Use the student marketplace", ko: "학생 인증 중고거래 이용" },
    description: { en: "Explore how a KU-student marketplace could connect incoming and departing students.", ko: "입국 학생과 출국 학생을 연결하는 고려대 학생 마켓의 데모 흐름을 확인하세요." },
    needs: [{ en: "Demo verification", ko: "데모 인증" }, { en: "Marketplace listings", ko: "마켓 상품 목록" }], time: "10–15",
    tip: { en: "The prototype checks email format only; a live service would require real KU email verification.", ko: "프로토타입은 이메일 형식만 확인하며, 실제 서비스는 고려대 이메일 인증이 필요합니다." }, action: market("incoming")
  },
  {
    id: "sell-items", stage: "departure", category: { en: "Marketplace", ko: "중고거래" }, title: { en: "List household items for sale", ko: "생활용품 판매 등록" },
    description: { en: "Create a local demo listing for items you no longer need.", ko: "더 이상 필요하지 않은 물품을 로컬 데모 상품으로 등록하세요." },
    needs: [{ en: "Item details", ko: "상품 정보" }, { en: "Pickup location", ko: "픽업 장소" }], time: "10–15",
    tip: { en: "This prototype saves listings only in this browser and does not complete a real transaction.", ko: "이 프로토타입은 현재 브라우저에만 상품을 저장하며 실제 거래를 완료하지 않습니다." }, action: market("leaving")
  },
  {
    id: "luggage", stage: "departure", category: { en: "Luggage", ko: "짐 정리" }, title: { en: "Arrange luggage storage or shipping", ko: "짐 보관·배송 준비" },
    description: { en: "Decide what to carry, store, ship, donate, or sell before departure.", ko: "귀국 전에 가져갈 짐과 보관·배송·기부·판매할 물품을 구분하세요." },
    needs: [{ en: "Luggage inventory", ko: "짐 목록" }, { en: "Current provider information", ko: "최신 업체 정보" }], time: "20–40",
    tip: { en: "Compare current provider terms yourself; this demo does not recommend a storage or shipping company.", ko: "이 데모는 업체를 추천하지 않으므로 최신 조건을 직접 비교하세요." }
  },
  {
    id: "departure-checklist", stage: "departure", category: { en: "Departure", ko: "귀국" }, title: { en: "Complete departure checklist", ko: "귀국 체크리스트" },
    description: { en: "Review the personal, academic, housing, and travel tasks relevant to your departure.", ko: "귀국에 필요한 개인·학업·주거·여행 관련 할 일을 점검하세요." },
    needs: [{ en: "Personal departure list", ko: "개인 귀국 목록" }, { en: "Current KU and housing notices", ko: "최신 학교·주거 안내" }], time: "20–30",
    tip: { en: "Use the latest notices from KU and your housing provider as the source of truth.", ko: "고려대와 주거 제공자의 최신 안내를 최종 기준으로 확인하세요." }
  },
  {
    id: "dorm-checkout", stage: "departure", category: { en: "Housing", ko: "주거" }, title: { en: "Dormitory checkout", ko: "기숙사 퇴실" },
    description: { en: "Review and complete the current checkout steps provided by your dormitory.", ko: "기숙사에서 제공한 최신 퇴실 절차를 확인하고 완료하세요." },
    needs: [{ en: "Dormitory checkout guidance", ko: "기숙사 퇴실 안내" }, { en: "Room condition check", ko: "객실 상태 확인" }], time: "20–40",
    tip: { en: "Do not rely on this demo for deadlines; follow current dormitory notices.", ko: "이 데모의 날짜를 기준으로 삼지 말고 최신 기숙사 공지를 확인하세요." }
  },
  {
    id: "move-out", stage: "departure", category: { en: "Housing", ko: "주거" }, title: { en: "Off-campus move-out", ko: "교외 거주지 퇴거 준비" },
    description: { en: "Review the move-out steps and communication required for your current housing.", ko: "현재 거주지에 필요한 퇴거 절차와 연락 사항을 확인하세요." },
    needs: [{ en: "Current housing agreement", ko: "현재 주거 계약 자료" }, { en: "Housing contact", ko: "주거 담당자 연락처" }], time: "20–40",
    tip: { en: "Confirm all timing, inspection, and payment details directly with your housing contact.", ko: "일정, 점검과 정산 내용은 주거 담당자에게 직접 확인하세요." }
  }
];

export const products: MarketProduct[] = [
  { id: 1, name: { en: "Rice Cooker", ko: "전기밥솥" }, price: "₩20,000", category: "Kitchen", condition: { en: "Good", ko: "양호" }, pickup: { en: "Anam Station, Exit 3", ko: "안암역 3번 출구" }, seller: { en: "Exchange student · Mia", ko: "교환학생 · Mia" }, status: "Available", icon: "cooking" },
  { id: 2, name: { en: "Desk Lamp", ko: "책상 스탠드" }, price: "₩8,000", category: "Home", condition: { en: "Like new", ko: "거의 새 상품" }, pickup: { en: "KU Main Gate", ko: "고려대 정문" }, seller: { en: "KU student · Joon", ko: "고려대 학생 · Joon" }, status: "Available", icon: "lamp" },
  { id: 3, name: { en: "Bedding Set", ko: "침구 세트" }, price: "₩15,000", category: "Bedding", condition: { en: "Clean", ko: "세탁 완료" }, pickup: { en: "CJ International House", ko: "CJ 국제관" }, seller: { en: "Exchange student · Lea", ko: "교환학생 · Lea" }, status: "Reserved", icon: "bed" },
  { id: 4, name: { en: "Electric Kettle", ko: "전기포트" }, price: "₩12,000", category: "Kitchen", condition: { en: "Good", ko: "양호" }, pickup: { en: "Anam Ogeori", ko: "안암오거리" }, seller: { en: "KU student · Min", ko: "고려대 학생 · Min" }, status: "Available", icon: "kettle" },
  { id: 5, name: { en: "Mini Fan", ko: "미니 선풍기" }, price: "₩7,000", category: "Electronics", condition: { en: "Good", ko: "양호" }, pickup: { en: "KU Central Plaza", ko: "고려대 중앙광장" }, seller: { en: "Exchange student · Noah", ko: "교환학생 · Noah" }, status: "Available", icon: "fan" },
  { id: 6, name: { en: "Storage Box Set", ko: "수납 박스 세트" }, price: "₩10,000", category: "Home", condition: { en: "Used", ko: "사용감 있음" }, pickup: { en: "Anam Station, Exit 2", ko: "안암역 2번 출구" }, seller: { en: "KU student · Hana", ko: "고려대 학생 · Hana" }, status: "Available", icon: "box" }
];

export const places = [
  { id: 1, name: { en: "Anam Welcome Clinic · Sample", ko: "안암 웰컴 클리닉 · 샘플" }, category: "Hospital", english: true, location: { en: "Anam-ro area", ko: "안암로 인근" }, distance: "5 min", description: { en: "Demo general clinic listing with an international-student desk.", ko: "외국인 학생 안내 데스크가 있는 데모 일반의원입니다." }, tip: { en: "Bring your passport or ARC when visiting.", ko: "방문할 때 여권 또는 외국인등록증을 지참하세요." } },
  { id: 2, name: { en: "Seongbuk Halal Kitchen · Sample", ko: "성북 할랄 키친 · 샘플" }, category: "Halal", english: true, location: { en: "Near Anam Station", ko: "안암역 인근" }, distance: "7 min", description: { en: "Demo casual restaurant serving clearly labeled halal-friendly meals.", ko: "할랄 친화 메뉴를 명확히 표시하는 데모 캐주얼 식당입니다." }, tip: { en: "Ask staff to confirm current ingredients before ordering.", ko: "주문 전 직원에게 현재 식재료를 확인하세요." } },
  { id: 3, name: { en: "Green Table Anam · Sample", ko: "그린 테이블 안암 · 샘플" }, category: "Vegan", english: true, location: { en: "KU Main Gate area", ko: "고려대 정문 인근" }, distance: "6 min", description: { en: "Demo plant-based lunch spot with simple English menu labels.", ko: "간단한 영어 메뉴 표기가 있는 데모 식물성 식당입니다." }, tip: { en: "Lunch sets usually offer the best value.", ko: "점심 세트 메뉴가 보통 가장 합리적입니다." } },
  { id: 4, name: { en: "Campus Care Pharmacy · Sample", ko: "캠퍼스 케어 약국 · 샘플" }, category: "Pharmacy", english: false, location: { en: "Anam Ogeori", ko: "안암오거리" }, distance: "4 min", description: { en: "Demo pharmacy listing for daily medicine and basic health supplies.", ko: "상비약과 기본 건강용품을 판매하는 데모 약국입니다." }, tip: { en: "Show a translated note with your symptoms and allergies.", ko: "증상과 알레르기를 번역한 메모를 보여주세요." } },
  { id: 5, name: { en: "Study Corner Café · Sample", ko: "스터디 코너 카페 · 샘플" }, category: "Cafe", english: true, location: { en: "KU Side Gate area", ko: "고려대 후문 인근" }, distance: "3 min", description: { en: "Demo quiet café listing with outlets and long shared tables.", ko: "콘센트와 긴 공용 테이블이 있는 데모 조용한 카페입니다." }, tip: { en: "Weekday mornings are usually quieter.", ko: "평일 오전이 비교적 한산합니다." } },
  { id: 6, name: { en: "Anam Global Mart · Sample", ko: "안암 글로벌 마트 · 샘플" }, category: "Grocery", english: false, location: { en: "Anam Station area", ko: "안암역 인근" }, distance: "8 min", description: { en: "Demo grocery listing for international ingredients and dorm basics.", ko: "세계 식재료와 기숙사 생활용품을 다루는 데모 식료품점입니다." }, tip: { en: "Bring a reusable bag; bags may cost extra.", ko: "봉투 비용이 추가될 수 있으니 장바구니를 챙기세요." } }
] as const;
