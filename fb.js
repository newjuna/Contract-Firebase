/* 도급 안전관리 · Firebase 연결부 (F1.1: 로그인 · 직원 관리 · 사업자 등록/승인)
 * - 화면(app.js)은 예전처럼 api('기능이름', 인자) 로 부르고, 이 파일이 Firestore에서 바로 처리함
 *   (예전: 버튼마다 Apps Script 서버 왕복 → 느림 / 지금: 휴대폰이 Firestore를 직접 읽고 씀)
 * - 권한(업체는 자기 것만, 직원 관리는 안전보건팀만 등)은 Firebase 보안 규칙(firestore.rules)이 최종 확인
 *   → 이 파일의 권한 확인은 화면 안내용, 진짜 막는 것은 규칙
 * - 아직 옮기지 않은 기능은 '아직 Firebase로 옮기지 않은 기능' 안내
 */
(function () {
  const VERSION = '26.10.24 F1.1';
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
  /** 화면에 보여 줄 업체 정보 (기존 publicCompany_와 같은 항목) */
  function publicCompany(b) {
    if (!b) return null;
    const o = {};
    ['id', 'email', 'company', 'regNo', 'representative', 'address', 'industry', 'contact', 'phone', 'contactEmail', 'status', 'createdAt', 'duplicate', 'reason', 'submissionStatus', 'submittedAt', 'correctionKeys', 'approverEmail', 'renewAt', 'renewMode', 'infoAt'].forEach((k) => o[k] = b[k] ?? '');
    o.certMissing = !b.certFileId; o.valid = null; o.infoFresh = true;  // 계약 전 평가 유효기간은 F1.2에서
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
  /** 알림 숫자 (F1.1: 사업자 승인 대기만) */
  async function badges(a, memo) {
    const o = { admin: 0, review: 0, jobs: 0, newVendors: [], pendingAttend: 0 }, st = await staffOf(a, memo);
    if (!st && !isInternalEmail(a.email)) return o;
    o.admin = (await visibleCompanies(a, st, 'PENDING')).length;
    return o;
  }

  /* ---------- 기능 (기존 Code.gs 이름 그대로) ---------- */
  const API = {};
  /** 첫 화면 정보 (기존 portalData와 같은 모양) */
  API.portalData = async (a) => {
    const memo = {}, st = await staffOf(a, memo), b = await myCompany(a), verified = !!b && b.status === 'VERIFIED';
    let isApprover = false;
    if (isInternalEmail(a.email)) isApprover = !(await db.collection('COMPANIES').where('approverEmail', '==', a.email).limit(1).get()).empty;
    let documents = [];
    if (verified) documents = docs(await db.collection('DOCUMENTS').where('uid', '==', a.uid).get()).filter((x) => x.companyId === b.id).map((x) => ({ id: x.id, name: x.name, mime: x.mime }));
    return {
      email: a.email, isApprover, correctionNote: '', openJobs: verified ? 0 : null,
      staff: st ? { name: st.name, role: st.role, roleLabel: (st.master ? '마스터 · ' : '') + (STAFF_ROLES[st.role] || st.role), master: !!st.master } : null,
      isMaster: isMaster(a), testSkipFiles: CFG.TEST_SKIP_FILES,
      company: publicCompany(b),
      role: st ? st.role : 'VENDOR', industries: CFG.INDUSTRIES, fields: FIELDS, stepNames: STEP_NAMES, industryFields: (b && INDUSTRY_FIELDS[b.industry]) || [],
      steps: [], documents,
      docBoard: verified ? { contract: [], later: [], rows: [] } : null,  // 계약 서류는 F1.2에서
      forms: null, appVersion: VERSION, mode: a.mode,
      badges: await badges(a, memo), loginUrl: location.origin + location.pathname,
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
    // 계약 서류·공사·평가는 F1.2 이후에 채움
    return { list: (await visibleCompanies(a, st)).sort(byNewest).map((b) => ({ ...publicCompany(b), docs: [], evidence: [], jobs: 0, contractEval: null, lastEval: null })) };
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
  const NEXT = { saveStep: 'F1.2', submitProfile: 'F1.2', checkSubmission: 'F1.2', uploadContractDoc: 'F1.2', uploadEvidence: 'F1.2', getTemplate: 'F1.2', saveRuleDoc: 'F1.2', savePlanDoc: 'F1.2', uploadPlanFile: 'F1.2', reviewList: 'F1.2', getReviewData: 'F1.2', reviewAction: 'F1.2', saveJob: 'F1.2', myJobs: 'F1.2', vendorJob: 'F1.2', addWorker: 'F1.2', workerCheckIn: 'F1.2', getPermit: 'F1.3', issuePermit: 'F1.3', submitInspection: 'F1.4', meetCheckIn: 'F1.5', createMeeting: 'F1.5', endJob: 'F1.6' };
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
