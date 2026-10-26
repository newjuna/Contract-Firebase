/* 업체 화면 (v5.3) — 승인된 협력업체
 *  첫 화면 = 대시보드 (공사 일정 막대 · 이행률 원그래프 · 오늘 할 일)
 *  ☰ 메뉴 = 업무별: 대시보드 / 작업자 등록·오늘 인원 / 작업허가서 발행 / 순회점검 / 비상대피훈련 등록(준비 중) / 계약 서류
 *  공사가 여러 개면 각 메뉴 맨 위에서 공사를 고름 (1개면 자동)
 *  서버: Code.gs myJobs(stats·end) · vendorJob */
let vmenu='dash',vSel='';
const VMENU={dash:'대시보드',today:'오늘 현장 업무',meet:'협의체 및 합동점검 참여',drill:'비상대피훈련 등록',docs:'계약 서류'};
/* F1.8a 작업자 등록·작업허가서·순회점검은 '오늘 현장 업무' 한 화면으로 합침 · 예전 이름으로 부르면 그 칸으로 바로 이동 */
const VJUMP={workers:'regCard',permit:'permitCard',insp:'inspCard'};
/* v5.17 재평가 중(이전 승인 있음)이어도 수행 메뉴는 그대로 사용 */
const isVendorApproved=()=>!!(state&&!state.staff&&state.company&&state.company.status==='VERIFIED'&&(state.company.submissionStatus==='APPROVED'||!!state.company.renewAt));
/** 메뉴 버튼 보이기 (display 때마다) */
/* v5.17 진행 중인 공사가 없으면(모두 종료 · 배정 전) 공사 업무 메뉴는 숨기고 대시보드·계약 서류만 */
const VJOB_MENUS=['today','meet','drill'];
const vOpenJobs=()=>vjobs&&vjobs.jobs?vjobs.jobs.filter(j=>j.status!=='ENDED').length:(state&&state.openJobs!=null?state.openJobs:1);
function setupVMenu(){const ap=isVendorApproved(),open=ap&&vOpenJobs()>0,isJob=el=>!!el&&VJOB_MENUS.includes(String(el.id).replace('vm_',''));
 /* v5.20 메뉴 묶음(navg)은 안에 공사 업무 메뉴가 있으면 공사 업무로 봄 */
 document.querySelectorAll('.vmb').forEach(b=>{const job=b.classList.contains('navg')?[...b.querySelectorAll('button[id]')].some(isJob):isJob(b);b.classList.toggle('hidden',!ap||(job&&!open))});
 if(ap&&!open&&VJOB_MENUS.includes(vmenu)&&!vjob)vmenu='dash';  // 종료 공사 기록을 보고 있을 때는 그대로
 $('myTab').classList.toggle('hidden',ap);if(!state.staff&&state.company)$('myTab').textContent=ap?'내 업무':'계약 전 서류';if(ap)markVMenu()}
function markVMenu(){document.querySelectorAll('.vmb').forEach(b=>b.classList.toggle('active',b.id==='vm_'+vmenu));if(tab==='my'&&isVendorApproved())$('pageTitle').textContent=VMENU[vmenu]}
/** 메뉴 이동 */
function vgo(m,id){if(VJUMP[m]){window.__vjump=VJUMP[m];m='today'}if(!id&&VJOB_MENUS.includes(m)&&vOpenJobs()<1)m='dash';/* 진행 중 공사 없음 → 대시보드 (종료 공사 기록 보기는 id로 열림) */vmenu=m;if(id)vSel=id;toggleMenu(false);stopScan();MEET_TOKEN='';if(tab!=='my')switchTab('my');markVMenu();clearInterval(wkTimer);showQr=false;showAdd=false;window.scrollTo(0,0);
 if(!$('execArea')){renderMy();return}  // 참석 체크 화면 뒤에는 업체 화면을 다시 그림
 if(m==='meet'){renderVMeet();return}
 if(m==='dash'){vjob=null;loadMyJobs(true);return}/* v5.20 가지고 있는 목록으로 바로 그리고, 20초 지났을 때만 뒤에서 새로 받음 */if(m==='docs'){renderVDocs();return}if(m==='drill'){renderVDrill();return}vEnsureJob()}
/** 승인 후 화면 시작 (renderMy에서 호출) */
function vStart(){markVMenu();if(vmenu==='meet')return renderVMeet();if(vmenu==='docs')return renderVDocs();if(vmenu==='drill')return renderVDrill();if(vmenu!=='dash'&&vjob)return renderVJob();loadMyJobs(true)/* v5.18 20초 안에 받은 목록이면 다시 받지 않음 */}
async function vEnsureJob(){const el=$('execArea');if(!el)return;
 if(!vjobs){el.innerHTML='<div class="card"><p class="desc">공사를 불러오는 중입니다…</p></div>';try{vjobs=await callQuiet('myJobs')}catch(e){el.innerHTML='<div class="card"><p class="desc">'+escapeText(e.message||'공사를 불러오지 못했습니다.')+'</p></div>';return}}
 const jobs=vjobs.jobs;if(!jobs.length){el.innerHTML='<div class="card"><h2>'+escapeText(VMENU[vmenu])+'</h2><div class="note">아직 배정된 공사가 없습니다.<br>도급인 담당자가 공사에 업체를 배정하면 여기에서 진행할 수 있습니다.</div></div>';return}
 if(!vSel||!jobs.some(j=>j.id===vSel))vSel=(jobs.find(j=>j.status!=='ENDED')||jobs[0]).id;
 if(vjob&&vjob.job.id===vSel){renderVJob();return}await openVJob(vSel)}
function pickJob(id){vSel=id;showQr=false;showAdd=false;openVJob(id)}
/** 업무 화면 머리: 메뉴 이름 + 공사 선택 */
function vJobHead(v){const jobs=(vjobs&&vjobs.jobs)||[];if(vmenu!=='today'){vmenu='today';markVMenu()}
 return '<div class="card vjhead"><h2 style="margin:0">'+escapeText(VMENU[vmenu]||'')+'</h2>'
  +(jobs.length>1?'<label class="muted" for="vjSel" style="display:block;margin-top:10px">공사 선택</label><select id="vjSel" class="vjsel" onchange="pickJob(this.value)">'+jobs.map(j=>'<option value="'+escapeText(j.id)+'" '+(j.id===v.job.id?'selected':'')+'>'+escapeText(j.title)+' ('+escapeText(j.storeName)+')'+(j.status==='ENDED'?' · 종료':'')+'</option>').join('')+'</select>':'')
  +'<div class="muted" style="margin-top:6px">'+(jobs.length>1?'':escapeText(v.job.title)+' · ')+escapeText(v.job.storeName)+' · '+escapeText(v.company.trade)+' · 도급인 '+escapeText(v.job.hostName)+'</div></div>'}
/* ---------- 대시보드 ---------- */
const dayDiff=(a,b)=>Math.round((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/86400000);
function ganttRow(j,t,staff){const s=j.startDate,e=j.endDate||j.startDate,ok=/^\d{4}-\d{2}-\d{2}$/;if(!ok.test(s))return '';
 const total=Math.max(1,dayDiff(s,e)+1),ended=j.status==='ENDED',d=dayDiff(s,t)+1,pct=ended?100:Math.max(0,Math.min(100,Math.round(d/total*100)));
 const left=dayDiff(t,e),lab=ended?'공사 종료':d<1?'착수 '+(1-d)+'일 전':left<0?'종료일 '+(-left)+'일 경과':d+'일째 / 총 '+total+'일 · '+(left?'종료 '+left+'일 전':'오늘 종료');
 const warn=!ended&&(left<0||left<=3&&d>=1);
 return '<div class="gt"><div class="row" style="justify-content:space-between"><b>'+escapeText(j.title)+'</b><span class="muted">'+escapeText(s.slice(5).replace('-','/'))+' ~ '+escapeText(e.slice(5).replace('-','/'))+'</span></div><div class="gbar'+(ended?' end':'')+'" role="img" aria-label="'+escapeText(j.title+' 진행 '+pct+'%')+'"><span style="width:'+pct+'%"></span></div><div class="muted'+(warn?' req':'')+'">'+escapeText(lab)+(ended?'':' · '+pct+'%')+'</div>'+(staff&&!ended?'<div style="text-align:right;margin-top:4px"><button class="button ghost" type="button" style="padding:6px 12px;font-size:13px" onclick="jobEndPage(\''+escapeText(j.id)+'\')">연장·종료</button></div>':'')+'</div>'}
function donut(rate,label,sub){const C=188.5,has=rate!=null,p=has?Math.max(0,Math.min(1,rate)):0,col=!has?'#e5e7eb':p>=0.9?'var(--ok)':p>=0.6?'#111827':'var(--accent)';
 return '<div class="dn"><svg viewBox="0 0 80 80" width="80" height="80" role="img" aria-label="'+escapeText(label+' '+(has?Math.round(p*100)+'%':'기록 없음'))+'"><circle cx="40" cy="40" r="30" fill="none" stroke="#e5e7eb" stroke-width="9"/>'+(has?'<circle cx="40" cy="40" r="30" fill="none" stroke="'+col+'" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+(C*p).toFixed(1)+' '+C+'" transform="rotate(-90 40 40)"/>':'')+'<text x="40" y="45" text-anchor="middle" font-size="15" font-weight="700" fill="#111">'+(has?Math.round(p*100)+'%':'–')+'</text></svg><b>'+escapeText(label)+'</b><span class="muted">'+escapeText(sub)+'</span></div>'}
function todoRows(j,t){const S=j.stats||{},inRange=j.startDate<=t&&(!j.endDate||t<=j.endDate),id=escapeText(j.id),list=[];
 if(inRange&&!S.todayPermit)list.push(['permit','② 작업허가서 (작업 있는 날)','미발행']);
 /* F1.8a 순회점검은 매일 (법정은 2일 1회 → 2일 넘으면 '기한 지남') */
 if(inRange&&!S.inspToday)list.push(['insp','③ 순회점검 (매일)',S.inspDue?(S.lastInsp?'기한 지남 · '+dayDiff(S.lastInsp,t)+'일 경과':'점검 기록 없음'):'오늘 점검 전']);
 if(S.openFindings)list.push(['insp','미조치 지적사항',S.openFindings+'건']);
 if(!list.length)return '<div class="note" style="margin-top:12px">✔ 오늘 할 일을 모두 마쳤습니다.</div>';
 return '<div class="stage">오늘 할 일</div>'+list.map(([m,txt,tag])=>'<button class="vtodo" type="button" onclick="vgo(\''+m+'\',\''+id+'\')"><span>'+escapeText(txt)+'</span><span class="req">'+escapeText(tag)+' ›</span></button>').join('')}
function renderDash(){const el=$('execArea');if(!el||!vjobs)return;
 // v5.18 공사 화면 미리 받기는 5분에 한 번만 (예전: 대시보드를 그릴 때마다 3번씩 → 다음 버튼과 겹쳐 느려짐)
 /* v4: 대시보드가 상세자료 3건을 자동으로 요청하던 동작 제거. 상세는 공사 선택 시에만 요청. */clearTimeout(window.__pf);vjob=null;clearInterval(wkTimer);const d=vjobs,t=d.today,act=d.jobs.filter(j=>j.status!=='ENDED'),ended=d.jobs.filter(j=>j.status==='ENDED');
 const due=act.reduce((n,j)=>n+((j.stats&&j.stats.inspDue&&!j.stats.inspToday&&j.startDate<=t)?1:0)+((j.stats&&j.stats.openFindings)||0),0);setBadge($('vm_today'),due);setBadge($('menuBtn'),due);
 // v5.17 계약 전 평가 유효기간 30일 이내·만료·재평가 중이면 대시보드 위에 안내
 const cb=state.company||{},cv=cb.valid,rn=cb.renewAt?{DRAFT:'작성 중',CORRECTION:'보완 요청',SUBMITTED:'본사 검토 중',SAFETY_REVIEW:'본사 검토 중'}[cb.submissionStatus]||'진행 중':'';
 el.innerHTML='<div class="card"><h2 style="margin:0">'+escapeText(d.company)+'</h2><div class="muted">'+escapeText(t)+' · 진행 중 공사 '+act.length+'건'+(ended.length?' · 종료 '+ended.length+'건':'')+'</div>'
  +(rn?'<button class="vtodo" type="button" onclick="vgo(\'docs\')"><span>신규 작성 (다음 계약 준비)</span><span class="req">'+escapeText(rn)+' ›</span></button>':cv&&(cv.expired||cv.days<=30)?validNote(cb)+'<button class="vtodo" type="button" onclick="openNewContract()"><span>신규 작성 (다음 계약 준비)</span><span class="req">'+(cv.expired?'만료':'D-'+cv.days)+' ›</span></button>':'')+'</div>'
  +(d.jobs.length?'<div class="card"><h2>공사 일정</h2>'+act.concat(ended).map(j=>ganttRow(j,t)).join('')+'</div>'
  +act.map(j=>{const S=j.stats||{},wd=S.workDays||0;return '<div class="card"><div class="vh-top"><div><h2 style="margin:0">'+escapeText(j.title)+'</h2><div class="muted">'+escapeText(j.storeName)+' · 도급인 '+escapeText(j.hostName)+' · 작업자 '+j.workers+'명</div></div></div>'
   +'<div class="dns">'+donut(S.inspNeed?S.insp/S.inspNeed:null,'순회점검',S.inspNeed?S.insp+' / '+S.inspNeed+'회':'기록 없음')+donut(wd?S.permitDays/wd:null,'작업허가서',wd?S.permitDays+' / '+wd+'일':'기록 없음')+donut(j.workers?1:null,'신규자 교육',j.workers?j.workers+'명 등록':'등록 없음')+'</div>'
   +'<p class="muted" style="text-align:center;margin:4px 0 0">작업일 '+wd+'일 기준 이행률</p>'+todoRows(j,t)+'</div>'}).join('')
  +(!rn&&ended.length&&!act.length?newContractCard():'')  // v5.17 공사가 모두 끝났으면 종료 목록 위에 [신규 작성]
  +(ended.length?'<div class="card"><h2>종료된 공사</h2>'+ended.map(j=>'<button class="jobitem" type="button" onclick="vgo(\'workers\',\''+escapeText(j.id)+'\')"><div><b>'+escapeText(j.title)+'</b> <span class="pill todo">종료</span><div class="muted">'+escapeText(j.storeName)+' · '+escapeText(j.startDate)+' ~ '+escapeText(j.endDate||'')+'</div></div><span aria-hidden="true">›</span></button>').join('')+'</div>':'')
  +(!rn&&act.length&&ended.length?newContractCard():'')  // 진행 중 공사가 있으면 맨 아래
  :'<div class="card"><div class="note">아직 배정된 공사가 없습니다.<br>도급인 담당자가 공사에 업체를 배정하면 여기에 나타납니다.</div></div>')}
/* ---------- 비상대피훈련 · 계약 서류 ---------- */
/* F1.8b 비상대응훈련·교육 사진은 순회점검 화면(TBM 사진 다음)에서 올림 */
function renderVDrill(){const el=$('execArea');if(el)el.innerHTML='<div class="card"><h2 style="margin:0">비상대응훈련 · 교육 사진</h2><p class="desc">비상대피·CPR·소화기 훈련이나 안전교육을 한 날은 <b>오늘 현장 업무 → ③ 순회점검</b>에서 TBM 사진 다음 칸에 종류를 고르고 사진을 올립니다.<br>공사 중 비상대응훈련을 1번 이상 하면 업체 평가(비상대책)에 반영됩니다.</p><button class="button" type="button" style="width:100%" onclick="vgo(\'insp\')">순회점검으로 가기</button></div>'}
function renderVDocs(){const el=$('execArea');if(!el)return;const b=state.company,rows=((state.docBoard&&state.docBoard.rows)||[]).filter(r=>r.stage==='CONTRACT'&&r.vendorDoc);
 // v5.17 재평가 중: 계약 전 화면(사업장 정보·규정·계획서·제출)을 그대로 보여 줌
 if(b.renewAt){el.innerHTML='<div class="card"><div class="vh-top"><h2 style="margin:0">신규 작성 · 다음 계약 준비</h2><span class="pill lock">'+(b.renewMode==='NEW'?'처음부터 작성':'이전 정보 불러옴')+'</span></div><p class="desc">진행 중인 공사 업무는 그대로 할 수 있습니다. 아래를 작성해 제출하면 본사 담당자가 다시 검토합니다.</p>'+validNote(b)
  +(b.submissionStatus==='DRAFT'?'<button class="button ghost" type="button" style="width:100%;margin-top:10px" onclick="cancelNewContract()">↩ 신규 작성 취소 (잘못 눌렀을 때 · 제출 전만)</button>':'')+'</div>'+contractHomeHtml(b);return}
 el.innerHTML='<div class="card"><div class="vh-top"><h2 style="margin:0">계약 서류</h2><span class="pill '+(b.valid&&b.valid.expired?'todo':'ok')+'">'+(b.valid&&b.valid.expired?'계약 전 평가 만료':'계약 전 검토 승인')+'</span></div>'+validNote(b)+'<p class="desc" style="margin-top:10px">계약 전에 제출한 서류입니다. 눌러서 내려받을 수 있습니다.</p>'
  +(rows.map(r=>{const u=r.uploads[0];return '<div class="item"><b>'+escapeText(r.name)+'</b><div class="muted">'+(u?'<a onclick="viewFile(\''+escapeText(u.id)+'\')">📄 '+escapeText(u.name)+'</a> · '+escapeText(fmtTime(u.uploadedAt)):'제출 기록 없음')+'</div></div>'}).join('')||'<p class="muted">제출한 서류가 없습니다.</p>')
  +'<div class="line"></div>'+newContractCard(true)+'</div>'}
/* ---------- v5.17 신규 작성 (다음 계약 준비) ---------- */
/** 대시보드·계약 서류 화면의 [신규 작성] 카드 (inner=true면 카드 안에 넣는 모양) */
function newContractCard(inner){const b=state.company||{},v=b.valid,need=v&&(v.expired||v.days<=30);
 const body='<div class="vh-top"><h2 style="margin:0">'+(inner?'':'📝 ')+'신규 작성 · 다음 계약 준비</h2>'+(need?'<span class="pill todo">'+(v.expired?'평가 만료':'D-'+v.days)+'</span>':'')+'</div>'
  +'<p class="desc">사업자 정보 → 사업장 정보 → 안전보건관리규정 → 계획서 → 제출, 처음 계약 때와 같은 순서로 다시 작성합니다. 전에 쓴 정보를 불러올 수도 있습니다.</p>'
  +(v&&!v.expired?'<p class="muted">지금 계약 전 평가는 '+escapeText(v.until)+'까지 유효해서, 바뀐 내용이 없으면 다시 내지 않아도 새 공사에 배정될 수 있습니다.</p>':'')
  +'<button class="button" type="button" style="width:100%;margin-top:8px" onclick="openNewContract()">＋ 신규 작성</button>';
 return inner?body:'<div class="card">'+body+'</div>'}
/** [신규 작성] 누르면: 이전 정보 불러오기 / 처음부터 새로 작성 / 취소 */
function openNewContract(){let el=$('ncDlg');if(!el){el=document.createElement('div');el.id='ncDlg';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','ncTitle');el.style.cssText='position:fixed;inset:0;background:#0007;z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px';document.body.appendChild(el)}
 el.innerHTML='<div class="card" style="max-width:420px;width:100%;margin:0"><h2 id="ncTitle">신규 작성</h2><p class="desc"><b>전에 입력한 정보를 불러올까요?</b></p>'
  +'<ul class="desc" style="padding-left:18px;margin:6px 0 12px"><li><b>이전 정보 불러오기</b>: 사업자·사업장 정보, 규정·계획서 내용이 채워진 상태로 시작합니다. 바뀐 곳만 고치면 됩니다.</li><li><b>처음부터 새로 작성</b>: 빈칸으로 시작합니다. (예전 기록은 지워지지 않고 보관됩니다)</li></ul>'
  +'<p class="muted">어느 쪽이든 규정·계획서는 다시 서명해야 제출할 수 있습니다. 작성·검토 중에도 진행 중인 공사 업무는 그대로 할 수 있습니다.</p>'
  +'<p class="muted">잘못 눌렀다면: 제출하기 전까지는 [계약 서류] 화면의 <b>[신규 작성 취소]</b>로 원래 승인 상태로 되돌릴 수 있습니다.</p>'
  +'<div style="display:grid;gap:8px;margin-top:12px"><button class="button" type="button" onclick="doNewContract(\'KEEP\')">이전 정보 불러오기</button><button class="button dark" type="button" onclick="doNewContract(\'NEW\')">처음부터 새로 작성</button><button class="button ghost" type="button" id="ncCancel" onclick="closeNewContract()">취소 (시작하지 않음)</button></div></div>';
 // F1.7e 실수로 Enter를 눌러도 시작되지 않게 처음 선택은 [취소]
 el.style.display='flex';el.onclick=e=>{if(e.target===el)closeNewContract()};el.onkeydown=e=>{if(e.key==='Escape')closeNewContract()};setTimeout(()=>$('ncCancel')&&$('ncCancel').focus(),0)}
/** F1.7e [신규 작성 취소]: 제출 전(작성 중)일 때만 · 시작 전 승인 상태와 사업자·사업장 정보로 되돌림 */
async function cancelNewContract(){
 if(!confirm('신규 작성을 취소할까요?\n\n· 시작하기 전의 승인 상태로 돌아갑니다 (유효기간도 그대로)\n· 사업자 정보·사업장 정보는 시작 전 내용으로 되돌립니다\n· 작성 중에 올린 서류는 기록으로만 남고, 승인에는 쓰이지 않습니다'))return;
 const done=s=>{vmenu='docs';display(s);window.scrollTo(0,0);msg('신규 작성을 취소했습니다. 원래 승인 상태로 돌아왔습니다.')};
 try{done(await call('cancelRenewal'))}catch(e){
  try{const s=await callQuiet('portalData');if(s.company&&!s.company.renewAt&&s.company.submissionStatus==='APPROVED'){done(s);return}}catch(x){}}}
function closeNewContract(){const el=$('ncDlg');if(el)el.style.display='none'}
async function doNewContract(mode){closeNewContract();
 if(mode==='NEW'&&!confirm('빈칸으로 새로 작성할까요?\n사업자·사업장 정보와 규정·계획서를 처음부터 다시 입력합니다.\n\n(제출하기 전까지는 [신규 작성 취소]로 되돌릴 수 있습니다)'))return;
 if(mode!=='NEW'&&!confirm('이전 정보를 불러와 신규 작성(다음 계약 준비)을 시작할까요?\n\n(제출하기 전까지는 [신규 작성 취소]로 되돌릴 수 있습니다)'))return;
 if(mode==='NEW'){try{localStorage.removeItem(plKey())}catch(e){}}  // 계획서 임시 저장본도 비움
 const done=s=>{vmenu='docs';display(s);window.scrollTo(0,0);msg(s.company&&s.company.renewMode==='NEW'?'신규 작성을 시작했습니다. 빈칸을 채워 제출해 주세요.':'이전 정보를 불러왔습니다. 바뀐 곳만 고쳐서 제출해 주세요.')};
 try{done(await call('startRenewal',mode))}catch(e){
  // 응답만 사라지고 서버는 처리했을 수 있음 → 현재 상태를 다시 받아 시작됐으면 그대로 진행
  try{const s=await callQuiet('portalData');if(s.company&&s.company.renewAt){done(s);return}}catch(x){}}}
