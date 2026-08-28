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
};
export type PlaceCategory = "Food" | "Halal" | "Vegan" | "Hospital" | "Pharmacy" | "Hair Salon" | "Cafe" | "Grocery";
export type Place = { id: number; category: PlaceCategory; nameKey: TranslationKey; descriptionKey: TranslationKey; locationKey: TranslationKey; distanceMeters: number; english: boolean; languageSupportNoteKey?: TranslationKey | null; tipKey: TranslationKey };

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

export const products: MarketProduct[] = [
  { id: 1, nameKey: "marketplace:products.riceCooker.name", priceKrw: 20000, category: "Kitchen", condition: "good", pickupKey: "marketplace:products.riceCooker.pickup", sellerKey: "marketplace:products.riceCooker.seller", status: "Available", icon: "cooking" },
  { id: 2, nameKey: "marketplace:products.deskLamp.name", priceKrw: 8000, category: "Home", condition: "likeNew", pickupKey: "marketplace:products.deskLamp.pickup", sellerKey: "marketplace:products.deskLamp.seller", status: "Available", icon: "lamp" },
  { id: 3, nameKey: "marketplace:products.beddingSet.name", priceKrw: 15000, category: "Bedding", condition: "clean", pickupKey: "marketplace:products.beddingSet.pickup", sellerKey: "marketplace:products.beddingSet.seller", status: "Reserved", icon: "bed" },
  { id: 4, nameKey: "marketplace:products.electricKettle.name", priceKrw: 12000, category: "Kitchen", condition: "good", pickupKey: "marketplace:products.electricKettle.pickup", sellerKey: "marketplace:products.electricKettle.seller", status: "Available", icon: "kettle" },
  { id: 5, nameKey: "marketplace:products.miniFan.name", priceKrw: 7000, category: "Electronics", condition: "good", pickupKey: "marketplace:products.miniFan.pickup", sellerKey: "marketplace:products.miniFan.seller", status: "Available", icon: "fan" },
  { id: 6, nameKey: "marketplace:products.storageBoxes.name", priceKrw: 10000, category: "Home", condition: "used", pickupKey: "marketplace:products.storageBoxes.pickup", sellerKey: "marketplace:products.storageBoxes.seller", status: "Available", icon: "box" }
];

export const places: Place[] = [
  { id: 1, category: "Hospital", nameKey: "localGuide:places.anamClinic.name", descriptionKey: "localGuide:places.anamClinic.description", locationKey: "localGuide:places.anamClinic.location", distanceMeters: 350, english: true, tipKey: "localGuide:places.anamClinic.tip" },
  { id: 2, category: "Pharmacy", nameKey: "localGuide:places.kuPharmacy.name", descriptionKey: "localGuide:places.kuPharmacy.description", locationKey: "localGuide:places.kuPharmacy.location", distanceMeters: 220, english: false, tipKey: "localGuide:places.kuPharmacy.tip" },
  { id: 3, category: "Halal", nameKey: "localGuide:places.seoulKitchen.name", descriptionKey: "localGuide:places.seoulKitchen.description", locationKey: "localGuide:places.seoulKitchen.location", distanceMeters: 480, english: true, tipKey: "localGuide:places.seoulKitchen.tip" },
  { id: 4, category: "Vegan", nameKey: "localGuide:places.greenTable.name", descriptionKey: "localGuide:places.greenTable.description", locationKey: "localGuide:places.greenTable.location", distanceMeters: 620, english: true, tipKey: "localGuide:places.greenTable.tip" },
  { id: 5, category: "Cafe", nameKey: "localGuide:places.studyCafe.name", descriptionKey: "localGuide:places.studyCafe.description", locationKey: "localGuide:places.studyCafe.location", distanceMeters: 180, english: false, tipKey: "localGuide:places.studyCafe.tip" },
  { id: 6, category: "Grocery", nameKey: "localGuide:places.neighborhoodMart.name", descriptionKey: "localGuide:places.neighborhoodMart.description", locationKey: "localGuide:places.neighborhoodMart.location", distanceMeters: 410, english: false, tipKey: "localGuide:places.neighborhoodMart.tip" }
];
