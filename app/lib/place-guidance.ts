import type { Locale } from "../i18n";
import type { Place } from "../data";

type Guidance = { language?: string; tip: string; description?: string };

const campusDescriptions: Record<Locale, string> = {
  ko: "고려대학교 캠퍼스 위치와 건물 안내를 위한 기준점입니다.",
  en: "A campus reference point for Korea University locations and building information.",
  ja: "高麗大学のキャンパス位置と建物案内のための基準地点です。",
  "zh-CN": "用于确认高丽大学校园位置和建筑信息的参考点。",
  vi: "Điểm tham chiếu để xem vị trí và thông tin tòa nhà của Đại học Korea.",
  uz: "Korea universiteti kampusi joylashuvi va binolar haqidagi ma’lumotlar uchun mo‘ljal.",
  mn: "Кореа их сургуулийн кампусын байршил, барилгын мэдээллийг үзэх лавлах цэг.",
  ms: "Titik rujukan untuk lokasi kampus dan maklumat bangunan Korea University."
};

const residenceDescriptions: Record<Locale, string> = {
  ko: "기숙사 위치와 입주 안내를 위한 캠퍼스 기준점입니다.",
  en: "A campus reference point for residence locations and move-in information.",
  ja: "寮の場所と入居案内のためのキャンパス基準地点です。",
  "zh-CN": "用于确认宿舍位置和入住信息的校园参考点。",
  vi: "Điểm tham chiếu về vị trí ký túc xá và thông tin nhận phòng.",
  uz: "Yotoqxona joylashuvi va ko‘chib kirish ma’lumotlari uchun kampus mo‘ljali.",
  mn: "Дотуур байрны байршил, нүүж орох мэдээллийг үзэх кампусын лавлах цэг.",
  ms: "Titik rujukan kampus untuk lokasi kediaman dan maklumat masuk."
};

const copy: Record<string, Record<Locale, Guidance>> = {
  hospital: {
    ko: { language: "언어 지원 여부는 방문 전에 병원에 확인하세요.", tip: "진료과, 접수 방법, 운영시간과 응급 이용 여부를 공식 채널에서 확인하세요." },
    en: { language: "Ask the hospital about language support before visiting.", tip: "Check the department, registration process, hours, and emergency access through the official channel." },
    ja: { language: "言語対応の可否は訪問前に病院へ確認してください。", tip: "診療科、受付方法、診療時間、救急利用の可否を公式窓口で確認してください。" },
    "zh-CN": { language: "请在到访前向医院确认是否提供语言支持。", tip: "请通过官方渠道确认科室、挂号方式、开放时间和急诊使用方式。" },
    vi: { language: "Hãy hỏi bệnh viện về hỗ trợ ngôn ngữ trước khi đến.", tip: "Hãy kiểm tra khoa khám, cách đăng ký, giờ làm việc và khả năng tiếp nhận cấp cứu qua kênh chính thức." },
    uz: { language: "Borishdan oldin shifoxonadan til yordamini so‘rang.", tip: "Bo‘lim, ro‘yxatdan o‘tish tartibi, ish vaqti va shoshilinch yordamni rasmiy manbadan tekshiring." },
    mn: { language: "Очихоосоо өмнө эмнэлгээс хэлний дэмжлэг байгаа эсэхийг асуугаарай.", tip: "Тасаг, бүртгэл, ажиллах цаг болон яаралтай тусламжийн журмыг албан ёсны сувгаар шалгаарай." },
    ms: { language: "Tanya pihak hospital tentang sokongan bahasa sebelum datang.", tip: "Semak jabatan, cara pendaftaran, waktu operasi dan akses kecemasan melalui saluran rasmi." }
  },
  food: {
    ko: { tip: "영업시간, 메뉴, 알레르기와 할랄·비건 제공 여부를 주문 전에 매장에 확인하세요." },
    en: { tip: "Ask the venue about hours, menu items, allergies, and halal or vegan options before ordering." },
    ja: { tip: "営業時間、メニュー、アレルギー、ハラール・ビーガン対応を注文前に確認してください。" },
    "zh-CN": { tip: "点餐前请确认营业时间、菜单、过敏原以及清真或纯素选项。" },
    vi: { tip: "Hãy hỏi về giờ mở cửa, món ăn, dị ứng và lựa chọn halal hoặc thuần chay trước khi gọi món." },
    uz: { tip: "Buyurtma berishdan oldin ish vaqti, menyu, allergenlar hamda halol yoki vegan variantlarni so‘rang." },
    mn: { tip: "Захиалахаасаа өмнө ажиллах цаг, цэс, харшил үүсгэгч болон халал эсвэл веган сонголтыг асуугаарай." },
    ms: { tip: "Tanya tentang waktu operasi, menu, alahan serta pilihan halal atau vegan sebelum membuat pesanan." }
  },
  pharmacy: {
    ko: { tip: "운영시간, 처방전 조제 가능 여부와 필요한 의약품 재고를 약국에 확인하세요." },
    en: { tip: "Check opening hours, prescription availability, and medicine stock with the pharmacy." },
    ja: { tip: "営業時間、処方箋の受付可否、薬の在庫を薬局に確認してください。" },
    "zh-CN": { tip: "请向药房确认营业时间、是否可以配处方药以及药品库存。" },
    vi: { tip: "Hãy hỏi nhà thuốc về giờ mở cửa, việc kê đơn và tình trạng thuốc còn hàng." },
    uz: { tip: "Dorixonadan ish vaqti, retsept bo‘yicha dori berilishi va zaxirani tekshiring." },
    mn: { tip: "Эмийн сангаас ажиллах цаг, жороор эм олгох эсэх болон эмийн үлдэгдлийг асуугаарай." },
    ms: { tip: "Semak waktu operasi, ketersediaan ubat preskripsi dan stok dengan pihak farmasi." }
  },
  campus: {
    ko: { tip: "건물 위치와 이용 안내는 캠퍼스 공식 링크에서 확인하세요." },
    en: { tip: "Check the building location and visitor information through the official campus link." },
    ja: { tip: "建物の場所と利用案内はキャンパスの公式リンクで確認してください。" },
    "zh-CN": { tip: "请通过校园官方链接确认建筑位置和使用指南。" },
    vi: { tip: "Hãy xem vị trí tòa nhà và hướng dẫn sử dụng trên liên kết chính thức của trường." },
    uz: { tip: "Bino joylashuvi va foydalanish ma’lumotlarini kampusning rasmiy havolasidan tekshiring." },
    mn: { tip: "Барилгын байршил болон ашиглах мэдээллийг кампусын албан ёсны холбоосоор шалгаарай." },
    ms: { tip: "Semak lokasi bangunan dan maklumat penggunaan melalui pautan rasmi kampus." }
  },
  residence: {
    ko: { tip: "입주 일정과 관리실 안내는 기숙사 공식 공지에서 확인하세요." },
    en: { tip: "Check move-in dates and housing office guidance in the official residence notice." },
    ja: { tip: "入居日程と管理室の案内は寮の公式のお知らせで確認してください。" },
    "zh-CN": { tip: "请通过宿舍官方通知确认入住日期和管理室指南。" },
    vi: { tip: "Hãy xem thông báo chính thức của ký túc xá về ngày nhận phòng và văn phòng quản lý." },
    uz: { tip: "Ko‘chib kirish sanalari va boshqaruv idorasi ma’lumotlarini yotoqxonaning rasmiy xabaridan tekshiring." },
    mn: { tip: "Нүүж орох огноо болон байрны захиргааны мэдээллийг албан ёсны мэдэгдлээс шалгаарай." },
    ms: { tip: "Semak tarikh masuk dan panduan pejabat pengurusan dalam notis rasmi kediaman." }
  }
};

export function placeGuidance(place: Place, locale: Locale): Guidance {
  if (place.kind === "campus") {
    place.descriptionKey = "localGuide:places.campusAnchor.description";
    delete place.displayDescription;
  }
  const key = place.venueType === "campus-anchor" ? (place.campusPointType === "residence" ? "residence" : "campus") : place.category === "Hospital" ? "hospital" : place.category === "Pharmacy" ? "pharmacy" : "food";
  const guidance = copy[key][locale] ?? copy[key].en;
  if (place.venueType === "campus-anchor") return { ...guidance, description: (key === "residence" ? residenceDescriptions : campusDescriptions)[locale] ?? campusDescriptions.en };
  return guidance;
}

export function placeVerificationRank(place: Place) {
  if (place.source === "kakao") return 3;
  return place.verificationStatus === "official" ? 0 : place.verificationStatus === "verified" ? 1 : place.verificationStatus === "needs_confirmation" ? 2 : 3;
}
