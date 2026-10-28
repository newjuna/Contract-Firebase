/* 담당자 현황판 (v5.12)
 *  대시보드: ① 공사 목록(처리할 일 숫자) → ② 공사를 누르면 그 공사의 오늘 할 일·일정·이행률·업체별 표·주의 사항
 *  작업허가서 / 순회점검: 업체가 많아도 한 화면에 — 업체별 요약 표 + [승인 대기·특이사항·전체] 거르기 + 선택·일괄 승인(확인)
 *  (staff.js의 sDash, permit.js의 renderPermitList, insp.js의 renderInspList를 이 파일이 대신함)
 *  서버: Code.gs approvePermits · checkInspections */
let dashJob='',pmFilter='wait',inFilter='wait';
const dd=(a,b)=>Math.round((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/864e5);
const chip=(n,t,red)=>n?'<span class="bchip'+(red?' red':'')+'">'+escapeText(t)+' '+n+'</span>':'';
/** 공사 1건의 처리할 일 */
function jTodo(j){const ev=(j.evalTotal||0)-(j.evalDone||0),pend=sum(j.meetings||[],m=>m.pending);
 const id=escapeText(j.id);  // F1.8g 6번째 = 공사 화면 숫자 버튼 이름
 return [['check','작업허가서 승인 대기',j.permitWaiting||0,'건','openCheck(\''+id+'\',\'permit\')','허가서'],['check','순회점검일지 확인 대기',j.inspUnchecked||0,'건','openCheck(\''+id+'\',\'insp\')','일지'],['insp','미조치 지적사항',j.findOpen||0,'건','openInspList(\''+id+'\')','미조치'],
  ['meet','미팅 참석 확인 대기',pend,'명','','참석 확인'],['eval',j.end&&j.end.state==='OVER'?'종료일 경과 · 연장 또는 종료':'종료 예정 · 연장 또는 종료',j.status!=='ENDED'&&j.end&&['SOON','OVER'].includes(j.end.state)?1:0,'','jobEndPage(\''+id+'\')','연장·종료'],['eval','종료 평가 대기',j.status==='ENDED'?ev:0,'건','openJobEval(\''+id+'\')','종료 평가']]}
/* ---------- F1.8g 도급인 메인: 알림 띠 · [현장 확인하기] · 지적사항·시정조치 · 공사 현황 ---------- */
const lastDay=(y,m)=>new Date(Date.UTC(y,m,0)).toISOString().slice(0,10),p2=n=>String(n).padStart(2,'0');
/** 법정 주기: 협의체 매월 · 합동점검 분기마다 1회
 *  그 기간에 그 종류 미팅(예정 포함)이 있으면 끝 · 공사를 시작한 달(분기)은 착수 전에 한 미팅도 인정
 *  → 짧은 공사는 첫 미팅 1번으로 끝 · 기간이 다음 달로 늘어나면 그달 1일부터 다시 알림 */
function lawDue(j,t){if(j.status==='ENDED'||j.startDate>lastDay(+t.slice(0,4),+t.slice(5,7)))return [];/* 다음 달 이후 시작하는 공사는 그달에 */const y=+t.slice(0,4),mo=+t.slice(5,7),qm=Math.floor((mo-1)/3)*3+1,M=j.meetings||[],out=[];
 const chk=(kind,ps,pe,label)=>{if(!(j.startDate<=pe&&(!j.endDate||j.endDate>=ps)))return;const has=M.some(m=>(m.kinds||[]).includes(kind)&&m.date>=ps&&m.date<=pe)||(j.startDate>=ps&&j.startDate<=pe&&M.some(m=>(m.kinds||[]).includes(kind)&&m.date<=pe));if(!has)out.push(label)};
 chk('COUNCIL',y+'-'+p2(mo)+'-01',lastDay(y,mo),mo+'월 협의체');chk('JOINT',y+'-'+p2(qm)+'-01',lastDay(y,qm+2),Math.ceil(mo/3)+'분기 합동점검');return out}
/* F1.8h 알림: 메인에는 한 줄만 → 누르면 위에서 내려오는 창(뒤는 어둡게) → 하나를 눌러 들어가면 '본 것'으로 빠짐 (메뉴 숫자도 같이)
 *  같은 일이라도 내용이 바뀌면(연장으로 종료일 변경 · 참석 확인 인원 변경 · 다음 달 주기 등) 새 알림으로 다시 뜸 · 참조 알림은 없앰 */
function sAlertList(d,t){const act=sAct(d),ended=sEnded(d),B=(state&&state.badges)||{},K=d.meetKinds||{},h=[],id=j=>escapeText(j.id),add=(type,key,fn,title,sub,go)=>h.push({type,key,fn,title,sub,go});
 act.forEach(j=>{if(j.end&&['SOON','OVER'].includes(j.end.state))add('end','end:'+j.id+':'+(j.endDate||'')+':'+j.end.state,'jobEndPage(\''+id(j)+'\')','⏰ '+escapeText(j.title)+(j.end.state==='OVER'?' · 종료일 지남':' · 종료 '+(j.end.left?j.end.left+'일 전':'오늘')),escapeText(j.storeName),'연장·종료 ›')});
 act.forEach(j=>(j.meetings||[]).filter(m=>!m.done&&(m.date>=t||m.pending)).forEach(m=>add('meet','meet:'+m.id+':'+(m.open?1:0)+':'+(m.pending||0)+':'+m.date,'meetStart(\''+escapeText(m.id)+'\')','📢 '+mdw(m.date)+(m.time?' '+escapeText(m.time):'')+' '+escapeText((m.kinds||[]).map(k=>K[k]||k).join(' · ')||m.title),escapeText(j.storeName+' · '+(m.place||''))+(m.pending?' · <span class="req">참석 확인 '+m.pending+'명</span>':''),m.open?'들어가기 ›':'▶ 미팅 시작')));
 act.forEach(j=>{const L=lawDue(j,t);if(L.length)add('law','law:'+j.id+':'+t.slice(0,7)+':'+L.join(','),'meetForm(\''+id(j)+'\')','🗓 '+escapeText(j.storeName)+' · '+escapeText(L.join(' · '))+' 미실시',escapeText(j.title),'미팅 만들기 ›')});
 const nv=B.newVendors||[];if(nv.length)add('nv','nv:'+nv.map(v=>v.id).sort().join(','),'sgo(\'jobs\')','🏢 공사 배정 대기 업체 '+nv.length+'곳',escapeText(nv.slice(0,3).map(v=>v.company).join(', ')),'배정하기 ›');
 ended.forEach(j=>{const n=(j.evalTotal||0)-(j.evalDone||0);if(n>0)add('eval','eval:'+j.id+':'+n,'openJobEval(\''+id(j)+'\')','⭐ '+escapeText(j.title)+' · 종료 평가 '+n+'건',escapeText(j.storeName),'평가하기 ›')});
 return h}
const alKey=()=>'seenAlerts:'+((state&&state.email)||'');
function alSeen(){try{return JSON.parse(localStorage.getItem(alKey())||'[]')}catch(e){return []}}
function sAlertUnread(d){const s=new Set(alSeen());return sAlertList(d,kstToday()).filter(a=>!s.has(a.key))}
/** 메인 한 줄: 🔔 알림 N · 첫 알림 제목 ▾ (안 본 알림이 없으면 숨김) */
function sAlertBarHtml(d){const L=sAlertUnread(d);if(!L.length)return '';
 return '<button class="abar" type="button" id="abar" onclick="openAlerts()" aria-haspopup="dialog" aria-expanded="false"><span class="abar-l">🔔 알림 <span class="cnt">'+L.length+'</span></span><span class="abar-t">'+L[0].title+'</span><span class="abar-c" aria-hidden="true">▾</span></button>'}
function openAlerts(){const L=sAlertUnread(jobData);closeAlerts();if(!L.length)return;
 const bg=document.createElement('div');bg.id='alDlg';bg.className='albg';bg.setAttribute('role','dialog');bg.setAttribute('aria-modal','true');bg.setAttribute('aria-labelledby','alTitle');
 bg.innerHTML='<div class="alpanel"><div class="alhead"><h2 id="alTitle">알림 '+L.length+'건</h2><button class="certx" type="button" id="alClose" aria-label="알림 닫기" style="background:var(--bg);color:var(--text)">✕</button></div>'
  +'<div class="allist">'+L.map((a,i)=>'<button class="vmeet" type="button" style="animation-delay:'+(i*45)+'ms" data-i="'+i+'"><span><b>'+a.title+'</b>'+(a.sub?'<span class="muted">'+a.sub+'</span>':'')+'</span><span class="go">'+a.go+'</span></button>').join('')+'</div>'
  +'<button class="button ghost" type="button" id="alAll" style="width:100%;margin-top:8px">모두 확인 (목록에서 지우기)</button></div>';
 document.body.appendChild(bg);document.body.style.overflow='hidden';$('abar')?.setAttribute('aria-expanded','true');
 bg.querySelectorAll('.allist .vmeet').forEach(b=>b.onclick=()=>{const a=L[+b.dataset.i];alMark([a.key]);closeAlerts();new Function(a.fn)()});
 $('alClose').onclick=closeAlerts;$('alAll').onclick=()=>{alMark(L.map(a=>a.key));closeAlerts();if(smenu==='dash'&&tab==='jobs'&&jobsMode==='list')renderJobs()};
 bg.onclick=e=>{if(e.target===bg)closeAlerts()};bg.onkeydown=e=>{if(e.key==='Escape')closeAlerts()};setTimeout(()=>bg.querySelector('.allist .vmeet')?.focus(),60)}
function closeAlerts(){const e=$('alDlg');if(e){e.remove();document.body.style.overflow=''}$('abar')?.setAttribute('aria-expanded','false')}
/** 본 알림 기억 (최근 300개) → 메인 한 줄 · 메뉴 숫자 다시 계산 */
function alMark(keys){try{localStorage.setItem(alKey(),JSON.stringify([...new Set(alSeen().concat(keys))].slice(-300)))}catch(e){}sBadges(state&&state.badges)}
/** 큰 동그라미: 허가서 승인 대기 + 순회점검일지 확인 대기 */
const ckJobs=d=>d.jobs.filter(j=>j.status!=='ENDED'||(j.permitWaiting||0)+(j.inspUnchecked||0)>0);
function sCheckHtml(d){const L=ckJobs(d);if(!L.length)return '';const pw=sum(L,j=>j.permitWaiting),iu=sum(L,j=>j.inspUnchecked),n=pw+iu;
 return '<div class="vgo-wrap"><button class="vgo" type="button" onclick="sCheckStart()" aria-label="현장 확인하기'+(n?' · 확인할 것 '+n+'건':'')+'"><span class="vgo-ic" aria-hidden="true">✔</span><b>현장<br>확인하기</b>'+(n?'<span class="vgo-n" aria-hidden="true">'+(n>99?'99+':n)+'</span>':'')+'</button><div class="muted">'+(n?'허가서 승인 '+pw+' · 순회점검일지 확인 '+iu:'✔ 오늘 확인 완료')+'</div></div>'}
/** 현장이 여러 개면 고르는 창 (확인할 것이 많은 현장이 위) */
function sCheckStart(){const L=ckJobs(jobData).slice().sort((a,b)=>((b.permitWaiting||0)+(b.inspUnchecked||0))-((a.permitWaiting||0)+(a.inspUnchecked||0)));if(!L.length)return;if(L.length===1){openCheck(L[0].id);return}
 jobPick('어느 현장인가요?',L.map(j=>{const n=(j.permitWaiting||0)+(j.inspUnchecked||0);return ['openCheck(\''+escapeText(j.id)+'\')',escapeText(j.title)+(n?' <span class="cnt">'+n+'</span>':''),escapeText(j.storeName)+' · 허가서 '+(j.permitWaiting||0)+' · 일지 '+(j.inspUnchecked||0)]}))}
/** 현장 확인 화면 = 그 현장의 [작업허가서 | 순회점검일지] 탭 */
function openCheck(id,tb){const j=jobData&&jobData.jobs.find(x=>x.id===id);tb=tb||(j&&!j.permitWaiting&&j.inspUnchecked?'insp':'permit');if(tb==='insp')openInspList(id);else openPermitList(id)}
function ckBar(jid,cur){const j=jobData&&jobData.jobs.find(x=>x.id===jid);if(!j)return '';const pw=j.permitWaiting||0,iu=j.inspUnchecked||0,b=(k,l,n)=>'<button type="button" role="tab" aria-selected="'+(cur===k)+'" class="'+(cur===k?'on':'')+'" onclick="openCheck(\''+escapeText(jid)+'\',\''+k+'\')">'+l+(n?' <span class="cnt">'+n+'</span>':'')+'</button>';
 return '<div class="card"><div class="seg" role="tablist" style="margin-top:0">'+b('permit','작업허가서',pw)+b('insp','순회점검일지',iu)+'</div>'+(pw+iu?'':'<div class="ckdone" role="status">✔ 오늘 확인 완료</div>')+'</div>'}
/** ☰ 현장 확인 (공사 목록) */
function sCheck(d){return sJobList(d,'현장 확인','작업허가서 승인 · 순회점검일지 확인 · 미조치 지적사항',j=>{const n=(j.permitWaiting||0)+(j.inspUnchecked||0);return ['openCheck(\''+escapeText(j.id)+'\')',n?'<span class="cnt">'+n+'</span>':'','허가서 대기 '+(j.permitWaiting||0)+' · 일지 확인 대기 '+(j.inspUnchecked||0)+(j.findOpen?' · <b class="req">미조치 '+j.findOpen+'</b>':'')]})}
/** 공사 1건의 주의 사항 (업체별) */
function jWatch(j,t){const rows=[];if(j.status!=='ENDED'&&j.end&&j.end.state==='OVER')rows.push(['공사 전체','종료일 경과 · 연장 또는 종료 필요']);
 (j.vstats||[]).forEach(v=>{const r=[];if(v.inspNeed&&v.insp/v.inspNeed<0.6)r.push('순회점검 '+Math.round(v.insp/v.inspNeed*100)+'%');if(v.openFindings>=2)r.push('미조치 지적 '+v.openFindings+'건');if(v.workDays&&v.permitDays/v.workDays<0.6)r.push('허가서 '+Math.round(v.permitDays/v.workDays*100)+'%');if(v.lastInsp&&!v.inspToday&&dd(v.lastInsp,t)>=4)r.push('순회점검 '+dd(v.lastInsp,t)+'일 없음');if(r.length)rows.push([v.company,r.join(' · ')])});return rows}
/* ---------- ① 대시보드: 공사 목록 ---------- */
function sDash(d){if(dashJob){const j=d.jobs.find(x=>x.id===dashJob);if(j)return sDashJob(d,j);dashJob=''}
 const t=kstToday(),safety=d.me.role==='SAFETY',act=sAct(d),ended=sEnded(d);
 const score=j=>sum(jTodo(j),x=>x[2])+jWatch(j,t).length*2;
 const card=j=>{const R=sRates(j),w=jWatch(j,t).length,s=j.startDate,e=j.endDate||j.startDate,tot=Math.max(1,dd(s,e)+1),pct=j.status==='ENDED'?100:Math.max(0,Math.min(100,Math.round((dd(s,t)+1)/tot*100)));
  return '<button class="jcard" type="button" onclick="dashOpen(\''+escapeText(j.id)+'\')"><div class="row" style="justify-content:space-between;gap:6px"><b>'+escapeText(j.title)+'</b><span class="muted">'+escapeText(j.storeName)+'</span></div>'
   +'<div class="gbar'+(j.status==='ENDED'?' end':'')+'" aria-hidden="true"><span style="width:'+pct+'%"></span></div>'
   +'<div class="muted">'+escapeText(s.slice(5).replace('-','/'))+' ~ '+escapeText(e.slice(5).replace('-','/'))+' · 업체 '+j.vendors.length+'곳 · 순회 '+pctTxt(R.insp)+' · 허가서 '+pctTxt(R.permit)+'</div>'
   +'<div class="bchips">'+chip(j.permitWaiting,'허가서 대기',1)+chip(j.inspUnchecked,'일지 확인',1)+chip(j.findOpen,'미조치',1)+chip(sum(j.meetings||[],m=>m.pending),'참석 확인',1)+(j.status!=='ENDED'&&j.end&&j.end.state==='OVER'?'<span class="bchip red">종료일 경과</span>':j.status!=='ENDED'&&j.end&&j.end.state==='SOON'?'<span class="bchip">종료 '+(j.end.left?j.end.left+'일 전':'오늘')+'</span>':'')+chip(w,'주의',1)+(j.status==='ENDED'?chip((j.evalTotal||0)-(j.evalDone||0),'평가 대기',1):'')+'</div></button>'};
 /* F1.8g 메인: 인사 → 알림 띠 → [현장 확인하기] → 지적사항·시정조치 → 공사 현황 → (안전보건팀) 업체별 지적 현황 */
 setTimeout(()=>sBadges(state&&state.badges),0);  /* 메뉴 숫자를 안 본 알림 기준으로 */
 let h=gdRow('sdash')+'<div class="card"><h2 style="margin:0">'+escapeText(d.me.name)+' 님</h2><div class="muted">'+escapeText(t)+' · '+(safety?'전체 공사':'내 공사')+' 진행 '+act.length+'건'+(ended.length?' · 종료 '+ended.length+'건':'')+'</div>'+sAlertBarHtml(d)+'</div>';
 if(!d.jobs.length)return h+sNone('등록된 공사가 없습니다. ☰ → 공사 관리에서 [+ 새 공사 만들기]로 시작하세요.');
 h+=sCheckHtml(d)+fixCardHtml();
 h+='<div class="card"><h2>공사 현황 '+act.length+'</h2>'+(act.slice().sort((a,b)=>score(b)-score(a)).map(card).join('')||'<p class="muted">진행 중인 공사가 없습니다.</p>')+'</div>';
 if(ended.length)h+='<div class="card"><details class="hist"><summary>종료된 공사 '+ended.length+'건</summary>'+ended.map(card).join('')+'</details></div>';
 return h}  /* F1.8h 업체별 지적 현황 표 없앰 (지적사항·시정조치 칸으로 충분) */
function dashOpen(id){dashJob=id;renderJobs();window.scrollTo(0,0)}
function dashBack(){dashJob='';renderJobs();window.scrollTo(0,0)}
/** 안전보건팀: 업체별 지적 현황 (전체) */
function sWatchFind(d){const by={};d.jobs.forEach(j=>(j.vstats||[]).forEach(v=>{const x=by[v.companyId]||(by[v.companyId]={company:v.company,total:0,open:0,jobs:0});x.total+=v.findTotal||0;x.open+=v.openFindings||0;x.jobs++}));
 const top=Object.values(by).filter(x=>x.total).sort((a,b)=>b.total-a.total||b.open-a.open).slice(0,8);if(!top.length)return '';
 return '<div class="card"><h2>업체별 지적 현황</h2><table class="rtable"><tr><th>업체</th><th>지적</th><th>미조치</th><th>공사</th></tr>'+top.map(x=>'<tr><td>'+escapeText(x.company)+'</td><td>'+x.total+'</td><td'+(x.open?' class="req"':'')+'>'+x.open+'</td><td>'+x.jobs+'</td></tr>').join('')+'</table></div>'}
/* ---------- ② 대시보드: 공사 1건 현황 ---------- */
/* F1.8g '오늘 처리할 일' 목록 → 숫자 버튼 한 줄 */
const jTodoBtns=j=>jTodo(j).filter(x=>x[2]>0).map(([m,txt,n,unit,fn,short])=>'<button type="button" class="fxchip on" onclick="'+(fn||'sgo(\''+m+'\')')+'" aria-label="'+escapeText(txt+' '+n+unit)+'">'+escapeText(short)+(unit?' '+n:'')+'</button>').join('');
function sDashJob(d,j){const t=kstToday(),R=sRates(j),todo=jTodoBtns(j),W=jWatch(j,t),V=j.vstats||[],cls=r=>r!=null&&r<0.6?' class="req"':'';
 return '<div class="card"><button class="button ghost" type="button" onclick="dashBack()">← 공사 목록</button><h2 style="margin-top:12px">'+escapeText(j.title)+(j.status==='ENDED'?' <span class="pill todo">종료</span>':'')+'</h2><div class="muted">'+sMeta(j)+' · 업체 '+j.vendors.length+'곳</div></div>'
  +'<div class="card"><div class="row" style="flex-wrap:wrap;gap:6px">'+(todo||'<span class="fxdone">✔ 처리할 일 없음</span>')+'</div></div>'
  +'<div class="card"><h2>공사 일정</h2>'+ganttRow(j,t,true)+'</div>'
  +'<div class="card"><h2>매장 이행 현황</h2><div class="dns">'+donut(R.insp,'순회점검',R.inspTxt)+donut(R.permit,'작업허가서',R.permitTxt)+donut(R.crew,'인원·수칙',R.crewTxt)+'</div><p class="muted" style="text-align:center;margin:4px 0 0">참여 업체 합계 · 작업일 기준</p>'
  +(V.length?'<table class="rtable" style="margin-top:12px"><tr><th>업체</th><th>순회</th><th>허가서</th><th>인원</th><th>미조치</th></tr>'+V.map(v=>{const ri=v.inspNeed?v.insp/v.inspNeed:null,rp=v.workDays?v.permitDays/v.workDays:null,rc=v.workDays?v.crewDays/v.workDays:null;return '<tr><td><b>'+escapeText(v.company)+'</b><div class="muted">작업일 '+v.workDays+'일'+(v.lastInsp?' · 점검 '+escapeText(v.lastInsp.slice(5)):'')+'</div></td><td'+cls(ri)+'>'+pctTxt(ri)+'</td><td'+cls(rp)+'>'+pctTxt(rp)+'</td><td'+cls(rc)+'>'+pctTxt(rc)+'</td><td'+(v.openFindings?' class="req"':'')+'>'+v.openFindings+'</td></tr>'}).join('')+'</table>':'')+'</div>'
  +'<div class="card"><h2>주의가 필요한 업체 '+(W.length?'<span class="cnt">'+W.length+'</span>':'')+'</h2>'+(W.length?W.map(r=>'<div class="item" style="padding:8px 0"><b>'+escapeText(r[0])+'</b><div class="req" style="font-size:13px">'+escapeText(r[1])+'</div></div>').join(''):'<p class="muted">기준(순회점검·허가서 60% 미만, 미조치 2건 이상, 순회점검 4일 이상 없음)에 걸린 업체가 없습니다.</p>')+'</div>'
  +'<div class="card"><div class="row"><button class="button ghost" type="button" style="flex:1" onclick="openCheck(\''+escapeText(j.id)+'\',\'permit\')">작업허가서</button><button class="button ghost" type="button" style="flex:1" onclick="openCheck(\''+escapeText(j.id)+'\',\'insp\')">순회점검</button><button class="button ghost" type="button" style="flex:1" onclick="smenu=\'meet\';markSMenu();renderJobs()">미팅</button></div></div>'}
/* ---------- 작업허가서: 업체별 요약 + 거르기 + 일괄 승인 ---------- */
function pmFlags(p,t){const f=[];if(p.status==='ISSUED'&&p.date<t)f.push('승인 지연 '+dd(p.date,t)+'일');if(p.date<t&&!p.completed)f.push('작업완료 미기록');return f}
function renderPermitList(){const d=permitJob,t=kstToday(),L=d.list;jobsMode='permits';
 const wait=L.filter(p=>p.status==='ISSUED'),jj=jobData&&jobData.jobs.find(x=>x.id===d.job.id);if(jj)jj.permitWaiting=wait.length;  // F1.8g 탭 숫자·메인 숫자 맞춤
 const spec=L.filter(p=>pmFlags(p,t).length),by={};
 L.forEach(p=>{const x=by[p.company]||(by[p.company]={n:0,wait:0,spec:0,today:false,last:''});x.n++;if(p.status==='ISSUED')x.wait++;if(pmFlags(p,t).length)x.spec++;if(p.date===t)x.today=true;if(p.date>x.last)x.last=p.date});
 const F=[['wait','승인 대기',wait.length],['spec','특이사항',spec.length],['all','전체',L.length]],show=pmFilter==='wait'?wait:pmFilter==='spec'?spec:L;
 let g='';const rows=show.map(p=>{const head=p.date!==g?(g=p.date,'<div class="stage">'+escapeText(p.date)+(p.date===t?' (오늘)':'')+'</div>'):'',fl=pmFlags(p,t),st=P_STATUS[p.status]||[p.status,'todo'];
  return head+'<div class="blrow">'+(p.status==='ISSUED'?'<input type="checkbox" class="pmck" value="'+escapeText(p.id)+'" aria-label="'+escapeText(p.company+' '+p.no)+' 선택">':'<span class="blsp"></span>')+'<button type="button" class="blmain" onclick="openPermitStaff(\''+escapeText(p.id)+'\')"><b>'+escapeText(p.company)+'</b> <span class="pill '+st[1]+'">'+escapeText(st[0])+'</span><div class="muted">'+escapeText(p.workName)+' · '+escapeText(p.start)+'~'+escapeText(p.end)+'</div>'+(fl.length?'<div class="req" style="font-size:12px">⚠ '+escapeText(fl.join(' · '))+'</div>':'')+'</button></div>'}).join('');
 $('jobs').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="loadJobs()">← 돌아가기</button><h2 style="margin-top:12px">작업허가서 · '+escapeText(d.job.title)+'</h2><p class="muted">업체는 발행 즉시 작업하고, 도급인은 확인 후 승인합니다.</p></div>'
  +ckBar(d.job.id,'permit')+gdRow('permits')
  +'<div class="card"><h2>업체별 현황</h2>'+(Object.keys(by).length?'<table class="rtable"><tr><th>업체</th><th>발행</th><th>대기</th><th>특이</th><th>오늘</th></tr>'+Object.entries(by).sort((a,b)=>b[1].wait-a[1].wait).map(([c,x])=>'<tr><td><b>'+escapeText(c)+'</b></td><td>'+x.n+'</td><td'+(x.wait?' class="req"':'')+'>'+x.wait+'</td><td'+(x.spec?' class="req"':'')+'>'+x.spec+'</td><td>'+(x.today?'✔':'<span class="muted">-</span>')+'</td></tr>').join('')+'</table>':'<p class="muted">아직 발행된 허가서가 없습니다.</p>')+'</div>'
  +'<div class="card"><div class="seg" role="tablist" style="margin-top:0">'+F.map(([k,l,n])=>'<button type="button" role="tab" aria-selected="'+(pmFilter===k)+'" class="'+(pmFilter===k?'on':'')+'" onclick="pmFilter=\''+k+'\';renderPermitList()">'+l+' '+n+'</button>').join('')+'</div>'
  +(rows||'<p class="muted" style="margin-top:10px">'+(pmFilter==='wait'?'승인 대기 허가서가 없습니다.':pmFilter==='spec'?'특이사항이 있는 허가서가 없습니다.':'허가서가 없습니다.')+'</p>')+'</div>'
  +(wait.length?'<div class="card roomfoot"><div class="row"><button class="button ghost" type="button" style="flex:1" onclick="pmApprove(false)">선택 승인</button><button class="button" type="button" style="flex:1" onclick="pmApprove(true)">대기 전체 승인 '+wait.length+'건</button></div></div>':'');window.scrollTo(0,0)}
async function pmApprove(all){const ids=all?[]:[...document.querySelectorAll('.pmck:checked')].map(x=>x.value),n=all?permitJob.list.filter(p=>p.status==='ISSUED').length:ids.length;if(!n){msg('승인할 허가서를 체크해 주세요.');return}
 if(!confirm('작업허가서 '+n+'건을 승인할까요?\n승인자: '+(state.staff?state.staff.name:'')+' (일괄 승인으로 기록)'))return;
 try{permitJob=await call('approvePermits',permitJob.job.id,ids,'');renderPermitList();msg(n+'건 승인했습니다.');refreshBadges();const j=jobData&&jobData.jobs.find(x=>x.id===permitJob.job.id);if(j)j.permitWaiting=permitJob.list.filter(p=>p.status==='ISSUED').length}catch(e){}}
/* ---------- 순회점검: 업체별 요약 + 거르기 + 일괄 확인 ---------- */
function renderInspList(){const d=inspJob,t=kstToday(),L=d.list,open=d.findings.filter(f=>f.status!=='DONE');jobsMode='insp';
 const wait=L.filter(x=>!x.checkedAt),jj=jobData&&jobData.jobs.find(x=>x.id===d.job.id);if(jj){jj.inspUnchecked=wait.length;jj.findOpen=open.length}  // F1.8g 탭 숫자·메인 숫자 맞춤
 const bad=L.filter(x=>x.bad),F=[['wait','확인 대기',wait.length],['bad','지적 있음',bad.length],['all','전체',L.length]],show=inFilter==='wait'?wait:inFilter==='bad'?bad:L;
 const vrow=v=>{const my=L.filter(x=>x.companyId===v.companyId),op=open.filter(f=>f.companyId===v.companyId).length,late=v.since==null||v.since>=2;
  return '<tr><td><b>'+escapeText(v.company)+'</b></td><td'+(late?' class="req"':'')+'>'+(v.last?escapeText(v.last.slice(5))+'<div class="muted">'+v.since+'일 전</div>':'없음')+'</td><td>'+my.length+'</td><td'+(my.some(x=>!x.checkedAt)?' class="req"':'')+'>'+my.filter(x=>!x.checkedAt).length+'</td><td'+(op?' class="req"':'')+'>'+op+'</td></tr>'};
 let g='';const rows=show.map(x=>{const head=x.date!==g?(g=x.date,'<div class="stage">'+escapeText(x.date)+(x.date===t?' (오늘)':'')+'</div>'):'';
  return head+'<div class="blrow">'+(!x.checkedAt?'<input type="checkbox" class="inck" value="'+escapeText(x.id)+'" aria-label="'+escapeText(x.company+' '+x.date)+' 선택">':'<span class="blsp"></span>')+'<button type="button" class="blmain" onclick="openInspSheet(\''+escapeText(x.id)+'\',\'staff\')"><b>'+escapeText(x.company)+'</b> '+(x.checkedAt?'<span class="pill ok">확인</span>':'<span class="pill todo">확인 대기</span>')+'<div class="muted">점검 '+escapeText(x.submittedName)+'</div>'+(x.bad?'<div class="req" style="font-size:12px">⚠ 지적 '+x.bad+'건</div>':'<div class="muted">이상 없음</div>')+'</button></div>'}).join('');
 $('jobs').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="loadJobs()">← 돌아가기</button><h2 style="margin-top:12px">순회점검일지 · '+escapeText(d.job.title)+'</h2><p class="muted">업체가 2일 1회 작성합니다. 확인하면 일지에 "도급인 확인"이 남습니다.</p></div>'
  +ckBar(d.job.id,'insp')+gdRow('insplist')
  +'<div class="card"><h2>업체별 현황</h2><table class="rtable"><tr><th>업체</th><th>마지막</th><th>일지</th><th>대기</th><th>미조치</th></tr>'+d.vendors.slice().sort((a,b)=>(b.since==null?99:b.since)-(a.since==null?99:a.since)).map(vrow).join('')+'</table><p class="muted" style="margin-top:6px">빨간 글씨 = 점검 2일 이상 지남 · 확인 대기 · 미조치 있음</p></div>'
  +(open.length?'<div class="card"><details class="hist"'+(open.length<=5?' open':'')+'><summary><b>미조치 지적사항 '+open.length+'건</b></summary>'+open.map(f=>findRow(f,'staff')).join('')+'</details></div>':'')
  +'<div class="card"><div class="seg" role="tablist" style="margin-top:0">'+F.map(([k,l,n])=>'<button type="button" role="tab" aria-selected="'+(inFilter===k)+'" class="'+(inFilter===k?'on':'')+'" onclick="inFilter=\''+k+'\';renderInspList()">'+l+' '+n+'</button>').join('')+'</div>'
  +(rows||'<p class="muted" style="margin-top:10px">'+(inFilter==='wait'?'확인 대기 일지가 없습니다.':inFilter==='bad'?'지적이 있는 일지가 없습니다.':'아직 제출된 일지가 없습니다.')+'</p>')+'</div>'
  +(wait.length?'<div class="card roomfoot"><div class="row"><button class="button ghost" type="button" style="flex:1" onclick="inCheck(false)">선택 확인</button><button class="button" type="button" style="flex:1" onclick="inCheck(true)">대기 전체 확인 '+wait.length+'건</button></div></div>':'');window.scrollTo(0,0)}
async function inCheck(all){const ids=all?[]:[...document.querySelectorAll('.inck:checked')].map(x=>x.value),n=all?inspJob.list.filter(x=>!x.checkedAt).length:ids.length;if(!n){msg('확인할 일지를 체크해 주세요.');return}
 if(!confirm('순회점검일지 '+n+'건을 확인할까요?\n일지에 "도급인 확인: '+(state.staff?state.staff.name:'')+'"이 남습니다.'))return;
 try{inspJob=await call('checkInspections',inspJob.job.id,ids);renderInspList();msg(n+'건 확인했습니다.');refreshBadges();const j=jobData&&jobData.jobs.find(x=>x.id===inspJob.job.id);if(j)j.inspUnchecked=inspJob.list.filter(x=>!x.checkedAt).length}catch(e){}}
/* ---------- F1.9p [마스터] 데이터 관리 (조직도처럼 왼쪽 목록 · 오른쪽 처리) ----------
 *  왼쪽: ⚠ 손볼 것 · 🏢 업체(상태별) · 🏗 공사(진행·종료) · 📋 표로 보기 · 🧾 오래된 이력 · ⛔ 전체 초기화
 *  오른쪽: 이름 목록 → 누르면 상태 한 줄 + 바로 처리 버튼 + 빨간 지우기 (확인 1번) · 전체 초기화만 '삭제' 입력
 *  업체·공사 통째 지우기 · 이력 · 초기화 = 예전 adminPreview(지울 개수 · 10분 확인표) → adminDelete(50초씩 이어서) */
let admT=null,admS={t:'issues'},admOpen=new Set(['co']),admFold=false,admRowsD=null,admChk=new Set(),admQ='',admXp=new Set(),admCf=null,admEdit=false,admPv=null;
const ADM_CO_G=[['pend','승인 대기'],['draft','작성·보완'],['sub','검토 중'],['ok','승인'],['rej','반려']],ADM_JOB_G=[['open','진행 중','OPEN'],['ended','종료','ENDED']];
const ADM_TBL=[['PERMITS','작업허가서'],['INSP','순회점검'],['FIND','지적사항'],['WORKERS','작업자'],['MEET','미팅'],['EVALS','종료 평가'],['MAIL','메일·Teams 기록']];
const ADM_CO_PILL={pend:['승인 대기','w'],draft:['작성 중','k'],sub:['검토 중','b'],ok:['승인','g'],rej:['반려','r']};
const admQt=s=>escapeText(String(s==null?'':s).replace(/[^A-Za-z0-9_.:-]/g,''));  // onclick 안에 넣는 ID (글자 제한)
function admCss(){if(typeof orgCss==='function')orgCss();if($('admCss'))return;const s=document.createElement('style');s.id='admCss';s.textContent=
 '.ogs.adfold{width:30px;padding:6px 0}.ogsh button{border:0;background:none;color:var(--sub);font-size:14px;padding:0 3px;cursor:pointer}'
 +'.ogf .adn{margin-left:auto;font-size:11px;color:var(--sub);padding-left:3px}.ogf.on .adn{color:#d1d5db}.ogf .adn.r{color:var(--accent);font-weight:700}.ogf.on .adn.r{color:#fca5a5}.ogf.adsub{padding-left:17px}'
 +'.adr{display:flex;align-items:center;gap:6px;width:100%;border:0;border-bottom:1px solid #f0f1f4;background:none;text-align:left;font:inherit;color:inherit;padding:11px 2px;font-size:13.5px;cursor:pointer}.adr:hover{background:#fafafa}'
 +'.adr .nm{flex:1;min-width:0}.adr .nm b{font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.adr .nm small{display:block;font-size:11px;color:var(--sub)}.adr .nm small.r{color:var(--accent)}.adr i{font-style:normal;color:#c0c4cc}'
 +'.apl{flex:none;font-size:10.5px;border-radius:20px;padding:1px 7px;white-space:nowrap;font-weight:600;vertical-align:middle}.apl.w{background:#fff7ed;color:#b45309}.apl.b{background:#eef2ff;color:#3730a3}.apl.g{background:#ecfdf3;color:#15803d}.apl.r{background:#fdecec;color:var(--accent)}.apl.k{background:#f1f2f5;color:#566070}'
 +'.adback{border:0;background:none;font:inherit;font-size:12px;color:var(--sub);padding:0 0 8px;cursor:pointer}.adst{font-size:12px;color:var(--sub);margin:-4px 0 14px;word-break:break-all;line-height:1.6}.adst .r{color:var(--accent)}'
 +'.adbig{display:block;width:100%;border:1px solid var(--line);background:#fff;border-radius:11px;padding:12px 11px;font:inherit;font-size:13.5px;font-weight:600;text-align:left;margin:0 0 8px;color:var(--text);cursor:pointer}.adbig:hover{border-color:#9ca3af}'
 +'.addel{display:block;width:100%;border:0;border-top:1px solid var(--line);background:none;color:var(--accent);font:inherit;font-size:13px;font-weight:700;padding:12px 0 0;margin-top:14px;text-align:left;cursor:pointer}'
 +'.adcf{border:2px solid var(--accent);border-radius:12px;padding:12px 11px;margin-top:8px}.adcf.m{border-color:var(--main)}.adcf b{font-size:14px}.adcf p{font-size:12.5px;margin:4px 0 10px;color:#4b5563;white-space:pre-line}'
 +'.adbtn{display:block;border:0;border-radius:10px;font:inherit;font-weight:700;font-size:13.5px;padding:11px;width:100%;cursor:pointer}.adbtn.d{background:var(--accent);color:#fff}.adbtn.g{background:#f0f2f6;color:#374457;margin-top:6px}.adbtn.m{background:var(--main);color:#fff}.adbtn:disabled{opacity:.4;cursor:default}'
 +'.adinp{width:100%;border:1px solid #d1d5db;border-radius:9px;padding:10px;font:inherit;font-size:16px;margin:0 0 8px}.adempty{color:var(--sub);font-size:13px;padding:20px 4px;text-align:center}'
 +'.adtbar{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--sub);padding:4px 2px 6px;border-bottom:2px solid var(--main)}.adtbar label{display:flex;align-items:center;gap:4px}'
 +'.adtr{border-bottom:1px solid #f0f1f4}.adtr .h{display:flex;align-items:center;gap:7px;padding:9px 2px}.adtr.on{background:#fff8f8}.adtr input[type=checkbox],.adtbar input[type=checkbox]{width:18px;height:18px;flex:none;accent-color:var(--accent)}'
 +'.adtr .nm{flex:1;min-width:0;cursor:pointer;background:none;border:0;text-align:left;font:inherit;color:inherit;padding:0}.adtr .nm b{display:block;font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.adtr .nm small{display:block;font-size:11px;color:var(--sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
 +'.adtr .dt{display:none;font-size:12px;background:#f8f9fb;border-radius:8px;margin:0 2px 8px 27px;padding:6px 9px}.adtr.open .dt{display:block}.adtr .dt div{display:flex;gap:8px;padding:2px 0;word-break:break-all}.adtr .dt div span:first-child{color:var(--sub);width:62px;flex:none}'
 +'.adsel{position:sticky;bottom:0;background:#fff;padding:8px 0 2px;margin-top:6px}.adsrch{width:100%;border:1px solid var(--line);border-radius:9px;padding:8px 10px;font:inherit;font-size:14px;margin:0 0 6px}';document.head.appendChild(s)}
function sData(){jobsMode='admin';admCss();setTimeout(()=>admT?admDraw():admLoad(),0);return '<div id="admBox"><div class="card"><p class="desc">데이터를 불러오는 중입니다…</p></div></div>'}
async function admLoad(){try{admT=await call('adminTree')}catch(e){const b=$('admBox');if(b&&!admT)b.innerHTML='<div class="card"><p class="desc">'+escapeText(e.message||'불러오지 못했습니다.')+'</p><button class="button" type="button" onclick="admLoad()">다시 시도</button></div>';return}
 if(admS.id&&!(admS.t==='co'?admT.co:admT.job).some(x=>x.id===admS.id))admS={t:admS.t,sub:admS.sub};admDraw()}
function admDraw(){const b=$('admBox');if(!b||!admT)return;admCss();b.innerHTML='<div class="ogw"><nav class="ogs'+(admFold?' adfold':'')+'" aria-label="데이터 종류">'+admSide()+'</nav><section class="ogm" aria-live="polite">'+admMain()+'</section></div>';if(admS.t==='tbl'&&$('admTb'))admTb()}
function admGo(s){const same=admS.t==='tbl'&&s.t==='tbl'&&admS.sub===s.sub;admS=s;admCf=null;admEdit=false;admPv=null;if(!same){admChk=new Set();admQ='';admXp=new Set()}if(['co','job','tbl'].includes(s.t))admOpen.add(s.t);admDraw();window.scrollTo(0,0)}
function admTg(k){if(admOpen.has(k)){admOpen.delete(k);admDraw();return}admGo({t:k,sub:{co:'pend',job:'open',tbl:'PERMITS'}[k]})}
/* 왼쪽 */
function admSide(){if(admFold)return '<div class="ogsh" style="justify-content:center"><button type="button" onclick="admFold=false;admDraw()" aria-label="목록 펼치기">»</button></div>';
 const d=admT,on=(t,sub)=>admS.t===t&&(sub===undefined||admS.sub===sub)&&!admS.id?' on':'',on2=(t,sub)=>admS.t===t&&admS.sub===sub?' on':'',n=(v,r)=>'<span class="adn'+(r&&v?' r':'')+'">'+v+'</span>';
 const grp=(k,l,v)=>'<button type="button" class="ogf" aria-expanded="'+admOpen.has(k)+'" onclick="admTg(\''+k+'\')"><span class="ic">'+(admOpen.has(k)?'▾':'▸')+'</span>'+l+(v===''?'':n(v))+'</button>';
 const item=(cls,t,sub,label,v,r)=>'<button type="button" class="ogf'+cls+'" onclick="admGo({t:\''+t+'\''+(sub?',sub:\''+sub+'\'':'')+'})"><span class="ic"></span>'+label+(v===''?'':n(v,r))+'</button>';
 return '<div class="ogsh">데이터<button type="button" onclick="admFold=true;admDraw()" aria-label="목록 접기 (오른쪽 넓게)">«</button></div>'
  +item(on('issues'),'issues','','⚠ 손볼 것',d.issues.length,1)
  +grp('co','🏢 업체',d.co.length)+(admOpen.has('co')?ADM_CO_G.map(g=>item(' adsub'+on2('co',g[0]),'co',g[0],g[1],d.co.filter(c=>c.g===g[0]).length)).join(''):'')
  +grp('job','🏗 공사',d.job.length)+(admOpen.has('job')?ADM_JOB_G.map(g=>item(' adsub'+on2('job',g[0]),'job',g[0],g[1],d.job.filter(j=>j.st===g[2]).length)).join(''):'')
  +grp('tbl','📋 표로 보기','')+(admOpen.has('tbl')?ADM_TBL.map(g=>item(' adsub'+on2('tbl',g[0]),'tbl',g[0],g[1],d.cnt[g[0]]||0)).join(''):'')
  +item(on('logs'),'logs','','🧾 오래된 이력','')+item(on('reset'),'reset','','⛔ 전체 초기화','')}
/* 오른쪽 */
const admSubOf=(k,id)=>{if(k==='co'){const c=admT.co.find(x=>x.id===id);return c?c.g:'pend'}const j=admT.job.find(x=>x.id===id);return j&&j.st==='ENDED'?'ended':'open'};
function admMain(){const d=admT,s=admS;
 if(s.t==='issues')return '<div class="ogt">⚠ 손볼 것</div>'+(d.issues.length?d.issues.map(x=>'<button type="button" class="adr" onclick="admGo({t:\''+x.k+'\',sub:\''+admSubOf(x.k,x.id)+'\',id:\''+admQt(x.id)+'\'})"><span class="nm"><b>'+escapeText(x.n)+'</b><small class="r">'+escapeText(x.w)+'</small></span><i aria-hidden="true">›</i></button>').join(''):'<div class="adempty">✔ 손볼 것이 없습니다</div>')
  +'<p class="muted" style="font-size:11.5px;margin-top:12px">메일·Teams 실패(7일) · 조직도에 없는 담당 이메일 · 승인/검토 대기 7일 · 종료일 지남 · 종료 후 평가 미확정 3일을 자동으로 찾습니다.</p>';
 if(s.t==='co'&&!s.id){const g=ADM_CO_G.find(x=>x[0]===s.sub)||ADM_CO_G[0],L=d.co.filter(c=>c.g===g[0]);
  return '<div class="ogt">'+g[1]+'</div>'+(L.length?L.map(c=>'<button type="button" class="adr" onclick="admGo({t:\'co\',sub:\''+g[0]+'\',id:\''+admQt(c.id)+'\'})"><span class="nm"><b>'+escapeText(c.name)+'</b><small'+(c.fail||c.noOrg?' class="r"':'')+'>'+escapeText(admCoLine(c))+'</small></span><i aria-hidden="true">›</i></button>').join(''):'<div class="adempty">없습니다</div>')}
 if(s.t==='co')return admCoView();
 if(s.t==='job'&&!s.id){const g=ADM_JOB_G.find(x=>x[0]===s.sub)||ADM_JOB_G[0],L=d.job.filter(j=>j.st===g[2]);
  return '<div class="ogt">공사 · '+g[1]+'</div>'+(L.length?L.map(j=>'<button type="button" class="adr" onclick="admGo({t:\'job\',sub:\''+g[0]+'\',id:\''+admQt(j.id)+'\'})"><span class="nm"><b>'+escapeText(j.name)+'</b><small>'+escapeText(j.st==='OPEN'?(j.end?'~ '+j.end+(j.end<d.today?' (지남)':''):'종료일 없음'):j.ended+' 종료'+(j.left?' · 평가 '+j.left+'곳 남음':''))+'</small></span><i aria-hidden="true">›</i></button>').join(''):'<div class="adempty">없습니다</div>')}
 if(s.t==='job')return admJobView();
 if(s.t==='tbl')return admTblView();
 if(s.t==='logs')return '<div class="ogt">🧾 오래된 이력 지우기</div><div class="adst">사용 이력 · 메일·Teams 기록 중 오래된 것만 (지금 '+Number(d.logs||0).toLocaleString()+'건) · 업무 기록은 그대로</div>'
  +(admCf?admCfBox():[30,90,180].map(n=>'<button type="button" class="adbig" onclick="admAskPv({kind:\'logs\',days:'+n+'})">'+n+'일 지난 것</button>').join(''));
 if(s.t==='reset')return '<div class="ogt">⛔ 전체 초기화</div><div class="adst">운영 시작 전 테스트 기록을 모두 지울 때만 씁니다. 직원 명단 · 조직도 · 표준양식 · 로그인 계정은 남습니다. 드라이브 파일은 휴지통으로 (30일 안에 복구 가능).</div>'
  +(admCf?admCfBox():'<div class="adcf"><b>모든 업체 · 공사 · 기록을 지웁니다</b><p>되돌릴 수 없습니다. 아래 칸에 삭제 라고 적어야 버튼이 켜집니다.</p><input class="adinp" id="f_admAll" autocomplete="off" placeholder="삭제" aria-label="확인 글자 (삭제)" oninput="$(\'admAllBtn\').disabled=this.value.trim()!==\'삭제\'"><button type="button" class="adbtn d" id="admAllBtn" disabled onclick="admAskPv({kind:\'all\'})">지울 개수 보기</button></div>');
 return ''}
function admCoLine(c){return c.g==='pend'?'신청 '+c.days+'일째'+(c.fail?' · 메일 실패':c.noOrg?' · 조직도에 없는 주소':''):c.g==='sub'?'제출 '+c.days+'일째':c.g==='ok'?'승인 '+c.at:c.g==='rej'?'반려':(c.sub==='CORRECTION'?'보완 요청':'작성 중')+(c.renew?' · 재평가':'')}
function admCoView(){const c=admT.co.find(x=>x.id===admS.id);if(!c)return '<div class="adempty">이미 지워졌습니다</div>';const p=ADM_CO_PILL[c.g]||['','k'];
 let h='<button type="button" class="adback" onclick="admGo({t:\'co\',sub:\''+c.g+'\'})">‹ 목록</button><div class="ogt">'+escapeText(c.name)+' <span class="apl '+p[1]+'">'+escapeText(c.g==='draft'&&c.sub==='CORRECTION'?'보완 요청':p[0])+'</span></div>'
  +'<div class="adst">담당 '+escapeText(c.ap||'-')+(c.fail?'<br><span class="r">⚠ 최근 이 주소로 메일·Teams 보내기 실패</span>':'')+(c.noOrg?'<br><span class="r">⚠ 조직도에 없는 주소입니다 (오타인지 확인)</span>':'')+'</div>';
 if(admCf)return h+admCfBox();
 if(admEdit)return h+'<div class="adcf m"><b>새 담당자 이메일</b><p>저장하면 새 주소로 승인 요청이 다시 갑니다 (메일 · Teams).</p><input class="adinp" id="f_admAp" type="email" autocomplete="off" value="'+escapeText(c.ap)+'" aria-label="새 담당자 이메일"><button type="button" class="adbtn m" onclick="admFix(\'apEmail\')">저장하고 다시 보내기</button><button type="button" class="adbtn g" onclick="admEdit=false;admDraw()">취소</button></div>';
 const B=[];if(c.g==='pend')B.push(['✉ 담당자 이메일 바꾸기','admEdit=true;admDraw();setTimeout(()=>$(\'f_admAp\')?.focus(),50)'],['↻ 승인 요청 다시 보내기','admFix(\'resendApprove\')']);
 if(c.g==='sub')B.push(['↻ 검토 요청 다시 보내기','admFix(\'resendReview\')'],['↩ 작성 중으로 되돌리기','admFix(\'toDraft\')']);
 if(c.g==='ok')B.push(['📊 계약 전 평가 결과 보기','openEvalResult(\'CE_'+admQt(c.id)+'\',\'\')']);
 return h+B.map(b=>'<button type="button" class="adbig" onclick="'+b[1]+'">'+b[0]+'</button>').join('')+'<button type="button" class="addel" onclick="admAskPv({kind:\'company\',id:\''+admQt(c.id)+'\'})">🗑 이 업체 지우기</button>'}
function admJobView(){const j=admT.job.find(x=>x.id===admS.id);if(!j)return '<div class="adempty">이미 지워졌습니다</div>';const T=admT.today;
 let h='<button type="button" class="adback" onclick="admGo({t:\'job\',sub:\''+(j.st==='ENDED'?'ended':'open')+'\'})">‹ 목록</button><div class="ogt">'+escapeText(j.name)+' <span class="apl '+(j.st==='OPEN'?'b':'k')+'">'+(j.st==='OPEN'?'진행 중':'종료')+'</span></div>'
  +'<div class="adst">'+escapeText(j.store?'다이소 '+j.store+' · ':'')+(j.st==='OPEN'?escapeText(j.start+' ~ '+(j.end||''))+(j.end&&j.end<T?' <span class="r">(종료일 지남)</span>':''):escapeText(j.ended+' 종료')+' · '+(j.left?'<span class="r">평가 '+j.left+'곳 남음</span>':'평가 완료'))+'</div>';
 if(admCf)return h+admCfBox();
 const B=j.st==='ENDED'?[['↩ 종료 취소 (다시 진행 중으로)','admFix(\'unEnd\')'],['📊 종료 평가 화면 열기','smenu=\'jobs\';markSMenu();openJobEval(\''+admQt(j.id)+'\')']]:[['📂 공사 관리 화면 열기','sgo(\'jobs\')']];
 return h+B.map(b=>'<button type="button" class="adbig" onclick="'+b[1]+'">'+b[0]+'</button>').join('')+'<button type="button" class="addel" onclick="admAskPv({kind:\'job\',id:\''+admQt(j.id)+'\'})">🗑 이 공사 지우기</button>'}
/* 확인 창 (오른쪽 칸 안) */
function admCfBox(){const c=admCf;if(c.k==='tbl')return '<div class="adcf"><b>정말 지울까요?</b><p>'+c.rows+'줄'+(c.kids?' + 딸린 기록 '+c.kids+'건':'')+'이 지워지고 되돌릴 수 없습니다.</p><button type="button" class="adbtn d" onclick="admRowsDel()">지우기</button><button type="button" class="adbtn g" onclick="admCf=null;admDraw()">취소</button></div>';
 const v=admPv||{};if(!v.total&&!v.drive)return '<div class="adcf m"><b>지울 기록이 없습니다</b><p>'+escapeText(v.title||'')+'</p><button type="button" class="adbtn g" onclick="admCf=null;admPv=null;admDraw()">닫기</button></div>';
 return '<div class="adcf"><b>정말 지울까요?</b><p>'+escapeText(v.title)+'\n기록 '+Number(v.total).toLocaleString()+'건'+(v.items.some(x=>x.n>=1000)?' 이상':'')+'이 함께 지워지고 되돌릴 수 없습니다.'+(v.drive?'\n드라이브 폴더 '+v.drive+'개는 휴지통으로 (30일 안에 복구 가능)':'')+'</p><button type="button" class="adbtn d" onclick="admRunDel()">지우기</button><button type="button" class="adbtn g" onclick="admCf=null;admPv=null;admDraw()">취소</button></div>'}
async function admAskPv(p){try{admPv=await call('adminPreview',p)}catch(e){return}admCf={k:'pv',kind:p.kind};admDraw()}
/** 지우기 (50초씩 나눠서 끝날 때까지 이어서) */
async function admRunDel(){if(!admPv)return;const tk=admPv.token,title=admPv.title,kind=admCf&&admCf.kind;let n=0,tr=0;
 try{for(let i=0;i<40;i++){const r=await call('adminDelete',tk);n+=r.deleted;tr+=r.trashed||0;if(!r.more)break;msg('지우는 중… '+n.toLocaleString()+'건 (계속)')}}
 catch(e){admPv=null;admCf=null;admLoad();return}
 admPv=null;admCf=null;admRowsD=null;cacheClear();jobData=null;jobAt=0;if(typeof svData!=='undefined')svData=null;
 if(kind==='company'||kind==='job')admS={t:admS.t,sub:admS.sub};if(kind==='all')admS={t:'issues'};
 popup('지우기 완료',title+'\n\n기록 '+n.toLocaleString()+'건'+(tr?'\n드라이브 폴더 '+tr+'개 → 휴지통 (30일 안에 복구 가능)':''),'확인');admLoad()}
/** 바로 처리 */
async function admFix(act){const id=admS.id;let email='';
 if(act==='apEmail'){email=($('f_admAp')?.value||'').trim().toLowerCase();if(!/^[^\s@]+@daiso\.co\.kr$/.test(email)){inspFlag(['f_admAp'],'@daiso.co.kr 회사메일을 적어 주세요');return}}
 if(act==='toDraft'&&!await askOk('작성 중으로 되돌리기','업체가 서류를 다시 고칠 수 있게 「작성 중」으로 되돌립니다.\n업체가 다시 제출하면 검토 요청이 새로 갑니다.','되돌리기'))return;
 if(act==='unEnd'&&!await askOk('공사 종료 취소','이 공사를 다시 「진행 중」으로 바꿉니다.\n작성 중이던 종료 평가는 지워지고, 확정된 평가는 그대로 남습니다.','종료 취소'))return;
 let r;try{r=await call('adminFix',act,id,email)}catch(e){return}admEdit=false;cacheClear();jobData=null;jobAt=0;
 if(act==='toDraft')admS={t:'co',sub:'draft',id};if(act==='unEnd')admS={t:'job',sub:'open',id};
 popup('처리 완료',r.msg||'처리했습니다.','확인');admLoad()}
/* 📋 표로 보기 (예전 시트처럼: 체크해서 지우기) */
function admTblView(){const k=admS.sub,t=ADM_TBL.find(x=>x[0]===k)||ADM_TBL[0];
 if(!admRowsD||admRowsD.kind!==k){call('adminRows',k).then(r=>{admRowsD=r;if(admS.t==='tbl'&&admS.sub===k)admDraw()}).catch(()=>{});return '<div class="ogt">📋 '+t[1]+'</div><div class="adempty">불러오는 중입니다…</div>'}
 const all=admRowsD.rows;[...admChk].forEach(id=>{if(!all.some(r=>r.id===id))admChk.delete(id)});const kids=all.filter(r=>admChk.has(r.id)).reduce((s,r)=>s+(r.kids||0),0);
 return '<div class="ogt">📋 '+t[1]+' <span class="muted" style="font-weight:400;font-size:12px">'+all.length+'줄'+(admRowsD.more?' (최근 300줄만)':'')+'</span></div>'
  +'<input class="adsrch" id="f_admQ" placeholder="🔍 업체 · 공사 · 날짜로 거르기" value="'+escapeText(admQ)+'" oninput="admQ=this.value;admTb()" aria-label="표 거르기">'
  +'<div id="admTb"></div>'
  +(admCf&&admCf.k==='tbl'?admCfBox():'<div class="adsel">'+(admChk.size?'<button type="button" class="adbtn d" onclick="admCf={k:\'tbl\',rows:'+admChk.size+',kids:'+kids+'};admDraw()">🗑 선택한 '+admChk.size+'줄 지우기'+(kids?' (+딸린 '+kids+'건)':'')+'</button>':'<div class="muted" style="font-size:12px;text-align:center">☐ 체크해서 지울 줄을 고르세요 · 줄을 누르면 내용이 펼쳐집니다</div>')+'</div>')}
function admTbL(){const q=admQ.trim();return (admRowsD?admRowsD.rows:[]).filter(r=>!q||(r.a+' '+r.b).includes(q))}
function admTb(){const el=$('admTb');if(!el||!admRowsD)return;const L=admTbL(),allOn=L.length&&L.every(r=>admChk.has(r.id));
 el.innerHTML='<div class="adtbar"><label><input type="checkbox" '+(allOn?'checked':'')+' onchange="admCkAll(this.checked)"> 보이는 것 모두</label><span style="margin-left:auto">'+L.length+'줄</span></div>'
  +(L.length?L.map((r,i)=>'<div class="adtr'+(admChk.has(r.id)?' on':'')+(admXp.has(r.id)?' open':'')+'"><div class="h"><input type="checkbox" aria-label="'+escapeText(r.a)+' 선택" '+(admChk.has(r.id)?'checked':'')+' onchange="admCk('+i+',this.checked)"><button type="button" class="nm" aria-expanded="'+admXp.has(r.id)+'" onclick="admXpT('+i+')"><b>'+escapeText(r.a)+'</b><small>'+escapeText(r.b)+'</small></button><span class="apl '+escapeText(r.p[1])+'">'+escapeText(r.p[0])+'</span></div><div class="dt">'+(r.d||[]).filter(x=>x[1]!==''&&x[1]!=null).map(x=>'<div><span>'+escapeText(x[0])+'</span><span>'+escapeText(x[1])+'</span></div>').join('')+'</div></div>').join(''):'<div class="adempty">맞는 줄이 없습니다</div>')}
function admCk(i,v){const r=admTbL()[i];if(!r)return;v?admChk.add(r.id):admChk.delete(r.id);admCf=null;const q=admQ;admDraw();if(q){const e=$('f_admQ');if(e){e.focus();e.setSelectionRange(q.length,q.length)}}}
function admCkAll(v){admTbL().forEach(r=>v?admChk.add(r.id):admChk.delete(r.id));admCf=null;admDraw()}
function admXpT(i){const r=admTbL()[i];if(!r)return;admXp.has(r.id)?admXp.delete(r.id):admXp.add(r.id);admTb()}
async function admRowsDel(){const k=admS.sub,ids=[...admChk];if(!ids.length)return;let r;try{r=await call('adminRowsDelete',k,ids)}catch(e){return}
 admChk=new Set();admCf=null;admRowsD=null;cacheClear();jobData=null;jobAt=0;msg(r.rows+'줄'+(r.deleted>r.rows?' (+딸린 '+(r.deleted-r.rows)+'건)':'')+'을 지웠습니다.');admLoad()}
/* ---------- F1.8k [마스터] 도급인 책임자 설정 ----------
 *  총괄책임자(김기호) → 위임받는 책임자(곽동민) · 담당자(비우면 마스터 직원 이름)
 *  위임장 2장 · 순회점검 승인 · 회의록·점검표 머리 · 규정 "갑" 현장대리인에 그대로 들어감 */
const PR_ROWS=[['ceo','총괄책임자 (위임인)'],['delegate','위임받는 책임자 (수임인)'],['manager','도급인 담당자 (검토 · 허가서 승인)']];
const PR_F=[['name','성명'],['rank','직급'],['title','직책'],['org','소속 및 직책']];
function sPrincipal(){setTimeout(()=>sgo('staff'),0);return '<div class="card"><p class="desc">조직도로 이동합니다…</p></div>'}  /* F1.9j 도급인 책임자 = 조직도에서 사람마다 지정 */
async function prLoad(){let P;try{P=await call('principalGet')}catch(e){return}const b=$('prBox');if(!b)return;
 b.innerHTML='<div class="card"><h2 style="margin:0">도급인 책임자 설정</h2><p class="muted" style="margin-top:6px">위임장(협의체 · 합동점검) · 순회점검일지 승인 · 회의록 머리 · 규정 "갑" 현장대리인에 들어갑니다.</p></div>'
  +PR_ROWS.map(([k,l])=>'<div class="card"><h2>'+escapeText(l)+'</h2><div class="split">'+PR_F.map(([f,fl])=>input('pr_'+k+'_'+f,fl,(P[k]||{})[f]||'','text',false,((P.def||{})[k]||{})[f]||'')).join('')+'</div>'+(k==='manager'?'<p class="muted">비워 두면 마스터 계정 직원 이름이 들어갑니다. 허가서 승인·일지 확인 기록은 실제로 버튼을 누른 사람 이름으로 남습니다.</p>':'')+'</div>').join('')
  +'<div class="card roomfoot"><button class="button" type="button" style="width:100%" onclick="prSave()">저장</button></div>'}
async function prSave(){const d={};PR_ROWS.forEach(([k])=>{d[k]={};PR_F.forEach(([f])=>d[k][f]=value('pr_'+k+'_'+f))});
 if(!d.ceo.name||!d.delegate.name){inspFlag([!d.ceo.name?'f_pr_ceo_name':'f_pr_delegate_name'],'총괄책임자와 위임받는 책임자 이름은 꼭 적어 주세요');return}
 try{const P=await call('principalSave',d);if(jobData)jobData.principal=P;jobAt=0;msg('저장했습니다. 위임장·일지에 바로 반영됩니다.');prLoad()}catch(e){}}
