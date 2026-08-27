# KU Settle

KU Settle은 고려대학교 외국인 학생이 입국 준비부터 귀국까지 해야 할 일을 단계별로 확인하고 실행 화면으로 이동할 수 있는 정적 프론트엔드 프로토타입입니다.

> **Information → Action: 입국부터 귀국까지 이어지는 유학생 lifecycle 온보딩**

English, 한국어, 日本語, 简体中文을 지원하며 모든 콘텐츠와 데모 데이터가 프로젝트에 포함되어 있습니다. 외부 API Key, 백엔드, 데이터베이스가 없어도 전체 발표 시나리오를 실행할 수 있습니다.

## 주요 기능

- 4단계 lifecycle: Before Arrival, First Weeks, Campus Life, Departure
- 사용자 이름·입국 예정일·기숙사/교외 거주 유형에 맞춘 18개 활성 작업
- 전체·단계별 진행률과 첫 번째 미완료 작업 자동 추천
- HiKorea·KU 공식 안내, Local Guide 필터, Marketplace 모드로 이어지는 action
- 입국 학생 상품 탐색 및 출국 학생 상품 등록 데모
- `@korea.ac.kr` 형식만 확인하는 명시적인 데모 학생 인증
- 사용자 설정, 체크리스트, 인증, 등록 상품, 언어를 브라우저 `localStorage`에 저장
- Reset demo 실행 시 언어를 제외한 데모 상태만 초기화
- 320px 모바일부터 데스크톱까지 대응하는 CJK 안전 반응형 UI

## 다국어 구조

`i18next`와 `react-i18next`를 사용하며 번역 리소스는 빌드 결과물에 정적으로 포함됩니다. 서버 요청이나 번역 API는 없습니다.

지원 locale:

- `en` — English, 기본 fallback
- `ko` — 한국어
- `ja` — 日本語
- `zh-CN` — 简体中文

언어 결정 우선순위는 URL `?lang=` → `ku-settle-language` 저장값 → 브라우저 언어 → 영어입니다. 기존 `en`·`ko` 저장값은 그대로 사용하며, `zh`, `zh-SG`, `zh-Hans`는 `zh-CN`으로 정규화합니다. 공유 URL 예시는 `/?lang=ja`입니다. 이후 `zh-TW` 리소스를 같은 구조로 추가할 수 있습니다.

번역 파일은 다음 12개 namespace의 동일한 키 구조를 가집니다.

- `common`
- `navigation`
- `home`
- `onboarding`
- `marketplace`
- `localGuide`
- `verification`
- `profile`
- `reset`
- `validation`
- `errors`
- `accessibility`

Lifecycle, 상품, 장소 데이터에는 번역문 대신 `titleKey`, `descriptionKey`, `categoryKey`, `preparationKeys`, `practicalNoteKey`, `actionLabelKey` 같은 키와 언어 중립적인 숫자·상태 값만 저장합니다. 날짜, 숫자, 진행률, KRW 가격은 렌더링 시 표준 `Intl` API로 현지화합니다.

> 일본어와 중국어는 프로토타입 수준의 자연스러운 UI 번역을 완료했지만, 실제 출시 전에는 행정·의료 문맥을 포함해 원어민 검수를 진행해야 합니다. 이 메모는 개발 문서용이며 화면에는 표시되지 않습니다.

## 기술 스택

- Next.js 16 App Router + React 19 + TypeScript
- i18next + react-i18next
- Tailwind CSS 4 및 프로젝트 전용 CSS
- lucide-react
- Next.js Static Export (`output: "export"`)

## 로컬 실행 방법

Node.js 22 이상과 pnpm 10 이상을 권장합니다.

```bash
pnpm install
pnpm dev
```

[http://localhost:3000](http://localhost:3000)을 엽니다. 프로덕션 정적 빌드는 다음 명령으로 확인합니다.

```bash
pnpm run lint
pnpm run typecheck
pnpm run test:i18n
pnpm run build
```

정적 결과물은 `out/`에 생성됩니다.

## Vercel 배포 방법

1. GitHub 저장소에 변경사항을 push합니다.
2. Vercel에서 **Add New → Project**를 선택하고 저장소를 Import합니다.
3. Framework Preset이 **Next.js**인지 확인합니다.
4. 환경 변수 없이 **Deploy**를 누릅니다.

현재 저장소가 Vercel 프로젝트와 연결되어 있다면 `main` push 뒤 자동으로 새 Production Deployment가 생성됩니다. `vercel.json`과 `next.config.ts`에 정적 배포 설정이 포함되어 있습니다.

## 다른 컴퓨터에서 접속하는 방법

Vercel이 제공하는 `https://프로젝트명.vercel.app` URL을 공유하면 일반 Chrome, Edge, Safari에서 별도 설치 없이 열 수 있습니다. 선택 언어가 포함된 `?lang=ko`, `?lang=ja`, `?lang=zh-CN` URL도 공유할 수 있습니다.

같은 Wi-Fi에서 개발 화면을 확인하려면 다음 명령을 사용하고 터미널의 Network 주소를 엽니다.

```bash
pnpm dev:network
```

## 프로젝트 구조

```text
app/
├─ data.ts                  # 언어 중립 lifecycle·상품·장소 데이터
├─ i18n/
│  ├─ config.ts             # i18next 설정과 영어 fallback
│  ├─ formatters.ts         # Intl 날짜·숫자·통화·거리 formatter
│  ├─ types.ts              # locale 정규화·감지
│  ├─ use-app-i18n.ts       # URL·localStorage·document 동기화
│  └─ locales/              # en, ko, ja, zh-CN JSON 리소스
├─ page.tsx                 # 화면, 상태, 접근 가능한 모달과 선택기
├─ globals.css              # 디자인 시스템과 CJK 반응형 스타일
└─ layout.tsx               # 메타데이터와 루트 레이아웃
scripts/
└─ validate-i18n.mjs        # 키 일치·빈 값·fallback·locale 감지 검사
```

## localStorage와 다음 백엔드 단계

현재 저장 키:

- `ku-settle-profile`: 이름, 입국 예정일, 주거 유형, 데모 여부
- `ku-settle-checklist`: 완료 작업 ID 배열
- `ku-settle-verified`: 데모 인증 상태
- `ku-settle-user-products`: 사용자가 등록한 언어 중립 상품 데이터
- `ku-settle-language`: 선택 locale

실제 서비스에서는 앞의 네 영역을 인증 사용자 기반 API와 데이터베이스로 옮기고 서버 측 검증·권한·동기화를 추가해야 합니다. 언어는 계정 환경설정과 브라우저 기본값을 조합할 수 있습니다. 기존 상품 형식과 체크리스트 ID는 읽을 때 검증·정규화하여 이전 데모 저장값도 안전하게 처리합니다.

## 데모 한계

- 계정 생성, 실제 이메일 발송, 학교 SSO, 결제, 예약, 채팅, 배송, 지도, 푸시 알림은 없습니다.
- 상품·장소·진행 정보는 브라우저별 데모 데이터이며 여러 기기 사이에 동기화되지 않습니다.
- 행정·비자·법률·의료 요건은 변경될 수 있으므로 화면에서도 공식 출처 확인을 안내합니다.
- Marketplace 인증은 실제 인증이 아닌 발표용 형식 검증입니다.
- 일본어·중국어는 출시 전 원어민 및 도메인 전문가 검수가 필요합니다.
