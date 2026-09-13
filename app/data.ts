export type LifecycleStage = "before-arrival" | "first-weeks" | "campus-life" | "departure";
export type TranslationKey = `${string}:${string}`;
export type TaskAction =
  | { kind: "external"; href: string; actionLabelKey: TranslationKey }
  | { kind: "internal"; target: "guide"; guideCategory: "Hospital" | "Food"; actionLabelKey: TranslationKey }
  | { kind: "internal"; target: "marketplace"; marketMode: "incoming" | "leaving"; actionLabelKey: TranslationKey };
export type Task = {
  id: string;
  stage: LifecycleStage;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  categoryKey: TranslationKey;
  preparationKeys: TranslationKey[];
  estimatedMinutes: readonly [number, number];
  practicalNoteKey: TranslationKey;
  action?: TaskAction;
  officialGuidance?: { messageKey: TranslationKey; href: string; actionLabelKey: TranslationKey };
};
export type ProductCategory = "Home" | "Kitchen" | "Electronics" | "Bedding";
export type ProductIcon = "cooking" | "lamp" | "bed" | "kettle" | "fan" | "box";
export type ProductCondition = "likeNew" | "good" | "used" | "clean";
export type ProductStatus = "Available" | "Reserved";
export type MarketProduct = {
  id: number | string;
  nameKey?: TranslationKey;
  name?: string;
  priceKrw: number;
  category: ProductCategory;
  condition: ProductCondition;
  pickupKey?: TranslationKey;
  pickup?: string;
  sellerKey?: TranslationKey;
  seller?: string;
  status: ProductStatus;
  icon: ProductIcon;
  userCreated?: boolean;
  source?: "sample" | "demo" | "live";
  ownedByCurrentUser?: boolean;
  serviceStatus?: "active" | "sold" | "hidden" | "deleted";
  description?: string;
  imageDataUrl?: string;
  availableHours?: string;
  sellerInquiryDraft?: string;
  reportDraft?: string;
};
export type PlaceCategory = "Food" | "Halal" | "Vegan" | "Hospital" | "Pharmacy" | "Hair Salon" | "Cafe" | "Grocery";
export type CampusScope = "main" | "science" | "shared";
export type HalalStatus = "certified" | "menu-available" | "needs-menu-check" | "visit-check";
export type VeganStatus = "specialist" | "menu-available" | "needs-menu-check" | "visit-check";
export type PlaceOperatingStatus = "active" | "inactive" | "needs_confirmation";
export type PlaceVenueType = "commercial" | "campus-cafeteria" | "campus-anchor";
export type CampusPointType = "gate" | "plaza" | "residence" | "international" | "general";
export type Place = { id: number; category: PlaceCategory; nameKey: TranslationKey; descriptionKey: TranslationKey; locationKey: TranslationKey; distanceMeters: number; english: boolean; languageSupportNoteKey?: TranslationKey | null; tipKey: TranslationKey; localizedName?: Partial<Record<"en" | "ko" | "ja" | "zh-CN", string>>; displayName?: string; displayDescription?: string; displayLocation?: string; address?: string; phone?: string; hours?: string; closedDays?: string; officialUrl?: string; mapUrl?: string; sourceName?: string; lastVerifiedAt?: string; verificationStatus?: VerificationStatus; languageSupport?: "confirmed" | "ask_provider" | "unknown"; source?: "kakao" | "official" | "demo" | "custom"; kakaoPlaceId?: string; coordinates?: { lat: number; lng: number }; kakaoCategoryCode?: string; kakaoCategoryName?: string; kakaoCategoryGroupName?: string; kakaoPlaceUrl?: string; dataFetchedAt?: string; kind?: "place" | "campus"; venueType?: PlaceVenueType; campusPointType?: CampusPointType; campusScope?: CampusScope; halalStatus?: HalalStatus; veganStatus?: VeganStatus; operatingStatus?: PlaceOperatingStatus; usageConditions?: string; visitBeforeConfirm?: boolean };
export type LifeGuideCategory = "housing" | "arrival" | "immigration" | "mobile-banking" | "academic" | "healthcare" | "daily" | "departure";
export type VerificationStatus = "official" | "verified" | "needs_confirmation" | "demo";
export type GuideLocaleCopy = { title: string; summary: string; content: string; checklist?: string[]; steps?: string[]; cautions?: string[] };
export type LifeGuideArticle = { id: string; category: LifeGuideCategory; title: string; summary: string; content: string; checklist: string[]; steps?: string[]; cautions?: string[]; appliesTo?: string; contact?: string; completionCriteria?: string; estimatedMinutes?: readonly [number, number]; universityId?: string; officialUrl?: string; officialUrls?: Partial<Record<"en" | "ko" | "ja" | "zh-CN", string>>; sourceName?: string; lastVerifiedAt?: string; contentCheckedAt?: string; contentOrigin?: "official-guide" | "demo"; sourceStatus?: "verified" | "needs_confirmation" | "unavailable"; verificationStatus: VerificationStatus; relatedTaskIds: string[]; locales: Partial<Record<"en" | "ko" | "ja" | "zh-CN", GuideLocaleCopy>> };
export const lifeGuideCategories: LifeGuideCategory[] = ["housing", "arrival", "immigration", "mobile-banking", "academic", "healthcare", "daily", "departure"];
export const lifeGuideArticles: LifeGuideArticle[] = [
  { id: "ku-dorm-guide", category: "housing", title: "Check KU’s official housing guidance", summary: "Use the university’s official housing pages to confirm eligibility, dates, and required steps.", content: "Before making housing decisions, open the official Korea University housing or international student guidance and confirm the current instructions for your program.", checklist: ["Confirm the page applies to your program", "Check the current notice and required documents", "Save the official page for later reference"], officialUrl: "https://dorm.korea.ac.kr/", sourceName: "Korea University Dormitory", lastVerifiedAt: "2026-08-29", verificationStatus: "official", relatedTaskIds: ["housing-reserve", "dorm"], locales: { ko: { title: "고려대학교 공식 기숙사 안내 확인", summary: "학교 공식 기숙사 페이지에서 대상, 일정, 준비 서류를 확인하세요.", content: "주거를 결정하기 전에 본인의 과정에 맞는 고려대학교 공식 기숙사 안내와 최신 공지를 확인하세요." }, ja: { title: "高麗大学の公式寮案内を確認する", summary: "大学公式の寮案内で対象、日程、必要書類を確認します。", content: "住居を決める前に、自分のプログラムに適用される公式案内と最新のお知らせを確認してください。" }, "zh-CN": { title: "确认高丽大学官方宿舍指南", summary: "通过学校官方宿舍页面确认对象、日期和所需材料。", content: "决定住宿前，请确认适用于自己项目的官方指南和最新通知。" } } },
  { id: "hikorea-residence", category: "immigration", title: "Find official residence information", summary: "Use HiKorea to check the current official guidance for foreign residents.", content: "Residence and immigration requirements can depend on your status. Use the official HiKorea service and follow the instructions that apply to you.", checklist: ["Check your current status", "Use only the official notice", "Ask the responsible office when the notice is unclear"], officialUrl: "https://www.hikorea.go.kr/", sourceName: "HiKorea", lastVerifiedAt: "2026-08-29", verificationStatus: "official", relatedTaskIds: ["arc"], locales: { ko: { title: "체류 관련 공식 정보 확인 방법", summary: "외국인 체류 관련 최신 공식 안내는 하이코리아에서 확인하세요.", content: "체류 및 출입국 요건은 체류 자격에 따라 달라질 수 있습니다. 공식 하이코리아에서 본인에게 적용되는 안내를 확인하세요." }, ja: { title: "在留に関する公式情報を確認する", summary: "外国人の在留情報はHiKoreaの公式案内で確認します。", content: "要件は在留資格により異なる場合があります。公式の案内で自分に適用される情報を確認してください。" }, "zh-CN": { title: "确认外国人居留官方信息", summary: "通过HiKorea官方指南确认外国人居留信息。", content: "要求可能因居留身份而异，请在官方HiKorea上确认适用于自己的信息。" } } },
  { id: "transit-card-basics", category: "arrival", title: "Learn public transport and transit cards", summary: "Check official transport operators for current fares, routes, and card guidance.", content: "For current routes, fares, and payment options, use the official transport operator information before travelling.", checklist: ["Check the route on the official operator site", "Confirm the fare and payment method", "Allow extra time for transfers"], officialUrl: "https://english.seoul.go.kr/", sourceName: "Seoul Metropolitan Government", lastVerifiedAt: "2026-08-29", verificationStatus: "official", relatedTaskIds: ["airport-route", "arrival-essentials"], locales: { ko: { title: "대중교통과 교통카드 기본 안내", summary: "현재 요금과 노선은 공식 교통기관에서 확인하세요.", content: "이동 전 공식 교통기관 안내에서 노선, 요금, 결제 방법을 확인하세요." }, ja: { title: "韓国の公共交通と交通カード", summary: "最新の運賃や路線は公式交通機関で確認します。", content: "移動前に公式情報で路線、運賃、支払い方法を確認してください。" }, "zh-CN": { title: "韩国公共交通与交通卡基础指南", summary: "通过官方交通机构确认当前票价和路线。", content: "出行前请在官方交通信息中确认路线、票价和支付方式。" } } }
];

export const lifecycleStages: { id: LifecycleStage; labelKey: TranslationKey; number: string }[] = [
  { id: "before-arrival", labelKey: "onboarding:stages.beforeArrival", number: "01" },
  { id: "first-weeks", labelKey: "onboarding:stages.firstWeeks", number: "02" },
  { id: "campus-life", labelKey: "onboarding:stages.campusLife", number: "03" },
  { id: "departure", labelKey: "onboarding:stages.departure", number: "04" }
];

const task = (id: string, stage: LifecycleStage, preparationCount: number, estimatedMinutes: readonly [number, number], action?: TaskAction, officialGuidance?: Task["officialGuidance"]): Task => ({
  id,
  stage,
  titleKey: `onboarding:tasks.${id}.title`,
  descriptionKey: `onboarding:tasks.${id}.description`,
  categoryKey: `onboarding:tasks.${id}.category`,
  preparationKeys: Array.from({ length: preparationCount }, (_, index) => `onboarding:tasks.${id}.preparation.${index}` as TranslationKey),
  estimatedMinutes,
  practicalNoteKey: `onboarding:tasks.${id}.practicalNote`,
  action,
  officialGuidance
});

export const tasks: Task[] = [
  task("housing-reserve", "before-arrival", 2, [15, 30]),
  task("sim-compare", "before-arrival", 2, [10, 20]),
  task("airport-route", "before-arrival", 2, [15, 25]),
  task("arrival-essentials", "before-arrival", 3, [20, 40]),
  task("dorm", "first-weeks", 2, [20, 30]),
  task("residence", "first-weeks", 2, [10, 15]),
  task("arc", "first-weeks", 2, [30, 60], { kind: "external", href: "https://www.hikorea.go.kr/", actionLabelKey: "onboarding:actions.openOfficial" }, { messageKey: "onboarding:official.arc.message", href: "https://www.hikorea.go.kr/", actionLabelKey: "onboarding:official.arc.link" }),
  task("bank", "first-weeks", 2, [40, 60]),
  task("sim", "first-weeks", 2, [20, 40]),
  task("account", "first-weeks", 2, [10, 15], { kind: "external", href: "https://ic.korea.ac.kr/ic/about/account.do", actionLabelKey: "onboarding:actions.openOfficial" }),
  task("courses", "first-weeks", 2, [20, 30], { kind: "external", href: "https://portal.korea.ac.kr/p/PR/", actionLabelKey: "onboarding:actions.openPortal" }),
  task("healthcare", "campus-life", 2, [10, 15], { kind: "internal", target: "guide", guideCategory: "Hospital", actionLabelKey: "localGuide:actions.view" }),
  task("campus-dining", "campus-life", 2, [10, 15], { kind: "internal", target: "guide", guideCategory: "Food", actionLabelKey: "localGuide:actions.view" }),
  task("household-essentials", "campus-life", 2, [10, 20], { kind: "internal", target: "marketplace", marketMode: "incoming", actionLabelKey: "marketplace:actions.browse" }),
  task("student-marketplace", "campus-life", 2, [10, 15], { kind: "internal", target: "marketplace", marketMode: "incoming", actionLabelKey: "marketplace:actions.browse" }),
  task("sell-items", "departure", 2, [15, 25], { kind: "internal", target: "marketplace", marketMode: "leaving", actionLabelKey: "marketplace:actions.list" }),
  task("luggage", "departure", 2, [15, 30]),
  task("departure-checklist", "departure", 3, [20, 30]),
  task("dorm-checkout", "departure", 2, [20, 30]),
  task("move-out", "departure", 2, [20, 30])
];

const sampleProducts: MarketProduct[] = [
  { id: 1, nameKey: "marketplace:products.riceCooker.name", priceKrw: 20000, category: "Kitchen", condition: "good", pickupKey: "marketplace:products.riceCooker.pickup", sellerKey: "marketplace:products.riceCooker.seller", status: "Available", icon: "cooking" },
  { id: 2, nameKey: "marketplace:products.deskLamp.name", priceKrw: 8000, category: "Home", condition: "likeNew", pickupKey: "marketplace:products.deskLamp.pickup", sellerKey: "marketplace:products.deskLamp.seller", status: "Available", icon: "lamp" },
  { id: 3, nameKey: "marketplace:products.beddingSet.name", priceKrw: 15000, category: "Bedding", condition: "clean", pickupKey: "marketplace:products.beddingSet.pickup", sellerKey: "marketplace:products.beddingSet.seller", status: "Reserved", icon: "bed" },
  { id: 4, nameKey: "marketplace:products.electricKettle.name", priceKrw: 12000, category: "Kitchen", condition: "good", pickupKey: "marketplace:products.electricKettle.pickup", sellerKey: "marketplace:products.electricKettle.seller", status: "Available", icon: "kettle" },
  { id: 5, nameKey: "marketplace:products.miniFan.name", priceKrw: 7000, category: "Electronics", condition: "good", pickupKey: "marketplace:products.miniFan.pickup", sellerKey: "marketplace:products.miniFan.seller", status: "Available", icon: "fan" },
  { id: 6, nameKey: "marketplace:products.storageBoxes.name", priceKrw: 10000, category: "Home", condition: "used", pickupKey: "marketplace:products.storageBoxes.pickup", sellerKey: "marketplace:products.storageBoxes.seller", status: "Available", icon: "box" }
];
export const products: MarketProduct[] = sampleProducts.map((product) => ({ ...product, source: "sample" }));

export const places: Place[] = [
  { id: 1, category: "Hospital", nameKey: "localGuide:places.anamClinic.name", descriptionKey: "localGuide:places.anamClinic.description", locationKey: "localGuide:places.anamClinic.location", distanceMeters: 350, english: true, tipKey: "localGuide:places.anamClinic.tip", localizedName: { ko: "고려대학교 안암병원", en: "Korea University Anam Hospital", ja: "高麗大学安岩病院", "zh-CN": "高丽大学安岩医院" }, address: "서울특별시 성북구 고려대로 73", phone: "1577-0083", officialUrl: "https://anam.kumc.or.kr/", sourceName: "고려대학교 공식 안내", lastVerifiedAt: "2026-08-29", verificationStatus: "official", languageSupport: "unknown", coordinates: { lat: 37.5867, lng: 127.0264 }, campusScope: "main" },
  { id: 9101, category: "Halal", venueType: "campus-cafeteria", campusScope: "main", nameKey: "localGuide:places.anamClinic.name", descriptionKey: "localGuide:places.anamClinic.description", locationKey: "localGuide:places.anamClinic.location", distanceMeters: 0, english: false, tipKey: "localGuide:places.anamClinic.tip", displayName: "애기능생활관 2층 학생식당", localizedName: { ko: "애기능생활관 2층 학생식당", en: "Aegineung Cafeteria (2F)", ja: "エギヌン生活館2階学生食堂", "zh-CN": "爱妓陵生活馆2层学生食堂" }, displayDescription: "요일별로 다른 할랄 메뉴를 제공하는 교내 식당입니다.", displayLocation: "고려대학교 안암캠퍼스", source: "official", sourceName: "고려대학교 지속가능원", officialUrl: "https://sustainability.korea.ac.kr/campus/health_view.html?no=5&page=1", lastVerifiedAt: "2026-08-30", verificationStatus: "official", halalStatus: "menu-available", operatingStatus: "needs_confirmation", usageConditions: "요일별 메뉴와 운영 여부는 방문 전 확인하세요.", visitBeforeConfirm: true },
  { id: 9102, category: "Vegan", venueType: "campus-cafeteria", campusScope: "main", nameKey: "localGuide:places.anamClinic.name", descriptionKey: "localGuide:places.anamClinic.description", locationKey: "localGuide:places.anamClinic.location", distanceMeters: 0, english: false, tipKey: "localGuide:places.anamClinic.tip", displayName: "안암학사 구내식당", localizedName: { ko: "안암학사 구내식당", en: "KU Anam Dormitory Cafeteria", ja: "高麗大学安岩寮食堂", "zh-CN": "高丽大学安岩宿舍食堂" }, displayDescription: "주 1~2회 비건 식단을 제공한다고 안내된 교내 식당입니다.", displayLocation: "서울특별시 성북구 안암로 145", address: "서울특별시 성북구 안암로 145", source: "official", sourceName: "고려대학교 지속가능원·안암학사", officialUrl: "https://dorm.korea.ac.kr/", lastVerifiedAt: "2026-08-30", verificationStatus: "official", veganStatus: "menu-available", operatingStatus: "needs_confirmation", usageConditions: "비건 식단 제공 요일과 이용 대상은 최신 공지를 확인하세요.", visitBeforeConfirm: true },
  { id: 9103, category: "Halal", venueType: "commercial", campusScope: "main", nameKey: "localGuide:places.anamClinic.name", descriptionKey: "localGuide:places.anamClinic.description", locationKey: "localGuide:places.anamClinic.location", distanceMeters: 350, english: false, tipKey: "localGuide:places.anamClinic.tip", displayName: "고려대학교 안암병원 할랄식 안내", localizedName: { ko: "고려대학교 안암병원 할랄식 안내", en: "KU Anam Hospital Halal Meal Information", ja: "高麗大学安岩病院ハラール食案内", "zh-CN": "高丽大学安岩医院清真餐信息" }, displayDescription: "이슬람 환자를 위한 할랄식 제공 안내입니다.", displayLocation: "서울특별시 성북구 고려대로 73", address: "서울특별시 성북구 고려대로 73", phone: "1577-0083", source: "official", sourceName: "고려대학교 지속가능원·고려대학교 안암병원", officialUrl: "https://sustainability.korea.ac.kr/campus/health2.html?page=1", lastVerifiedAt: "2026-08-30", verificationStatus: "official", halalStatus: "menu-available", operatingStatus: "needs_confirmation", usageConditions: "환자 식사 적용 여부와 제공 조건은 병원에 확인하세요.", visitBeforeConfirm: true },
  { id: 9104, category: "Vegan", venueType: "commercial", campusScope: "main", nameKey: "localGuide:places.anamClinic.name", descriptionKey: "localGuide:places.anamClinic.description", locationKey: "localGuide:places.anamClinic.location", distanceMeters: 0, english: false, tipKey: "localGuide:places.anamClinic.tip", displayName: "소바공방 더큰도시락 고려대점", localizedName: { ko: "소바공방 더큰도시락 고려대점", en: "Soba Gongbang Deokeun Dosirak KU", ja: "そば工房トクン弁当 高麗大店", "zh-CN": "Soba Gongbang Deokeun Dosirak 高丽大学店" }, displayDescription: "공개 메뉴에 비건 표기 메뉴가 있는 일반 음식점입니다.", displayLocation: "서울특별시 성북구 안암로 145 고려대학교 안암캠퍼스 타이거프라자 지하1층", address: "서울특별시 성북구 안암로 145 고려대학교 안암캠퍼스 타이거프라자 지하1층", phone: "02-928-3038", hours: "10:30-20:00 (주말 11:00-17:00, 공개 페이지 기준)", source: "custom", sourceName: "DiningCode 공개 메뉴 정보", officialUrl: "https://www.diningcode.com/profile.php?rid=odz4W6XsKJic", lastVerifiedAt: "2026-08-30", verificationStatus: "verified", veganStatus: "needs-menu-check", operatingStatus: "needs_confirmation", usageConditions: "비건 메뉴의 재료와 조리 환경은 주문 전 매장에 확인하세요.", visitBeforeConfirm: true },
  { id: 9001, kind: "campus", venueType: "campus-anchor", campusPointType: "general", campusScope: "main", category: "Food", nameKey: "localGuide:places.anamClinic.name", descriptionKey: "localGuide:places.anamClinic.description", locationKey: "localGuide:places.anamClinic.location", distanceMeters: 0, english: true, tipKey: "localGuide:places.anamClinic.tip", displayName: "안암캠퍼스", localizedName: { ko: "안암캠퍼스", en: "Anam Campus", ja: "安岩キャンパス", "zh-CN": "安岩校区" }, displayDescription: "고려대학교 안암캠퍼스 기준점", displayLocation: "서울 성북구 안암동", address: "서울 성북구 안암동", sourceName: "고려대학교 캠퍼스 안내", officialUrl: "https://www.korea.ac.kr/", lastVerifiedAt: "2026-08-29", verificationStatus: "official", coordinates: { lat: 37.5896, lng: 127.0325 } },
  { id: 9002, kind: "campus", venueType: "campus-anchor", campusPointType: "general", campusScope: "science", category: "Food", nameKey: "localGuide:places.anamClinic.name", descriptionKey: "localGuide:places.anamClinic.description", locationKey: "localGuide:places.anamClinic.location", distanceMeters: 0, english: true, tipKey: "localGuide:places.anamClinic.tip", displayName: "이공계 캠퍼스", localizedName: { ko: "이공계 캠퍼스", en: "Science & Engineering Campus", ja: "理工系キャンパス", "zh-CN": "理工科校区" }, displayDescription: "고려대학교 이공계 캠퍼스 기준점", displayLocation: "서울 성북구 안암로 145", address: "서울 성북구 안암로 145", sourceName: "고려대학교 공식 학과 안내", officialUrl: "https://cs.korea.ac.kr/tem_i/about/location.do", lastVerifiedAt: "2026-08-29", verificationStatus: "official", coordinates: { lat: 37.5909, lng: 127.0338 } },
  { id: 9003, kind: "campus", venueType: "campus-anchor", campusPointType: "gate", campusScope: "main", category: "Food", nameKey: "localGuide:places.anamClinic.name", descriptionKey: "localGuide:places.anamClinic.description", locationKey: "localGuide:places.anamClinic.location", distanceMeters: 420, english: true, tipKey: "localGuide:places.anamClinic.tip", displayName: "고려대 정문", localizedName: { ko: "고려대 정문", en: "KU Main Gate", ja: "高麗大正門", "zh-CN": "高丽大学正门" }, displayLocation: "고려대학교 정문", address: "서울 성북구 고려대로 24", sourceName: "고려대학교 캠퍼스 안내", verificationStatus: "needs_confirmation", coordinates: { lat: 37.5886, lng: 127.0329 } },
  { id: 9004, kind: "campus", venueType: "campus-anchor", campusPointType: "plaza", campusScope: "shared", category: "Food", nameKey: "localGuide:places.anamClinic.name", descriptionKey: "localGuide:places.anamClinic.description", locationKey: "localGuide:places.anamClinic.location", distanceMeters: 520, english: true, tipKey: "localGuide:places.anamClinic.tip", displayName: "중앙광장", localizedName: { ko: "중앙광장", en: "Central Plaza", ja: "中央広場", "zh-CN": "中央广场" }, displayLocation: "고려대학교 중앙광장", address: "서울 성북구 안암로 145", sourceName: "고려대학교 캠퍼스 안내", verificationStatus: "needs_confirmation", coordinates: { lat: 37.5893, lng: 127.0309 } },
  { id: 9005, kind: "campus", venueType: "campus-anchor", campusPointType: "residence", campusScope: "main", category: "Food", nameKey: "localGuide:places.anamClinic.name", descriptionKey: "localGuide:places.anamClinic.description", locationKey: "localGuide:places.anamClinic.location", distanceMeters: 820, english: true, tipKey: "localGuide:places.anamClinic.tip", displayName: "고려대 기숙사", localizedName: { ko: "고려대 기숙사", en: "KU Residence Halls", ja: "高麗大寮", "zh-CN": "高丽大学宿舍" }, displayLocation: "고려대학교 기숙사", address: "서울 성북구 안암로 145", sourceName: "고려대학교 캠퍼스 안내", verificationStatus: "needs_confirmation", coordinates: { lat: 37.5918, lng: 127.0304 } },
  { id: 9006, kind: "campus", venueType: "campus-anchor", campusPointType: "international", campusScope: "shared", category: "Food", nameKey: "localGuide:places.anamClinic.name", descriptionKey: "localGuide:places.anamClinic.description", locationKey: "localGuide:places.anamClinic.location", distanceMeters: 650, english: true, tipKey: "localGuide:places.anamClinic.tip", displayName: "국제관", localizedName: { ko: "국제관", en: "International Studies Hall", ja: "国際館", "zh-CN": "国际馆" }, displayLocation: "고려대학교 국제관", address: "서울 성북구 안암로 145", sourceName: "고려대학교 캠퍼스 안내", verificationStatus: "needs_confirmation", coordinates: { lat: 37.5901, lng: 127.0317 } }
];
