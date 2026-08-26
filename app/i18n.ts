export type Lang = "en" | "ko";

export const copy = {
  en: {
    nav: { home: "Home", onboarding: "Onboarding", marketplace: "Marketplace", guide: "Local Guide" },
    common: { complete: "Complete", completed: "Completed", notStarted: "Not started", inProgress: "In progress", min: "min", available: "Available", reserved: "Reserved", verified: "KU Student Verified", close: "Close", demo: "Demo data" },
    home: {
      eyebrow: "YOUR ARRIVAL COMPANION", welcome: "Welcome to Korea University, Alex", lead: "Everything you need to settle into KU.",
      body: "A clear, step-by-step home for the paperwork, campus essentials, and local places that make your first weeks in Seoul easier.", setup: "Your KU Setup", next: "Recommended next step", arcTitle: "Apply for your ARC", arcBody: "You’ll need your ARC to open a bank account and use several services in Korea.", viewGuide: "View guide", checklist: "Setup checklist", viewAll: "View all tasks",
      cards: ["Complete your KU setup step by step", "Find affordable items from other students", "Discover student-friendly places near KU"],
      trust: ["No account needed", "Works in EN & KO", "Made for your first 60 days"]
    },
    onboarding: { eyebrow: "STEP-BY-STEP ARRIVAL PLAN", title: "Settle in without the guesswork", body: "Complete the essentials in the right order. Your progress is saved on this device.", searchHint: "Start with the recommended ARC task below.", need: "What you need", time: "Estimated time", tip: "Student tip", mark: "Mark complete", saved: "Progress saved locally" },
    market: { eyebrow: "CAMPUS MARKETPLACE", title: "One student’s farewell is another’s fresh start", body: "Pick up semester essentials near campus from verified KU students.", incoming: "I’m new to KU", leaving: "I’m leaving KU", search: "Search items", all: "All", home: "Home", kitchen: "Kitchen", electronics: "Electronics", bedding: "Bedding", condition: "Condition", pickup: "Pickup", seller: "Seller", details: "View details", flow: ["Verified student", "Product listing", "Campus pickup", "Direct transaction"], contact: "Contact seller", contactTitle: "Contact the seller", contactBody: "This is a presentation demo. In a live service, your message would be sent through a secure KU-only chat.", message: "Hi! Is this still available? I can pick it up near campus.", copied: "Demo message ready", empty: "No items match your search." },
    guide: { eyebrow: "LOCAL GUIDE", title: "Feel at home around Anam", body: "A small, practical guide to student-friendly places near KU. Listings are sample data for this demo.", english: "English available", distance: "from KU", tip: "Student tip", all: "All", empty: "No places in this category yet." },
    verify: { title: "Verify your student status", body: "Use your KU email to unlock a verified badge for safer campus exchanges.", email: "University email", send: "Send verification", success: "You’re verified for this demo", error: "Enter a valid @korea.ac.kr email", profile: "Alex Kim", student: "Exchange student" }
  },
  ko: {
    nav: { home: "홈", onboarding: "정착 체크리스트", marketplace: "캠퍼스 마켓", guide: "로컬 가이드" },
    common: { complete: "완료", completed: "완료됨", notStarted: "시작 전", inProgress: "진행 중", min: "분", available: "판매 중", reserved: "예약됨", verified: "고려대 학생 인증", close: "닫기", demo: "데모 데이터" },
    home: {
      eyebrow: "나만의 입국·정착 도우미", welcome: "고려대학교에 오신 것을 환영합니다, Alex", lead: "고려대 정착에 필요한 모든 것을 한곳에서.",
      body: "행정 절차부터 캠퍼스 필수품, 주변 생활 정보까지 서울에서의 첫 몇 주를 더 쉽게 만드는 단계별 가이드입니다.", setup: "고려대 정착 준비", next: "추천 다음 단계", arcTitle: "외국인등록증을 신청하세요", arcBody: "은행 계좌 개설과 한국 생활의 여러 서비스를 이용하려면 외국인등록증이 필요합니다.", viewGuide: "가이드 보기", checklist: "정착 체크리스트", viewAll: "모든 할 일 보기",
      cards: ["단계별로 고려대 정착 준비를 완료하세요", "다른 학생에게 필요한 물품을 저렴하게 구매하세요", "고려대 주변 학생 친화적인 장소를 찾아보세요"],
      trust: ["가입 없이 체험", "영어·한국어 지원", "입국 후 첫 60일을 위해 설계"]
    },
    onboarding: { eyebrow: "단계별 정착 플랜", title: "막막함 없이 차근차근 정착하세요", body: "꼭 필요한 일을 알맞은 순서로 완료하세요. 진행 상황은 이 기기에 저장됩니다.", searchHint: "아래 추천 외국인등록증 항목부터 시작해 보세요.", need: "준비물", time: "예상 소요시간", tip: "학생 팁", mark: "완료 표시", saved: "진행 상황이 로컬에 저장됩니다" },
    market: { eyebrow: "캠퍼스 중고마켓", title: "누군가의 마지막 학기가 누군가의 새 출발이 됩니다", body: "인증된 고려대 학생에게 캠퍼스 근처에서 학기 필수품을 구매하세요.", incoming: "고려대에 처음 왔어요", leaving: "곧 출국해요", search: "상품 검색", all: "전체", home: "생활", kitchen: "주방", electronics: "전자기기", bedding: "침구", condition: "상태", pickup: "픽업", seller: "판매자", details: "상세 보기", flow: ["학생 인증", "상품 등록", "캠퍼스 픽업", "직거래"], contact: "판매자에게 연락", contactTitle: "판매자에게 연락하기", contactBody: "발표용 데모입니다. 실제 서비스에서는 고려대 학생 전용 보안 채팅으로 메시지가 전송됩니다.", message: "안녕하세요! 아직 판매 중인가요? 캠퍼스 근처에서 픽업할 수 있어요.", copied: "데모 메시지가 준비되었습니다", empty: "검색 조건에 맞는 상품이 없습니다." },
    guide: { eyebrow: "로컬 가이드", title: "안암에서 편안한 일상을 시작하세요", body: "고려대 주변 학생 친화적인 장소를 모은 실용적인 가이드입니다. 모든 업체 정보는 발표용 샘플입니다.", english: "영어 응대 가능", distance: "고려대에서", tip: "학생 팁", all: "전체", empty: "이 카테고리의 장소가 아직 없습니다." },
    verify: { title: "학생 신분을 인증하세요", body: "고려대 이메일로 인증 배지를 받아 더 안전하게 캠퍼스 거래를 이용하세요.", email: "학교 이메일", send: "인증 메일 보내기", success: "데모 학생 인증이 완료되었습니다", error: "올바른 @korea.ac.kr 이메일을 입력하세요", profile: "Alex Kim", student: "교환학생" }
  }
} as const;
