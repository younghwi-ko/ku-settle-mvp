# 감사 7·8·9번 상품 재공개 검증과 운영 적용안

## 재현과 수정

기존 `pnpm run test:reservation:http` 러너를 확장했다. 익명 판매자·예약자·다른 구매자 세션을 각각 만들고, 로컬 Chromium에서 실제 HTTP를 호출해 격리 Supabase의 저장 결과와 대조한다. 외부 브라우저 요청은 차단하며 앱 API 응답은 그대로 사용한다.

수정 전 활성 예약이 있는 상품을 숨겼다가 다시 공개하면 PATCH와 공개 API가 `active`를 반환했다. DB는 `active/available`로 바뀌었고 다른 구매자 상세에 예약 버튼이 나타났다.

[202611110001 migration](../supabase/migrations/202611110001_keep_guest_listing_reserved.sql)은 상품 상태를 `active`로 바꾸는 DB 업데이트 안에서 활성 예약을 확인한다. 예약 생성·종료 RPC와 상품 행 잠금을 공유하므로, 활성 예약이 있으면 반환 행도 `reserved/reserved`가 된다. 브라우저는 재공개 요청의 `reserved` 응답을 정상 저장으로 처리한다. 기존 행을 일괄 수정하는 구문은 없다. [PostgreSQL 트리거의 데이터 가시성](https://www.postgresql.org/docs/17/trigger-datachanges.html)

- 격리 대상은 `nlzcikoxttenpcflikpd`다. CLI dry-run에서 해당 migration 하나를 확인하고 적용 후 이력 1건과 활성 트리거 1개를 대조했다.
- UTF-8, CRLF를 LF로 정규화한 SQL SHA-256은 `751c3f5f1ae4ec5eb1dd7093e6b4aebd35393d04be20fc1034ead59a18d9f8e5`다.
- 운영 앱 배포와 운영 DB 적용은 별개다. 실제 운영 동작이 바뀌려면 아래의 DB 적용이 필요하다.

## 검증 결과

- 2026-11-13 실제 격리 DB 검증에서 11개 그룹이 통과했다. 상품 편집과 타인 상품 제외, 숨김과 재공개, 판매자 목록 취소를 브라우저에서 실행하고 새로고침 결과를 DB와 대조했다. 재공개 응답·공개 API·DB에 예약 상태가 남았고 다른 구매자에게 예약 버튼이 표시되지 않았다. 동시 요청에서는 재공개가 취소의 행 잠금 해제를 기다린 뒤 `active/available`로 저장됐다. 테스트 세션과 생성 데이터 정리를 확인했다.
- 별도 `pnpm test`는 21개 파일·170개 테스트와 8개 언어 검증을 통과했다. 이 결과에는 단위 및 모의 핸들러 테스트가 포함된다.
- Ponytail 리뷰에서 판매자·관리자 상태 변경과 예약 생성·취소·만료 경로를 대조했다. 같은 상품 행을 잠그는 기존 RPC와 함께 동작하며, 앱에서 별도 예약 조회 후 업데이트하는 구간을 만들지 않는다.

## 운영 적용 순서

1. 승인된 작업 시간에 운영 프로젝트 `exdyfbqhsnreridjbfgo`의 TLS 검증 연결과 마이그레이션 이력을 확인한다. `202611100001` 예약 RPC 적용 상태와 위 파일의 체크섬을 대조한다. 운영 계정·인증 설정은 변경하지 않는다.
2. 아래 읽기 쿼리로 이미 잘못 공개된 상품의 건수를 확인한다. 0건이면 다음으로 진행한다. 양수면 신규 트리거 적용과 기존 행 보정을 별도로 계획한다. 이 migration은 기존 행을 건드리지 않는다.

   ```sql
   select count(*) as active_listings_with_active_reservation
   from public.guest_listings l
   where l.status = 'active'
     and exists (
       select 1 from public.guest_reservations r
       where r.listing_id = l.id and r.status = 'active'
     );
   ```

3. 비밀번호 없는 운영 연결 URL과 TLS 호스트 검증을 사용해 `pnpm exec supabase db push --skip-vault --db-url <운영 URL> --dry-run`을 실행한다. 예상 파일이 위 migration 한 개일 때만 같은 연결에서 `--dry-run`을 빼고 적용한다. 잠금 대기 5초 제한에 걸리면 트랜잭션이 실패하므로 작업 시간과 잠금 점유를 확인하고 다시 시도한다.
4. 이력 `202611110001` 1건, `public.guest_listings`의 `keep_guest_listing_reserved` 트리거 활성, 함수의 `SECURITY INVOKER` 및 공개 실행 권한 부재를 카탈로그에서 확인한다. 공개 앱과 배포 고정 요청 차단은 읽기 전용 요청으로 확인한다. 운영 상품이나 예약을 검증 목적으로 생성하지 않는다.
5. 문제가 생기면 우선 앱과 DB의 버전을 대조한다. 앱만 이전 동작으로 돌려도 기존 브라우저의 재조회가 트리거가 반환한 예약 상태를 다시 읽는다. 트리거 제거가 필요한 경우 별도 승인된 후속 migration에서 트리거, 함수 순으로 제거한다. 제거 시 활성 예약 상품 재공개 문제가 돌아올 수 있으므로 기존 Firewall 차단을 유지한다.
