/* 공사 연장 · 공사 종료 · 공사 종료 평가 · 참조 알림 (v5.1)
 *  공사 카드 [연장·종료] → 새 종료일·사유로 연장 / [공사 종료] → 참여 업체마다 평가서 생성
 *  평가: 12항목을 수행 기록으로 자동 체크 → 담당자가 확인·수정 → [평가 확정] = 최종 (안전보건팀은 참조 알림)
 *  확정 후 [결과지 PDF] [전체 활동내역 ZIP] 내려받기 · 원본 기록은 지우지 않음
 *  서버: Code.gs (extendJob · endJob · jobEvalList · saveJobEval · reopenJobEval · jobEvalFile · noticeList · readNotices) */
const EV_LV={G:'우수',N:'보통',P:'미흡'},EV_CLS={G:'ok',N:'na',P:'bad'};
let evData=null,evCur=null;
const gradePill=g=>'<span class="pill '+(['S','A'].includes(g)?'ok':['C','D'].includes(g)?'bad':'todo')+'">'+escapeText(g)+'등급</span>';
/* ---------- 공사 카드: 기간 줄 ---------- */
function jobEndHtml(j){const e=j.end||{state:'OPEN'},id=escapeText(j.id);
 if(e.state==='ENDED'){const need=(j.evalTotal||0)-(j.evalDone||0);
  return '<div class="line"></div><div class="row" style="justify-content:space-between"><b>공사 종료 <span class="muted">'+escapeText(e.endedAt||'')+'</span> · 종료 평가 '+(j.evalDone||0)+'/'+(j.evalTotal||0)+(need?' <span class="cnt">'+need+'</span> <span class="req" style="font-size:13px">평가 필요</span>':' <span class="pill ok">완료</span>')+'</b><button class="button'+(need?'':' ghost')+'" type="button" onclick="openJobEval(\''+id+'\')">종료 평가</button></div>'}
 const warn=e.state==='SOON'?' <span class="pill todo">종료 예정 '+(e.left?e.left+'일 전':'오늘')+'</span>':e.state==='OVER'?' <span class="pill bad">종료일 경과 · 연장 또는 종료 필요</span>':'';
 return '<div class="line"></div><div class="row" style="justify-content:space-between"><b>공사 기간'+warn+'</b><button class="button'+(e.state==='OPEN'?' ghost':'')+'" type="button" onclick="jobEndPage(\''+id+'\')">연장·종료</button></div>'}
/* ---------- 연장·종료 화면 ---------- */
function jobEndPage(id){const j=jobData.jobs.find(x=>x.id===id);if(!j)return;jobsMode='form';
 const t=new Date(Date.now()+9*3600e3).toISOString().slice(0,10),next=d=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+1);return x.toISOString().slice(0,10)};
 const min=j.endDate&&j.endDate>=t?next(j.endDate):t,e=j.end||{};
 $('jobs').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="renderJobs()">← 공사 목록</button> '+gdBtn('jobend')+'<h2 style="margin-top:12px">'+escapeText(j.title)+'</h2><div class="muted">'+escapeText(j.storeName)+' · '+escapeText(j.startDate)+' ~ '+escapeText(j.endDate||'(종료일 미정)')+'</div>'
  +(e.state==='OVER'?'<div class="note" style="margin-top:12px">종료 예정일이 지났습니다. 공사가 계속되면 <b>연장</b>, 끝났으면 <b>공사 종료</b>를 눌러 주세요.</div>':e.state==='SOON'?'<div class="note" style="margin-top:12px">종료 예정일까지 '+(e.left?e.left+'일':'오늘')+' 남았습니다.</div>':'')+'</div>'
  +'<div class="card"><h2>공사 연장</h2><p class="desc">종료일이 바뀌면 새 종료일과 사유를 남깁니다. 연장 이력은 계속 보관됩니다.</p><div class="split">'+input('exEnd','새 종료일',min,'date')+input('exWhy','연장 사유','','text',false,'예: 자재 입고 지연')+'</div><button class="button ghost" type="button" style="width:100%" onclick="extendNow(\''+escapeText(id)+'\',\''+min+'\')">연장 저장</button></div>'
  +'<div class="card"><h2>공사 종료</h2><p class="desc">공사를 종료하면 참여 업체 <b>'+j.vendors.length+'곳</b>마다 종료 평가서가 만들어집니다. 순회점검·작업허가서·일일 인원 기록이 자동으로 반영되고, 담당자가 확인·수정한 뒤 확정합니다.</p><button class="button" type="button" style="width:100%" onclick="endJobNow(\''+escapeText(id)+'\')">공사 종료하고 평가 시작</button></div>';
 $('f_exEnd').min=min;window.scrollTo(0,0)}
async function extendNow(id,min){const ne=value('exEnd'),why=value('exWhy'),miss=[];if(!ne||ne<min)miss.push({key:'exEnd'});if(!why)miss.push({key:'exWhy'});
 if(miss.length){markMissing(miss);msg(miss[0].key==='exEnd'?'새 종료일은 '+min+' 이후로 골라 주세요':'연장 사유를 적어 주세요');return}
 if(!confirm('종료일을 '+ne+'(으)로 연장할까요?\n사유: '+why))return;
 try{jobData=await call('extendJob',id,ne,why);renderJobs();msg('공사를 '+ne+'까지 연장했습니다.');refreshBadges()}catch(e){}}
async function endJobNow(id){const j=jobData.jobs.find(x=>x.id===id);if(!confirm('"'+j.title+'" 공사를 종료할까요?\n\n· 참여 업체 '+j.vendors.length+'곳의 종료 평가가 시작됩니다.\n· 종료 후에는 연장할 수 없습니다.\n· 지금까지의 기록은 지워지지 않습니다.'))return;
 /* F1.8h 종료하면 바로 평가 화면 (메뉴는 공사 관리 그대로 · 종료 평가 메뉴 없앰) */
 const go=()=>{j.end={state:'ENDED'};j.status='ENDED';smenu='jobs';markSMenu();const dr=evData.list.filter(x=>x.status==='DRAFT');if(dr.length===1)openEval(dr[0].id);else renderEvalList();msg('공사를 종료했습니다. '+(dr.length===1?'바로 평가해 주세요.':'업체별로 평가해 주세요.'));refreshBadges()};
 try{evData=await call('endJob',id);go()}catch(e){if(/응답을 받지 못했/.test(e.message||'')){try{evData=await call('jobEvalList',id);if(evData.list.length||evData.job.endedAt){go();return}}catch(z){}}}}
/* ---------- 종료 평가 목록 (업체별) ---------- */
async function openJobEval(id){try{evData=await call('jobEvalList',id);renderEvalList()}catch(e){}}
function renderEvalList(){const d=evData;jobsMode='eval';evCur=null;
 $('jobs').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="loadJobs()">← 공사 목록</button> '+gdBtn('evallist')+'<h2 style="margin-top:12px">공사 종료 평가 · '+escapeText(d.job.title)+'</h2><div class="muted">'+escapeText(d.job.storeName)+' · '+escapeText(d.job.startDate)+' ~ '+escapeText(d.job.endedAt||'')+(d.job.extensions.length?' · 연장 '+d.job.extensions.length+'회':'')+'</div>'
  +'<p class="desc" style="margin-top:10px">업체마다 평가합니다. 수행 기록으로 자동 체크된 결과를 확인·수정하고 <b>[평가 확정]</b>을 누르면 최종입니다. 안전보건팀에는 참조 알림만 갑니다.</p></div>'
  +'<div class="card">'+(d.list.map(e=>'<button class="jobitem" type="button" onclick="openEval(\''+escapeText(e.id)+'\')"><div><b>'+escapeText(e.company)+'</b> '+(e.status==='DONE'?'<span class="pill ok">확정</span> '+e.total+'점 '+gradePill(e.grade):'<span class="pill todo">평가 전</span>')+'<div class="muted">'+(e.status==='DONE'?escapeText(e.evaluator)+' · '+escapeText(fmtTime(e.evaluatedAt)):'작업일 '+((e.auto.stats||{}).workDays||0)+'일 · 순회점검 '+((e.auto.stats||{}).inspections||0)+'회 · 지적 '+((e.auto.stats||{}).findings||0)+'건')+'</div></div><span aria-hidden="true">›</span></button>').join('')||'<p class="muted">참여 업체가 없어 평가할 대상이 없습니다.</p>')+'</div>';window.scrollTo(0,0)}
function openEval(id){const e=evData.list.find(x=>x.id===id);if(!e)return;if(e.status==='DONE'){renderEvalDone(e);return}
 const items={};evData.evalItems.forEach(([no])=>{const s=e.items[no]||{},a=(e.auto.items||{})[no]||{};items[no]={lv:s.lv||a.lv||'',memo:s.memo||''}});evCur={id,e,items,comment:e.comment||''};renderEvalForm()}
/* 점수 계산 (서버 evalScore_와 같은 규칙) */
function evScore(items){const P=evData.points;let total=0,limited=false;const sec={};
 evData.sections.forEach(([k,nos,max],i)=>{sec[k]=nos.reduce((s,n)=>{const lv=(items[String(n)]||{}).lv;return s+(lv?P[n]['GNP'.indexOf(lv)]||0:0)},0);total+=sec[k];if(i<3&&sec[k]<max/2)limited=true});
 let grade=total>=90?'S':total>=80?'A':total>=70?'B':total>=60?'C':'D';if(limited)grade='D';return {total,grade,sec,limited}}
function evSumHtml(){const s=evScore(evCur.items),left=evData.evalItems.filter(([no])=>!evCur.items[no].lv).length;
 return '<b style="font-size:18px">'+s.total+'점</b> '+gradePill(s.grade)+(left?' <span class="muted">· 미체크 '+left+'개</span>':'')
  +'<div class="muted" style="margin-top:4px">'+evData.sections.map(([k,,max])=>k+' '+s.sec[k]+'/'+max).join(' · ')+(s.limited?' · <b class="req">A·B·C 분야 중 50% 미만이 있어 D등급</b>':'')+'</div>'
  +(['C','D'].includes(s.grade)?'<div class="muted req" style="margin-top:4px">⚠ 다음 공사 배정 때 경고로 표시됩니다 (현장설명 때 개선사항 안내)</div>':'')}
function renderEvalForm(){const d=evData,c=evCur,au=c.e.auto.items||{},st=c.e.auto.stats||{};let lastSec='';
 $('jobs').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="renderEvalList()">← 업체 목록</button> '+gdBtn('evalform')+'<h2 style="margin-top:12px">종료 평가 · '+escapeText(c.e.company)+'</h2><div class="muted">'+escapeText(d.job.title)+' · 작업일 '+(st.workDays||0)+'일 · 순회점검 '+(st.inspections||0)+'회 · 지적 '+(st.findings||0)+'건(미조치 '+(st.openFindings||0)+') · 작업허가서 '+(st.permits||0)+'건 · 신규자 교육 '+(st.workers||0)+'명</div>'
  +'<p class="desc" style="margin-top:10px"><span class="pill lock">자동</span> 표시 항목은 수행 기록으로 미리 체크했습니다. 맞지 않으면 바꾸고 의견을 남겨 주세요.</p></div>'
  +'<div class="card">'+d.evalItems.map(([no,sec,name])=>{const a=au[no]||{},x=c.items[no],P=d.points[no];const h=sec!==lastSec?'<div class="stage">'+escapeText(sec)+'</div>':'';lastSec=sec;
   return h+'<div class="jitem" id="ev_'+no+'"><div class="jq"><b>'+no+'.</b> '+escapeText(name)+' <span class="muted">(우수 '+P[0]+' · 보통 '+P[1]+' · 미흡 '+P[2]+')</span></div>'
    +'<div class="muted" style="margin-top:4px">'+(a.auto?'<span class="pill lock">자동</span> ':'')+escapeText(a.why||'')+'</div>'
    +'<div class="jm" role="radiogroup" aria-label="'+no+'번 평가">'+['G','N','P'].map(k=>'<label class="jb '+EV_CLS[k]+'"><input type="radio" name="ev'+no+'" value="'+k+'" '+(x.lv===k?'checked':'')+' onchange="evMark(\''+no+'\',\''+k+'\')"><span>'+EV_LV[k]+'</span></label>').join('')+'</div>'
    +'<input class="jmemo" style="width:100%;margin-top:8px;padding:9px 11px;border:1px solid var(--line);border-radius:8px;font:inherit" id="f_evm'+no+'" value="'+escapeText(x.memo)+'" oninput="evCur.items[\''+no+'\'].memo=this.value;this.classList.remove(\'miss\',\'shake\')" aria-label="'+no+'번 의견" placeholder="'+(no==='12'?'공사 중 사고 여부 (필수) 예) 무재해':'의견 (선택)')+'"></div>'}).join('')+'</div>'
  +'<div class="card">'+text('evCmt','개선사항 (다음 계약·현장설명 때 안내)',c.comment)+'</div>'
  +'<div class="card roomfoot"><div id="evSum">'+evSumHtml()+'</div><div class="row" style="margin-top:10px"><button class="button ghost" type="button" style="flex:1" onclick="saveEval(false)">임시 저장</button><button class="button" type="button" style="flex:1" onclick="saveEval(true)">평가 확정</button></div></div>';window.scrollTo(0,0)}
function evMark(no,k){evCur.items[no].lv=k;$('ev_'+no).classList.remove('miss','shake');$('evSum').innerHTML=evSumHtml()}
async function saveEval(final){const c=evCur;c.comment=value('evCmt');
 if(final){const miss=evData.evalItems.filter(([no])=>!c.items[no].lv).map(([no])=>'ev_'+no);if(!String(c.items['12'].memo||'').trim())miss.push('f_evm12');
  if(miss.length){inspFlag(miss,miss[0]==='f_evm12'?'12번에 공사 중 사고 여부를 적어 주세요 (예: 무재해)':'체크하지 않은 항목이 있습니다');return}
  const s=evScore(c.items);if(!confirm(c.e.company+' 종료 평가를 확정할까요?\n\n'+s.total+'점 · '+s.grade+'등급\n\n확정하면 안전보건팀에 참조 알림이 갑니다.\n전체 활동내역 ZIP은 결과 화면에서 내려받습니다.'))return}
 try{evData=await call('saveJobEval',c.id,{items:c.items,comment:c.comment},final);const e=evData.list.find(x=>x.id===c.id);
  if(final){renderEvalDone(e);msg('평가를 확정했습니다.');refreshBadges()}else{c.e=e;msg('임시 저장했습니다.')}}catch(e){}}
/* ---------- 확정된 평가 보기 + 내려받기 ---------- */
function renderEvalDone(e){const d=evData,au=e.auto.items||{};jobsMode='eval';evCur=null;
 $('jobs').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="renderEvalList()">← 업체 목록</button><h2 style="margin-top:12px">종료 평가 결과 · '+escapeText(e.company)+'</h2><div class="muted">'+escapeText(d.job.title)+' · '+escapeText(e.evaluator)+' · '+escapeText(fmtTime(e.evaluatedAt))+' · 안전보건팀 사후 검토 대상</div>'
  +'<div style="margin-top:12px"><b style="font-size:22px">'+e.total+'점</b> '+gradePill(e.grade)+'</div>'
  +'<button class="button ghost" type="button" style="width:100%;margin-top:10px" onclick="openEvalResult(\'JE_'+escapeText(e.id)+'\')">📊 평가 결과 화면 (가이드 · 평가 기준)</button>'
  +'<button class="button" type="button" style="width:100%;margin-top:12px" onclick="evFile(\''+escapeText(e.id)+'\')">📦 전체 활동내역 ZIP 내려받기</button><p class="muted" style="margin-top:6px">1.계약 전 서류 · 2.계약 전 평가 · 3.수행 기록 · 4.작업 종료 폴더로 나뉜 PDF 묶음 + 원본파일 ZIP(사진·서류, 35MB씩 나눔) · 같은 파일이 Drive에도 보관</p></div>'
  +'<div class="card">'+(erCss(),'')+erTable(d.evalItems.map(([no,sec,name])=>{const x=e.items[no]||{},P=d.points[no];return {no,sec:String(sec).charAt(0),name,lv:x.lv||'',pts:x.lv?P['GNP'.indexOf(x.lv)]:0,max:P[0],why:(au[no]||{}).why||'',memo:x.memo?'의견: '+x.memo:''}}),e.total,e.grade)
  +'<div class="stage">개선사항</div><p class="desc" style="white-space:pre-line">'+escapeText(e.comment||'없음')+'</p></div>'
  +'<div class="card"><button class="button ghost" type="button" style="width:100%" onclick="reopenEval(\''+escapeText(e.id)+'\')">다시 수정</button></div>';window.scrollTo(0,0)}
/* F1.7b ZIP 바로 내려받기: [내려받기]를 누르면 드라이브 화면을 거치지 않고 다운로드 폴더로 받음 (본인 계정에만 보기 권한)
 *  안 받아지면(브라우저에 다른 구글 계정이 로그인된 경우 등) 드라이브 화면에서 ⬇ */
let evDl=null;
/** 내려받기를 누른 뒤 화면 아래에 [드라이브에서 열기] 버튼 (10초 동안) */
function evDlLink(){if(!evDl)return;let b=$('evDlBox');if(!b){b=document.createElement('div');b.id='evDlBox';b.setAttribute('role','status');b.style.cssText='position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:90;background:#26344b;color:#fff;border-radius:12px;padding:10px 14px;display:flex;gap:10px;align-items:center;box-shadow:0 6px 18px #0004;font-size:14px';document.body.appendChild(b)}
 b.innerHTML='<span>안 받아졌나요?</span>';const k=document.createElement('button');k.type='button';k.className='button ghost';k.textContent='드라이브에서 열기';k.onclick=()=>{window.open(evDl.url,'_blank');b.remove()};b.appendChild(k);clearTimeout(b._t);b._t=setTimeout(()=>b.remove(),10000)}
/** F1.7d 받을 파일이 여러 개(활동내역 ZIP + 원본파일 ZIP)일 때: 파일마다 [내려받기] 버튼
 *  (브라우저는 한 번 누를 때 다운로드 하나만 허용하므로 버튼을 하나씩 따로 둠) */
function evDlPanel(r){let b=$('evDlPanel');if(b)b.remove();b=document.createElement('div');b.id='evDlPanel';b.setAttribute('role','dialog');b.setAttribute('aria-modal','true');b.setAttribute('aria-labelledby','evDlTitle');
 b.style.cssText='position:fixed;inset:0;z-index:95;background:#0007;display:flex;align-items:center;justify-content:center;padding:16px';
 const box=document.createElement('div');box.className='card';box.style.cssText='max-width:460px;width:100%;max-height:90vh;overflow:auto;margin:0';
 box.innerHTML='<h2 id="evDlTitle" style="margin:0 0 6px">ZIP 준비 완료 · '+r.files.length+'개</h2><p class="muted" style="margin:0 0 10px">파일마다 [내려받기]를 한 번씩 눌러 주세요. 새 탭이 잠깐 열렸다 닫힐 수 있습니다.<br>안 받아지면 [드라이브에서 열기]를 눌러 주세요. ('+escapeText(r.email||'')+' 계정으로 보기 권한이 있습니다)</p>';
 r.files.forEach((f)=>{const row=document.createElement('div');row.style.cssText='border:1px solid #d8dee8;border-radius:10px;padding:10px;margin-top:8px';
  row.innerHTML='<b>'+escapeText(f.label||'')+'</b><div class="muted" style="word-break:break-all">'+escapeText(f.name||'')+(f.size?' ('+(f.size/1048576).toFixed(1)+'MB)':'')+'</div>';
  const bar=document.createElement('div');bar.style.cssText='display:flex;gap:8px;margin-top:8px';
  const d=document.createElement('button');d.type='button';d.className='button';d.style.flex='1';d.textContent='내려받기';
  d.onclick=()=>{const w=window.open(f.download,'_blank');if(!w)location.href=f.download;d.textContent='✓ 받기 시작함';msg('다운로드 폴더를 확인해 주세요.')};
  const o=document.createElement('button');o.type='button';o.className='button ghost';o.textContent='드라이브에서 열기';o.onclick=()=>window.open(f.url,'_blank');
  bar.append(d,o);row.appendChild(bar);box.appendChild(row)});
 const c=document.createElement('button');c.type='button';c.className='button ghost';c.style.cssText='width:100%;margin-top:12px';c.textContent='닫기';
 const close=()=>{b.remove();document.removeEventListener('keydown',esc)},esc=(ev)=>{if(ev.key==='Escape')close()};c.onclick=close;b.onclick=(ev)=>{if(ev.target===b)close()};document.addEventListener('keydown',esc);
 box.appendChild(c);b.appendChild(box);document.body.appendChild(b);box.querySelector('button').focus()}
/* F1.8j ZIP 바로 내려받기: 드라이브 화면을 거치지 않고 8MB씩 받아 이어 붙여 휴대폰·PC에 저장 */
const zipMem={};
async function zipGet(evId,f,btn){const k=evId+':'+f.fid;let blob=zipMem[k];
 if(!blob){const parts=[];let n=f.parts||1;try{for(let i=0;i<n;i++){if(btn)btn.textContent='받는 중 '+(n>1?(i+1)+'/'+n:'')+'…';const r=await callQuiet('jobEvalFilePart',evId,f.fid,i);n=r.parts;const s=atob(r.data),u=new Uint8Array(s.length);for(let j=0;j<s.length;j++)u[j]=s.charCodeAt(j);parts.push(u)}}
  catch(e){if(btn){btn.disabled=false;btn.textContent='다시 받기'}showErr('ZIP을 받지 못했습니다',e);return}blob=zipMem[k]=new Blob(parts,{type:'application/zip'})}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=f.name||'활동내역.zip';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),120000);
 if(btn){btn.disabled=false;btn.textContent='✓ 저장됨 · 다시 저장'}msg('다운로드(파일) 폴더를 확인해 주세요.')}
function zipPanel(evId,r){let b=$('evDlPanel');if(b)b.remove();b=document.createElement('div');b.id='evDlPanel';b.setAttribute('role','dialog');b.setAttribute('aria-modal','true');b.setAttribute('aria-labelledby','evDlTitle');
 b.style.cssText='position:fixed;inset:0;z-index:95;background:#0007;display:flex;align-items:center;justify-content:center;padding:16px';
 const box=document.createElement('div');box.className='card';box.style.cssText='max-width:460px;width:100%;max-height:90vh;overflow:auto;margin:0';
 box.innerHTML='<h2 id="evDlTitle" style="margin:0 0 6px">ZIP 준비 완료 · '+r.files.length+'개</h2><p class="muted" style="margin:0 0 10px">파일마다 [내려받기]를 눌러 주세요. 바로 휴대폰(PC)에 저장됩니다.</p>';
 r.files.forEach(f=>{const row=document.createElement('div');row.style.cssText='border:1px solid #d8dee8;border-radius:10px;padding:10px;margin-top:8px';
  row.innerHTML='<b>'+escapeText(f.label||'')+'</b><div class="muted" style="word-break:break-all">'+escapeText(f.name||'')+(f.size?' ('+(f.size/1048576).toFixed(1)+'MB)':'')+'</div>';
  const d=document.createElement('button');d.type='button';d.className='button';d.style.cssText='width:100%;margin-top:8px';d.textContent='내려받기';d.onclick=()=>{d.disabled=true;zipGet(evId,f,d)};row.appendChild(d);box.appendChild(row)});
 const c=document.createElement('button');c.type='button';c.className='button ghost';c.style.cssText='width:100%;margin-top:12px';c.textContent='닫기';
 const close=()=>{b.remove();document.removeEventListener('keydown',esc)},esc=(ev)=>{if(ev.key==='Escape')close()};c.onclick=close;b.onclick=(ev)=>{if(ev.target===b)close()};document.addEventListener('keydown',esc);
 box.appendChild(c);b.appendChild(box);document.body.appendChild(b);box.querySelector('button').focus()}
async function evFile(id){try{const r=await call('jobEvalFile',id);if(Array.isArray(r.files)&&r.files.length&&r.files[0].fid){zipPanel(id,r);return}if(Array.isArray(r.files)&&r.files.length>1){evDlPanel(r);return}if(!r.download){openFile(r);return}evDl=r;
  const mb=r.size?' ('+(r.size/1048576).toFixed(1)+'MB)':'';
  popup('ZIP 준비 완료',(r.name||'전체활동내역.zip')+mb+'\n\n[내려받기]를 누르면 다운로드 폴더로 받습니다.\n새 탭이 잠깐 열렸다 닫힐 수 있습니다.\n\n안 받아지면 이 화면의 [드라이브에서 열기]를 눌러 주세요.\n('+(r.email||'')+' 계정으로 보기 권한이 있습니다)','내려받기',()=>{const w=window.open(r.download,'_blank');if(!w)location.href=r.download;msg('다운로드 폴더를 확인해 주세요.');evDlLink()})}
 catch(e){/* v5.19 응답이 사라져도 서버는 계속 만들고 있을 수 있음 → 다시 누르라고 안내 (두 번 만들지 않음) */if(/응답을 받지 못했|만드는 중/.test(e&&e.message||''))alert('ZIP을 만드는 중입니다.\n처음 한 번은 1~2분 걸립니다. 잠시 뒤 [전체 활동내역 ZIP 내려받기]를 다시 눌러 주세요.\n(다 만들어진 뒤에는 바로 내려받아집니다)')}}
async function reopenEval(id){if(!confirm('확정을 풀고 다시 수정할까요?\n수정 후 다시 [평가 확정]을 눌러야 합니다.'))return;try{evData=await call('reopenJobEval',id);openEval(id);refreshBadges()}catch(e){}}
/* ---------- 업체 화면: 종료된 공사 ---------- */
function vEndHtml(v){if(v.jobStatus!=='ENDED')return '';const r=v.evalResult;
 return '<div class="card alertcard"><h2>공사가 종료되었습니다</h2><p class="muted">지난 기록 보기 전용입니다. 작업자 등록·인원 체크·허가서 발행·순회점검 제출은 할 수 없습니다.</p>'+(r?'<p class="desc">도급인 종료 평가 ('+escapeText(r.date)+'): <b>'+r.total+'점</b> '+gradePill(r.grade)+'</p>'+(r.comment?'<div class="stage">개선사항</div><p class="desc" style="white-space:pre-line">'+escapeText(r.comment)+'</p>':''):'<p class="desc">도급인 담당자가 종료 평가를 진행하고 있습니다.</p>')+'</div>'}
/* ---------- 안전보건팀: 참조 알림 ---------- */
let noticeData=null;
async function loadNotices(){if(!noticeData)noticeData=cacheGet('noticeList',[]);if(noticeData){seenTab.notice=1;renderNotices()}try{noticeData=await fetcher('notice')('noticeList');if(tab==='notice')renderNotices()}catch(e){}}
function renderNotices(){const d=noticeData,un=d.list.filter(n=>!n.read).length;
 $('notice').innerHTML='<div class="card"><div class="vh-top"><h2 style="margin:0">참조 알림 '+(un?'<span class="cnt">'+un+'</span>':'')+'</h2>'+(un?'<button class="button ghost" type="button" onclick="readAllNotices()">모두 읽음</button>':'')+'</div><p class="desc">승인할 일은 없습니다. 업체 평가 확정·공사 연장·공사 종료처럼 "이런 일이 있었다"는 기록입니다. 필요하면 공사·현장미팅에서 내용을 확인해 주세요.</p></div>'
  +'<div class="card">'+(d.list.map(n=>'<div class="item"><div>'+(n.read?'':'<span class="pill bad">새 알림</span> ')+'<span class="pill lock">'+escapeText(d.labels[n.type]||n.type)+'</span> <span class="muted">'+escapeText(fmtTime(n.time))+'</span></div><div class="desc" style="margin-top:4px;'+(n.read?'':'font-weight:600;color:var(--text)')+'">'+escapeText(n.text)+'</div></div>').join('')||'<p class="muted">아직 알림이 없습니다.</p>')+'</div>'}
async function readAllNotices(){try{noticeData=await call('readNotices');renderNotices();refreshBadges()}catch(e){}}
/* F1.9b 공사 만들기: 계약 전 평가 점수 · 70점 미만이면 고를 때 경고 창 (배정은 막지 않음) */
const PRE_LOW=70;
function preEvalHtml(v){const p=v.preEval;if(!p)return '';
 return p.total<PRE_LOW?' <span class="pill bad">⚠ 계약 전 평가 '+p.total+'점 · 70점 미만</span>':' <span class="muted">· 계약 전 평가 '+p.total+'점 '+escapeText(p.grade)+'</span>'}
function jvWarn(cb){if(!cb.checked)return;const v=((jobData&&jobData.vendors)||[]).find(x=>x.id===cb.value),p=v&&v.preEval;if(!p||p.total>=PRE_LOW)return;
 popup('⚠ 70점 미만 협력업체입니다',v.company+' · 계약 전 평가 '+p.total+'점 ('+p.grade+'등급)\n배정은 할 수 있습니다. 다만 아래 항목은 업체에 보완을 지시해 주세요.\n\n'
  +(p.low.map(([n,name,l])=>'· '+n+'. '+name+' — '+l).join('\n')||'· (항목 기록 없음)')+'\n\n보완 지시: 착수 미팅(협의체) 때 위 항목을 안내하고, 공사 중 순회점검으로 이행을 확인해 주세요.','확인')}
/* ---------- 공사 만들기: 업체 고를 때 지난 종료 평가 (C·D등급은 경고) ---------- */
function lastEvalHtml(v){const l=v.lastEval;if(!l)return '';
 if(!['C','D'].includes(l.grade))return ' <span class="muted">· 지난 평가 '+escapeText(l.grade)+'등급</span>';
 return '<span class="note" style="display:block;margin:6px 0 0 24px;font-size:13px"><b class="req">⚠ 지난 공사 종료 평가 '+l.total+'점 '+escapeText(l.grade)+'등급</b> <span class="muted">('+escapeText(l.job)+' · '+escapeText(l.date)+')</span>'+(l.comment?'<br>개선사항: '+escapeText(l.comment):'')+'<br><span class="muted">배정은 할 수 있습니다. 현장설명 때 개선사항을 안내해 주세요.</span></span>'}
/* =====================================================================
 * F1.9e 평가 결과 화면 (메일 버튼 · 종료 평가 · 업체 현황 · 업체 첫 화면에서 열림)
 *  총점 · 분야별 점수 · 12항목(점수·근거·의견) · 개선사항
 *  [❔ 사용 가이드] = 왜 이 점수인지 따라가기 (깎인 점수가 큰 항목부터) · [📋 평가 기준] = 같이 정한 기준
 * ===================================================================== */
let evRes=null;
const ER_PILL={G:'ok',N:'erN',P:'bad'},ER_SEC={A:['A','안전보건관리체제',20],B:['B','실행수준',40],C:['C','운영관리',20],D:['D','재해발생 수준',20]};
/** F1.9f 평가 항목표 (시안 2: No · 평가항목·근거 · 결과 · 점수 · 분야는 회색 줄 · 합계는 검정 줄)
 *  items = [{no, sec(A~D), name, lv, pts, max, why, memo}] */
function erTable(items,total,grade){let h='<table class="ertb"><thead><tr><th style="width:26px">No</th><th>평가항목 · 근거</th><th style="width:44px">결과</th><th style="width:52px;text-align:right">점수</th></tr></thead><tbody>';
 ['A','B','C','D'].forEach(k=>{const L=items.filter(x=>x.sec===k);if(!L.length)return;const sum=L.reduce((s,x)=>s+(x.pts||0),0),S=ER_SEC[k],lo=k!=='D'&&sum<S[2]/2;
  h+='<tr class="g" id="er_sg'+k+'"><td colspan="3">'+S[0]+'. '+escapeText(S[1])+(lo?' <span class="req">· 절반 미만 → D등급</span>':'')+'</td><td class="r">'+sum+'/'+S[2]+'</td></tr>';
  L.forEach(x=>{h+='<tr id="er_it'+escapeText(x.no)+'"><td class="muted">'+escapeText(x.no)+'</td><td>'+escapeText(x.name)+((x.why||x.memo)?'<div class="muted">'+escapeText(x.why||'')+(x.why&&x.memo?' · ':'')+escapeText(x.memo||'')+'</div>':'')+'</td><td class="lv '+escapeText(x.lv||'')+'">'+(EV_LV[x.lv]||'-')+'</td><td class="r">'+(x.pts||0)+'<span class="muted" style="font-weight:400">/'+x.max+'</span></td></tr>'})});
 return h+'<tr class="tot" id="er_sum"><td colspan="3">합계 · 등급</td><td class="r">'+total+' · '+escapeText(grade)+'</td></tr></tbody></table>'}
/** 메일 버튼(?evres=…&go=gd|crit)으로 들어오면 로그인 뒤 한 번 열기 */
function evresPending(){let p=null;try{p=JSON.parse(localStorage.getItem('evresGo')||'null')}catch(e){}if(!p||!p.r)return;try{localStorage.removeItem('evresGo')}catch(e){}if(Date.now()-Number(p.t||0)>7200000)return;openEvalResult(p.r,p.g)}
async function openEvalResult(ref,go,jobId){let r;try{r=await call('evalResult',ref,jobId||'')}catch(e){return}evRes=r;renderEvalResult();if(go==='gd')setTimeout(()=>startTour('evres'),500);else if(go==='crit')setTimeout(evCritOpen,300)}
function erCss(){if($('erCss'))return;const s=document.createElement('style');s.id='erCss';s.textContent=
 '#evres{position:fixed;inset:0;z-index:80;background:var(--bg);overflow:auto;-webkit-overflow-scrolling:touch}.pill.erN{background:#fff7ed;color:#b45309}'
 +'.erbig{font-size:36px;font-weight:800;line-height:1.1;color:var(--main)}.erbar{height:8px;background:#e5e7eb;border-radius:8px;overflow:hidden;margin:3px 0 10px}.erbar span{display:block;height:100%;background:var(--main)}.erbar span.low{background:var(--accent)}'
 +'.erit{display:flex;gap:8px;align-items:center;padding:10px 0;border:0;border-top:1px solid var(--line);width:100%;background:none;text-align:left;font:inherit;color:inherit;cursor:pointer}.erit .no{width:22px;color:#9ca3af;font-weight:700;flex:none}.erit .pt{margin-left:auto;font-weight:700;white-space:nowrap}'
 +'.erwhy{display:none;font-size:13px;background:var(--bg);border-radius:8px;padding:8px 10px;margin:0 0 8px;line-height:1.6}.eritw.open .erwhy{display:block}'
 +'.ertb{width:100%;border-collapse:collapse;font-size:13px}.ertb th{font-size:12px;color:var(--sub);font-weight:600;text-align:left;padding:6px 4px;border-bottom:2px solid var(--main)}.ertb td{padding:8px 4px;border-bottom:1px solid var(--line);vertical-align:top}.ertb td.r{text-align:right;white-space:nowrap;font-weight:700}.ertb tr.g td{background:var(--bg);font-weight:700;font-size:12px;padding:5px 4px}.ertb .lv{font-weight:700;white-space:nowrap}.ertb .lv.P{color:var(--accent)}.ertb .lv.N{color:#b45309}.ertb .lv.G{color:var(--ok)}.ertb tr.tot td{background:var(--main);color:#fff;font-weight:700;font-size:14px;border:0;padding:10px 8px}.ertb tr.tot td:first-child{text-align:right;border-radius:0 0 0 8px}.ertb tr.tot td.r{border-radius:0 0 8px 0}'
 +'#evcrit{position:fixed;inset:0;z-index:82;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center}#evcrit .sheet{background:#fff;width:100%;max-width:560px;max-height:88vh;overflow:auto;border-radius:18px 18px 0 0;padding:18px 16px 24px}'
 +'#evcrit table{width:100%;border-collapse:collapse}#evcrit td{font-size:13px;padding:7px 4px;border-top:1px solid var(--line);vertical-align:top}#evcrit .hd td{background:var(--bg);font-weight:700}#evcrit h3{font-size:15px;margin:16px 0 6px}'
 +'.ertabs{display:flex;gap:6px;margin:10px 0}.ertabs button{flex:1;border:1px solid var(--line);background:#fff;border-radius:9px;padding:8px 4px;font:inherit;font-size:13px;cursor:pointer}.ertabs button[aria-selected=true]{background:var(--main);color:#fff;border-color:var(--main)}';document.head.appendChild(s)}
function renderEvalResult(){const r=evRes;if(!r)return;erCss();let el=$('evres');if(!el){el=document.createElement('div');el.id='evres';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.addEventListener('keydown',e=>{if(e.key==='Escape'&&!(typeof tour!=='undefined'&&tour)&&!$('evcrit'))closeEvalResult()});document.body.appendChild(el)}
 el.setAttribute('aria-label',r.title);document.body.style.overflow='hidden';
 const gl=['S','A'].includes(r.grade)?'G':r.grade==='B'?'N':'P',low=r.items.filter(x=>x.lv&&x.lv!=='G').sort((p,q)=>(q.max-q.pts)-(p.max-p.pts)),good=r.items.filter(x=>x.lv==='G');
 el.innerHTML='<div class="pbar"><button class="button ghost" type="button" onclick="closeEvalResult()">‹ 이전으로</button><b class="pbt">'+escapeText(r.title)+'</b><span style="width:64px"></span></div><div class="cwrap" style="max-width:640px;margin:0 auto">'
  +'<div class="card" id="er_tot"><div class="row" style="justify-content:space-between;gap:6px"><b>'+escapeText(r.title)+'</b><span class="row" style="gap:6px">'+gdBtn('evres')+'<button type="button" class="button ghost" style="padding:4px 8px;font-size:12px" id="erCrit" onclick="evCritOpen()">📋 평가 기준</button></span></div>'
  +'<div class="muted" style="margin-top:4px">'+escapeText(r.sub)+(r.evaluator?' · 평가 '+escapeText(r.evaluator):'')+'</div>'
  +'<div class="row" style="align-items:flex-end;gap:8px;margin-top:10px"><span class="erbig">'+r.total+'</span><span class="muted" style="font-size:14px">/ 100점</span><span class="pill '+ER_PILL[gl]+'" style="margin-left:auto">'+escapeText(r.grade)+'등급</span></div></div>'
  +'<div class="card" id="er_items" style="padding:12px"><b>평가 항목표</b><div style="margin-top:8px;overflow-x:auto">'+erTable(r.items,r.total,r.grade)+'</div></div>'
  +'<div class="card" id="er_cmt"><b>'+(r.kind==='JE'?'개선사항 (다음 계약 때 안내)':'검토 의견')+'</b><p style="margin:6px 0 0;white-space:pre-line">'+escapeText(r.comment||'없음')+'</p></div></div>';
 el.scrollTop=0;
 /* 가이드: 총점 → 가장 많이 깎인 분야 → 깎인 항목(큰 순) → 우수 항목 → 의견 → 기준 버튼 */
 const sl=r.sec.slice().sort((a,b)=>(b[3]-b[2])/b[3]-(a[3]-a[2])/a[3])[0],T=t=>String(t||'').replace(/\s*\n\s*/g,' · ');
 TOUR_STEPS.evres=[{sel:'#gd_evres',text:'평가 결과 가이드입니다. 왜 이 점수가 나왔는지 하나씩 따라가 봅니다.'},
  {sel:'#er_tot',text:'총점 '+r.total+'점이라 '+r.grade+'등급입니다. (S 90 · A 80 · B 70 · C 60점 이상 · D 60점 미만)'+(r.limited?' 한 분야가 배점의 절반이 안 돼서 총점과 상관없이 D등급입니다.':'')},
  {sel:'#er_sg'+sl[0],text:sl[2]>=sl[3]?'모든 분야가 만점입니다.':sl[1]+' 분야가 '+sl[2]+'/'+sl[3]+'점으로 가장 많이 깎였습니다.'+(sl[0]!=='D'&&sl[2]<sl[3]/2?' 절반이 안 돼서 D등급이 됩니다.':'')}]
  .concat(low.map(x=>({sel:'#er_it'+x.no,text:T(x.no+'번 '+x.name+' '+EV_LV[x.lv]+' ('+x.pts+'/'+x.max+'점 · -'+(x.max-x.pts)+'점) — '+(x.why||'')+(x.memo?' · '+x.memo:''))})))
  .concat([{sel:'#er_it'+((good[0]||r.items[0]).no),text:low.length?'우수 항목('+good.map(x=>x.no).join('·')+'번)은 기준을 다 채운 것입니다. 항목 이름 아래 작은 글씨가 근거입니다.':'12개 항목 모두 우수입니다.'},
   {sel:'#er_sum',text:'맨 아래 검정 줄이 합계와 등급입니다. 분야별 소계(회색 줄)를 더한 점수입니다.'},
   {sel:'#er_cmt',text:r.kind==='JE'?'평가자가 남긴 개선사항입니다. 다음 계약 때 이 부분을 보완하면 점수가 올라갑니다.':'검토자 의견입니다. 보완 요청이면 이 내용대로 고쳐서 다시 제출합니다.'},
   {sel:'#erCrit',tap:1,text:'기준이 궁금하면 [📋 평가 기준]을 누르세요. 배점·등급·자동 체크 규칙이 모두 나옵니다.'}]);
 setTimeout(()=>$('gd_evres')?.focus({preventScroll:true}),50)}
function erToggle(b){const w=b.parentNode;w.classList.toggle('open');b.setAttribute('aria-expanded',w.classList.contains('open'))}
function closeEvalResult(){if(typeof tour!=='undefined'&&tour)endTour(true);$('evcrit')?.remove();$('evres')?.remove();document.body.style.overflow='';evRes=null}
/** 📋 평가 기준 (그동안 정한 기준 · 탭 3개) */
const ER_CRIT=[['점수·등급','<h3>배점 (100점) · 우수 / 보통 / 미흡</h3><table><tr class="hd"><td>분야</td><td>항목 (우수/보통/미흡 점수)</td><td>합계</td></tr>'
 +'<tr><td>A 관리체제</td><td>1 방침 5/3/1 · 2 목표·지표 10/5/1 · 3 조직 5/3/1</td><td>20</td></tr><tr><td>B 실행수준</td><td>4 위험성평가 5/3/1 · 5 점검 10/5/1 · 6 이행확인 10/5/1 · 7 교육 5/3/1 · 8 작업허가 10/5/1</td><td>40</td></tr>'
 +'<tr><td>C 운영관리</td><td>9 신호·연락 5/3/1 · 10 설비 10/5/1 · 11 비상대책 5/3/1</td><td>20</td></tr><tr><td>D 재해</td><td>12 산재 20/10/1</td><td>20</td></tr></table>'
 +'<h3>등급</h3><table><tr><td>S 90점 이상 · A 80 · B 70 · C 60 · D 60점 미만</td></tr><tr><td>A·B·C 분야 중 하나라도 배점의 <b>절반 미만</b>이면 총점과 상관없이 <b>D</b></td></tr><tr><td>미흡은 0점이 아니라 <b>1점</b></td></tr></table>'
 +'<h3>등급에 따라</h3><table><tr><td><b>70점 미만</b> → 도급인에게 경고 (서류 검토 화면 · 공사 배정 때) · 막지는 않음</td></tr><tr><td><b>D등급</b> → 업체가 계약 전 서류를 제출할 수 없음 · 부족한 항목 안내 + [바로 고치기]</td></tr><tr><td>종료 평가 C·D등급 → 다음 공사 배정 때 경고</td></tr></table>'],
 ['계약 전 평가','<h3>업체가 쓴 계획서로 자동 체크 → 검토자가 확인·수정</h3><table><tr class="hd"><td>항목</td><td>우수 조건</td></tr>'
 +'<tr><td>1 방침</td><td>규정 서명 + 방침 3줄 이상</td></tr><tr><td>2 목표</td><td>목표 + 성과지표 3개 이상</td></tr><tr><td>3 조직</td><td>현장대리인 이름·연락처 (이름만 = 보통)</td></tr>'
 +'<tr><td>4 위험성평가</td><td>해당 위험요인 3개 이상 체크</td></tr><tr><td>5 · 7 · 10</td><td>법정 기본값을 앱이 미리 채움 → 우수 (영세업체 배려 · 꼭 해야 하는 법적 사항)</td></tr>'
 +'<tr><td>6 이행확인</td><td>이행 사례 20자 이상 + 증빙 사진 = 우수 · 글만 = 보통 · 비우면 미흡</td></tr><tr><td>8 작업허가</td><td>작업허가 대상 공종이 있음</td></tr><tr><td>9 신호·연락</td><td>현장대리인 연락처</td></tr>'
 +'<tr><td>11 비상대책</td><td>시나리오 2개 이상 + 비상대피훈련 계획</td></tr><tr><td>12 산재</td><td>건수 기준 · 증빙 있음 + 0건 = 우수 · 2건 이하 = 보통 · <b>증빙 없으면 미제출 → 미흡</b></td></tr></table><p class="muted">평가 유효기간: 승인일부터 1년</p>'],
 ['종료 평가','<h3>종료 평가 = 계약 전 계획을 공사 중에 지켰는가 (실행률)</h3><table><tr class="hd"><td>항목</td><td>보는 것</td></tr>'
 +'<tr><td>1 · 2 · 3 · 10</td><td>계약 전 평가 결과 그대로</td></tr><tr><td>4 위험성평가</td><td>계획서 위험요인이 순회점검에서 \'양호\'였던 비율</td></tr><tr><td>5 점검</td><td>순회점검 횟수 ÷ (작업일 ÷ 2)</td></tr>'
 +'<tr><td>6 이행확인</td><td>미조치가 있으면 미흡 · 평균 3일 안에 조치 = 우수</td></tr><tr><td>7 교육</td><td>작업자 기초안전보건교육 이수증 제출 비율</td></tr><tr><td>8 작업허가</td><td>허가서를 쓴 날 ÷ 작업일</td></tr>'
 +'<tr><td>9 신호·연락</td><td>협의체·합동점검 참석률</td></tr><tr><td>11 비상대책</td><td>비상대피·CPR·소화기 훈련 사진 1회 이상 = 우수 · 기타 교육만 = 보통</td></tr><tr><td>12 재해</td><td>공사 중 사고 여부 (담당자 입력 · 무재해 = 우수)</td></tr></table>'
 +'<p class="muted">비율: 90% 이상 우수 · 60% 이상 보통 · 그 아래 미흡 · 공사가 끝날 때 하는 평가 = 반기 평가</p>']];
function evCritOpen(i){erCss();$('evcrit')?.remove();i=i==null?(evRes&&evRes.kind==='CE'?1:evRes&&evRes.kind==='JE'?2:0):i;const w=document.createElement('div');w.id='evcrit';w.setAttribute('role','dialog');w.setAttribute('aria-modal','true');w.setAttribute('aria-label','평가 기준');
 w.innerHTML='<div class="sheet"><div class="row" style="justify-content:space-between"><b style="font-size:17px">📋 평가 기준</b><button class="button ghost" type="button" id="evcritX" style="padding:6px 10px">✕ 닫기</button></div>'
  +'<div class="ertabs" role="tablist">'+ER_CRIT.map((c,k)=>'<button type="button" role="tab" aria-selected="'+(k===i)+'" onclick="evCritOpen('+k+')">'+escapeText(c[0])+'</button>').join('')+'</div>'+ER_CRIT[i][1]+'</div>';
 document.body.appendChild(w);const close=()=>w.remove();$('evcritX').onclick=close;w.addEventListener('click',e=>{if(e.target===w)close()});w.addEventListener('keydown',e=>{if(e.key==='Escape')close()});setTimeout(()=>w.querySelector('[aria-selected=true]')?.focus(),30)}
