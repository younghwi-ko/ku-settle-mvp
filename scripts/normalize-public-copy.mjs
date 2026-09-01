import { readFile, writeFile } from "node:fs/promises";

const pagePath = new URL("../app/page.tsx", import.meta.url);
let page = await readFile(pagePath, "utf8");
const sourceReplacements = [
  ["Kakao API 키가 설정되지 않아 데모 장소를 표시합니다.", "Kakao API 키가 설정되지 않아 내부 검증 장소를 표시합니다."],
  ["이번 달 무료 Kakao 호출 한도에 도달해 데모 장소를 표시합니다.", "이번 달 무료 Kakao 호출 한도에 도달해 내부 검증 장소를 표시합니다."],
  ["Kakao 장소 검색에 실패했습니다. 데모 장소를 표시합니다.", "Kakao 장소 검색에 실패했습니다. 내부 검증 장소를 표시합니다."],
  ["今月のKakao無料呼び出し上限に達したため、デモ地点を表示しています.", "今月のKakao無料呼び出し上限に達したため、内部確認済みの地点を表示しています。"],
  ["已达到本月 Kakao 免费调用上限，正在显示演示地点。", "已达到本月 Kakao 免费调用上限，正在显示内部核验地点。"],
  ["Kakao API key is not configured. Showing demo places.", "Kakao API key is not configured. Showing internal verification places."],
  ["The monthly free Kakao call limit was reached. Showing demo places.", "The monthly free Kakao call limit was reached. Showing internal verification places."],
  ["Kakao place search failed. Showing demo places.", "Kakao place search failed. Showing internal verification places."],
  ['locale === "ko" ? "데모 정보" : locale === "ja" ? "デモ情報" : locale === "zh-CN" ? "演示信息" : legacyCopy(locale, "Demo information")', 'locale === "ko" ? "샘플 정보" : locale === "ja" ? "サンプル情報" : locale === "zh-CN" ? "示例信息" : legacyCopy(locale, "Sample information")'],
];
for (const [from, to] of sourceReplacements) page = page.replaceAll(from, to);
await writeFile(pagePath, page, "utf8");

const skipLabels = {
  en: ["Skip for demo", "Set up later"],
  ko: ["데모로 건너뛰기", "나중에 설정"],
  ja: ["デモでスキップ", "あとで設定"],
  "zh-CN": ["使用演示资料跳过", "稍后设置"],
  uz: ["Namoyish uchun oʻtkazib yuboring", "Keyinroq sozlash"],
  vi: ["Bỏ qua để xem bản demo", "Thiết lập sau"],
  mn: ["Демо руу алгасах", "Дараа тохируулах"],
  ms: ["Langkau untuk demo", "Sediakan kemudian"],
};
for (const [locale, [from, to]] of Object.entries(skipLabels)) {
  const localePath = new URL(`../app/i18n/locales/${locale}.json`, import.meta.url);
  const source = await readFile(localePath, "utf8");
  await writeFile(localePath, source.replace(`"skip": "${from}"`, `"skip": "${to}"`).replace(/\[\[\d+\]\]\]\s*/g, ""), "utf8");
}

const legacyPath = new URL("../app/i18n/legacy-copy.json", import.meta.url);
const legacySource = await readFile(legacyPath, "utf8");
await writeFile(legacyPath, legacySource.replace(/\[\[\d+\]\]\]\s*/g, ""), "utf8");

console.log("Public copy normalization complete.");
