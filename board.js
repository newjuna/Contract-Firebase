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
 return [['permit','작업허가서 승인 대기',j.permitWaiting||0,'건','openPermitList(\''+escapeText(j.id)+'\')'],['insp','순회점검일지 확인 대기',j.inspUnchecked||0,'건','openInspList(\''+escapeText(j.id)+'\')'],['insp','미조치 지적사항',j.findOpen||0,'건','openInspList(\''+escapeText(j.id)+'\')'],
  ['meet','미팅 참석 확인 대기',pend,'명'],['eval',j.end&&j.end.state==='OVER'?'종료일 경과 · 연장 또는 종료':'종료 예정 · 연장 또는 종료',j.status!=='ENDED'&&j.end&&['SOON','OVER'].includes(j.end.state)?1:0,'','jobEndPage(\''+escapeText(j.id)+'\')'],['eval','종료 평가 대기',j.status==='ENDED'?ev:0,'건','openJobEval(\''+escapeText(j.id)+'\')']]}
/** 공사 1건의 주의 사항 (업체별) */
function jWatch(j,t){const rows=[];if(j.status!=='ENDED'&&j.end&&j.end.state==='OVER')rows.push(['공사 전체','종료일 경과 · 연장 또는 종료 필요']);
 (j.vstats||[]).forEach(v=>{const r=[];if(v.inspNeed&&v.insp/v.inspNeed<0.6)r.push('순회점검 '+Math.round(v.insp/v.inspNeed*100)+'%');if(v.openFindings>=2)r.push('미조치 지적 '+v.openFindings+'건');if(v.workDays&&v.permitDays/v.workDays<0.6)r.push('허가서 '+Math.round(v.permitDays/v.workDays*100)+'%');if(v.lastInsp&&!v.inspToday&&dd(v.lastInsp,t)>=4)r.push('순회점검 '+dd(v.lastInsp,t)+'일 없음');if(r.length)rows.push([v.company,r.join(' · ')])});return rows}
/* ---------- ① 대시보드: 공사 목록 ---------- */
function sDash(d){if(dashJob){const j=d.jobs.find(x=>x.id===dashJob);if(j)return sDashJob(d,j);dashJob=''}
 const t=kstToday(),safety=d.me.role==='SAFETY',act=sAct(d),ended=sEnded(d),B=(state&&state.badges)||{},nv=(B.newVendors||[]).length;
 const score=j=>sum(jTodo(j),x=>x[2])+jWatch(j,t).length*2;
 const card=j=>{const R=sRates(j),w=jWatch(j,t).length,s=j.startDate,e=j.endDate||j.startDate,tot=Math.max(1,dd(s,e)+1),pct=j.status==='ENDED'?100:Math.max(0,Math.min(100,Math.round((dd(s,t)+1)/tot*100)));
  return '<button class="jcard" type="button" onclick="dashOpen(\''+escapeText(j.id)+'\')"><div class="row" style="justify-content:space-between;gap:6px"><b>'+escapeText(j.title)+'</b><span class="muted">'+escapeText(j.storeName)+'</span></div>'
   +'<div class="gbar'+(j.status==='ENDED'?' end':'')+'" aria-hidden="true"><span style="width:'+pct+'%"></span></div>'
   +'<div class="muted">'+escapeText(s.slice(5).replace('-','/'))+' ~ '+escapeText(e.slice(5).replace('-','/'))+' · 업체 '+j.vendors.length+'곳 · 순회 '+pctTxt(R.insp)+' · 허가서 '+pctTxt(R.permit)+'</div>'
   +'<div class="bchips">'+chip(j.permitWaiting,'허가서 대기',1)+chip(j.inspUnchecked,'일지 확인',1)+chip(j.findOpen,'미조치',1)+chip(sum(j.meetings||[],m=>m.pending),'참석 확인',1)+(j.status!=='ENDED'&&j.end&&j.end.state==='OVER'?'<span class="bchip red">종료일 경과</span>':j.status!=='ENDED'&&j.end&&j.end.state==='SOON'?'<span class="bchip">종료 '+(j.end.left?j.end.left+'일 전':'오늘')+'</span>':'')+chip(w,'주의',1)+(j.status==='ENDED'?chip((j.evalTotal||0)-(j.evalDone||0),'평가 대기',1):'')+'</div></button>'};
 let h='<div class="card"><h2 style="margin:0">'+escapeText(d.me.name)+' 님</h2><div class="muted">'+escapeText(t)+' · '+(safety?'전체 공사':'내 공사')+' 진행 '+act.length+'건'+(ended.length?' · 종료 '+ended.length+'건':'')+'</div>'
  +'<div class="bchips" style="margin-top:8px">'+chip(sum(act,j=>j.permitWaiting),'허가서 대기',1)+chip(sum(d.jobs,j=>j.inspUnchecked),'일지 확인',1)+chip(sum(act,j=>j.findOpen),'미조치',1)+'</div>'
  +(nv?'<button class="vtodo" type="button" style="margin-top:10px" onclick="sgo(\'jobs\')"><span>공사 배정 대기 업체</span><span class="req">'+nv+'곳 ›</span></button>':'')
  +(safety&&B.notices?'<button class="vtodo" type="button" onclick="sgo(\'notice\')"><span>새 참조 알림</span><span class="req">'+B.notices+'건 ›</span></button>':'')+'</div>';
 if(!d.jobs.length)return h+sNone('등록된 공사가 없습니다. ☰ → 공사 관리에서 [+ 새 공사 만들기]로 시작하세요.');
 h+='<div class="card"><h2>진행 중인 공사 '+act.length+'</h2><p class="muted" style="margin:-4px 0 8px">처리할 일이 많은 공사가 위에 옵니다. 누르면 그 공사의 현황이 열립니다.</p>'+(act.slice().sort((a,b)=>score(b)-score(a)).map(card).join('')||'<p class="muted">진행 중인 공사가 없습니다.</p>')+'</div>';
 if(ended.length)h+='<div class="card"><details class="hist"><summary>종료된 공사 '+ended.length+'건</summary>'+ended.map(card).join('')+'</details></div>';
 if(safety)h+=sWatchFind(d);return h}
function dashOpen(id){dashJob=id;renderJobs();window.scrollTo(0,0)}
function dashBack(){dashJob='';renderJobs();window.scrollTo(0,0)}
/** 안전보건팀: 업체별 지적 현황 (전체) */
function sWatchFind(d){const by={};d.jobs.forEach(j=>(j.vstats||[]).forEach(v=>{const x=by[v.companyId]||(by[v.companyId]={company:v.company,total:0,open:0,jobs:0});x.total+=v.findTotal||0;x.open+=v.openFindings||0;x.jobs++}));
 const top=Object.values(by).filter(x=>x.total).sort((a,b)=>b.total-a.total||b.open-a.open).slice(0,8);if(!top.length)return '';
 return '<div class="card"><h2>업체별 지적 현황</h2><table class="rtable"><tr><th>업체</th><th>지적</th><th>미조치</th><th>공사</th></tr>'+top.map(x=>'<tr><td>'+escapeText(x.company)+'</td><td>'+x.total+'</td><td'+(x.open?' class="req"':'')+'>'+x.open+'</td><td>'+x.jobs+'</td></tr>').join('')+'</table></div>'}
/* ---------- ② 대시보드: 공사 1건 현황 ---------- */
function sDashJob(d,j){const t=kstToday(),R=sRates(j),todo=sTodo(jTodo(j)),W=jWatch(j,t),V=j.vstats||[],cls=r=>r!=null&&r<0.6?' class="req"':'';
 return '<div class="card"><button class="button ghost" type="button" onclick="dashBack()">← 공사 목록</button><h2 style="margin-top:12px">'+escapeText(j.title)+(j.status==='ENDED'?' <span class="pill todo">종료</span>':'')+'</h2><div class="muted">'+sMeta(j)+' · 업체 '+j.vendors.length+'곳</div></div>'
  +'<div class="card"><h2>오늘 처리할 일</h2>'+(todo||'<div class="note">✔ 처리할 일이 없습니다.</div>')+'</div>'
  +'<div class="card"><h2>공사 일정</h2>'+ganttRow(j,t,true)+'</div>'
  +'<div class="card"><h2>매장 이행 현황</h2><div class="dns">'+donut(R.insp,'순회점검',R.inspTxt)+donut(R.permit,'작업허가서',R.permitTxt)+donut(R.crew,'인원·수칙',R.crewTxt)+'</div><p class="muted" style="text-align:center;margin:4px 0 0">참여 업체 합계 · 작업일 기준</p>'
  +(V.length?'<table class="rtable" style="margin-top:12px"><tr><th>업체</th><th>순회</th><th>허가서</th><th>인원</th><th>미조치</th></tr>'+V.map(v=>{const ri=v.inspNeed?v.insp/v.inspNeed:null,rp=v.workDays?v.permitDays/v.workDays:null,rc=v.workDays?v.crewDays/v.workDays:null;return '<tr><td><b>'+escapeText(v.company)+'</b><div class="muted">작업일 '+v.workDays+'일'+(v.lastInsp?' · 점검 '+escapeText(v.lastInsp.slice(5)):'')+'</div></td><td'+cls(ri)+'>'+pctTxt(ri)+'</td><td'+cls(rp)+'>'+pctTxt(rp)+'</td><td'+cls(rc)+'>'+pctTxt(rc)+'</td><td'+(v.openFindings?' class="req"':'')+'>'+v.openFindings+'</td></tr>'}).join('')+'</table>':'')+'</div>'
  +'<div class="card"><h2>주의가 필요한 업체 '+(W.length?'<span class="cnt">'+W.length+'</span>':'')+'</h2>'+(W.length?W.map(r=>'<div class="item" style="padding:8px 0"><b>'+escapeText(r[0])+'</b><div class="req" style="font-size:13px">'+escapeText(r[1])+'</div></div>').join(''):'<p class="muted">기준(순회점검·허가서 60% 미만, 미조치 2건 이상, 순회점검 4일 이상 없음)에 걸린 업체가 없습니다.</p>')+'</div>'
  +'<div class="card"><div class="row"><button class="button ghost" type="button" style="flex:1" onclick="openPermitList(\''+escapeText(j.id)+'\')">작업허가서</button><button class="button ghost" type="button" style="flex:1" onclick="openInspList(\''+escapeText(j.id)+'\')">순회점검</button><button class="button ghost" type="button" style="flex:1" onclick="smenu=\'meet\';markSMenu();renderJobs()">미팅</button></div></div>'}
/* ---------- 작업허가서: 업체별 요약 + 거르기 + 일괄 승인 ---------- */
function pmFlags(p,t){const f=[];if(p.status==='ISSUED'&&p.date<t)f.push('승인 지연 '+dd(p.date,t)+'일');if(p.date<t&&!p.completed)f.push('작업완료 미기록');return f}
function renderPermitList(){const d=permitJob,t=kstToday(),L=d.list;jobsMode='permits';
 const wait=L.filter(p=>p.status==='ISSUED'),spec=L.filter(p=>pmFlags(p,t).length),by={};
 L.forEach(p=>{const x=by[p.company]||(by[p.company]={n:0,wait:0,spec:0,today:false,last:''});x.n++;if(p.status==='ISSUED')x.wait++;if(pmFlags(p,t).length)x.spec++;if(p.date===t)x.today=true;if(p.date>x.last)x.last=p.date});
 const F=[['wait','승인 대기',wait.length],['spec','특이사항',spec.length],['all','전체',L.length]],show=pmFilter==='wait'?wait:pmFilter==='spec'?spec:L;
 let g='';const rows=show.map(p=>{const head=p.date!==g?(g=p.date,'<div class="stage">'+escapeText(p.date)+(p.date===t?' (오늘)':'')+'</div>'):'',fl=pmFlags(p,t),st=P_STATUS[p.status]||[p.status,'todo'];
  return head+'<div class="blrow">'+(p.status==='ISSUED'?'<input type="checkbox" class="pmck" value="'+escapeText(p.id)+'" aria-label="'+escapeText(p.company+' '+p.no)+' 선택">':'<span class="blsp"></span>')+'<button type="button" class="blmain" onclick="openPermitStaff(\''+escapeText(p.id)+'\')"><b>'+escapeText(p.company)+'</b> <span class="pill '+st[1]+'">'+escapeText(st[0])+'</span><div class="muted">'+escapeText(p.workName)+' · '+escapeText(p.start)+'~'+escapeText(p.end)+'</div>'+(fl.length?'<div class="req" style="font-size:12px">⚠ '+escapeText(fl.join(' · '))+'</div>':'')+'</button></div>'}).join('');
 $('jobs').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="loadJobs()">← 돌아가기</button><h2 style="margin-top:12px">작업허가서 · '+escapeText(d.job.title)+'</h2><p class="muted">업체는 발행 즉시 작업하고, 도급인은 확인 후 승인합니다.</p></div>'
  +'<div class="card"><h2>업체별 현황</h2>'+(Object.keys(by).length?'<table class="rtable"><tr><th>업체</th><th>발행</th><th>대기</th><th>특이</th><th>오늘</th></tr>'+Object.entries(by).sort((a,b)=>b[1].wait-a[1].wait).map(([c,x])=>'<tr><td><b>'+escapeText(c)+'</b></td><td>'+x.n+'</td><td'+(x.wait?' class="req"':'')+'>'+x.wait+'</td><td'+(x.spec?' class="req"':'')+'>'+x.spec+'</td><td>'+(x.today?'✔':'<span class="muted">-</span>')+'</td></tr>').join('')+'</table>':'<p class="muted">아직 발행된 허가서가 없습니다.</p>')+'</div>'
  +'<div class="card"><div class="seg" role="tablist" style="margin-top:0">'+F.map(([k,l,n])=>'<button type="button" role="tab" aria-selected="'+(pmFilter===k)+'" class="'+(pmFilter===k?'on':'')+'" onclick="pmFilter=\''+k+'\';renderPermitList()">'+l+' '+n+'</button>').join('')+'</div>'
  +(rows||'<p class="muted" style="margin-top:10px">'+(pmFilter==='wait'?'승인 대기 허가서가 없습니다.':pmFilter==='spec'?'특이사항이 있는 허가서가 없습니다.':'허가서가 없습니다.')+'</p>')+'</div>'
  +(wait.length?'<div class="card roomfoot"><div class="row"><button class="button ghost" type="button" style="flex:1" onclick="pmApprove(false)">선택 승인</button><button class="button" type="button" style="flex:1" onclick="pmApprove(true)">대기 전체 승인 '+wait.length+'건</button></div></div>':'');window.scrollTo(0,0)}
async function pmApprove(all){const ids=all?[]:[...document.querySelectorAll('.pmck:checked')].map(x=>x.value),n=all?permitJob.list.filter(p=>p.status==='ISSUED').length:ids.length;if(!n){msg('승인할 허가서를 체크해 주세요.');return}
 if(!confirm('작업허가서 '+n+'건을 승인할까요?\n승인자: '+(state.staff?state.staff.name:'')+' (일괄 승인으로 기록)'))return;
 try{permitJob=await call('approvePermits',permitJob.job.id,ids,'');renderPermitList();msg(n+'건 승인했습니다.');refreshBadges();const j=jobData&&jobData.jobs.find(x=>x.id===permitJob.job.id);if(j)j.permitWaiting=permitJob.list.filter(p=>p.status==='ISSUED').length}catch(e){}}
/* ---------- 순회점검: 업체별 요약 + 거르기 + 일괄 확인 ---------- */
function renderInspList(){const d=inspJob,t=kstToday(),L=d.list,open=d.findings.filter(f=>f.status!=='DONE');jobsMode='insp';
 const wait=L.filter(x=>!x.checkedAt),bad=L.filter(x=>x.bad),F=[['wait','확인 대기',wait.length],['bad','지적 있음',bad.length],['all','전체',L.length]],show=inFilter==='wait'?wait:inFilter==='bad'?bad:L;
 const vrow=v=>{const my=L.filter(x=>x.companyId===v.companyId),op=open.filter(f=>f.companyId===v.companyId).length,late=v.since==null||v.since>=2;
  return '<tr><td><b>'+escapeText(v.company)+'</b></td><td'+(late?' class="req"':'')+'>'+(v.last?escapeText(v.last.slice(5))+'<div class="muted">'+v.since+'일 전</div>':'없음')+'</td><td>'+my.length+'</td><td'+(my.some(x=>!x.checkedAt)?' class="req"':'')+'>'+my.filter(x=>!x.checkedAt).length+'</td><td'+(op?' class="req"':'')+'>'+op+'</td></tr>'};
 let g='';const rows=show.map(x=>{const head=x.date!==g?(g=x.date,'<div class="stage">'+escapeText(x.date)+(x.date===t?' (오늘)':'')+'</div>'):'';
  return head+'<div class="blrow">'+(!x.checkedAt?'<input type="checkbox" class="inck" value="'+escapeText(x.id)+'" aria-label="'+escapeText(x.company+' '+x.date)+' 선택">':'<span class="blsp"></span>')+'<button type="button" class="blmain" onclick="openInspSheet(\''+escapeText(x.id)+'\',\'staff\')"><b>'+escapeText(x.company)+'</b> '+(x.checkedAt?'<span class="pill ok">확인</span>':'<span class="pill todo">확인 대기</span>')+'<div class="muted">점검 '+escapeText(x.submittedName)+'</div>'+(x.bad?'<div class="req" style="font-size:12px">⚠ 지적 '+x.bad+'건</div>':'<div class="muted">이상 없음</div>')+'</button></div>'}).join('');
 $('jobs').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="loadJobs()">← 돌아가기</button><h2 style="margin-top:12px">순회점검일지 · '+escapeText(d.job.title)+'</h2><p class="muted">업체가 2일 1회 작성합니다. 확인하면 일지에 "도급인 확인"이 남습니다.</p></div>'
  +'<div class="card"><h2>업체별 현황</h2><table class="rtable"><tr><th>업체</th><th>마지막</th><th>일지</th><th>대기</th><th>미조치</th></tr>'+d.vendors.slice().sort((a,b)=>(b.since==null?99:b.since)-(a.since==null?99:a.since)).map(vrow).join('')+'</table><p class="muted" style="margin-top:6px">빨간 글씨 = 점검 2일 이상 지남 · 확인 대기 · 미조치 있음</p></div>'
  +(open.length?'<div class="card"><details class="hist"'+(open.length<=5?' open':'')+'><summary><b>미조치 지적사항 '+open.length+'건</b></summary>'+open.map(f=>findRow(f,'staff')).join('')+'</details></div>':'')
  +'<div class="card"><div class="seg" role="tablist" style="margin-top:0">'+F.map(([k,l,n])=>'<button type="button" role="tab" aria-selected="'+(inFilter===k)+'" class="'+(inFilter===k?'on':'')+'" onclick="inFilter=\''+k+'\';renderInspList()">'+l+' '+n+'</button>').join('')+'</div>'
  +(rows||'<p class="muted" style="margin-top:10px">'+(inFilter==='wait'?'확인 대기 일지가 없습니다.':inFilter==='bad'?'지적이 있는 일지가 없습니다.':'아직 제출된 일지가 없습니다.')+'</p>')+'</div>'
  +(wait.length?'<div class="card roomfoot"><div class="row"><button class="button ghost" type="button" style="flex:1" onclick="inCheck(false)">선택 확인</button><button class="button" type="button" style="flex:1" onclick="inCheck(true)">대기 전체 확인 '+wait.length+'건</button></div></div>':'');window.scrollTo(0,0)}
async function inCheck(all){const ids=all?[]:[...document.querySelectorAll('.inck:checked')].map(x=>x.value),n=all?inspJob.list.filter(x=>!x.checkedAt).length:ids.length;if(!n){msg('확인할 일지를 체크해 주세요.');return}
 if(!confirm('순회점검일지 '+n+'건을 확인할까요?\n일지에 "도급인 확인: '+(state.staff?state.staff.name:'')+'"이 남습니다.'))return;
 try{inspJob=await call('checkInspections',inspJob.job.id,ids);renderInspList();msg(n+'건 확인했습니다.');refreshBadges();const j=jobData&&jobData.jobs.find(x=>x.id===inspJob.job.id);if(j)j.inspUnchecked=inspJob.list.filter(x=>!x.checkedAt).length}catch(e){}}
