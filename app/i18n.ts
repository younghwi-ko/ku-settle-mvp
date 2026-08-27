export type Lang = "en" | "ko";

export const copy = {
  en: {
    nav: { home: "Home", onboarding: "Onboarding", marketplace: "Marketplace", guide: "Local Guide" },
    common: { complete: "Complete", completed: "Completed", notStarted: "Not started", inProgress: "In progress", min: "min", available: "Available", reserved: "Reserved", verified: "KU Student Verified", close: "Close", demo: "Demo data", cancel: "Cancel", required: "Please complete every field." },
    home: {
      eyebrow: "YOUR LIFECYCLE COMPANION", welcome: "Welcome to Korea University", lead: "Your personalized journey from arrival to departure.",
      body: "Know what to prepare, what to do next, and where to take action throughout your Korea University journey.", setup: "Your lifecycle progress", next: "Recommended next step", viewGuide: "View recommended task", viewAll: "Open lifecycle plan",
      allCompletedTitle: "All setup tasks completed", allCompletedBody: "You’ve completed your KU lifecycle plan. Review any stage whenever you need it.", reviewTasks: "Review completed tasks",
      lifecycle: "Arrival-to-departure journey", stageOpen: "Open stage", cards: ["Turn essential information into action", "Find affordable items from other students", "Discover student-friendly places near KU"],
      trust: ["No account needed", "Works in EN & KO", "From arrival to departure"]
    },
    onboarding: {
      eyebrow: "INFORMATION → ACTION", title: "Your KU lifecycle plan", body: "Follow the right checklist from before arrival through departure. Progress is saved on this device.",
      searchHint: "Your recommended next task is highlighted when it is in the selected stage.", need: "What to prepare", time: "Estimated time", tip: "Practical note", mark: "Mark complete", saved: "Progress saved locally",
      overallProgress: "Overall lifecycle", stageProgress: "Selected stage", tasksComplete: "tasks complete", nextRecommendation: "Next recommended task", viewNext: "View next task", officialGuidance: "Official guidance"
    },
    market: {
      eyebrow: "CAMPUS MARKETPLACE", title: "One student’s farewell is another’s fresh start", body: "Explore a demo of student-to-student reuse near campus. Live verification and transactions are not implemented.", incoming: "I’m new to KU", leaving: "I’m leaving KU", search: "Search items", all: "All", home: "Home", kitchen: "Kitchen", electronics: "Electronics", bedding: "Bedding", condition: "Condition", pickup: "Pickup", seller: "Seller", details: "View details", flow: ["Demo verification", "Product listing", "Campus pickup", "Direct transaction"], contact: "Contact seller", contactTitle: "Contact the seller", contactBody: "This is a presentation demo. In a live service, your message would be sent through a secure KU-only chat.", message: "Hi! Is this still available? I can pick it up near campus.", copied: "Demo message ready", empty: "No items match your search.",
      formTitle: "List an item for the next student", formBody: "Add a simple listing using the same icon-based cards. No image upload is needed for this demo.", itemName: "Item name", price: "Price", category: "Category", pickupLocation: "Pickup location", availability: "Availability", submit: "Add listing", success: "Your item was added. It is now visible to incoming students.", likeNew: "Like new", good: "Good", used: "Used", clean: "Clean", itemPlaceholder: "e.g. Study chair", pricePlaceholder: "e.g. 20000", pickupPlaceholder: "e.g. KU Main Gate"
    },
    guide: { eyebrow: "LOCAL GUIDE", title: "Feel at home around Anam", body: "A small, practical guide to student-friendly places near KU. Listings are sample data for this demo.", english: "English available", distance: "from KU", tip: "Student tip", all: "All", empty: "No places in this category yet." },
    verify: { title: "Demo student verification", body: "This prototype checks only the KU email format and does not send an email. A live service would require verification through an actual Korea University email.", email: "University email", send: "Verify for demo", success: "You’re verified for this demo", error: "Enter a valid @korea.ac.kr email", student: "Exchange student" },
    setup: { eyebrow: "PERSONALIZE YOUR PLAN", title: "Let’s set up your KU lifecycle plan", body: "Tell us the basics so the arrival and departure housing tasks match your situation. No account is created.", name: "Name", arrival: "Expected arrival date", housing: "Housing type", dorm: "KU dormitory", offCampus: "Off-campus housing", start: "Create my plan", skip: "Skip for demo", namePlaceholder: "Your name" },
    profile: { arrival: "Expected arrival", housing: "Housing", demoArrival: "Demo profile" },
    reset: { button: "Reset demo", title: "Reset this demo?", body: "This clears the saved profile, lifecycle checklist, verification, marketplace listings, search, and filters on this device. Your language stays the same.", confirm: "Reset demo" },
    footer: { notice: "Student-built prototype · Not affiliated with Korea University · Demo data" }
  },
  ko: {
    nav: { home: "홈", onboarding: "라이프사이클", marketplace: "캠퍼스 마켓", guide: "로컬 가이드" },
    common: { complete: "완료", completed: "완료됨", notStarted: "시작 전", inProgress: "진행 중", min: "분", available: "판매 중", reserved: "예약됨", verified: "고려대 학생 인증", close: "닫기", demo: "데모 데이터", cancel: "취소", required: "모든 항목을 입력해 주세요." },
    home: {
      eyebrow: "유학생 라이프사이클 도우미", welcome: "고려대학교에 오신 것을 환영합니다", lead: "입국 준비부터 귀국까지, 나만의 유학생활 계획.",
      body: "고려대학교 생활 동안 무엇을 준비하고, 다음에 무엇을 해야 하며, 어디에서 실행할 수 있는지 한곳에서 확인하세요.", setup: "나의 전체 여정", next: "추천 다음 단계", viewGuide: "추천 작업 보기", viewAll: "전체 계획 열기",
      allCompletedTitle: "모든 정착 작업을 완료했어요", allCompletedBody: "고려대 유학생활 계획을 모두 완료했습니다. 필요할 때 언제든 각 단계를 다시 확인하세요.", reviewTasks: "완료한 작업 다시 보기",
      lifecycle: "입국부터 귀국까지", stageOpen: "단계 열기", cards: ["필요한 정보를 실제 행동으로 연결하세요", "다른 학생에게 필요한 물품을 저렴하게 구매하세요", "고려대 주변 학생 친화적인 장소를 찾아보세요"],
      trust: ["가입 없이 체험", "영어·한국어 지원", "입국 준비부터 귀국까지"]
    },
    onboarding: {
      eyebrow: "정보에서 실행으로", title: "나의 고려대 라이프사이클 계획", body: "입국 전부터 귀국 준비까지 알맞은 순서로 체크리스트를 실행하세요. 진행 상황은 이 기기에 저장됩니다.",
      searchHint: "추천 작업이 현재 선택한 단계에 있으면 강조되어 표시됩니다.", need: "준비할 것", time: "예상 소요시간", tip: "실용 안내", mark: "완료 표시", saved: "진행 상황이 로컬에 저장됩니다",
      overallProgress: "전체 라이프사이클", stageProgress: "선택 단계", tasksComplete: "개 작업 완료", nextRecommendation: "다음 추천 작업", viewNext: "다음 작업 보기", officialGuidance: "공식 안내"
    },
    market: {
      eyebrow: "캠퍼스 중고마켓", title: "누군가의 마지막 학기가 누군가의 새 출발이 됩니다", body: "학생 간 물품 순환을 보여주는 데모입니다. 실제 인증과 거래는 구현되어 있지 않습니다.", incoming: "고려대에 처음 왔어요", leaving: "곧 출국해요", search: "상품 검색", all: "전체", home: "생활", kitchen: "주방", electronics: "전자기기", bedding: "침구", condition: "상태", pickup: "픽업", seller: "판매자", details: "상세 보기", flow: ["데모 인증", "상품 등록", "캠퍼스 픽업", "직거래"], contact: "판매자에게 연락", contactTitle: "판매자에게 연락하기", contactBody: "발표용 데모입니다. 실제 서비스에서는 고려대 학생 전용 보안 채팅으로 메시지가 전송됩니다.", message: "안녕하세요! 아직 판매 중인가요? 캠퍼스 근처에서 픽업할 수 있어요.", copied: "데모 메시지가 준비되었습니다", empty: "검색 조건에 맞는 상품이 없습니다.",
      formTitle: "다음 학생을 위해 물품을 등록하세요", formBody: "기존 아이콘 카드 디자인으로 간단히 등록합니다. 이 데모에서는 이미지가 필요하지 않습니다.", itemName: "상품명", price: "가격", category: "카테고리", pickupLocation: "픽업 장소", availability: "판매 상태", submit: "상품 등록", success: "상품이 등록되었습니다. 입국 학생 화면에서 확인할 수 있습니다.", likeNew: "거의 새 상품", good: "양호", used: "사용감 있음", clean: "세탁 완료", itemPlaceholder: "예: 공부 의자", pricePlaceholder: "예: 20000", pickupPlaceholder: "예: 고려대 정문"
    },
    guide: { eyebrow: "로컬 가이드", title: "안암에서 편안한 일상을 시작하세요", body: "고려대 주변 학생 친화적인 장소를 모은 실용적인 가이드입니다. 모든 업체 정보는 발표용 샘플입니다.", english: "영어 응대 가능", distance: "고려대에서", tip: "학생 팁", all: "전체", empty: "이 카테고리의 장소가 아직 없습니다." },
    verify: { title: "데모 학생 인증", body: "이 프로토타입은 고려대 이메일 형식만 확인하며 실제 이메일을 발송하지 않습니다. 실제 서비스에서는 고려대학교 이메일을 통한 인증이 필요합니다.", email: "학교 이메일", send: "데모 인증하기", success: "데모 학생 인증이 완료되었습니다", error: "올바른 @korea.ac.kr 이메일을 입력하세요", student: "교환학생" },
    setup: { eyebrow: "나만의 계획 설정", title: "고려대 라이프사이클 계획을 설정해 볼까요?", body: "입국과 귀국의 주거 관련 작업이 내 상황에 맞도록 기본 정보를 입력하세요. 별도 계정은 생성되지 않습니다.", name: "이름", arrival: "입국 예정일", housing: "주거 유형", dorm: "고려대 기숙사", offCampus: "교외 거주", start: "나만의 계획 만들기", skip: "데모로 건너뛰기", namePlaceholder: "이름" },
    profile: { arrival: "입국 예정일", housing: "주거 유형", demoArrival: "데모 프로필" },
    reset: { button: "데모 초기화", title: "데모를 초기화할까요?", body: "이 기기에 저장된 프로필, 라이프사이클 체크리스트, 인증, 등록 상품, 검색과 필터가 삭제됩니다. 현재 언어는 유지됩니다.", confirm: "데모 초기화" },
    footer: { notice: "학생 제작 프로토타입 · 고려대학교 공식 서비스가 아닙니다 · 데모 데이터" }
  }
} as const;
