/* 도급 안전관리 · Firebase 연결부 (F1.2: 로그인 · 직원 관리 · 사업자 등록/승인 · 계약 전 서류)
 * - 화면(app.js)은 예전처럼 api('기능이름', 인자) 로 부르고, 이 파일이 Firestore에서 바로 처리함
 *   (예전: 버튼마다 Apps Script 서버 왕복 → 느림 / 지금: 휴대폰이 Firestore를 직접 읽고 씀)
 * - 권한(업체는 자기 것만, 직원 관리는 안전보건팀만 등)은 Firebase 보안 규칙(firestore.rules)이 최종 확인
 *   → 이 파일의 권한 확인은 화면 안내용, 진짜 막는 것은 규칙
 * - 아직 옮기지 않은 기능은 '아직 Firebase로 옮기지 않은 기능' 안내
 */
(function () {
  const VERSION = '26.10.24 F1.2';
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
    return o;
  }

  /* ---------- 기능 (기존 Code.gs 이름 그대로) ---------- */
  const API = {};
  /** 첫 화면 정보 (기존 portalData와 같은 모양) */
  /** 승인된 업체의 작성 자료 한꺼번에 (내 것만 읽도록 uid로 조회) */
  async function vendorBundle(a, b) {
    const mine = (col) => db.collection(col).where('uid', '==', a.uid).get().then(docs).then((l) => l.filter((x) => x.companyId === b.id));
    const [profiles, files, subs, forms, tpls] = await Promise.all([mine('PROFILES'), mine('DOCUMENTS'), mine('DOC_SUBMISSIONS'), mine('CONTRACT_FORMS'), db.collection('TEMPLATES').where('active', '==', 'Y').get().then(docs)]);
    return { profiles, files, subs, forms, tpl: activeTemplates(tpls) };
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
      email: a.email, isApprover, correctionNote: b && b.submissionStatus === 'CORRECTION' ? b.correctionNote || '' : '', openJobs: verified ? 0 : null,  // 공사는 F1.3부터
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
    const more = await Promise.all(list.map(detail));
    return { list: list.map((b, i) => ({ ...publicCompany(b), ...more[i], jobs: 0, lastEval: null })) };  // 공사·종료 평가는 F1.3 이후
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
  /** [업체] 내 공사 목록 — 공사 기능(F1.3) 전이라 아직 배정된 공사가 없음 */
  API.myJobs = async (a) => {
    const b = await myCompany(a);
    if (!b || !(canExec(b) || CFG.TEST_SKIP_FILES)) fail('계약 전 검토가 승인된 업체만 사용할 수 있습니다.');
    return { today: today(), company: b.company, jobs: [] };
  };
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
  /** 공사 목록: F1.0에서는 아직 공사 기능을 옮기지 않아 빈 목록 (공사 기능은 F1.2) */
  API.jobBoard = async (a) => {
    const st = await staffOf(a); if (!st) fail('아성다이소 직원 계정만 사용할 수 있습니다.');
    return { me: { name: st.name, role: st.role }, kinds: { WORK: '공사', CONTRACT: '계약' }, meetKinds: { COUNCIL: '안전보건협의체 회의', JOINT: '합동안전보건점검' }, vendors: [], testMode: CFG.TEST_SKIP_FILES, jobs: [], notReady: true };
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

  /* ---------- 화면에서 쓰는 창구 ---------- */
  const NEXT = { saveJob: 'F1.3', vendorJob: 'F1.3', addWorker: 'F1.3', workerCheckIn: 'F1.3', saveCrew: 'F1.3', getPermit: 'F1.4', issuePermit: 'F1.4', permitList: 'F1.4', submitInspection: 'F1.5', inspList: 'F1.5', meetCheckIn: 'F1.6', createMeeting: 'F1.6', extendJob: 'F1.7', endJob: 'F1.7', jobEvalList: 'F1.7' };
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
    if (/^WRK-/.test(boot || '')) { data.bootError = '작업자 QR 등록은 아직 Firebase로 옮기지 않았습니다 (F1.2 예정).'; return data; }
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
