export type Lang = "en" | "ko";

export const copy = {
  en: {
    nav: { home: "Home", onboarding: "Onboarding", marketplace: "Marketplace", guide: "Local Guide" },
    common: { complete: "Complete", completed: "Completed", notStarted: "Not started", inProgress: "In progress", min: "min", available: "Available", reserved: "Reserved", verified: "KU Student Verified", close: "Close", demo: "Demo data", cancel: "Cancel", required: "Please complete every field." },
    home: {
      eyebrow: "YOUR ARRIVAL COMPANION", welcome: "Welcome to Korea University", lead: "Your personalized 60-day settlement plan.",
      body: "Know what to do next, prepare the right documents, and track your progress through your first weeks at Korea University.", setup: "Your KU Setup", next: "Recommended next step", viewGuide: "View recommended task", checklist: "Setup checklist", viewAll: "View all tasks", recent: "Recently completed", upNext: "Up next",
      allCompletedTitle: "All setup tasks completed", allCompletedBody: "You’re ready for your next chapter at Korea University. Review your checklist anytime.", reviewTasks: "Review completed tasks",
      cards: ["Complete your KU setup step by step", "Find affordable items from other students", "Discover student-friendly places near KU"],
      trust: ["No account needed", "Works in EN & KO", "Made for your first 60 days"]
    },
    onboarding: { eyebrow: "STEP-BY-STEP ARRIVAL PLAN", title: "Settle in without the guesswork", body: "Complete the essentials in the right order. Your progress is saved on this device.", searchHint: "Your recommended next task is highlighted below.", need: "What you need", time: "Estimated time", tip: "Student tip", mark: "Mark complete", saved: "Progress saved locally", recommendedTiming: "Recommended timing", applicationLocation: "Application location", officialLink: "Official information link", lastUpdated: "Last updated" },
    market: {
      eyebrow: "CAMPUS MARKETPLACE", title: "One student’s farewell is another’s fresh start", body: "Pick up semester essentials near campus from verified KU students.", incoming: "I’m new to KU", leaving: "I’m leaving KU", search: "Search items", all: "All", home: "Home", kitchen: "Kitchen", electronics: "Electronics", bedding: "Bedding", condition: "Condition", pickup: "Pickup", seller: "Seller", details: "View details", flow: ["Verified student", "Product listing", "Campus pickup", "Direct transaction"], contact: "Contact seller", contactTitle: "Contact the seller", contactBody: "This is a presentation demo. In a live service, your message would be sent through a secure KU-only chat.", message: "Hi! Is this still available? I can pick it up near campus.", copied: "Demo message ready", empty: "No items match your search.",
      formTitle: "List an item for the next student", formBody: "Add a simple listing using the same icon-based cards. No image upload is needed for this demo.", itemName: "Item name", price: "Price", category: "Category", pickupLocation: "Pickup location", availability: "Availability", submit: "Add listing", success: "Your item was added. It is now visible to incoming students.", likeNew: "Like new", good: "Good", used: "Used", clean: "Clean", itemPlaceholder: "e.g. Study chair", pricePlaceholder: "e.g. 20000", pickupPlaceholder: "e.g. KU Main Gate"
    },
    guide: { eyebrow: "LOCAL GUIDE", title: "Feel at home around Anam", body: "A small, practical guide to student-friendly places near KU. Listings are sample data for this demo.", english: "English available", distance: "from KU", tip: "Student tip", all: "All", empty: "No places in this category yet." },
    verify: { title: "Verify your student status", body: "Verify a KU email format for this demo. A live service would require verification through an actual Korea University email.", email: "University email", send: "Verify for demo", success: "You’re verified for this demo", error: "Enter a valid @korea.ac.kr email", student: "Exchange student" },
    setup: { eyebrow: "PERSONALIZE YOUR PLAN", title: "Let’s set up your KU arrival plan", body: "Tell us the basics so your checklist starts with the right housing task. No account is created.", name: "Name", arrival: "Expected arrival date", housing: "Housing type", dorm: "KU dormitory", offCampus: "Off-campus housing", start: "Create my plan", skip: "Skip for demo", namePlaceholder: "Your name" },
    profile: { arrival: "Expected arrival", housing: "Housing", demoArrival: "Demo profile" },
    reset: { button: "Reset demo", title: "Reset this demo?", body: "This clears the saved profile, checklist, verification, marketplace listings, search, and filters on this device. Your language stays the same.", confirm: "Reset demo" },
    footer: { notice: "Student-built prototype · Not affiliated with Korea University · Demo data" }
  },
  ko: {
    nav: { home: "홈", onboarding: "정착 체크리스트", marketplace: "캠퍼스 마켓", guide: "로컬 가이드" },
    common: { complete: "완료", completed: "완료됨", notStarted: "시작 전", inProgress: "진행 중", min: "분", available: "판매 중", reserved: "예약됨", verified: "고려대 학생 인증", close: "닫기", demo: "데모 데이터", cancel: "취소", required: "모든 항목을 입력해 주세요." },
    home: {
      eyebrow: "나만의 입국·정착 도우미", welcome: "고려대학교에 오신 것을 환영합니다", lead: "입국일부터 60일까지, 나만의 정착 계획.",
      body: "지금 해야 할 일과 필요한 준비물을 순서대로 확인하고, 고려대에서의 첫 몇 주 동안 정착 진행 상황을 관리하세요.", setup: "고려대 정착 준비", next: "추천 다음 단계", viewGuide: "추천 작업 보기", checklist: "정착 체크리스트", viewAll: "모든 할 일 보기", recent: "최근 완료", upNext: "다음 할 일",
      allCompletedTitle: "모든 정착 작업을 완료했어요", allCompletedBody: "고려대학교에서의 새로운 시작을 위한 준비가 끝났습니다. 언제든 체크리스트를 다시 확인하세요.", reviewTasks: "완료한 작업 다시 보기",
      cards: ["단계별로 고려대 정착 준비를 완료하세요", "다른 학생에게 필요한 물품을 저렴하게 구매하세요", "고려대 주변 학생 친화적인 장소를 찾아보세요"],
      trust: ["가입 없이 체험", "영어·한국어 지원", "입국 후 첫 60일을 위해 설계"]
    },
    onboarding: { eyebrow: "단계별 정착 플랜", title: "막막함 없이 차근차근 정착하세요", body: "꼭 필요한 일을 알맞은 순서로 완료하세요. 진행 상황은 이 기기에 저장됩니다.", searchHint: "현재 추천하는 다음 작업을 아래에서 강조해 표시합니다.", need: "준비물", time: "예상 소요시간", tip: "학생 팁", mark: "완료 표시", saved: "진행 상황이 로컬에 저장됩니다", recommendedTiming: "권장 시기", applicationLocation: "신청 장소", officialLink: "공식 정보 링크", lastUpdated: "최종 업데이트" },
    market: {
      eyebrow: "캠퍼스 중고마켓", title: "누군가의 마지막 학기가 누군가의 새 출발이 됩니다", body: "인증된 고려대 학생에게 캠퍼스 근처에서 학기 필수품을 구매하세요.", incoming: "고려대에 처음 왔어요", leaving: "곧 출국해요", search: "상품 검색", all: "전체", home: "생활", kitchen: "주방", electronics: "전자기기", bedding: "침구", condition: "상태", pickup: "픽업", seller: "판매자", details: "상세 보기", flow: ["학생 인증", "상품 등록", "캠퍼스 픽업", "직거래"], contact: "판매자에게 연락", contactTitle: "판매자에게 연락하기", contactBody: "발표용 데모입니다. 실제 서비스에서는 고려대 학생 전용 보안 채팅으로 메시지가 전송됩니다.", message: "안녕하세요! 아직 판매 중인가요? 캠퍼스 근처에서 픽업할 수 있어요.", copied: "데모 메시지가 준비되었습니다", empty: "검색 조건에 맞는 상품이 없습니다.",
      formTitle: "다음 학생을 위해 물품을 등록하세요", formBody: "기존 아이콘 카드 디자인으로 간단히 등록합니다. 이 데모에서는 이미지가 필요하지 않습니다.", itemName: "상품명", price: "가격", category: "카테고리", pickupLocation: "픽업 장소", availability: "판매 상태", submit: "상품 등록", success: "상품이 등록되었습니다. 입국 학생 화면에서 확인할 수 있습니다.", likeNew: "거의 새 상품", good: "양호", used: "사용감 있음", clean: "세탁 완료", itemPlaceholder: "예: 공부 의자", pricePlaceholder: "예: 20000", pickupPlaceholder: "예: 고려대 정문"
    },
    guide: { eyebrow: "로컬 가이드", title: "안암에서 편안한 일상을 시작하세요", body: "고려대 주변 학생 친화적인 장소를 모은 실용적인 가이드입니다. 모든 업체 정보는 발표용 샘플입니다.", english: "영어 응대 가능", distance: "고려대에서", tip: "학생 팁", all: "전체", empty: "이 카테고리의 장소가 아직 없습니다." },
    verify: { title: "학생 신분을 인증하세요", body: "이 데모에서는 고려대 이메일 형식만 확인합니다. 실제 서비스에서는 고려대학교 이메일을 통한 실제 인증이 필요합니다.", email: "학교 이메일", send: "데모 인증하기", success: "데모 학생 인증이 완료되었습니다", error: "올바른 @korea.ac.kr 이메일을 입력하세요", student: "교환학생" },
    setup: { eyebrow: "나만의 계획 설정", title: "고려대 입국 계획을 설정해 볼까요?", body: "주거 유형에 맞는 첫 작업으로 체크리스트를 구성합니다. 별도 계정은 생성되지 않습니다.", name: "이름", arrival: "입국 예정일", housing: "주거 유형", dorm: "고려대 기숙사", offCampus: "교외 거주", start: "나만의 계획 만들기", skip: "데모로 건너뛰기", namePlaceholder: "이름" },
    profile: { arrival: "입국 예정일", housing: "주거 유형", demoArrival: "데모 프로필" },
    reset: { button: "데모 초기화", title: "데모를 초기화할까요?", body: "이 기기에 저장된 프로필, 체크리스트, 인증, 등록 상품, 검색과 필터가 삭제됩니다. 현재 언어는 유지됩니다.", confirm: "데모 초기화" },
    footer: { notice: "학생 제작 프로토타입 · 고려대학교 공식 서비스가 아닙니다 · 데모 데이터" }
  }
} as const;
