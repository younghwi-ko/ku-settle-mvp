import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// 의도적으로 승인된 격리 프로젝트 하나만 허용한다. localhost/운영 URL로 대체하지 않는다.
const env = { ...parseEnv(readFileSync('.env.local', 'utf8')), ...process.env };
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'INTEGRATION_SUPABASE_PROJECT_REF', 'SUPABASE_DB_PASSWORD', 'TEST_DB_CA_FILE'];
const missing = required.filter(key => !env[key]);
if (missing.length) { console.error(`미설정: ${missing.join(', ')}`); process.exit(2); }
let ref;
try {
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  ref = env.INTEGRATION_SUPABASE_PROJECT_REF;
  assert.equal(ref, 'nlzcikoxttenpcflikpd');
  assert.equal(url.origin, `https://${ref}.supabase.co`);
  assert.equal(env.INTEGRATION_TEST_MODE, 'true');
} catch { console.error('격리 대상 확인 실패: 연결·쓰기 없이 종료'); process.exit(2); }
const options = {
  host: `db.${ref}.supabase.co`, port: 5432, user: 'postgres', database: 'postgres',
  password: env.SUPABASE_DB_PASSWORD, connectionTimeoutMillis: 10000,
  ssl: { ca: readFileSync(env.TEST_DB_CA_FILE, 'utf8'), rejectUnauthorized: true },
};
const connections = [];
const sessions = [randomUUID(), randomUUID(), randomUUID()];
const [seller, buyer, stranger] = sessions;
const triggerName = `reservation_test_${randomUUID().replaceAll('-', '')}`;
let fixtureStarted = false, triggerCreated = false, checks = 0, failed = false, cleanupFailed = false;
async function connect() {
  const client = new pg.Client(options); connections.push(client);
  await client.connect();
  await client.query("set statement_timeout='15s'; set lock_timeout='10s'");
  return client;
}
async function check(name, run) { await run(); checks++; console.log(`확인 ${checks}: ${name}`); }
async function create(client, listing, key = randomUUID(), actor = buyer) {
  return (await client.query('select public.create_guest_reservation($1,$2,$3,$4,$5,$6,$7) as result',
    [listing, actor, '격리 검증', '2099-01-01', '10:00', '11:00', key])).rows[0].result;
}
async function close(client, row, status = 'cancelled', mode = 'user', actor = buyer) {
  return (await client.query('select public.transition_guest_reservation($1,$2,$3,$4,$5,$6) as result',
    [row.id, actor, status, row.version, mode, null])).rows[0].result;
}
async function listing(client) {
  const id = randomUUID();
  await client.query(`insert into public.guest_listings(id,session_id,seller_name,item_name,price_krw,category,condition,pickup_location)
    values($1,$2,'격리 판매자','격리 테스트 상품',1000,'home','good','테스트 장소')`, [id, seller]);
  return id;
}
async function status(client, id) { return (await client.query('select status from public.guest_listings where id=$1', [id])).rows[0].status; }
async function denied(run, message, code = 'P0001') {
  await assert.rejects(run, error => error.code === code && (message === null || error.message === message));
}
async function waitsForLock(observer, pid) {
  for (let n = 0; n < 50; n++) {
    const row = (await observer.query('select wait_event_type from pg_stat_activity where pid=$1', [pid])).rows[0];
    if (row?.wait_event_type === 'Lock') return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail('별도 DB 연결의 실제 잠금 대기를 확인하지 못함');
}
try {
  const db = await connect();
  assert.equal((await db.query("select to_regclass('public.guest_reservations') is not null as ready")).rows[0].ready, true);
  if (process.argv.includes('--apply')) {
    await db.query(readFileSync(new URL('../supabase/migrations/202611100001_atomic_guest_reservations.sql', import.meta.url), 'utf8'));
    console.log('격리 DB에만 신규 RPC 마이그레이션 적용');
  }
  assert.equal((await db.query("select to_regprocedure('public.create_guest_reservation(uuid,uuid,text,date,time,time,text)') is not null as ready")).rows[0].ready, true);
  // 서로 다른 실제 연결에서 service_role 권한으로 RPC를 실행한다.
  const a = await connect(), b = await connect();
  await a.query('set role service_role'); await b.query('set role service_role');
  const pidB = (await b.query('select pg_backend_pid() as pid')).rows[0].pid;
  fixtureStarted = true;
  for (const id of sessions) await db.query('insert into public.anonymous_sessions(id,token_hash) values($1,$2)', [id, randomUUID()]);

  await check('정상 생성·취소·재시도와 상품 복원', async () => {
    const id = await listing(db), key = randomUUID();
    const first = await create(a, id, key), replay = await create(b, id, key);
    assert.equal(first.created, true); assert.equal(replay.created, false);
    assert.equal(first.reservation.id, replay.reservation.id); assert.equal(await status(db, id), 'reserved');
    const ended = await close(a, first.reservation);
    assert.equal(ended.reservation.status, 'cancelled'); assert.equal(await status(db, id), 'active');
    assert.equal((await close(b, first.reservation)).changed, false);
    assert.equal((await create(a, id, key)).reservation.status, 'cancelled');
  });
  await check('관리자 완료·soft-delete·만료 및 중복 종료', async () => {
    for (const terminal of ['completed', 'soft_deleted', 'expired']) {
      const id = await listing(db), { reservation } = await create(a, id);
      if (terminal === 'expired') await db.query("update public.guest_reservations set expires_at=now()-interval '1 second' where id=$1", [reservation.id]);
      const mode = terminal === 'expired' ? 'expiry' : 'admin';
      const result = await close(a, reservation, terminal, mode);
      assert.equal(result.reservation.status, terminal);
      assert.equal(await status(db, id), terminal === 'completed' ? 'sold' : 'active');
      assert.equal((await close(b, result.reservation, terminal, mode)).changed, false);
    }
  });
  await check('과거 R1 정리로 현재 활성 R2를 해제하지 않음', async () => {
    const id = await listing(db), r1 = (await create(a, id)).reservation;
    const ended = (await close(a, r1)).reservation;
    const r2 = (await create(b, id)).reservation;
    await close(a, ended, 'soft_deleted', 'admin');
    assert.equal(await status(db, id), 'reserved');
    assert.equal((await db.query('select status from public.guest_reservations where id=$1', [r2.id])).rows[0].status, 'active');
  });
  await check('sold·hidden·deleted 상품 상태 보존', async () => {
    for (const value of ['sold','hidden','deleted']) {
      const id = await listing(db), row = (await create(a, id)).reservation;
      await db.query('update public.guest_listings set status=$2 where id=$1', [id, value]);
      await close(a, row); assert.equal(await status(db, id), value);
    }
  });
  await check('사용자 권한·소유 상품·version·키 충돌 및 미래 만료 거부', async () => {
    const id = await listing(db), key = randomUUID(), row = (await create(a, id, key)).reservation;
    await denied(() => close(a, row, 'cancelled', 'user', stranger), 'forbidden');
    await denied(() => close(a, { ...row, version: row.version + 1 }, 'completed', 'admin'), 'version_conflict');
    await denied(() => a.query('select public.create_guest_reservation($1,$2,$3,$4,$5,$6,$7)', [id,buyer,'격리 검증','2099-01-01','10:00','12:00',key]), 'idempotency_conflict');
    assert.equal((await close(a, row, 'expired', 'expiry')).changed, false);
    const own = await listing(db); await denied(() => create(a, own, randomUUID(), seller), 'cannot_reserve_own_listing');
    await denied(() => close(a, row, 'completed', 'user'), 'invalid_reservation_update');
    await db.query('update public.anonymous_sessions set revoked_at=now() where id=$1', [stranger]);
    await denied(() => create(a, own, randomUUID(), stranger), 'forbidden');
    for (const role of ['anon', 'authenticated']) {
      await db.query(`set role ${role}`);
      try {
        await denied(() => create(db, own), null, '42501');
        await denied(() => close(db, row, 'completed', 'admin'), null, '42501');
      } finally { await db.query('reset role'); }
    }
  });
  await check('상품 변경 중 오류 시 생성·취소·완료·만료 전체 롤백', async () => {
    await db.query(`create function pg_temp.reservation_fault() returns trigger language plpgsql as $$ begin
      if current_setting('ku_test.fail_listing',true)='on' and new.session_id='${seller}'::uuid then raise exception 'injected_test_failure'; end if;
      return new; end $$`);
    await db.query(`create trigger ${triggerName} before update on public.guest_listings for each row execute function pg_temp.reservation_fault()`);
    triggerCreated = true;
    const id = await listing(db);
    const inject = async run => {
      await db.query('begin'); await db.query("select set_config('ku_test.fail_listing','on',true)");
      try { await denied(run, 'injected_test_failure'); } finally { await db.query('rollback'); }
    };
    await inject(() => create(db, id));
    assert.equal((await db.query('select count(*)::int as n from public.guest_reservations where listing_id=$1', [id])).rows[0].n, 0);
    assert.equal(await status(db, id), 'active');
    const row = (await create(a, id)).reservation;
    await db.query("update public.guest_reservations set expires_at=now()-interval '1 second' where id=$1", [row.id]);
    for (const terminal of ['cancelled','completed','expired','soft_deleted']) {
      await inject(() => close(db, row, terminal, terminal === 'expired' ? 'expiry' : 'admin'));
      const saved = (await db.query('select status,version from public.guest_reservations where id=$1', [row.id])).rows[0];
      assert.equal(saved.status, 'active'); assert.equal(saved.version, row.version); assert.equal(await status(db, id), 'reserved');
    }
    await db.query(`drop trigger ${triggerName} on public.guest_listings`); triggerCreated = false;
  });
  await check('별도 연결: 사용자 취소·만료·관리자 종료 커밋을 기다린 생성', async () => {
    for (const [mode, terminal] of [['user','cancelled'],['expiry','expired'],['admin','soft_deleted'],['admin','completed']]) {
      const id = await listing(db), row = (await create(a, id)).reservation;
      if (mode === 'expiry') await db.query("update public.guest_reservations set expires_at=now()-interval '1 second' where id=$1", [row.id]);
      await a.query('begin');
      try {
        await close(a, row, terminal, mode);
        // 거부도 즉시 핸들링하여 대기 중 unhandled rejection이 되지 않게 한다.
        const pending = create(b, id).then(value => ({ value }), error => ({ error }));
        await waitsForLock(db, pidB); await a.query('commit');
        const result = await pending;
        if (terminal === 'completed') {
          assert.equal(result.error?.message, 'listing_unavailable'); assert.equal(await status(db, id), 'sold');
        } else {
          assert.equal(result.value?.reservation.status, 'active'); assert.equal(await status(db, id), 'reserved');
        }
      } finally { await a.query('rollback'); }
    }
  });
  await check('별도 연결: 생성 커밋 후 과거 취소·만료 재시도는 새 예약 보존', async () => {
    for (const mode of ['user','expiry','admin']) {
      const id = await listing(db), old = (await create(a, id)).reservation;
      const ended = (await close(a, old)).reservation;
      await a.query('begin');
      try {
        const next = (await create(a, id)).reservation;
        const pending = close(b, mode === 'admin' ? ended : old, mode === 'admin' ? 'soft_deleted' : mode === 'expiry' ? 'expired' : 'cancelled', mode); pending.catch(() => {});
        await waitsForLock(db, pidB); await a.query('commit');
        assert.equal((await pending).changed, mode === 'admin'); assert.equal(await status(db, id), 'reserved');
        assert.equal((await db.query('select status from public.guest_reservations where id=$1',[next.id])).rows[0].status,'active');
      } finally { await a.query('rollback'); }
    }
  });
  await check('별도 연결: 동시 생성·동일 키 재전송·동시 종료', async () => {
    const id = await listing(db), key = randomUUID();
    await a.query('begin');
    let first;
    try {
      first = await create(a,id,key);
      const pending = create(b,id,key); pending.catch(() => {});
      await waitsForLock(db,pidB); await a.query('commit');
      assert.equal((await pending).reservation.id, first.reservation.id);
    } finally { await a.query('rollback'); }
    const duplicate = await Promise.allSettled([close(a,first.reservation),close(b,first.reservation)]);
    assert.equal(duplicate.every(x=>x.status==='fulfilled'),true);
    assert.equal(duplicate.filter(x=>x.value.changed).length,1);
    const second = await listing(db);
    const competing = await Promise.allSettled([create(a,second),create(b,second)]);
    assert.equal(competing.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(competing.find(x=>x.status==='rejected').reason.message,'listing_unavailable');
    assert.equal(await status(db,second),'reserved');
  });
} catch (error) {
  failed = true;
  console.error(`검증 실패: ${error.code ?? error.name ?? 'unknown'}${error.name === 'AssertionError' ? ' (기대 결과 불일치)' : ''}`);
} finally {
  const db = connections[0];
  for (const c of connections) { try { await c.query('rollback'); } catch { /* 연결 실패는 아래 정리에서 보고 */ } }
  if (db && fixtureStarted) {
    try {
      await db.query('reset role');
      if (triggerCreated) await db.query(`drop trigger if exists ${triggerName} on public.guest_listings`);
      await db.query('delete from public.anonymous_sessions where id=any($1::uuid[])', [sessions]);
      const remaining = await db.query(`select
        (select count(*) from public.anonymous_sessions where id=any($1::uuid[])) +
        (select count(*) from public.guest_listings where session_id=any($1::uuid[])) +
        (select count(*) from public.guest_reservations where buyer_session_id=any($1::uuid[])) as n`, [sessions]);
      assert.equal(Number(remaining.rows[0].n),0);
      console.log('테스트 데이터·오류 주입 트리거 정리 확인');
    } catch (error) { cleanupFailed = true; console.error(`정리 실패: ${error.code ?? error.name}`); }
  }
  for (const c of connections) await c.end().catch(() => { cleanupFailed = true; });
}
console.log(`최종: ${checks}개 검증 그룹, 검증 ${failed ? '실패' : '통과'}, 정리 ${cleanupFailed ? '실패' : fixtureStarted ? '완료' : '불필요'}`);
process.exitCode = failed || cleanupFailed ? 1 : 0;
