import translations from "./legacy-copy.json";
import type { Locale } from "./types";

type TranslationRow = Record<string, string>;
const rows = translations as Record<string, TranslationRow>;
const fragments = Object.keys(rows).filter((value) => value.trim()).sort((left, right) => right.length - left.length);

const publicCopyReplacements: Array<[string, string]> = [
  ["Skip for demo", "Set up later"],
  ["데모로 건너뛰기", "나중에 설정"],
  ["デモでスキップ", "あとで設定"],
  ["使用演示资料跳过", "稍后设置"],
  ["Namoyish uchun oʻtkazib yuboring", "Keyinroq sozlash"],
  ["Bỏ qua để xem bản demo", "Thiết lập sau"],
  ["Демо руу алгасах", "Дараа тохируулах"],
  ["Langkau untuk demo", "Sediakan kemudian"],
  ["No image upload is needed for this demo.", "Add an image to help buyers understand the item's condition."],
  ["このデモでは画像のアップロードは不要です。", "画像を追加すると商品の状態を確認しやすくなります。"],
  ["本演示不需要上传图片。", "添加图片可以帮助买家了解商品状态。"],
  ["Demo verification", "Anonymous session"],
  ["데모 인증", "익명 세션"],
  ["Demo mode", "Use without sign-in"],
  ["데모 모드", "로그인 없이 이용"],
  ["Demo message", "Message draft"],
  ["데모 메시지", "메시지 초안"],
  ["Showing demo places", "Showing internal verification places"],
  ["데모 장소", "내부 검증 장소"],
  ["Demo data", "Sample data"],
  ["데모 데이터", "샘플 데이터"],
];

const localePublicCopyReplacements: Partial<Record<Locale, Array<[string, string]>>> = {
  en: [["Demo", "Sample"], ["demo", "sample"], ["prototype", "current service"]],
  ko: [["데모", "샘플"], ["프로토타입", "현재 서비스"]],
  ja: [["デモ", "サンプル"], ["プロトタイプ", "現在のサービス"]],
  "zh-CN": [["演示", "示例"], ["原型", "当前服务"]],
  uz: [["Namoyish", "Namuna"], ["namoyish", "namuna"], ["Demo", "Namuna"], ["demo", "namuna"]],
  vi: [["Bản demo", "Bản mẫu"], ["bản demo", "mẫu"], ["Demo", "Mẫu"], ["demo", "mẫu"], ["nguyên mẫu", "dịch vụ hiện tại"]],
  mn: [["Демо", "Жишээ"], ["демо", "жишээ"], ["прототип", "одоогийн үйлчилгээ"]],
  ms: [["Demo", "Contoh"], ["demo", "contoh"], ["prototaip", "perkhidmatan semasa"]],
};

export function normalizePublicCopy(value: string, locale?: Locale): string {
  const common = publicCopyReplacements.reduce((current, [from, to]) => current.replaceAll(from, to), value);
  return (localePublicCopyReplacements[locale ?? "en"] ?? []).reduce((current, [from, to]) => current.replaceAll(from, to), common);
}

function translateString(locale: Locale, value: string): string {
  if (locale === "en") return normalizePublicCopy(value, locale);
  const exact = rows[value]?.[locale];
  if (exact) return normalizePublicCopy(exact, locale);
  let output = value;
  for (const source of fragments) {
    const translated = rows[source]?.[locale];
    if (translated && output.includes(source)) output = output.replaceAll(source, translated);
  }
  return normalizePublicCopy(output, locale);
}

export function legacyCopy<T>(locale: Locale, value: T): T {
  if (typeof value === "string") return translateString(locale, value) as T;
  if (Array.isArray(value)) return value.map((item) => legacyCopy(locale, item)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, legacyCopy(locale, item)])) as T;
  return value;
}
