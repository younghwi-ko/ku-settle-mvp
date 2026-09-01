import type { GuideLocaleCopy } from "./data";

type GuideLocaleOverrides = Record<string, Partial<Record<"uz" | "vi" | "mn" | "ms", GuideLocaleCopy>>>;

// These are editorial translations for the article-level copy. Free-form source names and URLs remain unchanged.
export const guideLocaleOverrides: GuideLocaleOverrides = {
  "ku-dorm-guide": {
    uz: { title: "KU yotoqxonasining rasmiy yo‘riqnomasini tekshiring", summary: "Talablar, sanalar va kerakli hujjatlarni universitetning rasmiy yotoqxona sahifasidan tekshiring.", content: "Uy-joy bo‘yicha qaror qilishdan oldin dasturingizga tegishli Korea University yotoqxona yoki xalqaro talabalar yo‘riqnomasini ochib, joriy ko‘rsatmalarni tekshiring." },
    vi: { title: "Kiểm tra hướng dẫn ký túc xá chính thức của KU", summary: "Xác nhận điều kiện, thời gian và giấy tờ cần thiết trên trang ký túc xá chính thức của trường.", content: "Trước khi quyết định chỗ ở, hãy mở hướng dẫn ký túc xá hoặc hướng dẫn dành cho sinh viên quốc tế chính thức của Korea University phù hợp với chương trình của bạn." },
    mn: { title: "KU-ийн дотуур байрны албан ёсны зааврыг шалгах", summary: "Шаардлага, огноо, хэрэгтэй бичиг баримтыг их сургуулийн албан ёсны дотуур байрны хуудсаас шалгаарай.", content: "Орон байрны шийдвэр гаргахаасаа өмнө хөтөлбөрт тань хамаарах Korea University-ийн дотуур байр эсвэл олон улсын оюутны албан ёсны зааврыг нээж, одоогийн мэдээллийг шалгаарай." },
    ms: { title: "Semak panduan asrama rasmi KU", summary: "Semak kelayakan, tarikh dan dokumen yang diperlukan di halaman asrama rasmi universiti.", content: "Sebelum membuat keputusan tentang tempat tinggal, buka panduan rasmi asrama atau pelajar antarabangsa Korea University yang terpakai untuk program anda dan semak arahan terkini." }
  },
  "hikorea-residence": {
    uz: { title: "Yashash bo‘yicha rasmiy ma’lumotni toping", summary: "Holatingizga tegishli hujjatlar va uchrashuv qoidalarini HiKorea orqali tekshiring.", content: "Yashash va immigratsiya talablari maqomingizga bog‘liq bo‘lib, o‘zgarishi mumkin. Sizga tegishli ko‘rsatmalarni rasmiy HiKorea xizmatidan tekshiring." },
    vi: { title: "Tìm thông tin cư trú chính thức", summary: "Dùng HiKorea để kiểm tra giấy tờ và quy định đặt lịch phù hợp với tình trạng của bạn.", content: "Yêu cầu về cư trú và xuất nhập cảnh phụ thuộc vào tình trạng của bạn và có thể thay đổi. Hãy kiểm tra hướng dẫn áp dụng cho bạn trên dịch vụ HiKorea chính thức." },
    mn: { title: "Оршин суух тухай албан ёсны мэдээллийг олох", summary: "Таны нөхцөлд тохирох бичиг баримт, цаг авах журмыг HiKorea-гаас шалгаарай.", content: "Оршин суух болон цагаачлалын шаардлага нь таны статусаас хамаарч өөрчлөгдөж болно. Танд хамаарах зааврыг албан ёсны HiKorea үйлчилгээнээс шалгаарай." },
    ms: { title: "Cari maklumat rasmi tentang imigresen", summary: "Gunakan HiKorea untuk menyemak dokumen dan peraturan janji temu yang terpakai kepada anda.", content: "Keperluan imigresen bergantung pada status anda dan boleh berubah. Semak arahan yang terpakai kepada anda melalui perkhidmatan HiKorea rasmi." }
  },
  "transit-card-basics": {
    uz: { title: "Jamoat transporti va transport kartalarini o‘rganing", summary: "Joriy tariflar, yo‘nalishlar va karta ma’lumotlarini rasmiy transport operatoridan tekshiring.", content: "Joriy yo‘nalishlar, tariflar va to‘lov usullari uchun safardan oldin rasmiy transport operatori ma’lumotlaridan foydalaning." },
    vi: { title: "Tìm hiểu giao thông công cộng và thẻ đi lại", summary: "Kiểm tra giá vé, tuyến đường và hướng dẫn về thẻ từ đơn vị vận hành chính thức.", content: "Trước khi đi, hãy xem thông tin của đơn vị vận hành giao thông chính thức để biết tuyến đường, giá vé và cách thanh toán hiện tại." },
    mn: { title: "Нийтийн тээвэр ба тээврийн картын үндсийг мэдэх", summary: "Одоогийн үнэ, чиглэл болон картын мэдээллийг албан ёсны тээврийн байгууллагаас шалгаарай.", content: "Одоогийн чиглэл, үнэ болон төлбөрийн аргын талаар зорчихоосоо өмнө албан ёсны тээврийн байгууллагын мэдээллийг ашиглаарай." },
    ms: { title: "Ketahui pengangkutan awam dan kad transit", summary: "Semak tambang, laluan dan panduan kad semasa melalui pengendali pengangkutan rasmi.", content: "Sebelum bergerak, gunakan maklumat pengendali pengangkutan rasmi untuk menyemak laluan, tambang dan pilihan pembayaran terkini." }
  },
  "dorm-checkin-steps": {
    uz: { title: "Yotoqxonaga kirishga tayyorlaning", summary: "Yotoqxonaga kirish uchun e’lon, kelish vaqti va kerakli narsalarni tartibga soling.", content: "Yotoqxona qoidalari va kirish vaqti semestrga qarab o‘zgarishi mumkin. Safardan oldin universitetning eng so‘nggi e’lonini tekshiring." },
    vi: { title: "Chuẩn bị nhận phòng ký túc xá", summary: "Sắp xếp thông báo, khung giờ đến và những thứ cần cho ngày nhận phòng.", content: "Quy định và giờ nhận phòng có thể thay đổi theo học kỳ. Hãy kiểm tra thông báo mới nhất của trường trước khi đi." },
    mn: { title: "Дотуур байранд ороход бэлдэх", summary: "Мэдэгдэл, очих цаг болон ороход хэрэгтэй зүйлсээ урьдчилан бэлдээрэй.", content: "Дотуур байрны дүрэм, орох цаг улирлаас хамаарч өөрчлөгдөж болно. Явахаасаа өмнө сургуулийн хамгийн сүүлийн мэдэгдлийг шалгаарай." },
    ms: { title: "Bersedia untuk daftar masuk asrama", summary: "Susun notis, waktu ketibaan dan barang yang diperlukan untuk daftar masuk asrama.", content: "Peraturan dan waktu daftar masuk asrama boleh berubah mengikut semester. Semak notis terkini universiti sebelum bertolak." }
  },
  "airport-to-ku": {
    uz: { title: "Aeroportdan KUga boring", summary: "Aeroportdan amaliy yo‘nalishlarni solishtiring va manzilni oflayn saqlang.", content: "Yo‘nalish vaqti va tariflar o‘zgaradi. Aeroportdan chiqishdan oldin rasmiy transport operatorini tekshiring." },
    vi: { title: "Đi từ sân bay đến KU", summary: "So sánh các tuyến đường thực tế từ sân bay và lưu địa chỉ đích để dùng khi không có mạng.", content: "Thời gian và giá vé có thể thay đổi. Hãy kiểm tra đơn vị vận hành giao thông chính thức trước khi rời sân bay." },
    mn: { title: "Нисэх буудлаас KU руу зорчих", summary: "Нисэх буудлаас явах боломжит чиглэлүүдийг харьцуулж, очих газрын тэмдэглэлийг офлайн хадгалаарай.", content: "Чиглэлийн хугацаа, үнэ өөрчлөгдөж болно. Нисэх буудлаас гарахаасаа өмнө албан ёсны тээврийн байгууллагыг шалгаарай." },
    ms: { title: "Perjalanan dari lapangan terbang ke KU", summary: "Bandingkan laluan praktikal dari lapangan terbang dan simpan nota destinasi untuk kegunaan luar talian.", content: "Masa perjalanan dan tambang boleh berubah. Semak pengendali pengangkutan rasmi sebelum meninggalkan lapangan terbang." }
  },
  "arc-current-check": {
    uz: { title: "ARC bo‘yicha joriy yo‘riqnomani tekshiring", summary: "Maqomingizga tegishli hujjatlar va uchrashuv qoidalarini HiKorea orqali tasdiqlang.", content: "Immigratsiya talablari maqomga bog‘liq va o‘zgarishi mumkin. Ushbu maqoladan joriy rasmiy xabarni topish uchun ro‘yxat sifatida foydalaning." },
    vi: { title: "Kiểm tra hướng dẫn ARC hiện tại", summary: "Dùng HiKorea để xác nhận giấy tờ và quy định đặt lịch phù hợp với tình trạng của bạn.", content: "Yêu cầu xuất nhập cảnh phụ thuộc vào tình trạng và có thể thay đổi. Hãy dùng bài viết này như danh sách kiểm tra để tìm thông báo chính thức hiện tại." },
    mn: { title: "ARC-ийн одоогийн зааврыг шалгах", summary: "Таны статуст тохирох бичиг баримт, цаг авах журмыг HiKorea-гаас шалгаарай.", content: "Цагаачлалын шаардлага нь статусаас хамаарч өөрчлөгдөж болно. Энэ нийтлэлийг одоогийн албан ёсны мэдэгдлийг олох шалгах хуудас болгон ашиглаарай." },
    ms: { title: "Semak panduan ARC terkini", summary: "Gunakan HiKorea untuk mengesahkan dokumen dan peraturan janji temu yang terpakai kepada status anda.", content: "Keperluan imigresen bergantung pada status dan boleh berubah. Gunakan artikel ini sebagai senarai semak untuk mencari notis rasmi terkini." }
  },
  "sim-esim-options": {
    uz: { title: "SIM va eSIM imkoniyatlarini solishtiring", summary: "Xarid qilishdan oldin qurilma mosligi, shaxsni tasdiqlash talablari va tarif shartlarini tekshiring.", content: "Tariflar va ro‘yxatdan o‘tish talablari operatorga qarab farq qiladi. Joriy taklifni operatorning o‘zidan tasdiqlang." },
    vi: { title: "So sánh các lựa chọn SIM và eSIM", summary: "Kiểm tra khả năng tương thích của thiết bị, yêu cầu xác minh danh tính và điều khoản gói trước khi mua.", content: "Tính sẵn có và yêu cầu đăng ký thay đổi theo nhà cung cấp. Hãy xác nhận ưu đãi hiện tại trực tiếp với nhà cung cấp." },
    mn: { title: "SIM болон eSIM сонголтыг харьцуулах", summary: "Худалдан авахаасаа өмнө төхөөрөмжийн нийцэл, таних баталгаажуулалт болон багцын нөхцөлийг шалгаарай.", content: "Багцын боломж, бүртгэлийн шаардлага нь үйлчилгээ үзүүлэгчээс хамаарна. Одоогийн саналыг үйлчилгээ үзүүлэгчээс шууд баталгаажуулаарай." },
    ms: { title: "Bandingkan pilihan SIM dan eSIM", summary: "Semak keserasian peranti, keperluan pengesahan identiti dan syarat pelan sebelum membeli.", content: "Ketersediaan pelan dan syarat pendaftaran berbeza mengikut penyedia. Sahkan tawaran semasa terus dengan penyedia." }
  },
  "ku-portal-basics": {
    uz: { title: "KU akademik tizimlariga kirishni sozlang", summary: "Joriy portal, kursga ro‘yxatdan o‘tish, jadval va e’lonlar joyini toping.", content: "Akademik tizim menyulari va sanalar universitet tomonidan boshqariladi. Muddatlar uchun joriy KU e’lonlaridan foydalaning." },
    vi: { title: "Thiết lập quyền truy cập hệ thống học vụ KU", summary: "Tìm cổng thông tin, lịch đăng ký môn, thời khóa biểu và nơi xem thông báo hiện tại.", content: "Menu và thời hạn của hệ thống học vụ do trường quản lý. Hãy xem thông báo KU hiện tại để biết hạn chót." },
    mn: { title: "KU-ийн сургалтын системд нэвтрэх", summary: "Одоогийн портал, хичээл бүртгэл, хуваарь болон мэдэгдлийн хэсгийг олоорой.", content: "Сургалтын системийн цэс, огноог их сургууль удирддаг. Хугацааны талаар одоогийн KU мэдэгдлийг ашиглаарай." },
    ms: { title: "Sediakan akses kepada sistem akademik KU", summary: "Cari portal, pendaftaran kursus, jadual dan lokasi notis semasa.", content: "Menu dan tarikh sistem akademik dikawal oleh universiti. Gunakan notis KU terkini untuk menyemak tarikh akhir." }
  },
  "emergency-119": {
    uz: { title: "119 favqulodda raqamini biling", summary: "Favqulodda vaziyatdan oldin raqam va manzilingizni tayyorlab qo‘ying.", content: "Koreyada shoshilinch tibbiy yoki yong‘in holatlarida 119 raqamiga qo‘ng‘iroq qiling. Shoshilinch bo‘lmagan yordam uchun avval muassasa va til xizmatini tekshiring." },
    vi: { title: "Ghi nhớ số khẩn cấp 119", summary: "Chuẩn bị sẵn số khẩn cấp và địa chỉ của bạn trước khi xảy ra tình huống khẩn cấp.", content: "Tại Hàn Quốc, hãy gọi 119 khi có tình huống y tế hoặc hỏa hoạn khẩn cấp. Với việc không khẩn cấp, hãy kiểm tra cơ sở và hỗ trợ ngôn ngữ trước." },
    mn: { title: "Яаралтай тусламжийн 119 дугаарыг мэдэх", summary: "Яаралтай нөхцөлөөс өмнө дугаар болон байршлаа бэлэн байлгаарай.", content: "Солонгост яаралтай эмнэлгийн болон галын үед 119 рүү залгаарай. Яаралтай бус тусламж авахдаа байгууллага, хэлний дэмжлэгийг урьдчилан шалгаарай." },
    ms: { title: "Kenali nombor kecemasan 119", summary: "Sediakan nombor kecemasan dan lokasi anda sebelum berlaku keadaan mendesak.", content: "Di Korea, hubungi 119 untuk kecemasan perubatan atau kebakaran. Untuk rawatan tidak kecemasan, semak penyedia dan sokongan bahasa terlebih dahulu." }
  },
  "recycling-basics": {
    uz: { title: "Mahalliy qayta ishlash asoslarini o‘rganing", summary: "Yig‘ish kunlari, paketlar va saralash qoidalari uchun bino e’lonini tekshiring.", content: "Qayta ishlash va oziq-ovqat chiqindisi qoidalari tuman va binoga qarab farq qiladi. Yakuniy manba sifatida mahalliy e’londan foydalaning." },
    vi: { title: "Tìm hiểu cách phân loại rác tại địa phương", summary: "Kiểm tra thông báo của tòa nhà về ngày thu gom, túi rác và quy định phân loại.", content: "Quy định về rác tái chế và rác thực phẩm khác nhau theo quận và tòa nhà. Hãy xem thông báo địa phương là nguồn thông tin cuối cùng." },
    mn: { title: "Орон нутгийн хог ангилах үндсийг сурах", summary: "Цуглуулах өдөр, уут болон ангилах дүрмийг байрны мэдэгдлээс шалгаарай.", content: "Дахин боловсруулах болон хүнсний хогийн дүрэм дүүрэг, байрнаас хамаарч өөр байна. Эцсийн мэдээлэлд орон нутгийн мэдэгдлийг ашиглаарай." },
    ms: { title: "Pelajari asas kitar semula tempatan", summary: "Semak notis bangunan tentang hari kutipan, beg dan peraturan pengasingan.", content: "Peraturan kitar semula dan sisa makanan berbeza mengikut daerah dan bangunan. Jadikan notis tempatan sebagai rujukan akhir." }
  },
  "departure-shipping": {
    uz: { title: "Jo‘nash va yuk yuborishni rejalashtiring", summary: "Jo‘nashdan oldin sotish, saqlash, yuborish va uy topshirig‘ini tartibga soling.", content: "Xizmat narxlari va bojxona qoidalari o‘zgarishi mumkin. Joriy shartlarni solishtiring va muhim jo‘natmalar kvitansiyalarini saqlang." },
    vi: { title: "Lập kế hoạch gửi đồ và chuyển đi", summary: "Sắp xếp việc bán, lưu kho, gửi đồ và bàn giao chỗ ở trước khi rời đi.", content: "Giá dịch vụ và quy định hải quan có thể thay đổi. Hãy so sánh điều khoản hiện tại và giữ biên lai của các lô hàng quan trọng." },
    mn: { title: "Явахын өмнө илгээмж, нүүхээ төлөвлөх", summary: "Явахаасаа өмнө зарах, хадгалах, илгээх болон байр хүлээлгэн өгөх ажлаа зохион байгуулаарай.", content: "Үйлчилгээний үнэ, гаалийн дүрэм өөрчлөгдөж болно. Одоогийн нөхцөлийг харьцуулж, чухал илгээмжийн баримтыг хадгалаарай." },
    ms: { title: "Rancang penghantaran dan berpindah", summary: "Susun jualan, penyimpanan, penghantaran dan penyerahan tempat tinggal sebelum berlepas.", content: "Harga penyedia dan peraturan kastam boleh berubah. Bandingkan syarat semasa dan simpan resit untuk penghantaran penting." }
  }
};
