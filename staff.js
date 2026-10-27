/* 담당자·마스터 화면 (v5.6) — 업체 화면처럼 첫 화면 대시보드 + 업무별 ☰ 메뉴
 *  메뉴: 대시보드 / 공사 관리 / 협의체·합동점검 / 작업허가서 승인 / 순회점검 확인 / 종료 평가 / 업체 현황
 *        (안전보건팀·마스터만) 참조 알림 / 표준양식 관리 / 직원 관리
 *  안전보건팀 대시보드 = 전체 공사 현황 + 주의가 필요한 공사·업체
 *  서버: Code.gs jobBoard(vstats) · vendorList */
let smenu='dash',svData=null,svFilter='all';
/* F1.8g 작업허가서 승인 · 순회점검 확인 메뉴 → '현장 확인' 하나로 (예전 이름으로 부르면 현장 확인으로) */
const SMENU={dash:'대시보드',jobs:'공사 관리',meet:'협의체·합동점검',check:'현장 확인',data:'데이터 관리',principal:'도급인 책임자 설정',permit:'작업허가서 승인',insp:'순회점검 확인',eval:'종료 평가',vendors:'업체 현황',notice:'참조 알림',tpl:'표준양식 관리',staff:'직원 관리'};
const isStaffUI=()=>!!(state&&state.staff);
const kstToday=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
/** 메뉴 보이기 (display 때마다) */
function setupSMenu(){const on=isStaffUI(),safety=on&&state.staff.role==='SAFETY';
 /* F1.8h 관리(표준양식·직원)는 마스터 계정만 */
 document.querySelectorAll('.smb').forEach(b=>b.classList.toggle('hidden',!on||(b.dataset.safety==='1'&&!safety)||(b.dataset.master==='1'&&!state.isMaster)));
 if(!on)return;['myTab','adminTab','reviewTab','tplTab','jobsTab','noticeTab','staffTab'].forEach(id=>$(id)&&$(id).classList.add('hidden'));
 markSMenu();if(tab==='my'&&!/^MEET-/.test(LINK_REVIEW))setTimeout(()=>sgo(smenu),0)}
function markSMenu(){if(!isStaffUI())return;document.querySelectorAll('.smb').forEach(b=>b.classList.toggle('active',b.id==='sm_'+smenu));$('pageTitle').textContent=SMENU[smenu]||''}
/** 메뉴 이동 */
function sgo(m){if(m==='permit'||m==='insp')m='check';if(m==='eval')m='jobs';/* F1.8h 종료 평가는 공사 관리 안에서 */if(['tpl','staff','data','principal'].includes(m)&&!state.isMaster)m='dash';if(m==='notice')m='dash';smenu=m;if(m==='dash'&&typeof dashJob!=='undefined')dashJob='';toggleMenu(false);stopScan();
 if(['notice','tpl','staff','vendors'].includes(m)){switchTab(m);markSMenu();return}
 if(tab!=='jobs')switchTab('jobs');else loadJobs();markSMenu();window.scrollTo(0,0)}
/** 알림 숫자 (showBadges에서 호출) */
/* F1.8h 공사 관리 숫자 = 아직 안 본 알림(배정 대기 업체 · 연장·종료 · 종료 평가) · 알림을 눌러 보면 빠짐 · 참조 알림 숫자 없앰 */
function sBadges(b){if(!isStaffUI())return;b=b||{};const vd=(b.admin||0)+(b.review||0),ck=(b.permits||0)+(b.insp||0),pa=b.pendingAttend||0;
 const al=typeof sAlertUnread==='function'&&jobData?sAlertUnread(jobData):null,jb=al?al.filter(x=>['nv','end','eval'].includes(x.type)).length:(b.newVendors||[]).length+(b.jobEnd||0)+(b.evalDraft||0);
 setBadge($('sm_jobs'),jb);setBadge($('sm_meet'),pa);setBadge($('sm_check'),ck);setBadge($('sm_vendors'),vd);setBadge($('menuBtn'),jb+pa+ck+vd)}
/* ---------- 공사 화면 (메뉴별로 같은 공사 목록을 다르게 보여 줌) ---------- */
function renderJobs(){jobsMode='list';roomId='';clearInterval(roomTimer);const d=jobData;if(!d)return;
 const H={dash:sDash,jobs:sJobs,meet:sMeet,check:sCheck,data:sData,principal:sPrincipal,permit:sCheck,insp:sCheck,eval:sEval}[smenu]||sJobs;$('jobs').innerHTML=H(d)}
const sAct=d=>d.jobs.filter(j=>j.status!=='ENDED'),sEnded=d=>d.jobs.filter(j=>j.status==='ENDED');
const sum=(l,f)=>l.reduce((s,x)=>s+(Number(f(x))||0),0);
function sMeta(j){return escapeText(j.storeName)+' · '+escapeText(j.startDate)+(j.endDate?' ~ '+escapeText(j.endDate):'')+' · 주관 '+escapeText(j.hostName)}
function sNone(t){return '<div class="card"><p class="desc">'+t+'</p></div>'}
function sTodo(list){return list.filter(x=>x[2]>0).map(([m,txt,n,unit,fn])=>'<button class="vtodo" type="button" onclick="'+(fn||'sgo(\''+m+'\')')+'"><span>'+escapeText(txt)+'</span><span class="req">'+n+escapeText(unit)+' ›</span></button>').join('')}
/** 공사 1건 이행률 (참여 업체 합계) */
function sRates(j){const V=j.vstats||[],wd=sum(V,v=>v.workDays),need=sum(V,v=>v.inspNeed);return {wd,insp:need?sum(V,v=>v.insp)/need:null,inspTxt:need?sum(V,v=>v.insp)+' / '+need+'회':'기록 없음',permit:wd?sum(V,v=>v.permitDays)/wd:null,permitTxt:wd?sum(V,v=>v.permitDays)+' / '+wd+'일':'기록 없음',crew:wd?sum(V,v=>v.crewDays)/wd:null,crewTxt:wd?sum(V,v=>v.crewDays)+' / '+wd+'일':'기록 없음'}}
const pctTxt=r=>r==null?'–':Math.round(Math.min(1,r)*100)+'%';
function sDash(d){const t=kstToday(),safety=d.me.role==='SAFETY',act=sAct(d),ended=sEnded(d),B=(state&&state.badges)||{};
 const todo=sTodo([['jobs','공사 배정 대기 업체',(B.newVendors||[]).length,'곳'],['permit','작업허가서 승인 대기',sum(act,j=>j.permitWaiting),'건'],['insp','순회점검일지 확인 대기',sum(d.jobs,j=>j.inspUnchecked),'건'],['insp','미조치 지적사항',sum(act,j=>j.findOpen),'건'],
  ['meet','미팅 참석 확인 대기',sum(act,j=>sum(j.meetings,m=>m.pending)),'명'],['eval','종료 예정·종료일 경과 공사',act.filter(j=>j.end&&['SOON','OVER'].includes(j.end.state)).length,'건'],['eval','종료 평가 대기',sum(ended,j=>(j.evalTotal||0)-(j.evalDone||0)),'건']].concat(safety?[['notice','새 참조 알림',B.notices||0,'건']]:[]));
 let h='<div class="card"><h2 style="margin:0">'+escapeText(d.me.name)+' 님</h2><div class="muted">'+escapeText(t)+' · '+(safety?'전체 공사':'내 공사')+' 진행 '+act.length+'건'+(ended.length?' · 종료 '+ended.length+'건':'')+'</div></div>'
  +'<div class="card"><h2>오늘 처리할 일</h2>'+(todo||'<div class="note">✔ 처리할 일이 없습니다.</div>')+'</div>';
 if(!d.jobs.length)return h+sNone('등록된 공사가 없습니다. ☰ → 공사 관리에서 [+ 새 공사 만들기]로 시작하세요.');
 h+='<div class="card"><h2>공사 일정</h2>'+act.concat(ended.slice(0,5)).map(j=>ganttRow(j,t,true)).join('')+'</div>';
 if(act.length&&act.length<=3)h+=act.map(j=>{const R=sRates(j);return '<div class="card"><h2 style="margin:0">'+escapeText(j.title)+'</h2><div class="muted">'+sMeta(j)+' · 업체 '+j.vendors.length+'곳</div><div class="dns">'+donut(R.insp,'순회점검',R.inspTxt)+donut(R.permit,'작업허가서',R.permitTxt)+donut(R.crew,'인원·수칙',R.crewTxt)+'</div><p class="muted" style="text-align:center;margin:4px 0 0">참여 업체 합계 · 작업일 기준</p>'+sVendorRows(j)+'</div>'}).join('');
 else if(act.length)h+='<div class="card"><h2>공사별 이행률</h2><table class="rtable"><tr><th>공사</th><th>순회</th><th>허가서</th><th>인원</th><th>미조치</th></tr>'+act.map(j=>{const R=sRates(j);return '<tr><td><b>'+escapeText(j.title)+'</b><div class="muted">'+escapeText(j.storeName)+'</div></td><td'+(R.insp!=null&&R.insp<0.6?' class="req"':'')+'>'+pctTxt(R.insp)+'</td><td>'+pctTxt(R.permit)+'</td><td>'+pctTxt(R.crew)+'</td><td'+(j.findOpen?' class="req"':'')+'>'+(j.findOpen||0)+'</td></tr>'}).join('')+'</table></div>';
 if(safety)h+=sWatch(d);return h}
function sVendorRows(j){const V=j.vstats||[];if(V.length<2)return '';return '<details class="hist"><summary>업체별 보기 '+V.length+'곳</summary>'+V.map(v=>'<div class="item" style="padding:8px 0"><b>'+escapeText(v.company)+'</b><div class="muted">순회점검 '+(v.inspNeed?v.insp+'/'+v.inspNeed+'회':'-')+' · 허가서 '+(v.workDays?v.permitDays+'/'+v.workDays+'일':'-')+' · 미조치 '+v.openFindings+'건</div></div>').join('')+'</details>'}
/** 안전보건팀: 주의가 필요한 공사·업체 + 업체별 지적 현황 */
function sWatch(d){const t=kstToday(),rows=[];
 sAct(d).forEach(j=>{if(j.end&&j.end.state==='OVER')rows.push([j.title,'공사 전체','종료일 경과 · 연장 또는 종료 필요']);
  (j.vstats||[]).forEach(v=>{const r=[];if(v.inspNeed&&v.insp/v.inspNeed<0.6)r.push('순회점검 '+Math.round(v.insp/v.inspNeed*100)+'%');if(v.openFindings>=2)r.push('미조치 지적 '+v.openFindings+'건');if(v.workDays&&v.permitDays/v.workDays<0.6)r.push('허가서 '+Math.round(v.permitDays/v.workDays*100)+'%');if(v.inspDue&&!v.inspToday&&v.lastInsp&&(new Date(t)-new Date(v.lastInsp))/864e5>=4)r.push('순회점검 '+Math.round((new Date(t)-new Date(v.lastInsp))/864e5)+'일 없음');if(r.length)rows.push([j.title,v.company,r.join(' · ')])})});
 const by={};d.jobs.forEach(j=>(j.vstats||[]).forEach(v=>{const x=by[v.companyId]||(by[v.companyId]={company:v.company,total:0,open:0,jobs:0});x.total+=v.findTotal||0;x.open+=v.openFindings||0;x.jobs++}));
 const top=Object.values(by).filter(x=>x.total).sort((a,b)=>b.total-a.total||b.open-a.open).slice(0,5);
 return '<div class="card"><h2>주의가 필요한 공사·업체 '+(rows.length?'<span class="cnt">'+rows.length+'</span>':'')+'</h2>'+(rows.length?'<table class="rtable"><tr><th>공사</th><th>업체</th><th>내용</th></tr>'+rows.slice(0,12).map(r=>'<tr><td>'+escapeText(r[0])+'</td><td>'+escapeText(r[1])+'</td><td class="req">'+escapeText(r[2])+'</td></tr>').join('')+'</table>':'<p class="muted">기준(순회점검·허가서 60% 미만, 미조치 2건 이상, 종료일 경과)에 걸린 곳이 없습니다.</p>')+'</div>'
  +'<div class="card"><h2>업체별 지적 현황</h2>'+(top.length?'<table class="rtable"><tr><th>업체</th><th>지적</th><th>미조치</th><th>공사</th></tr>'+top.map(x=>'<tr><td>'+escapeText(x.company)+'</td><td>'+x.total+'</td><td'+(x.open?' class="req"':'')+'>'+x.open+'</td><td>'+x.jobs+'</td></tr>').join('')+'</table>':'<p class="muted">아직 순회점검 지적사항이 없습니다.</p>')+'</div>'}
/* 공사 관리 */
function sJobs(d){const nv=((state&&state.badges&&state.badges.newVendors)||[]);
 return '<div class="card"><div class="vh-top"><h2 style="margin:0">공사 관리</h2><button class="button" type="button" onclick="jobForm()">+ 새 공사 만들기</button></div><p class="muted" style="margin-top:6px">공사를 만들고 업체를 배정합니다. 기간 연장·공사 종료도 여기서 합니다.</p></div>'
  +(nv.length?'<div class="card alertcard"><div class="vh-top"><h2 style="margin:0">공사 배정 대기 업체 <span class="cnt">'+nv.length+'</span></h2><button class="button" type="button" onclick="goNewJob('+escapeText(JSON.stringify(nv.map(v=>v.id)))+')">이 업체로 공사 만들기</button></div>'+nv.map(v=>'<div class="muted">· '+escapeText(v.company)+' ('+escapeText(v.industry)+')</div>').join('')+'</div>':'')
  +(d.jobs.map(j=>'<div class="card"><div class="vh-top"><div><h2 style="margin:0">'+escapeText(j.title)+(j.status==='ENDED'?' <span class="pill todo">종료</span>':'')+'</h2><div class="muted">'+escapeText(j.kindLabel)+' · '+sMeta(j)+'</div></div><div class="row"><button class="button ghost" type="button" onclick="jobForm(\''+escapeText(j.id)+'\')">수정</button><button class="button ghost danger" type="button" onclick="delJob(\''+escapeText(j.id)+'\')">삭제</button></div></div>'
   +'<div class="desc" style="margin-top:8px"><b>참여 업체 '+j.vendors.length+'곳</b> · '+(j.vendors.map(v=>escapeText(v.company)+' <span class="muted">('+escapeText(v.trade)+')</span>').join(', ')||'없음')+'</div>'
   /* F1.8l 자동으로 만들어진 미팅 (실시 전 · 진행 중) — 날짜만 고치고 현장에서 [▶ 미팅 시작] */
   +((j.meetings||[]).filter(m=>!m.done).map(sMeetRow).join(''))
   /* F1.8k 공사 서류 (자동): 도급인 위임장 2장 · 업체별 현장대리인계 */
   +'<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px"><button class="fxchip" type="button" onclick="jobPaperView(\''+escapeText(j.id)+'\',\'COUNCIL\')">📄 협의체 위임장</button><button class="fxchip" type="button" onclick="jobPaperView(\''+escapeText(j.id)+'\',\'JOINT\')">📄 합동점검 위임장</button>'
   +j.vendors.map(v=>'<button class="fxchip" type="button" onclick="jobPaperView(\''+escapeText(j.id)+'\',\'AGENT\',\''+escapeText(v.companyId)+'\')">📄 현장대리인계 · '+escapeText(v.company)+'</button>').join('')+'</div>'
   +jobEndHtml(j)+'</div>').join('')||sNone('등록된 공사가 없습니다. [+ 새 공사 만들기]로 시작하세요.'))}
/* 협의체·합동점검 */
/* F1.8l 미팅 줄: 날짜만 바로 고치기(실시 전) · [▶ 미팅 시작] = 방 열기 + QR · 끝난 건 [보기] */
const meetKindTxt=m=>((m.kinds||[]).map(k=>(jobData&&jobData.meetKinds||{})[k]||k).join(' + ')||'');
function sMeetRow(m){const edit=!m.done&&!m.open;return '<div class="item"><div class="row" style="justify-content:space-between"><div><b>📢 '+escapeText(m.title)+'</b> '+(m.done?'<span class="pill ok">✔ 실시 완료</span>':m.open?'<span class="pill ok">진행 중</span>':'<span class="pill todo">실시 전</span>')
 +'<div class="muted">'+(edit?'<input type="date" value="'+escapeText(m.date)+'" aria-label="'+escapeText(m.title)+' 날짜" onchange="meetDate(\''+escapeText(m.id)+'\',this.value)" style="padding:4px 6px;border:1px solid var(--line);border-radius:8px;font:inherit"> ✎':escapeText(m.date))+' · '+escapeText(meetKindTxt(m))+' · 참석 '+m.count+'명'+(m.pending?' · <b class="req">확인 대기 '+m.pending+'</b>':'')+'</div></div><div class="row"><button class="button'+(m.done?' ghost':'')+'" type="button" onclick="'+(m.done?'openRoom':'meetStart')+'(\''+escapeText(m.id)+'\')">'+(m.done?'보기':m.open?'들어가기':'▶ 미팅 시작')+'</button><button class="button ghost danger" type="button" onclick="delMeet(\''+escapeText(m.id)+'\')">삭제</button></div></div></div>'}
function sMeet(d){const act=sAct(d),ended=sEnded(d);
 return '<div class="card"><div class="vh-top"><h2 style="margin:0">협의체·합동점검</h2><button class="button ghost" type="button" onclick="sScan()">📷 QR로 참석 체크</button></div><p class="muted" style="margin-top:6px">착수 미팅(협의체 + 합동점검)은 공사를 저장하면 자동으로 생기고, 공사가 다음 달·분기로 이어지면 자동으로 추가됩니다. 현장에서 [▶ 미팅 시작]을 누르세요.</p></div>'
  +(act.map(j=>'<div class="card"><div class="vh-top"><div><h2 style="margin:0">'+escapeText(j.title)+'</h2><div class="muted">'+sMeta(j)+'</div></div><button class="button ghost" type="button" onclick="meetForm(\''+escapeText(j.id)+'\')">+ 임시 미팅 추가</button></div>'+(j.meetings.map(sMeetRow).join('')||'<p class="muted" style="margin-top:8px">아직 미팅 방이 없습니다.</p>')+'</div>').join('')||sNone('진행 중인 공사가 없습니다.'))
  +(ended.length?'<div class="card"><details class="hist"><summary>종료된 공사 미팅 기록 '+ended.length+'건</summary>'+ended.map(j=>'<div class="stage">'+escapeText(j.title)+'</div>'+(j.meetings.map(sMeetRow).join('')||'<p class="muted">미팅 없음</p>')).join('')+'</details></div>':'')}
function sScan(){jobsMode='scan';renderVMeet('jobs','loadJobs()')}
/* 작업허가서 승인 · 순회점검 확인 */
function sJobList(d,title,desc,row){const act=sAct(d),ended=sEnded(d),item=j=>{const r=row(j);return '<button class="jobitem" type="button" onclick="'+r[0]+'"><div><b>'+escapeText(j.title)+'</b> '+r[1]+'<div class="muted">'+sMeta(j)+'</div><div class="muted">'+r[2]+'</div></div><span aria-hidden="true">›</span></button>'};
 return '<div class="card"><h2 style="margin:0">'+title+'</h2><p class="muted" style="margin-top:6px">'+desc+'</p></div><div class="card">'+(act.map(item).join('')||'<p class="muted">진행 중인 공사가 없습니다.</p>')+'</div>'
  +(ended.length?'<div class="card"><details class="hist"><summary>종료된 공사 '+ended.length+'건</summary>'+ended.map(item).join('')+'</details></div>':'')}
function sPermit(d){return sJobList(d,'작업허가서 승인','업체가 발행한 작업허가서를 확인하고 승인합니다. (업체는 발행 즉시 작업 · 도급인 승인은 사후)',j=>['openPermitList(\''+escapeText(j.id)+'\')',j.permitWaiting?'<span class="cnt">'+j.permitWaiting+'</span>':'','허가서 '+(j.permitTotal||0)+'건'+(j.permitWaiting?' · <b class="req">승인 대기 '+j.permitWaiting+'</b>':'')])}
function sInsp(d){return sJobList(d,'순회점검 확인','업체가 작성한 순회점검일지(2일 1회)를 확인하고, 미조치 지적사항을 챙깁니다.',j=>['openInspList(\''+escapeText(j.id)+'\')',j.inspUnchecked?'<span class="cnt">'+j.inspUnchecked+'</span>':'','일지 '+(j.inspTotal||0)+'건'+(j.inspUnchecked?' · <b class="req">확인 대기 '+j.inspUnchecked+'</b>':'')+(j.findOpen?' · <b class="req">미조치 '+j.findOpen+'</b>':'')])}
/* 종료 평가 */
function sEval(d){const act=sAct(d),ended=sEnded(d),soon=act.filter(j=>j.end&&['SOON','OVER'].includes(j.end.state));
 return '<div class="card"><h2 style="margin:0">종료 평가</h2><p class="muted" style="margin-top:6px">공사를 종료하면 업체별 평가서가 만들어집니다. 수행 기록으로 자동 체크된 결과를 확인하고 확정합니다.</p></div>'
  +(soon.length?'<div class="card"><h2>종료 예정·종료일 경과</h2>'+soon.map(j=>'<button class="jobitem" type="button" onclick="jobEndPage(\''+escapeText(j.id)+'\')"><div><b>'+escapeText(j.title)+'</b> '+(j.end.state==='OVER'?'<span class="pill bad">종료일 경과</span>':'<span class="pill todo">종료 '+(j.end.left?j.end.left+'일 전':'오늘')+'</span>')+'<div class="muted">'+sMeta(j)+' · 연장 또는 종료</div></div><span aria-hidden="true">›</span></button>').join('')+'</div>':'')
  +'<div class="card"><h2>종료된 공사</h2>'+(ended.map(j=>{const need=(j.evalTotal||0)-(j.evalDone||0);return '<button class="jobitem" type="button" onclick="openJobEval(\''+escapeText(j.id)+'\')"><div><b>'+escapeText(j.title)+'</b> '+(need?'<span class="cnt">'+need+'</span>':'<span class="pill ok">완료</span>')+'<div class="muted">'+sMeta(j)+'</div><div class="muted">종료 평가 '+(j.evalDone||0)+' / '+(j.evalTotal||0)+' 완료</div></div><span aria-hidden="true">›</span></button>'}).join('')||'<p class="muted">아직 종료된 공사가 없습니다. 공사가 끝나면 [공사 관리] → [연장·종료]에서 종료하세요.</p>')+'</div>'}
/* ---------- 업체 현황 (사업자 승인 + 제출자료 검토 통합) ---------- */
/* v5.17 재평가 중 · 유효기간 만료 표시 */
const SV_ST=b=>b.status==='PENDING'?['가입 승인 대기','bad','pending']:b.status==='REJECTED'?['반려','todo','etc']:b.renewAt&&b.submissionStatus!=='APPROVED'?(['SUBMITTED','SAFETY_REVIEW'].includes(b.submissionStatus)?['재평가 검토 중','bad','review']:['재평가 '+(b.submissionStatus==='CORRECTION'?'보완 요청':'작성 중'),'todo','draft']):b.submissionStatus==='APPROVED'&&b.valid&&b.valid.expired?['평가 만료','todo','draft']:({DRAFT:['서류 작성 중','todo','draft'],CORRECTION:['보완 요청','todo','draft'],SUBMITTED:['1차 검토 중','bad','review'],SAFETY_REVIEW:['확인 중','bad','review'],APPROVED:['승인 완료','ok','ok']}[b.submissionStatus||'DRAFT']||[b.submissionStatus,'todo','etc']);
async function loadVendors(){if(!svData)svData=cacheGet('vendorList',[]);if(svData){seenTab.vendors=1;renderVendors()}try{const x=await fetcher('vendors')('vendorList');svData=x;if(tab==='vendors')renderVendors()}catch(e){}}
function svSet(f){svFilter=f;renderVendors()}
function renderVendors(){const L=svData.list,F=[['all','전체'],['pending','가입 대기'],['draft','작성 중'],['review','검토 중'],['ok','승인']],cnt=k=>k==='all'?L.length:L.filter(b=>SV_ST(b)[2]===k).length,list=L.filter(b=>svFilter==='all'||SV_ST(b)[2]===svFilter);
 $('vendors').innerHTML='<div class="card"><h2 style="margin:0">업체 현황</h2><p class="muted" style="margin-top:6px">가입 승인·서류 검토는 담당자 메일 링크로 처리됩니다. 여기서는 업체 상태와 제출 서류를 확인합니다.</p><div class="seg" role="tablist">'+F.map(([k,l])=>'<button type="button" role="tab" aria-selected="'+(svFilter===k)+'" class="'+(svFilter===k?'on':'')+'" onclick="svSet(\''+k+'\')">'+l+' '+cnt(k)+'</button>').join('')+'</div></div>'
  +'<div class="card">'+(list.map(b=>{const st=SV_ST(b),e=b.contractEval,l=b.lastEval;
   return '<details class="svitem"><summary><div><b>'+escapeText(b.company)+'</b> <span class="pill '+st[1]+'">'+escapeText(st[0])+'</span><div class="muted">'+escapeText(b.industry)+' · 공사 '+b.jobs+'건'+(l?' · 지난 종료 평가 '+escapeText(l.grade)+'등급':'')+'</div></div></summary>'
    +'<table class="rtable" style="margin-top:8px"><tr><th>대표자</th><td>'+escapeText(b.representative)+'</td></tr><tr><th>담당자</th><td>'+escapeText(b.contact)+' · '+escapeText(b.phone)+'</td></tr><tr><th>사업자번호</th><td>'+escapeText(b.regNo)+'</td></tr><tr><th>업체 계정</th><td>'+escapeText(b.email)+'</td></tr><tr><th>승인 담당자</th><td>'+escapeText(b.approverEmail||'-')+'</td></tr>'
    +(e?'<tr><th>계약 전 평가</th><td>우수 '+e.good+' · 보통 '+e.normal+' · 미흡 '+e.poor+' <span class="muted">'+escapeText(fmtTime(e.at))+'</span></td></tr>':'')
    +(b.valid?'<tr><th>평가 유효기간</th><td>'+escapeText(b.valid.from)+' ~ '+escapeText(b.valid.until)+' '+(b.valid.expired?'<b class="req">만료 · 새 공사 배정 불가</b>':b.valid.days<=30?'<b class="req">D-'+b.valid.days+'</b>':'<span class="muted">D-'+b.valid.days+'</span>')+(b.renewAt?'<div class="muted">재평가 진행 중 (시작 '+escapeText(fmtTime(b.renewAt))+')</div>':'')+'</td></tr>':'')+(l?'<tr><th>지난 종료 평가</th><td>'+l.total+'점 '+escapeText(l.grade)+'등급 <span class="muted">'+escapeText(l.job)+'</span>'+(l.comment?'<div class="muted">개선사항: '+escapeText(l.comment)+'</div>':'')+'</td></tr>':'')+'</table>'
    +(b.docs.length?'<div class="stage">제출 서류</div>'+b.docs.map(t=>'<div class="muted">'+escapeText(t.name)+': '+(t.uploads.length?t.uploads.slice(0,1).map(u=>'<a onclick="downloadAdminFile(\''+escapeText(b.id)+'\',\''+escapeText(u.id)+'\')">📄 v'+escapeText(u.version)+' '+escapeText(u.name)+'</a>').join(''):'미제출')+'</div>').join('')+(b.evidence.length?'<div class="muted">계획서 증빙: '+b.evidence.map(u=>'<a onclick="downloadAdminFile(\''+escapeText(b.id)+'\',\''+escapeText(u.id)+'\')">📎 '+escapeText(u.name)+'</a>').join(' ')+'</div>':''):'')
    +(st[2]==='pending'?'<div class="row" style="margin-top:10px">'+(b.certMissing?'':'<button class="button ghost" type="button" onclick="registrationDocs(\''+escapeText(b.id)+'\')">사업자등록증</button>')+'<button class="button" type="button" onclick="svDecide(\''+escapeText(b.id)+'\',\'APPROVE\')">가입 승인</button><button class="button ghost" type="button" onclick="svDecide(\''+escapeText(b.id)+'\',\'REJECT\')">반려</button></div>':'')+'</details>'}).join('')||'<p class="muted">해당하는 업체가 없습니다.</p>')+'</div>'}
async function svDecide(id,d){const reason=d==='REJECT'?prompt('반려 사유를 입력하세요.'):'';if(d==='REJECT'&&reason===null)return;if(!confirm(d==='APPROVE'?'가입을 승인할까요?\n업체는 바로 계약 전 서류를 작성할 수 있습니다.':'가입을 반려할까요?'))return;
 try{const r=await call('decideBusiness',id,d,reason,'vendors');svData=r&&r.list?r:await call('vendorList');renderVendors();msg('처리했습니다.');refreshBadges()}catch(e){}}/* v5.18 승인 결과에 업체 현황이 같이 옴 (2번 → 1번) */
