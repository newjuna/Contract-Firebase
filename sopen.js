/* F2.4 오픈지원 도급인 업무 (공사 관리 · 대시보드의 오픈 매장 카드 → [도급인 업무])
 *  ① 순회점검: 업체별 오늘 점검표 (공통 5 + 계획서 오픈지원 위험요인) · 불량 = 지적 내용 + 사진 → 현장관리자 · 계약담당자에게 조치 요청
 *  ② 비상훈련: 대피 또는 소화기 · 도급인이 사진 · 근로자는 QR(?review=DRL-토큰)로 참석 · 휴대폰 없는 사람은 이름만 추가
 *  서버: fb.js openStaffPack · staffOpenInsp · drillOpen · drillSave · drillAddName · drillDelAtt · drillClose · drillCheckIn (중계 staffInsp_ · drillIn_) */
let opData=null,opTab='insp',opIns=null,opDrill='',opTimer=null,opBusy=false;
const opJobId=()=>opData&&opData.job.id;
async function openOpen(jobId,tab){try{opData=await call('openStaffPack',jobId)}catch(e){return}opTab=tab||'today';opIns=null;opDrill='';jobsMode='open';opDraw();window.scrollTo(0,0)}
function opBack(){clearInterval(opTimer);opTimer=null;opData=null;opIns=null;opDrill='';jobsMode='list';renderJobs()}
/* F2.8 매장 상세 = [오늘 할 일] (① 업체별 순회점검 ② 비상훈련 ③ 지적사항) · [업체별 기록] · [집계] · 설명 글은 위쪽 [❔ 가이드] */
function opDraw(){clearInterval(opTimer);opTimer=null;const d=opData,el=$('jobs');if(!el||!d)return;if(opIns)return opInsDraw();if(opDrill)return opDrillDraw();
 if(opTab==='insp'||opTab==='drill')opTab='today';
 const j=d.job,seg=(k,l)=>'<button type="button" class="'+(opTab===k?'on':'')+'" aria-pressed="'+(opTab===k)+'" onclick="opTab=\''+k+'\';opDraw()">'+l+'</button>';
 const head='<div class="card"><button class="button ghost" type="button" onclick="opBack()">← 돌아가기</button><div class="row" style="justify-content:space-between;margin-top:12px"><h2 style="margin:0">'+escapeText(j.storeName||j.title)+(j.status==='ENDED'?' <span class="pill todo">종료</span>':'')+'</h2><span class="muted">'+omd(j.startDate)+' ~ '+omd(j.endDate)+'</span></div>'
  +'<div class="seg" role="tablist" id="opSeg" style="margin-top:10px">'+seg('today','오늘 할 일')+seg('rec','업체별 기록')+seg('agg','집계')+'</div></div>';
 if(opTab==='agg'){el.innerHTML=head+'<div id="opAggBox"><div class="card"><p class="desc">계산하는 중입니다…</p></div></div>';if(typeof opAggLoad==='function')opAggLoad();setTopGuide('');return}  // F2.5
 el.innerHTML=head+(opTab==='rec'?opRecHtml():opTodayHtml());setTopGuide(opTab==='rec'?'sorec':'sotoday');
 loadInspPhotos(j.id)}
/** [오늘 할 일] ① 업체별 순회점검 (오늘 했으면 '✔ 오늘 완료') ② 비상훈련 (매장당 1회 · 마친 날만 '완료' · 다음 날부터 안 보임) ③ 지적사항 [📢 요청] [조치하기] */
function opTodayHtml(){const d=opData,t=d.today,ended=d.job.status==='ENDED';if(!d.vendors.length)return '<div class="card"><p class="muted" style="margin:0">배정된 업체가 없습니다.</p></div>';
 const ins=d.vendors.map(v=>{const ti=v.todayInsp,cid=escapeText(v.companyId);
  return '<div class="card opvc" style="position:relative">'+(ti?doneMask('순회점검 '+v.company):'')+'<div class="vh-top"><h2 style="margin:0;font-size:16px">① 순회점검 · '+escapeText(v.company)+'</h2>'+(ti?'<span class="pill '+(ti.bad?'bad':'ok')+'">'+(ti.bad?'지적 '+ti.bad:'✔ 이상 없음')+'</span>':'')+'</div>'
   +'<div class="muted" style="margin-top:4px">관리감독자 '+(v.siteMgr?'<b style="color:#111827">'+escapeText(v.siteMgr)+'</b>':'<b class="req">미지정</b>')+' · '+(v.tbm.length?'오늘 TBM '+v.tbm.length+'장':'<span class="req">오늘 TBM 전</span>')+'</div>'
   +(v.tbm.length?'<div class="row" style="margin-top:6px">'+thumbs(v.tbm.slice(0,4),'')+'</div>':'')
   +(ended||ti?'':'<button class="button opInsBtn" type="button" style="width:100%;margin-top:10px" onclick="opInsOpen(\''+cid+'\')">📝 오늘 순회점검 작성</button>')+'</div>'}).join('');
 const L=d.drills||[],cur=L.find(x=>x.open),fin=L.filter(x=>x.done).sort((p,q)=>String(p.date).localeCompare(String(q.date)))[0];
 let dr='';
 if(cur)dr='<div class="card" id="opDrCard"><div class="vh-top"><h2 style="margin:0;font-size:16px">② 비상훈련</h2><span class="pill bad">진행 중 · QR 열림</span></div><button class="button" type="button" style="width:100%;margin-top:10px" onclick="opDrill=\''+escapeText(cur.id)+'\';opDraw()">▶ '+escapeText(cur.label)+' · 참석 '+cur.attendees.length+'명</button></div>';
 else if(fin&&fin.date===t)dr='<div class="card" id="opDrCard" style="position:relative">'+doneMask('비상훈련')+'<div class="vh-top"><h2 style="margin:0;font-size:16px">② 비상훈련</h2><span class="pill ok">✔ 완료</span></div><div class="muted" style="margin-top:4px">'+escapeText(fin.label)+' · 참석 '+fin.attendees.length+'명 · 사진 '+fin.photos.length+'장</div><button class="button ghost" type="button" style="width:100%;margin-top:10px" onclick="opDrill=\''+escapeText(fin.id)+'\';opDraw()">기록 보기</button></div>';
 else if(!fin&&!ended)dr='<div class="card" id="opDrCard"><h2 style="margin:0 0 8px;font-size:16px">② 비상훈련</h2><div class="row" style="gap:6px">'+Object.entries(d.types).map(([k,l])=>'<button class="button'+(k==='EVAC'?'':' ghost')+'" type="button" style="flex:1" onclick="opDrillStart(\''+k+'\')">'+(k==='EVAC'?'🚨 ':'🧯 ')+escapeText(l)+' 시작</button>').join('')+'</div></div>';
 const F=[];d.vendors.forEach(v=>(v.open||[]).forEach(f=>F.push(Object.assign({company:v.company},f))));F.sort((p,q)=>((q.reqN?1:0)-(p.reqN?1:0))||String(q.foundDate).localeCompare(String(p.foundDate)));
 const fx='<div class="card" id="opFixCard"><div class="vh-top"><h2 style="margin:0;font-size:16px">③ 지적사항 조치</h2>'+(F.length?'<span class="pill bad">미조치 '+F.length+'</span>':'<span class="pill ok">미조치 없음</span>')+'</div>'
  +F.map(f=>{const age=dayDiff(f.foundDate,t);return '<div class="item"><div><b>'+escapeText(f.item)+'</b>'+reqPill(f)+'<div class="muted">'+escapeText(omd(f.foundDate))+' · '+escapeText(f.company)+(age>=1?' · <span class="req">'+age+'일째</span>':'')+(f.memo?' · '+escapeText(f.memo):'')+'</div></div>'
   +'<div class="row" style="gap:6px;margin-top:6px"><button class="button ghost opReqBtn" type="button" style="flex:1;padding:8px;font-size:13px" onclick="dashReq(\''+escapeText(d.job.id)+'\',\''+escapeText(f.id)+'\')">📢 조치 요청</button><button class="button opFixBtn" type="button" style="flex:1;padding:8px;font-size:13px" onclick="opFix(\''+escapeText(f.id)+'\')">조치하기</button></div></div>'}).join('')+'</div>';
 return ins+dr+fx}
/** 도급인이 대신 조치 등록 (인테리어와 같은 화면) → 끝나면 이 매장 [오늘 할 일] */
async function opFix(fid){const jid=opData.job.id;try{inspJob=await call('inspList',jid)}catch(e){return}if(!(inspJob.findings||[]).some(f=>f.id===fid&&f.status!=='DONE')){msg('이미 조치된 지적사항입니다.');openOpen(jid,'today');return}
 setTopGuide('');jobsMode='insp';openResolve(fid,'staff','open');window.scrollTo(0,0)}
/** 날짜 목록 (최근 → 시작일, 최대 30일) */
function opDays(s,e,t){const L=[],end=e&&e<t?e:t;if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return L;let x=end;while(x>=s&&L.length<30){L.push(x);x=new Date(Date.parse(x+'T00:00:00Z')-864e5).toISOString().slice(0,10)}return L}
/** [업체별 기록] 날짜별 TBM · 순회점검 · 지적 / 조치 완료 / 비상훈련 기록 */
function opRecHtml(){const d=opData,days=opDays(d.job.startDate,d.job.endDate,d.today);
 const vs=d.vendors.map(v=>{const R={};(v.recent||[]).forEach(x=>R[x.date]=x);const T=new Set(v.tbmDates||[]);
  return '<div class="card opRecV"><div class="vh-top"><h2 style="margin:0;font-size:16px">'+escapeText(v.company)+'</h2><span class="muted">관리감독자 '+(v.siteMgr?escapeText(v.siteMgr):'<b class="req">미지정</b>')+'</span></div>'
   +(days.length?'<table class="rtable" style="margin-top:8px"><tr><th>날짜</th><th>TBM</th><th>순회점검</th><th>지적</th></tr>'+days.map(x=>{const r=R[x];return '<tr><td>'+escapeText(mdw(x))+'</td><td>'+(T.has(x)?'<span style="color:var(--ok)">✔</span>':'<span class="muted">-</span>')+'</td><td>'+(r?'<span style="color:var(--ok)">✔</span>':'<span class="muted">-</span>')+'</td><td'+(r&&r.bad?' class="req"':'')+'>'+(r?r.bad:'-')+'</td></tr>'}).join('')+'</table>':'<p class="muted">아직 시작 전입니다.</p>')
   +((v.done||[]).length?'<details class="hist" style="margin-top:8px"><summary>조치 완료 '+v.done.length+'건</summary>'+v.done.map(f=>'<div class="row" style="justify-content:space-between;padding:6px 0;border-top:1px solid var(--line)"><span class="muted">'+escapeText(omd(f.actionDate))+' · '+escapeText(f.item)+' · '+escapeText(f.actionBy)+(f.reqN?' · 요청 '+f.reqN+'회':'')+'</span>'+(f.inspId?'<button class="linkbtn" type="button" style="font-size:12px;white-space:nowrap" onclick="dashViewS(\''+escapeText(d.job.id)+'\',\''+escapeText(f.inspId)+'\')">보기</button>':'')+'</div>').join('')+'</details>':'')+'</div>'}).join('');
 const L=d.drills||[];
 return vs+'<div class="card" id="opRecDr"><h2 style="margin:0 0 4px;font-size:16px">비상훈련 기록</h2>'+(L.length?L.map(x=>'<button class="jobitem" type="button" onclick="opDrill=\''+escapeText(x.id)+'\';opDraw()"><div><b>'+escapeText(x.label)+'</b> '+(x.done?'<span class="pill ok">✔ 완료</span>':'<span class="pill bad">진행 중</span>')+'<div class="muted">'+escapeText(mdw(x.date))+' · 참석 '+x.attendees.length+'명 · 사진 '+x.photos.length+'장 · '+escapeText(x.hostName)+'</div></div><span aria-hidden="true">›</span></button>').join(''):'<p class="muted" style="margin:6px 0 0">아직 진행한 비상훈련이 없습니다.</p>')+'</div>'}
/* ---------- F2.8 오픈지원 담당 대시보드 ---------- */
function sDashOpen(d){const t=kstToday(),act=sAct(d),ended=sEnded(d),B=(state&&state.badges)||{};setTimeout(()=>{sBadges(state&&state.badges);setTopGuide('sodash')},0);
 const O=j=>j.open||{tbm:[],sm:[],drill:{}},smOf=(j,cid)=>(O(j).sm.find(x=>x.companyId===cid)||{}).name||'',vsOf=j=>j.vstats||[];
 const started=j=>j.startDate<=t,noIns=act.filter(j=>started(j)&&vsOf(j).some(v=>!v.inspToday)),noDr=act.filter(j=>started(j)&&!O(j).drill.done&&!O(j).drill.open),nF=sum(act,j=>j.findOpen);
 const st=(v,l,c)=>'<div class="'+(c||'')+'"><b>'+v+'</b>'+l+'</div>';
 const job=j=>{const s=j.startDate,e=j.endDate||s,tot=Math.max(1,dayDiff(s,e)+1),pct=Math.max(0,Math.min(100,Math.round((dayDiff(s,t)+1)/tot*100))),V=vsOf(j),o=O(j),tb=V.filter(v=>o.tbm.includes(v.companyId)).length;
  const warn=started(j)&&(V.some(v=>!v.inspToday||!smOf(j,v.companyId))||j.findOpen>0||(!o.drill.done&&!o.drill.open));
  return '<button type="button" class="odjob'+(warn?' warn':'')+'" onclick="openOpen(\''+escapeText(j.id)+'\',\'today\')" aria-label="'+escapeText(j.storeName+' 오늘 할 일')+'"><span class="odrow"><b>'+escapeText(j.storeName||j.title)+'</b><span class="muted">'+omd(s)+' ~ '+omd(e)+'</span></span>'
   +V.map(v=>{const n=smOf(j,v.companyId);return '<span class="odvr"><span><b>'+escapeText(v.company)+'</b> · 관리감독자 '+(n?escapeText(n):'<b class="req">미지정</b>')+'</span>'+(!started(j)?'<span class="pill lock">시작 전</span>':v.inspToday?'<span class="pill ok">✔ 점검</span>':'<span class="pill bad">점검 전</span>')+'</span>'}).join('')
   +'<span class="odbar" aria-hidden="true"><span style="width:'+(s>t?0:pct)+'%"></span></span>'
   +'<span class="odst">'+st(V.length&&tb===V.length?'✔':tb?tb+'/'+V.length:'-','TBM',V.length&&tb===V.length?'ok':'')+st(j.workerCount||0,'근로자')+st(j.findOpen||0,'미조치',j.findOpen?'r':'')+st(o.drill.done?'✔':o.drill.open?'…':'-','비상훈련',o.drill.done?'ok':'')+'</span></button>'};
 const todo=(l,v,fn)=>'<button class="vtodo" type="button" onclick="'+fn+'"><span>'+l+'</span><span class="req">'+v+' ›</span></button>';
 const nv=(B.newVendors||[]).filter(v=>sIndOk(v.industry)).length,pa=sum(act,j=>sum(j.meetings||[],m=>m.pending));
 const mt=[];act.forEach(j=>(j.meetings||[]).forEach(m=>{if(!m.done&&m.date>=t)mt.push(Object.assign({store:j.storeName},m))}));mt.sort((p,q)=>String(p.date).localeCompare(String(q.date)));
 const al=typeof sAlertBarHtml==='function'?sAlertBarHtml(d):'';
 return (al?'<div class="card">'+al+'</div>':'')
  +'<div class="card" id="soJobs"><h2 style="margin:0 0 4px">진행 중인 오픈 매장</h2>'+(act.length?act.map(job).join(''):'<p class="muted" style="margin:6px 0 0">없음 · ☰ [오픈 매장 관리]에서 만듭니다.</p>')+'</div>'
  +'<div id="soTodo">'+(noIns.length?todo('오늘 순회점검 전',noIns.length+'곳','openOpen(\''+escapeText(noIns[0].id)+'\',\'today\')'):'')
  +(noDr.length?todo('비상훈련 전',noDr.length+'곳','openOpen(\''+escapeText(noDr[0].id)+'\',\'today\')'):'')
  +(mt.length?todo('협의체 · 합동점검 '+mdw(mt[0].date),escapeText(mt[0].store),'sgo(\'meet\')'):'')
  +(pa?todo('미팅 참석 확인 대기',pa+'명','sgo(\'meet\')'):'')
  +(nF?todo('미조치 지적사항',nF+'건','document.getElementById(\'fxCard\')?.scrollIntoView({block:\'start\'})'):'')
  +(nv?todo('공사 배정 대기 업체',nv+'곳','sgo(\'jobs\')'):'')+'</div>'
  +fixCardHtml()
  +(ended.length?'<div class="card"><details class="hist"><summary>끝난 오픈 매장 '+ended.length+'곳</summary>'+ended.map(j=>'<button class="jobitem" type="button" onclick="openOpen(\''+escapeText(j.id)+'\',\'rec\')"><div><b>'+escapeText(j.storeName||j.title)+'</b> <span class="pill todo">종료</span><div class="muted">'+omd(j.startDate)+' ~ '+omd(j.endDate)+'</div></div><span aria-hidden="true">›</span></button>').join('')+'</details></div>':'')}
/* ---------- F2.8 ☰ 비상훈련 기록 (오픈지원 담당 · 매장별 모아 보기) ---------- */
function sDrillsView(){setTimeout(sDrLoad,0);return '<div id="sdrBox"><div class="card"><h2>비상훈련 기록</h2><p class="desc">불러오는 중입니다…</p></div></div>'}
async function sDrLoad(){let r;try{r=await callQuiet('staffDrills')}catch(e){const b=$('sdrBox');if(b)b.innerHTML='<div class="card"><p class="desc">'+escapeText(e.message||'불러오지 못했습니다.')+'</p></div>';return}
 const b=$('sdrBox');if(!b||smenu!=='drills')return;const L=r.list||[];
 b.innerHTML='<div class="card" id="sdrList"><h2 style="margin:0 0 4px">비상훈련 기록 <span class="cnt">'+L.length+'</span></h2>'+(L.length?L.map(x=>'<button class="jobitem" type="button" onclick="sDrOpen(\''+escapeText(x.jobId)+'\',\''+escapeText(x.id)+'\')"><div><b>'+escapeText(x.store)+' · '+escapeText(x.label)+'</b> '+(x.done?'<span class="pill ok">✔ 완료</span>':x.open?'<span class="pill bad">진행 중</span>':'<span class="pill lock">닫힘</span>')+'<div class="muted">'+escapeText(mdw(x.date))+' · 참석 '+x.n+'명 · 사진 '+x.photos+'장 · '+escapeText(x.hostName)+'</div></div><span aria-hidden="true">›</span></button>').join(''):'<p class="muted" style="margin:6px 0 0">아직 진행한 비상훈련이 없습니다.</p>')+'</div>';setTopGuide('sodrills')}
async function sDrOpen(jobId,id){await openOpen(jobId,'rec');if(!opData||opData.job.id!==jobId)return;opDrill=id;opDraw()}
/* ---------- ① 순회점검 ---------- */
function opInsOpen(cid){const v=opData.vendors.find(x=>x.companyId===cid);if(!v)return;const it={};v.items.forEach((_,i)=>it[i+1]='OK');opIns={cid,labels:v.items.slice(),items:it,notes:{},photos:[],memo:''};opInsDraw();window.scrollTo(0,0)}
function opInsDraw(){const o=opIns,v=opData.vendors.find(x=>x.companyId===o.cid)||{},bad=Object.values(o.items).filter(x=>x==='BAD').length;
 $('jobs').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="opIns=null;opDraw()">← 돌아가기</button><h2 style="margin-top:12px">순회점검 작성 · '+escapeText(opData.today)+'</h2><div class="muted">'+escapeText(v.company||'')+' · 다이소 '+escapeText(opData.job.storeName)+' · 점검자 도급인 '+escapeText(opData.me)+'</div></div>'
  +'<div class="card" id="opItems"><div class="vh-top"><h2 style="margin:0">점검 항목 <span class="muted" style="font-size:13px;font-weight:400">· '+o.labels.length+'개</span></h2><span id="opSum">'+(bad?'<span class="pill bad">불량 '+bad+'</span>':'')+'</span></div>'
  +o.labels.map((t,i)=>{const n=i+1,x=o.items[n];return (n===6?'<div class="stage">오픈지원 위험요인 (계획서)</div>':n===1?'<div class="stage">공통</div>':'')+'<div class="jitem'+(x==='BAD'?' bad':'')+'" id="opi_'+n+'"><div class="jq"><b>'+n+'.</b> '+escapeText(t)+'</div><div class="jm" role="radiogroup" aria-label="'+n+'번 결과">'
   +Object.entries(INSP_MARK).map(([k,l])=>'<label class="jb '+k.toLowerCase()+'"><input type="radio" name="op'+n+'" value="'+k+'" '+(x===k?'checked':'')+' onchange="opMark('+n+',\''+k+'\')"><span>'+l+'</span></label>').join('')+'</div><div id="opb_'+n+'">'+(x==='BAD'?opBadBox(n):'')+'</div></div>'}).join('')+'</div>'
  +'<div class="card roomfoot"><button class="button" type="button" id="opSave" style="width:100%" onclick="opInsSave()">순회점검 저장'+(bad?' (지적 '+bad+'건 조치 요청)':'')+'</button></div>';loadInspPhotos(opData.job.id);setTopGuide('soinsp')}
function opBadBox(n){const nt=opIns.notes[n]||(opIns.notes[n]={memo:'',photos:[]});return '<div class="jbad"><label for="f_opm'+n+'">지적 내용 <span class="req">*</span></label><input id="f_opm'+n+'" class="jmemo" value="'+escapeText(nt.memo)+'" oninput="opIns.notes['+n+'].memo=this.value" placeholder="예) 통로에 빈 박스 적치 → 즉시 정리"><div class="row" style="margin-top:8px">'+thumbs(nt.photos,'')+phBtns('opf_'+n,'opAddBad('+n+',',n+'번 불량 사진')+'</div></div>'}
function opMark(n,k){opIns.items[n]=k;const el=$('opi_'+n);el.classList.toggle('bad',k==='BAD');el.classList.remove('miss','shake');$('opb_'+n).innerHTML=k==='BAD'?opBadBox(n):'';if(k==='BAD')setTimeout(()=>$('f_opm'+n)?.focus(),50);
 const bad=Object.values(opIns.items).filter(x=>x==='BAD').length;$('opSum').innerHTML=bad?'<span class="pill bad">불량 '+bad+'</span>':''}
async function opPick(src,room){const inp=$(src),fl=[...((inp&&inp.files)||[])].slice(0,Math.max(0,room));if(inp)inp.value='';if(!fl.length)return [];const jid=opData.job.id,cid=opIns?opIns.cid:(opData.vendors[0]||{}).companyId;
 const ids=await pendPhotos(fl,async f=>{const x=await readFile(f,PHOTO_SITE);return api('uploadInspPhotoStaff',[jid,cid,x])});ids.forEach(id=>{if(PEND[id]&&PEND[id].url)inspPhoto[id]=PEND[id].url});return ids}
async function opAddBad(n,src){const nt=opIns.notes[n],ids=await opPick(src,5-nt.photos.length);if(!ids.length)return;nt.memo=$('f_opm'+n)?.value||nt.memo;nt.photos=nt.photos.concat(ids).slice(0,5);$('opb_'+n).innerHTML=opBadBox(n)}
async function opAddPh(src){const ids=await opPick(src,5-opIns.photos.length);if(!ids.length)return;opIns.photos=opIns.photos.concat(ids).slice(0,5);$('opPh').innerHTML=thumbs(opIns.photos,'opDropPh')+phBtns('opPhFile','opAddPh(','현장 사진')}
function opDropPh(id){opIns.photos=opIns.photos.filter(x=>x!==id);if(isPend(id)){pendDrop(id);delete inspPhoto[id]}$('opPh').innerHTML=thumbs(opIns.photos,'opDropPh')+phBtns('opPhFile','opAddPh(','현장 사진')}
async function opInsSave(){if(opBusy)return;const o=opIns,miss=[];Object.entries(o.items).forEach(([n,x])=>{if(x==='BAD'&&!String((o.notes[n]||{}).memo||'').trim())miss.push('f_opm'+n)});
 if(miss.length){inspFlag(miss,'불량 항목의 지적 내용을 적어 주세요');return}const bad=Object.values(o.items).filter(x=>x==='BAD').length;
 if(!await askOk('순회점검 저장',bad?'지적 '+bad+'건이 현장관리자 · 계약담당자에게 조치 요청으로 갑니다.\n저장할까요?':'이상 없음으로 저장할까요?','저장'))return;
 const lists=[o.photos].concat(Object.values(o.notes).map(x=>x.photos)),np=pendCount(lists);opBusy=true;let res=null;
 try{await subRun('순회점검 저장',[np&&['사진 '+np+'장 올리기',set=>pendUpload(lists,set,inspPhoto)],['점검 저장',async()=>{const notes={};Object.entries(o.notes).forEach(([n,x])=>{if(o.items[n]==='BAD')notes[n]=x});res=await api('staffOpenInsp',[opData.job.id,o.cid,{items:o.items,notes,labels:o.labels,photos:o.photos,memo:o.memo}])}]]);
  opData=res;opIns=null;opDraw();msg(bad?'저장했습니다 · 지적 '+bad+'건 조치 요청':'저장했습니다 · 이상 없음');jobAt=0}catch(e){showErr('순회점검을 저장하지 못했습니다',e)}finally{opBusy=false}}
/* ---------- ② 비상훈련 ---------- */
async function opDrillStart(type){if(opBusy)return;opBusy=true;try{opData=await call('drillOpen',opData.job.id,type);const x=opData.drills.find(d=>d.type===type&&d.date===opData.today&&d.open);opDrill=x?x.id:'';opDraw()}catch(e){}finally{opBusy=false}}
function opDrillDraw(){const d=opData,x=d.drills.find(y=>y.id===opDrill);if(!x){opDrill='';return opDraw()}const vs=d.vendors;
 $('jobs').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="opDrill=\'\';opDraw()">← 돌아가기</button><h2 style="margin-top:12px">'+escapeText(x.label)+' · '+escapeText(x.date)+'</h2><div class="muted">다이소 '+escapeText(d.job.storeName)+' · 진행 도급인 '+escapeText(x.hostName)+'</div>'
  +(x.done?'<div class="note" style="margin-top:8px">✔ 훈련 완료 · '+escapeText(mgrHM(x.doneAt))+'</div>':'')+'</div>'
  +(x.open?'<div class="card" style="text-align:center" id="opDrQr"><h2>근로자 참석 QR</h2><img src="'+escapeText(mgrQr(x.link))+'" alt="비상훈련 참석 QR 코드" width="230" height="230" style="border:1px solid var(--line);border-radius:12px"><div class="row" style="justify-content:center;gap:6px;margin-top:8px"><button class="button ghost" type="button" style="padding:6px 10px;font-size:13px" onclick="copyLink(\''+escapeText(x.link)+'\')">링크 복사</button><button class="button ghost" type="button" style="padding:6px 10px;font-size:13px" onclick="opRefresh()">⟳ 참석 새로 고침</button></div></div>':'')
  +'<div class="card" id="opAtt"><div class="vh-top"><h2 style="margin:0">참석자</h2><span class="cnt">'+x.attendees.length+'</span></div>'
  +(x.attendees.length?'<table class="rtable" style="margin-top:8px"><tr><th>이름</th><th>구분</th><th>방법</th>'+(x.open?'<th style="width:40px"></th>':'')+'</tr>'+x.attendees.map(a=>'<tr><td><b>'+escapeText(a.name)+'</b><div class="muted" style="font-size:11px">'+escapeText(a.company)+'</div></td><td>'+escapeText(a.role)+'</td><td class="muted" style="font-size:12px">'+(a.method==='QR'?'QR':a.method==='NAME'?'QR (이름만)':'도급인 추가')+' · '+escapeText(mgrHM(a.at))+'</td>'+(x.open?'<td><button class="linkbtn" type="button" style="font-size:12px;white-space:nowrap" onclick="opAttDel(\''+escapeText(a.id)+'\',\''+escapeText(a.name)+'\')" aria-label="'+escapeText(a.name)+' 빼기">빼기</button></td>':'')+'</tr>').join('')+'</table>':'<p class="muted" style="margin:8px 0 0">아직 참석자가 없습니다.</p>')
  +(x.open?'<form class="subbox" id="opAttForm" style="margin-top:10px" onsubmit="opAttAdd(event)"><div class="row" style="gap:6px;flex-wrap:wrap"><input id="f_opAttName" placeholder="이름만 추가" style="flex:1 1 120px;min-width:0;padding:10px;border:1px solid var(--line);border-radius:10px" aria-label="참석자 이름">'
    +(vs.length>1?'<select id="f_opAttCo" style="flex:1 1 120px;min-width:0;padding:10px;border-radius:10px" aria-label="소속 업체">'+vs.map(v=>'<option value="'+escapeText(v.companyId)+'">'+escapeText(v.company)+'</option>').join('')+'</select>':'')+'<button class="button ghost" type="submit" style="flex:none">추가</button></div></form>':'')+'</div>'
  +'<div class="card"><h2>훈련 사진 <span class="req">*</span></h2><div class="row" id="opDrPh">'+thumbs(x.photos,x.open?'opDrDrop':'')+(x.open?phBtns('opDrFile','opDrAdd(','훈련 사진'):'')+'</div>'
  +(x.open?'<div class="field"><label for="f_opDrMemo">메모 (선택)</label><input id="f_opDrMemo" value="'+escapeText(x.memo)+'" placeholder="예) 후문 비상구 → 주차장 집결 · 인원 확인 3분" onchange="opDrMemo(this.value)"></div>':(x.memo?'<p class="muted">'+escapeText(x.memo)+'</p>':''))+'</div>'
  +'<div class="card roomfoot">'+(x.open?'<button class="button" type="button" style="width:100%" onclick="opDrClose(true)">훈련 마치기 (QR 닫기)</button>':d.job.status==='ENDED'?'':'<button class="button ghost" type="button" style="width:100%" onclick="opDrClose(false)">다시 열기 (참석 · 사진 고치기)</button>')+'</div>';
 loadInspPhotos(d.job.id);setTopGuide('sodrill');
 if(x.open)opTimer=setInterval(()=>{if(jobsMode!=='open'||opDrill!==x.id||document.hidden)return;callQuiet('openStaffPack',d.job.id).then(r=>{if(!opData||opDrill!==x.id||jobsMode!=='open')return;const o=(opData.drills.find(y=>y.id===x.id)||{}).attendees||[],nw=(r.drills.find(y=>y.id===x.id)||{}).attendees||[];if(nw.length!==o.length){const typing=document.activeElement&&document.activeElement.tagName==='INPUT';opData=r;if(!typing){const y=window.scrollY;opDraw();window.scrollTo(0,y)}msg('참석 '+nw.length+'명')}}).catch(()=>{})},8000)}
async function opRefresh(){try{opData=await callQuiet('openStaffPack',opData.job.id);const y=window.scrollY;opDraw();window.scrollTo(0,y)}catch(e){}}
async function opAttAdd(e){e.preventDefault();if(opBusy)return;const n=($('f_opAttName')?.value||'').trim();if(!n){$('f_opAttName')?.focus();return}const co=$('f_opAttCo')?$('f_opAttCo').value:'';
 opBusy=true;try{opData=await call('drillAddName',opDrill,n,co);opDraw();$('opAtt')?.scrollIntoView({block:'start'});msg(n+' 님을 참석으로 추가했습니다.')}catch(err){}finally{opBusy=false}}
async function opAttDel(id,name){if(!confirm(name+' 님을 참석자에서 뺄까요?'))return;try{opData=await call('drillDelAtt',id);opDraw()}catch(e){}}
const opDrCur=()=>(opData.drills.find(y=>y.id===opDrill)||{});
async function opDrAdd(src){if(opBusy)return;const x=opDrCur(),inp=$(src),fl=[...((inp&&inp.files)||[])].slice(0,Math.max(0,10-(x.photos||[]).length));if(inp)inp.value='';if(!fl.length)return;
 const jid=opData.job.id,cid=(opData.vendors[0]||{}).companyId;if(!cid){msg('배정된 업체가 없어 사진을 올릴 수 없습니다.');return}opBusy=true;
 try{const ids=await pendPhotos(fl,async f=>{const r=await readFile(f,PHOTO_SITE);return api('uploadInspPhotoStaff',[jid,cid,r])});
  await subRun('훈련 사진 저장',[['사진 '+ids.length+'장 올리기',set=>pendUpload([ids],set,inspPhoto)],['저장',async()=>{opData=await api('drillSave',[opDrill,(x.photos||[]).concat(ids),value('opDrMemo')])}]]);opDraw();msg('훈련 사진을 저장했습니다.')}
 catch(e){showErr('훈련 사진을 저장하지 못했습니다',e)}finally{opBusy=false}}
async function opDrDrop(id){const x=opDrCur();if(!confirm('이 사진을 뺄까요?'))return;try{opData=await call('drillSave',opDrill,(x.photos||[]).filter(p=>p!==id),x.memo||'');opDraw()}catch(e){}}
async function opDrMemo(v){const x=opDrCur();try{opData=await callQuiet('drillSave',opDrill,x.photos||[],v)}catch(e){}}
async function opDrClose(close){if(close&&!await askOk('훈련 마치기','참석 QR을 닫고 훈련을 완료로 기록할까요?\n(참석 '+(opDrCur().attendees||[]).length+'명 · 사진 '+(opDrCur().photos||[]).length+'장)','마치기'))return;
 try{opData=await call('drillClose',opDrill,close);opDraw();msg(close?'비상훈련을 완료로 기록했습니다.':'다시 열었습니다.')}catch(e){}}

/* ---------- 근로자: 비상훈련 참석 QR (?review=DRL-토큰) ---------- */
const DRL_LINK=()=>/^DRL-[a-f0-9]{32}$/.test(LINK_REVIEW)&&!window.__drlDone;
/** F2.7 닫기: 앱 안 QR 찍기로 들어왔으면 관리감독자 [비상훈련 참석] 화면으로 · 링크로 들어왔으면 처음 화면 */
function drlClose(){const inApp=!!window.__drlTok;window.__drlTok='';window.__drlDone=true;try{history.replaceState(null,'',location.pathname)}catch(e){}if(inApp&&state&&state.sm&&typeof smGo==='function'){smGo('drill');return}display(state)}
async function renderDrillIn(name){const el=$('my'),token=String(window.__drlTok||LINK_REVIEW.slice(4)).toLowerCase();$('pageTitle').textContent='비상훈련 참석';  // F2.7 __drlTok = 앱 안에서 찍은 QR
 if(!name)el.innerHTML='<div class="card"><h2>비상훈련 참석</h2><p class="desc">확인하는 중입니다…</p></div>';
 let r;try{r=await call('drillCheckIn',token,name||'')}catch(e){el.innerHTML='<div class="card"><h2>비상훈련 참석</h2><div class="note">'+escapeText(e.message||'참석을 기록하지 못했습니다.')+'</div><button class="button ghost" type="button" style="margin-top:10px" onclick="renderDrillIn()">다시 시도</button></div>';return}
 const head='<div class="card"><small class="muted">다이소 '+escapeText(r.store)+' · '+escapeText(r.date)+'</small><h2>'+escapeText(r.label)+' 참석</h2>';
 if(r.state==='DONE'){el.innerHTML=head+'<div style="text-align:center;padding:10px 0"><div style="font-size:44px;color:var(--ok)">✔</div><h2 style="color:var(--ok)">'+(r.again?'이미 참석했습니다':'참석 완료')+'</h2><p class="desc"><b>'+escapeText(r.name)+'</b> · '+escapeText(r.role||'')+'<br>계정 '+escapeText(state.email)+'</p></div><button class="button ghost" type="button" style="width:100%" onclick="drlClose()">닫기</button></div>';return}
 if(r.state==='CLOSED'){el.innerHTML=head+'<div class="note">이 훈련은 끝났습니다. 도급인 담당자에게 알려 주세요.</div><button class="button ghost" type="button" style="width:100%;margin-top:10px" onclick="drlClose()">닫기</button></div>';return}
 el.innerHTML=head+'<p class="desc">이 오픈 매장에 등록된 근로자 계정이 아닙니다. <b>이름</b>을 적으면 참석으로 기록됩니다.'+(r.company?' (소속: '+escapeText(r.company)+')':'')+'<br>로그인 계정 <b>'+escapeText(state.email)+'</b> <button class="linkbtn" type="button" onclick="relogin()">다른 계정으로 로그인</button></p>'
  +'<form onsubmit="event.preventDefault();const n=value(\'diName\');if(!n){markMissing([{key:\'diName\'}]);return}renderDrillIn(n)">'+input('diName','이름','','text',false,'예: 홍길동')+'<button class="button" type="submit" style="width:100%;margin-top:10px">참석</button></form></div>';setTimeout(()=>$('f_diName')?.focus(),50)}
