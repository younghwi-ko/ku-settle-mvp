# KU Settle

고려대학교에 처음 온 외국인 교환학생과 유학생이 입국 후 필요한 행정 절차, 생활용품, 주변 생활 정보를 한곳에서 확인하는 발표용 프론트엔드 MVP입니다.

> 핵심 메시지: **Everything you need to settle into KU.**

실제 결제·채팅·이메일 인증·지도·데이터베이스 없이도 2분 발표 시나리오 전체를 클릭하며 시연할 수 있습니다. 모든 데이터와 번역은 프로젝트 내부에 포함되어 있어 외부 API Key가 필요 없습니다.

## 주요 기능

- Home Dashboard: Alex의 기본 정착 진행률 65%, 체크리스트 미리보기, 추천 ARC 단계
- Onboarding: 7개 정착 업무, 준비물·예상 시간·팁·상태, 체크 시 실시간 진행률 반영
- Campus Marketplace: 검색, 카테고리 필터, 구매/판매 모드, 상품 상세 및 Contact Seller 데모 모달
- Local Guide: Hospital, Halal, Vegan 등 카테고리 필터와 영어 응대 여부, 거리, 학생 팁
- University Verification: `@korea.ac.kr` 형식 확인과 인증 완료 데모 UI
- EN / KO: 모든 핵심 화면, 버튼, 상태, 모달, Empty State의 즉시 전환
- 브라우저 저장: 선택 언어, 체크리스트, 학생 인증 상태를 `localStorage`에 유지
- 반응형 UI: 모바일, 태블릿, 데스크톱에 대응

## 기술 스택

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4 및 프로젝트 전용 CSS 디자인 토큰
- lucide-react 아이콘
- 로컬 TypeScript Mock Data
- Next.js Static Export (`output: "export"`)

## 로컬 실행 방법

### 준비물

- Node.js 22 이상
- pnpm 10 이상 권장

### 실행

```bash
pnpm install
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

프로덕션 빌드를 확인하려면:

```bash
pnpm build
```

빌드가 완료되면 정적 결과물이 `out/` 폴더에 생성됩니다.

## Vercel 배포 방법

### GitHub 연동 방식

1. 이 프로젝트를 GitHub 저장소에 Push합니다.
2. [Vercel](https://vercel.com)에서 **Add New → Project**를 선택합니다.
3. 저장소를 Import합니다.
4. Framework Preset이 **Next.js**인지 확인합니다.
5. 환경 변수는 추가하지 않고 **Deploy**를 누릅니다.

`vercel.json`과 `next.config.ts`가 포함되어 있어 Vercel이 설치와 정적 빌드를 자동으로 수행합니다. API Key나 별도 서버 설정은 필요하지 않습니다.

### Vercel CLI 방식

```bash
pnpm dlx vercel
```

안내에 따라 프로젝트를 연결한 뒤 프로덕션 배포는 다음과 같이 실행합니다.

```bash
pnpm dlx vercel --prod
```

## 다른 컴퓨터에서 접속하는 방법

가장 쉬운 방법은 Vercel 배포 후 생성된 `https://프로젝트명.vercel.app` URL을 공유하는 것입니다. 상대방은 프로그램 설치 없이 일반 Chrome 또는 Edge에서 URL만 열면 됩니다.

같은 Wi-Fi 안에서 로컬 개발 화면을 잠시 공유하려면:

```bash
pnpm dev:network
```

터미널의 `Network` 주소(예: `http://192.168.x.x:3000`)를 다른 컴퓨터에서 엽니다. 운영체제 방화벽이 연결 허용을 요청하면 로컬 네트워크 접근만 허용하세요. 발표나 외부 공유에는 로컬 주소보다 Vercel URL을 권장합니다.

## 프로젝트 구조

```text
app/
├─ data.ts         # 체크리스트, 상품, 장소 Mock Data
├─ i18n.ts         # EN / KO 내부 번역 데이터
├─ page.tsx        # 화면, 상태, 필터, 모달, localStorage 동작
├─ globals.css     # 디자인 시스템과 반응형 스타일
└─ layout.tsx      # 메타데이터와 루트 레이아웃
next.config.ts     # 정적 Export 및 이미지 설정
vercel.json        # Vercel 빌드 설정
```

## 발표 Demo Flow

1. Home에서 Alex의 **KU Setup 65%** 확인
2. Recommended Next Step의 **ARC Registration** 확인
3. **View Guide**로 Onboarding 이동
4. ARC 준비물과 Tip 확인 후 체크박스를 눌러 진행률 변화 시연
5. Marketplace로 이동해 검색창에 **Rice Cooker** 입력
6. 상품 카드를 눌러 상세 모달과 **Contact Seller** 데모 확인
7. Local Guide에서 **Hospital** 또는 **Halal** 필터 선택
8. 오른쪽 상단 **EN / KO**를 눌러 한국어 UI로 전환
9. 새로고침 후에도 언어와 체크리스트 상태가 유지되는지 확인

## 현재 Mock으로 구현된 기능

- 학생 이름과 프로필
- `@korea.ac.kr` 이메일 형식만 확인하는 학생 인증
- 로컬 체크리스트 저장
- 상품 목록, 판매자, 예약 상태, 연락 메시지
- 업체명 뒤에 `Sample / 샘플`을 표시한 Local Guide 데이터
- 지도 없이 거리와 위치 텍스트 제공

실제 메일 발송, 결제, 실시간 채팅, 지도 API, 추천 알고리즘, 관리자 페이지는 포함하지 않습니다.

## 실제 서비스로 발전할 때 필요한 기능

- Backend: 상품·장소·체크리스트·사용자 데이터를 제공하는 API와 운영자 관리 기능
- Authentication: 고려대 이메일 인증, 세션 관리, 학교 SSO 또는 OAuth, 계정 복구
- Database: PostgreSQL 등 관계형 DB, 상품 상태와 거래 기록, 장소 정보, 감사 로그
- Marketplace Safety: 신고·차단, 콘텐츠 검수, 사기 방지, 사용자 평판, 안전한 캠퍼스 픽업 정책
- Messaging: 인증 사용자 간 실시간 채팅, 알림, 개인정보 보호
- Payment: 필요 시 결제대행사 연동, 거래 취소·환불·분쟁 정책. 초기에는 안전한 직거래만 유지 가능
- Operations: 다국어 콘텐츠 검수, 학교 공지 연동, 업체 정보 갱신, 분석·모니터링·개인정보 처리 체계

## 배포 후 기능 점검 체크리스트

- Home의 진행률이 표시되는가
- 상단 Navigation 네 항목이 이동하는가
- EN / KO 전환 후 새로고침해도 언어가 유지되는가
- Checklist를 체크하면 진행률이 변경되고 유지되는가
- Marketplace 검색·필터·상품 상세·Contact Modal이 작동하는가
- Local Guide의 Hospital / Halal 필터와 Empty State가 작동하는가
- 학생 인증 모달이 열리고 인증 Badge가 표시되는가
- 모바일 폭에서 메뉴와 카드가 한 열로 자연스럽게 바뀌는가
