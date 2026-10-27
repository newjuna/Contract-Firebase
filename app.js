/* 도급 안전관리 화면 (GitHub). 서버 기능은 Apps Script Code.gs */
// v4.0 세션 값: 로그인 후 브라우저 탭 저장소(sessionStorage)에 보관 · 링크값: 주소창 ?review= (영문·숫자·- 만)
(function(){const q=new URLSearchParams(location.search),u=(window.APP_CONFIG||{}).APPS_SCRIPT_URL||'';for(const k of ['eval','approve']){const t=(q.get(k)||'').toLowerCase();if(/^[a-f0-9]{64}$/.test(t)&&/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u)){document.documentElement.innerHTML='<p style="font:16px sans-serif;margin:40px">검토 화면을 여는 중입니다…</p>';location.replace(u+'?'+k+'='+t);throw Error('redirect')}}})();
/* v5.18 휴대폰: 탭 저장소(sessionStorage)는 카메라·사진 선택으로 앱을 오가거나 QR로 새 탭이 열리면 사라짐
 *  → 이 기기에 저장(localStorage). 12시간 안 쓰면 버림 · 서버는 마지막 사용 후 6시간까지 유지 */
const SESS_KEY='dsk2',SESS_MAX=12*3600e3;
let SESSION='';try{const s=JSON.parse(localStorage.getItem(SESS_KEY)||'null');if(s&&s.k&&Date.now()-Number(s.t||0)<SESS_MAX)SESSION=s.k;else localStorage.removeItem(SESS_KEY)}catch(e){}
if(!SESSION)try{SESSION=sessionStorage.getItem('dsk')||''}catch(e){}
function sessSave(k){try{localStorage.setItem(SESS_KEY,JSON.stringify({k,t:Date.now()}))}catch(e){}try{sessionStorage.setItem('dsk',k)}catch(e){}}
function sessTouch(){try{const s=JSON.parse(localStorage.getItem(SESS_KEY)||'null');if(s&&s.k===SESSION&&Date.now()-Number(s.t||0)>600000){s.t=Date.now();localStorage.setItem(SESS_KEY,JSON.stringify(s))}}catch(e){}}
function sessClear(){try{localStorage.removeItem(SESS_KEY)}catch(e){}try{sessionStorage.removeItem('dsk')}catch(e){}}
const LINK_REVIEW=(new URLSearchParams(location.search).get('review')||'').replace(/[^A-Za-z0-9-]/g,'').slice(0,40);
let state=null,activeStep=1,saveTimer=null,dirty=false,tab='my',reviewing=null;
const $=id=>document.getElementById(id),escapeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function msg(t){$('toast').textContent=t;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',4500)}
/* 로딩 창 문구 (서버는 실제 진행률을 알려주지 않음) */
const LOAD_MSG={portalData:'화면을 불러오는 중',registerBusiness:'신청서를 접수하는 중',uploadContractDoc:'파일을 올리는 중',uploadEvidence:'파일을 올리는 중',getTemplate:'샘플 양식을 내려받는 중',getMyFile:'파일을 내려받는 중',saveStep:'저장하는 중',submitProfile:'최종 제출하는 중',checkSubmission:'누락 항목을 확인하는 중',uploadTemplate:'양식을 등록하는 중',refreshTemplateFolders:'Drive 폴더를 확인하는 중',saveJob:'공사를 저장하는 중',jobBoard:'공사 목록을 불러오는 중',createMeeting:'미팅 방을 만드는 중',deleteJob:'공사를 삭제하는 중',deleteMeeting:'미팅 방을 삭제하는 중',meetingDetail:'미팅 방을 여는 중',vendorJob:'공사 화면을 여는 중',saveCrew:'오늘 인원을 저장하는 중',addWorker:'작업자를 등록하는 중',workerCheckIn:'등록하는 중',meetCheckIn:'참석을 확인하는 중',saveMeetingDocs:'점검표·회의록을 저장하는 중',completeMeeting:'미팅 실시 완료를 확정하는 중',reopenMeetingDocs:'완료를 취소하는 중',uploadMeetingPhoto:'사진을 올리는 중',getMeetingPhoto:'사진을 불러오는 중',getPermit:'작업허가서를 여는 중',issuePermit:'작업허가서를 발행하는 중',updatePermitProgress:'진행 기록을 저장하는 중',permitList:'작업허가서 목록을 불러오는 중',permitDetail:'작업허가서를 여는 중',approvePermit:'승인하는 중',editPermit:'수정 제출하는 중',withdrawPermit:'제출을 취소하는 중',uploadInspPhoto:'사진을 올리는 중',uploadInspPhotoStaff:'사진을 올리는 중',submitInspection:'순회점검을 제출하는 중',resolveFinding:'조치 결과를 등록하는 중',inspList:'순회점검일지를 불러오는 중',checkInspections:'확인 처리하는 중',inspMine:'일지를 불러오는 중',approvePermits:'허가서를 승인하는 중',vendorList:'업체 현황을 불러오는 중',saveRuleDoc:'서명이 들어간 규정 문서를 만드는 중',savePlanDoc:'안전보건관리계획서를 만드는 중',uploadPlanFile:'증빙을 올리는 중',extendJob:'공사를 연장하는 중',endJob:'공사를 종료하고 평가서를 만드는 중',jobEvalList:'종료 평가를 불러오는 중',saveJobEval:'평가를 저장하는 중',reopenJobEval:'확정을 푸는 중',uploadWorkerCert:'이수증을 올리는 중',viewCert:'이수증을 불러오는 중',jobPaper:'서류를 만드는 중',setMeetingDate:'날짜를 바꾸는 중',principalSave:'저장하는 중',adminStats:'데이터 현황을 세는 중',adminPreview:'지울 기록을 세는 중',adminDelete:'지우는 중 (많으면 몇 분 걸림)',undoWorker:'등록을 취소하는 중',cancelInspection:'제출을 취소하는 중',cancelRenewal:'신규 작성을 취소하는 중',jobEvalFile:'활동내역 ZIP + 원본파일 ZIP을 만드는 중 (처음 한 번은 1~3분)',noticeList:'참조 알림을 불러오는 중',readNotices:'읽음 처리하는 중'};
/* v5.20 가짜 %(92%에서 멈춰 보이던 것) 대신 '움직이는 막대 + 지난 초' — 멈춘 게 아니라 기다리는 중이라는 것을 그대로 보여 줌 */
let loadTimer=null,loadCount=0,coverTimer=null;
function loadStart(name){loadCount++;if(loadCount>1)return;const rd=READS.has(name);$('loadMsg').textContent=(LOAD_MSG[name]||'처리하는 중')+'입니다';$('loadHint').textContent='잠시만 기다려 주세요';$('loadSec').textContent='';/* v4.2 0.4초 안에 끝나면 로딩 화면 안 띄움 */clearTimeout(coverTimer);coverTimer=setTimeout(()=>{if(loadCount)$('cover').style.display='flex'},400);const t0=Date.now();clearInterval(loadTimer);
 loadTimer=setInterval(()=>{const s=Math.floor((Date.now()-t0)/1000);$('loadSec').textContent=s?s+'초':'';$('loadHint').textContent=s<3?'잠시만 기다려 주세요':s<10?(rd?'구글 시트에서 자료를 모으고 있습니다 · 정상 진행 중':'입력한 내용을 구글 시트에 기록하고 있습니다 · 정상 진행 중'):s<25?'보통 5~15초 걸립니다 · 오류가 아니니 그대로 기다려 주세요':'서버가 평소보다 느립니다 · 창을 닫지 말고 조금만 더 기다려 주세요'},500)}
function loadEnd(){loadCount=Math.max(0,loadCount-1);if(loadCount)return;clearInterval(loadTimer);clearTimeout(coverTimer);setTimeout(()=>{if(!loadCount)$('cover').style.display='none'},120)}
/* v5.8 빠른 화면: 조회는 화면을 가리지 않고 위쪽 얇은 선만 표시 · 저장·제출·파일 만들기만 로딩 창 */
const READS=new Set(['portalData','myStatus','myJobs','vendorJob','jobBoard','meetingDetail','permitList','permitDetail','getPermit','inspList','inspMine','jobEvalList','noticeList','vendorList','staffList','templateAdminList','reviewList','applications','getReviewData','getMeetingPhoto','getInspPhoto','myBadges']);
let barN=0,barT=null;
function barStart(){barN++;$('topLoad')?.classList.add('on');clearTimeout(barT);barT=setTimeout(()=>{if(barN)$('topNote')?.classList.add('on')},700)}
function barEnd(){barN=Math.max(0,barN-1);if(!barN){clearTimeout(barT);$('topLoad')?.classList.remove('on');$('topNote')?.classList.remove('on')}}
/* 한 번 본 화면은 이 기기에 저장해 두고 다음에 바로 보여 줌 (뒤에서 최신으로 바꿈). 로그아웃하면 지움 */
const CACHE_FN=new Set(['portalData','myJobs','jobBoard','vendorJob','noticeList','vendorList','getPermit']);
let CUSER='';try{CUSER=localStorage.getItem('fcUser')||''}catch(e){}
const ck_=(n,a)=>'fc:'+CUSER+':'+n+':'+JSON.stringify(a||[]);
function cacheGet(n,a){if(!CUSER||!CACHE_FN.has(n))return null;try{const v=localStorage.getItem(ck_(n,a));return v?JSON.parse(v):null}catch(e){return null}}
function cacheSet(n,a,v){if(!CUSER||!CACHE_FN.has(n))return;try{localStorage.setItem(ck_(n,a),JSON.stringify(v))}catch(e){cacheClear()}}
function cacheClear(){try{const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('fc:'))ks.push(k)}ks.forEach(k=>localStorage.removeItem(k))}catch(e){}}
function setCUser(u){u=String(u||'');if(u===CUSER)return;cacheClear();CUSER=u;try{localStorage.setItem('fcUser',u)}catch(e){}}
/* 로딩 창 규칙 (v5.9)
 *  - call      : 로딩 창 (0.4초 안에 끝나면 안 뜸) → 처음 여는 화면 · 저장 · 제출 · 발행 · 승인 · 파일 만들기
 *  - callQuiet : 로딩 창 없음 → 저장해 둔 화면을 먼저 보여 준 뒤 뒤에서 최신으로 바꿀 때 · 자동저장 · 알림 숫자 */

/* F1.8h 성능 진단(최근 요청) 기능 없앰 · 예전에 이 기기에 쌓인 기록도 지움 (부르는 곳이 남아 있어 빈 함수로 둠) */
try{localStorage.removeItem('dsk_perf_521')}catch(e){}
function perfRecord(){}
function perfUI(){const b=$('perfBtn');if(b)b.remove()}

/* v5.25: 단순 조회는 전체화면 차단 팝업 대신 화면 상단 진행선만 표시.
   저장·등록·제출 등 변경 작업만 기존 차단 로딩을 유지한다. */
function call(name,...args){
 const read=READS.has(name);
 if(read)barStart();else loadStart(name);
 const finish=()=>{if(read)barEnd();else loadEnd()};
 return api(name,args).then(r=>{finish();cacheSet(name,args,r);return r},e=>{finish();msg(e.message||'처리에 실패했습니다.');throw e});
}
/** 화면을 가리지 않는 조용한 호출 (자동저장용) */
function callQuiet(name,...args){return api(name,args).then(r=>{cacheSet(name,args,r);return r})}
function input(id,label,value='',type='text',disabled=false,ph=''){return `<div class="field"><label for="f_${id}">${escapeText(label)}</label><input id="f_${id}" type="${type}" value="${escapeText(value)}" ${ph?`placeholder="${escapeText(ph)}"`:''} ${disabled?'disabled':''}></div>`}
function text(id,label,value='',disabled=false){return `<div class="field"><label for="f_${id}">${escapeText(label)}</label><textarea id="f_${id}" ${disabled?'disabled':''}>${escapeText(value)}</textarea></div>`}
function value(id){return $('f_'+id)?.value?.trim()||''}
function switchTab(which){tab=which;toggleMenu(false);stopScan();if($(which+'Tab'))$('pageTitle').textContent=$(which+'Tab').textContent;clearInterval(roomTimer);clearInterval(wkTimer);for(const n of ['my','admin','review','tpl','staff','jobs','notice','vendors']){$(n).classList.toggle('hidden',n!==which);$(n+'Tab').classList.toggle('active',n===which)}if(which==='admin')loadAdmin();if(which==='review')loadReview();if(which==='tpl')loadTemplates();if(which==='staff')loadStaff();if(which==='jobs')loadJobs();if(which==='notice')loadNotices();if(which==='vendors')loadVendors();}
// ★ 화면 버전: 여기 한 줄만 고침 (GitHub만 올리면 로그인 화면·앱 화면·메뉴에 모두 반영, Code.gs 수정 불필요)
const UI_VERSION='26.10.24 F1.8p';
/* F1.8o 전화번호 · 사업자번호: 숫자만 쳐도 '-' 자동 (서버는 원래 숫자만 골라 씀) */
function fmtTel(v){const d=String(v||'').replace(/\D/g,'').slice(0,11);if(d.startsWith('02'))return d.length<3?d:d.length<6?d.slice(0,2)+'-'+d.slice(2):d.length<10?d.slice(0,2)+'-'+d.slice(2,5)+'-'+d.slice(5):d.slice(0,2)+'-'+d.slice(2,6)+'-'+d.slice(6,10);
 return d.length<4?d:d.length<8?d.slice(0,3)+'-'+d.slice(3):d.length<11?d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6):d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7)}
function fmtBiz(v){const d=String(v||'').replace(/\D/g,'').slice(0,10);return d.length<4?d:d.length<6?d.slice(0,3)+'-'+d.slice(3):d.slice(0,3)+'-'+d.slice(3,5)+'-'+d.slice(5)}
document.addEventListener('input',e=>{const t=e.target;if(!t||t.tagName!=='INPUT')return;const f=t.id==='f_regNo'?fmtBiz:t.type==='tel'?fmtTel:null;if(!f)return;const n=f(t.value);if(n!==t.value)t.value=n},true);
function showVer(){document.querySelectorAll('.verTxt').forEach(x=>x.textContent=UI_VERSION)}
/** v4.1 ⚙ 마스터 설정: 직원 관리로 바로 이동 (마스터 계정만 보임) */
function openMaster(){if(!state||!state.isMaster)return;sgo('staff')}
function display(s){state=s;setTimeout(perfUI,0);showVer(s);$('gearBtn').hidden=!s.isMaster;setTimeout(()=>{showBadges(s.badges);startBadges()},0);$('identity').textContent=(s.mode==='STAFF'?'[다이소 담당자로 접속] ':s.mode==='VENDOR'?'[협력업체로 접속] ':'')+'접속 계정: '+s.email+(s.staff?' · 아성다이소 '+s.staff.roleLabel+' '+s.staff.name:'');$('staffTab').classList.toggle('hidden',!(s.staff&&s.staff.role==='SAFETY'));$('jobsTab').classList.toggle('hidden',!s.staff);$('noticeTab').classList.toggle('hidden',!(s.staff&&s.staff.role==='SAFETY'));if(s.staff&&!s.company&&tab==='my'){$('myTab').textContent='내 업무';}$('adminTab').classList.toggle('hidden',!(['ADMIN','SAFETY'].includes(s.role)||s.isApprover));$('tplTab').classList.toggle('hidden',!['ADMIN','SAFETY'].includes(s.role));$('reviewTab').classList.toggle('hidden',!['ADMIN','SAFETY','CONTRACT'].includes(s.role));if($(tab+'Tab'))$('pageTitle').textContent=$(tab+'Tab').textContent;setupVMenu();setupSMenu();renderMy();}
/** ☰ 메뉴 열기·닫기 */
function toggleMenu(open){const d=$('drawer');if(!d)return;const v=open===undefined?!d.classList.contains('open'):!!open;
 /* 닫힌 메뉴 안에 포커스가 남지 않게 (aria-hidden 경고) */if(!v&&d.contains(document.activeElement))document.activeElement.blur();
 if(v)navAuto();d.classList.toggle('open',v);$('scrim').classList.toggle('open',v);d.setAttribute('aria-hidden',String(!v));$('menuBtn').setAttribute('aria-expanded',String(v));document.body.style.overflow=v?'hidden':''}
document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleMenu(false)});
/* v5.20 ☰ 메뉴 목차 접기·펼치기: 메뉴를 열 때 지금 보고 있는 묶음만 펼치고 나머지는 접음 → 휴대폰에서도 로그아웃까지 한 화면에 보임
 *  접힌 묶음 제목 옆에는 안쪽 알림 숫자 합계를 표시 */
function navSet(g,open){g.classList.toggle('fold',!open);const h=g.querySelector('.navh');if(h)h.setAttribute('aria-expanded',String(open));navDot(g)}
function navDot(g){const h=g.querySelector('.navh');if(!h)return;const n=g.classList.contains('fold')?[...g.querySelectorAll('.navb button[data-n]')].filter(b=>!b.classList.contains('hidden')).reduce((s,b)=>s+(parseInt(b.dataset.n,10)||0),0):0;if(n>0)h.dataset.n=n>99?'99+':String(n);else delete h.dataset.n}
function navFold(h){const g=h.closest('.navg');if(g)navSet(g,g.classList.contains('fold'))}
function navAuto(){document.querySelectorAll('#navTabs .navg').forEach(g=>navSet(g,!!g.querySelector('.navb button.active')))}
function renderMy(){const b=state.company;let html='';if(state.mode==='STAFF'&&!state.staff){$('my').innerHTML='<div class="card"><h2>다이소 직원 명단에 없는 계정입니다</h2><p class="desc">로그인 계정 <b>'+escapeText(state.email)+'</b> 은(는) 회사직원명단에 등록되어 있지 않습니다.<br>협력업체라면 로그인 화면에서 <b>[협력업체]</b>를 고르고 다시 로그인해 주세요.<br>다이소 직원이라면 안전보건팀에 계정 등록을 요청해 주세요.</p><button class="button" type="button" onclick="logout()">로그인 화면으로</button></div>';return}if(state.staff&&!b){$('my').innerHTML='<div class="card"><h2>'+escapeText(state.staff.name)+' 님 ('+escapeText(state.staff.roleLabel)+')</h2><p class="desc">아성다이소 직원 계정으로 로그인했습니다.<br>오른쪽 위 ☰ 메뉴에서 업무를 선택해 주세요.</p><button class="button" type="button" onclick="toggleMenu(true)">메뉴 열기</button></div>';return}if(!b||b.status==='REJECTED'){html=`<div class="card"><h2>사업자 등록 신청</h2>${b?`<div class="note">기존 신청이 반려되었습니다. 사유: ${escapeText(b.reason)}<br>새 신청은 관리자에게 문의해 주세요.</div>`:''}<p class="desc">처음 방문한 업체는 기본정보와 사업자등록증을 제출해 주세요. Google 로그인 계정 ${escapeText(state.email)}으로 접수됩니다.</p><details class="guide"><summary>작성 가이드</summary><div class="note">· 사업자등록번호·연락처는 하이픈(-)을 넣어도, 빼도 됩니다.<br>· 업체 이메일은 지금 로그인한 Google 계정 <b>${escapeText(state.email)}</b>(으)로 자동 등록되며, 승인 결과도 이 메일로 안내됩니다.<br>· <b>본사 승인 담당자 이메일</b>은 이 주소를 안내해 준 다이소 담당자에게 받은 메일 주소를 적어 주세요.</div></details><form onsubmit="register(event)">${(()=>{const T=state.testSkipFiles?testSample():{};return `<div class="split">${input('company','업체명',T.company,'text',false,'예: (주)○○인테리어')}${input('regNo','사업자등록번호 (10자리)',T.regNo,'tel',false,'숫자 10자리 (- 자동)')}${input('representative','대표자 성명',T.representative,'text',false,'예: 홍길동')}${input('address','사업장 주소',T.address,'text',false,'예: 서울시 ○○구 ○○로 12')}${input('contact','현장대리인 성명 (업체 소장)',T.contact,'text',false,'예: 김소장 (현장을 맡는 업체 소장)')}${input('phone','현장대리인 연락처',T.phone,'tel',false,'숫자만 입력 (- 자동)')}${input('vendorEmail','업체 이메일 (로그인 계정 · 자동)',state.email,'email',true)}</div>${input('approverEmail','본사 승인 담당자 이메일 (다이소 담당자에게 받은 주소)','','email',false,'예: hong.gildong@daiso.co.kr')}<div class="field"><label for="f_industry">도급 업종</label><select id="f_industry"><option value="">업종 선택</option>${state.industries.map(x=>`<option ${x===T.industry?'selected':''}>${escapeText(x)}</option>`).join('')}</select></div>`})()}<div class="field"><label for="cert">사업자등록증 첨부 (PDF·JPG·PNG, 최대 5MB · 휴대폰 촬영 사진 가능)${state.testSkipFiles?' — <span style="color:#ce2a4b">테스트 기간에는 생략 가능</span>':''}</label><input type="file" id="cert" accept=".pdf,.jpg,.jpeg,.png"></div><label class="desc"><input type="checkbox" id="agree" ${state.testSkipFiles?'checked':''}>신청·계정 승인 및 서류 검토를 위한 담당자 정보 수집·이용에 동의합니다. (운영 전 개인정보 처리방침 확정 필요)</label><div class="line"></div><button class="button" type="submit">사업자 등록 신청</button></form></div>`}
else if(b.status==='PENDING'){html=`<div class="card"><h2>${escapeText(b.company)}</h2><div class="note">사업자 등록 승인 대기 중입니다.<br>본사 승인 담당자 <b>${escapeText(b.approverEmail||'')}</b>에게 승인 요청 메일을 보냈습니다. 담당자가 메일의 링크에서 바로 승인합니다.<br>승인되면 이 화면에 안내 창이 뜨고 바로 작성 페이지로 넘어갑니다.${b.duplicate==='Y'?'<br><b>중복 사업자번호 검토 대상입니다.</b>':''}</div><p class="desc">신청 계정: ${escapeText(state.email)}<br><span id="pollInfo">승인 여부를 15초마다 자동으로 확인하고 있습니다.</span></p><button class="button ghost" onclick="checkApproval(true)">지금 확인하기</button></div>`}
else if(b.status==='VERIFIED'){activeStep=1;html=vendorHomeHtml(b)}$('my').innerHTML=html;
 // 승인 대기 중일 때만 15초마다 승인 여부 자동 확인
 clearInterval(pollTimer);if(b&&b.status==='PENDING')pollTimer=setInterval(()=>checkApproval(false),15000);
 if(b&&b.status==='VERIFIED'&&['SUBMITTED','SAFETY_REVIEW'].includes(b.submissionStatus))pollTimer=setInterval(checkReview,30000);
 if(b&&b.status==='VERIFIED'&&(b.submissionStatus==='APPROVED'||b.renewAt)){if(b.submissionStatus==='APPROVED')showApprovedOnce(b);vStart()}}
/* 계약 전 검토 상태 자동 확인 */
async function checkReview(){try{const s=await callQuiet('myStatus');if(s&&s.submissionStatus!==state.company.submissionStatus){
 // v5.17 재평가 검토 중에는 공사 업무를 하고 있을 수 있음 → 작업 중이면 화면을 바꾸지 않고 알림만 (다음 확인 때 다시)
 if(state.company.renewAt&&busyView()){if(window.__rvSeen===s.submissionStatus)return;window.__rvSeen=s.submissionStatus;msg(s.submissionStatus==='APPROVED'?'계약 전 서류 재평가가 승인되었습니다.':'계약 전 서류 재평가 결과가 나왔습니다. [계약 서류] 메뉴에서 확인해 주세요.');return}
 clearInterval(pollTimer);await reload();if(state.company&&state.company.submissionStatus==='APPROVED'&&s.submissionStatus==='APPROVED')msg('계약 전 서류 승인 완료');}}catch(e){}}
/* 승인 안내 팝업: 업체당 한 번만 */
function showApprovedOnce(b){const key='approvedSeen:'+b.id;let seen=false;try{seen=localStorage.getItem(key)==='1'}catch(e){}if(seen||window.__approvedShown)return;window.__approvedShown=true;popup('계약 전 검토가 완료되었습니다','본사 담당자 검토를 통과했습니다.\n첫 화면의 [금일 작업 수행하기]를 눌러 신규자 등록·작업허가서·순회점검을 진행해 주세요.','시작하기',()=>{try{localStorage.setItem(key,'1')}catch(e){}window.scrollTo(0,0)})}
/* ---------- 승인 대기 자동 확인 + 안내 팝업 ---------- */
let pollTimer=null;
function popup(title,body,btn,onOk,onLater,laterLabel){$('modalTitle').textContent=title;$('modalBody').textContent=body;$('modalBtn').textContent=btn;$('modal').style.zIndex='65';/* F1.7f 작성 화면(계획서·허가서, 40) 위에 뜨게 */$('modal').style.display='flex';const c=$('modalCancel');c.hidden=!onLater;c.textContent=laterLabel||'나중에';$('modalBtn').onclick=()=>{$('modal').style.display='none';onOk&&onOk()};c.onclick=()=>{$('modal').style.display='none';onLater&&onLater()};$('modalBtn').focus()}
/* F1.7f 확인·오류 창을 브라우저 confirm/alert 대신 화면 안 창으로
 *  (일부 휴대폰·앱 안 브라우저는 confirm/alert를 말없이 막아서 "눌러도 아무 반응 없음"이 됨) */
function askOk(title,body,okLabel){return new Promise(res=>popup(title,body,okLabel||'확인',()=>res(true),()=>res(false),'취소'))}
/** 응답만 사라졌을 수 있는 오류 (서버는 처리했을 수 있음 → 다시 받아서 확인) */
const LOST_RE=/응답을 받지 못했|응답이 늦습니다|연결하지 못했|응답을 읽을 수 없/;
function showErr(title,e){popup(title,(e&&e.message)||String(e||'처리에 실패했습니다.'),'확인')}
/* ---------- v4.3 알림: 메뉴 옆 숫자 + 새 소식 팝업 (1분마다 확인) ---------- */
let badgeTimer=null;
function setBadge(el,n){if(!el)return;if(n>0)el.dataset.n=n>99?'99+':String(n);else delete el.dataset.n}
let lastBadges='';
function showBadges(b){b=b||{};const changed=JSON.stringify(b)!==lastBadges;lastBadges=JSON.stringify(b);if(state)state.badges=b;setBadge($('adminTab'),b.admin);setBadge($('reviewTab'),b.review);setBadge($('jobsTab'),b.jobs);setBadge($('noticeTab'),b.notices);
 const vis=k=>$(k)&&!$(k).classList.contains('hidden');setBadge($('menuBtn'),(vis('adminTab')?b.admin||0:0)+(vis('reviewTab')?b.review||0:0)+(vis('jobsTab')?b.jobs||0:0)+(vis('noticeTab')?b.notices||0:0));
 sBadges(b);if(changed&&tab==='jobs'&&jobsMode==='list'&&jobData)renderJobs();newsPopup(b)}
/** 새로 검토가 끝난 업체가 생기면 한 번만 팝업 (본 업체는 기억) */
function newsPopup(b){const nv=(b&&b.newVendors)||[];if(!nv.length||!state||!state.staff||$('modal').style.display==='flex')return;let seen=[];try{seen=JSON.parse(localStorage.getItem('seenVendors:'+state.email)||'[]')}catch(e){}
 const fresh=nv.filter(v=>!seen.includes(v.id));if(!fresh.length)return;const mark=()=>{try{localStorage.setItem('seenVendors:'+state.email,JSON.stringify([...new Set(seen.concat(nv.map(v=>v.id)))]))}catch(e){}};
 popup('새 업체가 공사 배정을 기다립니다',fresh.slice(0,5).map(v=>'· '+v.company+' ('+v.industry+')').join('\n')+(fresh.length>5?'\n외 '+(fresh.length-5)+'곳':'')+'\n\n계약 전 검토·평가가 끝났습니다.\n공사를 만들어 업체를 배정하고 착수 전 미팅을 잡아 주세요.','공사 만들기',()=>{mark();goNewJob(fresh.map(v=>v.id))},mark)}
async function refreshBadges(){if(!state||!state.staff)return;try{showBadges(await callQuiet('myBadges'))}catch(e){}}
function startBadges(){clearInterval(badgeTimer);if(!state||!state.staff)return;badgeTimer=setInterval(()=>{if(!document.hidden&&!loadCount)refreshBadges()},60000)}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshBadges()});
/** 팝업·배정대기 카드에서 바로 '새 공사 만들기' (업체 미리 체크) */
function goNewJob(ids){smenu='jobs';switchTab('jobs');markSMenu();const t=setInterval(()=>{if(jobData){clearInterval(t);jobForm(null,ids)}},100)}
function waitCard(){const nv=(state&&state.badges&&state.badges.newVendors)||[],pa=(state&&state.badges&&state.badges.pendingAttend)||0,pmw=(state&&state.badges&&state.badges.permits)||0,isw=(state&&state.badges&&state.badges.insp)||0,je=(state&&state.badges&&state.badges.jobEnd)||0,ed=(state&&state.badges&&state.badges.evalDraft)||0;if(!nv.length&&!pa&&!pmw&&!isw&&!je&&!ed)return '<span id="waitCard" hidden></span>';
 return '<div class="card alertcard" id="waitCard">'+(nv.length?'<div class="vh-top"><h2 style="margin:0">공사 배정 대기 업체 <span class="cnt">'+nv.length+'</span></h2><button class="button" type="button" onclick="goNewJob('+escapeText(JSON.stringify(nv.map(v=>v.id)))+')">이 업체로 공사 만들기</button></div><p class="desc">계약 전 검토·평가가 끝난 업체입니다. 공사에 배정하면 목록에서 사라집니다.</p>'+nv.map(v=>'<div class="item"><b>'+escapeText(v.company)+'</b> <span class="muted">'+escapeText(v.industry)+'</span></div>').join(''):'')
  +(pa?'<p class="desc" style="margin-top:8px"><b style="color:var(--accent)">미팅 참석 확인 대기 '+pa+'명</b> · 아래 공사의 [방 들어가기]에서 확인해 주세요.</p>':'')
  +(pmw?'<p class="desc" style="margin-top:8px"><b style="color:var(--accent)">작업허가서 승인 대기 '+pmw+'건</b> · 아래 공사의 [작업허가서 보기]에서 승인해 주세요.</p>':'')
  +(isw?'<p class="desc" style="margin-top:8px"><b style="color:var(--accent)">순회점검일지 확인 대기 '+isw+'건</b> · 아래 공사의 [순회점검 보기]에서 확인해 주세요.</p>':'')
  +(je?'<p class="desc" style="margin-top:8px"><b style="color:var(--accent)">종료 예정·종료일 경과 공사 '+je+'건</b> · 아래 공사의 [연장·종료]에서 연장하거나 종료해 주세요.</p>':'')
  +(ed?'<p class="desc" style="margin-top:8px"><b style="color:var(--accent)">공사 종료 평가 대기 '+ed+'건</b> · 아래 공사의 [종료 평가]에서 확정해 주세요.</p>':'')+'</div>'}
async function checkApproval(manual){try{const s=await callQuiet('myStatus');if(!s)return;if(s.status==='VERIFIED'){clearInterval(pollTimer);popup('승인되었습니다','본사 담당자가 사업자 등록을 승인했습니다.\n이제 안전보건정보 작성을 시작할 수 있습니다.','작성 시작하기',()=>{activeStep=1;reload()})}else if(s.status==='REJECTED'){clearInterval(pollTimer);popup('신청이 반려되었습니다','반려 사유: '+(s.reason||'(사유 없음)')+'\n내용을 확인한 뒤 다시 신청해 주세요.','확인',()=>reload())}else if(manual){msg('아직 승인 대기 중입니다.')}if($('pollInfo'))$('pollInfo').textContent='마지막 확인: '+new Date().toLocaleTimeString('ko-KR')+' · 15초마다 자동 확인'}catch(e){if(manual)msg(e.message||'확인에 실패했습니다.')}}
/* ---------- v2.1 계약 단계 제출서류 (샘플 다운로드 → 작성본 등록) ---------- */
function fmtTime(v){const d=new Date(v);return isNaN(d)?'':d.toLocaleString('ko-KR',{dateStyle:'short',timeStyle:'short'})}
function docSummaryHtml(){const list=state.docBoard.contract;if(!list.length)return '';const req=list.filter(t=>t.required),done=req.filter(t=>t.uploads.length).length;const todo=req.length-done;return `<div class="card"><h2>계약 단계 제출서류</h2><p class="desc">샘플 양식을 내려받아 작성한 뒤 4단계(증빙자료)에서 등록해 주세요.</p><div class="row"><span class="pill ${todo?'todo':'ok'}">필수 ${done}/${req.length} 등록</span>${activeStep!==4?'<button class="button ghost" type="button" onclick="goStep(4)">서류 등록하러 가기</button>':''}</div></div>`}
function docBoardHtml(){const d=state.docBoard,accept='.pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx,.hwp,.hwpx';const items=d.contract.map(t=>{const latest=t.uploads[0];const status=latest?`<span class="pill ok">등록 완료 · v${latest.version}</span>`:`<span class="pill todo">미등록</span>`;const lock=t.canUpload?'':'<span class="pill lock">수정 잠김</span>';return `<div class="doc"><div class="head"><div><b>${escapeText(t.name)}</b>${t.required?'<span class="badge" style="margin-left:6px">필수</span>':''}${status}${lock}<div class="muted">관리주기 ${escapeText(t.cycle)} · 작성 ${escapeText(t.ownerLabel)}</div></div></div><div class="row" style="margin-top:10px">${t.template?`<button class="button ghost" type="button" onclick="downloadTemplate('${escapeText(t.code)}')">샘플 양식 받기 (v${escapeText(t.template.version)})</button>`:'<span class="muted">등록된 샘플 양식이 없습니다. 자체 양식으로 작성해 주세요.</span>'}</div>${t.canUpload?`<div class="row" style="margin-top:10px"><label class="muted" for="doc_${escapeText(t.code)}">작성본 선택 (최대 5MB)</label><input type="file" id="doc_${escapeText(t.code)}" accept="${accept}"><button class="button" type="button" onclick="uploadDoc('${escapeText(t.code)}')">${latest?'새 버전 등록':'작성본 등록'}</button></div>`:''}${t.uploads.length?`<div class="desc" style="margin-top:8px">등록 이력 (이전 버전도 보관됨)<br>${t.uploads.map(u=>`<a onclick="viewFile('${escapeText(u.id)}')">v${escapeText(u.version)} ${escapeText(u.name)}</a> <span class="muted">${escapeText(fmtTime(u.uploadedAt))}</span>`).join('<br>')}</div>`:''}</div>`}).join('');
 const later=d.later.length?`<div class="line"></div><h2 style="font-size:15px">계약 이후 단계 양식 (참고용 다운로드)</h2><p class="desc">수행·종료 단계에서 사용할 양식입니다. 지금은 내려받아 확인만 할 수 있습니다.</p>${['수행','종료'].map(s=>{const g=d.later.filter(t=>t.stageLabel===s);return g.length?`<div class="stage">${s} 단계</div>${g.map(t=>`<div class="item"><b>${escapeText(t.name)}</b> <span class="muted">${escapeText(t.cycle)} · ${escapeText(t.ownerLabel)}</span><br><a onclick="downloadTemplate('${escapeText(t.code)}')">샘플 받기 (v${escapeText(t.template.version)})</a></div>`).join('')}`:''}).join('')}`:'';
 return `<div class="card"><h2>4-1. 계약 단계 제출서류</h2><p class="desc">① 샘플 양식 받기 → ② 작성 → ③ 작성본 등록 순서로 진행합니다. 같은 서류를 다시 올리면 덮어쓰지 않고 새 버전으로 보관됩니다.</p>${items||'<p class="desc">등록할 서류가 아직 설정되지 않았습니다. 본사 담당자에게 문의해 주세요.</p>'}${later}</div>`}
function saveBlob(f){const bytes=atob(f.data),buf=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)buf[i]=bytes.charCodeAt(i);const url=URL.createObjectURL(new Blob([buf],{type:f.mime}));const a=document.createElement('a');a.href=url;a.download=f.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
async function downloadTemplate(code){try{const r=await call('getTemplate',code);if(r.url){const a=document.createElement('a');a.href=r.url;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();msg('새 창에서 샘플 양식을 내려받습니다. 안 열리면 팝업 차단을 해제해 주세요.')}else saveBlob(r)}catch(e){}}
async function uploadDoc(code){if(dirty&&!await save(false))return;const name=((state.docBoard.rows||state.docBoard.contract).find(t=>t.code===code)||{}).name||code;let f;try{f=await readFile($('doc_'+code).files[0])}catch(e){alert(e.message);return}if(!confirm(name+' 작성본으로 "'+f.name+'" 파일을 등록할까요?'))return;try{display(await call('uploadContractDoc',code,f));msg(name+' 등록 완료');
 // 필수 서류가 모두 올라오면 바로 제출할지 묻기 → 제출 시 본사 1차 검토 메일 자동 발송
 const rows=renewRows((state.docBoard&&state.docBoard.rows)||[]),req=rows.filter(r=>r.vendorDoc&&r.stage==='CONTRACT'&&r.required);
 if(req.length&&req.every(r=>r.uploads.length)&&['DRAFT','CORRECTION'].includes(state.company.submissionStatus)&&confirm('필수 서류가 모두 올라왔습니다.\n지금 제출하면 본사 담당자에게 1차 검토 요청이 바로 전달됩니다. 제출할까요?'))await submitAll();
}catch(e){}}
/* ---------- v2.1 [관리자] 표준양식 관리 ---------- */
async function loadTemplates(){try{renderTemplates(await fetcher('tpl')('templateAdminList'))}catch(e){}}
let templateList=[];
function renderTemplates(list){templateList=list||[];const accept='.pdf,.xls,.xlsx,.doc,.docx,.hwp,.hwpx';const kindText={EVALUATION:'웹 평가표 (후속 개발 예정)',NONE:'샘플 양식 없음'};const body=['계약','수행','종료'].map(s=>{const g=list.filter(t=>t.stageLabel===s);return g.length?`<div class="stage">${s} 단계</div>${g.map(t=>`<div class="doc"><div class="head"><div><b>${escapeText(t.code)} · ${escapeText(t.name)}</b>${t.required?'<span class="badge" style="margin-left:6px">업체 필수</span>':''}<div class="muted">관리주기 ${escapeText(t.cycle)} · 관리주체 ${escapeText(t.ownerLabel)}</div></div><div>${t.kind!=='TEMPLATE'?`<span class="pill lock">${escapeText(kindText[t.kind]||t.kind)}</span>`:t.current?`<span class="pill ok">등록됨 · v${escapeText(t.current.version)}</span>`:'<span class="pill todo">미등록</span>'}</div></div>${t.kind==='TEMPLATE'?`${t.current?`<div class="desc" style="margin-top:6px">현재 양식: <a onclick="downloadTemplate('${escapeText(t.code)}')">${escapeText(t.current.name)}</a> · ${escapeText(fmtTime(t.current.uploadedAt))} · ${escapeText(t.current.uploadedBy)}${t.history>1?` · 이전 버전 ${t.history-1}건 보관`:''}</div>`:''}<div class="row" style="margin-top:8px"><label class="muted" for="tpl_${escapeText(t.code)}">${t.current?'교체할 파일':'등록할 파일'}</label><input type="file" id="tpl_${escapeText(t.code)}" accept="${accept}"><button class="button ghost" type="button" onclick="uploadTpl('${escapeText(t.code)}')">${t.current?'새 버전으로 교체':'양식 등록'}</button></div>`:''}</div>`).join('')}`:''}).join('');
 $('tpl').innerHTML=`<div class="card"><h2>표준양식(샘플) 관리</h2><p class="desc">여기에 등록한 양식을 승인·인증을 마친 업체가 내려받습니다. 교체하면 업체에는 새 버전만 보이고, 이전 버전 파일과 기록은 그대로 보관됩니다.<br>휴대폰에서는 Google Drive 앱 → <b>도급계약_비공개증빙 › 00_표준양식</b> → 문서 이름 폴더에 파일을 넣고, 아래 버튼을 누르면 됩니다(파일명은 상관없음).</p><button class="button dark" type="button" onclick="refreshTpl()">Drive 폴더에서 다시 불러오기</button><div id="tplReport" class="desc" style="white-space:pre-line;margin-top:8px"></div>${body||'<div class="note">문서유형이 없습니다. Apps Script 편집기에서 setupDocumentSystem()을 먼저 실행하세요.</div>'}</div>`}
async function refreshTpl(){try{const r=await call('refreshTemplateFolders');renderTemplates(r.list);$('tplReport').textContent=r.report;msg('Drive 폴더 확인 완료')}catch(e){}}
async function uploadTpl(code){const name=(templateList.find(t=>t.code===code)||{}).name||code;let f;try{f=await readFile($('tpl_'+code).files[0])}catch(e){alert(e.message);return}if(!confirm(name+' 샘플 양식을 "'+f.name+'"(으)로 등록할까요?'))return;try{renderTemplates(await call('uploadTemplate',code,f));msg('양식 등록 완료')}catch(e){}}
/** [테스트 모드 전용] 신청서 미리 채우기 값 (사업자번호는 중복 표시를 피하려고 매번 임의 생성) */
function testSample(){const n=String(Math.floor(Math.random()*1e10)).padStart(10,'0');return {company:'테스트인테리어(주)',regNo:n.slice(0,3)+'-'+n.slice(3,5)+'-'+n.slice(5),representative:'홍길동',address:'서울특별시 강남구 테헤란로 123',contact:'김담당',phone:'010-1234-5678',industry:'인테리어(마감)'}}
/* ---------- v2.4 승인 후 업체 화면: 상단 사업장 정보 + 하단 도급문서 표 ---------- */
const SUB_LABEL={DRAFT:'작성 중',CORRECTION:'보완 요청',SUBMITTED:'제출 완료 · 본사 1차 검토 중',SAFETY_REVIEW:'안전보건팀 확인 중',APPROVED:'계약 전 검토 승인'};
function vendorHomeHtml(b){
 const st=b.submissionStatus||'DRAFT';
 // v5.17 재평가 중(이전 승인 있음)이면 수행 화면 유지 · 계약 서류 메뉴에서 고쳐서 다시 제출
 return st==='APPROVED'||b.renewAt?executionHomeHtml(b):contractHomeHtml(b);
}
/** v5.17 재평가 중이면 재평가 시작 뒤에 다시 작성·등록한 서류만 '완료'로 봄 */
function renewRows(rows,b){b=b||(state&&state.company);return b&&b.renewAt?rows.map(r=>Object.assign({},r,{uploads:(r.uploads||[]).filter(u=>String(u.uploadedAt)>=String(b.renewAt))})):rows}
/** v5.17 계약 전 평가 유효기간 안내 (업체 화면) */
function validNote(b){const v=b&&b.valid;if(!v)return '';const warn=v.expired||v.days<=30;
 return '<div class="note'+(warn?' warnnote':'')+'" style="margin-top:10px'+(warn?';border-left:3px solid var(--accent)':'')+'"><b>계약 전 평가 유효기간</b> · '+escapeText(v.from)+' ~ '+escapeText(v.until)+' '+(v.expired?'<b class="req">만료</b><br>새 공사에 배정되려면 [신규 작성]으로 계약 전 서류를 다시 제출해 주세요. (진행 중인 공사는 계속 진행할 수 있습니다)':v.days<=30?'<b class="req">D-'+v.days+'</b><br>기간이 끝나면 새 공사에 배정될 수 없습니다. 미리 [신규 작성]으로 다시 제출해 주세요.':'(D-'+v.days+')')+'</div>'}
/* 공통: 상단 업체 카드 + 진행 단계 */
function headCard(b,st,todo,pctHtml){
 const flow=['정보·서류 작성','제출','본사 1차 검토','안전보건팀 확인','수행 단계'],cur={DRAFT:0,CORRECTION:0,SUBMITTED:2,SAFETY_REVIEW:3,APPROVED:4}[st]??0;
 return '<div class="card"><div class="vh-top"><div><h2 style="margin:0">'+escapeText(b.company)+'</h2><div class="muted">'+escapeText(b.industry)+' · 사업자번호 '+escapeText(b.regNo)+'</div></div><span class="pill '+(st==='APPROVED'?'ok':st==='CORRECTION'?'todo':'lock')+'">'+escapeText(SUB_LABEL[st]||st)+'</span></div>'
  +'<div class="note" style="margin-top:12px"><b>지금 할 일</b> · '+escapeText(todo)+'</div>'+(pctHtml||'')+'</div>';
}
/* 문서 카드 (계약·수행 공통, 모바일 기준) */
function docCard(r,opt){
 const latest=r.uploads[0],ok=!!latest,accept=opt.exec?'image/*,.pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx,.hwp,.hwpx':'.pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx,.hwp,.hwpx';
 const badge='<span class="badges">'+(opt.exec?(ok?'<span class="done">최근 '+escapeText(fmtTime(latest.uploadedAt))+'</span>':'<span class="none">등록 없음</span>')
  :((r.required?'<span class="reqtag">필수</span>':'')+(ok?'<span class="done">✔ 완료</span>':'<span class="none">미등록</span>')))+'</span>';
 const sample=r.template?'<button class="dbtn ghost" type="button" onclick="downloadTemplate(\''+escapeText(r.code)+'\')">⬇ 샘플 양식</button>':'';
 const upl=r.canUpload?'<label class="dbtn main" for="doc_'+escapeText(r.code)+'">'+(opt.exec?'📷 사진·파일 올리기':ok?'⬆ 새 버전 올리기':'⬆ 작성본 올리기')+'</label><input class="hidefile" type="file" id="doc_'+escapeText(r.code)+'" accept="'+accept+'" onchange="uploadDoc(\''+escapeText(r.code)+'\')" aria-label="'+escapeText(r.name)+' 파일 선택">'
  :'<span class="muted">'+(opt.lockMsg||'')+'</span>';
 const hist=r.uploads.length?'<details class="hist"><summary>등록 이력 '+r.uploads.length+'건</summary>'+r.uploads.map(u=>'<div><a onclick="viewFile(\''+escapeText(u.id)+'\')">v'+escapeText(u.version)+' · '+escapeText(u.name)+'</a> <span class="muted">'+escapeText(fmtTime(u.uploadedAt))+'</span></div>').join('')+'</details>':'';
 return '<div class="dcard '+(ok&&!opt.exec?'ok':(!ok&&r.required&&!opt.exec?'mine':''))+'" id="row_doc'+escapeText(r.code)+'"><div class="dhead"><b>'+escapeText(r.name)+'</b>'+badge+'</div><div class="muted">'+escapeText(r.cycle)+' · '+escapeText(r.ownerLabel)+'</div><div class="dact">'+sample+upl+'</div>'+hist+'</div>';
}
/* 사업장 정보 입력 (모바일: 한 줄에 하나) */
function infoForm(b,dis){
 const data=(state.steps.find(x=>Number(x.step)===1)||{}).data||{},fields=state.fields[1]||[];
 const fixed=[['업체명',b.company],['사업자등록번호',b.regNo],['대표자',b.representative],['도급 업종',b.industry],['업체 계정',b.email],['본사 승인 담당자',b.approverEmail||'-']];
 // 위: 신청 정보(읽기 전용, PC 4칸) / 아래: 입력 항목(한 줄에 '항목명 | 입력칸')
 const SHORT={majorWork:'주요 업무',employeeCount:'근로자 수',siteAddress:'사업장 주소',siteManager:'현장대리인',siteManagerPhone:'현장대리인 연락처',safetyManager:'안전 담당자',safetyPhone:'안전 담당자 연락처',note:'비고'};
 return '<details class="hist infobox"><summary>신청 정보 보기 · '+escapeText(b.company)+' · '+escapeText(b.representative)+'</summary><div class="infogrid">'+fixed.map(([l,v])=>'<div class="lb">'+escapeText(l)+'</div><div>'+escapeText(v)+'</div>').join('')+'</div></details>'
  +'<div class="formgrid">'+fields.map(([k,label])=>'<div class="lb"><label for="f_'+k+'">'+escapeText(SHORT[k]||label.replace(' (선택)',''))+(k==='note'?'':'<span class="req">*</span>')+'</label></div><div class="vl"><input id="f_'+k+'" type="'+(k==='employeeCount'?'number':k.endsWith('Phone')?'tel':'text')+'" value="'+escapeText(data[k]||'')+'" '+(dis(k)?'disabled':'')+' placeholder="'+(k==='note'?'선택':k.endsWith('Phone')?'숫자만 입력 (- 자동)':k==='employeeCount'?'명':'')+'"></div>').join('')+'</div>';
}
/* ---------- 계약 전 화면: 사업장 정보 + 계약 단계 서류만 ---------- */
function contractHomeHtml(b){
 const st=b.submissionStatus||'DRAFT',locked=['SUBMITTED','SAFETY_REVIEW'].includes(st),correcting=st==='CORRECTION';
 const allowed=correcting?JSON.parse(b.correctionKeys||'[]'):[],dis=k=>locked||(correcting&&!allowed.includes('1:'+k));
 const data=(state.steps.find(x=>Number(x.step)===1)||{}).data||{},need=(state.fields[1]||[]).filter(([k])=>k!=='note');
 const rows=renewRows(((state.docBoard&&state.docBoard.rows)||[]).filter(r=>r.stage==='CONTRACT'&&r.vendorDoc),b);
 const req=rows.filter(r=>r.required),infoDone=need.filter(([k])=>String(data[k]||'').trim()).length,docDone=req.filter(r=>r.uploads.length).length;
 const total=need.length+req.length,pct=total?Math.round((infoDone+docDone)/total*100):0;
 const todo=st==='SUBMITTED'?'제출이 완료되었습니다. 본사 담당자가 서류를 검토하고 있습니다.':st==='SAFETY_REVIEW'?'1차 검토가 끝나 안전보건팀이 확인하고 있습니다. 승인되면 안내 창이 뜹니다.'
  :correcting?'본사에서 보완을 요청했습니다. 표시된 항목만 수정한 뒤 다시 제출해 주세요.'+(state.correctionNote?' · 보완 사유: '+state.correctionNote:'')
  :b.renewAt?(pct<100?(b.renewMode==='NEW'?'신규 작성: ⓪ 사업자 정보 ① 사업장 정보를 입력하고 ② 규정·계획서를 [작성하기]로 작성(서명)해 주세요.':'이전 정보를 불러왔습니다. ⓪ 사업자 정보 ① 사업장 정보에서 바뀐 곳만 고치고 ② 규정·계획서를 [작성하기]로 다시 작성(서명)해 주세요.'):'모든 항목이 준비되었습니다. 맨 아래 [제출하기]를 눌러 주세요. 승인되면 유효기간이 1년 연장됩니다.')
  :pct<100?(infoDone===need.length?'② 규정·계획서를 [작성하기]로 작성해 주세요.':'① 사업장 정보를 입력하고 ② 규정·계획서를 [작성하기]로 작성해 주세요.'):'모든 항목이 준비되었습니다. 맨 아래 [제출하기]를 눌러 주세요.';
 const pctHtml='<div class="row" style="justify-content:space-between;margin-top:12px"><span class="muted">준비 상태 · 사업장 정보 '+infoDone+'/'+need.length+' · 서류 '+docDone+'/'+req.length+'</span><b style="color:#1b7442">'+pct+'%</b></div><div class="prog"><span style="width:'+pct+'%"></span></div>';
 /* F1.8n 사업장 정보 3칸은 가입 때 받은 값으로 채워져 있음 → 다 차 있으면 접어서 한 줄로 (눌러서 고치기 · 보완 요청이면 펼침) */
 const infoOk=infoDone===need.length&&!(correcting&&need.some(([k])=>allowed.includes('1:'+k)));
 const infoForm1='<form id="stepForm" oninput="changed()" onsubmit="saveManual(event)">'+infoForm(b,dis)+'<div class="row" style="justify-content:space-between;margin-top:10px"><span class="statusline" id="saved">서버 저장 상태: -</span><button class="button ghost" type="submit" '+(locked?'disabled':'')+'>임시저장</button></div></form>';
 const info=infoOk?'<div class="card"><details class="hist"><summary><b>① 사업장 정보</b> <span class="pill ok">✔ 가입 때 입력</span><div class="muted" style="margin-top:4px">현장대리인 '+escapeText(data.siteManager||'')+' · '+escapeText(data.siteManagerPhone||'')+' · '+escapeText(data.siteAddress||'')+' (눌러서 고치기)</div></summary>'+infoForm1+'</details></div>'
  :'<div class="card"><h2>① 사업장 정보</h2><p class="muted">입력하면 자동 저장됩니다.</p>'+infoForm1+'</div>';
 const lockMsg=locked?'제출 완료 · 검토 중':correcting?'보완 대상 아님':'';
 const docs='<div class="card"><h2>② 계약 전 제출 서류</h2>'+(rows.map(r=>{const pair=state.forms&&state.forms.plan&&rows.some(x=>x.code==='C01')&&rows.some(x=>x.code==='C02');  // F1.8c 규정·계획서는 한 카드로
  return pair&&r.code==='C01'?'':pair&&r.code==='C02'?docPairCardHtml(rows.find(x=>x.code==='C01'),r,{lockMsg}):r.code==='C01'&&state.forms?ruleCardHtml(r,{lockMsg}):r.code==='C02'&&state.forms&&state.forms.plan?planCardHtml(r,{lockMsg}):docCard(r,{exec:false,lockMsg})}).join('')||'<p class="desc">제출할 서류가 아직 설정되지 않았습니다.</p>')
  +'</div>';
 const fin='<div class="card"><h2>③ 제출</h2>'+(locked?'<div class="note">'+escapeText(SUB_LABEL[st]||st)+' 상태입니다. 제출한 내용은 검토가 끝날 때까지 수정할 수 없습니다.</div>':'<p class="desc">제출하면 본사 담당자 → 안전보건팀 순서로 검토합니다.</p><button class="button" style="width:100%" type="button" onclick="submitAll()">누락 확인 후 제출하기</button>')+'</div>';
 return headCard(b,st,todo,pctHtml)+(b.renewAt?bizInfoCard(b,locked||(correcting&&!allowed.some(k=>/^1:/.test(k)))):'')+info+docs+fin;
}
/** v5.17 신규 작성: 업체 기본 정보(사업자 정보) 확인·수정 카드. 업체명·사업자번호는 계정 기준이라 고정 */
function bizInfoCard(b,dis){const fresh=b.infoFresh,blank=b.renewMode==='NEW'&&!fresh,v=k=>blank?'':escapeText(b[k]||''),ph=k=>blank&&b[k]?' placeholder="이전: '+escapeText(b[k])+'"':'';
 const F=[['bRep','representative','대표자'],['bAddr','address','사업장 주소'],['bContact','contact','현장대리인 (업체 소장)'],['bPhone','phone','현장대리인 연락처']];
 return '<div class="card" id="bizCard"><h2>⓪ 사업자 정보 '+(fresh&&b.infoAt&&String(b.infoAt)>=String(b.renewAt)?'<span class="pill ok">✔ 확인 완료</span>':b.renewMode==='NEW'?'<span class="pill todo">입력 필요</span>':'<span class="pill lock">이전 정보</span>')+'</h2>'
  +'<p class="muted">업체명 <b>'+escapeText(b.company)+'</b> · 사업자번호 <b>'+escapeText(b.regNo)+'</b> (변경 불가 · 사업자가 바뀌면 새로 가입해 주세요)</p>'
  +'<div class="formgrid">'+F.map(([id,k,l])=>'<div class="lb"><label for="f_'+id+'">'+l+'<span class="req">*</span></label></div><div class="vl"><input id="f_'+id+'" type="'+(k==='phone'?'tel':'text')+'" value="'+v(k)+'"'+ph(k)+(dis?' disabled':'')+'></div>').join('')
  +'<div class="lb"><label for="f_bCert">사업자등록증</label></div><div class="vl"><input id="f_bCert" type="file" accept=".pdf,.jpg,.jpeg,.png"'+(dis?' disabled':'')+'><div class="muted">바뀐 경우에만 새로 올려 주세요 (선택)</div></div></div>'
  +(dis?'':'<button class="button ghost" type="button" style="margin-top:10px" onclick="saveBizInfo()">사업자 정보 저장</button>')+'</div>'}
async function saveBizInfo(){const d={representative:value('bRep'),address:value('bAddr'),contact:value('bContact'),phone:value('bPhone')};
 const miss=[['bRep','representative'],['bAddr','address'],['bContact','contact'],['bPhone','phone']].filter(([,k])=>!d[k]).map(([key])=>({key}));if(miss.length){markMissing(miss);return}
 let cert=null;const fl=$('f_bCert')&&$('f_bCert').files[0];if(fl){try{cert=await readFile(fl)}catch(e){alert(e.message);return}}
 if(dirty&&!await save(false))return;try{display(await call('saveCompanyInfo',d,cert));msg('사업자 정보를 저장했습니다.')}catch(e){}}
/* ---------- 수행 단계 화면 (승인 후, 모바일 우선) ---------- */
function executionHomeHtml(b){
 const rows=(state.docBoard&&state.docBoard.rows)||[];
 const mine=rows.filter(r=>r.stage==='EXECUTION'&&r.vendorDoc),hq=rows.filter(r=>r.stage!=='CONTRACT'&&!r.vendorDoc),contract=rows.filter(r=>r.stage==='CONTRACT'&&r.vendorDoc);
 const todo='배정된 공사를 눌러 [오늘 할 일]을 진행해 주세요.';
 // v3.1 공사별 오늘 할 일 (목록은 화면이 뜬 뒤 loadMyJobs로 채움)
 // v3.1.1 업체는 '내 공사'만 보이게 (기타 서류·본사 문서·계약 전 내용 보기 제거)
 return '<div id="execArea"><div class="card"><p class="desc">배정된 공사를 불러오는 중입니다…</p></div></div>';
}
/** 누락 항목 표시: 빨간 테두리 + 흔들림, 첫 칸으로 이동 (입력하면 표시 해제) */
function markMissing(list){document.querySelectorAll('.miss').forEach(x=>x.classList.remove('miss','shake'));let first=null;list.forEach(m=>{const el=/^doc/.test(m.key)?$('row_'+m.key):$('f_'+m.key);if(!el)return;el.classList.add('miss');void el.offsetWidth;el.classList.add('shake');if(!first)first=el;if(el.tagName==='INPUT')el.addEventListener('input',()=>el.classList.remove('miss','shake'),{once:true})});if(first){first.scrollIntoView({behavior:'smooth',block:'center'});if(first.tagName==='INPUT')setTimeout(()=>first.focus({preventScroll:true}),400)}msg('채워야 할 항목 '+list.length+'개 · 빨간 칸을 확인해 주세요')}
/** 누락 항목으로 이동 */
function jumpTo(key){$('missing')?.remove();if(/^doc/.test(key)){const r=$('row_'+key);if(r){r.scrollIntoView({block:'center'});r.style.outline='3px solid #ed3155';setTimeout(()=>r.style.outline='',2500)}return}const f=$('f_'+key);if(f){f.scrollIntoView({block:'center'});f.focus()}}
async function reload(){try{display(await call('portalData'))}catch(e){}}
const busyView=()=>dirty||!!document.querySelector('#csheet[style*="block"],#psheet:not([hidden])')||(typeof jobsMode!=='undefined'&&tab==='jobs'&&!['list'].includes(jobsMode))||(typeof vjob!=='undefined'&&!!vjob);
const noBadge=o=>JSON.stringify(Object.assign({},o,{badges:null}));
async function bootPortal(noPack){const c=cacheGet('portalData',[]);
 /* v5.20 저장해 둔 화면이 없으면: 체크리스트로 준비 과정을 보여 주며 내 정보 → 공사·업무 화면을 한 번에 미리 받고 시작 */
 if(!c){let s;bootUI(['저장된 로그인 확인','내 정보 불러오기'].concat(noPack?[]:['공사 목록 준비']).concat(['화면 열기']));bootSet(0,'done');bootSet(1,'run');bootSkip(()=>location.reload(),'새로 고침');
  try{s=await api('portalData',[])}catch(e){bootEnd();msg(e.message||'불러오지 못했습니다.');throw e}bootSet(1,'done');await bootRest(s,noPack?-1:2);return}
 display(c);/* v4: 캐시 화면이 있다면 즉시 표시. 공사 목록은 해당 화면에서 독립적으로 갱신하므로 여기서 bootPack 중복 호출하지 않음. *//* 업체: 공사 화면들을 뒤에서 한 번에 새로 받음 */
 callQuiet('portalData').then(s=>{if(!c.email||s.email!==c.email){setCUser(s.email+'|'+(s.mode||''));display(s);return}
  if(noBadge(s)===noBadge(c)){state.badges=s.badges;showBadges(s.badges);return}if(busyView()){state=s;showBadges(s.badges)}else display(s)}).catch(e=>{popup('서버와 연결되지 않았습니다','지금 화면은 이 기기에 저장해 둔 이전 화면입니다.\n저장·제출이 되지 않을 수 있습니다.\n\n'+(e&&e.message||''),'확인')})}
/* ---------- v5.20 시작 준비 체크리스트 ----------
 *  로그인(또는 저장된 화면이 없을 때) → 단계마다 ✔ 표시 · 걸린 시간 표시
 *  '공사 목록 준비'에서 공사 목록·공사 화면·오늘 허가서까지 한 번에 받아 둠 → 이후 메뉴는 바로 열림
 *  오래 걸리면 안내 문구 + [건너뛰고 시작]/[처음부터 다시] 버튼 (사람들이 새로 고침을 반복하지 않게) */
let BOOT=null;
function bootUI(labels){let el=$('bootBox');if(!el){el=document.createElement('div');el.id='bootBox';document.body.appendChild(el)}
 el.innerHTML='<div class="bootcard" role="status" aria-live="polite"><div class="lbrand"><i aria-hidden="true"></i>도급 안전관리</div><h2>시작 준비 중</h2><p class="muted bootsub">로그인과 공사 목록을 확인합니다. 상세 자료는 해당 업무를 열 때 불러옵니다.</p><ol class="bootlist">'
  +labels.map((l,i)=>'<li id="bt_'+i+'" class="wait"><i aria-hidden="true"></i><span>'+escapeText(l)+'</span><em id="bts_'+i+'"></em></li>').join('')+'</ol><p class="bootnote" id="bootNote"></p><button class="button ghost" type="button" id="bootBtn" hidden></button><div class="lver">'+escapeText(UI_VERSION)+'</div></div>';
 el.hidden=false;if(BOOT)clearInterval(BOOT.tm);BOOT={labels,st:labels.map(()=>'wait'),s0:[],fn:null,fnLabel:'',tm:setInterval(bootTick,500)};bootTick()}
function bootSet(i,s){if(!BOOT||BOOT.labels[i]==null)return;const li=$('bt_'+i),tx=$('bts_'+i),now=Date.now();
 if(s==='run')BOOT.s0[i]=now;else if(tx)tx.textContent=s==='skip'?'나중에 받음':s==='fail'?'건너뜀':BOOT.s0[i]&&now-BOOT.s0[i]>=100?((now-BOOT.s0[i])/1000).toFixed(1)+'초':'';
 BOOT.st[i]=s;if(li)li.className=s;if(s!=='run'){BOOT.fn=null;const b=$('bootBtn');if(b)b.hidden=true}bootTick()}
function bootSkip(fn,label){if(BOOT){BOOT.fn=fn;BOOT.fnLabel=label}}
function bootTick(){if(!BOOT)return;const i=BOOT.st.indexOf('run'),n=$('bootNote'),b=$('bootBtn');if(i<0){if(n)n.textContent='';return}
 const e=Math.floor((Date.now()-BOOT.s0[i])/1000),tx=$('bts_'+i);if(tx)tx.textContent=e?e+'초':'';
 if(n)n.textContent=e<5?'':e<15?'구글 서버에서 자료를 모으고 있습니다 · 정상 진행 중입니다':e<30?'처음 접속이거나 사용자가 많으면 20초 정도 걸릴 수 있습니다 · 오류가 아닙니다':'평소보다 오래 걸리고 있습니다 ('+e+'초). 그대로 기다리거나 아래 버튼을 눌러 주세요.';
 if(b&&b.hidden&&BOOT.fn&&e>=(BOOT.fnLabel==='건너뛰고 시작'?8:25)){b.textContent=BOOT.fnLabel;b.onclick=()=>{const f=BOOT&&BOOT.fn;if(f)f()};b.hidden=false}}
function bootEnd(){const el=$('bootBox');if(el)el.hidden=true;if(BOOT)clearInterval(BOOT.tm);BOOT=null;/* 로그인 준비 종료 후 조회 로딩이 남아 화면을 가리지 않게 함 */if(!loadCount){clearTimeout(coverTimer);$('cover').style.display='none'}}
const execOk_=s=>!!(s&&!s.staff&&s.company&&s.company.status==='VERIFIED'&&(s.company.submissionStatus==='APPROVED'||s.company.renewAt));
/** 내 정보를 받은 뒤: (pi 단계) 공사·업무 화면 미리 받기 → 화면 열기. pi<0이면 미리 받기 없이 바로 */
/* v4: 내 정보 확인 뒤 화면부터 공개한다. 공사 목록은 독립 조회하므로 초기 화면을 막지 않는다.
 * 메뉴 진입 시 loadJobs / loadMyJobs 가 각각 서버 조회를 수행한다. */
/* v5.26: 최초 로그인 체크리스트에서 배정 공사를 실제로 한 번만 조회한다.
 *  8초 이상 걸리면 화면 사용을 허용하되 같은 서버 요청을 다시 보내지 않는다. */
let loginJobsPending=null;
/* v5.27: 최초 로그인 중 작업자/허가서 화면을 열기 위한 읽기 전용 자료 선조회.
   배정된 활성 공사 최대 2건, 작업허가서는 첫 활성 공사 1건만 조회.
   제출·승인·서명·순회점검 저장을 선실행하지 않는다. */
const LOGIN_PREP_MAX_JOBS=2;
let loginPrepSeq=0;
const loginPrepared=new Map();
const loginPreparing=new Set();
function prepareJobScreens(list,owner){
 if(!list||!Array.isArray(list.jobs)||!list.jobs.length||loginPreparing.has(owner)||loginPrepared.has(owner))return Promise.resolve();
 loginPreparing.add(owner);
 const jobs=list.jobs.filter(j=>j&&j.id&&j.status!=='ENDED').slice(0,LOGIN_PREP_MAX_JOBS);
 if(!jobs.length)return Promise.resolve();
 const seq=++loginPrepSeq;
 const preps=jobs.map((j,idx)=>{
  const cached=cacheGet('vendorJob',[j.id]);
  return (cached?Promise.resolve(cached):callQuiet('vendorJob',j.id)).then(v=>{
   if(seq!==loginPrepSeq||!v||!state||state.email!==owner)return;
   cacheSet('vendorJob',[j.id],v);
   if(idx!==0||!v.today)return;
   // 작업허가서 읽기는 화면 진입 시 필요한 경우에만. 첫 공사만 사전 준비.
   return callQuiet('getPermit',j.id,v.today).then(r=>{
    if(seq!==loginPrepSeq||!state||state.email!==owner)return;
    cacheSet('getPermit',[j.id,v.today],r);
    if(vjob&&vjob.job.id===j.id)vjob.permitToday=r;
   }).catch(()=>{});
  }).catch(()=>{});
 });
 const all=Promise.allSettled(preps).then(()=>{if(seq===loginPrepSeq)loginPrepared.set(owner,Date.now())}).finally(()=>loginPreparing.delete(owner));
 return all;
}
function prepareLoginJobs(s,pi){
 if(pi<0||!s||s.staff||!execOk_(s))return Promise.resolve();
 bootSet(pi,'run');
 const load=callQuiet('myJobs').then(r=>{
  vjobs=r;vjobsAt=Date.now();cacheSet('myJobs',[],r);
  // 체크리스트 단계에서 미리 공사 상세/작업자/허가서 읽기 시작 (저장 로직은 실행하지 않음).
  prepareJobScreens(r,s.email);
  if(state&&state.email===s.email&&tab==='my'&&$('execArea')&&!vjob){setupVMenu();renderMyJobs()}
  bootSet(pi,'done');return r;
 }).catch(e=>{bootSet(pi,'fail');return null}).finally(()=>{if(loginJobsPending===load)loginJobsPending=null});
 loginJobsPending=load;
 return new Promise(resolve=>{
  let done=false;
  const finish=()=>{if(done)return;done=true;resolve()};
  load.then(finish);
  setTimeout(()=>{if(!done){bootSet(pi,'skip');finish()}},8000);
 });
}
async function bootRest(s,pi){
 setCUser(s.email+'|'+(s.mode||''));cacheSet('portalData',[],s);state=s;
 if(pi>=0)await prepareLoginJobs(s,pi);
 const li=BOOT?BOOT.labels.length-1:0;
 bootSet(li,'run');display(s);bootSet(li,'done');
 setTimeout(bootEnd,180);
}
/** 미리 받은 자료를 이 기기 저장본·메모리에 넣음 (늦게 도착해도 지금 보고 있는 목록 화면이면 다시 그림) */
function applyPack(p){if(!p)return;const now=Date.now();
 if(p.jobBoard){jobData=p.jobBoard;jobAt=now;seenTab.jobs=1;cacheSet('jobBoard',[],p.jobBoard);if(state&&state.staff&&tab==='jobs'&&jobsMode==='list')renderJobs()}
 if(p.myJobs){const old=vjobs?JSON.stringify(vjobs):'';vjobs=p.myJobs;vjobsAt=now;window.__pfAt=now;cacheSet('myJobs',[],p.myJobs);
  const typing=()=>document.activeElement&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  Object.entries(p.vendorJob||{}).forEach(([id,v])=>{if(!v)return;cacheSet('vendorJob',[id],v);if(v.permitToday)cacheSet('getPermit',[id,v.today],v.permitToday);
   if(vjob&&vjob.job.id===id&&JSON.stringify(vjob)!==JSON.stringify(v)&&!typing()&&!document.querySelector('#psheet:not([hidden])')){vjob=v;renderVJob()}});
  if(state&&tab==='my'&&vmenu==='dash'&&!vjob&&$('execArea')&&JSON.stringify(vjobs)!==old){setupVMenu();renderDash()}}}
/** 작업자 등록 QR로 로그인: 로그인 응답에 등록 화면이 같이 옴 (왕복 1번) */
function workerBoot(d){workerLinkMode=true;state={email:d.email||'',appVersion:d.appVersion};showVer(state);$('identity').textContent='접속 계정: '+state.email;
 if(d.wk)showWk(d.wk);else $('my').innerHTML='<div class="card"><h2>작업자 등록 실패</h2><p class="desc">'+escapeText(d.bootError||'')+'</p><button class="button ghost" type="button" onclick="wkCheckIn()">다시 시도</button></div>';
 $('pageTitle').textContent='작업자 등록';window.scrollTo(0,0)}
/* ---------- v2.9 공사·현장미팅 (직원) ---------- */
let jobData=null,roomTimer=null,roomId='';
/* v4.2 빠른 화면 전환: 한 번 본 화면은 저장해 둔 내용을 바로 보여 주고, 최신 내용은 뒤에서 조용히 받아 바꿈 */
const seenTab={};function fetcher(t){const f=seenTab[t]?callQuiet:call;seenTab[t]=1;return f}
let jobsMode='list';
let jobAt=0;  // v5.20 공사 목록 받은 시각 (15초 안이면 다시 받지 않음)
async function loadJobs(){roomId='';jobsMode='list';if(!jobData){const c=cacheGet('jobBoard',[]);if(c)jobData=c}if(jobData)seenTab.jobs=1;const old=jobData?JSON.stringify(jobData):'';if(jobData)renderJobs();if(jobData&&Date.now()-jobAt<15000)return;try{const x=await fetcher('jobs')('jobBoard');jobData=x;jobAt=Date.now();if(tab==='jobs'&&jobsMode==='list'&&JSON.stringify(x)!==old)renderJobs()}catch(e){}}
async function delJob(id){const j=jobData.jobs.find(x=>x.id===id);if(!j)return;const rec=(j.workerCount||j.crewDays)?'\n\n※ 이 공사에는 작업자 '+(j.workerCount||0)+'명, 작업인원 기록 '+(j.crewDays||0)+'일치가 있습니다. 함께 삭제됩니다.':'';
 if(!confirm('"'+j.title+'" 공사를 삭제할까요?\n참여 업체 배정 '+j.vendors.length+'곳, 미팅 '+j.meetings.length+'개도 함께 삭제되며 되돌릴 수 없습니다.'+rec))return;
 if(rec&&prompt('기록까지 삭제됩니다. 확인을 위해 공사명을 그대로 입력해 주세요.\n'+j.title)!==j.title){msg('공사명이 달라 삭제하지 않았습니다.');return}
 try{jobData=await call('deleteJob',id);renderJobs();msg('공사를 삭제했습니다.');refreshBadges()}catch(e){}}
async function delMeet(id){if(!confirm('이 미팅 방과 참석 기록을 삭제할까요? 되돌릴 수 없습니다.'))return;try{jobData=await call('deleteMeeting',id);renderJobs();msg('미팅 방을 삭제했습니다.')}catch(e){}}
function renderJobsOld(){jobsMode='list';roomId='';clearInterval(roomTimer);const d=jobData;$('jobs').innerHTML='<div class="card"><div class="vh-top"><h2 style="margin:0">공사·현장미팅</h2><button class="button" type="button" onclick="jobForm()">+ 새 공사 만들기</button></div><p class="desc">공사를 만들고 참여 업체를 배정한 뒤, 현장 미팅 방을 만들어 QR로 참석을 받습니다.</p></div>'+waitCard()+(d.jobs.map(j=>'<div class="card"><div class="vh-top"><div><h2 style="margin:0">'+escapeText(j.title)+'</h2><div class="muted">'+escapeText(j.kindLabel)+' · '+escapeText(j.storeName)+(j.storeCode?' ('+escapeText(j.storeCode)+')':'')+' · '+escapeText(j.startDate)+(j.endDate?' ~ '+escapeText(j.endDate):'')+' · 주관 '+escapeText(j.hostName)+'</div></div><div class="row"><button class="button ghost" type="button" onclick="jobForm(\''+escapeText(j.id)+'\')">수정</button><button class="button ghost danger" type="button" onclick="delJob(\''+escapeText(j.id)+'\')">삭제</button></div></div><div class="desc" style="margin-top:8px"><b>참여 업체 '+j.vendors.length+'곳</b> · '+(j.vendors.map(v=>escapeText(v.company)+' <span class="muted">('+escapeText(v.trade)+')</span>').join(', ')||'없음')+'</div>'+jobEndHtml(j)+'<div class="line"></div><div class="row" style="justify-content:space-between"><b>작업허가서 <span class="muted">'+(j.permitTotal||0)+'건</span>'+(j.permitWaiting?' <span class="cnt">'+j.permitWaiting+'</span> <span class="req" style="font-size:13px">승인 대기</span>':'')+'</b><button class="button ghost" type="button" onclick="openPermitList(\''+escapeText(j.id)+'\')">작업허가서 보기</button></div><div class="row" style="justify-content:space-between;margin-top:8px"><b>순회점검일지 <span class="muted">'+(j.inspTotal||0)+'건</span>'+(j.inspUnchecked?' <span class="cnt">'+j.inspUnchecked+'</span> <span class="req" style="font-size:13px">확인 대기</span>':'')+(j.findOpen?' <span class="req" style="font-size:13px">· 미조치 '+j.findOpen+'</span>':'')+'</b><button class="button ghost" type="button" onclick="openInspList(\''+escapeText(j.id)+'\')">순회점검 보기</button></div><div class="line"></div><div class="row" style="justify-content:space-between"><b>현장 미팅</b><button class="button ghost" type="button" onclick="meetForm(\''+escapeText(j.id)+'\')">+ 미팅 방 만들기</button></div>'+(j.meetings.map(m=>'<div class="item"><div class="row" style="justify-content:space-between"><div><b>'+escapeText(m.title)+'</b> '+(m.done?'<span class="pill ok">✔ 실시 완료</span>':m.open?'<span class="pill ok">방 열림</span>':'<span class="pill todo">닫힘 · 실시 전</span>')+'<div class="muted">'+escapeText(m.date)+' '+escapeText(m.time||'')+' · '+escapeText(m.place)+' · 참석 '+m.count+'명'+(m.pending?' · <b style="color:#ce2a4b">확인 대기 '+m.pending+'</b>':'')+'</div></div><div class="row"><button class="button" type="button" onclick="openRoom(\''+escapeText(m.id)+'\')">방 들어가기</button><button class="button ghost danger" type="button" onclick="delMeet(\''+escapeText(m.id)+'\')">삭제</button></div></div></div>').join('')||'<p class="muted">아직 미팅 방이 없습니다.</p>')+'</div>').join('')||'<div class="card"><p class="desc">등록된 공사가 없습니다. [+ 새 공사 만들기]로 시작하세요.</p></div>')}
function jobForm(id,preIds){jobsMode='form';const d=jobData,j=id?d.jobs.find(x=>x.id===id):null,dl=(j&&j.delegations)||{},sel=new Set((j?j.vendors:[]).map(v=>v.companyId).concat(preIds||[]));const dg=k=>dl[k]||{};
 $('jobs').innerHTML='<div class="card"><h2>'+(j?'공사 수정':'새 공사 만들기')+'</h2><form onsubmit="saveJobForm(event,\''+escapeText(id||'')+'\')"><div class="field"><label for="f_jKind">구분</label><select id="f_jKind">'+Object.entries(d.kinds).map(([k,v])=>'<option value="'+k+'" '+((j?j.kind:'WORK')===k?'selected':'')+'>'+escapeText(v)+'</option>').join('')+'</select></div><div class="split">'+input('jTitle','공사명',j?j.title:'','text',false,'예: 다이소 매봉역점 리뉴얼 공사')+input('jStore','매장명 (계약 단위면 계약명)',j?j.storeName:'','text',false,'예: 매봉역점')+input('jStart','공사 시작일',j?j.startDate:'','date')+input('jEnd','공사 종료일 (예정)',j?j.endDate:'','date')+'</div>'
 +'<div class="line"></div><h2 style="font-size:15px">참여 업체 배정</h2><p class="desc">계약 전 검토가 승인된 업체만 선택할 수 있습니다.'+(d.testMode?' <span class="req">[테스트 모드] 승인 전 업체도 표시</span>':'')+'</p>'+(d.vendors.map(v=>{const has=!!(j&&j.vendors.some(x=>x.companyId===v.id)),lock=v.expired&&!has&&!d.testMode;/* v5.17 유효기간 지난 업체는 새로 배정 불가 */
  return '<label class="desc" style="display:block;margin:6px 0'+(lock?';opacity:.6':'')+'"><input type="checkbox" class="jv" value="'+escapeText(v.id)+'" '+(sel.has(v.id)&&!lock?'checked':'')+(lock?' disabled':'')+'> <b>'+escapeText(v.company)+'</b> · '+escapeText(v.industry)+(v.approved?'':' <span class="pill todo">승인 전</span>')
  +(v.expired?' <span class="pill todo">계약 전 평가 만료 ('+escapeText(v.valid.until)+')</span>'+(lock?'<span class="muted"> · 업체가 서류를 다시 제출해 승인받으면 배정 가능</span>':''):v.valid&&v.valid.days<=30?' <span class="pill todo">평가 유효 D-'+v.valid.days+'</span>':'')
  +(v.renewing?' <span class="pill lock">재평가 '+escapeText({DRAFT:'작성 중',CORRECTION:'보완 중',SUBMITTED:'검토 중',SAFETY_REVIEW:'검토 중'}[v.renewStatus]||'진행 중')+'</span>':'')+lastEvalHtml(v)+(j&&j.vendors.some(x=>x.companyId===v.id)?' <span class="muted">(배정됨)</span>':(preIds||[]).includes(v.id)?' <span class="pill ok">새 업체</span>':'')+'</label>'}).join('')||'<p class="muted">배정할 수 있는 업체가 없습니다.</p>')
 /* F1.8k 위임장은 손으로 적지 않음 → 공사 기간으로 자동 (협의체 · 합동점검 2장) */
 +'<div class="line"></div><h2 style="font-size:15px">위임장 (자동)</h2><p class="desc">'+escapeText(principalName('ceo',1))+' → <b>'+escapeText(principalName('delegate'))+'</b> · 위임 기간 = 공사 시작일 ~ 종료일 (연장하면 자동으로 늘어남)<br>저장한 뒤 공사 카드의 [위임장]에서 볼 수 있습니다.</p>'
 +'<div class="row" style="margin-top:12px"><button class="button" type="submit">저장</button><button class="button ghost" type="button" onclick="renderJobs()">취소</button></div></form></div>';window.scrollTo(0,0)}
async function saveJobForm(e,id){e.preventDefault();
 // v4.4 서버로 보내기 전에 빈 칸 먼저 확인 → 그 칸으로 이동 + 붉은 테두리·흔들림
 const miss=[['jTitle','공사명'],['jStore','매장명'],['jStart','공사 시작일']].filter(([k])=>!value(k)).map(([key])=>({key}));
 if(value('jStart')&&value('jEnd')&&value('jEnd')<value('jStart')){miss.push({key:'jEnd'});}
 if(miss.length){markMissing(miss);if(miss.some(m=>m.key==='jEnd')&&miss.length===1)msg('공사 종료일이 시작일보다 빠릅니다');return}
 const cur=id&&jobData?jobData.jobs.find(x=>x.id===id):null;
 const dl={};['COUNCIL','JOINT'].forEach(k=>dl[k]={delegator:value('d'+k+'a'),delegatee:value('d'+k+'b'),date:value('d'+k+'c')});const d={id,kind:$('f_jKind').value,title:value('jTitle'),storeName:value('jStore'),storeCode:cur?cur.storeCode:'',address:cur?cur.address:'',startDate:value('jStart'),endDate:value('jEnd'),delegations:dl,vendorIds:[...document.querySelectorAll('.jv:checked')].map(x=>x.value)};try{jobData=await call('saveJob',d);jobsMode='list';renderJobs();msg('공사를 저장했습니다.');refreshBadges()}catch(err){alert(err.message)}}
function meetForm(jobId){jobsMode='form';const j=jobData.jobs.find(x=>x.id===jobId),today=new Date().toISOString().slice(0,10);$('jobs').innerHTML='<div class="card"><h2>미팅 방 만들기 · '+escapeText(j.title)+'</h2><form onsubmit="saveMeetForm(event,\''+escapeText(jobId)+'\')"><div class="split">'+input('mTitle','미팅명','착수 전 현장 미팅')+input('mPlace','장소',j.storeName)+input('mDate','일자',today,'date')+'</div><div class="field"><label>포함할 행사</label>'+Object.entries(jobData.meetKinds).map(([k,v])=>'<label class="desc" style="display:block;margin:6px 0"><input type="checkbox" class="mk" value="'+k+'" checked> '+escapeText(v)+'</label>').join('')+'</div><p class="desc">만들면 참여 업체 대표 계정에 안내 메일이 갑니다. 참석 체크는 현장에서 [방 열기]를 눌러야 시작됩니다.</p><div class="row"><button class="button" type="submit">방 만들기</button><button class="button ghost" type="button" onclick="renderJobs()">취소</button></div></form></div>'}
async function saveMeetForm(e,jobId){e.preventDefault();const d={title:value('mTitle'),place:value('mPlace'),date:value('mDate'),time:value('mTime'),kinds:[...document.querySelectorAll('.mk:checked')].map(x=>x.value)};try{const r=await call('createMeeting',jobId,d);jobAt=0;/* 목록으로 돌아가면 새 미팅이 바로 보이게 */showRoom(r);msg('미팅 방을 만들었습니다.')}catch(err){alert(err.message)}}
async function openRoom(id){try{showRoom(await call('meetingDetail',id))}catch(e){}}
/* ---------- v4.6 미팅 방: 탭으로 나눔 [QR 참석] [합동점검] [협의체 회의록] + 아래 실시 완료 ---------- */
let room=null,roomTab='att';const photoPrev={};
const MARK={OK:'양호',BAD:'불량',NA:'해당없음'};
const okAtt=r=>r.attendees.filter(x=>x.status==='OK');
const staffNames=r=>okAtt(r).filter(x=>x.side==='STAFF').map(x=>x.name).join(', ')||'(참석 체크한 도급인 없음)';
const vendorNamesHtml=r=>r.vendors.map(v=>{const n=okAtt(r).filter(x=>x.side==='VENDOR'&&x.companyId===v.companyId).map(x=>x.name);return '<div><b>'+escapeText(v.company)+'</b> <span class="muted">'+escapeText(v.trade)+'</span> · '+(n.length?escapeText(n.join(', ')):'<span class="req">미참석</span>')+'</div>'}).join('')||'<span class="muted">배정된 업체 없음</span>';
function showRoom(r){
 // 같은 방을 다시 그릴 때(방 열기·참석 확인 등) 작성 중인 내용 유지
 if(room&&room.id===r.id&&!r.done&&$('roomDocs')){collectDocs();r.joint=room.joint;r.minutes=room.minutes}
 if(!r.joint){const items={};(r.jointItems||[]).forEach((_,i)=>items[i+1]='OK');r.joint={items,notes:{}}}  // 처음엔 전 항목 '양호'로 미리 체크
 r.joint.notes=r.joint.notes||{};r.minutes=r.minutes||{type:'정기',start:r.time||'',end:'',etc:''};/* F1.8m 회의 구분 기본 = 정기 */
 const jm=jobData&&jobData.jobs.flatMap(j=>j.meetings).find(m=>m.id===r.id);if(jm){jm.done=!!r.done;jm.open=!!r.open}
 if(!room||room.id!==r.id)roomTab='att';
 jobsMode='room';roomId=r.id;room=r;clearInterval(roomTimer);
 const K=r.kindCodes||[],tabs=[['att','QR 참석 '+okAtt(r).length+'명']].concat(K.includes('JOINT')?[['joint','합동점검']]:[]).concat(K.includes('COUNCIL')?[['council','협의체 회의록']]:[]);
 if(!tabs.some(t=>t[0]===roomTab))roomTab='att';
 /* F1.8j 미팅 방에서 바로: ← 협의체·합동점검 목록 · + 같은 공사에 미팅 방 하나 더 */
 $('jobs').innerHTML='<div class="card"><div class="row" style="justify-content:space-between"><button class="button ghost" type="button" onclick="clearInterval(roomTimer);sgo(\'meet\')">‹ 협의체·합동점검</button></div><h2 style="margin-top:12px">'+escapeText(r.title)+' · '+escapeText(r.job.storeName)+'</h2><div class="muted">'+escapeText(r.date)+' '+escapeText(r.time||'')+' · '+escapeText(r.place)+' · '+escapeText(r.kinds.join(', '))+'</div>'
  +'<div class="muted">도급인 책임자: '+escapeText(principalName('ceo',1))+' → 위임 <b>'+escapeText(principalName('delegate'))+'</b>'+(principalName('manager')?' · 담당 '+escapeText(principalName('manager')):'')+'</div>'  /* F1.8k 회의록·점검표에도 같은 줄 */
  +(r.done?'<div class="note" style="margin-top:12px"><b style="color:var(--ok)">✔ 미팅 실시 완료</b> · '+escapeText(fmtTime(r.doneAt))+' · '+escapeText(r.doneBy||'')+'</div>':'')
  /* F1.8l 탭 없이 한 화면에서 ①참석 → ②합동점검 → ③회의록 순서대로 (위 칩을 누르면 그 단계로 이동) */
  +'<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px">'+tabs.map(([k,l],i)=>'<button type="button" class="fxchip" id="rt_'+k+'" onclick="setRoomTab(\''+k+'\')">'+'①②③'[i]+' '+escapeText(l)+'</button>').join('')+'</div></div>'
  +'<div id="roomDocs">'+tabs.map(([k,l],i)=>'<div class="stage" style="margin:16px 4px 6px;font-size:16px">'+'①②③'[i]+' '+escapeText(k==='att'?'참석 · QR':l)+'</div><div id="rp_'+k+'">'+(k==='att'?attPanel(r):k==='joint'?jointPanel(r):councilPanel(r))+'</div>').join('')+'</div>'
  +footPanel(r);
 // 참석자만 8초마다 새로 고침 (작성 중인 내용은 그대로)
 if(r.open)roomTimer=setInterval(async()=>{if(tab!=='jobs'||roomId!==r.id){clearInterval(roomTimer);return}if(loadCount)return;try{const x=await callQuiet('meetingDetail',r.id);if(x.open!==room.open||x.done!==room.done){showRoom(x);return}if(JSON.stringify(x.attendees)!==JSON.stringify(room.attendees)){room.attendees=x.attendees;refreshAtt()}}catch(e){}},8000)}
function setRoomTab(k){collectDocs();roomTab=k;if(k==='council'||$('rp_council'))refreshResults();const p=$('rp_'+k);if(p)p.previousElementSibling?.scrollIntoView({behavior:'smooth',block:'start'})}
/** F1.8l [▶ 미팅 시작] = 방 열기 + QR 바로 띄우기 (이미 열렸거나 끝났으면 그냥 들어감) */
async function meetStart(id){try{let r=await call('meetingDetail',id);if(!r.open&&!r.done)r=await call('setMeetingOpen',id,true);
 else if(r.open&&!r.done&&!r.attendees.some(x=>x.side==='STAFF'&&x.email===state.email))r=await call('meetJoin',id);/* F1.8m 담당자 자동 참석 */jobAt=0;showRoom(r);window.scrollTo(0,0)}catch(e){}}
/** F1.8l 미팅 날짜만 바꾸기 (시간은 없음) */
async function meetDate(id,v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return;try{jobData=await call('setMeetingDate',id,v);jobAt=Date.now();msg('미팅 날짜를 '+v+'(으)로 바꿨습니다.');renderJobs()}catch(e){}}
/* ① QR 참석 */
function attRow(x){return '<div class="item"><div class="row" style="justify-content:space-between"><div><b>'+escapeText(x.name)+'</b> <span class="muted">'+escapeText(x.role)+' · '+escapeText(fmtTime(x.checkedAt))+' · '+escapeText(x.email)+'</span>'+(x.status==='PENDING'?' <span class="pill todo">확인 대기</span>':' <span class="pill ok">✔ 참석</span>')+'</div>'+(x.status==='PENDING'?'<div class="row"><button class="button" type="button" onclick="confirmAt(\''+escapeText(x.id)+'\',true)">확인</button><button class="button ghost" type="button" onclick="confirmAt(\''+escapeText(x.id)+'\',false)">제외</button></div>':'')+'</div></div>'}
function attList(r){const groups=[['아성다이소 (도급인)',r.attendees.filter(x=>x.side==='STAFF')]].concat(r.vendors.map(v=>[v.company+' · '+v.trade,r.attendees.filter(x=>x.side==='VENDOR'&&x.companyId===v.companyId)]));
 return '<div class="card"><h2>참석자 '+okAtt(r).length+'명'+(r.attendees.some(x=>x.status==='PENDING')?' · <span class="req">확인 대기 '+r.attendees.filter(x=>x.status==='PENDING').length+'</span>':'')+'</h2>'+groups.map(([g,list])=>'<div class="stage">'+escapeText(g)+' ('+list.length+')</div>'+(list.map(attRow).join('')||'<p class="muted">아직 없음</p>')).join('')+'</div>'}
function attPanel(r){const qr='https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data='+encodeURIComponent(r.link);
 return (r.done?'':'<div class="card"><button class="button '+(r.open?'dark':'')+'" style="width:100%" type="button" onclick="toggleRoom('+(!r.open)+')">'+(r.open?'참석 체크 닫기':'▶ 미팅 시작 (QR 띄우기)')+'</button>'
  +(r.open?'<div style="text-align:center;margin:16px 0 0"><img src="'+escapeText(qr)+'" alt="참석 체크 QR 코드" width="260" height="260" style="border:1px solid var(--line);border-radius:12px"><div class="desc">참석자가 휴대폰 카메라로 찍고 <b>본인 Google 계정</b>으로 로그인하면 체크됩니다.</div><button class="button ghost" type="button" onclick="copyLink(\''+escapeText(r.link)+'\')">참여 링크 복사</button></div>':'<div class="note" style="margin-top:12px">현장에서 [▶ 미팅 시작]을 누르면 QR이 뜨고 참석 체크가 시작됩니다.</div>')+'</div>')
  +'<div id="roomAtt">'+attList(r)+'</div>'}
function refreshAtt(){const r=room;if($('jOpin')){collectDocs();$('jOpin').innerHTML=opinHtml(r)}if($('roomAtt'))$('roomAtt').innerHTML=attList(r);if($('rt_att'))$('rt_att').textContent='QR 참석 '+okAtt(r).length+'명';document.querySelectorAll('.jStaff').forEach(x=>x.textContent=staffNames(r));document.querySelectorAll('.jVendor').forEach(x=>x.innerHTML=vendorNamesHtml(r))}
/* ② 합동점검: 전 항목 양호로 시작 → 불량 누르면 메모·사진 칸이 열림 */
function photoList(n){const ids=(room.joint.notes[n]||{}).photos||[];return ids.map((id,i)=>photoPrev[id]?'<img class="jph" src="'+photoPrev[id]+'" alt="'+n+'번 불량 사진 '+(i+1)+'" onclick="viewPhoto(\''+escapeText(id)+'\')">':'<button class="button ghost" type="button" onclick="viewPhoto(\''+escapeText(id)+'\')">📷 사진 '+(i+1)+'</button>').join('')}
function badBox(n,dis){const nt=room.joint.notes[n]||{};return '<div class="jbad"><label for="f_jm'+n+'">지적 내용 · 조치 <span class="req">*</span></label><input id="f_jm'+n+'" class="jmemo" data-n="'+n+'" value="'+escapeText(nt.memo||'')+'" '+dis+' placeholder="예) 개구부 덮개 미설치 → 덮개 설치 (○○인테리어, 10/21)"><div class="row" style="margin-top:8px" id="jp_'+n+'">'+photoList(n)
 +(dis?'':'<label class="button ghost" for="jf_'+n+'">📷 사진 넣기</label><input class="hidefile" type="file" id="jf_'+n+'" accept="image/*" capture="environment" onchange="addPhoto('+n+')" aria-label="'+n+'번 불량 사진 선택">')+'</div></div>'}
function jointPanel(r){const J=r.joint,dis=r.done?'disabled':'';let grp='';const bad=Object.values(J.items).filter(v=>v==='BAD').length;
 return '<div class="card"><div class="vh-top"><h2 style="margin:0">도급 사업 협력사 합동안전보건 점검표</h2><span class="pill lock">최초1회</span></div>'
  +'<table class="rtable" style="margin-top:12px"><tr><th>현장명</th><td>다이소 '+escapeText(r.job.storeName)+'</td><th>점검일</th><td>'+escapeText(r.date)+'</td></tr><tr><th>점검자<br>도급인</th><td colspan="3" class="jStaff">'+escapeText(staffNames(r))+'</td></tr><tr><th>점검자<br>수급인</th><td colspan="3" class="jVendor">'+vendorNamesHtml(r)+'</td></tr></table>'
  +'<p class="desc" style="margin:10px 0 0">전 항목이 <b>양호</b>로 미리 체크되어 있습니다. 지적사항만 <b>불량</b>(또는 해당없음)으로 바꾸고, 불량은 메모와 사진을 남겨 주세요. <span id="jSum">'+(bad?'· 불량 <b class="req">'+bad+'</b>건':'')+'</span></p>'
  +r.jointItems.map(([g,t],i)=>{const n=i+1,v=J.items[n]||'';const head=g!==grp?(grp=g,'<div class="stage">'+escapeText(g)+'</div>'):'';
   return head+'<div class="jitem'+(v==='BAD'?' bad':'')+'" id="ji_'+n+'"><div class="jq"><b>'+n+'.</b> '+escapeText(t)+'</div><div class="jm" role="radiogroup" aria-label="'+n+'번 점검 결과">'+Object.entries(MARK).map(([k,l])=>'<label class="jb '+k.toLowerCase()+'"><input type="radio" name="ji'+n+'" value="'+k+'" '+(v===k?'checked':'')+' '+dis+' onchange="jointMark('+n+')"><span>'+l+'</span></label>').join('')+'</div><div id="jbx_'+n+'">'+(v==='BAD'?badBox(n,dis):'')+'</div></div>'}).join('')+'<div id="jOpin">'+opinHtml(r)+'</div></div>'}
/** 수급인 의견 청취: QR로 참석한 업체마다 의견 칸 (참석이 늘면 자동으로 추가) */
function opinCos(r){const m=new Map();okAtt(r).filter(x=>x.side==='VENDOR'&&x.companyId).forEach(x=>{if(!m.has(x.companyId))m.set(x.companyId,x.company)});return [...m]}
function opinHtml(r){const O=(r.joint&&r.joint.opinions)||{},dis=r.done?'disabled':'',cos=opinCos(r);
 return '<div class="stage">수급인 의견 청취 · 제안 사항</div>'+(cos.length?cos.map(([cid,co])=>'<div class="field"><label for="f_jo_'+escapeText(cid)+'"><b>'+escapeText(co)+'</b> 의견 <span class="muted">(선택)</span></label><textarea id="f_jo_'+escapeText(cid)+'" class="jopin" data-cid="'+escapeText(cid)+'" data-co="'+escapeText(co)+'" '+dis+' style="min-height:60px" placeholder="예) 자재 반입 시간 조정 요청 · 의견 없음">'+escapeText((O[cid]||{}).text||'')+'</textarea></div>').join(''):'<p class="muted">QR로 참석 체크한 협력업체가 생기면, 업체마다 의견 칸이 자동으로 생깁니다.</p>')}
function jointMark(n){collectDocs();const v=room.joint.items[n],el=$('ji_'+n);el.classList.toggle('bad',v==='BAD');el.classList.remove('miss','shake');$('jbx_'+n).innerHTML=v==='BAD'?badBox(n,''):'';if(v==='BAD')setTimeout(()=>$('f_jm'+n)?.focus(),50);
 const bad=Object.values(room.joint.items).filter(x=>x==='BAD').length;$('jSum').innerHTML=bad?'· 불량 <b class="req">'+bad+'</b>건':''}
/* F1.6b 합동점검 불량 사진: 여러 장 한꺼번에 (항목마다 최대 5장) */
async function addPhoto(n){const inp=$('jf_'+n);collectDocs();const nt=room.joint.notes[n]=room.joint.notes[n]||{memo:'',photos:[]},left=5-(nt.photos||[]).length,fl=[...(inp.files||[])].slice(0,Math.max(0,left));inp.value='';
 if(!fl.length){if(left<=0)msg('사진은 항목마다 5장까지입니다.');return}if(fl.length>1)msg('사진 '+fl.length+'장을 올리는 중입니다…');
 const rs=await Promise.allSettled(fl.map(async f0=>{const f=await readFile(f0,PHOTO_SITE);const r=await call('uploadMeetingPhoto',room.id,n,f);photoPrev[r.id]='data:'+f.mime+';base64,'+f.data;return r.id}));
 const ids=rs.filter(x=>x.status==='fulfilled').map(x=>x.value),bad=rs.filter(x=>x.status==='rejected');
 if(ids.length){nt.photos=(nt.photos||[]).concat(ids).slice(0,5);$('jbx_'+n).innerHTML=badBox(n,'');msg(n+'번 사진 '+ids.length+'장을 올렸습니다. [임시 저장]을 눌러 보관하세요.')}
 if(bad.length)alert((ids.length?ids.length+'장은 올렸고 ':'')+bad.length+'장은 올리지 못했습니다.\n'+((bad[0].reason&&bad[0].reason.message)||''))}
async function viewPhoto(id){if(photoPrev[id]){const w=window.open();if(w)w.document.write('<img src="'+photoPrev[id]+'" style="max-width:100%">');return}try{const f=await call('getMeetingPhoto',room.id,id);photoPrev[id]='data:'+f.mime+';base64,'+f.data;const w=window.open();if(w)w.document.write('<img src="'+photoPrev[id]+'" style="max-width:100%">')}catch(e){}}
/* ③ 협의체 회의록: 참석 자동, 발의내용 = 법정 협의사항 고정, 심의결과 = 합동점검 지적사항 자동 */
function resultsLines(){const J=room.joint,bad=Object.entries(J.items).filter(([,v])=>v==='BAD').map(([n])=>Number(n)).sort((p,q)=>p-q);
 if(!(room.kindCodes||[]).includes('JOINT'))return ['협의사항 공유, 특이사항 없음'];
 return bad.length?bad.map(n=>'[합동점검 지적] '+n+'. '+room.jointItems[n-1][1]+' → 불량'+(J.notes[n]?.memo?': '+J.notes[n].memo:' (메모 작성 필요)')):['합동안전보건점검 결과 특이사항 없음 (종결)']}
function refreshResults(){if($('mResList'))$('mResList').innerHTML=resultsLines().map(x=>'<li>'+escapeText(x)+'</li>').join('');if($('mPhotos'))$('mPhotos').innerHTML=minPhotosHtml();if($('mOpin'))$('mOpin').innerHTML=minOpinHtml();loadMeetPhotos()}
/** 회의록: 합동점검 불량 항목 사진 (자동) */
function minPhotosHtml(){const J=room.joint||{},list=Object.entries(J.items||{}).filter(([,v])=>v==='BAD').map(([n])=>Number(n)).sort((a,b)=>a-b).filter(n=>((J.notes||{})[n]||{}).photos&&J.notes[n].photos.length);
 if(!list.length)return '';return '<div class="stage">지적 사진 <span class="muted">(합동점검에서 자동)</span></div>'+list.map(n=>'<div class="mph"><div class="muted">'+n+'. '+escapeText(room.jointItems[n-1][1])+'</div><div class="row">'+J.notes[n].photos.map((id,i)=>'<img class="jph" data-mp="'+escapeText(id)+'" alt="'+n+'번 지적 사진 '+(i+1)+'" '+(photoPrev[id]?'src="'+photoPrev[id]+'"':'')+' onclick="viewPhoto(\''+escapeText(id)+'\')">').join('')+'</div></div>').join('')}
/** 회의록: 수급인 의견 (합동점검에서 자동) */
function minOpinHtml(){const O=(room.joint&&room.joint.opinions)||{},l=Object.values(O).filter(o=>o.text);if(!l.length)return '';return '<div class="stage">수급인 의견 <span class="muted">(합동점검에서 자동)</span></div><ol class="rules">'+l.map(o=>'<li><b>'+escapeText(o.company)+'</b>: '+escapeText(o.text)+'</li>').join('')+'</ol>'}
/* F1.6 한꺼번에 요청 → fb.js가 8장씩 묶어 서버에 한 번만 */
async function loadMeetPhotos(){const need=new Set();document.querySelectorAll('img[data-mp]').forEach(img=>{const id=img.dataset.mp;if(photoPrev[id])img.src=photoPrev[id];else need.add(id)});
 await Promise.all([...need].map(id=>callQuiet('getMeetingPhoto',room.id,id).then(f=>{photoPrev[id]='data:'+f.mime+';base64,'+f.data;document.querySelectorAll('img[data-mp="'+id+'"]').forEach(x=>x.src=photoPrev[id])}).catch(()=>{})))}
function councilPanel(r){const M=r.minutes,dis=r.done?'disabled':'';
 return '<div class="card"><h2>협력사 협의체 회의록</h2><table class="rtable"><tr><th>현장명</th><td>'+escapeText(r.job.storeName)+'</td><th>회의구분</th><td><label><input type="radio" name="mType" value="정기" '+(M.type==='정기'?'checked':'')+' '+dis+'> 정기</label> <label><input type="radio" name="mType" value="임시" '+(M.type!=='정기'?'checked':'')+' '+dis+'> 임시</label></td></tr>'
  +'<tr><th>일 시</th><td colspan="3">'+escapeText(r.date)+' <input type="time" id="f_mStart" value="'+escapeText(M.start)+'" '+dis+' aria-label="시작 시각"> ~ <input type="time" id="f_mEnd" value="'+escapeText(M.end)+'" '+dis+' aria-label="종료 시각"></td></tr>'
  +'<tr><th>참석 인원<br>도급인</th><td colspan="3" class="jStaff">'+escapeText(staffNames(r))+'</td></tr><tr><th>수급인</th><td colspan="3" class="jVendor">'+vendorNamesHtml(r)+'</td></tr></table>'
  +'<p class="muted" style="margin:6px 0 0">참석 인원은 QR 참석 체크에서 자동으로 들어옵니다.</p>'
  +'<div class="stage">발 의 내 용 <span class="muted">(법정 협의사항 · 산업안전보건법 시행규칙 제79조)</span></div><ol class="rules">'+(r.agenda||[]).map(x=>'<li>'+escapeText(x)+'</li>').join('')+'</ol>'
  +'<div class="stage">심 의 결 과 <span class="muted">(합동점검 결과에서 자동)</span></div><ol class="rules" id="mResList">'+resultsLines().map(x=>'<li>'+escapeText(x)+'</li>').join('')+'</ol>'
  +'<div id="mPhotos">'+minPhotosHtml()+'</div><div id="mOpin">'+minOpinHtml()+'</div>'
  +'<div class="field"><label for="f_mEtc">기타사항 <span class="muted">(선택)</span></label><textarea id="f_mEtc" '+dis+' style="min-height:70px">'+escapeText(M.etc||'')+'</textarea></div></div>'}
function footPanel(r){if(!(r.kindCodes||[]).length)return '';return '<div class="card roomfoot">'+(r.done?'<button class="button ghost" type="button" onclick="reopenDocs()">완료 취소 (내용 고치기)</button>'
 :'<div class="row"><button class="button ghost" type="button" style="flex:1" onclick="saveDocs()">임시 저장</button><button class="button" type="button" style="flex:2" onclick="doneMeeting()">미팅 실시 완료</button></div>')+'</div>'}
/** 화면 입력값 모으기 (room에도 반영) */
function collectDocs(){if(!room||!$('roomDocs')||room.done)return room?{joint:room.joint,minutes:room.minutes}:null;const r=room;
 if($('rp_joint')){const items={},notes={};r.jointItems.forEach((_,i)=>{const n=i+1,v=document.querySelector('input[name=ji'+n+']:checked');items[n]=v?v.value:'';if(items[n]==='BAD'){const old=r.joint.notes[n]||{};const m=$('f_jm'+n);notes[n]={memo:m?m.value.trim():(old.memo||''),photos:old.photos||[]}}});const opinions=Object.assign({},(r.joint&&r.joint.opinions)||{});document.querySelectorAll('.jopin').forEach(t=>opinions[t.dataset.cid]={company:t.dataset.co,text:t.value.trim()});r.joint={items,notes,opinions}}
 if($('rp_council'))r.minutes={type:document.querySelector('input[name=mType]:checked')?.value||'정기',start:value('mStart'),end:value('mEnd'),etc:value('mEtc')};
 return {joint:r.joint,minutes:r.minutes}}
async function saveDocs(){const d=collectDocs();try{showRoom(await call('saveMeetingDocs',room.id,d));msg('임시 저장했습니다.')}catch(e){}}
/** 실시 완료: 빠진 곳이 있으면 그 탭으로 이동 → 칸 붉은 테두리·흔들림 */
async function doneMeeting(){const d=collectDocs(),r=room,K=r.kindCodes||[];
 if(!okAtt(r).some(x=>x.side==='VENDOR')){setRoomTab('att');msg('참석한 협력업체가 없습니다. QR로 참석 체크를 받아 주세요.');return}
 if(r.attendees.some(x=>x.status==='PENDING')){setRoomTab('att');msg('확인 대기 참석자를 [확인] 또는 [제외]해 주세요.');return}
 if(K.includes('JOINT')){const miss=[];r.jointItems.forEach((_,i)=>{const n=i+1;if(!d.joint.items[n])miss.push('ji_'+n);else if(d.joint.items[n]==='BAD'&&!d.joint.notes[n]?.memo)miss.push('f_jm'+n)});
  if(miss.length){setRoomTab('joint');document.querySelectorAll('.miss').forEach(x=>x.classList.remove('miss','shake'));miss.forEach(id=>{const el=$(id);if(!el)return;el.classList.add('miss');void el.offsetWidth;el.classList.add('shake')});setTimeout(()=>{const f=$(miss[0]);f&&f.scrollIntoView({behavior:'smooth',block:'center'});if(f&&f.tagName==='INPUT')f.focus({preventScroll:true})},50);msg(miss[0].startsWith('f_jm')?'불량 항목의 지적 내용·조치를 적어 주세요':'체크하지 않은 점검 항목이 있습니다');return}}
 if(!confirm('미팅 실시를 완료할까요?\n방이 닫히고 점검표·회의록이 확정됩니다. (고칠 때는 [완료 취소])'))return;
 try{const x=await call('completeMeeting',r.id,d);showRoom(x);window.scrollTo(0,0);msg('미팅 실시 완료로 확정했습니다.')}catch(e){if(/응답을 받지 못했/.test(e.message||'')){try{const x=await call('meetingDetail',r.id);if(x.done){showRoom(x);window.scrollTo(0,0);msg('미팅 실시 완료로 확정되었습니다.');return}}catch(z){}}alert(e.message)}}
async function reopenDocs(){if(!confirm('실시 완료를 취소하고 내용을 고칠까요?'))return;try{showRoom(await call('reopenMeetingDocs',room.id))}catch(e){}}
async function toggleRoom(open){if(!open&&!confirm('방을 닫으면 더 이상 참석 체크가 되지 않습니다. 닫을까요?'))return;try{showRoom(await call('setMeetingOpen',roomId,open))}catch(e){}}
async function confirmAt(id,ok){if(!confirm(ok?'이 참석자를 확인할까요? (본인 신원을 확인한 경우에만)':'이 참석 기록을 제외할까요?'))return;try{showRoom(await call('confirmAttendee',roomId,id,ok))}catch(e){}}
function copyLink(t){navigator.clipboard?.writeText(t).then(()=>msg('링크를 복사했습니다.'),()=>prompt('아래 링크를 복사하세요',t))}
/* ---------- v2.9 참석 체크 (QR로 들어온 모든 계정) ---------- */
/* F1.8p 응답이 25초 넘게 없으면 로딩을 끝내고 [다시 시도] (예전: 로딩 창이 끝없이 떠 있음) */
async function meetCheckIn(info){const token=MEET_TOKEN||LINK_REVIEW.slice(5);let tt=0;try{const r=await Promise.race([call('meetCheckIn',token,info||null),new Promise((_,rej)=>{tt=setTimeout(()=>{loadEnd();rej(Error('서버 응답이 늦습니다. 인터넷 연결을 확인한 뒤 [다시 시도]를 눌러 주세요. (이미 기록됐으면 다시 시도 때 완료로 보입니다)'))},25000)})]);showCheckIn(r)}catch(e){$('my').innerHTML='<div class="card"><h2>참석 체크 실패</h2><p class="desc">'+escapeText(e.message||'')+'</p><button class="button" type="button" onclick="meetCheckIn()">다시 시도</button></div>'}finally{clearTimeout(tt)}switchTab('my');$('my').scrollIntoView()}
/** F1.8p 미등록 계정: 참석 화면 → 사업자 등록 신청(또는 승인 대기) 화면으로 */
function meetToReg(){try{history.replaceState(null,'',location.pathname)}catch(e){}MEET_TOKEN='';renderMy();switchTab('my');window.scrollTo(0,0)}
function showCheckIn(r){const head='<div class="card"><small class="muted">'+escapeText(r.store)+' · '+escapeText(r.date)+' · '+escapeText(r.place)+'</small><h2>'+escapeText(r.meeting)+'</h2>';let body='';
 if(r.state==='DONE')body=r.status==='PENDING'?'<div class="note"><b>확인 대기</b> · '+escapeText(r.name)+' ('+escapeText(r.company)+' · '+escapeText(r.role)+')<br>도급인 담당자가 현장에서 신원을 확인하면 참석으로 처리됩니다.</div>':'<div style="text-align:center;padding:10px 0"><div style="font-size:44px">✔</div><h2 style="color:#1b7442">참석 체크 완료</h2><p class="desc"><b>'+escapeText(r.name)+'</b> · '+escapeText(r.company)+' · '+escapeText(r.role)+'<br>'+escapeText(fmtTime(r.checkedAt))+' · 계정 '+escapeText(state.email)+'</p></div>';
 else if(r.state==='NO_VENDOR')body='<div class="note"><b>이 공사에 배정된 협력업체가 없습니다.</b><br>도급인 담당자가 [공사·현장미팅] → 공사 [수정]에서 참여 업체를 먼저 배정해야 합니다.</div><button class="button ghost" type="button" onclick="meetCheckIn()">다시 확인</button>';
 else if(r.state==='NO_COMPANY')body=r.pending?'<div class="note"><b>사업자 등록 승인 대기 중입니다</b> ('+escapeText(r.pending)+')<br>본사 승인이 끝난 뒤 다시 QR을 찍어 주세요.</div><button class="button ghost" type="button" style="width:100%" onclick="meetToReg()">신청 현황 보기</button>'
  :'<div class="note"><b>등록되지 않은 계정입니다</b><br>사업자 등록을 신청하고 승인받은 뒤 접속해 주세요.<br><span class="muted">계정 '+escapeText(state.email)+'</span></div><button class="button" type="button" style="width:100%" onclick="meetToReg()">사업자 등록 신청하기</button><button class="linkbtn" type="button" style="margin-top:8px" onclick="relogin()">다른 계정으로 로그인</button>';
 else if(r.state==='CLOSED')body='<div class="note">아직 방이 열리지 않았거나 이미 닫혔습니다. 도급인 담당자가 [방 열기]를 누른 뒤 다시 QR을 찍어 주세요.</div><button class="button ghost" type="button" onclick="meetCheckIn()">다시 확인</button>';
 else{const k=r.known;body='<p class="desc">로그인 계정 <b>'+escapeText(state.email)+'</b> 으로 참석을 기록합니다. 본인 계정이 맞는지 확인해 주세요. <button class="linkbtn" type="button" onclick="relogin()">다른 계정으로 로그인</button></p><form onsubmit="sendCheckIn(event)">'+input('cName','이름',k?k.name:'','text',false,'예: 홍길동')+(k?'<div class="field"><label>소속 업체</label><div><b>'+escapeText(k.company)+'</b> <span class="muted">(업체 가입 정보로 자동 확인)</span></div></div>':'<div class="field"><label for="f_cCompany">소속 업체</label><select id="f_cCompany"><option value="">업체 선택</option>'+r.vendors.map(v=>'<option value="'+escapeText(v.companyId)+'" '+(r.vendors.length===1?'selected':'')+'>'+escapeText(v.company)+'</option>').join('')+'</select><div class="muted">'+(r.myCompany?'<b class="req">이 계정의 업체('+escapeText(r.myCompany)+')는 이 공사에 배정되어 있지 않습니다.</b> 도급인에게 배정을 요청하거나, 실제 소속 업체를 고르세요.<br>':'이 계정은 업체 대표 계정으로 등록되어 있지 않습니다. ')+'소속 업체를 고르면 도급인 확인 후 참석 처리됩니다.</div></div>')+'<div class="field"><label for="f_cRole">역할</label><select id="f_cRole">'+r.roles.map(x=>'<option>'+escapeText(x)+'</option>').join('')+'</select></div><button class="button" style="width:100%" type="submit">참석 체크</button></form>'}
 $('my').innerHTML=head+body+'</div>'}
async function sendCheckIn(e){e.preventDefault();const info={name:value('cName'),role:$('f_cRole').value,companyId:$('f_cCompany')?$('f_cCompany').value:''};if(!info.name){alert('이름을 입력해 주세요.');return}if($('f_cCompany')&&!info.companyId){alert('소속 업체를 목록에서 골라 주세요.');$('f_cCompany').focus();return}await meetCheckIn(info)}
/* ---------- v3.1 수행단계 (업체): 내 공사 → [오늘 할 일] / [비상대응훈련] ---------- */
let vjobs=null,vjob=null,vtab='today',wkTimer=null,showQr=false,showAdd=false,workerLinkMode=false;
const SIGN_LABEL={SELF:'✔ 본인 계정 서명',MANAGER:'✔ 소장 확인'};
let vjobsAt=0;  // v5.18 공사 목록 받은 시각 (방금 받았으면 화면만 다시 그림)
/* v5.20 가진 목록(메모리·이 기기 저장본)으로 먼저 바로 그림 → 뒤에서 새로 받아 바뀐 경우만 다시 그림 (예전: 대시보드를 누르면 서버 응답까지 이전 화면 그대로) */
async function loadMyJobs(quick){const x=()=>$('execArea');if(!vjobs){const c=cacheGet('myJobs',[]);if(c)vjobs=c}
 const had=!!vjobs,old=had?JSON.stringify(vjobs):'';if(had){setupVMenu();renderMyJobs();if(quick&&Date.now()-vjobsAt<20000)return}
 try{const r=await (loginJobsPending||(had||/^MEET-/.test(LINK_REVIEW)?callQuiet:call)('myJobs'));/* 참석 QR 화면 위에 로딩 창을 띄우지 않음 */vjobsAt=Date.now();vjobs=r;if(!loginPrepared.has(state?.email||'')&&execOk_(state))prepareJobScreens(r,state.email);if(!had){setupVMenu();renderMyJobs()}else if(JSON.stringify(r)!==old){setupVMenu();if(vmenu==='dash'&&!vjob)renderDash()}}catch(e){if(!had&&x())x().innerHTML='<div class="card"><p class="desc">'+escapeText(e.message||'공사 목록을 불러오지 못했습니다.')+'</p></div>'}}
function renderMyJobs(){if(vmenu==='dash')renderDash();else vEnsureJob()}
async function openVJob(id){const c=cacheGet('vendorJob',[id]);vtab='today';showQr=false;showAdd=false;
 if(c){vjob=c;const cp=cacheGet('getPermit',[id,c.today]);if(cp&&!vjob.permitToday)vjob.permitToday=cp;renderVJob();window.scrollTo(0,0);callQuiet('vendorJob',id).then(x=>{if(!vjob||vSel!==id||vjob.job.id!==id||JSON.stringify(x)===JSON.stringify(vjob))return;const typing=document.activeElement&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&$('execArea')?.contains(document.activeElement);vjob=x;if(!typing&&!document.querySelector('#psheet:not([hidden])'))renderVJob()}).catch(()=>{});return}
 try{const started=Date.now();vjob=await call('vendorJob',id);const received=Date.now();renderVJob();window.scrollTo(0,0);perfRecord('ui','vendorJobRender',Date.now()-received,true);perfRecord('flow','vendorJobTotal',Date.now()-started,true)}catch(e){const el=$('execArea');if(el)el.innerHTML='<div class="card"><h2>공사 화면을 열지 못했습니다</h2><p class="desc">'+escapeText(e.message||'통신 오류가 발생했습니다.')+'</p><button class="button" type="button" onclick="openVJob(vSel)">다시 시도</button></div>';}}
function backJobs(){vgo('dash')}
function setVTab(t){vtab=t;renderVJob()}
function renderVJob(){const el=$('execArea');if(!el||!vjob)return;const v=vjob;clearInterval(wkTimer);
 const head=vJobHead(v);
 el.innerHTML=head+vEndHtml(v)+todayHtml(v);
 if(!(typeof tour!=='undefined'&&tour))setTimeout(()=>dayGuide(false),600);  // F1.8a 하루 한 번 사용 가이드 (가이드가 화면을 바꿀 때는 다시 시작하지 않음)
 /* F1.8a 대시보드 '오늘 할 일'에서 누른 칸으로 바로 이동 */if(window.__vjump){const id=window.__vjump;window.__vjump='';setTimeout(()=>$(id)?.scrollIntoView({block:'start'}),60)}
 if(showQr)wkTimer=setInterval(async()=>{if(!vjob||vjob.job.id!==v.job.id||!showQr){clearInterval(wkTimer);return}try{const x=await callQuiet('vendorJob',v.job.id);if(x.workers.length!==vjob.workers.length){vjob=x;renderVJob();msg('새 작업자가 등록되었습니다.')}}catch(e){}},8000)}
function todayHtml(v){
 const qr='https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data='+encodeURIComponent(v.link);
 const method=w=>w.method==='SELF'?'본인 등록':'소장 등록';
 if(vmenu==='edu')return eduHtml(v);  // F1.8b ☰ 신규교육 현황 (전체 명단 · 이수증 나중에 올리기)
 /* F1.8b 오늘 현장 업무: 설명 문구 없이 ① 신규자 등록 → ② 작업허가서 → ③ 순회점검 · 끝낸 칸은 어둡게 + '오늘 완료' 도장 (눌러서 다시 열기) */
 const todayW=v.workers.filter(w=>isTodayWorker(v,w)),noNew=noNewToday(v),regDone=v.jobStatus!=='ENDED'&&(todayW.length>0||noNew),sb='padding:8px 10px;font-size:13px';
 const reg='<div class="card" id="regCard" style="position:relative">'+(regDone?doneMask('신규자 등록'):'')
  +'<div class="vh-top"><h2 style="margin:0;font-size:16px">① 신규자 등록</h2><button class="button ghost" type="button" id="gdReg" style="padding:4px 8px;font-size:12px" onclick="startTour(\'reg\')">❔ 사용 가이드</button></div>'
  +'<div class="row" style="margin-top:8px;gap:6px"><button class="button" type="button" id="btnQr" style="flex:1;'+sb+'" onclick="toggleQr()">'+(showQr?'QR 닫기':'QR 보여주기')+'</button><button class="button ghost" type="button" id="btnAdd" style="flex:1;'+sb+'" onclick="toggleAdd()">'+(showAdd?'직접 등록 닫기':'직접 등록')+'</button></div>'
  +(showQr?'<div style="text-align:center;margin:12px 0 4px"><img src="'+escapeText(qr)+'" alt="작업자 등록 QR 코드" width="220" height="220" style="border:1px solid var(--line);border-radius:12px"><div class="row" style="justify-content:center;margin-top:6px"><button class="button ghost" type="button" style="'+sb+'" onclick="copyLink(\''+escapeText(v.link)+'\')">등록 링크 복사</button><button class="button ghost" type="button" style="'+sb+'" onclick="renewQr()">QR 새로 만들기</button></div></div>':'')
  +(showAdd?'<form class="subbox" onsubmit="addWorkerForm(event)"><div style="display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:6px">'+input('wName','이름','','text',false,'홍길동')+'<div class="field"><label for="f_wRole">구분</label><select id="f_wRole">'+v.roles.map(r=>'<option '+(r==='근로자'?'selected':'')+'>'+escapeText(r)+'</option>').join('')+'</select></div>'+input('wTrade','공정명','','text',false,'목공')+'</div>'+certFieldHtml('wCert')+'<label class="desc"><input type="checkbox" id="wAgree"> 작업 안전 수칙 '+v.rules.length+'개 항목을 교육하고 서약을 받았습니다.</label><button class="button" type="submit" style="width:100%;margin-top:10px">작업자 등록</button></form>':'')
  /* 오늘 등록한 사람만 표로 (전체 명단·지난 사람 이수증은 ☰ 신규교육 현황) */
  +'<div id="regToday" style="margin-top:10px">'+(todayW.length?'<table class="rtable"><tr><th>이름</th><th>구분·공정</th><th style="width:72px">이수증</th><th style="width:44px"></th></tr>'+todayW.map(w=>'<tr><td><b>'+escapeText(w.name)+'</b></td><td>'+escapeText(w.role)+(w.trade?' · '+escapeText(w.trade):'')+'</td><td>'+certCell(w)+'</td><td><button class="linkbtn" type="button" style="font-size:12px" onclick="undoWorker(\''+escapeText(w.id)+'\')" aria-label="'+escapeText(w.name)+' 등록 취소">취소</button></td></tr>').join('')+'</table>'
   :'<div class="row" style="justify-content:space-between"><span class="muted">오늘 등록한 사람 없음'+(noNew?' · [오늘 신규자 없음] 표시함':'')+'</span>'+(noNew?'<button class="button ghost" type="button" style="padding:4px 8px;font-size:12px" onclick="clearNoNew()">취소</button>':'')+(v.jobStatus!=='ENDED'&&!noNew?'<button class="button ghost" type="button" id="btnNoNew" style="padding:4px 8px;font-size:12px" onclick="setNoNew()">오늘 신규자 없음</button>':'')+'</div>')+'</div></div>';
 return reg+permitCardHtml(v)+inspCardHtml(v);
}
/** 오늘 등록한 사람 (등록하면 그날 작업 안전 수칙 서명 기록에 들어감) */
function isTodayWorker(v,w){if(v.todayCrew&&(v.todayCrew.workers||[]).some(x=>x.id===w.id))return true;try{return new Date(w.eduAt).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})===v.today}catch(e){return false}}
/** [오늘 신규자 없음] (이 기기에 그날만 기억) → 신규자 등록 칸을 완료로 */
const noNewKey=v=>'noNew:'+v.job.id+':'+v.today;
function noNewToday(v){try{return localStorage.getItem(noNewKey(v))==='1'}catch(e){return false}}
function setNoNew(){try{localStorage.setItem(noNewKey(vjob),'1')}catch(e){}const y=window.scrollY;renderVJob();window.scrollTo(0,y)}
/** 끝낸 칸 위 어두운 막 + '오늘 완료' 도장 · 누르면 막이 걷혀서 다시 볼 수 있음 */
function doneMask(label){return '<div class="doneMask" role="button" tabindex="0" aria-label="'+escapeText(label)+' 오늘 완료 · 눌러서 열기" onclick="this.remove()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.remove()}" style="position:absolute;inset:0;z-index:3;border-radius:inherit;background:rgba(17,24,39,.55);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer">'
 +'<span style="border:3px solid #fff;color:#fff;border-radius:10px;padding:6px 16px;font-size:20px;font-weight:800;transform:rotate(-8deg)">✔ 오늘 완료</span><span style="color:#fff;font-size:12px">눌러서 열기</span></div>'}
/** 이수증 칸: 있으면 보기 · 없으면 바로 올리기 */
function certCell(w){return w.certDoc?'<button class="linkbtn" type="button" style="font-size:12px;color:var(--ok)" onclick="certView(\''+escapeText(w.certDoc)+'\',\''+escapeText(w.name)+'\')" aria-label="'+escapeText(w.name)+' 이수증 보기">✔ 보기</button>'
 :'<button class="linkbtn req" type="button" style="font-size:12px" onclick="pickCertFor(\''+escapeText(w.id)+'\')" aria-label="'+escapeText(w.name)+' 이수증 사진 넣기">📷 올리기</button>'}
/** F1.8b ☰ 신규교육 현황: 이 공사에 등록한 전체 명단 · 이수증 놓친 사람 나중에 올리기 · 작업 안전 수칙 서명 기록 */
function eduHtml(v){const W=v.workers.slice().sort((x,y)=>String(y.eduAt||'').localeCompare(String(x.eduAt||''))),ok=W.filter(w=>w.certDoc).length,method=w=>w.method==='SELF'?'본인':'소장';
 const rules=v.history.length?'<details class="hist" style="margin-top:12px"><summary>작업 안전 수칙 서명 기록 '+v.history.length+'일 (등록한 날)</summary>'+v.history.map(h=>'<div class="item"><div class="row" style="justify-content:space-between"><span>'+escapeText(h.date)+' · '+h.count+'명</span><button class="button ghost" type="button" onclick="showRules(\''+escapeText(h.date)+'\')">보기</button></div></div>').join('')+'</details>':'';
 return '<div class="card" id="eduCard"><div class="vh-top"><h2 style="margin:0;font-size:16px">신규교육 현황</h2><span class="pill '+(W.length&&ok===W.length?'ok':'todo')+'">이수증 '+ok+' / '+W.length+'명</span></div>'
  +(W.length?'<table class="rtable" style="margin-top:10px"><tr><th>이름</th><th>구분·공정</th><th style="width:64px">등록일</th><th style="width:76px">이수증</th></tr>'+W.map(w=>'<tr><td><b>'+escapeText(w.name)+'</b><div class="muted" style="font-size:11px">'+method(w)+' 등록 · <button class="linkbtn" type="button" style="font-size:11px" onclick="dropWorker(\''+escapeText(w.id)+'\',\''+escapeText(w.name)+'\')">빼기</button></div></td><td>'+escapeText(w.role)+(w.trade?' · '+escapeText(w.trade):'')+'</td><td>'+escapeText(String(fmtTime(w.eduAt)).slice(5,10))+'</td><td>'+certCell(w)+'</td></tr>').join('')+'</table>'
   :'<p class="muted" style="margin-top:10px">아직 등록한 작업자가 없습니다.</p>')+rules+'</div>'}
/** F1.8a 오늘 현장 업무 순서 안내 (하루 한 번 자동 · ❔ 버튼으로 다시) */
function dayGuide(force){const v=vjob;if(!v||v.jobStatus==='ENDED')return;const key='dayGuide:'+v.today;let seen=false;try{seen=localStorage.getItem(key)==='1'}catch(e){}
 if(!force&&(seen||$('modal').style.display==='flex'||(typeof tour!=='undefined'&&tour)||vmenu!=='today'))return;try{localStorage.setItem(key,'1')}catch(e){}
 startTour('day')}  // F1.8a 화면 따라가기 가이드 (guide.js)
/** F1.8a 오늘 작업 인원 체크 (허가서·점검 화면 공용) · 기본: 오늘 저장한 인원 → 최근 출근 인원 → 전원 */
function crewPickHtml(v,pre,picked){const sel=picked||new Set(v.crewDefault||[]);
 if(!v.workers.length)return '<div class="note">등록된 작업자가 없습니다. ① 신규자 등록을 먼저 하면 여기에 나옵니다. (없어도 제출은 됩니다)</div>';
 return '<div class="row" style="justify-content:space-between;margin:4px 0"><span class="muted">오늘 일하는 사람 체크 = 오늘 작업 안전 수칙 서명</span><button class="linkbtn" type="button" onclick="document.querySelectorAll(\'.'+pre+'ck\').forEach(x=>x.checked=true)">전체 선택</button></div>'
  +v.workers.map(w=>'<label class="wk"><input type="checkbox" class="'+pre+'ck" id="'+pre+'_'+escapeText(w.id)+'" '+(sel.has(w.id)?'checked':'')+'><span><b>'+escapeText(w.name)+'</b> <span class="muted">'+escapeText(w.role)+(w.trade?' · '+escapeText(w.trade):'')+'</span></span></label>').join('')}
function crewPicked(v,pre){if(!v||!$(pre+'_'+((v.workers[0]||{}).id||'x')))return null;return new Set(v.workers.filter(w=>$(pre+'_'+w.id)&&$(pre+'_'+w.id).checked).map(w=>w.id))}
function drillHtml(v){return '<div class="card"><div class="vh-top"><h2 style="margin:0">비상대응훈련</h2><span class="pill todo">공사당 1회 · 미완료</span></div><p class="desc">훈련을 실시한 뒤 결과를 한 번 등록하면 <b>완료</b>로 바뀝니다.</p><div class="note">등록 화면은 다음 단계에서 열립니다.</div></div>'}
function toggleQr(){showQr=!showQr;renderVJob()}
function toggleAdd(){showAdd=!showAdd;renderVJob();if(showAdd)setTimeout(()=>$('f_wName')?.focus(),50)}
function checkAllCrew(){const l=[...document.querySelectorAll('.crewck')],all=l.every(x=>x.checked);l.forEach(x=>x.checked=!all)}
async function renewQr(){if(!confirm('QR을 새로 만들면 이전 QR·링크는 더 이상 쓸 수 없습니다. 새로 만들까요?'))return;try{vjob=await call('renewWorkerQr',vjob.job.id);renderVJob();msg('새 QR을 만들었습니다.')}catch(e){}}
/* v5.24: 서버 등록 성공 영수증을 받으면 즉시 화면에 반영.
 * 전체 공사 조회는 백그라운드 수행해 느린 조회가 등록 확인을 가로막지 않게 한다. */
let workerSubmitting=false,workerPending=null;
function workerApplyReceipt(r,d){
 if(!vjob||!r||!r.saved||!r.workerId||vjob.job.id!==r.jobId)return false;
 const w={id:r.workerId,name:r.name||d.name,role:r.role||d.role,trade:r.trade||d.trade,method:'MANUAL',eduAt:new Date().toISOString(),email:''};
 if(!vjob.workers.some(x=>x.id===w.id))vjob.workers.push(w);
 if(vjob.todayCrew&&Array.isArray(vjob.todayCrew.workers)){
  if(!vjob.todayCrew.workers.some(x=>x.id===w.id))vjob.todayCrew.workers.push({...w,sign:'MANAGER'});
  vjob.todayCrew.count=vjob.todayCrew.workers.length;
 }else{
  vjob.todayCrew={date:r.date,count:1,workers:[{...w,sign:'MANAGER'}],siteManager:vjob.siteManager||'',savedAt:new Date().toISOString()};
 }
 return true;
}
async function addWorkerForm(e){
 e.preventDefault();if(workerSubmitting)return;
 const d={name:value('wName'),role:$('f_wRole').value,trade:value('wTrade'),agree:$('wAgree').checked};
 if(!d.name){markMissing([{key:'wName'}]);return}
 if(!d.agree){msg('교육 실시·서약 확인에 체크해 주세요.');return}
 /* F1.8b 이수증: 있으면 등록 직후 올림 · 없으면 확인 후 '미제출'로 등록 */
 const cf=certPick.wCert;let cert=null;
 if(cf){try{cert=await readFile(cf,PHOTO_DEFAULT)}catch(x){showErr('이수증 사진을 읽지 못했습니다',x);return}}
 else if(!await askOk('이수증 없이 등록할까요?',d.name+' 님의 건설업 기초안전보건교육 이수증이 없으면 "미제출"로 등록됩니다.\n교육 없이 투입된 것으로 보고 업체 평가에 반영됩니다. (나중에 작업자 카드에서 올릴 수 있습니다)','이수증 없이 등록'))return;
 const jobId=vjob.job.id,mark=[jobId,d.name,d.role,d.trade].join('|');
 if(!workerPending||workerPending.mark!==mark){
  const id=(globalThis.crypto&&crypto.randomUUID?crypto.randomUUID().replace(/-/g,''):Array.from({length:32},()=>Math.floor(Math.random()*16).toString(16)).join(''));
  workerPending={mark,id};
 }
 workerSubmitting=true;
 const btn=e.target?.querySelector('button[type=submit]');if(btn){btn.disabled=true;btn.textContent='등록 처리 중…'}
 try{
  const r=await call('addWorker',jobId,d,workerPending.id);
  if(!r?.saved||!r.workerId)throw Error('등록 결과를 확인할 수 없습니다.');
  workerPending=null;certPick.wCert=null;
  workerApplyReceipt(r,d);showAdd=false;renderVJob();
  msg(d.name+' 님이 등록됐습니다.');
  if(cert){try{vjob=await call('uploadWorkerCert',jobId,r.workerId,cert);renderVJob();msg(d.name+' 님 등록 · 이수증까지 올렸습니다.');return}catch(x){showErr('등록은 됐지만 이수증을 올리지 못했습니다',{message:(x.message||'')+'\n작업자 카드의 [이수증 올리기]로 다시 올려 주세요.'})}}
  // 전체 자료 조회는 화면을 가리지 않으며 실패하더라도 방금 완료된 등록을 실패로 처리하지 않는다.
  callQuiet('vendorJob',jobId).then(latest=>{
   if(vjob&&vjob.job.id===jobId&&latest){vjob=latest;renderVJob()}
  }).catch(()=>{});
 }catch(err){
  // 네트워크 장애 시 이미 서버에 저장됐을 수 있다. 같은 요청 ID로만 다시 시도할 수 있게 유지.
  msg('등록 결과를 확인하지 못했습니다. 같은 작업자를 다시 추가하기 전에 명단을 확인해 주세요.');
  // 재확인은 화면을 막지 않음. 등록 ID가 확인될 때만 완료 처리.
  const rid='WK-'+workerPending.id.slice(0,16).toUpperCase();
  callQuiet('vendorJob',jobId).then(latest=>{
   if(!latest||!vjob||vjob.job.id!==jobId)return;
   vjob=latest;
   if((latest.workers||[]).some(w=>w.id===rid)){
    workerPending=null;showAdd=false;renderVJob();msg(d.name+' 님이 등록된 것을 확인했습니다.');
   }
  }).catch(()=>{});
 }finally{workerSubmitting=false;if(btn&&btn.isConnected){btn.disabled=false;btn.textContent='작업자 등록'}}
}
async function dropWorker(id,name){if(!confirm(name+' 님을 작업자 명단에서 뺄까요? (지난 기록은 남습니다)'))return;try{vjob=await call('removeWorker',vjob.job.id,id);renderVJob()}catch(e){}}
async function saveCrewForm(e){e.preventDefault();const ids=[...document.querySelectorAll('.crewck:checked')].map(x=>x.value),sm=value('crewSm');if(!sm){markMissing([{key:'crewSm'}]);return}if(!ids.length){alert('오늘 일하는 사람을 한 명 이상 체크해 주세요.');return}if(!confirm('오늘 작업 인원 '+ids.length+'명을 저장할까요?\n저장하면 오늘 작업 안전 수칙 서명으로 기록됩니다.'))return;try{vjob=await call('saveCrew',vjob.job.id,ids,sm);renderVJob();msg('오늘 작업 인원 '+ids.length+'명을 저장했습니다.');$('crewCard')?.scrollIntoView({block:'start'})}catch(err){}}
/** 작업 안전 수칙 (현업 양식 모양 그대로, 날짜별) */
function showRules(date){const v=vjob,h=v.history.find(x=>x.date===date)||v.todayCrew;if(!h)return;clearInterval(wkTimer);const [y,m,d]=date.split('-');
 $('execArea').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="renderVJob()">← 돌아가기</button></div><div class="card sheet"><h2 class="sheet-t">작 업 안 전 수 칙</h2><div class="sheet-s">(매일1회)</div><ol class="rules">'+v.rules.map(r=>'<li>'+escapeText(r)+'</li>').join('')+'</ol><p class="pledge">'+escapeText(v.pledge)+'</p>'
 +'<div class="sheet-d">'+escapeText(y)+' 년 '+Number(m)+' 월 '+Number(d)+' 일</div><table class="rtable"><tr><th>현장명</th><td colspan="2">다이소 '+escapeText(v.job.storeName)+'</td></tr><tr><th>현장책임자</th><td colspan="2">'+escapeText(h.siteManager)+'</td></tr><tr><th>작업자<br>'+h.count+'명</th><th>공정명</th><th>이름 · 서명</th></tr>'
 +h.workers.map(w=>'<tr><td></td><td>'+escapeText(w.trade||'')+'</td><td><b>'+escapeText(w.name)+'</b> <span class="sg">'+escapeText(SIGN_LABEL[w.sign]||'✔')+'</span></td></tr>').join('')+'</table><p class="muted" style="margin-top:8px">본인 계정 서명: 처음 등록한 날 본인 Google 계정으로 서명 · 소장 확인: 업체 대표 계정으로 그날 출근을 확인 · 저장 '+escapeText(fmtTime(h.savedAt))+'</p></div>';window.scrollTo(0,0)}
/* ---------- v3.1 작업자 등록 QR로 들어온 계정 ---------- */
async function wkCheckIn(info){const token=LINK_REVIEW.slice(4);try{const r=await call('workerCheckIn',token,info||null);if(r&&r.email&&state){state.email=r.email;$('identity').textContent='접속 계정: '+r.email}showWk(r)}catch(e){$('my').innerHTML='<div class="card"><h2>작업자 등록 실패</h2><p class="desc">'+escapeText(e.message||'')+'</p></div>'}$('pageTitle').textContent='작업자 등록';window.scrollTo(0,0)}
function showWk(r){const head='<div class="card"><small class="muted">'+escapeText(r.store)+' · '+escapeText(r.company)+' ('+escapeText(r.trade)+')</small><h2>작업자 등록 · 신규자 교육</h2>';let body='';
 if(r.state==='DONE')body='<div style="text-align:center;padding:10px 0"><div style="font-size:44px;color:var(--ok)">✔</div><h2 style="color:var(--ok)">'+(r.again?'이미 등록되어 있습니다':'등록 완료')+'</h2><p class="desc"><b>'+escapeText(r.name)+'</b> · '+escapeText(r.role)+' · '+escapeText(r.company)+'<br>교육 확인 '+escapeText(fmtTime(r.eduAt))+' · 계정 '+escapeText(state.email)+(r.again?'':'<br>기초안전보건교육 이수증: '+(r.cert?'<b style="color:var(--ok)">✔ 제출</b>':'<b class="req">미제출</b> (소장님께 이수증을 보여 주세요)'))+'</p><div class="note" style="text-align:left">이 공사에서는 다시 QR을 찍지 않아도 됩니다.<br>내일부터는 소장님이 출근 인원을 체크합니다.</div></div>';
 else body='<p class="desc">로그인 계정 <b>'+escapeText(state.email)+'</b> 으로 등록합니다. <b>본인 계정</b>인지 확인해 주세요. 이 공사에서 처음 한 번만 하면 됩니다. <button class="linkbtn" type="button" onclick="relogin()">다른 계정으로 로그인</button></p><form onsubmit="sendWk(event)">'+input('kName','이름','','text',false,'예: 홍길동')+'<div class="split"><div class="field"><label for="f_kRole">구분</label><select id="f_kRole">'+r.roles.map(x=>'<option '+(x==='근로자'?'selected':'')+'>'+escapeText(x)+'</option>').join('')+'</select></div>'+input('kTrade','공정명 (선택)','','text',false,'예: 목공, 전기')+'</div>'
  +certFieldHtml('kCert')
  +'<div class="stage">작업 안전 수칙 (끝까지 읽어 주세요)</div><ol class="rules boxed">'+r.rules.map(x=>'<li>'+escapeText(x)+'</li>').join('')+'</ol><p class="pledge">'+escapeText(r.pledge)+'</p><label class="wk"><input type="checkbox" id="kAgree"><span>위 작업 안전 수칙을 교육받았고, 준수할 것을 서약합니다.</span></label><button class="button" style="width:100%;margin-top:10px" type="submit">교육 확인 및 서명</button></form>';
 $('my').innerHTML=head+body+'</div>'}
async function sendWk(e){e.preventDefault();const info={name:value('kName'),role:$('f_kRole').value,trade:value('kTrade'),agree:$('kAgree').checked};if(!info.name){markMissing([{key:'kName'}]);return}if(!info.agree){popup('확인해 주세요','작업 안전 수칙 교육 확인·서약에 체크해 주세요.','확인');return}
 // F1.8b 기초안전보건교육 이수증 (없으면 '미제출'로 등록 · 소장님이 나중에 올릴 수 있음)
 const cf=certPick.kCert;if(cf){try{info.cert=await readFile(cf,PHOTO_DEFAULT)}catch(x){showErr('이수증 사진을 읽지 못했습니다',x);return}}
 else if(!await askOk('이수증 없이 등록할까요?','건설업 기초안전보건교육 이수증이 없으면 "미제출"로 등록됩니다.\n교육을 받지 않고 투입된 것으로 보고 업체 평가에 반영됩니다.\n\n이수증을 가져왔으면 [취소]를 누르고 사진을 찍어 주세요.','이수증 없이 등록'))return;
 await wkCheckIn(info);certPick.kCert=null}
/* F1.8c 사진 넣기: 아래에서 올라오는 창 [📷 촬영] [🖼 앨범·파일] (뒤 화면은 어둡게) → 고른 파일을 cb로 */
function pickPhoto(cb,opt){opt=opt||{};closePick();
 if(!$('pickCss')){const s=document.createElement('style');s.id='pickCss';s.textContent='@keyframes pickUp{from{transform:translateY(100%)}to{transform:none}}#pickSheet .pk{animation:pickUp .22s ease-out}@media (prefers-reduced-motion:reduce){#pickSheet .pk{animation:none}}';document.head.appendChild(s)}
 const bg=document.createElement('div');bg.id='pickSheet';bg.setAttribute('role','dialog');bg.setAttribute('aria-modal','true');bg.setAttribute('aria-label',opt.title||'사진 넣기');
 bg.style.cssText='position:fixed;inset:0;z-index:66;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center';
 bg.innerHTML='<div class="pk" style="background:#fff;width:100%;max-width:520px;border-radius:16px 16px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom))"><b style="display:block;margin-bottom:12px;font-size:15px">'+escapeText(opt.title||'사진 넣기')+'</b>'
  +'<div style="display:grid;gap:8px"><button class="button" type="button" id="pkCam">📷 촬영</button><button class="button ghost" type="button" id="pkGal">🖼 앨범 · 파일</button><button class="button ghost" type="button" id="pkNo">취소</button></div></div>';
 document.body.appendChild(bg);
 const run=cap=>{const i=document.createElement('input');i.type='file';i.accept=opt.accept||'image/*';i.dataset.gal='1';if(cap)i.setAttribute('capture','environment');i.style.display='none';
  i.onchange=()=>{const f=i.files&&i.files[0];i.remove();if(f)cb(f)};document.body.appendChild(i);closePick();i.click()};
 $('pkCam').onclick=()=>run(true);$('pkGal').onclick=()=>run(false);$('pkNo').onclick=closePick;bg.onclick=e=>{if(e.target===bg)closePick()};bg.onkeydown=e=>{if(e.key==='Escape')closePick()};setTimeout(()=>$('pkCam')?.focus(),30)}
function closePick(){$('pickSheet')?.remove()}
/** F1.8b·c 이수증 사진 칸 (본인 등록·소장 직접 등록 공용): 제목 | 📷 버튼 → 촬영·앨범 창 · 고른 사진은 certPick에 보관 */
const certPick={};
function certFieldHtml(id){return '<div class="field" id="'+id+'Box"><div class="row" style="justify-content:space-between;align-items:center;gap:8px;flex-wrap:nowrap"><span style="font-size:14px"><b>건설업 기초안전보건교육 이수증 사진</b> <span class="req">*</span></span>'
 +'<button class="button ghost" type="button" id="'+id+'Btn" style="padding:8px 14px;font-size:18px;flex:none" onclick="pickCert(\''+id+'\')" aria-label="이수증 사진 넣기 (촬영 또는 앨범)">📷</button></div>'
 +'<div id="'+id+'Prev" style="font-size:12px;margin-top:4px">'+certPrev(id)+'</div><p class="muted" style="font-size:11px;margin:4px 0 0">이름·생년월일은 교육 이수 확인에만 쓰이며 다이소 담당자와 소속 업체만 봅니다.</p></div>'}
function certPrev(id){const f=certPick[id];return f?'<span style="color:var(--ok)">✔ '+escapeText(f.name||'사진')+'</span> <button class="linkbtn" type="button" onclick="certDrop(\''+id+'\')">빼기</button>':'<span class="muted">없으면 "미제출"로 등록되고 업체 평가에 반영됩니다.</span>'}
function certDrop(id){certPick[id]=null;const p=$(id+'Prev');if(p)p.innerHTML=certPrev(id)}
function pickCert(id){pickPhoto(f=>{certPick[id]=f;const p=$(id+'Prev');if(p)p.innerHTML=certPrev(id)},{title:'이수증 사진 넣기',accept:'image/*,.pdf'})}
/** F1.8b [업체] 작업자 이수증 올리기 (오늘 등록 표 · 신규교육 현황) */
function pickCertFor(wid){const w=vjob&&vjob.workers.find(x=>x.id===wid);pickPhoto(f=>uploadCertFile(wid,f),{title:(w?w.name+' 님 ':'')+'이수증 사진 넣기',accept:'image/*,.pdf'})}
async function uploadCertFile(wid,f0){const w=vjob.workers.find(x=>x.id===wid);
 try{const f=await readFile(f0,PHOTO_DEFAULT);vjob=await call('uploadWorkerCert',vjob.job.id,wid,f);const y=window.scrollY;renderVJob();window.scrollTo(0,y);msg((w?w.name+' 님 ':'')+'이수증을 올렸습니다.')}catch(e){showErr('이수증을 올리지 못했습니다',e)}}
async function uploadCertFor(wid){const inp=$('wc_'+wid),f0=inp&&inp.files[0];if(f0)await uploadCertFile(wid,f0)}
/** F1.8c 잘못 누른 것 되돌리기 */
async function undoWorker(wid){const w=vjob.workers.find(x=>x.id===wid);if(!w)return;
 if(!await askOk('등록 취소',w.name+' 님 등록을 취소할까요?\n신규자 교육일지와 오늘 작업 안전 수칙 서명에서도 빠집니다. (잘못 등록했을 때만)','등록 취소'))return;
 try{vjob=await call('undoWorker',vjob.job.id,wid);const y=window.scrollY;renderVJob();window.scrollTo(0,y);msg(w.name+' 님 등록을 취소했습니다.')}catch(e){showErr('등록을 취소하지 못했습니다',e)}}
function clearNoNew(){try{localStorage.removeItem(noNewKey(vjob))}catch(e){}const y=window.scrollY;renderVJob();window.scrollTo(0,y);msg('[오늘 신규자 없음]을 취소했습니다.')}
async function cancelInspToday(){if(!await askOk('순회점검 제출 취소','오늘 낸 순회점검을 취소하고 다시 작성할까요?\n오늘 점검일지와 지적사항이 지워집니다. (도급인 확인 전에만)','제출 취소'))return;
 try{vjob=await call('cancelInspection',vjob.job.id);renderVJob();$('inspCard')?.scrollIntoView({block:'start'});msg('순회점검 제출을 취소했습니다. 다시 작성해 주세요.')}catch(e){showErr('제출을 취소하지 못했습니다',e)}}
/* ---------- v2.8 직원 관리 (안전보건팀) ---------- */
let staffData=null;
async function loadStaff(){const old=staffData?JSON.stringify(staffData):'';if(staffData)renderStaff();try{const x=await fetcher('staff')('staffList');staffData=x;if(tab==='staff'&&JSON.stringify(x)!==old)renderStaff()}catch(e){}}
async function delStaff(row,name){if(!confirm(name+' 님을 직원 명단에서 삭제할까요?\n(잠시 막기만 하려면 [수정] → 사용중지를 쓰세요)'))return;try{staffData=await call('deleteStaff',row);renderStaff();msg('삭제했습니다.')}catch(e){}}
function staffForm(x){x=x||{role:'CLIENT',active:'Y'};const r=staffData.roles;return '<form onsubmit="saveStaffForm(event,'+(x.row||0)+')"><div class="split">'+input('sName','이름',x.name)+input('sDept','부서',x.dept,'text',false,'예: 신축팀')+input('sLogin','로그인 Gmail (개인 Google 계정)',x.loginEmail,'email',false,'예: name@gmail.com')+input('sCompany','회사메일 (알림용, 선택)',x.companyEmail,'email',false,'예: name@daiso.co.kr')+'</div><div class="split"><div class="field"><label for="f_sRole">역할</label><select id="f_sRole">'+Object.entries(r).map(([k,v])=>'<option value="'+k+'" '+(x.role===k?'selected':'')+'>'+escapeText(v)+'</option>').join('')+'</select></div><div class="field"><label for="f_sActive">사용 여부</label><select id="f_sActive"><option value="Y" '+(x.active!=='N'?'selected':'')+'>사용</option><option value="N" '+(x.active==='N'?'selected':'')+'>사용중지</option></select></div></div><div class="row"><button class="button" type="submit">'+(x.row?'수정 저장':'직원 추가')+'</button>'+(x.row?'<button class="button ghost" type="button" onclick="renderStaff()">취소</button>':'')+'</div></form>'}
function renderStaff(editRow){const d=staffData;const ed=editRow?d.list.find(x=>x.row===editRow):null;$('staff').innerHTML=(state&&state.isMaster?'<div class="card"><div class="vh-top"><h2 style="margin:0">⚙ 마스터 설정</h2><span class="pill ok">마스터</span></div><p class="desc">마스터 계정 <b>'+escapeText(state.email)+'</b> 은(는) 직원 명단과 상관없이 항상 안전보건팀 권한으로 들어옵니다.<br>아래에서 직원 추가·수정·사용중지를 할 수 있습니다.</p></div>':'')+'<div class="card"><h2>'+(ed?'직원 수정':'직원 추가')+'</h2><p class="desc">로그인은 <b>개인 Google 계정(Gmail)</b>으로 합니다. 회사메일은 알림·승인 링크 받는 용도입니다.<br>퇴사·이동 시 반드시 <b>사용중지</b>로 바꿔 주세요.</p>'+staffForm(ed)+'</div><div class="card"><h2>직원 명단 '+d.list.length+'명</h2>'+d.list.map(x=>'<div class="item"><div class="row" style="justify-content:space-between"><div><b>'+escapeText(x.name)+'</b> <span class="pill '+(x.role==='SAFETY'?'ok':'lock')+'">'+escapeText(d.roles[x.role]||x.role)+'</span>'+(x.active==='N'?' <span class="pill todo">사용중지</span>':'')+'<div class="muted">'+escapeText(x.dept||'')+' · 로그인 '+escapeText(x.loginEmail)+(x.companyEmail?' · 회사 '+escapeText(x.companyEmail):'')+(x.loginEmail===d.me?' · <b>나</b>':'')+'</div></div><div class="row"><button class="button ghost" type="button" onclick="renderStaff('+x.row+')">수정</button>'+(x.loginEmail===d.me?'':'<button class="button ghost danger" type="button" onclick="delStaff('+x.row+',\''+escapeText(x.name)+'\')">삭제</button>')+'</div></div></div>').join('')+'</div>';if(ed)window.scrollTo(0,0)}
async function saveStaffForm(e,row){e.preventDefault();const d={row,name:value('sName'),dept:value('sDept'),loginEmail:value('sLogin'),companyEmail:value('sCompany'),role:$('f_sRole').value,active:$('f_sActive').value};try{staffData=await call('saveStaff',d);renderStaff();msg('저장했습니다.')}catch(err){}}
/** 휴대폰 사진(1.5MB 초과)은 긴 변 2000px JPEG로 줄여서 올림 */
/* F1.6b 일부 휴대폰 카메라는 찍은 사진의 파일 종류(image/jpeg)를 비워서 줌 → 예전에는 사진으로 못 알아봐 "사진만 올릴 수 있습니다"로 막힘
 *  → 종류가 비었거나 이름이 사진이면 일단 사진으로 열어 보고, 열리면 JPEG로 다시 만듦 (HEIC·WEBP도 JPEG로) */
function shrinkImage(f,o){o=o||{};const MX=o.max||2000,Q=o.q||0.82,t=String(f.type||'').toLowerCase(),okType=/^image\/(jpeg|png)$/.test(t);
 const maybe=!t||t==='application/octet-stream'||/^image\//.test(t)||/\.(jpe?g|png|heic|heif|webp)$/i.test(f.name||'');
 return new Promise(res0=>{if(!maybe||(!o.max&&okType&&f.size<=1.5*1024*1024))return res0(f);const url=URL.createObjectURL(f),img=new Image();
  /* F1.7f 일부 휴대폰·앱 안 브라우저는 사진을 열다가 아무 응답이 없음 → 15초 지나면 원본 그대로 (예전: 끝없이 멈춤) */
  let done=false;const res=x=>{if(done)return;done=true;clearTimeout(tm);res0(x)},tm=setTimeout(()=>{try{URL.revokeObjectURL(url)}catch(e){}res(f)},15000);
  img.onload=()=>{const s=Math.min(1,MX/Math.max(img.width,img.height)),cv=document.createElement('canvas');cv.width=Math.round(img.width*s);cv.height=Math.round(img.height*s);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);URL.revokeObjectURL(url);
   const base=(String(f.name||'').replace(/\.[^.]+$/,'')||'photo_'+Date.now());
   cv.toBlob(b=>res(b&&(!okType||b.size<f.size)?new File([b],base+'.jpg',{type:'image/jpeg'}):f),'image/jpeg',Q)};
  img.onerror=()=>{URL.revokeObjectURL(url);res(f)};img.src=url})}
const MAX_MB=10;
/* F1.7 사진 용량 최소화: 사진은 크기와 상관없이 항상 줄여서 올림 (긴 변 1280px · 화질 0.55 → 보통 100~250KB)
 *  현장 사진(순회점검·합동점검·조치 후)은 화면에서 더 작게 지정 (긴 변 1024px · 0.5 → 보통 80~150KB) · PDF·문서 파일은 그대로 */
const PHOTO_DEFAULT={max:1280,q:0.55},PHOTO_SITE={max:1024,q:0.5};
async function readFile(f0,o){if(!f0)throw Error('파일을 선택해 주세요.');const f=await shrinkImage(f0,o||PHOTO_DEFAULT);return new Promise((res,rej)=>{if(f.size>MAX_MB*1024*1024)return rej(Error('파일은 '+MAX_MB+'MB 이하만 올릴 수 있습니다. (현재 '+(f.size/1048576).toFixed(1)+'MB)'));const ext=(String(f.name||'').match(/\.(jpe?g|png|pdf)$/i)||[])[1],guess=ext?({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',pdf:'application/pdf'})[ext.toLowerCase()]:'';const r=new FileReader();r.onload=()=>res({name:f.name||('photo_'+Date.now()+'.jpg'),mime:f.type||guess||'application/octet-stream',data:r.result.split(',')[1]});r.onerror=()=>rej(Error('파일을 읽을 수 없습니다.'));r.readAsDataURL(f)})}
async function register(e){e.preventDefault();try{const fields=['company','regNo','representative','address','contact','phone','approverEmail','industry'];const d=Object.fromEntries(fields.map(n=>[n,value(n)]));d.agree=$('agree').checked;const picked=$('cert').files[0];let f=null;if(picked)f=await readFile(picked);else if(!state.testSkipFiles)throw Error('사업자등록증을 첨부해 주세요.');if(!confirm(f?'입력한 정보로 신청하시겠습니까?':'[테스트 모드] 사업자등록증 없이 신청할까요?\n(운영 시에는 첨부가 필수입니다)'))return;display(await call('registerBusiness',d,f));msg('사업자 등록 신청이 접수됐습니다.')}catch(e){alert(e.message)}}
async function otp(e){e.preventDefault();try{display(await call('verifyOtp',value('otp')));msg('업체 이메일 인증 완료')}catch(e){}}
function changed(){if(!state?.company||['SUBMITTED','SAFETY_REVIEW','APPROVED'].includes(state.company.submissionStatus))return;dirty=true;$('saved').textContent='변경사항 있음 · 잠시 후 자동저장';clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(false),1700)}
function stepValues(){const d={},fields=state.fields[activeStep]||[];for(const [k] of fields){const n=$('f_'+k);if(n&&!n.disabled)d[k]=value(k);}if(activeStep===3){for(let i=1;i<=2;i++){const k='industry'+i;if($('f_'+k)&&!$('f_'+k).disabled)d[k]=value(k)}}return d}
async function save(manual=true){clearTimeout(saveTimer);if(!dirty&&!manual)return true;const n=activeStep,d=stepValues();if(!Object.keys(d).length)return true;try{const next=await (manual?call:callQuiet)('saveStep',n,d);dirty=false;const currently=activeStep;state=next;if(currently===activeStep){const s=$('saved');if(s)s.textContent='서버 저장 완료 · '+new Date().toLocaleTimeString('ko-KR')}if(manual)msg('임시저장 완료');return true}catch(e){const s=$('saved');if(s)s.textContent='저장 실패 · 다시 시도하세요';return false}}
async function saveManual(e){e.preventDefault();await save(true)}
async function goStep(n){if(dirty){if(!await save(false))return}activeStep=n;renderMy()}
async function upload(){try{const f=await readFile($('evidence').files[0]);display(await call('uploadEvidence',f));msg('파일 첨부 완료')}catch(e){alert(e.message)}}
/** F1.4 파일 열기: 서버가 주소(url)를 주면 구글 드라이브 화면으로 바로 열고(빠름), 내용(data)을 주면 예전처럼 내려받기
 *  새 창이 막히면(휴대폰 팝업 차단) 안내 창의 [열기] 버튼으로 다시 열기 */
function openFile(f){if(!f)return;if(!f.url){saveBlob(f);return}const w=window.open(f.url,'_blank');if(!w)popup('파일 열기',(f.name||'파일')+'\n\n구글 드라이브 화면으로 엽니다.\n'+(f.email?'('+f.email+' 계정으로 보기 권한이 있습니다)':''),'열기',()=>window.open(f.url,'_blank'))}
/* F1.8j 업체가 올리거나 만든 서류 보기: 구글 드라이브로 가지 않고 화면 안 창 (이미지 바로 · PDF는 창 안 미리보기 + 열기) */
const fileMem={};
async function viewFile(id){let f=fileMem[id];if(!f){try{f=await call('getMyFile',id)}catch(e){return}if(f&&f.data)fileMem[id]=f}if(!f)return;if(!f.data){openFile(f);return}fileShow(f,f.name||'')}
/* F1.8g 이수증 보기: 구글 드라이브로 가지 않고 화면 안 창에 이미지만 (한 번 본 것은 다시 받지 않음) */
const certMem={};
async function certView(id,who){let f=certMem[id];if(!f){try{f=certMem[id]=await call('viewCert',id)}catch(e){return}}fileShow(f,(who||'')+' 이수증')}
const b64Blob=f=>{const s=atob(f.data),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return new Blob([u],{type:f.mime||'application/octet-stream'})};
/** 화면 안 파일 보기 창 (이미지 · PDF) · PDF는 [열기]를 누르면 휴대폰 PDF 보기로 (드라이브 아님) */
function fileShow(f,title){closeCert();const pdf=/pdf/.test(f.mime||''),img=/^image\//.test(f.mime||''),url=URL.createObjectURL(b64Blob(f));
 const bg=document.createElement('div');bg.id='certDlg';bg.className='certbg';bg.setAttribute('role','dialog');bg.setAttribute('aria-modal','true');bg.setAttribute('aria-label',title||'파일 보기');
 bg.innerHTML='<div class="certtop"><b style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeText(title||'')+'</b><button class="certx" type="button" id="certClose" aria-label="닫기">✕</button></div>'
  +'<div class="certbody">'+(img?'<img src="'+url+'" alt="'+escapeText(title||'')+'">':pdf&&!IS_IOS&&!IS_AND?'<iframe src="'+url+'" title="'+escapeText(title||'')+'" style="width:100%;height:100%;border:0;background:#fff;border-radius:6px"></iframe>':'<div class="certpdf"><p>'+escapeText(f.name||'파일')+'</p><button class="button" type="button" id="certSave" style="width:100%">📄 '+(pdf?'PDF 열기':'파일 받기')+'</button></div>')+'</div>';
 document.body.appendChild(bg);bg._url=url;$('certClose').onclick=closeCert;bg.onclick=e=>{if(e.target===bg||e.target.classList.contains('certbody'))closeCert()};bg.onkeydown=e=>{if(e.key==='Escape')closeCert()};
 if($('certSave'))$('certSave').onclick=()=>{if(pdf&&window.open(url,'_blank'))return;saveBlob(f)};setTimeout(()=>$('certClose')?.focus(),30)}
/** F1.8k 위임장 · 현장대리인계 보기 (서버가 만든 양식 · 화면 안 창 · 인쇄 가능) */
const PAPER_T={COUNCIL:'산업안전보건 협의체 위임장',JOINT:'합동안전보건점검 위임장',AGENT:'현장대리인계'};
async function jobPaperView(jobId,kind,cid){let r;try{r=await call('jobPaper',jobId,kind,cid||'')}catch(e){return}closeCert();
 const bg=document.createElement('div');bg.id='certDlg';bg.className='certbg';bg.setAttribute('role','dialog');bg.setAttribute('aria-modal','true');bg.setAttribute('aria-label',PAPER_T[kind]||'서류');
 bg.innerHTML='<div class="certtop"><b>'+escapeText(PAPER_T[kind]||'서류')+'</b><span><button class="certx" type="button" id="paperPrint" aria-label="인쇄" style="margin-right:8px">🖨</button><button class="certx" type="button" id="certClose" aria-label="닫기">✕</button></span></div><div class="certbody"><iframe id="paperFrame" title="'+escapeText(PAPER_T[kind]||'서류')+'" style="width:100%;height:100%;border:0;background:#fff;border-radius:6px"></iframe></div>';
 document.body.appendChild(bg);$('paperFrame').srcdoc=r.html;$('certClose').onclick=closeCert;bg.onkeydown=e=>{if(e.key==='Escape')closeCert()};
 $('paperPrint').onclick=()=>{try{$('paperFrame').contentWindow.print()}catch(e){msg('인쇄하지 못했습니다.')}};setTimeout(()=>$('certClose')?.focus(),30)}
function closeCert(){const d=$('certDlg');if(!d)return;const u=d._url;d.remove();if(u)setTimeout(()=>URL.revokeObjectURL(u),60000)}
/* F1.4 휴대폰에서 사진 칸을 누르면 카메라만 열리던 것(capture) → 옆에 [🖼 앨범·파일] 버튼을 자동으로 붙임
 *  고른 사진은 원래 사진 칸에 넣고 원래 처리(올리기)를 그대로 실행. 화면을 다시 그려도 계속 붙음 */
(function(){
 function addGallery(inp){if(inp.dataset.gal||!inp.id)return;inp.dataset.gal='1';
  const g=document.createElement('input');g.type='file';g.className='hidefile';g.id=inp.id+'_gal';g.accept=inp.accept||'image/*';g.multiple=true;/* F1.6b 여러 장 한 번에 */g.disabled=inp.disabled;g.setAttribute('aria-label',(inp.getAttribute('aria-label')||'사진')+' (앨범·파일에서 고르기, 여러 장 가능)');
  const lb=document.createElement('label');lb.className='button ghost';lb.htmlFor=g.id;lb.textContent='🖼 앨범·파일';
  g.addEventListener('change',()=>{if(!g.files.length)return;try{const dt=new DataTransfer();Array.from(g.files).forEach(f=>dt.items.add(f));inp.files=dt.files}catch(e){g.value='';msg('이 브라우저에서는 앨범에서 고르기가 안 됩니다. 크롬·사파리로 열어 주세요.');return}
   g.value='';inp.dispatchEvent(new Event('change',{bubbles:true}))});
  const cam=document.querySelector('label[for="'+CSS.escape(inp.id)+'"]');if(cam&&/^📷 (사진 넣기)?$/.test(cam.textContent.trim()))cam.textContent='📷 촬영';
  inp.after(lb,g)}
 const scan=()=>document.querySelectorAll('input[type=file][capture]').forEach(addGallery);
 new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});scan();
})();
function localMissing(){const data=((state.steps||[]).find(x=>Number(x.step)===1)||{}).data||{},m=[];
 if(state.company&&state.company.renewAt&&!state.company.infoFresh)m.push({key:'bRep'});  // v5.17 처음부터 새로 작성: 사업자 정보 저장 필요
 (state.fields[1]||[]).forEach(([k])=>{if(k==='note')return;const el=$('f_'+k),v=el&&!el.disabled?el.value.trim():String(data[k]||'').trim();if(!v)m.push({key:k})});
 if(!state.testSkipFiles)renewRows((state.docBoard&&state.docBoard.rows)||[]).filter(r=>r.stage==='CONTRACT'&&r.vendorDoc&&r.required&&!r.uploads.length).forEach(r=>m.push({key:'doc'+r.code}));return m}
async function submitAll(){const miss=localMissing();if(miss.length){markMissing(miss);msg(/^doc/.test(miss[0].key)?'제출 서류를 먼저 작성해 주세요':'빨간 칸을 채워 주세요');return}
 if(!confirm('제출할까요?\n제출하면 검토가 끝날 때까지 수정할 수 없습니다.'))return;if(dirty&&!await save(false))return;
 try{const r=await call('submitProfile');if(r.ok){display(r.portal||await call('portalData'));msg('제출했습니다. 본사 담당자가 검토합니다.')}/* v5.18 서버가 화면도 같이 줌 */else{markMissing(r.missing||[]);msg('빈 항목이 있습니다.')}}catch(e){}}
async function loadAdmin(){try{const a=await fetcher('admin')('applications');$('admin').innerHTML=`<div class="card"><h2>사업자 등록 신청 관리</h2><p class="desc">업체가 본인을 승인 담당자로 지정한 신청이 표시됩니다(관리자는 전체). 승인하면 업체 화면이 바로 작성 단계로 넘어갑니다.</p>${a.map(b=>`<div class="item" id="biz-${escapeText(b.id)}"><b>${escapeText(b.company)}</b> <span class="badge">${escapeText(b.status)}</span> ${b.duplicate==='Y'?'<span class="badge">중복 검토</span>':''}${b.certMissing?'<span class="pill todo">등록증 미첨부(테스트)</span>':''}<div class="desc">${escapeText(b.industry)} / ${escapeText(b.regNo)}<br>대표자 ${escapeText(b.representative)} / 담당자 ${escapeText(b.contact)}<br>주소 ${escapeText(b.address)}<br>업체 계정 ${escapeText(b.email||'')} · 지정 승인 담당자 ${escapeText(b.approverEmail||'(지정 없음)')}</div>${b.status==='PENDING'?`<div class="row">${b.certMissing?'':`<button class="button ghost" onclick="registrationDocs('${escapeText(b.id)}')">사업자등록증 확인</button>`}<button class="button" onclick="decide('${escapeText(b.id)}','APPROVE')">승인</button><button class="button ghost" onclick="decide('${escapeText(b.id)}','REJECT')">반려</button></div>`:''}</div>`).join('')||'<p>신청 내역이 없습니다.</p>'}</div>`;if(LINK_REVIEW){setTimeout(()=>$('biz-'+LINK_REVIEW)?.scrollIntoView({block:'center'}),100)}}catch(e){}}
async function decide(id,decision){const reason=decision==='REJECT'?prompt('반려 사유를 입력하세요.'):'';if(decision==='REJECT'&&reason===null)return;if(!confirm(decision==='APPROVE'?'해당 업체를 승인할까요?\n승인하면 업체는 바로 안전보건정보 작성을 시작할 수 있습니다.':'해당 업체를 반려할까요?'))return;try{await call('decideBusiness',id,decision,reason);msg('처리했습니다.');loadAdmin()}catch(e){}}
async function resend(id){if(!confirm('새 인증번호를 보내겠습니까?'))return;try{await call('resendOtp',id);msg('재발송했습니다.');loadAdmin()}catch(e){}}
async function registrationDocs(id){try{const files=await call('getRegistrationDocs',id);if(!files.length){msg('첨부된 파일이 없습니다.');return;}for(const file of files)await downloadAdminFile(id,file.id)}catch(e){}}
async function downloadAdminFile(id,doc){try{openFile(await call('getInternalFile',id,doc))}catch(e){}}
async function loadReview(){try{const a=await fetcher('review')('reviewList');$('review').innerHTML=`<div class="card"><h2>안전보건정보 제출·검토</h2>${a.map(b=>`<div class="item"><b>${escapeText(b.company)}</b> · <span class="badge">${escapeText(b.submissionStatus)}</span><div class="desc">${escapeText(b.industry)}</div><button class="button ghost" onclick="openReview('${escapeText(b.id)}')">제출 정보 확인</button></div>`).join('')}</div><div id="reviewDetail"></div>`}catch(e){}}
async function openReview(id){try{reviewing=await call('getReviewData',id);const b=reviewing.company;$('reviewDetail').innerHTML=`<div class="card"><h2>${escapeText(b.company)} · 제출 내용</h2>${reviewing.steps.map(s=>`<div class="item"><b>${escapeText(state.stepNames[Number(s.step)-1])}</b>${Object.entries(s.data).map(([k,v])=>`<p class="desc">${escapeText(k)}: ${escapeText(v)}</p>`).join('')}</div>`).join('')}<div class="line"></div><div class="desc">증빙: ${reviewing.documents.map(f=>`<a onclick="downloadAdminFile('${escapeText(b.id)}','${escapeText(f.id)}')">${escapeText(f.name)}</a>`).join(' / ')}</div><div class="line"></div><b>계약 단계 제출서류</b>${(reviewing.docSubmissions||[]).map(t=>`<div class="item"><b>${escapeText(t.name)}</b>${t.required?'<span class="badge" style="margin-left:6px">필수</span>':''}${t.uploads.length?`<span class="pill ok">v${escapeText(t.uploads[0].version)}</span>`:'<span class="pill todo">미등록</span>'} <span class="muted">보완키 4:doc${escapeText(t.code)}</span><div class="desc">${t.uploads.map(u=>`<a onclick="downloadAdminFile('${escapeText(b.id)}','${escapeText(u.id)}')">v${escapeText(u.version)} ${escapeText(u.name)}</a> <span class="muted">${escapeText(fmtTime(u.uploadedAt))}</span>`).join('<br>')||'등록된 파일 없음'}</div></div>`).join('')||'<p class="desc">설정된 제출서류가 없습니다.</p>'}<p>보완 요청(단계:항목명 형식, 예: 2:safetyManager, 서류는 4:docC01, 쉼표로 구분)</p><input id="corKeys" placeholder="2:safetyManager,3:riskFactors" style="padding:12px;width:100%"><textarea id="corReason" style="margin:9px 0;width:100%;min-height:70px;padding:10px" placeholder="보완 요청 사유"></textarea><div class="row"><button class="button ghost" onclick="reviewIt('${escapeText(b.id)}','CORRECT')">보완 요청</button><button class="button dark" onclick="reviewIt('${escapeText(b.id)}','CONTRACT_OK')">계약담당 1차 확인 완료</button><button class="button" onclick="reviewIt('${escapeText(b.id)}','SAFETY_OK')">안전보건팀 최종 승인</button></div><p class="desc">실제 법정 적격성 배점과 PDF 출력은 후속 모듈로 별도 개발됩니다. 이 버튼은 절차 상태 확인용입니다.</p></div>`}catch(e){}}
async function reviewIt(id,decision){if(!confirm('검토 결과를 반영할까요?'))return;try{const reason=$('corReason')?.value||'',keys=($('corKeys')?.value||'').split(',').map(s=>s.trim()).filter(Boolean);await call('reviewAction',id,decision,reason,keys);msg('검토 결과 저장');loadReview()}catch(e){}}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});async function bootApp(){try{if(/^WRK-[a-f0-9]{32}$/.test(LINK_REVIEW)){/* v5.20 내 정보(portalData) 없이 등록 화면만 바로 받음 (왕복 1번 줄임) */workerLinkMode=true;state={email:''};showVer(state);wkCheckIn();return}const mt=/^MEET-[a-f0-9]{32}$/.test(LINK_REVIEW);await bootPortal(mt);if(mt){meetCheckIn();return}if(LINK_REVIEW&&(['ADMIN','SAFETY'].includes(state.role)||state.isApprover))switchTab('admin')}catch(e){}}

/* ---------- v4.0 로그인 · 서버 연결 (GitHub 화면 → Apps Script Code.gs) ---------- */
const CONF=window.APP_CONFIG||{};
/* F1.0 Firebase: 서버 왕복 대신 fb.js가 Firestore를 직접 읽고 씀 */
const EXEC_OK=!!(window.FB&&FB.ok);
/** Apps Script로 요청 보내기 (text/plain = 브라우저 사전확인 없이 전송되는 방식) */
/* v5.10 서버는 처리를 끝냈는데 응답이 중간에 사라지는 경우(구글 응답 전달 오류: 404·CORS)가 있음
 *  → 다시 해도 결과가 같은 요청(조회·임시저장·로그인)은 자동으로 2번까지 다시 보냄
 *  → 제출·발행·승인처럼 두 번 하면 안 되는 요청은 다시 보내지 않고 안내만 */
const RETRY_OK=new Set(['portalData','myStatus','myJobs','vendorJob','jobBoard','meetingDetail','permitList','permitDetail','getPermit','inspList','inspMine','jobEvalList','noticeList','vendorList','staffList','templateAdminList','reviewList','applications','getReviewData','getMeetingPhoto','getInspPhoto','myBadges','saveStep','getMyFile','getInternalFile','getTemplate','saveMeetingDocs',/* v5.19 jobEvalFile은 다시 보내면 ZIP을 처음부터 또 만들어서 뺌 */'setMeetingOpen','confirmAttendee','checkInspections','readNotices','approvePermits','jobEvalList','startRenewal','cancelRenewal']);
async function post_(body){const __pt=Date.now(),__name=body.op==='call'?String(body.fn||'call'):String(body.op||'request');let __ok=false;try{if(!EXEC_OK)throw Error('config.js에 Apps Script 주소(/exec)가 등록되지 않았습니다.');
 const again=body.op==='login'||RETRY_OK.has(body.fn);let o,last;
 for(let i=0;i<(again?2:1);i++){if(i)await new Promise(r=>setTimeout(r,800*i));
  /* v5.20 다시 보내도 되는 요청은 45초 넘게 응답이 없으면 끊고 다시 보냄 (응답이 중간에 사라져 끝없이 기다리던 경우) */
  const ac=again&&window.AbortController?new AbortController():null,tt=ac?setTimeout(()=>ac.abort(),35000):0;
  try{const r=await fetch(CONF.APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),cache:'no-store',signal:ac?ac.signal:undefined});o=await r.json();last=null;break}catch(e){last=e}finally{clearTimeout(tt)}}
 if(!last&&o&&o.ok&&body.op==='call')sessTouch();  // v5.18 쓰는 동안은 이 기기 로그인 유지
 if(last)throw Error(again?'서버 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.':'서버 응답을 받지 못했습니다. 처리가 되었을 수 있으니, 화면을 새로 고쳐 결과를 먼저 확인한 뒤 다시 시도해 주세요.');
 if(!o||!o.ok)throw Error((o&&o.error)||'처리에 실패했습니다.'); __ok=true;return o.data}finally{perfRecord('network',__name,Date.now()-__pt,__ok)}}
/** 로그인 후 서버 기능 호출 (이름은 Code.gs 허용 목록에 있어야 함) */
async function api(fn,args){const __pt=Date.now();let __ok=false;try{if(!EXEC_OK)throw Error('config.js에 Firebase 설정값이 없습니다.');const r=await FB.call(fn,args||[]);__ok=true;sessTouch();return r}catch(e){if(/로그인이 만료|로그인 정보/.test(e.message))setTimeout(()=>logout('로그인이 만료되었습니다. 다시 로그인해 주세요.'),0);throw e}finally{perfRecord('network',fn,Date.now()-__pt,__ok)}}
const LOGIN_HELP={VENDOR:'처음 방문한 업체는 로그인 후 사업자 등록을 신청합니다.',STAFF:'회사직원명단에 등록된 개인 Google 계정(Gmail)으로 로그인해 주세요.'};
const isWorkerLink=()=>/^WRK-/.test(LINK_REVIEW);
function loginMode(){const r=document.querySelector('input[name=loginMode]:checked');return r?r.value:'VENDOR'}
function loginHelp(){$('loginHelp').textContent=isWorkerLink()?'소장님이 보여 준 QR로 들어왔습니다. 이 공사에서 처음 한 번만 등록하면 됩니다.':LOGIN_HELP[loginMode()]}
function showLogin(note){$('appView').hidden=true;$('loginView').hidden=false;document.title='도급 안전관리 | 로그인';$('loginStatus').textContent=note||'';renderGoogleBtn()}
function showApp(){$('loginView').hidden=true;$('appView').hidden=false;document.title='도급 안전관리';navInit()}
let gsiDone=false;
let gsiWait=0;
/* F1.0 구글 로그인 버튼 = Firebase 로그인 (팝업 · 막히면 화면 이동 방식) */
function renderGoogleBtn(){if(gsiDone||!EXEC_OK)return;gsiDone=true;
 $('googleBtn').innerHTML='<button class="gbtn" type="button" id="gLoginBtn"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg><span>Google 계정으로 로그인</span></button>';
 $('gLoginBtn').onclick=async()=>{const st=$('loginStatus'),b=$('gLoginBtn');b.disabled=true;st.textContent='구글 로그인 창을 여는 중…';
  try{const r=await FB.signIn();if(r==='redirect'){st.textContent='구글 로그인 화면으로 이동합니다…';return}}catch(e){st.textContent=FB.loginError(e);b.disabled=false;return}
  b.disabled=false;onGoogleLogin({credential:'firebase'})}}
/* v5.20 로그인 = 왕복 1번에 내 정보(또는 QR 등록·참석 화면)까지 받음 → 이어서 공사·업무 화면 미리 받기 (체크리스트로 진행 표시) */
async function onGoogleLogin(r){if(!r||!r.credential)return;const st=$('loginStatus'),wk=isWorkerLink(),mt=/^MEET-[a-f0-9]{32}$/.test(LINK_REVIEW);st.textContent='';
 bootUI(wk?['구글 계정 확인','서버 로그인 · 등록 화면 준비']:mt?['구글 계정 확인','서버 로그인 · 참석 화면 준비','화면 열기']:['구글 계정 확인','서버 로그인 · 내 정보 불러오기','공사 목록 준비','화면 열기']);
 bootSet(0,'done');bootSet(1,'run');bootSkip(()=>location.reload(),'처음부터 다시');
 let d;try{d=await FB.login(wk?'':loginMode(),wk||mt?LINK_REVIEW:'1')}catch(e){bootEnd();st.textContent='로그인 실패: '+e.message;return}
 SESSION=d.key;sessSave(SESSION);if(!wk)setCUser(String(d.email||'').toLowerCase()+'|'+loginMode());  // F1.7f 작업자 QR은 이 기기 저장 화면을 지우지 않음
 bootSet(1,'done');showApp();
 if(wk){bootEnd();if(d.wk||d.bootError)workerBoot(d);else bootApp();return}
 if(!d.portal){bootEnd();bootApp();return}  // 서버(Code.gs)가 아직 예전 버전이면 예전 방식
 try{await bootRest(d.portal,mt?-1:2)}catch(e){bootEnd();/* F1.7f 빈 화면 대신 안내 + 다시 시도 */$('my').innerHTML='<div class="card"><h2>화면을 열지 못했습니다</h2><p class="desc">'+escapeText(e.message||'')+'</p><button class="button" type="button" onclick="location.reload()">다시 시도</button></div>';if(mt){try{meetCheckIn()}catch(x){}}return}
 if(mt){try{if(d.meet)showCheckIn(d.meet);else await meetCheckIn()}catch(e){$('my').innerHTML='<div class="card"><h2>참석 화면을 열지 못했습니다</h2><p class="desc">'+escapeText(e.message||'')+'</p><button class="button" type="button" onclick="meetCheckIn()">다시 시도</button></div>'}switchTab('my');$('my').scrollIntoView();return}
 if(LINK_REVIEW&&(['ADMIN','SAFETY'].includes(state.role)||state.isApprover))switchTab('admin')}
/** 로그아웃: 저장된 로그인 정보 지우고 처음 화면으로 (주소창의 링크값도 정리) */
const fbOut=()=>Promise.resolve(window.FB&&FB.ok?FB.signOut():0).catch(()=>{});
function logout(note){cacheClear();try{localStorage.removeItem('fcUser')}catch(e){}sessClear();try{if(note)sessionStorage.setItem('loginNote',note)}catch(e){}dirty=false;fbOut().then(()=>{location.href=location.pathname})}
/** QR·링크 화면에서 다른 계정으로 (주소의 링크값은 그대로 두고 로그인만 다시) */
function relogin(){cacheClear();try{localStorage.removeItem('fcUser')}catch(e){}sessClear();dirty=false;fbOut().then(()=>location.reload())}
/* ---------- v5.18 휴대폰 로그인: 앱 안 화면 확인 ----------
 *  카카오톡·네이버·밴드·인스타·페이스북·라인·회사 메일 앱 안에서 열린 화면은 구글이 로그인을 막음 (403 disallowed_useragent)
 *  → 크롬·사파리로 열기 안내 (카카오톡은 바로 바깥 브라우저로 넘김, 안드로이드는 크롬으로 열기 버튼) */
const UA=navigator.userAgent||'',IS_IOS=/iPhone|iPad|iPod/i.test(UA),IS_AND=/Android/i.test(UA);
function inAppName(){if(/KAKAOTALK/i.test(UA))return '카카오톡';if(/NAVER\(inapp|NAVER/.test(UA)&&/inapp/i.test(UA))return '네이버';if(/BAND\//i.test(UA))return '밴드';if(/Instagram/i.test(UA))return '인스타그램';if(/FBAN|FBAV|FB_IAB/i.test(UA))return '페이스북';if(/Line\//i.test(UA))return '라인';if(/DaumApps|DaumDevice/i.test(UA))return '다음';
 if(IS_AND&&/; wv\)/.test(UA))return '앱';if(IS_IOS&&!/Safari\//.test(UA))return '앱';return ''}
function openOutside(){const u=location.href;
 if(/KAKAOTALK/i.test(UA)){location.href='kakaotalk://web/openExternal?url='+encodeURIComponent(u);return}
 if(IS_AND){location.href='intent://'+u.replace(/^https?:\/\//,'')+'#Intent;scheme=https;package=com.android.chrome;end';return}
 copyLoginLink()}
function copyLoginLink(){const u=location.href;(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(()=>alert('주소를 복사했습니다.\nSafari(사파리)나 크롬을 열고 주소창에 붙여넣어 주세요.'),()=>prompt('아래 주소를 길게 눌러 복사한 뒤 Safari·크롬 주소창에 붙여넣어 주세요.',u))}
function inAppBox(){const n=inAppName();if(!n)return;const box=document.createElement('div');box.className='note';box.id='inAppBox';box.style.cssText='margin:12px 0;border-left:3px solid var(--accent);text-align:left';
 box.innerHTML='<b>'+escapeText(n)+' 안에서 열린 화면입니다</b><br>구글이 이 화면에서는 로그인을 막는 경우가 많습니다. <b>'+(IS_IOS?'Safari(사파리)':'크롬')+'</b>로 열어 주세요.'
  +'<div style="display:grid;gap:8px;margin-top:10px"><button class="button" type="button" onclick="openOutside()">'+(IS_IOS&&!/KAKAOTALK/i.test(UA)?'주소 복사하기':(IS_IOS?'Safari':'크롬')+'로 열기')+'</button>'
  +(IS_IOS&&!/KAKAOTALK/i.test(UA)?'<span class="muted">또는 오른쪽 위·아래의 ··· / 공유 버튼 → "Safari로 열기"</span>':'<button class="button ghost" type="button" onclick="copyLoginLink()">주소 복사하기</button>')+'</div>';
 const g=$('googleBtn');g.parentNode.insertBefore(box,g)}
/* ---------- v5.20 뒤로 가기 (화면 위 ‹ 버튼 + 휴대폰 뒤로 버튼·밀어서 뒤로) ----------
 *  예전: 휴대폰 뒤로 버튼 = 사이트를 벗어남(새로 고침처럼 처음부터). 이제 앱 안에서 한 단계씩 뒤로:
 *  안내 창 → 메뉴 → 허가서·규정·계획서 작성 화면 → 화면 안 [← …] 버튼 → 입력 양식 → 대시보드
 *  대시보드에서 한 번 더 누르면 "한 번 더 누르면 나갑니다" 안내 후 2.5초 안에 다시 누를 때만 나감 */
function backAction(){
 if(BOOT)return null;
 if(typeof tour!=='undefined'&&tour)return ()=>endTour();
 if($('certDlg'))return closeCert;  // F1.8g 이수증 보기 창
 if($('alDlg'))return closeAlerts;  // F1.8h 도급인 알림 창
 if($('pickSheet'))return closePick;  // F1.8c 사진 넣기 창  // F1.8a 사용 가이드 중이면 가이드만 끝냄
 const md=$('modal');if(md&&md.style.display==='flex')return ()=>{const c=$('modalCancel');(c&&!c.hidden?c:$('modalBtn')).click()};
 const nc=$('ncDlg');if(nc&&nc.style.display==='flex')return closeNewContract;
 const ds=$('dsDlg');if(ds&&ds.style.display==='flex')return closeDayStart;  // F1.8f 공사 고르기 창
 if(typeof rs!=='undefined'&&rs&&rs.from==='dash'&&$('f_rsMemo'))return ()=>{const st=rs.who==='staff';rs=null;st?sgo('dash'):vgo('dash')};  // F1.8f·g 메인에서 연 조치 등록 → 메인으로
 if(loadCount)return ()=>msg('처리 중입니다. 잠시만 기다려 주세요.');
 if($('drawer')&&$('drawer').classList.contains('open'))return ()=>toggleMenu(false);
 const ps=$('psheet');if(ps&&!ps.hidden&&ps.innerHTML)return ()=>{if(typeof pm==='undefined'||!pm){hideSheet();return}if(pm.paper){pfPaper(false);return}/* F1.8a 미리보기 → 입력 화면 */if(pm.mode==='edit'){cancelEditPermit();return}
  if(pm.mode==='new'&&pmTouched&&!confirm('작성 중인 허가서를 닫을까요?\n입력한 내용은 저장되지 않습니다.'))return;if(pm.mode==='staff')backPermitList();else closePermit()};
 const cs=$('csheet');if(cs&&cs.style.display==='block')return ()=>{if(!/계획서/.test(cs.getAttribute('aria-label')||'')){/* F1.8c 규정만 쓰는 화면일 때만 규정 닫기 (합친 화면은 계획서 닫기 = 임시 보관) */if(confirm('규정 작성을 닫을까요?\n입력한 내용은 저장되지 않습니다.'))closeRule()}else closePlan()};
 const sec=document.querySelector('.main > section:not(.hidden)');if(sec){const b=[...sec.querySelectorAll('button')].find(x=>/^\s*←/.test(x.textContent)&&x.offsetParent!==null);if(b)return ()=>b.click()}
 if(tab==='jobs'&&jobsMode==='form')return ()=>renderJobs();
 if(state&&isVendorApproved()&&(tab!=='my'||vmenu!=='dash'||!$('execArea')))return ()=>vgo('dash');
 if(state&&isStaffUI()&&(smenu!=='dash'||tab!=='jobs'))return ()=>sgo('dash');
 return null}
function goBack(){const f=backAction();if(f)f();updBack()}
let backT=0;function updBack(){clearTimeout(backT);backT=setTimeout(()=>{const b=$('backBtn');if(b)b.hidden=!backAction()},60)}
let navGuard=false,exitAt=0;
function navInit(){if(navGuard)return;navGuard=true;try{history.replaceState({dsr:1},'');history.pushState({dsg:1},'')}catch(e){}
 const m=document.querySelector('.main');if(m&&window.MutationObserver)new MutationObserver(updBack).observe(m,{childList:true,subtree:true});
 document.addEventListener('click',updBack,true);updBack()}
window.addEventListener('popstate',e=>{if(!navGuard||(e.state&&e.state.dsg))return;const f=backAction();
 if(f){f();try{history.pushState({dsg:1},'')}catch(x){}updBack();return}
 if(Date.now()-exitAt<2500){navGuard=false;history.back();return}
 exitAt=Date.now();msg('뒤로 버튼을 한 번 더 누르면 나갑니다.');try{history.pushState({dsg:1},'')}catch(x){}});
function initLogin(){
 // 접속 구분: 마지막 선택 기억
 const radios=[...document.querySelectorAll('input[name=loginMode]')];
 try{const s=localStorage.getItem('loginMode');const r=radios.find(x=>x.value===s);if(r)r.checked=true}catch(e){}
 radios.forEach(x=>x.addEventListener('change',()=>{try{localStorage.setItem('loginMode',loginMode())}catch(e){}loginHelp()}));
 if(isWorkerLink()){$('modeBox').hidden=true;$('loginSub').textContent='작업자 등록 · 본인 Google 계정으로 로그인하세요.'}
 loginHelp();inAppBox();
 // 버전 표시: 위쪽 UI_VERSION
 $('loginVer').textContent=UI_VERSION;
 /* F1.7f 휴대폰이 예전 파일을 기억하고 있어 화면 파일 버전이 섞인 경우 → 한 번만 자동 새로 고침, 그래도 다르면 안내 */
 if(window.FB&&FB.version&&FB.version!==UI_VERSION){$('loginVer').textContent=UI_VERSION+' / '+FB.version+' (버전이 섞여 있음)';
  let tried=false;try{tried=sessionStorage.getItem('verReload')===UI_VERSION+FB.version;sessionStorage.setItem('verReload',UI_VERSION+FB.version)}catch(e){tried=true}
  if(!tried){location.reload();return}}
 let note='';try{note=sessionStorage.getItem('loginNote')||'';sessionStorage.removeItem('loginNote')}catch(e){}
 if(!EXEC_OK){showLogin('config.js의 Firebase 설정값 또는 Firebase 연결을 불러오지 못했습니다. 새로 고침해 주세요.');return}
 /* F1.7f 로그인 확인이 끝나지 않으면 빈 화면으로 멈춰 있던 문제 → 15초 지나도 아무 화면이 없으면 로그인 화면 + 안내 */
 setTimeout(()=>{if($('loginView').hidden&&$('appView').hidden&&!BOOT){sessClear();SESSION='';showLogin('로그인 확인이 늦어지고 있습니다. 아래 버튼으로 다시 로그인해 주세요.\n계속 안 되면 크롬·사파리 앱으로 이 주소를 열어 주세요.')}},15000);
 /* F1.0 구글 로그인 화면 이동 방식으로 돌아온 경우 → 이어서 로그인 처리 */
 FB.redirectResult().then(r=>{if(r===true){showLogin('');onGoogleLogin({credential:'firebase'});return}
  if(typeof r==='string')note=r;
  if(SESSION)FB.ready.then(u=>{if(u&&u.uid===SESSION){showApp();bootApp()}else{sessClear();SESSION='';showLogin(note||'로그인이 만료되었습니다. 다시 로그인해 주세요.')}});else showLogin(note)});
}
initLogin();
