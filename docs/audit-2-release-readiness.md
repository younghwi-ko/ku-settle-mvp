# 감사 2번 운영 반영 준비 결과

작성일: 2026-11-10 (한국 시간). 개발·격리 DB·실제 HTTP 검증을 완료한 뒤 사용자가 일시 중단·해당 SQL·범위 내 커밋/푸시/배포를 승인했다. **운영 전환의 실제 실행 기록은 8절**을 기준으로 한다. 앞선 준비 단계에서 실행하지 않은 절차와 현재 실행 결과를 구분한다. 인증·운영 환경변수·기존 사용자 데이터는 변경하지 않는다.

## 1. 확정 SQL과 격리 migration 이력 보정 — 완료

- SQL: [202611100001_atomic_guest_reservations.sql](../supabase/migrations/202611100001_atomic_guest_reservations.sql)
- UTF-8, CRLF→LF 정규화 후 SHA256: **`9f6134c39e62ce5e7b8a0973664c5a39fda57f4669fb24f9487fb5954e3d322f`**
- 테스트 API URL과 로컬 ref가 `nlzcikoxttenpcflikpd`인 것을 대조했다. 운영 연결을 대체로 사용하지 않았다.
- 직접 DB 호스트는 AAAA만 조회되며 현재 실행 환경의 IPv6 연결은 `ENETUNREACH`였다. 사용자가 확인한 `aws-0-ap-northeast-2.pooler.supabase.com:5432` Session pooler, 사용자 `postgres.nlzcikoxttenpcflikpd`로 연결했다. 시스템 CA와 내려받은 Supabase CA로 TLS 인증서·호스트 검증을 유지했다.
- 보정 전 두 함수의 본문, 인자 이름/타입/기본값, JSONB 반환형, `SECURITY INVOKER`, `search_path=public`, anon/authenticated EXECUTE 거부·service_role 허용을 확정 SQL과 대조했다.

설치 CLI **v2.116.0**의 `migration repair --help`에서 `--status applied`, `--db-url`, `--yes` 지원을 확인했다. 실행한 명령의 비밀값 없는 형태는 다음과 같다.

```text
supabase migration repair 202611100001 --status applied --db-url <테스트 Session pooler URL: 비밀번호 없음, TLS verify-full> --yes
```

실제로는 설치 패키지의 `supabase/dist/supabase.js`를 Node로 실행했다. 비밀번호는 `PGPASSWORD`/`SUPABASE_DB_PASSWORD` 자식 프로세스 환경에만 전달했다. URL에는 비밀번호를 넣지 않았다. 임시 공인 CA 묶음 파일은 실행 후 제거했고, 원래 `.env.local`은 변경하지 않았다. SQL 재실행·DB reset·데이터 테스트를 하지 않았다.

| 확인 | 보정 전 | 보정 후 |
| --- | --- | --- |
| CLI 종료 코드 | 해당 없음 | **0**, repair 완료 응답 확인 |
| `202611100001` 이력 | 0건 | **1건**, 이름 `atomic_guest_reservations` |
| 다른 migration | 13건 | 같은 13건, 전체 행 내용 해시 동일 |
| 두 RPC 정의·실행 권한 | SQL과 일치 | 보정 전과 동일 |
| SQL 파일 checksum | 위 SHA256 | 동일 |

변경 전후 증거 해시:

| 대상 | 보정 전 = 보정 후 SHA256 |
| --- | --- |
| `create_guest_reservation`의 `pg_get_functiondef` | `2b16f8d771b880a8751efde9e9aaa7ac1617879089292d4971b0f62308c11ed4` |
| `transition_guest_reservation`의 `pg_get_functiondef` | `cf16273a4f4d96ddc3ce1a5a1d402b9f15aaa51bcd3b81a261e31ae9c5b63852` |
| 각 RPC의 `proacl` | `fbafe3bfaed21ba605e4c84f054cfe31484d3df07d5445aa6ebfb7f1a277f4e3` |
| 보정 대상 제외 migration 전체 행 | `f7975b1f3dd07716706a67631f100972a27f21d1f54c6358e0cd4baf0be7e50b` |

`repair`는 이력 등록이며 함수 설치가 아니다. 이전 [HTTP 검증 보고서](audit-2-http-db-verification.md)의 “이력 0건·보정 미실행”은 그때의 기록이며, 현재 상태는 이 문서의 **1건·보정 완료**다. 운영 migration 상태는 이번에 조회하거나 변경하지 않았다.

## 2. 반영 후보 파일과 검증 근거

현재 기준 HEAD는 `c0b1faf7ebd5eae06c14f0eeea8abf9a0c860d0e`이며 이번 준비 작업에서 바꾸지 않았다. 아래만 이후 릴리스 검토 대상이다. 아직 stage/commit하지 않았다.

| 구분 | 파일 |
| --- | --- |
| 실행 코드 | [예약 생성·재전송 API](../app/api/marketplace/listings/[id]/reservations/route.ts), [사용자 취소 API](../app/api/reservations/[id]/route.ts), [관리자 종료 API](../app/api/admin/reservations/[id]/route.ts), [만료 처리](../app/lib/reservation-expiry.ts), [RPC 오류 응답](../app/lib/reservation-rpc.ts) |
| DB | [추가 migration 1개](../supabase/migrations/202611100001_atomic_guest_reservations.sql) |
| 검증 | [생성 핸들러 테스트](../tests/reservation-route.test.ts), [종료 핸들러 테스트](../tests/reservation-transition-route.test.ts), [HTTP 러너 차단 테스트](../tests/reservation-http-safety.test.ts), [실제 DB 러너](../scripts/reservation-db-integration.mjs), [실제 HTTP 러너](../scripts/reservation-http-integration.mjs) |
| 개발 설정 | [package.json](../package.json), [pnpm-lock.yaml](../pnpm-lock.yaml): 검증 명령과 테스트 전용 `pg` 의존성 |
| 문서 | [예약 트랜잭션 보고서](audit-2-reservation-transactions.md), [HTTP 검증 보고서](audit-2-http-db-verification.md), 이 운영 준비 문서 |

**제외:** 기존 미커밋 `.agents/skills/ponytail/`, `.agents/skills/ponytail-audit/`, `docs/ponytail-audit-2026-11-10.md`, `docs/ponytail-development-usage.md`, 실제 환경변수·키·인증서·CLI 캐시. `git add .`를 사용하지 않고 위 파일별로 선정·diff 검토해야 한다. 다른 감사 항목과 README를 섞지 않는다.

이미 실행한 검증의 근거는 두 보고서에 남아 있다. 재실행하지 않았다.

- 실제 격리 DB: 9개 그룹, 별도 DB 연결의 잠금 대기·경합·롤백·권한 거부·정리까지 exit 0.
- 실제 HTTP→Supabase→DB: 7개 그룹, 익명 구매자/판매자·관리자 인증·재전송·종료·만료와 Chromium 실제 reload·정리까지 exit 0.
- 최신 일반 검사: 20개 파일·168개 테스트, i18n·타입체크·lint 통과. 기존 lint 경고 2개.
- 이전 앱 빌드와 모의 Chromium 회귀 32개/데모 6개 통과. 이번 이력/문서 작업을 새 빌드·브라우저 통과로 표시하지 않는다.
- 실제 이메일 계정 로그인·운영 부하·실기기 검증은 위 근거에 포함되지 않는다.

## 3. Vercel 실제 읽기 확인 — 차단·drain 입증은 미준비

2026-11-10 로그인된 Vercel Dashboard에서 아래 내용을 읽었다. 설정 저장·규칙 추가/Publish·Pause·Threshold의 Set·배포/복원은 실행하지 않았다. 소스의 전역 유지보수 기능과 `vercel.json`의 차단·cron·함수 실행 시간 설정은 없으며 새 코드를 추가하지 않았다.

### 프로젝트·배포 목록

- Team slug: `younghwi-ko`, 요금제 **Hobby**. Team ID 자체는 확인하지 않았다.
- Project: `temporary-fleet-maroon-2opm8kt`, ID **`prj_MZUPXDEIS0qEaNbiCOmUFKy5rlTi`**.
- 현재 production alias: `temporary-fleet-maroon-2opm8kt.vercel.app`.
- main branch alias: `temporary-fleet-maroon-2opm8kt-git-main-younghwi-ko.vercel.app`.
- 환경 필터를 해제한 목록에 활성 Ready 배포 4개가 표시됐고 모두 Production/main이었다. 활성 Preview는 표시되지 않았다. 최근 삭제 목록에는 복원 가능한 과거 배포와 Load More가 있었으며 전체 삭제 목록을 열거하거나 복원하지 않았다.

| 활성 deployment ID | 고유 hostname (`.vercel.app` 포함) | 커밋 | 생성 시각 (한국 시간) |
| --- | --- | --- | --- |
| `65xHj4pmCB6bmr7tj47CNj4JRNTd` (현재) | `temporary-fleet-maroon-2opm8kt-9wz63ouo5-younghwi-ko.vercel.app` | `c0b1faf` | 2026-11-10 01:03:54 |
| `9GE4Mi8h1niVAuCKRTs1CEpcszSf` | `temporary-fleet-maroon-2opm8kt-k8mep9y84-younghwi-ko.vercel.app` | `be07e6a` | 2026-11-09 15:43:49 |
| `6XcSC4HBkxgbkmFA9K8MjbxPmZqP` | `temporary-fleet-maroon-2opm8kt-qo4492rwo-younghwi-ko.vercel.app` | `ba12311` | 2026-11-08 15:19:44 |
| `HLxLUpRtEPr1HYTRCPVWEZTBCycQ` | `temporary-fleet-maroon-2opm8kt-frrs6wpp0-younghwi-ko.vercel.app` | `bf3100c` | 2026-11-08 14:39:17 |

네 배포의 상세 설정에서 Fluid Compute Enabled, Node.js 24.x, `iad1`, Standard Protection, **Skew Protection Enabled / 1 day**를 각각 확인했다. 현재 프로젝트 환경변수 `NEXT_PUBLIC_SUPABASE_URL`은 Config / Production이며, 사용자가 Vercel 이메일 재인증을 완료한 뒤 **`https://exdyfbqhsnreridjbfgo.supabase.co`**로 표시되는 것을 실제 확인했다. 공개 URL만 읽었고 키·토큰·다른 환경변수 값은 공개하지 않았다. 확인 후 URL이 다시 가려진 화면도 확인했다. 과거 배포별 환경변수 스냅샷은 확인하지 않았으므로 네 Production 배포 모두 운영 DB 쓰기가 가능한 대상으로 보수적으로 취급한다. 현재 환경변수 하나만으로 과거 스냅샷의 ref까지 입증하지 않는다.

### 기존 기능과 실제 확인 범위

| 기능 | 읽기 확인한 실제 상태 | 실행·입증하지 않은 부분 |
| --- | --- | --- |
| Firewall → Custom Rules | Firewall active, Custom Rules 0. New Rule의 조건·Action 메뉴를 열어 **Deny**가 활성 선택지이고 별도 업그레이드 표시가 없는 것을 확인. 입력/추가/Publish하지 않음 | 실제 규칙 저장 권한·전파, 구버전 고유 URL/alias까지의 적용, Host 조건과 배포 고정 요청의 상호작용은 차단 후 probe로 입증 필요 |
| Firewall 우회 | 현재 custom/system bypass 및 IP 차단 규칙 없음. 실행 순서 화면에서 Deployment Protection 뒤에 custom Firewall, 이후 deployment routing 확인 | 이후 생성되는 우회/규칙 및 외부 쓰기 경로는 전환 직전 재확인 필요 |
| Deployment Protection | Require Log In 켜짐, Standard Protection. All Deployments 선택지 표시. 공유 링크/예외/automation bypass secret 목록 비어 있음. Trusted Sources에 자체 프로젝트 한 건 | 팀 사용자·신뢰 토큰은 인증 보호를 통과할 수 있으므로 쓰기 중지 수단이 아님. 설정 변경/저장 안 함 |
| Pause Project | General의 버튼 사용 가능. 화면에 **Preview Deployments는 영향 없음** 명시 | 단독으로 전체 구버전·Preview 또는 이미 실행 중 함수를 멈춘다고 볼 수 없음. Pause 안 함 |
| Skew Protection Threshold | 구버전 배포의 Actions → Threshold 확인창에서 선택 배포 이전의 pinning을 끊는 설명과 **Set 활성 버튼** 확인. Cancel로 닫음 | 현재 Hobby 계정에서 실제 Set 성공·라우팅 효과는 미실행. Advanced 설정의 기능에는 Pro 표시도 있어 UI 존재만으로 실제 변경 가능을 보장하지 않음 |
| 함수 실행 시간 | Functions Advanced의 Max Duration 값은 **빈 값**, placeholder `300`. 네 배포 Fluid Compute 켜짐 | placeholder는 배포 함수의 실제 `maxDuration` 증거가 아님. 구버전까지 포함한 `Dmax` 미확정 |
| Runtime/Request Logs | 조회·필터·Live/새로고침 접근 가능. Environment, Route, Path, Host, Method, Branch, Deployment ID 필터 표시. 조회한 최근 30분은 빈 로그 | 빈 로그는 inflight 0 증거가 아님. 활성 실행 수/종료 완전 관측은 미입증. Route Compute의 Duration/일부 표는 **Demo Data**라 근거에서 제외 |

실제 소스와 공식 문서를 재대조한 운영안은 **프로젝트 전체 요청 임시 Deny → 기존 요청 종료 확인 → SQL·새 앱 전환 → 구버전 hostname 및 배포 고정 API 요청 Deny → 새 앱만 재개**다. GET도 만료를 실행하므로 일부 PATCH/POST만 막지 않는다. 처음에는 Raw Path가 `/`로 시작하는 모든 요청을 차단한다. 마지막 검증에서는 존재하지 않는 probe 경로만 예외로 열어 영구 규칙을 구분해 확인한다.

**이전의 ‘Threshold 필수’ 판단은 수정한다.** `app/lib/reservation-request.ts`, `remote-state.ts`, 관리자 패널의 실제 예약 요청은 배포 ID 없는 일반 `fetch()`이며, Server Actions나 예약을 변경하는 RSC 요청이 아니다. [Skew Protection 공식 문서](https://vercel.com/docs/skew-protection)는 Next.js의 이런 요청은 최신 배포로 간다고 설명한다. `__vdpl`을 설정하는 별도 middleware도 없다. Threshold는 정상 예약 흐름에 필수가 아니며, 공식 지원 요금제도 Pro/Enterprise다. 기존 버튼 표시만으로 Hobby 사용 가능을 보장하지 않는다.

구버전 직접 URL은 hostname 규칙으로 막는다. 임의의 `x-deployment-id`·`dpl`·`__vdpl`로 API를 고정하려는 요청은 **API 경로에 한해 각 키가 존재하면 Deny**한다. 정적 파일의 정상 `?dpl=`은 막지 않는다. [무료 WAF 사용 범위](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing)와 [Header/Query/Cookie/Hostname 조건](https://vercel.com/docs/vercel-firewall/vercel-waf/rule-configuration)을 확인했고, 비변경 config에서 정상 요청 200·세 고정 방식 각각 403을 실제 확인했다. 유료 Threshold를 적용하지 않았다.

함수 종료 상한은 입력 placeholder가 아니라 **확인한 Hobby + 네 배포의 Fluid Compute 상태 + 공식 요금제 최대값 300초**를 근거로 사용한다. 이는 개별 함수의 설정값을 300초로 조회했다는 뜻이 아니라 어떤 설정이더라도 넘을 수 없는 플랫폼 상한이다. 차단 이후 상한 경과와 로그 확인에 더해, 운영 SQL Editor의 `pg_read_all_stats` 권한으로 실제 클라이언트 요청/트랜잭션·숨겨진 클라이언트 세션 0건을 확인해야 한다.

공식 참고: [WAF Custom Rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules), [Deployment Protection 범위](https://vercel.com/docs/deployment-protection), [Pause Project](https://vercel.com/docs/projects/managing-projects#pausing-a-project), [Functions 실행 시간](https://vercel.com/docs/functions/configuring-functions/duration). 유료 기능 구매·전역 설정·유지보수 코드 추가는 하지 않았다.

**아래 B·C 관문이 실제 통과하기 전 SQL을 적용하지 않는다.** 읽기 가능한 화면과 설정 후보를 확인한 결과이며, 차단·진행 중 요청 종료를 보장하거나 운영 전환 준비 완료로 판정한 것이 아니다.

## 4. 예약 쓰기에 연결되는 진입점

HTTP 메서드가 GET이라고 읽기 전용으로 취급하면 안 된다. 운영 전환 때는 `/api/` 전체를 대상으로 보수적으로 차단하는 안을 우선 검토한다.

| 진입점 | 예약/상품에 미치는 영향 |
| --- | --- |
| `POST /api/marketplace/listings/:id/reservations` | 만료 조회/종료 후 생성·재전송 |
| **`GET /api/marketplace/listings/:id/reservations`** | **만료 RPC를 실행한 뒤 예약 조회** |
| **`GET /api/session/state`** | **만료 RPC를 실행한 뒤 상태 조회** |
| `PATCH /api/reservations/:id` | 구매자/판매자 취소, 구매자 일정 수정 |
| `PATCH/DELETE /api/admin/reservations/:id` | 관리자 종료·soft-delete |
| `POST /api/marketplace/listings`, `PATCH/DELETE /api/marketplace/listings/:id` | 상품 생성·상태 편집·삭제 |
| `PATCH/DELETE /api/admin/listings/:id` | 관리자 상품 상태 편집·삭제 |
| `PUT /api/session/state` | 기존 로컬 상품을 서버로 upsert할 수 있음 |

현재 추적한 예약 경로에는 별도 cron/`after`/`waitUntil` 작업이 없다. 그렇다고 운영 외부 작업도 없다고 가정하지 않는다. 운영자 수동 SQL·외부 스크립트·다른 프로젝트의 같은 DB 연결은 별도 목록으로 확인하고 전환 중 중단한다. 공개 가입 플래그는 예약 쓰기 중지 장치가 아니다.

## 5. 운영 실행 절차 — 별도 승인 후에만

### A. 적용 전 대상 고정

1. 승인받은 작업자·시간·점검 창을 기록한다. 검토 파일만 릴리스 커밋으로 고정하고 SHA를 기록한다. 현재는 커밋하지 않았다.
2. 3절의 Project/배포 목록을 전환 직전 새로 대조하고 Team ID와 추가 alias까지 확정한다. **도달 가능한 모든 과거 production/Preview deployment URL 및 branch alias**를 포함한다. 최근 삭제 배포는 복원을 금지하고 새 배포/복원이 생기면 차단 대상을 갱신한다. 각 배포의 DB ref를 확인할 수 없으면 운영 연결 가능 대상으로 포함한다. 키 값은 출력하지 않는다.
3. 현재·과거 배포의 Fluid Compute와 현재 Hobby 요금제를 확인하고, 공식 최대 실행 시간 **300초**를 보수적 상한으로 사용한다. 입력 placeholder나 임의의 대기 시간을 근거로 삼지 않는다. 요금제/실행 방식이 바뀌면 이 상한을 다시 확인한다. 새 배포/자동 재배포는 담당 작업 외에는 진행하지 않는다.
4. 운영 DB의 실제 함수·권한·migration 이력·불일치 후보를 읽기 점검한다. 운영 자격증명은 승인 후 별도 안전한 프로세스 환경에만 넣으며, 테스트 `.env.local`이나 Vercel 기존 환경변수를 덮어쓰지 않는다.

불일치 후보는 내용·사용자 식별자를 출력하지 않고 건수로 먼저 확인한다. 판단 없이 고치지 않는다.

```sql
-- 활성 예약이 있는데 상품이 판매 가능으로 표시되는 후보
select count(*) from public.guest_reservations r
join public.guest_listings l on l.id = r.listing_id
where r.status = 'active' and l.status = 'active';
-- 수동 reserved도 가능하므로 아래 건수는 검토 후보이며 자동 해제 대상이 아니다.
select count(*) from public.guest_listings l
where l.status = 'reserved' and not exists (
  select 1 from public.guest_reservations r where r.listing_id = l.id and r.status = 'active'
);
```

### B. 신규 요청 차단 — 통과해야 진행

1. 기존 Vercel Firewall → Rules → New Rule에서 **Deny**로 전환 중 모든 path·method·host를 차단하는 임시 규칙을 검토한다. UI에서 전체 경로를 나타내는 조건을 확인하며 `Equals /`를 전체 경로로 오인하지 않는다. `/api/`만 막는 안은 모든 쓰기 경로 포함을 입증한 경우에 한한다. Challenge/Log는 차단 완료가 아니다. Review Changes → Publish 후 규칙 ID·시각 `T0`를 기록한다. 이번에는 규칙을 만들거나 Publish하지 않았다.
2. production뿐 아니라 A의 모든 과거/Preview/branch URL에 같은 차단 경계가 적용되는지 확인한다. 배포별 `vercel.json` 변경만으로 구버전도 보호된다고 가정하지 않는다. custom bypass 규칙·보호 예외·자동화 경로를 검토한다.
3. 실제 쓰기 API 대신 존재하지 않는 `/api/__reservation_cutover_probe__/`에 GET과 빈 POST를 보내 차단을 확인한다. 앱의 404/인증 401과 혼동하지 않도록 **Firewall Deny 이벤트·규칙 ID**와 함께 대조한다. 익명·일반 세션·관리자 세션·팀 인증/자동화 접근의 차단을 확인한다. 실제 예약 ID나 사용자 데이터는 사용하지 않는다. 현재 alias에 각 구버전 deployment ID의 `?dpl=` / `x-deployment-id`를 붙인 비변경 probe도 같은 경계에서 차단되는지 확인한다.
4. 한 주소/접근 경로라도 앱까지 도달하거나 전체 URL을 열거하지 못하면 **미준비 → 적용 중단**이다. Pause/Deployment Protection은 보조 수단일 뿐, 미확인 주소를 차단했다고 표시하지 않는다. 다른 Vercel 프로젝트나 직접 DB 작업도 별도로 중단돼야 한다.

### C. 이미 진행 중인 요청 종료 확인 — 통과해야 진행

1. Firewall은 이미 시작한 함수를 되감거나 종료하는 장치가 아니다. `T0` 이전 요청을 Vercel Observability/Logs에서 deployment별로 추적해 끝났는지 확인한다. 쿼리·쿠키·개인정보 본문은 로그로 내보내지 않는다.
2. 모든 구버전의 `Dmax`가 지난 뒤에도 조용한지 확인한다. **시간 경과만으로 통과시키지 않는다.** 별도 읽기 전용 DB 연결에서 PostgREST/API 트랜잭션·잠금 대기를 확인한다. 함수가 타임아웃돼도 이미 전송된 DB 요청이 남을 수 있다.

```sql
-- 대상 DB에서 식별 가능한 API 세션의 상태만 조회한다. 쿼리 본문은 출력하지 않는다.
select pid, application_name, usename, state, xact_start, query_start, wait_event_type
from pg_stat_activity
where datname = current_database() and pid <> pg_backend_pid()
  and (application_name ilike '%postgrest%' or usename in ('authenticator', 'service_role'))
  and (state <> 'idle' or xact_start is not null);
```

3. 이번 운영에서는 역할 이름으로 한정하지 않고, 현재 DB의 **모든 `client backend`**에서 `state <> 'idle' OR xact_start IS NOT NULL`과 `state IS NULL`을 집계한다. 관측 SQL 자신의 PID만 제외한다. `pg_read_all_stats` 권한을 확인한다. Vercel 별도 활성 실행 수 카운터를 읽었다고 주장하지 않는다. 전체 신규 요청 Deny의 실제 probe, 플랫폼의 강제 상한 경과, 그 이후에도 앱 호출이 추가되지 않은 로그, 실제 DB 진행/트랜잭션/숨겨진 클라이언트 0건을 함께 종료 근거로 사용한다. 단순히 빈 로그나 대기 시간만으로 진행하지 않는다.
4. 끝나지 않는 요청은 전환을 서두르기 위해 무차별 kill하지 않는다. 새 migration을 실행하지 않고 차단 상태에서 담당자가 원인을 확인한다. 특정 함수/DB 세션 강제 종료가 필요하면 대상 PID·영향·별도 승인을 확보해야 한다. 이미 커밋된 구버전의 첫 UPDATE는 요청 취소로 되돌아가지 않으므로 종료 후 A의 정합성 후보도 다시 조회한다.

### D. SQL 적용·이력 등록

B·C 통과와 checksum 재확인 후에만 실행한다. 아래는 **운영에서 아직 실행하지 않은 명령 형태**다. 설치 CLI v2.116.0의 도움말로 인자를 확인했다.

```text
supabase db push --dry-run --skip-vault --db-url <승인된 운영 passwordless pooler URL, TLS verify-full>
supabase db push --skip-vault --db-url <같은 승인된 URL>
```

- 비밀번호는 앞선 격리 보정과 같이 환경으로만 전달한다. `--linked`의 암묵적 대상, 비밀번호 포함 URL, `--debug`, reset, seed, roles, `--include-all`은 사용하지 않는다.
- `--skip-vault`는 설정 파일의 Vault secret 동기화까지 같이 실행되지 않게 한다. 인증·기존 환경변수 변경을 migration 적용과 섞지 않는다.
- dry-run에 **202611100001 하나만** 나와야 한다. 다른 pending migration이나 이력 불일치가 나오면 중단한다. CLI는 해당 SQL과 migration 이력을 처리한다.
- SQL이 이미 설치됐는데 이력만 없다면, 함수·권한·checksum 일치를 확인한 경우에만 그 버전의 `migration repair --status applied`를 별도 승인으로 사용한다. 적용하지 않은 SQL을 applied로 표시하지 않는다.
- 종료 코드와 실제 catalog·ledger를 모두 확인한다. 두 함수·grant·이력 1건을 확인하고, `notify pgrst, 'reload schema'` 이후 schema cache에 함수가 보이는지 확인한다. 읽기 설정/카탈로그 확인을 실제 예약 생성 테스트로 확대하지 않는다.

### E. 새 앱 전환·읽기 확인

1. 차단을 유지한 채 승인된 커밋으로 기존 Vercel 프로젝트의 새 production deployment를 준비하고 올바른 대상/DB ref인지 확인한다. Preview가 운영 DB라고 임의로 가정하거나 테스트 설정을 Production에 넣지 않는다. 새 deployment ID·커밋·build 결과를 기록한다.
2. 전환 중 새 앱에 대한 확인은 management/build 정보와 비변경 HTTP만 사용한다. 필요한 경우 **새 deployment hostname의 GET `/`와 GET `/api/account/config/`만** 제한적으로 열고, 나머지 API 차단은 유지한다. 루트 HTML은 JS를 실행하지 않는 요청으로 확인한다. 실제 브라우저를 열면 bootstrap/상태 GET이 쓰기를 발생시킬 수 있어 쓰기 재개 전 점검에 사용하지 않는다.
3. 루트·비변경 config 응답, 승인 커밋/build, DB의 함수/권한/이력 일치와 읽기 전용 정합성 후보를 확인한다. 운영에 테스트 상품·예약·문의를 만들지 않는다.
4. 임시 차단 중 새 수정 배포를 Ready로 확인하고, **API 경로의 배포 고정 키 존재 시 Deny**와 **승인된 최신 앱 hostname 이외 Deny**를 적용한다. Threshold는 사용하지 않는다. 기본 공개 alias·새 앱으로 이동한 main alias·허용하기로 한 수정 배포의 고유 hostname만 허용한다.
5. 임시 전체 차단에는 존재하지 않는 `/api/__reservation_cutover_probe__`만 예외로 열고, 실제 API/루트 차단은 유지한다. 정상 alias의 비고정 probe는 앱의 404, 구버전 hostname 및 고정 키를 붙인 probe는 Firewall 403이어야 한다. 이렇게 임시 전체 Deny에 가려 영구 규칙이 동작하는 것처럼 보이는 오류를 피한다. 구버전 직접 주소와 임의 고정 요청 중 하나라도 앱에 도달하면 차단을 유지한다.

### F. 새 앱에만 쓰기 재개

1. D·E 증거를 검토한 담당자의 별도 재개 승인을 기록한다.
2. 새 production alias·새 deployment만 대상으로 임시 차단을 해제한다. 구버전 hostname Deny와 API 고정 키 Deny는 유지한다. 프로젝트 전체를 일괄 Resume/규칙 삭제해 구버전까지 열지 않는다. 재개 후에도 고정 요청과 직접 구버전 URL에 대한 비변경 probe를 다시 확인한다.
3. 신규 오류·충돌·정합성 후보를 관찰하되 운영 테스트 데이터를 만들지 않는다. 쓰기 재개와 함께 GET 지연 만료도 재개된다는 점을 기록한다.

## 6. 실패 시 중단·복구

| 실패 시점 | 조치 |
| --- | --- |
| B·C 미통과 | SQL·앱 전환을 하지 않는다. 현재 차단을 해제할지 유지할지는 운영 담당자가 결정하고 기록한다. ‘준비 완료’로 처리하지 않는다. |
| SQL 적용 실패 | 차단 유지. SQL의 BEGIN/COMMIT 롤백 여부와 함수 catalog를 실제 확인한다. 이력을 applied로 만들지 않는다. |
| SQL 성공·이력 등록 실패 | 차단 유지. 실제 SQL/권한 일치를 확인한 뒤 해당 한 버전만 repair하는 복구를 검토한다. SQL/seed 전체 재실행하지 않는다. |
| 새 앱 build·전환·읽기 확인 실패 | 차단 유지. 설치한 additive RPC는 남긴 채 앱을 전진 수정한다. 구버전 코드로 돌아가면 비원자적 종료 문제가 돌아오므로 즉시 쓰기를 재개하지 않는다. |
| 쓰기 재개 후 오류 | 새 앱을 포함해 다시 B의 차단·C의 drain 수행. 이미 커밋된 예약은 일괄 취소/삭제하지 않고 읽기 정합성 점검 후 별도 복구 승인. |

`migration repair --status reverted`는 ledger 행을 지울 뿐 SQL을 되돌리지 않는다. 함수 제거·권한 변경·데이터 복원은 이번 준비의 자동 복구 명령에 넣지 않았다. 필요 시 별도 대상·영향 검토를 거친다.

## 7. 남은 승인과 준비 관문

- [x] 릴리스 파일 목록·커밋/푸시 및 실제 배포 승인 — **사용자가 조건부 운영 적용을 승인함**.
- [x] Vercel 프로젝트·배포·접근 보호·Firewall·함수 설정·로그 화면 읽기 확인 — **완료**, 실제 쓰기 권한/효과 검증과 구분.
- [x] 이메일 재인증 후 현재 Production의 공개 Supabase URL ref `exdyfbqhsnreridjbfgo` 확인 — **완료**, 환경변수·키 변경 없음.
- [ ] 과거 배포별 ref/추가 alias·Team ID, 실제 `Dmax` 확정 — **일부 미확인**. DB ref 미확인 배포는 모두 차단 대상으로 포함.
- [ ] 구버전 URL Deny·새 배포 Threshold·임시 전체 차단의 저장/전파와 안전 probe — **미실행**. UI 제공만 확인했으며 비용/권한에 막히면 중단.
- [ ] 진행 중 함수·DB 요청 drain 관측과 다른 쓰기 주체 중단 확보 — **미준비**. 로그 읽기 권한은 확인했지만 종료/활성 0은 입증하지 않음.
- [x] 운영 DB 읽기 사전 점검·해당 migration 적용/이력 확인 승인 — **사용자 승인 범위**.
- [x] 필수 검증 통과 후 **새 앱만** 쓰기 재개 승인 — **사용자 승인 범위**, 단계별 재질문 불필요.

## 8. 2026-11-10 운영 실행 기록

- Hobby에서 안전 probe 전용 Deny를 실제 저장·Publish했다. 최초 경로 조건의 404를 차단으로 오인하지 않고 Raw Path prefix로 수정한 뒤 GET·빈 POST 403을 확인했다. 일반 config는 200이었다.
- `Audit 2 deny pinned API requests` (`rule_audit_2_deny_pinned_api_requests_6rAnkW`): `/api` prefix AND `x-deployment-id` Header 존재, OR 같은 경로 AND `dpl` Query 존재, OR 같은 경로 AND `__vdpl` Cookie 존재 시 Deny. 비변경 config의 정상 200/각 고정 방식 403 확인.
- `Audit 2 temporary full maintenance` (`rule_audit_2_cutover_canary_TlPc2G`): Raw Path starts with `/`, 모든 host/method. Publish 후 **22:37:50 KST**를 보수적 T0로 기록했다. 공개·main branch·네 고유 배포 주소의 안전 probe 모두 403. 공개 루트/config와 빈 POST, 구버전 고정 요청도 403.
- **22:43:00.612 KST**(T0+310초) 운영 `pg_stat_activity`: 관측 권한 true, 숨겨진 클라이언트 0, 진행 중 클라이언트 0, 열린 클라이언트 트랜잭션 0. 차단 전 관측도 0이었다. Vercel Live/refresh 로그의 마지막 앱 호출은 22:36:07의 비변경 config였고 차단 이후 추가 호출은 없었다. `cron.job` 관계는 존재하지 않았다. 배경 프로세스의 NULL state를 숨겨진 사용자 요청으로 계산하지 않았다.
- 운영 URL ref `exdyfbqhsnreridjbfgo`, 적용 SQL 원문의 정규화 SHA256 `9f6134c39e62ce5e7b8a0973664c5a39fda57f4669fb24f9487fb5954e3d322f` 재확인. 브라우저 SQL Editor 입력을 복사해 적용 payload와 정확히 대조한 뒤 실행했다.
- CLI 일괄 `db push`는 사용하지 않았다. 운영 ledger는 초기 `202608280001` 한 건뿐이므로 다른 과거 SQL을 pending이라는 이유로 재실행하지 않았다. **선정한 SQL 한 건 + 해당 ledger INSERT만 한 트랜잭션**으로 적용했고 `Success. No rows returned` 응답을 확인했다. 인증·환경변수·기존 사용자 행에 대한 DML은 실행하지 않았다.
- 이력 원문 생성 시 JavaScript replacement의 `$$` 해석으로 metadata 문자열만 달라진 것을 발견했다. 설치된 함수 정의는 검증본과 일치했다. 해당 버전·이름·기존 hash로 한정해 **ledger의 statements 한 행만** 정정했으며 SQL 함수 설치를 재실행하지 않았다. RETURNING 1행과 최종 정규화 source checksum 일치를 확인했다.
- 두 함수의 정규화 정의 SHA256은 1절의 격리 검증본과 일치한다. `SECURITY INVOKER`, `search_path=public`, PUBLIC/anon/authenticated 실행 false, service_role true 확인. ledger는 초기 버전과 `202611100001` 각 한 건이다.
- 현재 단계: **SQL/이력/권한 검증 완료, 전체 차단 유지, 범위 내 GitHub 반영과 새 앱 전환 진행 중**. 이후 완료 여부는 실제 배포·probe 결과로만 갱신한다. 이전 테스트/빌드/격리 검증은 재실행하지 않았다.

따라서 현재 판정은 **개발/격리 검증/격리 이력 정리 완료, Vercel 실제 읽기 확인과 조건부 전환 절차 반영 완료, 운영 쓰기 차단·drain 보장은 미완료**다. 새로운 유지보수 기능·서비스 코드·운영 설정을 추가하지 않았다. ‘Pause만으로 전체 정지’, ‘GET은 읽기’, ‘alias 전환/hostname 차단만으로 pinning 종료’, ‘빈 로그=drain 완료’, ‘placeholder=실제 함수 제한’, ‘repair=SQL 롤백’으로 판단하지 않는다. 기존 테스트·격리 이력 보정·빌드는 변경이 없어 반복하지 않았다.
