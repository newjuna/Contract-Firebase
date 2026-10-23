/* 도급 안전관리 · Firebase 연결부 (F1.3: 로그인 · 직원 · 사업자 등록/승인 · 계약 전 서류 · 공사/작업자)
 * - 화면(app.js)은 예전처럼 api('기능이름', 인자) 로 부르고, 이 파일이 Firestore에서 바로 처리함
 *   (예전: 버튼마다 Apps Script 서버 왕복 → 느림 / 지금: 휴대폰이 Firestore를 직접 읽고 씀)
 * - 권한(업체는 자기 것만, 직원 관리는 안전보건팀만 등)은 Firebase 보안 규칙(firestore.rules)이 최종 확인
 *   → 이 파일의 권한 확인은 화면 안내용, 진짜 막는 것은 규칙
 * - 아직 옮기지 않은 기능은 '아직 Firebase로 옮기지 않은 기능' 안내
 */
(function () {
  const VERSION = '26.10.24 F1.3';
  /* ---------- 기존 Code.gs와 같은 기준값 ---------- */
  const CFG = {
    INDUSTRIES: ['입고도우미', '재고조사', '인테리어(마감)', '사인', '냉난방기', '집기', '본사 식당'],
    TEST_SKIP_FILES: true,          // 테스트 기간: 파일 없이도 신청·제출 (운영 전 false)
    APPROVER_DOMAINS: ['daiso.co.kr'],
  };
  const MASTER_EMAILS = ['zxcv6309@gmail.com'];  // firestore.rules의 isMaster()와 같게 유지
  const STAFF_ROLES = { SAFETY: '안전보건팀', CLIENT: '도급인 담당자' };
  const STAFF_SEED = [['박OO', 'gerrard08@daiso.co.kr', 'gerrardbak08@gmail.com'], ['강OO', 'sky5224122@daiso.co.kr', 'sky5224122@gmail.com'], ['유OO', 'junha.yoo@daiso.co.kr', 'zxcv6309@gmail.com'], ['서OO', 'ymoo09@daiso.co.kr', 'sds4436@gmail.com'], ['박OO', 'younha.park@daiso.co.kr', 'kong6866@gmail.com'], ['윤OO', 'jeongin.yoon@daiso.co.kr', 'dndjekrl@gmail.com']];
  const STEP_NAMES = ['기본정보', '안전보건 조직', '안전관리계획', '증빙자료', '최종확인'];
  const FIELDS = {
    1: [['majorWork', '주요 수급업무'], ['employeeCount', '상시 근로자 수(명)'], ['siteAddress', '사업장 소재지'], ['siteManager', '현장대리인(현장 책임자)'], ['siteManagerPhone', '현장대리인 연락처'], ['safetyManager', '안전보건 담당자'], ['safetyPhone', '안전보건 담당자 연락처'], ['note', '비고 (선택)']],
    2: [['safetyManager', '안전보건 담당자'], ['safetyPhone', '담당자 연락처'], ['orgPolicy', '안전보건 조직 및 역할']],
    3: [['riskFactors', '주요 위험요인'], ['prevention', '안전조치 및 예방대책'], ['emergency', '사고보고·비상대응 절차']],
    4: [['training', '안전보건교육 현황'], ['protective', '보호구 및 장비 관리'], ['otherDocuments', '추가 증빙자료 설명']],
    5: [['finalConfirm', '제출 내용 확인(확인 완료 입력)']],
  };
  const INDUSTRY_FIELDS = {
    '입고도우미': ['롤테이너·L카 이동 안전조치', '하차 중 차량 및 작업자 동선 분리'], '재고조사': ['사다리 및 창고작업 안전조치', '고객 동선과 조사구역 분리'],
    '인테리어(마감)': ['전기·고소·화기작업 안전조치', '분진·소음 및 작업구역 통제'], '사인': ['고소·낙하물 방지대책', '외부 보행자 보호 및 전기 작업'],
    '냉난방기': ['전원 차단·전기 작업관리', '냉매·중량물·고소작업 관리'], '집기': ['집기 전도 및 낙하 방지', '전동공구 및 고객 동선 관리'], '본사 식당': ['미끄러짐·화상·절단 방지', 'MSDS·근골격계 예방'],
  };
  const NOTICE_LABEL = { VENDOR_APPROVED: '계약 전 평가 확정', JOB_EXTENDED: '공사 연장', JOB_ENDED: '공사 종료', JOB_EVAL_DONE: '공사 종료 평가 확정' };
  /* @@v527-start (v5.27 Code.gs에서 그대로 복사한 상수 · 중계 Relay.gs와 같은 값) */
  const DOC_STAGE={CONTRACT:'계약',EXECUTION:'수행',CLOSE:'종료'};
  const DOC_STAGE_ORDER={CONTRACT:1,EXECUTION:2,CLOSE:3};
  const DOC_OWNER={VENDOR:'수급사(협력업체)',PRINCIPAL:'원청',JOINT:'원청·협력업체'};
  const DOC_TYPE_SEED=[
   ['C01','CONTRACT',1,'안전보건관리규정','용역·도급 계약시','VENDOR','TEMPLATE','Y'],
   ['C02','CONTRACT',2,'안전보건관리계획서','용역·도급 계약시','VENDOR','TEMPLATE','Y'],
   ['C03','CONTRACT',3,'수급업체 안전보건수준평가','용역·도급 계약시','PRINCIPAL','EVALUATION','N'],
   ['E01','EXECUTION',1,'안전보건협의체','월1회','JOINT','TEMPLATE','N'],
   ['E02','EXECUTION',2,'위험성평가','정기/수시','VENDOR','TEMPLATE','N'],
   ['E03','EXECUTION',3,'작업장 순회점검','2일1회','PRINCIPAL','TEMPLATE','N'],
   ['E04','EXECUTION',4,'작업장 합동 안전보건점검','2달1회','JOINT','TEMPLATE','N'],
   ['E05','EXECUTION',5,'안전보건교육 지원 및 확인','정기/수시','PRINCIPAL','TEMPLATE','N'],
   ['E06','EXECUTION',6,'안전작업계획서(안전작업허가 운영)','수시','VENDOR','TEMPLATE','N'],
   ['E07','EXECUTION',7,'수급인에 대한 시정조치','수시','PRINCIPAL','TEMPLATE','N'],
   ['E08','EXECUTION',8,'작업환경측정','정기','PRINCIPAL','TEMPLATE','N'],
   ['E09','EXECUTION',9,'비상시 대비 및 대응 훈련','정기','PRINCIPAL','TEMPLATE','N'],
   ['E10','EXECUTION',10,'위생시설 설치 또는 이용','정기/수시','PRINCIPAL','TEMPLATE','N'],
   ['E11','EXECUTION',11,'안전보건에 관한 정보제공','수시','PRINCIPAL','NONE','N'],
   ['X01','CLOSE',1,'안전보건수준 재평가','수시','PRINCIPAL','EVALUATION','N']
  ];
  const RULE_TITLE='도급사업에 있어서의 협의체 운영지침';
  const RULE_TEXT=[
   ['제1조 (목적)','도급사업에 있어서 발생될 수 있는 재해를 미연에 방지하며 수급업체와 함께 안전활동을 전개하여 무재해 사업장을 이룩하기 위함.'],
   ['제2조 (적용범위)','"을" 및 "을"의 근로자를 대상으로 한다.'],
   ['제3조 (협의체 구성)','"갑"과 "을" 전원으로 구성한다.\n【단, "갑"의 업무를 위임받은 안전보건총괄책임자 및 안전관리자 1인, 보건관리자 1인, 주관부서의 책임자 1인으로 하며 "을"의 경우 "을" 또는 "을"의 업무를 위임받은 (현장소장 등) 1인으로 할 수 있다.】'],
   ['제4조 (협의내용)','작업의 시작시간, 작업장 간의 연락방법, 재해위험 시의 대피방법 기타 재해예방을 위하여 필요한 사항'],
   ['제5조 (운영방법)','매월 1회 이상 정기회의 개최'],
   ['제6조 (회의결과)','기록, 보존하여야 함 (안전관리자 기록유지)'],
   ['제7조 (작업장의 순회점검)','2일에 1회 이상 안전보건총괄책임자를 제외한 협의체 위원 전원이 당해 작업장을 순회 점검한다.\n분기에 1회 이상 협의체 위원 전원이 당해 작업장을 순회점검한다.\n"을"은 순회점검을 기피해서는 안 된다.\n순회점검 결과 지적사항에 대해서는 "을"은 즉시 시정하여야 한다.'],
   ['제8조 (작업중지)','안전사고의 급박한 위험이 예상되어 안전보건총괄책임자로부터 작업중지를 요구받은 경우에는 즉시 작업을 중지하고 근로자를 안전한 장소로 대피시켜야 하며 작업중지로 인하여 발생되는 손실은 "을"이 부담한다.'],
   ['제9조 (안전보건교육)','"을"은 당해 "을"의 근로자에 대하여 노동부령이 정하는 바에 의하여 정기적으로 안전보건에 관한 교육을 실시하여야 하며 교육결과를 기록 보전하여야 한다. "갑"은 "을"이 당해 근로자 안전보건교육에 관한 협조 요청 시 특별한 사유가 없는 한 지도와 지원을 할 수 있다.'],
   ['제10조 (유해·위험기계·기구 안전방호장치)','"을"은 노동부령이 정하는 유해·위험기계·기구에 대하여 안전방호장치를 설치 후 작업하여야 한다.']];
  const HQ_NAME='(주)아성다이소';
  const PLAN_WORKS=[
   ['HEIGHT','고소작업 (사다리·말비계·2m 이상)','추락','안전대 착용, 작업발판·난간 설치, 사다리 2인 1조',3,4,true,'사다리·말비계·이동식 비계'],
   ['ELEC','전기작업 (배선·분전반)','감전','전원 차단·잠금장치(LOTO), 검전 후 작업, 절연장갑 착용',2,5,true,'분전반·전선·검전기'],
   ['HOT','화기작업 (용접·절단·그라인더)','화재·화상','화기작업 허가, 소화기 비치, 불티 비산방지포, 화재감시자 배치',2,5,true,'용접기·절단기·그라인더'],
   ['HEAVY','중량물 취급·운반','협착·요통','2인 1조 운반, 대차·운반구 사용, 이동 동선 통제',3,3,false,'대차·운반구'],
   ['FORK','지게차·전동대차 운반','충돌·깔림','면허자 운전, 유도자 배치, 제한속도 준수, 작업구역 통제',2,5,false,'지게차·전동대차'],
   ['TOOL','전동공구 사용','베임·끼임','방호덮개 확인, 보안경·장갑 착용, 사용 전 점검',3,3,false,'전동드릴·톱·그라인더'],
   ['CHEM','유해물질 (도료·접착제·세제)','중독·화재','MSDS 비치·교육, 환기, 방독마스크 착용, 화기 엄금',2,3,false,'도료·접착제·세제'],
   ['CONF','밀폐공간 작업','질식','산소·유해가스 측정, 환기, 감시인 배치',1,5,true,'가스측정기·송풍기'],
   ['DEMO','철거·해체 작업','낙하·붕괴','작업구역 통제, 안전모 착용, 해체 순서 준수',2,4,false,'해체공구'],
   ['KITCHEN','조리·주방 작업','화상·베임·미끄러짐','방열장갑·안전칼집 사용, 미끄럼방지화 착용, 바닥 물기 제거',3,3,false,'조리기구·튀김기·칼']];
  const PLAN_INDUSTRY_WORKS={'입고도우미':['HEAVY','FORK','HEIGHT'],'재고조사':['HEIGHT','HEAVY'],'인테리어(마감)':['HEIGHT','TOOL','CHEM','HEAVY'],'사인':['HEIGHT','ELEC','TOOL'],'냉난방기':['HEIGHT','ELEC','HOT','HEAVY'],'집기':['HEAVY','TOOL','HEIGHT'],'본사 식당':['KITCHEN','CHEM']};
  const PLAN_SCEN=[
   ['FIRE','화재',[['상황전파','최초 발견자','"불이야"를 외쳐 주변에 알리고 119에 신고'],['초기소화','최초 발견자·주변 근로자','부상자를 안전한 곳으로 옮기고 소화기로 초기 소화'],['대피','현장대리인','작업 중지, 전기·가스 차단, 비상구로 전원 대피 후 인원 확인'],['현장인계','현장대리인','출동한 소방대에 현장 상황 보고, 진입로 확보'],['보고','현장대리인','다이소 담당자에게 즉시 보고, 재발방지 대책 수립']]],
   ['SHOCK','감전',[['상황전파','최초 발견자','"감전 사고!"를 외치고 지휘계통에 통보'],['전원차단','현장대리인','해당 선로 차단 (맨손으로 사고자 접촉 금지)'],['응급조치','안전담당자','호흡 확인, 119 신고, 필요 시 심폐소생술·AED'],['보고','현장대리인','다이소 담당자에게 즉시 보고']]],
   ['FALL','추락',[['상황전파','최초 발견자','주변에 알리고 119 신고'],['2차사고 방지','현장대리인','주변 작업 중지, 낙하물 위험 구역 통제'],['응급조치','안전담당자','사고자를 함부로 움직이지 않고 의식·호흡 확인, 출혈 지혈'],['보고','현장대리인','다이소 담당자에게 즉시 보고']]],
   ['SICK','응급환자 (부상·심정지)',[['상황전파','최초 발견자','119 신고, 주변에 도움 요청'],['응급조치','안전담당자','의식·호흡 확인, 심폐소생술·AED, 상처 지혈'],['인계','현장대리인','구급대 도착 시 상황 설명, 병원 이송 동행'],['보고','현장대리인','다이소 담당자에게 즉시 보고']]]];
  const PLAN_LAWS=[['산업안전보건법 제36조','위험성평가 실시','작업 시작 전 위험성평가 실시·기록 (본 계획서 Ⅱ-1)'],['산업안전보건법 제29조','근로자 안전보건교육','신규 채용 시·작업 전 교육 실시·기록 (본 계획서 Ⅱ-3)'],['산업안전보건법 제63조·제64조','도급인의 안전조치·협의체','협의체 참여, 순회점검 협조, 지적사항 즉시 시정'],['산업안전보건기준에 관한 규칙','위험작업 안전조치','고소·전기·화기 등 위험작업 시 안전조치·작업허가 (본 계획서 Ⅱ-4)']];
  function planPolicy_(company){return [company+'은(는) 안전보건경영이 모든 경영활동의 최우선 가치임을 표명하고, 안전보건 책임과 의무를 성실하게 실행하기 위해 다음과 같이 안전보건경영 방침을 선언한다.',
   '산업안전보건법 등 안전보건 관련 법규 및 제반 규정을 준수하여 쾌적하고 안전한 작업환경을 조성한다.','사업장 내 모든 유해·위험요인을 지속 개선하여 협력사를 포함한 모든 임직원과 이용고객의 안전과 건강을 지킨다.',
   '안전보건에 관한 목표를 설정하고 이를 달성하기 위한 안전보건경영시스템을 구축하여 산업재해를 예방한다.','비상상황에 적극적으로 대응할 수 있는 비상 대응체계를 구축·운영한다.','전 임직원의 자율적인 안전보건활동 참여를 보장하고 안전한 일터 조성으로 사회적 책임을 다한다.'];}
  /* @@v527-end */

  /* ---------- 준비 ---------- */
  const ok = !!(window.firebase && window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId);
  if (!ok) { window.FB = { ok: false, version: VERSION }; return; }
  firebase.initializeApp(window.FIREBASE_CONFIG);
  const auth = firebase.auth(), db = firebase.firestore();
  let USER = null;
  const ready = new Promise((res) => { auth.onAuthStateChanged((u) => { USER = u; res(u); }); });

  const now = () => new Date().toISOString();
  const tidy = (v, max = 600) => String(v ?? '').trim().slice(0, max);
  const lower = (v) => String(v || '').trim().toLowerCase();
  const fail = (m) => { throw Error(m); };
  const getMode = () => { try { return localStorage.getItem('fbMode') || ''; } catch (e) { return ''; } };
  async function me() {
    await ready;
    if (!USER) fail('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    return { uid: USER.uid, email: lower(USER.email), mode: getMode() };
  }
  const isMaster = (a) => a.mode !== 'VENDOR' && MASTER_EMAILS.includes(a.email);
  const isInternalEmail = (e) => CFG.APPROVER_DOMAINS.some((d) => lower(e).endsWith('@' + d));
  /** Firebase 오류를 알아듣기 쉬운 말로 */
  function nice(e) {
    const c = e && e.code || '';
    if (c === 'permission-denied') return Error('권한이 없습니다. (보안 규칙에서 막힘)');
    if (c === 'unavailable') return Error('인터넷 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.');
    return e instanceof Error ? e : Error(String(e));
  }
  const audit = (a, companyId, action, detail) => db.collection('AUDIT').add({ time: now(), email: a.email, uid: a.uid, companyId: companyId || '', action, detail: tidy(detail, 2000) }).catch(() => {});

  /* ---------- 직원 · 권한 ---------- */
  async function seedStaffIfEmpty(a) {
    if (!isMaster(a)) return;
    const s = await db.collection('STAFF').limit(1).get();
    if (!s.empty) return;
    const b = db.batch();
    STAFF_SEED.forEach(([name, ce, le]) => b.set(db.collection('STAFF').doc(le), { name, dept: '안전보건팀', role: 'SAFETY', companyEmail: ce, loginEmail: le, active: 'Y', createdBy: 'SYSTEM', createdAt: now() }));
    await b.commit();
  }
  /** 직원 정보 (협력업체로 접속하면 null) — 기존 staffOf_와 같음 */
  async function staffOf(a, memo) {
    if (a.mode === 'VENDOR') return null;
    if (memo && 'staff' in memo) return memo.staff;
    let s = null;
    try { const d = await db.collection('STAFF').doc(a.email).get(); if (d.exists) s = d.data(); }
    catch (e) { if (e.code !== 'permission-denied') throw e; }
    let r;
    if (isMaster(a)) { await seedStaffIfEmpty(a); r = { ...(s || { name: '마스터', dept: '시스템 관리', companyEmail: '', loginEmail: a.email, active: 'Y' }), role: 'SAFETY', master: true }; }
    else r = s && String(s.active).trim().toUpperCase() !== 'N' ? s : null;
    if (memo) memo.staff = r;
    return r;
  }
  const isSafety = async (a, memo) => (await staffOf(a, memo))?.role === 'SAFETY';

  /* ---------- 중계 Apps Script (파일 · 메일 · 승인처럼 업체가 직접 쓰면 안 되는 일) ---------- */
  const relayUrl = () => String(window.APP_CONFIG && window.APP_CONFIG.APPS_SCRIPT_URL || '').trim();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /** 중계 서버에 요청. retry=true면 연결 실패 시 2번까지 다시 보냄 (조회·내려받기만) */
  async function relay(op, body, retry) {
    const url = relayUrl();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) fail('config.js에 중계 Apps Script 주소(/exec)가 아직 등록되지 않았습니다.');
    await ready; if (!USER) fail('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    const idToken = await USER.getIdToken();
    for (let i = 0; ; i++) {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null, t = ctl && setTimeout(() => ctl.abort(), 90000);
      let o;
      try {
        // text/plain으로 보내야 Apps Script가 추가 확인 요청(CORS) 없이 받음
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, op, idToken, mode: getMode() }), signal: ctl ? ctl.signal : undefined, redirect: 'follow' });
        o = await r.json().catch(() => null);
        if (!o) throw Error('중계 서버 응답을 읽을 수 없습니다. (배포 설정의 액세스가 "모든 사용자"인지 확인)');
      } catch (e) {
        if (retry && i < 2) { await sleep(800 * (i + 1)); continue; }
        if (e && e.name === 'AbortError') fail('중계 서버 응답이 늦습니다. 화면을 새로 고쳐 처리됐는지 확인해 주세요.');
        if (e instanceof TypeError) fail('중계 서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 화면을 새로 고쳐 처리됐는지 확인해 주세요.');
        throw e;
      } finally { if (t) clearTimeout(t); }
      if (!o.ok) fail(o.error || '중계 서버 오류');
      return o.data;
    }
  }

  /* ---------- 업체 (COMPANIES: 업체는 읽기만 · 쓰기는 중계 서버만) ---------- */
  const byNewest = (x, y) => String(y.createdAt || '').localeCompare(String(x.createdAt || ''));
  const docs = (s) => s.docs.map((d) => ({ ...d.data(), id: d.data().id || d.id }));
  /** 내가 신청한 업체 전부 (최신순) */
  async function myCompanies(a) { return docs(await db.collection('COMPANIES').where('uid', '==', a.uid).get()).sort(byNewest); }
  /** 지금 쓰는 업체 (반려 제외) — 기존 mine_와 같음 */
  async function myCompany(a) {
    if (a.mode === 'STAFF') return null;  // 담당자로 접속하면 업체 화면 사용 안 함
    const b = (await myCompanies(a)).find((x) => x.status !== 'REJECTED') || null;
    if (b && b.status === 'OTP_PENDING') b.status = 'VERIFIED';  // 예전 인증번호 단계 → 바로 작성 가능
    return b;
  }
  /* ---------- 계약 전 서류 공통 (기존 Code.gs와 같은 판단) ---------- */
  const kst = (iso) => { try { return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); } catch (e) { return ''; } };  // yyyy-mm-dd (한국 시간)
  const today = () => kst(new Date().toISOString());
  const parse = (j, d) => { try { return JSON.parse(j || ''); } catch (e) { return d; } };
  const docTypes = () => DOC_TYPE_SEED.map(([code, stage, order, name, cycle, owner, kind, required]) => ({ code, stage, order, name, cycle, owner, kind, required }))
    .sort((x, y) => (DOC_STAGE_ORDER[x.stage] - DOC_STAGE_ORDER[y.stage]) || (x.order - y.order));
  const vendorDocTypes = (stage) => docTypes().filter((t) => t.stage === stage && ['VENDOR', 'JOINT'].includes(t.owner) && t.kind !== 'EVALUATION');
  const canExec = (b) => !!b && b.status === 'VERIFIED' && (b.submissionStatus === 'APPROVED' || !!b.renewAt);
  function canUploadDoc(b, code) {
    if (!b || b.status !== 'VERIFIED') return false;
    const s = b.submissionStatus || 'DRAFT'; if (s === 'DRAFT') return true;
    return s === 'CORRECTION' && parse(b.correctionKeys, []).includes('4:doc' + code);
  }
  const staleForm = (b, at) => !!(b && b.renewAt && b.renewMode === 'NEW' && String(at || '') < String(b.renewAt));
  const infoFresh = (b) => !(b && b.renewAt && b.renewMode === 'NEW') || String(b.infoAt || '') >= String(b.renewAt);
  /** 계약 전 평가 유효기간 1년 {from,until,expired,days} */
  function contractValid(b) {
    if (!b || b.status !== 'VERIFIED') return null;
    const at = b.approvedAt || (b.submissionStatus === 'APPROVED' || b.renewAt ? b.submittedAt : ''); if (!at) return null;
    const from = kst(at); if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
    const d = new Date(from + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + 1); d.setUTCDate(d.getUTCDate() - 1);
    const until = d.toISOString().slice(0, 10), t = today();
    return { from, until, expired: t > until, days: Math.round((new Date(until + 'T00:00:00Z') - new Date(t + 'T00:00:00Z')) / 86400000) };
  }
  const docUploads = (subs, code) => subs.filter((x) => x.docType === code).sort((x, y) => Number(y.version) - Number(x.version)).map((x) => ({ id: x.documentId, name: x.name, version: Number(x.version), uploadedAt: x.uploadedAt, status: x.status }));
  function activeTemplates(list) { const m = {}; list.filter((x) => x.active === 'Y').forEach((x) => { if (!m[x.docType] || Number(x.version) > Number(m[x.docType].version)) m[x.docType] = x; }); return m; }
  /** 업체 화면용: 계약 단계 제출서류 + 이후 단계 참고 양식 + 전체 표 */
  function vendorDocBoard(b, tpl, subs) {
    const own = (t) => DOC_OWNER[t.owner] || t.owner;
    const contract = vendorDocTypes('CONTRACT').map((t) => ({ code: t.code, name: t.name, cycle: t.cycle, ownerLabel: own(t), required: t.required === 'Y',
      template: tpl[t.code] ? { name: tpl[t.code].name, version: Number(tpl[t.code].version) } : null, uploads: docUploads(subs, t.code), canUpload: canUploadDoc(b, t.code) }));
    const later = docTypes().filter((t) => t.stage !== 'CONTRACT' && tpl[t.code]).map((t) => ({ code: t.code, name: t.name, stageLabel: DOC_STAGE[t.stage], cycle: t.cycle, ownerLabel: own(t), template: { name: tpl[t.code].name, version: Number(tpl[t.code].version) } }));
    const rows = docTypes().map((t) => {
      const vendorDoc = ['VENDOR', 'JOINT'].includes(t.owner) && t.kind !== 'EVALUATION';
      return { code: t.code, stage: t.stage, stageLabel: DOC_STAGE[t.stage], name: t.name, cycle: t.cycle, owner: t.owner, ownerLabel: own(t), kind: t.kind, required: t.required === 'Y', vendorDoc,
        template: tpl[t.code] ? { version: Number(tpl[t.code].version) } : null, uploads: vendorDoc ? docUploads(subs, t.code) : [],
        canUpload: vendorDoc && ((t.stage === 'CONTRACT' && canUploadDoc(b, t.code)) || (t.stage === 'EXECUTION' && canExec(b))) };
    });
    return { contract, later, rows };
  }
  const reviewDocBoard = (subs) => vendorDocTypes('CONTRACT').map((t) => ({ code: t.code, name: t.name, required: t.required === 'Y', uploads: docUploads(subs, t.code) }));
  function planDefaults(b, p) {
    const y = Number(today().slice(0, 4)), w = PLAN_INDUSTRY_WORKS[b.industry] || [];
    return { policy: planPolicy_(b.company), goal: '무재해 달성 (산업재해 0건)',
      kpis: [{ name: '순회점검 실시율 (2일 1회)', target: '100%' }, { name: '작업 전 TBM·안전교육 실시율', target: '100%' }, { name: '지적사항 즉시 시정률', target: '100%' }],
      org: [{ role: '안전총괄책임자', name: b.representative || '', phone: b.phone || '' }, { role: '안전관리책임자 (현장대리인)', name: p.siteManager || '', phone: p.siteManagerPhone || '' }, { role: '안전담당자', name: p.safetyManager || '', phone: p.safetyPhone || '' }],
      works: w.length ? w : ['HEIGHT', 'TOOL', 'HEAVY'], scen: ['FIRE'].concat(w.includes('ELEC') ? ['SHOCK'] : []).concat((w.length ? w : ['HEIGHT']).includes('HEIGHT') ? ['FALL'] : []),
      hospital: '', years: [y - 3, y - 2, y - 1], accidents: ['', '', ''], evidence: [], practice: '' };
  }
  /** 업체 화면용: 앱 작성 서류 (규정 C01 · 계획서 C02) */
  function contractFormsView(b, forms, files, p1) {
    const fresh = (code) => { const f = forms.find((x) => x.code === code); return f && !staleForm(b, f.updatedAt) ? { f, d: parse(f.json, null) } : { f, d: null }; };
    const r = fresh('C01'), p = fresh('C02'), D = planDefaults(b, p1); let d = p.d;
    // 해가 바뀐 뒤 다시 작성하면 최근 3년이 달라짐 → 같은 연도 값만 옮김
    if (d && Array.isArray(d.years) && JSON.stringify(d.years.map(Number)) !== JSON.stringify(D.years)) { const old = d.years.map(Number), ac = d.accidents || []; d.accidents = D.years.map((y) => { const i = old.indexOf(y); return i >= 0 ? String(ac[i] ?? '') : ''; }); d.years = D.years; }
    const ev = ((d && d.evidence) || []).map((id) => { const x = files.find((y) => y.id === id); return x ? { id, name: x.name } : null; }).filter(Boolean);
    return { today: today(), hq: HQ_NAME, hqRep: b.approverName || '', rule: { title: RULE_TITLE, text: RULE_TEXT }, C01: r.d ? { data: r.d, savedAt: r.f.updatedAt } : null,
      plan: { works: PLAN_WORKS, scen: PLAN_SCEN.map((s) => [s[0], s[1]]), laws: PLAN_LAWS, defaults: D, C02: d ? { data: Object.assign(d, { evidenceFiles: ev }), savedAt: p.f.updatedAt } : null } };
  }
  /** 화면에 보여 줄 업체 정보 (기존 publicCompany_와 같은 항목) */
  function publicCompany(b) {
    if (!b) return null;
    const o = {};
    ['id', 'email', 'company', 'regNo', 'representative', 'address', 'industry', 'contact', 'phone', 'contactEmail', 'status', 'createdAt', 'duplicate', 'reason', 'submissionStatus', 'submittedAt', 'correctionKeys', 'approverEmail', 'renewAt', 'renewMode', 'infoAt'].forEach((k) => o[k] = b[k] ?? '');
    o.certMissing = !b.certFileId; o.valid = contractValid(b); o.infoFresh = infoFresh(b);
    return o;
  }
  /** 직원이 볼 수 있는 업체: 안전보건팀 = 전체 / 그 외 = 본인(로그인 계정·회사메일)이 승인 담당자인 업체 */
  async function visibleCompanies(a, st, status) {
    const C = db.collection('COMPANIES');
    if (st && st.role === 'SAFETY') return docs(await (status ? C.where('status', '==', status) : C).get());
    const mails = [...new Set([a.email, lower(st && st.companyEmail)].filter(Boolean))], seen = new Map();
    // 보안 규칙이 확인할 수 있게 메일 주소마다 따로 조회
    const snaps = await Promise.all(mails.map((m) => { let q = C.where('approverEmail', '==', m); if (status) q = q.where('status', '==', status); return q.get(); }));
    snaps.forEach((s) => docs(s).forEach((x) => seen.set(x.id, x)));
    return [...seen.values()];
  }
  /** 알림 숫자: 사업자 승인 대기 · 서류 검토 대기 · (안전보건팀) 안 읽은 참조 알림. 공사 관련 숫자는 F1.3부터 */
  async function badges(a, memo) {
    const o = { admin: 0, review: 0, jobs: 0, newVendors: [], pendingAttend: 0, notices: 0 }, st = await staffOf(a, memo);
    if (!st && !isInternalEmail(a.email)) return o;
    const cs = await visibleCompanies(a, st);
    o.admin = cs.filter((x) => x.status === 'PENDING').length;
    if (st) o.review = cs.filter((x) => x.status === 'VERIFIED' && x.submissionStatus === 'SUBMITTED').length;
    if (st && st.role === 'SAFETY') o.notices = docs(await db.collection('NOTICES').get()).filter((n) => !(n.readBy || []).includes(a.email)).length;
    if (st) {
      // 계약 전 검토가 끝났는데 아직 어느 공사에도 배정 안 된 업체 + 종료 예정·종료일 지난 공사
      const [jvs, ver, jobs] = await Promise.all([db.collection('JOB_VENDORS').get().then(docs), db.collection('COMPANIES').where('status', '==', 'VERIFIED').get().then(docs), db.collection('JOBS').get().then(docs)]);
      const assigned = new Set(jvs.map((x) => x.companyId));
      o.newVendors = ver.filter((x) => x.submissionStatus === 'APPROVED' && !assigned.has(x.id)).map((x) => ({ id: x.id, company: x.company, industry: x.industry }));
      o.jobEnd = jobs.filter((j) => (st.role === 'SAFETY' || lower(j.hostEmail) === a.email) && ['SOON', 'OVER'].includes(jobEndInfo(j).state)).length;
      o.permits = 0; o.insp = 0; o.evalDraft = 0;  // F1.4·F1.5·F1.7
      o.jobs = o.newVendors.length + o.pendingAttend + o.jobEnd;
    }
    return o;
  }

  /* ---------- 기능 (기존 Code.gs 이름 그대로) ---------- */
  const API = {};
  /** 첫 화면 정보 (기존 portalData와 같은 모양) */
  /** 승인된 업체의 작성 자료 한꺼번에 (내 것만 읽도록 uid로 조회) */
  async function vendorBundle(a, b) {
    const mine = (col) => db.collection(col).where('uid', '==', a.uid).get().then(docs).then((l) => l.filter((x) => x.companyId === b.id));
    const [profiles, files, subs, forms, tpls, jvs] = await Promise.all([mine('PROFILES'), mine('DOCUMENTS'), mine('DOC_SUBMISSIONS'), mine('CONTRACT_FORMS'), db.collection('TEMPLATES').where('active', '==', 'Y').get().then(docs),
      db.collection('JOB_VENDORS').where('vendorUid', '==', a.uid).get().then(docs).then((l) => l.filter((x) => x.companyId === b.id))]);
    // 진행 중(종료 전) 공사 수 → 0이면 업체 메뉴에서 공사 업무를 숨김
    const js = await Promise.all(jvs.map((v) => db.collection('JOBS').doc(v.jobId).get().then((s) => (s.exists ? s.data() : null)).catch(() => null)));
    return { profiles, files, subs, forms, tpl: activeTemplates(tpls), openJobs: js.filter((j) => j && j.status !== 'ENDED').length };
  }
  API.portalData = async (a) => {
    const memo = {}, st = await staffOf(a, memo), b = await myCompany(a), verified = !!b && b.status === 'VERIFIED';
    const [isApprover, V, bd] = await Promise.all([
      isInternalEmail(a.email) ? db.collection('COMPANIES').where('approverEmail', '==', a.email).limit(1).get().then((s) => !s.empty) : false,
      verified ? vendorBundle(a, b) : null, badges(a, memo)]);
    let steps = [], documents = [], docBoard = null, forms = null;
    if (V) {
      steps = V.profiles.map((x) => ({ step: Number(x.step), data: staleForm(b, x.updatedAt) ? {} : (x.data || {}) }));
      const linked = new Set(V.subs.map((x) => x.documentId));
      documents = V.files.filter((x) => !linked.has(x.id)).map((x) => ({ id: x.id, name: x.name, mime: x.mime }));
      docBoard = vendorDocBoard(b, V.tpl, V.subs);
      forms = contractFormsView(b, V.forms, V.files, (steps.find((x) => x.step === 1) || {}).data || {});
    }
    return {
      email: a.email, isApprover, correctionNote: b && b.submissionStatus === 'CORRECTION' ? b.correctionNote || '' : '', openJobs: V ? V.openJobs : null,
      staff: st ? { name: st.name, role: st.role, roleLabel: (st.master ? '마스터 · ' : '') + (STAFF_ROLES[st.role] || st.role), master: !!st.master } : null,
      isMaster: isMaster(a), testSkipFiles: CFG.TEST_SKIP_FILES,
      company: publicCompany(b),
      role: st ? st.role : 'VENDOR', industries: CFG.INDUSTRIES, fields: FIELDS, stepNames: STEP_NAMES, industryFields: (b && INDUSTRY_FIELDS[b.industry]) || [],
      steps, documents, docBoard, forms, appVersion: VERSION, mode: a.mode,
      badges: bd, loginUrl: location.origin + location.pathname,
    };
  };
  /** [업체] 승인 대기 화면의 자동 확인용 (반려 포함 가장 최근 신청) */
  API.myStatus = async (a) => {
    const b = (await myCompanies(a))[0];
    return b ? { status: b.status === 'OTP_PENDING' ? 'VERIFIED' : b.status, reason: b.reason || '', submissionStatus: b.submissionStatus || 'DRAFT' } : null;
  };
  API.myBadges = async (a) => badges(a);

  /** [업체] 사업자 등록 신청 → 중계 서버가 기록·승인요청 메일 */
  API.registerBusiness = async (a, d, cert) => {
    if (a.mode === 'STAFF') fail('다이소 담당자로 접속했습니다. 업체 신청은 로그인 화면에서 [협력업체]로 다시 로그인해 주세요.');
    await relay('register', { d: d || {}, cert: cert && cert.data ? cert : null });
    return API.portalData(a);
  };
  /** [직원] 사업자 등록 신청 목록 */
  API.applications = async (a) => {
    const st = await staffOf(a);
    if (!st && !isInternalEmail(a.email)) fail('승인 담당자 권한이 없습니다.');
    return (await visibleCompanies(a, st)).sort(byNewest).map(publicCompany);
  };
  /** [직원] 업체 현황 */
  API.vendorList = async (a) => {
    const st = await staffOf(a);
    if (!st && !isInternalEmail(a.email)) fail('아성다이소 직원 계정만 볼 수 있습니다.');
    const list = (await visibleCompanies(a, st)).sort(byNewest);
    // 승인된 업체: 제출 서류 · 계획서 증빙 · 계약 전 평가 결과 (직원 명단에 없는 승인 담당자는 보안 규칙상 못 봄 → 빈칸)
    const detail = async (b) => {
      if (b.status !== 'VERIFIED' || !st) return { docs: [], evidence: [], contractEval: null };
      const by = (col) => db.collection(col).where('companyId', '==', b.id).get().then(docs);
      try {
        const [subs, forms, evs] = await Promise.all([by('DOC_SUBMISSIONS'), by('CONTRACT_FORMS'), by('EVALUATIONS')]);
        const ids = (parse((forms.find((x) => x.code === 'C02') || {}).json, {}) || {}).evidence || [];
        const files = ids.length ? await by('DOCUMENTS') : [];
        const e = evs.filter((x) => x.result === 'APPROVED').sort((p, q) => String(p.evaluatedAt).localeCompare(String(q.evaluatedAt))).pop();
        return { docs: reviewDocBoard(subs), evidence: ids.map((id) => { const x = files.find((y) => y.id === id); return x ? { id, name: x.name } : null; }).filter(Boolean),
          contractEval: e ? { good: Number(e.good) || 0, normal: Number(e.normal) || 0, poor: Number(e.poor) || 0, at: e.evaluatedAt } : null };
      } catch (e) { if (e.code !== 'permission-denied') throw e; return { docs: [], evidence: [], contractEval: null }; }
    };
    const [more, jvs] = await Promise.all([Promise.all(list.map(detail)), st ? db.collection('JOB_VENDORS').get().then(docs) : []]);
    return { list: list.map((b, i) => ({ ...publicCompany(b), ...more[i], jobs: jvs.filter((x) => x.companyId === b.id).length, lastEval: null })) };  // 종료 평가는 F1.7
  };
  /** [직원] 승인·반려 → 중계 서버가 처리하고 업체에 메일 */
  API.decideBusiness = async (a, id, decision, reason, ret) => {
    if (!['APPROVE', 'REJECT'].includes(decision)) fail('승인 또는 반려를 선택해 주세요.');
    if (decision === 'REJECT' && !tidy(reason)) fail('반려 사유를 입력해 주세요.');
    await relay('decide', { companyId: String(id || ''), decision, reason: tidy(reason, 500) });
    return ret === 'vendors' ? API.vendorList(a) : API.applications(a);
  };
  /** [직원] 신청 첨부파일 목록 (직원 명단에 있으면 바로, 아니면 중계 서버가 권한 확인) */
  API.getRegistrationDocs = async (a, id) => {
    if (await staffOf(a)) return docs(await db.collection('DOCUMENTS').where('companyId', '==', String(id || '')).get()).map((x) => ({ id: x.id, name: x.name }));
    return relay('regDocs', { companyId: String(id || '') }, true);
  };
  /** 파일 내려받기 (권한은 중계 서버가 다시 확인) */
  API.getInternalFile = async (a, companyId, docId) => relay('file', { companyId: String(companyId || ''), docId: String(docId || '') }, true);
  API.getMyFile = async (a, docId) => relay('file', { docId: String(docId || '') }, true);

  /* ---------- F1.2 계약 전 서류 ---------- */
  /** [업체] 사업장 정보 저장 (자동저장) — Firestore에 바로 씀. 상태·보완 항목은 보안 규칙이 다시 확인 */
  API.saveStep = async (a, step, data) => {
    const b = await myCompany(a), n = Number(step);
    if (!b || b.status !== 'VERIFIED' || !FIELDS[n]) fail('작성 권한이 없습니다.');
    const s = b.submissionStatus || 'DRAFT';
    if (!['DRAFT', 'CORRECTION'].includes(s)) fail('제출 완료된 자료는 수정할 수 없습니다.');
    if (s === 'CORRECTION') { const keys = parse(b.correctionKeys, []); if (Object.keys(data || {}).some((k) => !keys.includes(n + ':' + k))) fail('보완 요청받은 항목만 변경할 수 있습니다.'); }
    const allowed = FIELDS[n].map((v) => v[0]); if (n === 3) allowed.push('industry1', 'industry2');
    const id = b.id + '_' + n, cur = docs(await db.collection('PROFILES').where('uid', '==', a.uid).get()).find((x) => x.id === id);
    const next = { ...(cur && !staleForm(b, cur.updatedAt) ? cur.data || {} : {}) };
    for (const [k, v] of Object.entries(data || {})) { if (!allowed.includes(k)) fail('허용되지 않은 입력항목입니다.'); next[k] = tidy(v, 4000); }
    await db.collection('PROFILES').doc(id).set({ companyId: b.id, uid: a.uid, step: n, data: next, updatedAt: now(), updatedBy: a.email });
    return API.portalData(a);
  };
  /** [업체] 제출 전 누락 확인 · 최종 제출 (제출·검토 메일은 중계 서버) */
  API.checkSubmission = async () => relay('check', {}, true);
  API.submitProfile = async (a) => { const r = await relay('submit', {}); return r && r.ok ? { ok: true, portal: await API.portalData(a) } : r; };
  /** [업체] 서류 파일 등록 (덮어쓰지 않고 새 버전) */
  API.uploadContractDoc = async (a, code, f) => { await relay('contractDoc', { code: String(code || ''), f }); return API.portalData(a); };
  API.uploadEvidence = async (a, f) => { await relay('evidence', { f }); return API.portalData(a); };
  /** [업체] 규정·계획서 작성 완료 → 중계 서버가 서명 PDF를 만들어 제출서류로 등록 */
  API.saveRuleDoc = async (a, d, sign) => { await relay('rule', { d: d || {}, sign: String(sign || '') }); return API.portalData(a); };
  API.savePlanDoc = async (a, d, sign) => { await relay('plan', { d: d || {}, sign: String(sign || '') }); return API.portalData(a); };
  API.uploadPlanFile = async (a, f) => relay('planFile', { f });

  /** [업체] 신규 작성(재평가) 시작 · 사업자 정보 수정 */
  API.startRenewal = async (a, mode) => { await relay('renew', { renewMode: mode === 'NEW' ? 'NEW' : 'KEEP' }); return API.portalData(a); };
  API.saveCompanyInfo = async (a, d, cert) => { await relay('companyInfo', { d: d || {}, cert: cert && cert.data ? cert : null }); return API.portalData(a); };

  /* 표준양식 (샘플): 목록은 Firestore · 파일은 구글 드라이브(중계) */
  API.getTemplate = async (a, code) => relay('template', { code: String(code || '') }, true);
  API.templateAdminList = async (a) => {
    if (!(await isSafety(a))) fail('안전보건팀만 표준양식을 관리할 수 있습니다.');
    const all = docs(await db.collection('TEMPLATES').get());
    return docTypes().map((t) => {
      const cur = all.filter((x) => x.docType === t.code && x.active === 'Y').sort((x, y) => Number(y.version) - Number(x.version))[0];
      return { code: t.code, stage: t.stage, stageLabel: DOC_STAGE[t.stage], name: t.name, cycle: t.cycle, ownerLabel: DOC_OWNER[t.owner] || t.owner, kind: t.kind, required: t.required === 'Y',
        current: cur ? { name: cur.name, version: Number(cur.version), uploadedAt: cur.uploadedAt, uploadedBy: cur.uploadedBy } : null, history: all.filter((x) => x.docType === t.code).length };
    });
  };
  API.uploadTemplate = async (a, code, f) => { await relay('tplUpload', { code: String(code || ''), f }); return API.templateAdminList(a); };
  API.refreshTemplateFolders = async (a) => { const report = await relay('tplSync', {}); return { report, list: await API.templateAdminList(a) }; };

  /* 참조 알림 (안전보건팀) */
  API.noticeList = async (a) => {
    if (!(await isSafety(a))) fail('안전보건팀만 볼 수 있습니다.');
    const list = docs(await db.collection('NOTICES').get()).sort((x, y) => String(y.time).localeCompare(String(x.time))).slice(0, 100);
    return { labels: NOTICE_LABEL, list: list.map((n) => ({ id: n.id, time: n.time, type: n.type, text: n.text, jobId: n.jobId, read: (n.readBy || []).includes(a.email) })) };
  };
  API.readNotices = async (a) => {
    if (!(await isSafety(a))) fail('안전보건팀만 볼 수 있습니다.');
    const s = await db.collection('NOTICES').get(), b = db.batch(); let n = 0;
    s.docs.forEach((d) => { const r = d.data().readBy || []; if (!r.includes(a.email)) { b.update(d.ref, { readBy: r.concat(a.email) }); n++; } });
    if (n) await b.commit();
    return API.noticeList(a);
  };

  /* 직원 관리: 화면은 줄 번호(row)를 쓰므로 번호 ↔ 문서(로그인 Gmail)를 기억 */
  let ROWS = [];
  API.staffList = async (a) => {
    if (!(await isSafety(a))) fail('안전보건팀만 직원 명단을 관리할 수 있습니다.');
    const s = await db.collection('STAFF').get();
    const list = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => String(x.createdAt || '').localeCompare(String(y.createdAt || '')) || x.id.localeCompare(y.id));
    ROWS = list.map((x) => x.id);
    return { me: a.email, roles: STAFF_ROLES, list: list.map((x, i) => ({ row: i + 1, name: x.name, dept: x.dept, role: x.role, companyEmail: x.companyEmail, loginEmail: x.loginEmail || x.id, active: x.active })) };
  };
  API.saveStaff = async (a, d) => {
    if (!(await isSafety(a))) fail('안전보건팀만 직원 명단을 관리할 수 있습니다.');
    const name = tidy(d?.name, 40), dept = tidy(d?.dept, 60), role = String(d?.role || ''), ce = lower(tidy(d?.companyEmail, 160)), le = lower(tidy(d?.loginEmail, 160)), active = d?.active === 'N' ? 'N' : 'Y';
    const bad = []; if (!name) bad.push('이름'); if (!STAFF_ROLES[role]) bad.push('역할'); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(le)) bad.push('로그인 Gmail'); if (ce && !isInternalEmail(ce)) bad.push('회사메일(@' + CFG.APPROVER_DOMAINS.join(', @') + ')');
    if (bad.length) fail('다음 항목을 확인해 주세요:\n- ' + bad.join('\n- '));
    const row = Number(d?.row) || 0, curId = row ? ROWS[row - 1] : null;
    if (row && !curId) fail('수정할 직원을 찾을 수 없습니다. 화면을 새로 고쳐 주세요.');
    if (curId === a.email && (active === 'N' || role !== 'SAFETY')) fail('본인 계정은 사용중지하거나 안전보건팀에서 뺄 수 없습니다.');
    const o = { name, dept, role, companyEmail: ce, loginEmail: le, active };
    await db.runTransaction(async (tx) => {
      const tgt = db.collection('STAFF').doc(le), t = await tx.get(tgt);
      if (t.exists && le !== curId) fail('이미 등록된 로그인 Gmail입니다.');
      if (curId) {
        const old = await tx.get(db.collection('STAFF').doc(curId)); if (!old.exists) fail('수정할 직원을 찾을 수 없습니다.');
        const base = old.data();
        tx.set(tgt, { ...o, createdBy: base.createdBy || a.email, createdAt: base.createdAt || now(), updatedBy: a.email, updatedAt: now() });
        if (le !== curId) tx.delete(old.ref);  // 로그인 Gmail을 바꾸면 문서 이름도 바뀜
      } else tx.set(tgt, { ...o, createdBy: a.email, createdAt: now() });
    });
    audit(a, '', curId ? 'STAFF_EDIT' : 'STAFF_ADD', name + ' ' + le + ' ' + role + ' ' + active);
    return API.staffList(a);
  };
  API.deleteStaff = async (a, row) => {
    if (!(await isSafety(a))) fail('안전보건팀만 직원 명단을 관리할 수 있습니다.');
    const id = ROWS[Number(row) - 1]; if (!id) fail('삭제할 직원을 찾을 수 없습니다. 화면을 새로 고쳐 주세요.');
    if (id === a.email) fail('본인 계정은 삭제할 수 없습니다.');
    if (MASTER_EMAILS.includes(id)) fail('마스터 계정은 삭제할 수 없습니다.');
    await db.collection('STAFF').doc(id).delete();
    audit(a, '', 'STAFF_DELETE', id);
    return API.staffList(a);
  };

  /* ---------- F1.3 공사 · 업체 배정 · 작업자 · 오늘 인원 ----------
   *  JOBS/{JOB-…}                 공사 (vendorUids = 배정 업체 대표 계정 → 업체가 자기 공사만 읽음)
   *  JOB_VENDORS/{공사ID_업체ID}   배정 (workerToken = 작업자 등록 QR 값)
   *  WORKERS/{WK-…}               작업자 명단 = 신규자 교육일지 (본인 QR 등록은 중계 서버가 씀)
   *  CREW/{공사ID_업체ID_날짜}      오늘 작업 인원 = 그날 작업안전수칙 서명 */
  const JOB_KINDS = { WORK: '매장 공사', CONTRACT: '계약 단위(입고도우미·재고조사 등)' };
  const MEET_KINDS = { COUNCIL: '안전보건협의체 회의', JOINT: '합동안전보건점검' };
  const WORK_RULES = ['작업에 적합한 단정한 복장을 착용한다.',
    '안전화, 안전모 등 안전보호구를 착용하고, 작업에 따라 안전보호구를 선별하며 철저히 착용 후 관리자의 인가를 받고 작업한다.',
    '사다리 포함 고소 작업 시에는 반드시 안전벨트를 착용하고 체결 후 작업한다.',
    '관리감독자의 지시에 따라 올바른 순서로 작업한다.',
    '작업 공구 및 기계는 반드시 안전점검 후 사용한다.',
    '핸드그라인더, 고속절단기 등 유해위험 기계기구는 반드시 안전장치를 설치 후 사용한다.',
    '전기 및 위험물을 취급 시에는 관계자의 지시에 따른다.',
    '현장 내에서는 절대로 뛰어다니지 않는다.',
    '사전 승인 없는 화기의 취급 및 절단, 용접은 엄금한다.',
    '유해위험 작업 시 반드시 작업구역을 설정하고, 경계를 분명히 하여 작업 중 재해가 발생하지 않도록 주의한다.',
    '작업중 음주 및 흡연은 엄금하고, 흡연은 정해진 장소에서만 한다.',
    '작업이 끝나면 반드시 정리정돈을 실시하고, 관계자의 인가를 받고 작업을 종료한다.',
    '관계자의 인가없이 작업을 끝낸 후 하자가 발생하면 공사업체 책임자가 책임을 진다.',
    '업체 책임자 및 직원은 관계인의 연락처를 숙지하고, 긴급상황 등 이상 발생 시 즉시 연락을 취한다.'];
  const WORK_PLEDGE = '작업자는 상기의 안전 작업 수칙을 교육 받고, 작업 시 안전 작업 수칙을 준수하며, 안전 작업 서약서에 서명 후 작업을 실시한다.';
  const WORKER_ROLES = ['관리자', '근로자'], EDU_TYPE = '신규자 교육 (최초 1회)';
  const INSP_ITEMS = ['정리정돈 실시상태', '소방설비 관리상태', '복장 및 보호구 착용상태', '안전장치 관리상태', '안전표지 부착', '유해위험작업관리', '안전수칙 준수', '관리감독 이행여부', '유해물질관리', '감전재해 예방관리', '인화성 가스 안전관리'];
  const daysBetween = (x, y) => Math.round((new Date(y + 'T00:00:00Z') - new Date(x + 'T00:00:00Z')) / 86400000);
  const rand8 = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) => v.toString(16).padStart(2, '0')).join('');
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  function jobEndInfo(j) {
    if (j.status === 'ENDED') return { state: 'ENDED', endedAt: j.endedAt ? kst(j.endedAt) : '' };
    if (!isDate(j.endDate)) return { state: 'OPEN' };
    const left = daysBetween(today(), j.endDate); return { state: left < 0 ? 'OVER' : left <= 3 ? 'SOON' : 'OPEN', left };
  }
  const canSeeJob = (a, s, j) => !!j && (s.role === 'SAFETY' || lower(j.hostEmail) === a.email);
  /** 공사 여러 개의 기록을 한꺼번에 (Firestore 'in'은 30개씩) */
  async function byJobs(col, ids) {
    const parts = []; for (let i = 0; i < ids.length; i += 30) parts.push(ids.slice(i, i + 30));
    return (await Promise.all(parts.map((p) => db.collection(col).where('jobId', 'in', p).get().then(docs)))).flat();
  }
  /** 업체별 이행 현황 (작업허가서·순회점검은 F1.4·F1.5에서 채움) */
  function vjStats(crew) {
    const wd = new Set(crew.map((x) => x.date).filter(Boolean)).size;
    return { workDays: wd, crewDays: crew.length, permitDays: 0, insp: 0, inspNeed: wd ? Math.max(1, Math.ceil(wd / 2)) : 0, openFindings: 0, findTotal: 0, todayPermit: false, inspToday: false, inspDue: true, lastInsp: '' };
  }
  /** 공사에 배정할 수 있는 업체 (재평가 중 포함 · 테스트 모드면 승인 전도) */
  async function jobVendorChoices() {
    return docs(await db.collection('COMPANIES').where('status', '==', 'VERIFIED').get()).filter((x) => canExec(x) || CFG.TEST_SKIP_FILES).map((x) => {
      const v = contractValid(x);
      return { id: x.id, uid: x.uid, company: x.company, industry: x.industry, approved: canExec(x), renewing: !!x.renewAt, renewStatus: x.renewAt ? x.submissionStatus : '', valid: v, expired: !!(v && v.expired), lastEval: null };
    });
  }
  function jobView(j, jvs, wks, crews) {
    const vs = jvs.filter((v) => v.jobId === j.id).sort((x, y) => String(x.addedAt).localeCompare(String(y.addedAt))), cr = crews.filter((c) => c.jobId === j.id);
    return { id: j.id, title: j.title, storeName: j.storeName, storeCode: j.storeCode, address: j.address, kind: j.kind, kindLabel: JOB_KINDS[j.kind] || j.kind, startDate: j.startDate, endDate: j.endDate,
      delegations: j.delegations || {}, hostName: j.hostName, hostEmail: j.hostEmail, status: j.status,
      vendors: vs.map((v) => ({ companyId: v.companyId, company: v.company, trade: v.trade })),
      workerCount: wks.filter((w) => w.jobId === j.id).length, permitWaiting: 0, permitTotal: 0, inspTotal: 0, inspUnchecked: 0, findOpen: 0,
      vstats: vs.map((v) => Object.assign({ company: v.company, companyId: v.companyId }, vjStats(cr.filter((c) => c.companyId === v.companyId)))),
      end: jobEndInfo(j), evalDone: 0, evalTotal: 0, crewDays: cr.length, meetings: [] };  // 미팅은 F1.6 · 종료 평가는 F1.7
  }
  async function staffOnly(a) { const s = await staffOf(a); if (!s) fail('아성다이소 직원 계정만 사용할 수 있습니다.'); return s; }
  /** [직원] 공사 목록 + 배정 가능한 업체 */
  API.jobBoard = async (a) => {
    const s = await staffOnly(a);
    const [choices, all] = await Promise.all([jobVendorChoices(), db.collection('JOBS').get().then(docs)]);
    const jobs = all.filter((j) => canSeeJob(a, s, j)).sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt))), ids = jobs.map((j) => j.id);
    const [jvs, wks, crews] = await Promise.all([byJobs('JOB_VENDORS', ids), byJobs('WORKERS', ids), byJobs('CREW', ids)]);
    return { me: { name: s.name, role: s.role }, kinds: JOB_KINDS, meetKinds: MEET_KINDS, vendors: choices.map(({ uid, ...v }) => v), testMode: CFG.TEST_SKIP_FILES, jobs: jobs.map((j) => jobView(j, jvs, wks, crews)) };
  };
  /** [직원] 공사 만들기·수정 (참여 업체·위임장 정보 포함) */
  API.saveJob = async (a, d) => {
    const s = await staffOnly(a);
    const title = tidy(d?.title, 120), storeName = tidy(d?.storeName, 80), storeCode = tidy(d?.storeCode, 30), address = tidy(d?.address, 200), kind = JOB_KINDS[d?.kind] ? d.kind : 'WORK', sd = tidy(d?.startDate, 10), ed = tidy(d?.endDate, 10);
    const bad = []; if (!title) bad.push('공사명'); if (!storeName) bad.push('매장명(또는 계약명)'); if (!isDate(sd)) bad.push('시작일'); if (ed && !isDate(ed)) bad.push('종료일'); if (ed && sd && ed < sd) bad.push('종료일이 시작일보다 빠름');
    if (bad.length) fail('다음 항목을 확인해 주세요:\n- ' + bad.join('\n- '));
    const dl = {}; ['COUNCIL', 'JOINT'].forEach((k) => { const x = (d?.delegations || {})[k] || {}; dl[k] = { delegator: tidy(x.delegator, 60), delegatee: tidy(x.delegatee, 60), date: tidy(x.date, 10) }; });
    const choices = await jobVendorChoices(), want = [...new Set((d?.vendorIds || []).map(String))], pick = want.filter((id) => choices.some((c) => c.id === id));
    let id = tidy(d?.id, 40); const cur = id ? await db.collection('JOBS').doc(id).get() : null;
    if (id && (!cur.exists || !canSeeJob(a, s, cur.data()))) fail('수정할 수 없는 공사입니다.');
    const have = id ? docs(await db.collection('JOB_VENDORS').where('jobId', '==', id).get()) : [];
    // 계약 전 평가 유효기간(1년)이 지난 업체는 새로 배정하지 않음 (이미 배정된 업체는 그대로)
    const add = pick.filter((c) => !have.some((h) => h.companyId === c)).map((c) => choices.find((x) => x.id === c));
    const exp = add.filter((v) => v.expired && !CFG.TEST_SKIP_FILES);
    if (exp.length) fail('계약 전 평가 유효기간(1년)이 지난 업체는 새로 배정할 수 없습니다.\n업체가 계약 전 서류를 고쳐 다시 제출하고 승인받으면 배정할 수 있습니다:\n- ' + exp.map((v) => v.company + ' (유효기간 ~' + v.valid.until + ')').join('\n- '));
    // 체크 해제한 업체 배정 취소 (그 업체의 작업자·작업 기록이 있으면 취소 불가)
    const drop = have.filter((v) => !want.includes(v.companyId));
    if (drop.length) {
      const [w, c] = await Promise.all(['WORKERS', 'CREW'].map((n) => db.collection(n).where('jobId', '==', id).get().then(docs)));
      const busy = drop.filter((v) => w.some((x) => x.companyId === v.companyId) || c.some((x) => x.companyId === v.companyId));
      if (busy.length) fail('작업자·작업 기록이 있는 업체는 배정을 취소할 수 없습니다:\n- ' + busy.map((v) => v.company).join('\n- '));
    }
    if (!id) id = 'JOB-' + rand8();
    const vendorUids = [...new Set(have.filter((v) => want.includes(v.companyId)).map((v) => v.vendorUid).concat(add.map((v) => v.uid)).filter(Boolean))];
    const o = { title, storeName, storeCode, address, kind, startDate: sd, endDate: ed, delegations: dl, vendorUids }, b = db.batch(), ref = db.collection('JOBS').doc(id);
    if (cur) b.update(ref, o); else b.set(ref, { id, ...o, hostEmail: a.email, hostName: s.name, status: 'OPEN', createdAt: now(), extensions: [], endedAt: '', endedBy: '' });
    add.forEach((v) => b.set(db.collection('JOB_VENDORS').doc(id + '_' + v.id), { jobId: id, companyId: v.id, company: v.company, trade: v.industry, vendorUid: v.uid, addedBy: a.email, addedAt: now(), workerToken: '' }));
    drop.forEach((v) => b.delete(db.collection('JOB_VENDORS').doc(v.id)));
    await b.commit();
    if (drop.length) audit(a, '', 'JOB_VENDOR_REMOVE', id + ' ' + drop.map((v) => v.company).join(', '));
    audit(a, '', cur ? 'JOB_EDIT' : 'JOB_ADD', id + ' ' + title + ' 업체 ' + pick.length);
    return API.jobBoard(a);
  };
  /** [직원] 공사 삭제 — 업체 배정·작업자·작업 인원 기록까지 함께 (삭제 내역은 접근및작업이력에) */
  API.deleteJob = async (a, jobId) => {
    const s = await staffOnly(a), id = tidy(jobId, 40), js = await db.collection('JOBS').doc(id).get(), j = js.exists ? js.data() : null;
    if (!j || !canSeeJob(a, s, j)) fail('삭제할 수 없는 공사입니다.');
    const lists = await Promise.all(['JOB_VENDORS', 'WORKERS', 'CREW'].map((n) => db.collection(n).where('jobId', '==', id).get()));
    const b = db.batch(), cnt = {};
    ['JOB_VENDORS', 'WORKERS', 'CREW'].forEach((n, i) => { cnt[n] = lists[i].docs.length; lists[i].docs.forEach((d) => b.delete(d.ref)); });
    b.delete(js.ref); await b.commit();
    audit(a, '', 'JOB_DELETE', id + ' ' + j.title + ' ' + JSON.stringify(cnt));
    return API.jobBoard(a);
  };

  /* 업체: 내 공사 · 작업자 · 오늘 인원 */
  async function execVendor(a) {
    if (a.mode === 'STAFF') fail('다이소 담당자로 접속했습니다. 업체 업무는 로그인 화면에서 [협력업체]로 다시 로그인해 주세요.');
    const b = await myCompany(a);
    if (!b || b.status !== 'VERIFIED' || !(canExec(b) || CFG.TEST_SKIP_FILES)) fail('계약 전 검토가 승인된 업체 대표 계정만 사용할 수 있습니다.');
    return b;
  }
  const myAssign = async (a, b) => docs(await db.collection('JOB_VENDORS').where('vendorUid', '==', a.uid).get()).filter((v) => v.companyId === b.id);
  const mineOf = (col, a, jobId) => db.collection(col).where('vendorUid', '==', a.uid).where('jobId', '==', jobId).get().then(docs);
  async function vendorJobOf(a, b, jobId, write) {
    const id = tidy(jobId, 40), jv = (await myAssign(a, b)).find((v) => v.jobId === id);
    if (!jv) fail('이 공사에 배정된 업체가 아닙니다.');
    const js = await db.collection('JOBS').doc(id).get(); if (!js.exists) fail('이 공사에 배정된 업체가 아닙니다.');
    const j = js.data(); if (write && j.status === 'ENDED') fail('종료된 공사입니다. 지난 기록은 볼 수만 있습니다.');
    return { jv, j };
  }
  async function siteManagerOf(a, b) { const p = docs(await db.collection('PROFILES').where('uid', '==', a.uid).get()).find((x) => x.id === b.id + '_1'); return String(((p && p.data) || {}).siteManager || ''); }
  /** 그날 수칙 서명 방식: 처음 등록한 날 본인 계정으로 서명 → SELF, 그 외(소장 체크·소장 등록) → MANAGER */
  const crewSnap = (w, date) => ({ id: w.id, name: w.name, role: w.role, trade: w.trade || '', sign: (w.method === 'SELF' && kst(w.rulesAt) === date) ? 'SELF' : 'MANAGER' });
  async function crewWrite(a, b, j, date, list, sm) {
    const id = j.id + '_' + b.id + '_' + date;
    await db.collection('CREW').doc(id).set({ id, jobId: j.id, companyId: b.id, vendorUid: a.uid, date, workers: list.map((w) => crewSnap(w, date)), count: list.length, siteManager: sm, savedBy: a.email, savedAt: now() });
  }
  /** 새로 등록한 작업자를 오늘 인원에 추가 (처음 온 날 = 그날 작업자) */
  async function crewAppend(a, b, j, w, ws) {
    const t = today(), cur = (await mineOf('CREW', a, j.id)).find((x) => x.date === t && x.companyId === b.id), ids = cur ? (cur.workers || []).map((x) => x.id) : [];
    if (ids.includes(w.id)) return;
    const act = ws.filter((x) => x.companyId === b.id && x.active !== 'N'), list = ids.map((id) => act.find((x) => x.id === id)).filter(Boolean).concat([w]);
    await crewWrite(a, b, j, t, list, cur ? cur.siteManager : await siteManagerOf(a, b));
  }
  /** [업체] 내 공사 목록 */
  API.myJobs = async (a) => {
    const b = await execVendor(a), t = today(), jvs = (await myAssign(a, b)).sort((x, y) => String(y.addedAt).localeCompare(String(x.addedAt)));
    const [jobs, wks, crews] = await Promise.all([
      Promise.all(jvs.map((v) => db.collection('JOBS').doc(v.jobId).get().then((s) => (s.exists ? s.data() : null)).catch(() => null))),
      db.collection('WORKERS').where('vendorUid', '==', a.uid).get().then(docs), db.collection('CREW').where('vendorUid', '==', a.uid).get().then(docs)]);
    return { today: t, company: b.company, jobs: jvs.map((v, i) => {
      const j = jobs[i]; if (!j) return null;
      const cr = crews.filter((c) => c.jobId === j.id && c.companyId === b.id), c = cr.find((x) => x.date === t);
      return { id: j.id, title: j.title, storeName: j.storeName, startDate: j.startDate, endDate: j.endDate, hostName: j.hostName, trade: v.trade, status: j.status,
        workers: wks.filter((w) => w.jobId === j.id && w.companyId === b.id && w.active !== 'N').length, todayCount: c ? Number(c.count) : 0, todayDone: !!c, end: jobEndInfo(j), stats: vjStats(cr) };
    }).filter(Boolean) };
  };
  async function jobPack(a, b, j, jv) {
    const t = today(), [wks, crews, sm0] = await Promise.all([mineOf('WORKERS', a, j.id), mineOf('CREW', a, j.id), siteManagerOf(a, b)]);
    const ws = wks.filter((w) => w.companyId === b.id && w.active !== 'N'), cr = crews.filter((c) => c.companyId === b.id).sort((x, y) => (x.date < y.date ? 1 : -1));
    const day = (c) => ({ date: c.date, count: Number(c.count) || (c.workers || []).length, siteManager: c.siteManager, savedAt: c.savedAt, workers: c.workers || [] }), tc = cr.find((x) => x.date === t);
    return { today: t, job: { id: j.id, title: j.title, storeName: j.storeName, address: j.address, startDate: j.startDate, endDate: j.endDate, hostName: j.hostName },
      company: { id: b.id, company: b.company, trade: jv.trade }, link: location.origin + location.pathname + '?review=WRK-' + jv.workerToken,
      workers: ws.map((w) => ({ id: w.id, name: w.name, role: w.role, trade: w.trade, method: w.method, eduAt: w.eduAt, email: w.email })),
      todayCrew: tc ? day(tc) : null, history: cr.slice(0, 30).map(day), siteManager: tc ? tc.siteManager : sm0,
      rules: WORK_RULES, pledge: WORK_PLEDGE, roles: WORKER_ROLES,
      permits: [], insp: { items: INSP_ITEMS, type: '순회점검일지', last: '', todayDone: false, due: true, since: null, open: [], recent: [] },  // F1.4·F1.5
      jobStatus: j.status, permitToday: null, evalResult: null };
  }
  /** [업체] 공사 화면 (처음 열 때 작업자 등록 QR 값 생성) */
  API.vendorJob = async (a, jobId) => {
    const b = await execVendor(a), { jv, j } = await vendorJobOf(a, b, jobId);
    if (!jv.workerToken) { jv.workerToken = newToken(); await db.collection('JOB_VENDORS').doc(jv.id).update({ workerToken: jv.workerToken }); }
    return jobPack(a, b, j, jv);
  };
  /** [업체] QR 새로 만들기 (링크가 외부로 퍼졌을 때) — 이전 QR은 바로 사용 불가 */
  API.renewWorkerQr = async (a, jobId) => {
    const b = await execVendor(a), { jv, j } = await vendorJobOf(a, b, jobId, true);
    await db.collection('JOB_VENDORS').doc(jv.id).update({ workerToken: newToken() }); audit(a, b.id, 'WORKER_QR_RENEW', j.id);
    return API.vendorJob(a, jobId);
  };
  /** [업체] Google 계정이 없는 작업자를 소장이 직접 등록 (교육 실시 확인 필수) */
  API.addWorker = async (a, jobId, info, requestId) => {
    const b = await execVendor(a), { j, jv } = await vendorJobOf(a, b, jobId, true);
    const name = tidy(info?.name, 40), role = WORKER_ROLES.includes(info?.role) ? info.role : '', trade = tidy(info?.trade, 40) || jv.trade;
    const bad = []; if (!name) bad.push('이름'); if (!role) bad.push('구분(관리자/근로자)'); if (!info?.agree) bad.push('교육 실시·수칙 설명 확인 체크');
    if (bad.length) fail('다음 항목을 확인해 주세요:\n- ' + bad.join('\n- '));
    const rid = String(requestId || '').toLowerCase(); if (rid && !/^[a-f0-9]{32}$/.test(rid)) fail('잘못된 요청 식별값입니다.');
    const workerId = rid ? 'WK-' + rid.slice(0, 16).toUpperCase() : 'WK-' + rand8(), ws = await mineOf('WORKERS', a, j.id), ex = ws.find((x) => x.id === workerId);
    if (ex) {  // 같은 요청을 다시 보낸 경우 (연결이 끊겼다 다시 보냄)
      if (ex.companyId !== b.id || ex.name !== name || ex.role !== role || ex.trade !== trade) fail('등록 요청이 충돌했습니다. 화면을 새로고침해 주세요.');
      await crewAppend(a, b, j, ex, ws);
    } else {
      const t = now(), w = { id: workerId, jobId: j.id, companyId: b.id, company: b.company, name, role, trade, email: '', uid: '', vendorUid: a.uid, method: 'MANUAL', eduType: EDU_TYPE,
        eduContent: '작업 안전 수칙 ' + WORK_RULES.length + '개 항목', eduAt: t, rulesAt: t, addedBy: a.email, addedAt: t, active: 'Y' };
      await db.collection('WORKERS').doc(workerId).set(w); await crewAppend(a, b, j, w, ws.concat([w]));
      audit(a, b.id, 'WORKER_ADD_MANUAL', j.id + ' ' + name);
    }
    return { saved: true, workerId, jobId: j.id, companyId: b.id, name, role, trade, date: today() };
  };
  /** [업체] 작업자 명단에서 빼기 (기록은 남김) */
  API.removeWorker = async (a, jobId, workerId) => {
    const b = await execVendor(a), { j } = await vendorJobOf(a, b, jobId, true), w = (await mineOf('WORKERS', a, j.id)).find((x) => x.id === tidy(workerId, 40) && x.companyId === b.id);
    if (!w) fail('작업자를 찾을 수 없습니다.');
    await db.collection('WORKERS').doc(w.id).update({ active: 'N' }); audit(a, b.id, 'WORKER_REMOVE', j.id + ' ' + w.name);
    return API.vendorJob(a, jobId);
  };
  /** [업체] 오늘 작업 인원 저장 = 그날 작업안전수칙 서명 (같은 날 다시 저장하면 덮어씀) */
  API.saveCrew = async (a, jobId, ids, siteManager) => {
    const b = await execVendor(a), { j } = await vendorJobOf(a, b, jobId, true), sm = tidy(siteManager, 40);
    if (!sm) fail('현장책임자 이름을 입력해 주세요.');
    const ws = (await mineOf('WORKERS', a, j.id)).filter((w) => w.companyId === b.id && w.active !== 'N'), pick = [...new Set((ids || []).map(String))].map((id) => ws.find((w) => w.id === id)).filter(Boolean);
    if (!pick.length) fail('오늘 작업하는 사람을 한 명 이상 체크해 주세요.');
    await crewWrite(a, b, j, today(), pick, sm); audit(a, b.id, 'CREW_SAVE', j.id + ' ' + today() + ' ' + pick.length + '명');
    return API.vendorJob(a, jobId);
  };
  /** [작업자] QR 본인 등록 — QR 값 확인이 필요해 중계 서버가 처리. info 없이 부르면 입력 화면 정보 */
  API.workerCheckIn = async (a, token, info) => relay('workerIn', { token: String(token || ''), info: info || null }, !info);

  /* ---------- 화면에서 쓰는 창구 ---------- */
  const NEXT = { getPermit: 'F1.4', issuePermit: 'F1.4', permitList: 'F1.4', submitInspection: 'F1.5', inspList: 'F1.5', meetCheckIn: 'F1.6', createMeeting: 'F1.6', extendJob: 'F1.7', endJob: 'F1.7', jobEvalList: 'F1.7' };
  async function call(fn, args) {
    const f = Object.prototype.hasOwnProperty.call(API, fn) ? API[fn] : null;
    if (!f) fail('아직 Firebase로 옮기지 않은 기능입니다 (' + fn + (NEXT[fn] ? ' · ' + NEXT[fn] + ' 예정' : '') + ').');
    const a = await me();
    try { return await f(a, ...(args || [])); } catch (e) { throw nice(e); }
  }
  /** 로그인 직후 (기존 op:'login'과 같은 모양으로 돌려줌) */
  async function login(mode, boot) {
    try { localStorage.setItem('fbMode', mode || ''); } catch (e) {}
    const a = await me(), data = { key: a.uid, email: a.email };
    if (/^WRK-[a-f0-9]{32}$/.test(boot || '')) {  // 작업자 등록 QR로 로그인: 등록 화면을 같이 돌려줌
      data.appVersion = VERSION;
      try { data.wk = await API.workerCheckIn(a, boot.slice(4), null); } catch (e) { data.bootError = nice(e).message; }
      return data;
    }
    try { data.portal = await API.portalData(a); } catch (e) { throw nice(e); }
    return data;
  }
  /** 구글 로그인 창 (막히면 화면 이동 방식으로) */
  async function signIn() {
    const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try { await auth.signInWithPopup(p); }
    catch (e) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) { await auth.signInWithRedirect(p); return 'redirect'; }
      throw e;
    }
    USER = auth.currentUser; return 'ok';
  }
  function loginError(e) {
    const c = e && e.code || '';
    if (c === 'auth/popup-closed-by-user') return '로그인 창을 닫았습니다. 다시 눌러 주세요.';
    if (c === 'auth/unauthorized-domain') return '이 주소는 Firebase에 등록되지 않았습니다. (Authentication → 승인된 도메인)';
    if (c === 'auth/network-request-failed') return '인터넷 연결을 확인해 주세요.';
    if (c === 'auth/web-storage-unsupported' || c === 'auth/internal-error') return '이 브라우저에서는 로그인이 안 됩니다. 크롬·사파리로 열어 주세요.';
    return '로그인 실패: ' + (e && e.message || e);
  }
  /** 화면 이동 방식으로 로그인하고 돌아온 경우 */
  async function redirectResult() { try { const r = await auth.getRedirectResult(); if (r && r.user) { USER = r.user; return true; } } catch (e) { return loginError(e); } return false; }
  window.FB = { ok: true, version: VERSION, ready, call, login, signIn, loginError, redirectResult, signOut: () => auth.signOut(), email: () => lower(USER && USER.email), _api: API };
})();
