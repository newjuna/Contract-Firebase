/* 순회점검일지 (v5.0) — 2일 1회
 *  업체: [오늘 할 일] ④ → TBM 사진 + 11개 항목(전부 양호로 시작) → 불량은 사진·지적 내용 → [제출]
 *  지적사항: 조치될 때까지 업체·도급인 양쪽에 '미조치'로 남음 → [조치 등록] (조치 내용·조치일·조치 후 사진)
 *  도급인: 공사 카드 [순회점검 보기] → [전체 확인] · 일지 보기
 *  일지 칸은 사실대로: 점검 실시 = 업체 작성자 / 도급인 확인 = 확인한 직원
 *  서버: Code.gs (submitInspection · resolveFinding · inspList · checkInspections · uploadInspPhoto · getInspPhoto) */
const INSP_MARK={OK:'양호',BAD:'불량',NA:'해당없음'};
const inspPhoto={};          // 문서ID → data URL (한 번 받은 사진은 다시 받지 않음)
let ins=null;                // 작성 중인 점검 {items,notes,tbm}
let inspJob=null,inspFind=null;
/* ---------- 업체: [오늘 할 일] ④ 카드 ---------- */
function inspCardHtml(v){const I=v.insp||{open:[],recent:[]};
 /* F1.8b 설명 문구 없이 버튼만 · 오늘 점검했으면 어둡게 + '오늘 완료' (미조치 지적사항은 눌러서 열고 조치 등록) */
 return '<div class="card" id="inspCard" style="position:relative">'+(I.todayDone&&v.jobStatus!=='ENDED'?doneMask('순회점검'):'')+'<div class="vh-top"><h2 style="margin:0;font-size:16px">③ 순회점검</h2><button class="button ghost" type="button" id="gdInsp" style="padding:4px 8px;font-size:12px" onclick="startTour(\'insp\')">❔ 사용 가이드</button></div>'
  /* F1.8c 오늘 낸 점검 잘못 냈으면 제출 취소 → 다시 작성 (도급인 확인 전) */
  +(I.todayDone&&v.jobStatus!=='ENDED'&&I.recent[0]&&I.recent[0].date===v.today&&!I.recent[0].checkedAt?'<div class="row" style="justify-content:space-between;margin-top:8px"><span class="muted">오늘 점검 제출함</span><button class="button ghost" type="button" id="btnInspCancel" style="padding:4px 8px;font-size:12px" onclick="cancelInspToday()">제출 취소</button></div>':'')
  +(I.todayDone?'':'<button class="button" type="button" id="btnInsp" style="width:100%;padding:10px;margin-top:8px" onclick="openInspForm()">오늘 순회점검 작성</button>')
  +(I.open.length?'<div class="stage">미조치 지적사항 <span class="cnt">'+I.open.length+'</span></div>'+I.open.map(f=>findRow(f,'vendor')).join(''):'')
  +(I.recent.length?'<details class="hist" style="margin-top:12px"><summary>순회점검일지 '+I.recent.length+'건</summary>'+I.recent.map(x=>'<div class="item"><div class="row" style="justify-content:space-between"><span>'+escapeText(x.date)+(x.bad?' · <b class="req">지적 '+x.bad+'</b>':' · 이상 없음')+(x.drill?' · '+escapeText(x.drill.label):'')+' '+(x.checkedAt?'<span class="pill ok">도급인 확인</span>':'<span class="pill todo">확인 대기</span>')+'</span><button class="button ghost" type="button" onclick="openInspSheet(\''+escapeText(x.id)+'\',\'vendor\')">일지 보기</button></div></div>').join('')+'</details>':'')+'</div>'}
function findRow(f,who){return '<div class="item"><div class="row" style="justify-content:space-between"><div><b>'+f.no+'. '+escapeText(f.item)+'</b>'+(who==='staff'?' <span class="muted">'+escapeText(f.company)+'</span>':'')+'<div class="muted">지적 '+escapeText(f.foundDate)+' · '+escapeText(f.memo)+'</div></div><button class="button" type="button" onclick="openResolve(\''+escapeText(f.id)+'\',\''+who+'\')">조치 등록</button></div></div>'}
/* ---------- 업체: 점검 작성 ---------- */
function openInspForm(){const items={};vjob.insp.items.forEach((_,i)=>items[i+1]='OK');ins={items,notes:{},tbm:[],drill:{type:'',photos:[]},name:vjob.siteManager||''};renderInspForm()}
/* ---------- F1.8b 교육·비상대응훈련 사진 (TBM 다음 · 한 날만) ---------- */
const DRILL_TYPES=[['EVAC','🚨 비상대피 훈련'],['CPR','❤️ 심폐소생술(CPR)'],['FIRE','🧯 소화기 사용 훈련'],['EDU','📘 기타 안전교육']];
function drillCardHtml(){const d=ins.drill||(ins.drill={type:'',photos:[]});
 return '<div class="card" id="drillCard"><h2>② 교육 · 비상대응훈련 사진 <span class="muted" style="font-size:13px;font-weight:400">(한 날만)</span></h2><p class="desc">오늘 비상대피·CPR·소화기 훈련이나 안전교육을 했으면 종류를 고르고 사진을 올리세요. <b>안 했으면 그냥 넘어가면 됩니다.</b></p>'
  +'<div id="drTypes" style="display:flex;flex-wrap:wrap;gap:8px">'+DRILL_TYPES.map(([k,l])=>'<button type="button" class="button'+(d.type===k?'':' ghost')+'" aria-pressed="'+(d.type===k)+'" onclick="inspDrillType(\''+k+'\')">'+(d.type===k?'✔ ':'')+escapeText(l)+'</button>').join('')+'</div>'
  +'<div class="row" id="drList" style="margin-top:10px">'+drListHtml()+'</div></div>'}
function drListHtml(){return thumbs(ins.drill.photos,'dropDrill')+'<label class="button ghost" for="drFile">📷 훈련·교육 사진</label><input class="hidefile" type="file" id="drFile" accept="image/*" capture="environment" onchange="addDrill()" aria-label="교육·훈련 사진 선택">'}
function inspDrillType(k){ins.name=value('inName')||ins.name;ins.drill.type=ins.drill.type===k?'':k;const c=$('drillCard');if(c){c.outerHTML=drillCardHtml();$('drillCard')?.classList.remove('miss','shake')}}
async function addDrill(){const ids=await upInsp('drFile',null,5-ins.drill.photos.length);if(!ids.length)return;ins.drill.photos=ins.drill.photos.concat(ids).slice(0,5);$('drList').innerHTML=drListHtml();$('drillCard').classList.remove('miss','shake')}
function dropDrill(id){ins.drill.photos=ins.drill.photos.filter(x=>x!==id);$('drList').innerHTML=drListHtml()}
const drillLabel=t=>((DRILL_TYPES.find(x=>x[0]===t)||[])[1]||'').replace(/^\S+ /,'');
function thumbs(ids,del){return ids.map(id=>'<span class="thumb"><img data-doc="'+escapeText(id)+'" alt="사진" '+(inspPhoto[id]?'src="'+inspPhoto[id]+'"':'')+' onclick="viewInspPhoto(\''+escapeText(id)+'\')">'+(del?'<button type="button" class="tx" aria-label="사진 빼기" onclick="'+del+'(\''+escapeText(id)+'\')">✕</button>':'')+'</span>').join('')}
function renderInspForm(){const v=vjob,I=v.insp;clearInterval(wkTimer);
 const bad=Object.values(ins.items).filter(x=>x==='BAD').length;
 $('execArea').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="renderVJob()">← 오늘 할 일</button><h2 style="margin-top:12px">순회점검 작성 · '+escapeText(v.today)+'</h2><div class="muted">'+escapeText(v.job.storeName)+' · '+escapeText(v.company.company)+'</div></div>'
  +'<div class="card" id="tbmCard"><h2>① TBM 실시 사진 <span class="req">*</span></h2><p class="desc">작업 전 TBM(안전 미팅) 사진을 1장 이상 올려 주세요.</p><div class="row" id="tbmList">'+thumbs(ins.tbm,'dropTbm')+'<label class="button ghost" for="tbmFile">📷 사진 넣기</label><input class="hidefile" type="file" id="tbmFile" accept="image/*" capture="environment" onchange="addTbm()" aria-label="TBM 사진 선택"></div></div>'
  /* F1.8a TBM 사진을 올려야 점검표가 열림 · 점검표 = 공통 항목 + 계획서 위험성평가에서 고른 위험작업 */
  +(!ins.tbm.length?'<div class="card"><h2>② 점검 항목</h2><div class="note">위에서 TBM 사진을 올리면 점검표가 열립니다.</div></div>'
  :drillCardHtml()+'<div class="card" id="inItems"><h2>③ 점검 항목</h2><p class="desc">공통 항목과 <b>안전보건관리계획서 위험성평가</b>에서 고른 작업에 맞춘 점검표입니다. 전 항목이 <b>양호</b>로 미리 체크되어 있으니, 지적사항만 <b>불량</b>(또는 해당없음)으로 바꾸고 사진과 지적 내용을 남겨 주세요. <span id="inSum">'+(bad?'· 불량 <b class="req">'+bad+'</b>건':'')+'</span></p>'
  +I.items.map((t,i)=>{const n=i+1,x=ins.items[n];return '<div class="jitem'+(x==='BAD'?' bad':'')+'" id="ii_'+n+'"><div class="jq"><b>'+n+'.</b> '+escapeText(t)+'</div><div class="jm" role="radiogroup" aria-label="'+n+'번 결과">'+Object.entries(INSP_MARK).map(([k,l])=>'<label class="jb '+k.toLowerCase()+'"><input type="radio" name="in'+n+'" value="'+k+'" '+(x===k?'checked':'')+' onchange="inspMark('+n+',\''+k+'\')"><span>'+l+'</span></label>').join('')+'</div><div id="ibx_'+n+'">'+(x==='BAD'?inspBadBox(n):'')+'</div></div>'}).join('')+'</div>'
  +'<div class="card"><div class="field" style="margin-top:0"><label for="f_inName">점검자 (작성자) <span class="req">*</span></label><input id="f_inName" value="'+escapeText(ins.name)+'" placeholder="예: 김소장"></div><p class="muted">일지에는 "점검 실시: '+escapeText(v.company.company)+' · 작성자"로 남고, 도급인 담당자가 확인하면 "도급인 확인"이 추가됩니다.</p></div>'
  +'<div class="card roomfoot"><button class="button" type="button" id="inSubmit" style="width:100%" onclick="submitInspNow()">순회점검 제출</button></div>');window.scrollTo(0,0)}
function inspBadBox(n){const nt=ins.notes[n]||(ins.notes[n]={memo:'',photos:[]});return '<div class="jbad"><label for="f_im'+n+'">지적 내용 <span class="req">*</span></label><input id="f_im'+n+'" class="jmemo" value="'+escapeText(nt.memo)+'" oninput="ins.notes['+n+'].memo=this.value" placeholder="예) 통로에 자재 적치 → 즉시 정리"><div class="row" style="margin-top:8px">'+thumbs(nt.photos,'')+'<label class="button ghost" for="if_'+n+'">📷 사진 넣기</label><input class="hidefile" type="file" id="if_'+n+'" accept="image/*" capture="environment" onchange="addInspBad('+n+')" aria-label="'+n+'번 불량 사진 선택"></div></div>'}
function inspMark(n,k){ins.items[n]=k;const el=$('ii_'+n);el.classList.toggle('bad',k==='BAD');el.classList.remove('miss','shake');$('ibx_'+n).innerHTML=k==='BAD'?inspBadBox(n):'';if(k==='BAD')setTimeout(()=>$('f_im'+n)?.focus(),50);
 const bad=Object.values(ins.items).filter(x=>x==='BAD').length;$('inSum').innerHTML=bad?'· 불량 <b class="req">'+bad+'</b>건':''}
/* F1.6b 고른 사진 여러 장 (칸마다 최대 5장) → F1.8p 임시 ID 목록 (실제 올리기는 제출 때) */
async function upInsp(inputId,staffCompany,room){const inp=$(inputId),fl=[...((inp&&inp.files)||[])].slice(0,Math.max(0,room??5));if(inp)inp.value='';if(!fl.length){if(inp&&room===0)msg('사진은 칸마다 5장까지입니다.');return []}
 /* F1.8p 여기서는 올리지 않음 (미리보기만) → [제출] 때 pendUpload로 한꺼번에 */
 const jobId=staffCompany?inspJob.job.id:vjob.job.id;
 return fl.map(f0=>{const id=pendAdd(f0,async f=>{const x=await readFile(f,PHOTO_SITE);return staffCompany?api('uploadInspPhotoStaff',[jobId,staffCompany,x]):api('uploadInspPhoto',[jobId,x])});if(PEND[id].url)inspPhoto[id]=PEND[id].url;return id})}
async function addTbm(){const ids=await upInsp('tbmFile',null,5-ins.tbm.length);if(!ids.length)return;ins.name=value('inName')||ins.name;const first=!ins.tbm.length;ins.tbm=ins.tbm.concat(ids).slice(0,5);
 /* F1.8a 첫 TBM 사진이 올라가면 점검표를 펼침 */if(first){const y=window.scrollY;renderInspForm();window.scrollTo(0,y);setTimeout(()=>$('inItems')?.scrollIntoView({behavior:'smooth',block:'start'}),80);return}
 $('tbmList').innerHTML=thumbs(ins.tbm,'dropTbm')+'<label class="button ghost" for="tbmFile">📷 사진 넣기</label><input class="hidefile" type="file" id="tbmFile" accept="image/*" capture="environment" onchange="addTbm()" aria-label="TBM 사진 선택">';$('tbmCard').classList.remove('miss','shake')}
function dropTbm(id){ins.tbm=ins.tbm.filter(x=>x!==id);addTbmRefresh()}
function addTbmRefresh(){$('tbmList').innerHTML=thumbs(ins.tbm,'dropTbm')+'<label class="button ghost" for="tbmFile">📷 사진 넣기</label><input class="hidefile" type="file" id="tbmFile" accept="image/*" capture="environment" onchange="addTbm()" aria-label="TBM 사진 선택">'}
async function addInspBad(n){const nt=ins.notes[n],ids=await upInsp('if_'+n,null,5-nt.photos.length);if(!ids.length)return;nt.memo=$('f_im'+n)?.value||nt.memo;nt.photos=nt.photos.concat(ids).slice(0,5);$('ibx_'+n).innerHTML=inspBadBox(n)}
function inspFlag(ids,text){document.querySelectorAll('.miss').forEach(x=>x.classList.remove('miss','shake'));ids.forEach(id=>{const el=$(id);if(!el)return;el.classList.add('miss');void el.offsetWidth;el.classList.add('shake')});const f=$(ids[0]);if(f){f.scrollIntoView({behavior:'smooth',block:'center'});if(f.tagName==='INPUT')setTimeout(()=>f.focus({preventScroll:true}),400)}msg(text)}
async function submitInspNow(){ins.name=value('inName');const miss=[];if(!ins.tbm.length)miss.push('tbmCard');
 Object.entries(ins.items).forEach(([n,x])=>{if(x==='BAD'&&!String(ins.notes[n]?.memo||'').trim())miss.push('f_im'+n)});if(!ins.name)miss.push('f_inName');
 const dr=ins.drill||{type:'',photos:[]};if(dr.photos.length&&!dr.type||dr.type&&!dr.photos.length)miss.unshift('drillCard');  // F1.8b 종류만·사진만이면 확인
 if(miss.length){inspFlag(miss,miss[0]==='tbmCard'?'TBM 사진을 먼저 올려 주세요':miss[0]==='drillCard'?(dr.type?'교육·훈련 사진을 올려 주세요 (안 했으면 종류 선택을 다시 눌러 끄세요)':'교육·훈련 종류를 골라 주세요'):miss[0]==='f_inName'?'점검자 이름을 적어 주세요':'불량 항목의 지적 내용을 적어 주세요');return}
 const bad=Object.values(ins.items).filter(x=>x==='BAD').length;
 /* F1.7f 확인·결과를 화면 안 창으로 (일부 휴대폰은 confirm/alert를 말없이 막아 "눌러도 반응 없음"이 됨) */
 if(!await askOk('순회점검 제출',bad?'지적사항 '+bad+'건은 조치될 때까지 미조치로 남습니다.':'전 항목 이상 없음으로 제출합니다.','제출'))return;
 /* F1.8p 불량이 아닌 항목에 남은 사진은 버림 → 사진 올리기 → 일지 저장 (체크리스트 한 번) */
 Object.keys(ins.notes).forEach(n=>{if(ins.items[n]!=='BAD')ins.notes[n].photos=[]});
 const lists=[ins.tbm,dr.photos].concat(Object.values(ins.notes).map(x=>x.photos)),np=pendCount(lists);
 try{await subRun('순회점검 제출',[np&&['사진 '+np+'장 올리기',set=>pendUpload(lists,set,inspPhoto)],['순회점검일지 저장',async()=>{vjob=await api('submitInspection',[vjob.job.id,{tbm:ins.tbm,items:ins.items,notes:ins.notes,name:ins.name,drill:dr.photos.length?{type:dr.type,photos:dr.photos}:null}])}]]);ins=null;renderVJob();$('inspCard')?.scrollIntoView({block:'start'});popup('순회점검 제출 완료','오늘 순회점검일지를 제출했습니다.'+(bad?'\n지적사항 '+bad+'건은 조치 후 [조치 등록]을 해 주세요.':''),'확인')}
 catch(e){showErr('순회점검을 제출하지 못했습니다',e)}}
/* ---------- 지적사항 조치 등록 (업체·도급인 공용) ---------- */
/** F1.8k 도급인 책임자 이름 (서버가 공사 화면과 함께 보내 줌 · 없으면 기본값) */
function principalName(k,withTitle){const P=(typeof jobData!=='undefined'&&jobData&&jobData.principal)||(typeof vjob!=='undefined'&&vjob&&vjob.principal)||{ceo:{name:'김기호',rank:'부사장',title:'안전보건총괄책임자'},delegate:{name:'곽동민',rank:'부장'}},p=P[k]||{};return withTitle?[p.title,p.name].filter(Boolean).join(' '):[p.name,p.rank].filter(Boolean).join(' ')}
let rs=null;
/* F1.8f from='dash': 메인 화면 [조치하기]에서 열었으면 돌아가기·등록 후 메인으로 */
function openResolve(id,who,from){const list=who==='staff'?inspJob.findings:vjob.insp.open,f=list.find(x=>x.id===id);if(!f)return;rs={f,who,photos:[],from:from||''};renderResolve()}
const rsBack=()=>rs&&rs.from==='dash'?(rs.who==='staff'?'rs=null;sgo(\'dash\')':'rs=null;vgo(\'dash\')'):rs&&rs.who==='staff'?'renderInspList()':'renderVJob()';
function renderResolve(){const f=rs.f,staff=rs.who==='staff',t=new Date(Date.now()+9*3600e3).toISOString().slice(0,10),area=staff?$('jobs'):$('execArea');
 area.innerHTML='<div class="card"><button class="button ghost" type="button" onclick="'+rsBack()+'">← 돌아가기</button><h2 style="margin-top:12px">지적사항 조치 등록</h2><table class="rtable"><tr><th>항목</th><td>'+f.no+'. '+escapeText(f.item)+'</td></tr><tr><th>업체</th><td>'+escapeText(f.company)+'</td></tr><tr><th>지적일</th><td>'+escapeText(f.foundDate)+'</td></tr><tr><th>지적 내용</th><td>'+escapeText(f.memo)+'</td></tr><tr><th>조치 전</th><td>'+(thumbs(f.before,'')||'<span class="muted">사진 없음</span>')+'</td></tr></table></div>'
  +'<div class="card"><div class="field"><label for="f_rsMemo">조치 내용 <span class="req">*</span></label><input id="f_rsMemo" placeholder="예) 통로 자재 정리 완료, 적치구역 지정"></div>'
  +'<div class="split"><div class="field"><label for="f_rsDate">조치일 <span class="req">*</span></label><input id="f_rsDate" type="date" value="'+t+'" min="'+escapeText(f.foundDate)+'" max="'+t+'"></div>'+(staff?'':'<div class="field"><label for="f_rsName">조치 확인자 <span class="req">*</span></label><input id="f_rsName" value="'+escapeText(vjob.siteManager||'')+'"></div>')+'</div>'
  +'<div class="field" id="rsPh"><label>조치 후 사진 <span class="req">*</span></label><div class="row" id="rsList">'+rsPhotoHtml()+'</div></div></div>'
  +'<div class="card roomfoot"><button class="button" type="button" style="width:100%" onclick="resolveNow()">조치 완료 등록</button></div>';window.scrollTo(0,0);loadInspPhotos(staff?inspJob.job.id:vjob.job.id)}
function rsPhotoHtml(){return thumbs(rs.photos,'')+'<label class="button ghost" for="rsFile">📷 조치 후 사진</label><input class="hidefile" type="file" id="rsFile" accept="image/*" capture="environment" onchange="addRsPhoto()" aria-label="조치 후 사진 선택">'}
async function addRsPhoto(){const memo=value('rsMemo'),date=value('rsDate'),name=value('rsName'),ids=await upInsp('rsFile',rs.who==='staff'?rs.f.companyId:null,5-rs.photos.length);if(!ids.length)return;rs.photos=rs.photos.concat(ids).slice(0,5);
 /* 조치 내용·조치일·확인자는 사진 칸만 다시 그리므로 그대로 남지만, 혹시 화면이 바뀌었으면 되살림 */if($('f_rsMemo')&&!$('f_rsMemo').value)$('f_rsMemo').value=memo;if($('f_rsDate')&&!$('f_rsDate').value)$('f_rsDate').value=date;if($('f_rsName')&&!$('f_rsName').value)$('f_rsName').value=name;$('rsList').innerHTML=rsPhotoHtml();$('rsPh').classList.remove('miss','shake')}
async function resolveNow(){const d={memo:value('rsMemo'),date:value('rsDate'),name:value('rsName'),photos:rs.photos},miss=[];if(!d.memo)miss.push('f_rsMemo');if(!d.date)miss.push('f_rsDate');if(rs.who!=='staff'&&!d.name)miss.push('f_rsName');if(!d.photos.length)miss.push('rsPh');
 if(miss.length){inspFlag(miss,'빨간 칸을 채워 주세요 (조치 후 사진 필수)');return}if(!await askOk('조치 완료 등록',d.date+' 조치 완료로 등록할까요?','등록'))return;
 const fid=rs.f.id,dash=rs.from==='dash';
 /* F1.8p 조치 후 사진 올리기 → 조치 저장 (체크리스트 한 번) */
 const np=pendCount([rs.photos]);let res=null;
 try{await subRun('조치 완료 등록',[np&&['조치 후 사진 '+np+'장 올리기',set=>pendUpload([rs.photos],set,inspPhoto)],['조치 결과 저장',async()=>{d.photos=rs.photos;res=await api('resolveFinding',[fid,d])}]]);
  if(rs.who==='staff'){inspJob=res;rs=null;
   if(dash){/* F1.8g 도급인 메인에서 연 조치 → 메인 목록 바로 '조치 완료' */((jobData&&jobData.jobs)||[]).forEach(j=>{(j.findings||[]).forEach(f=>{if(f.id===fid){f.status='DONE';f.actionDate=d.date}});if(j.findings)j.findOpen=j.findings.filter(f=>f.status!=='DONE').length});jobAt=0;sgo('dash')}
   else renderInspList()}
  else{vjob=res;rs=null;
   if(dash){/* F1.8f 메인 목록도 바로 '조치 완료'로 바꾸고 메인으로 */((vjobs&&vjobs.jobs)||[]).forEach(j=>(j.findings||[]).forEach(f=>{if(f.id===fid){f.status='DONE';f.actionDate=d.date}}));((vjobs&&vjobs.jobs)||[]).forEach(j=>{if(j.stats&&j.findings)j.stats.openFindings=j.findings.filter(f=>f.status!=='DONE').length});vjobsAt=0;vgo('dash')}
   else{renderVJob();$('inspCard')?.scrollIntoView({block:'start'})}}
  rs=null;msg('조치 완료로 등록했습니다.')}catch(e){showErr('조치 완료로 등록하지 못했습니다',e)}}
/* ---------- 순회점검일지 (종이 일지 모양 보기, 업체·도급인 공용) ---------- */
async function openInspSheet(id,who){let x,fs,items,job,area;
 if(who==='staff'){x=inspJob.list.find(i=>i.id===id);fs=inspJob.findings.filter(f=>f.inspId===id);items=inspJob.items;job=inspJob.job;area=$('jobs')}
 else{const I=vjob.insp;x=I.recent.find(i=>i.id===id);if(x&&x.bad&&!vjob.inspAll){try{vjob.inspAll=await call('inspMine',vjob.job.id)}catch(e){}}fs=(vjob.inspAll||I.open).filter(f=>f.inspId===id);items=I.items;job=vjob.job;area=$('execArea')}
 if(!x)return;clearInterval(wkTimer);if(Array.isArray(x.labels)&&x.labels.length)items=x.labels;  // F1.8a 그날 점검표 그대로
 area.innerHTML='<div class="card"><button class="button ghost" type="button" onclick="'+(who==='staff'?'renderInspList()':'renderVJob()')+'">← 돌아가기</button></div>'
  +'<div class="card sheet ilog"><h2 class="sheet-t">순 회 점 검 일 지</h2><div class="sheet-s">(2일 1회)</div>'
  +'<table class="rtable" style="margin-top:12px"><tr><th>현장명</th><td>다이소 '+escapeText(job.storeName)+'</td><th>점검일</th><td>'+escapeText(x.date)+'</td></tr>'
  +'<tr><th>점검 실시</th><td colspan="3">'+escapeText(x.company)+' · '+escapeText(x.submittedName)+' <span class="muted">('+escapeText(fmtTime(x.submittedAt))+' 작성)</span></td></tr>'
  /* F1.8k 작성 = 업체 소장 · 검토 = [확인]을 누른 도급인 담당자 · 승인 = 위임받은 도급인 책임자 (확인할 때 함께) */
  +'<tr><th>검토 (도급인 담당)</th><td colspan="3">'+(x.checkedAt?'<b>'+escapeText(x.checkedBy)+'</b> <span class="muted">'+escapeText(fmtTime(x.checkedAt))+'</span>':'<span class="req">확인 대기</span>')+'</td></tr>'
  +'<tr><th>승인 (도급인 책임자)</th><td colspan="3">'+(x.checkedAt?'<b>'+escapeText(principalName('delegate'))+'</b> <span class="stamp">승인</span> <span class="muted">('+escapeText(principalName('ceo',1))+' 위임)</span>':'<span class="muted">검토 후 자동</span>')+'</td></tr></table>'
  +'<div class="stage">TBM 실시 사진</div><div class="row">'+thumbs(x.tbm,'')+'</div>'
  +(x.drill?'<div class="stage">교육 · 비상대응훈련 · '+escapeText(x.drill.label||drillLabel(x.drill.type))+'</div><div class="row">'+thumbs(x.drill.photos,'')+'</div>':'')
  +'<table class="rtable" style="margin-top:12px"><tr><th style="width:44px">No</th><th>점검 항목</th><th style="width:90px">결과</th></tr>'+items.map((t,i)=>{const r=x.items[i+1];return '<tr><td style="text-align:center">'+(i+1)+'</td><td>'+escapeText(t)+'</td><td style="text-align:center"'+(r==='BAD'?' class="req"':'')+'>'+escapeText(INSP_MARK[r]||'-')+'</td></tr>'}).join('')+'</table>'
  +'<div class="stage">지적사항 · 조치 결과</div>'+(fs.length?fs.map(f=>'<table class="rtable" style="margin-top:8px"><tr><th style="width:90px">항목</th><td colspan="3"><b>'+f.no+'. '+escapeText(f.item)+'</b></td></tr><tr><th>지적</th><td>'+escapeText(f.foundDate)+' · '+escapeText(f.memo)+'</td><th style="width:70px">상태</th><td style="width:90px">'+(f.status==='DONE'?'<b style="color:var(--ok)">조치 완료</b>':'<b class="req">미조치</b>')+'</td></tr>'
   +'<tr><th>조치 전</th><td colspan="3"><div class="row">'+(thumbs(f.before,'')||'<span class="muted">사진 없음</span>')+'</div></td></tr>'
   +'<tr><th>조치</th><td colspan="3">'+(f.status==='DONE'?escapeText(f.actionDate)+' · '+escapeText(f.actionMemo)+' <span class="muted">('+escapeText(f.actionBy)+')</span>':'<span class="muted">조치 전</span>')+'</td></tr>'
   +'<tr><th>조치 후</th><td colspan="3"><div class="row">'+(f.status==='DONE'?thumbs(f.after,''):'<span class="muted">-</span>')+'</div></td></tr></table>').join(''):(x.bad?'<p class="muted">지적사항을 불러오지 못했습니다.</p>':'<p class="desc">지적사항 없음</p>'))+'</div>';window.scrollTo(0,0);loadInspPhotos(job.id)}
/** 화면의 사진 칸을 채움 (처음 볼 때만 서버에서 받음) */
/* F1.5 한꺼번에 요청 → fb.js가 8장씩 묶어 서버에 한 번만 (예전: 사진마다 한 번씩 차례로) */
async function loadInspPhotos(jobId){const need=new Set();document.querySelectorAll('img[data-doc]').forEach(img=>{const id=img.dataset.doc;if(inspPhoto[id])img.src=inspPhoto[id];else need.add(id)});
 await Promise.all([...need].map(id=>callQuiet('getInspPhoto',jobId,id).then(f=>{inspPhoto[id]='data:'+f.mime+';base64,'+f.data;document.querySelectorAll('img[data-doc="'+id+'"]').forEach(x=>x.src=inspPhoto[id])}).catch(()=>{})))}
function viewInspPhoto(id){if(!inspPhoto[id])return;const w=window.open();if(w)w.document.write('<img src="'+inspPhoto[id]+'" style="max-width:100%">')}
/* ---------- 도급인: 공사별 순회점검 ---------- */
async function openInspList(jobId){try{inspJob=await call('inspList',jobId);jobsMode='insp';renderInspList()}catch(e){}}
function renderInspList(){const d=inspJob,un=d.list.filter(x=>!x.checkedAt).length,open=d.findings.filter(f=>f.status!=='DONE');jobsMode='insp';
 $('jobs').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="loadJobs()">← 공사 목록</button><h2 style="margin-top:12px">순회점검일지 · '+escapeText(d.job.title)+'</h2>'
  +'<table class="rtable" style="margin-top:10px"><tr><th>업체</th><th>마지막 점검</th></tr>'+d.vendors.map(v=>'<tr><td>'+escapeText(v.company)+' <span class="muted">'+escapeText(v.trade)+'</span></td><td'+(v.since==null||v.since>=2?' class="req"':'')+'>'+(v.last?escapeText(v.last)+' ('+v.since+'일 전)':'점검 기록 없음')+'</td></tr>').join('')+'</table>'
  +(un?'<button class="button" type="button" style="width:100%;margin-top:12px" onclick="checkAllInsp()">확인 대기 '+un+'건 전체 확인</button>':'<p class="desc" style="margin-top:10px">확인 대기 없음</p>')+'</div>'
  +'<div class="card"><h2>미조치 지적사항 '+(open.length?'<span class="cnt">'+open.length+'</span>':'')+'</h2>'+(open.map(f=>findRow(f,'staff')).join('')||'<p class="muted">미조치 지적사항이 없습니다.</p>')+'</div>'
  +'<div class="card"><h2>일지 '+d.list.length+'건</h2>'+(d.list.map(x=>'<button class="jobitem" type="button" onclick="openInspSheet(\''+escapeText(x.id)+'\',\'staff\')"><div><b>'+escapeText(x.date)+' · '+escapeText(x.company)+'</b> '+(x.checkedAt?'<span class="pill ok">확인</span>':'<span class="pill todo">확인 대기</span>')+'<div class="muted">점검 '+escapeText(x.submittedName)+(x.bad?' · 지적 '+x.bad+'건':' · 이상 없음')+'</div></div><span aria-hidden="true">›</span></button>').join('')||'<p class="muted">아직 제출된 일지가 없습니다.</p>')+'</div>';window.scrollTo(0,0)}
async function checkAllInsp(){const n=inspJob.list.filter(x=>!x.checkedAt).length;if(!confirm('확인 대기 '+n+'건을 모두 확인할까요?\n일지에 "도급인 확인: '+(state.staff?state.staff.name:'')+'"이 남습니다.'))return;
 try{inspJob=await call('checkInspections',inspJob.job.id,[]);renderInspList();msg(n+'건 확인했습니다.');refreshBadges();const j=jobData&&jobData.jobs.find(x=>x.id===inspJob.job.id);if(j)j.inspUnchecked=0}catch(e){}}
