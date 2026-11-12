import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { getCACertificates } from 'node:tls';
import pg from 'pg';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const env = { ...parseEnv(readFileSync('.env.local', 'utf8')), ...process.env };
const ref = 'nlzcikoxttenpcflikpd', origin = 'http://127.0.0.1:3102';
const missing = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_DB_PASSWORD','TEST_DB_CA_FILE'].filter(k=>!env[k]);
if (missing.length) { console.error(`미설정: ${missing.join(', ')}`); process.exit(2); }
try {
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, `https://${ref}.supabase.co`);
  assert.equal(env.INTEGRATION_SUPABASE_PROJECT_REF, ref); assert.equal(env.INTEGRATION_TEST_MODE,'true');
  assert.notEqual(env.VERCEL_ENV,'production');
  const jwt = JSON.parse(Buffer.from(env.SUPABASE_SERVICE_ROLE_KEY.split('.')[1],'base64url'));
  assert.equal(jwt.ref,ref); assert.equal(jwt.role,'service_role'); assert.ok(jwt.exp * 1000 > Date.now());
} catch { console.error('격리 URL/ref/서버 키 확인 실패. 앱 실행·쓰기 없이 종료'); process.exit(2); }
const db = new pg.Client({ host:'aws-0-ap-northeast-2.pooler.supabase.com',user:`postgres.${ref}`,database:'postgres',password:env.SUPABASE_DB_PASSWORD,
  ssl:{ca:[...getCACertificates('system'),readFileSync(env.TEST_DB_CA_FILE,'utf8')],rejectUnauthorized:true},connectionTimeoutMillis:10000 });
const run = `reservation-http-${randomUUID()}`, adminToken = randomBytes(32).toString('hex');
const sha = value=>createHash('sha256').update(value).digest('hex');
const sessions = new Set(), rateKeys = new Set();
const authAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}).auth.admin;
const guard = `http_guard_${randomUUID().replaceAll('-','')}`;
let browser, child, fixtureAccountId, guarded=false, appVerified=false, stage='격리 사전 확인', failed=false, cleanupFailed=false, checks=0;
const initialHashes = new Map();
const initialNextEnv = readFileSync('next-env.d.ts');
for (const p of ['AGENTS.md','.env.local','.agents/skills/ponytail/SKILL.md','.agents/skills/ponytail-audit/SKILL.md','docs/ponytail-audit-2026-11-10.md','docs/ponytail-development-usage.md']) initialHashes.set(p,sha(readFileSync(p)));
async function context() {
  const c = await browser.newContext({serviceWorkers:'block',extraHTTPHeaders:{origin,'user-agent':run,'x-forwarded-for':'127.0.0.1'}});
  // 외부 요청은 차단만 한다. API 응답을 대체하거나 모킹하지 않는다.
  await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  return c;
}
async function request(c,path,method='GET',data,headers={}) {
  assert.equal(appVerified,true);
  const url = new URL(path,origin); assert.equal(url.origin,origin);
  url.pathname=url.pathname.replace(/\/$/,'')+'/';
  if (url.pathname.startsWith('/api/admin/')) {
    const cookies=(await c.cookies(origin)).map(x=>`${x.name}=${x.value}`).join('; ');
    rateKeys.add(sha(`${adminToken}:${url.pathname==='/api/admin/session/'?`127.0.0.1:${run}`:cookies||'admin-session'}`));
  }
  const response=await c.request.fetch(url.href,{method,data,headers,maxRedirects:0});
  assert.ok(response.status()<300||response.status()>=400,'예상하지 않은 리디렉션');
  return { status:response.status(),body:await response.json() };
}
async function expected(c,path,method,data,status,headers) {
  const result=await request(c,path,method,data,headers); assert.equal(result.status,status); return result.body;
}
async function bootstrap(c) {
  const body=await expected(c,'/api/session/bootstrap','POST',undefined,200);
  assert.match(body.sessionId,/^[a-f0-9-]{36}$/); sessions.add(body.sessionId);
  assert.ok((await c.cookies()).some(x=>x.name==='ku_settle_session'&&x.httpOnly));
  return body.sessionId;
}
async function item(c) {
  return (await expected(c,'/api/marketplace/listings','POST',{
    clientId:randomUUID(),sellerName:'격리 테스트',itemName:run,description:'폐기용 테스트 상품',priceKrw:1000,
    category:'home',condition:'good',pickupLocation:'격리 장소',imageDataUrl:null,
  },201)).listing;
}
async function reserve(c,id,key=randomUUID(),status=201) {
  const result=await expected(c,`/api/marketplace/listings/${id}/reservations`,'POST',{
    buyerName:'격리 구매자',pickupDate:'2099-01-01',pickupStartTime:'10:00',pickupEndTime:'11:00',
  },status,{'x-idempotency-key':key});
  return result.reservation;
}
async function stateMatches(row,reservationStatus,listingStatus) {
  const saved=(await db.query(`select r.status,r.version,l.status as listing_status from public.guest_reservations r
    join public.guest_listings l on l.id=r.listing_id where r.id=$1`,[row.id])).rows[0];
  assert.equal(row.status,reservationStatus); assert.equal(saved.status,row.status);
  assert.equal(saved.version,row.version); assert.equal(saved.listing_status,listingStatus);
}
function passed(label){checks++;console.log(`확인 ${checks}: ${label}`);}
try {
  // 기존 앱이 같은 포트에 있으면 앱/DB를 호출하기 전에 종료한다.
  await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(3102,'127.0.0.1',()=>probe.close(resolve));});
  await db.connect(); await db.query("set statement_timeout='15s'; set lock_timeout='10s'");
  const migration=readFileSync('supabase/migrations/202611100001_atomic_guest_reservations.sql','utf8').replaceAll('\r\n','\n');
  for(const name of ['create_guest_reservation','transition_guest_reservation']) {
    const rows=(await db.query(`select p.oid,p.prosrc,p.prosecdef,p.proconfig,p.prorettype::regtype::text as result_type,
      pg_get_function_arguments(p.oid) as arguments from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and proname=$1`,[name])).rows;
    assert.equal(rows.length,1); const f=rows[0];
    const source=migration.split(`create or replace function public.${name}(`)[1]?.split('as $$')[1]?.split('$$;')[0]?.trim();
    assert.equal(f.prosrc.replaceAll('\r\n','\n').trim(),source); assert.equal(f.prosecdef,false);
    assert.deepEqual(f.proconfig,['search_path=public']); assert.equal(f.result_type,'jsonb');
    const args=name==='create_guest_reservation'
      ?'p_listing_id uuid, p_session_id uuid, p_buyer_name text, p_pickup_date date, p_start time without time zone, p_end time without time zone, p_key text'
      :"p_id uuid, p_session_id uuid, p_status text, p_version integer, p_mode text, p_reason text DEFAULT NULL::text";
    assert.equal(f.arguments,args);
    for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') as allowed",[role,f.oid])).rows[0].allowed,role==='service_role');
  }
  const ledger=(await db.query("select version from supabase_migrations.schema_migrations where version='202611100001'")).rowCount;
  console.log(`함수 본문·인자·보안·권한 일치. migration 이력 등록 ${ledger}건. SQL 파일 SHA256 ${sha(migration)}`);
  const applied=new Set((await db.query('select version from supabase_migrations.schema_migrations')).rows.map(x=>x.version));
  console.log('로컬 파일 중 이력 미등록 버전:',readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).map(x=>x.split('_')[0]).filter(x=>!applied.has(x)).sort().join(', '));
  assert.equal((await db.query("select count(*)::int as n from public.guest_reservations where status='active' and expires_at<=now()+interval '20 minutes'")).rows[0].n,0,'기존 예약의 자동 만료 위험');
  const before=(await db.query('select key_hash,window_started_at,request_count from public.admin_rate_limit_buckets')).rows;
  // 기존 자동 정리 대상도 보존한다. 새 요청의 카운트/인증/RLS/RPC grant는 변경하지 않는다.
  const oldKeys=before.map(x=>x.key_hash); assert.ok(oldKeys.every(x=>/^[a-f0-9]{64}$/.test(x)));
  await db.query(`create function pg_temp.${guard}() returns trigger language plpgsql as $$ begin
    if old.key_hash=any(array[${oldKeys.map(x=>`'${x}'`).join(',')}]::text[]) then return null; end if; return old; end $$`);
  await db.query(`create trigger ${guard} before delete on public.admin_rate_limit_buckets for each row execute function pg_temp.${guard}()`); guarded=true;
  // 생성하는 비밀값은 자식 프로세스 환경에서만 사용한다. 로그/파일/셸 인자에 넣지 않는다.
  child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3102'],{
    env:{...env,NODE_ENV:'development',ADMIN_API_TOKEN:adminToken,INTEGRATION_TEST_SECRET:randomBytes(32).toString('hex'),ACCOUNT_SIGNUP_ENABLED:'false',EMAIL_DELIVERY_ENABLED:'false',EMAIL_PROVIDER_VERIFIED:'false',AUTH_EMAIL_DOMAIN_VERIFIED:'false'},stdio:'ignore',windowsHide:true,
  });
  let ready=false;
  for(let n=0;n<120;n++) {
    if(child.exitCode!==null)throw Error('local_app_exited');
    try {
      const response=await fetch(`${origin}/api/integration/environment/`,{redirect:'manual'});
      assert.equal(response.status,200); const body=await response.json();
      assert.equal(body.isolated,true); assert.equal(body.projectRef,ref); ready=true; break;
    }catch { await new Promise(resolve=>setTimeout(resolve,500)); }
  }
  assert.equal(ready,true); appVerified=true; passed('DB/ref/함수 및 동일 origin 앱 격리 확인 — 브라우저 진입 전');
  browser=await chromium.launch({headless:true});
  const seller=await context(),buyer=await context(),other=await context(),admin=await context();
  const sellerId=await bootstrap(seller),buyerId=await bootstrap(buyer),otherId=await bootstrap(other);
  assert.equal(new Set([sellerId,buyerId,otherId]).size,3);
  stage='관리자 인증';
  await expected(admin,'/api/admin/session','POST',{token:adminToken+'invalid',operatorName:run},403);
  assert.equal((await admin.cookies()).some(x=>x.name==='ku_settle_admin'),false);
  await expected(admin,'/api/admin/session','POST',{token:adminToken,operatorName:run},200);
  assert.ok((await admin.cookies()).some(x=>x.name==='ku_settle_admin'&&x.httpOnly));
  passed('서로 다른 3개 익명 세션과 실제 관리자 쿠키 인증·잘못된 토큰 거부');
  stage='생성·재전송·권한 거부';
  const listing=await item(seller),key=randomUUID(),r1=await reserve(buyer,listing.id,key);
  assert.equal((await reserve(buyer,listing.id,key,200)).id,r1.id); await stateMatches(r1,'active','reserved');
  const adminPath=`/api/admin/reservations/${r1.id}`,userPath=`/api/reservations/${r1.id}`;
  const noPrivilege=await expected(other,userPath,'PATCH',{status:'cancelled'},403);assert.equal(noPrivilege.error,'forbidden');
  const noAdmin=await expected(buyer,adminPath,'PATCH',{status:'completed',version:r1.version},401);assert.equal(noAdmin.error,'admin_required');
  await expected(other,`/api/marketplace/listings/${listing.id}`,'PATCH',{itemName:'거부 대상'},409);
  await expected(seller,`/api/marketplace/listings/${listing.id}/reservations`,'POST',{buyerName:'격리',pickupDate:'2099-01-01',pickupStartTime:'10:00',pickupEndTime:'11:00'},409);
  await stateMatches(r1,'active','reserved');
  for(const [c,hasMine] of [[buyer,true],[other,false]]) {
    const data=await expected(c,'/api/me/reservations','GET',undefined,200);
    assert.equal(data.reservations.some(x=>x.id===r1.id),hasMine);
  }
  assert.ok((await expected(seller,'/api/session/state','GET',undefined,200)).reservations.some(x=>x.id===r1.id));
  passed('생성·동일 키 재전송, 구매자/판매자 조회 구분, 타 세션 변경·일반 사용자 관리자 요청 거부와 DB 무변경');
  stage='실제 브라우저 새로고침';
  await buyer.addInitScript(()=>localStorage.setItem('ku-settle-setup-skipped:guest','1'));
  const page=await buyer.newPage();page.setDefaultTimeout(20000);
  await page.goto(`${origin}/?lang=ko&page=marketplace&listing=${listing.id}`,{waitUntil:'networkidle'});
  const restored=()=>page.waitForFunction(id=>JSON.parse(localStorage.getItem('ku-settle-local-data-v6')??'null')?.preferences.reservations.some(x=>x.id===id&&x.status==='active'),r1.id);
  await restored(); await page.locator('.modal .availability.reserved').waitFor();
  // 로컬 예약 기록을 제거한 뒤 실제 reload가 서버에서 복구하는지 확인한다.
  await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('ku-settle-local-data-v6'));d.preferences.reservations=[];d.preferences.reservedProductIds=[];localStorage.setItem('ku-settle-local-data-v6',JSON.stringify(d));});
  await page.reload({waitUntil:'networkidle'});await restored();await page.locator('.modal .availability.reserved').waitFor();
  await stateMatches(r1,'active','reserved');passed('실제 Chromium reload 후 HTTP 서버 예약 ID·상태 복구와 상세 표시');
  stage='판매자 수정과 타인 상품 제외';
  const openMarket = async (c, id) => {
    await c.addInitScript(() => localStorage.setItem('ku-settle-setup-skipped:guest','1'));
    const tab = await c.newPage();
    tab.setDefaultTimeout(20000);
    await tab.goto(`${origin}/?lang=ko&page=marketplace${id ? `&listing=${id}` : ''}`,{waitUntil:'networkidle',timeout:60000});
    return tab;
  };
  const leaving = tab => tab.getByRole('button',{name:'곧 출국해요',exact:true}).click();
  const sellerPage=await openMarket(seller),otherPage=await openMarket(other,listing.id);
  stage='타인 상품 상세 소유권';
  await otherPage.getByRole('dialog',{name:run,exact:true}).waitFor();
  assert.equal(await otherPage.locator('.owner-listing-actions').count(),0);
  stage='실제 상품 신고 거절·연속 제출·관리자 목록';
  const reportRoute=/\/api\/reports\/?$/;
  const reportModal=otherPage.getByRole('dialog',{name:'상품 신고',exact:true});
  const reportButton=reportModal.getByRole('button',{name:'신고 제출',exact:true});
  const reportDetail=reportModal.locator('textarea');
  const reportSuccess=otherPage.getByRole('status').filter({hasText:'신고가 접수되었습니다.'});
  const reportRows=async()=> (await db.query('select id,listing_id,reason,detail,status from public.guest_reports where session_id=$1 order by created_at',[otherId])).rows;
  const fillReport=async detail=>{
    await otherPage.getByRole('button',{name:'상품 신고',exact:true}).click();
    await reportModal.locator('select').selectOption('other');
    await reportDetail.fill(detail);
  };
  await otherPage.evaluate(({id,detail})=>{
    const key='ku-settle-local-data-v6', state=JSON.parse(localStorage.getItem(key));
    state.preferences.reportDrafts=[{productId:id,reason:'other',detail,status:'new',createdAt:new Date().toISOString()}];
    localStorage.setItem(key,JSON.stringify(state));
  },{id:listing.id,detail:run});
  await otherPage.reload({waitUntil:'networkidle'});
  await otherPage.getByRole('button',{name:'상품 신고',exact:true}).click();
  await reportModal.getByText('이 초안은 이 기기에 저장되어 있으며 운영자에게 전달되지 않았습니다.',{exact:true}).waitFor();
  assert.equal(await reportModal.locator('select').inputValue(),'other');
  assert.equal(await reportDetail.inputValue(),run);
  stage='신고 422 응답과 입력 유지';
  const invalidReport=route=>route.continue({postData:{...route.request().postDataJSON(),reason:''}});
  await otherPage.route(reportRoute,invalidReport);
  await reportButton.click();
  await reportModal.getByRole('alert').filter({hasText:'서버가 신고 요청을 거절했습니다.'}).waitFor();
  assert.equal(await reportDetail.inputValue(),run);
  assert.equal(await reportSuccess.count(),0);
  assert.equal((await reportRows()).length,0);
  await otherPage.unroute(reportRoute,invalidReport);

  stage='신고 연속 제출과 관리자 목록';
  const reportResponse=otherPage.waitForResponse(response=>new URL(response.url()).pathname==='/api/reports/'&&response.status()===201);
  await reportModal.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  const {report:createdReport}=await (await reportResponse).json();
  await reportSuccess.waitFor();
  assert.deepEqual(await reportRows(),[{id:createdReport.id,listing_id:listing.id,reason:'other',detail:run,status:'new'}]);
  const adminReports=await expected(admin,`/api/admin/reports?search=${run}`,'GET',undefined,200);
  assert.ok(adminReports.reports.some(report=>report.id===createdReport.id&&report.listing_id===listing.id));
  passed('실제 신고 거절 뒤 입력 유지, 같은 폼 연속 제출 시 DB 한 행, 관리자 신고 목록에서 접수 확인');

  stage='실제 신고 응답 유실과 샘플';
  const lostDetail=`${run}-lost`;
  await fillReport(lostDetail);
  let lostStatus;
  const dropReportResponse=async route=>{
    try { lostStatus=(await route.fetch({url:`${origin}/api/reports/`,maxRedirects:0})).status(); }
    finally { await route.abort('connectionreset'); }
  };
  await otherPage.route(reportRoute,dropReportResponse);
  await reportButton.click();
  await reportModal.getByRole('alert').filter({hasText:'신고 접수 여부를 확인하지 못했습니다.'}).waitFor();
  assert.equal(lostStatus,201);
  assert.equal(await reportDetail.inputValue(),lostDetail);
  assert.equal(await reportButton.isDisabled(),true);
  assert.equal(await reportSuccess.count(),0);
  assert.equal((await reportRows()).filter(report=>report.detail===lostDetail).length,1);
  await otherPage.unroute(reportRoute,dropReportResponse);
  await otherPage.goto(`${origin}/?lang=ko&page=marketplace&listing=1`,{waitUntil:'networkidle'});
  await otherPage.getByText('샘플 상품의 신고는 운영자에게 전달되지 않습니다.',{exact:true}).waitFor();
  assert.equal(await otherPage.getByRole('button',{name:'상품 신고',exact:true}).count(),0);
  assert.equal((await reportRows()).length,2);
  passed('서버 저장 후 응답을 끊으면 접수 미확인과 입력 유지, 샘플은 운영자에게 전달하지 않음');
  stage='계정 상품의 신고 참조와 인증 확인';
  const email=`${run}@korea.ac.kr`, password=randomBytes(24).toString('hex');
  const fixture=await authAdmin.createUser({email,password,email_confirm:true});
  if(fixture.error||!fixture.data.user) throw Error('isolated_account_create_failed');
  fixtureAccountId=fixture.data.user.id;
  const accountListing=(await db.query(`insert into public.marketplace_items
    (seller_id,seller_display_name,item_name,price_krw,category,condition,pickup_location,availability)
    values ($1,'격리 테스트',$2,1000,'home','good','격리 장소','available') returning id`,[fixtureAccountId,run])).rows[0];
  const accountReport={accountListingId:accountListing.id,reason:'other',detail:`${run}-account`};
  await expected(other,'/api/reports','POST',accountReport,401);
  const authClient=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const signedIn=await authClient.auth.signInWithPassword({email,password});
  if(signedIn.error||!signedIn.data.session) throw Error('isolated_account_sign_in_failed');
  const {report:accountReceipt}=await expected(other,'/api/reports','POST',accountReport,201,{authorization:`Bearer ${signedIn.data.session.access_token}`});
  assert.equal(accountReceipt.listing_id,null);
  assert.equal(accountReceipt.place_key,`account-listing:${accountListing.id}`);
  const accountAdmin=await expected(admin,`/api/admin/reports?search=${run}-account`,'GET',undefined,200);
  assert.ok(accountAdmin.reports.some(report=>report.id===accountReceipt.id&&report.place_key===accountReceipt.place_key));
  await db.query("update public.marketplace_items set status='hidden' where id=$1 and seller_id=$2",[accountListing.id,fixtureAccountId]);
  await expected(other,'/api/reports','POST',accountReport,404,{authorization:`Bearer ${signedIn.data.session.access_token}`});
  passed('계정 상품 신고는 인증 후 같은 관리자 목록에 상품 참조와 함께 기록');
  await otherPage.goto(`${origin}/?lang=ko&page=marketplace&listing=${listing.id}`,{waitUntil:'networkidle'});
  await otherPage.getByRole('dialog',{name:run,exact:true}).waitFor();
  await otherPage.keyboard.press('Escape');await leaving(otherPage);
  stage='타인 상품 내 목록 제외';
  assert.equal(await otherPage.locator('.my-listing-row').filter({hasText:run}).count(),0);
  const rowFor = name => sellerPage.locator('.my-listing-row').filter({hasText:name});
  const listingRow = async id => (await db.query('select item_name,status,availability from public.guest_listings where id=$1 and session_id=$2',[id,sellerId])).rows[0];
  const listingPath = `/api/marketplace/listings/${listing.id}`;
  const match = (response,path,method) => new URL(response.url()).pathname===`${path}/` && response.request().method()===method;
  const clickPatch = async (button,path,status) => {
    const pending=sellerPage.waitForResponse(response=>match(response,path,'PATCH'));
    await button.click();
    const response=await pending;
    const body=await response.json();
    if(response.status()!==status) console.error(`브라우저 PATCH HTTP ${response.status()} (기대 ${status})`);
    assert.equal(response.status(),status);return body;
  };
  const reloadSeller = async () => { await sellerPage.reload({waitUntil:'networkidle'});await leaving(sellerPage); };
  const editName = `${run}-edited`;
  stage='판매자 상세 열기';
  await leaving(sellerPage);
  await rowFor(run).filter({has:sellerPage.getByText(run,{exact:true})}).locator('.my-listing-row-main').click();
  stage='판매자 편집 폼 열기';
  await sellerPage.getByRole('button',{name:'상품 수정',exact:true}).click();
  const editor=sellerPage.getByRole('dialog',{name:'상품 수정',exact:true});
  await editor.getByLabel('상품명',{exact:true}).fill(editName);
  stage='판매자 편집 PATCH';
  const edited=(await clickPatch(editor.getByRole('button',{name:'저장',exact:true}),listingPath,200)).listing;
  stage='편집 응답과 DB 대조';
  assert.equal(edited.item_name,editName);assert.equal((await listingRow(listing.id)).item_name,editName);
  await reloadSeller();await rowFor(editName).waitFor();
  stage='타인 편집 거부와 DB 보존';
  assert.equal((await expected(other,listingPath,'PATCH',{itemName:'거부 대상'},409)).error,'listing_conflict_or_not_found');
  assert.equal((await listingRow(listing.id)).item_name,editName);
  passed('실제 판매자 상품 편집·새로고침, 타인 상품 내 목록·판매자 상세 제외와 변경 거부');
  stage='숨김·복원 및 다른 구매자 표시';
  await rowFor(editName).locator('.my-listing-row-main').click();
  const hidden=(await clickPatch(sellerPage.getByRole('button',{name:'상품 숨기기',exact:true}),listingPath,200)).listing;
  assert.equal(hidden.status,'hidden');assert.equal((await listingRow(listing.id)).status,'hidden');
  const publicRows = async () => (await expected(other,`/api/marketplace/listings?search=${encodeURIComponent(editName)}`,'GET',undefined,200)).listings;
  assert.equal((await publicRows()).some(row=>row.id===listing.id),false);
  await sellerPage.keyboard.press('Escape');await reloadSeller();
  await rowFor(editName).getByText(/^(숨김|Hidden)$/).waitFor();
  await rowFor(editName).locator('.my-listing-row-main').click();
  const reopened=(await clickPatch(sellerPage.getByRole('button',{name:'상품 다시 공개',exact:true}),listingPath,200)).listing;
  await otherPage.goto(`${origin}/?lang=ko&page=marketplace&listing=${listing.id}`,{waitUntil:'networkidle'});
  const detail=otherPage.getByRole('dialog',{name:editName,exact:true});
  await detail.waitFor();
  const actual=await listingRow(listing.id);
  const publicRow=(await publicRows()).find(row=>row.id===listing.id);
  const canBook=await detail.getByRole('button',{name:'예약하기',exact:true}).count()>0;
  console.log(`다시 공개: PATCH ${reopened.status}, DB ${actual.status}/${actual.availability}, 공개 API ${publicRow?.status}, 다른 구매자 예약 버튼 ${canBook ? '있음' : '없음'}`);
  assert.equal(reopened.status,'reserved');
  assert.equal(actual.status,'reserved');assert.equal(actual.availability,'reserved');assert.equal(publicRow?.status,'reserved');assert.equal(canBook,false);
  await sellerPage.locator('.service-status[role=status]').getByText('저장됨',{exact:true}).waitFor();
  assert.equal(await detail.locator('.product-actions .primary').isDisabled(),true);
  await reserve(other,listing.id,randomUUID(),409);
  await stateMatches(r1,'active','reserved');
  await sellerPage.keyboard.press('Escape');await reloadSeller();await rowFor(editName).locator('.listing-reservation').waitFor();
  passed('활성 예약 상품 숨김·다시 공개·새로고침 및 다른 구매자의 예약 가능 표시와 중복 요청 차단');
  stage='판매자 목록 취소와 새로고침';
  const sellerCancelledFromList=(await clickPatch(rowFor(editName).getByRole('button',{name:'예약 취소',exact:true}),userPath,200)).reservation;
  await stateMatches(sellerCancelledFromList,'cancelled','active');
  await rowFor(editName).locator('.listing-reservation').waitFor({state:'hidden'});
  await reloadSeller();await rowFor(editName).waitFor();
  assert.equal(await rowFor(editName).locator('.listing-reservation').count(),0);
  await sellerPage.waitForFunction(id=>JSON.parse(localStorage.getItem('ku-settle-local-data-v6')??'null')?.preferences.reservations.some(x=>x.id===id&&x.status==='cancelled'),r1.id);
  await stateMatches(sellerCancelledFromList,'cancelled','active');
  passed('판매자 목록 버튼의 실제 취소 PATCH와 새로고침 후 예약·상품 DB 상태 일치');
  stage='취소와 재공개 동시 요청';
  const concurrent=await reserve(buyer,listing.id);
  await expected(seller,listingPath,'PATCH',{status:'hidden'},200);
  const blocker=(await db.query('select pg_backend_pid() as pid')).rows[0].pid;
  await db.query('begin');
  let concurrentReopen;
  try {
    await db.query("select public.transition_guest_reservation($1,$2,'cancelled',$3,'user')",[concurrent.id,buyerId,concurrent.version]);
    concurrentReopen=expected(seller,listingPath,'PATCH',{status:'active'},200);
    void concurrentReopen.catch(()=>{});
    let blocked=false;
    for(let attempt=0;attempt<25&&!blocked;attempt++) {
      blocked=(await db.query("select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and $1=any(pg_blocking_pids(pid))) as blocked",[blocker])).rows[0].blocked;
      if(!blocked) await new Promise(resolve=>setTimeout(resolve,200));
    }
    assert.equal(blocked,true,'재공개 요청이 취소 트랜잭션의 상품 잠금을 기다려야 함');
    await db.query('commit');
  } catch(error) {
    await db.query('rollback');
    await concurrentReopen?.catch(()=>{});
    throw error;
  }
  assert.equal((await concurrentReopen).listing.status,'active');
  assert.equal((await listingRow(listing.id)).availability,'available');
  assert.equal((await db.query('select status from public.guest_reservations where id=$1',[concurrent.id])).rows[0].status,'cancelled');
  passed('취소가 상품 행 잠금을 해제한 뒤 대기 중인 재공개 요청은 available로 저장');
  stage='취소와 관리자 종료';
  const buyerReservation=await reserve(buyer,listing.id);
  const buyerPath=`/api/reservations/${buyerReservation.id}`;
  const cancelled=(await expected(buyer,buyerPath,'PATCH',{status:'cancelled'},200)).reservation;await stateMatches(cancelled,'cancelled','active');
  const repeat=(await expected(buyer,buyerPath,'PATCH',{status:'cancelled'},200)).reservation;assert.equal(repeat.version,cancelled.version);
  const r2=await reserve(buyer,listing.id);
  const cleaned=(await expected(admin,adminPath,'PATCH',{status:'soft_deleted',version:sellerCancelledFromList.version},200)).reservation;
  await stateMatches(cleaned,'soft_deleted','reserved');await stateMatches(r2,'active','reserved');
  await expected(admin,`/api/admin/reservations/${r2.id}`,'PATCH',{status:'completed',version:r2.version+1},409);
  const completed=(await expected(admin,`/api/admin/reservations/${r2.id}`,'PATCH',{status:'completed',version:r2.version},200)).reservation;
  await stateMatches(completed,'completed','sold');
  const forSeller=await item(seller),bySeller=await reserve(buyer,forSeller.id);
  const sellerCancelled=(await expected(seller,`/api/reservations/${bySeller.id}`,'PATCH',{status:'cancelled'},200)).reservation;
  await stateMatches(sellerCancelled,'cancelled','active');
  passed('구매자·판매자 취소/재시도, 관리자 stale version 거부·완료, R1 soft-delete 시 활성 R2 보존');
  stage='HTTP 지연 만료';
  const expiring=await item(seller),r3=await reserve(buyer,expiring.id);
  await db.query("update public.guest_reservations set expires_at=now()-interval '1 second' where id=$1 and buyer_session_id=$2",[r3.id,buyerId]);
  const after=await expected(buyer,'/api/session/state','GET',undefined,200);
  await stateMatches(after.reservations.find(x=>x.id===r3.id),'expired','active');
  const replay=await reserve(buyer,expiring.id,(await db.query('select idempotency_key from public.guest_reservations where id=$1',[r3.id])).rows[0].idempotency_key,200);
  await stateMatches(replay,'expired','active');passed('이번 예약만 기한 경과 fixture 설정 → 실제 GET의 만료 RPC → HTTP·DB 일치와 만료 재전송');
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('ku-settle-local-data-v6')??'null')?.preferences.reservations.some(x=>x.id===id&&x.status==='completed'),r2.id);
  passed('관리자 완료 후 실제 reload에서도 서버 종료 상태 복구');
  // 기존 rate-limit 데이터의 값도 그대로인지 확인한다.
  const retained=(await db.query('select key_hash,window_started_at,request_count from public.admin_rate_limit_buckets where key_hash=any($1::text[])',[oldKeys])).rows;
  assert.deepEqual(retained.sort((a,b)=>a.key_hash.localeCompare(b.key_hash)),before.sort((a,b)=>a.key_hash.localeCompare(b.key_hash)));
} catch(error) {
  failed=true;console.error(`검증 실패 단계: ${stage}; ${error.code??error.name??'unknown'}`);
  const browserError = error.message?.match(/^(?:locator|page)\.[^:\n]+: [^\n]+/);
  if (browserError) console.error(browserError[0].slice(0,240));
} finally {
  if(browser)await browser.close().catch(()=>{cleanupFailed=true;});
  if(child?.pid) { try { if(process.platform==='win32')execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});else child.kill(); } catch { cleanupFailed=true; } }
  if(appVerified) {
    try {
      await db.query('delete from public.admin_audit_log where actor=$1',[run]);
      await db.query('delete from public.guest_reports where session_id=any($1::uuid[])',[[...sessions]]);
      await db.query('delete from public.anonymous_sessions where id=any($1::uuid[])',[[...sessions]]);
      await db.query('delete from public.admin_rate_limit_buckets where key_hash=any($1::text[])',[[...rateKeys]]);
      const left=(await db.query(`select (select count(*) from public.anonymous_sessions where id=any($1::uuid[]))+
        (select count(*) from public.guest_listings where session_id=any($1::uuid[]))+
        (select count(*) from public.guest_reservations where buyer_session_id=any($1::uuid[]))+
        (select count(*) from public.guest_reports where session_id=any($1::uuid[]) or detail in ($2,$2||'-lost',$2||'-account'))+
        (select count(*) from public.user_notifications where session_id=any($1::uuid[]))+
        (select count(*) from public.admin_audit_log where actor=$2)+
        (select count(*) from public.admin_rate_limit_buckets where key_hash=any($3::text[])) as n`,[[...sessions],run,[...rateKeys]])).rows[0].n;
      assert.equal(Number(left),0);console.log('이번 실행의 세션·상품·예약·신고·알림·감사·rate-limit 행 정리 확인');
    }catch(error){cleanupFailed=true;console.error(`정리 실패: ${error.code??error.name}`);}
  }
  if(fixtureAccountId)try{
    const deleted=await authAdmin.deleteUser(fixtureAccountId);
    if(deleted.error) throw deleted.error;
    const left=(await db.query('select (select count(*) from auth.users where id=$1)+(select count(*) from public.marketplace_items where seller_id=$1) as n',[fixtureAccountId])).rows[0].n;
    assert.equal(Number(left),0);console.log('이번 계정 상품 신고 검증 계정과 상품 정리 확인');
  }catch(error){cleanupFailed=true;console.error(`격리 계정 정리 실패: ${error.code??error.name}`);}
  if(guarded)try{
    await db.query(`drop trigger ${guard} on public.admin_rate_limit_buckets`);
    assert.equal((await db.query('select count(*)::int as n from pg_trigger where tgname=$1',[guard])).rows[0].n,0);
  }catch{cleanupFailed=true;}
  await db.end().catch(()=>{cleanupFailed=true;});
  const nextEnv=readFileSync('next-env.d.ts');
  if(!nextEnv.equals(initialNextEnv)) {
    const normalized=value=>value.toString().replaceAll('\r\n','\n').replaceAll('./.next/dev/types/','./.next/types/');
    if(normalized(nextEnv)===normalized(initialNextEnv))writeFileSync('next-env.d.ts',initialNextEnv);
    else {failed=true;console.error('next-env.d.ts의 예상 밖 변경: 자동 복원하지 않음');}
  }
  for(const [p,hash]of initialHashes)if(sha(readFileSync(p))!==hash){failed=true;console.error('보존 대상 파일 변경 감지');}
}
console.log(`최종: 실제 HTTP→DB ${checks}개 그룹 ${failed?'실패':'통과'}, 정리 ${cleanupFailed?'실패':'완료'}. 운영 로그인·이메일 발송 검증 아님.`);
process.exitCode=failed||cleanupFailed?1:0;
