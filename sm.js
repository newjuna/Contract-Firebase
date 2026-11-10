/* F2.3 오픈지원 현장관리자 (= 관리감독자 · 대표 근로자)
 *  지정 QR(?review=SMG-토큰) → 본인 Google 로그인 → 이름 · 작업 안전 수칙 서약 → 현장관리자 (인력 명부 자동 기록)
 *  내 화면 = 진행 중 오픈 매장만: ① 오늘 TBM 사진 ② 신규자 등록 (QR · 직접 등록 「관리자 확인」) ③ 지적사항 조치
 *  서버: fb.js smInviteInfo · smJoin · smHome · smPhoto · smTbm · smAddWorker · smResolve (쓰기·권한 확인은 중계 Relay.gs sm*_) */
let smData=null,smSel='',smTbmNew=[],smShow='',smRs=null,smBusy=false;
const SM_LINK=()=>/^SMG-[a-f0-9]{32}$/.test(LINK_REVIEW)&&!window.__smDone;
function smClearLink(){window.__smDone=true;try{history.replaceState(null,'',location.pathname)}catch(e){}}
const smJob=()=>{const L=(smData&&smData.jobs)||[];return L.find(j=>j.id===smSel)||L[0]||null};
const smToday=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,10);

/* ---------- 지정 QR로 등록 ---------- */
async function renderSmJoin(){const el=$('my'),token=LINK_REVIEW.slice(4).toLowerCase();$('pageTitle').textContent='현장관리자 등록';
 el.innerHTML='<div class="card"><h2>현장관리자 등록</h2><p class="desc">지정 QR을 확인하는 중입니다…</p></div>';
 let r;try{r=await callQuiet('smInviteInfo',token)}catch(e){el.innerHTML='<div class="card"><h2>현장관리자 등록</h2><div class="note">'+escapeText(e.message||'지정 QR을 확인하지 못했습니다.')+'</div><button class="button ghost" type="button" style="margin-top:10px" onclick="smClearLink();display(state)">닫기</button></div>';return}
 window.__wkCo=r.company||'';
 const head='<div class="card"><small class="muted">'+escapeText(r.company)+' · 다이소 '+escapeText(r.storeName)+'</small><h2>현장관리자 등록</h2>';
 if(r.usedByMe||r.already){el.innerHTML=head+'<div style="text-align:center;padding:8px 0"><div style="font-size:40px;color:var(--ok)">✔</div><h2 style="color:var(--ok)">이미 등록되어 있습니다</h2><p class="desc"><b>'+escapeText((r.already&&r.already.name)||'')+'</b> · 다이소 '+escapeText(r.storeName)+' 현장관리자<br>계정 '+escapeText(state.email)+'</p></div><button class="button" type="button" style="width:100%" onclick="smJoinDone()">내 화면으로</button></div>';return}
 if(r.owner||state.company){el.innerHTML=head+'<div class="note">지금 로그인한 계정 <b>'+escapeText(state.email)+'</b> 은(는) 업체 대표(계약담당자) 계정입니다.<br>지정 QR은 <b>현장관리자(대표 근로자) 본인 휴대폰</b>으로 찍어야 합니다.</div><div class="row" style="margin-top:10px"><button class="button ghost" type="button" onclick="relogin()">다른 계정으로 로그인</button><button class="button ghost" type="button" onclick="smClearLink();display(state)">닫기</button></div></div>';return}
 if(r.self){el.innerHTML=head+'<div class="note">인력관리자 본인 계정으로는 현장관리자가 될 수 없습니다.<br>대표 근로자의 휴대폰 카메라로 QR을 찍게 해 주세요.</div><div class="row" style="margin-top:10px"><button class="button ghost" type="button" onclick="relogin()">다른 계정으로 로그인</button><button class="button ghost" type="button" onclick="smClearLink();display(state)">닫기</button></div></div>';return}
 if(r.used||r.expired){el.innerHTML=head+'<div class="note">'+(r.used?'이미 다른 사람이 사용한 지정 QR입니다.':'지정 QR 유효시간이 지났습니다.')+'<br>인력관리자에게 <b>새 QR</b>을 요청해 주세요.</div><button class="button ghost" type="button" style="margin-top:10px" onclick="relogin()">다른 계정으로 로그인</button></div>';return}
 el.innerHTML=head+'<p class="desc">'+(r.by?'인력관리자 <b>'+escapeText(r.by)+'</b> 님이 ':'')+'<b>현장관리자</b>(관리감독자)로 지정했습니다.<br>로그인 계정 <b>'+escapeText(state.email)+'</b> 으로 등록합니다. <b>본인 Google 계정</b>인지 확인해 주세요. <button class="linkbtn" type="button" onclick="relogin()">다른 계정으로 로그인</button></p>'
  +'<form onsubmit="sendSmJoin(event)">'+input('sjName','이름','','text',false,'예: 홍길동')
  +'<div class="note" style="margin-top:8px">현장관리자가 하는 일<br>· 매일 작업 전 <b>TBM</b> 사진 저장<br>· 새로 온 근로자 <b>신규자 등록</b> (QR · 직접 등록)<br>· 도급인 순회점검 <b>지적사항 조치</b><br>· 연락처는 받지 않습니다. 이 Google 계정과 이름만 기록됩니다.</div>'
  +'<div class="stage">작업 안전 수칙 (끝까지 읽어 주세요)</div><ol class="rules boxed">'+(r.rules||[]).map(x=>'<li>'+escapeText(x)+'</li>').join('')+'</ol><p class="pledge">'+escapeText(r.pledge||'')+'</p>'
  +'<label class="wk"><input type="checkbox" id="sjAgree"><span>위 작업 안전 수칙을 교육받았고, 준수할 것을 서약합니다.</span></label>'
  +'<button class="button" type="submit" id="btnSmJoin" style="width:100%;margin-top:12px">현장관리자로 등록</button></form></div>';setTimeout(()=>$('f_sjName')?.focus(),50)}
async function sendSmJoin(e){e.preventDefault();const name=value('sjName'),agree=!!($('sjAgree')&&$('sjAgree').checked);if(!name){markMissing([{key:'sjName'}]);return}if(!agree){popup('확인해 주세요','작업 안전 수칙 교육 확인·서약에 체크해 주세요.','확인');return}
 const b=$('btnSmJoin');if(b){b.disabled=true;b.textContent='등록하는 중…'}
 try{const s=await call('smJoin',LINK_REVIEW.slice(4).toLowerCase(),{name,agree});smClearLink();roleView='sm';display(s);msg('현장관리자로 등록했습니다.')}
 catch(err){if(b&&b.isConnected){b.disabled=false;b.textContent='현장관리자로 등록'}}}
async function smJoinDone(){smClearLink();roleView='sm';try{display(await call('portalData'))}catch(e){display(state)}}

/* ---------- 현장관리자 내 화면 ---------- */
async function renderSmHome(quiet){const el=$('my');if(!quiet)$('pageTitle').textContent='현장관리자(관리감독자)';$('myTab').textContent='내 업무';
 if(!smData&&!quiet)el.innerHTML='<div class="card"><h2>'+escapeText((state.sm&&state.sm.name)||'')+' 님 · 관리감독자</h2><p class="desc">오픈 매장을 불러오는 중입니다…</p></div>';
 try{smData=await callQuiet('smHome');if($('qrBox'))return/* F2.7 그사이 QR 찍기 화면으로 갔으면 덮지 않음 */}catch(e){if(!smData){el.innerHTML='<div class="card"><h2>현장관리자(관리감독자)</h2><p class="desc">'+escapeText(e.message||'불러오지 못했습니다.')+'</p><button class="button" type="button" onclick="renderSmHome()">다시 시도</button></div>';return}}
 smDraw()}
/* F2.7 시안 v3: 메인 = ① TBM ② 신규자 등록 ③ 지적사항 조치 · 끝낸 칸은 인테리어처럼 어둡게 + '✔ 오늘 완료' (눌러서 열기)
 *  비상훈련 참석 · 협의체 참석 · 근로자 명단 · TBM 기록 = ☰ 메뉴 화면 (smGo) · 설명 글은 위쪽 [❔ 가이드] */
let smPage='home';const SM_ROLE='현장관리자';
const smNoNewKey=j=>'smNoNew:'+j.id+':'+(j.today||smToday());
function smNoNew(j){try{return localStorage.getItem(smNoNewKey(j))==='1'}catch(e){return false}}
function smSetNoNew(on){const j=smJob();if(!j)return;try{if(on)localStorage.setItem(smNoNewKey(j),'1');else localStorage.removeItem(smNoNewKey(j))}catch(e){}smDraw()}
/** 매장 이름 줄 (여러 오픈 매장이면 고르기) */
function smHeadHtml(d,j){return '<div class="card"><h2 style="margin:0">'+escapeText(j.name)+' 님 · 관리감독자</h2>'
  +(d.jobs.length>1?'<select id="smSel" class="vjsel" aria-label="오픈 매장 선택" style="margin-top:8px" onchange="smSel=this.value;smTbmNew=[];smShow=\'\';smDraw()">'+d.jobs.map(x=>'<option value="'+escapeText(x.id)+'" '+(x.id===j.id?'selected':'')+'>'+escapeText(x.storeName)+' ('+escapeText(omd(x.startDate))+' ~ '+escapeText(omd(x.endDate))+')</option>').join('')+'</select>':'')
  +'<div class="muted" style="margin-top:4px">다이소 '+escapeText(j.storeName)+' · '+escapeText(omd(j.startDate))+' ~ '+escapeText(omd(j.endDate))+'</div></div>'}
/** F2.7 [현장관리자(관리감독자)] ☰ 메뉴 이동 */
function smGo(v){toggleMenu(false);if(typeof stopScan==='function')stopScan();setTopGuide('');smRs=null;smPage=v||'home';rmSetup('sm',smPage);window.scrollTo(0,0);
 if(smPage==='meet'){$('pageTitle').textContent='협의체 · 합동점검 참석';renderScan('my','smGo(\'home\')','meet');return}
 if(smPage==='drill'){$('pageTitle').textContent='비상훈련 참석';renderSmHome();return}  // 참석 ✔ 다시 받기
 if(smData){smDraw();if(smPage==='home')renderSmHome(true)}else renderSmHome()}
function smDraw(){const el=$('my'),d=smData;if(!el||!d)return;if(smRs){smResolveDraw();return}const j=smJob();rmSetup('sm',smPage);
 if(!j){el.innerHTML=roleSwitchHtml('sm')+'<div class="card"><h2>'+escapeText(d.name||(state.sm&&state.sm.name)||'')+' 님 · 관리감독자</h2><div class="note">진행 중인 오픈 매장이 없습니다.</div></div>';setTopGuide('');return}
 window.__wkCo=j.company||'';
 if(smPage==='drill')return smDrillDraw(d,j);if(smPage==='edu')return smEduDraw(d,j);if(smPage==='tbm')return smTbmDraw(d,j);
 $('pageTitle').textContent='현장관리자(관리감독자)';
 const t=j.today||smToday(),tt=j.tbmToday,todayW=j.workers.filter(w=>mgrDay(w.eduAt)===t&&w.role!==SM_ROLE),/* F2.8a 관리감독자 본인 등록은 '오늘 신규자'로 안 셈 */link=location.origin+location.pathname+'?review=WRK-'+j.workerToken,noNew=smNoNew(j);
 const sb='padding:8px 10px;font-size:13px',tbmDone=!!tt&&!smTbmNew.length,regDone=(todayW.length>0||noNew)&&!smShow;
 el.innerHTML=roleSwitchHtml('sm')+smHeadHtml(d,j)
  /* ① TBM */
  +'<div class="card" id="smTbmCard" style="position:relative">'+(tbmDone?doneMask('TBM 사진'):'')+'<div class="vh-top"><h2 style="margin:0;font-size:16px">① TBM 사진</h2>'+(tt?'<span class="pill ok">✔ '+tt.photos.length+'장</span>':'')+'</div>'
  +(tt?'<div class="row" style="margin-top:6px">'+thumbs(tt.photos,'')+'</div>':'')
  +'<div class="row" id="smTbmList" style="margin-top:6px">'+thumbs(smTbmNew,'smDropTbm')+phBtns('smTbmFile','smAddTbm(','TBM 사진')+'</div>'
  +(smTbmNew.length?'<button class="button" type="button" style="width:100%;margin-top:8px" onclick="smSaveTbm()">TBM 사진 '+smTbmNew.length+'장 '+(tt?'더 ':'')+'저장</button>':'')+'</div>'
  /* ② 신규자 등록 */
  +'<div class="card" id="smRegCard" style="position:relative">'+(regDone?doneMask('신규자 등록'):'')+'<div class="vh-top"><h2 style="margin:0;font-size:16px">② 신규자 등록</h2><span class="muted">전체 '+j.workers.length+'명</span></div>'
  +'<div class="row" style="margin-top:8px;gap:6px"><button class="button" type="button" id="smBtnQr" style="flex:1;'+sb+'" onclick="smShow=smShow===\'qr\'?\'\':\'qr\';smDraw()">'+(smShow==='qr'?'QR 닫기':'QR 보여주기')+'</button><button class="button ghost" type="button" id="smBtnAdd" style="flex:1;'+sb+'" onclick="smShow=smShow===\'add\'?\'\':\'add\';smDraw()">'+(smShow==='add'?'직접 등록 닫기':'직접 등록')+'</button></div>'
  +(smShow==='qr'?'<div style="text-align:center;margin:12px 0 4px"><img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data='+encodeURIComponent(link)+'" alt="근로자 등록 QR 코드" width="220" height="220" style="border:1px solid var(--line);border-radius:12px"><div class="row" style="justify-content:center;gap:6px;margin-top:6px"><button class="button ghost" type="button" style="'+sb+'" onclick="copyLink(\''+escapeText(link)+'\')">등록 링크 복사</button><button class="button ghost" type="button" style="'+sb+'" onclick="renderSmHome(true)">⟳ 등록 확인</button></div></div>':'')
  +(smShow==='add'?'<form class="subbox" onsubmit="smAddForm(event)">'+input('swName','이름','','text',false,'홍길동')+'<label class="desc" style="display:block;margin-top:8px"><input type="checkbox" id="swAgree"> 채용 시 교육(작업 안전 수칙 '+((typeof WORK_RULES_N!=='undefined')?WORK_RULES_N:14)+'개 항목 포함)을 하고 서약을 받았습니다. <b>(관리자 확인)</b></label><button class="button" type="submit" id="btnSmAdd" style="width:100%;margin-top:10px">직접 등록</button></form>':'')
  +'<div style="margin-top:10px">'+(todayW.length?'<table class="rtable"><tr><th>오늘 등록</th><th>구분</th><th>방법</th></tr>'+todayW.map(w=>'<tr><td><b>'+escapeText(w.name)+'</b></td><td>'+escapeText(w.role)+'</td><td class="muted" style="font-size:12px">'+(w.method==='SELF'?'본인 서명':escapeText(w.confirmBy||'관리자 확인'))+'</td></tr>').join('')+'</table>':'<div class="row" style="justify-content:space-between"><span class="muted">오늘 등록한 사람 없음'+(noNew?' · [오늘 신규자 없음] 표시함':'')+'</span>'+(noNew?'<button class="button ghost" type="button" style="padding:4px 8px;font-size:12px" onclick="smSetNoNew(false)">취소</button>':'<button class="button ghost" type="button" id="smBtnNoNew" style="padding:4px 8px;font-size:12px" onclick="smSetNoNew(true)">오늘 신규자 없음</button>')+'</div>')+'</div></div>'
  /* ③ 지적사항 조치 */
  +'<div class="card" id="smFixCard"><div class="vh-top"><h2 style="margin:0;font-size:16px">③ 지적사항 조치</h2>'+(j.open.length?'<span class="pill bad">미조치 '+j.open.length+'</span>':'<span class="pill ok">미조치 없음</span>')+'</div>'
  +(j.open.length?j.open.map(f=>'<div class="item"><div class="row" style="justify-content:space-between"><div><b>'+escapeText(f.item)+'</b>'+reqPill(f)+'<div class="muted">지적 '+escapeText(f.foundDate)+' · '+escapeText(f.memo)+'</div></div><button class="button" type="button" onclick="smResolveOpen(\''+escapeText(f.id)+'\')">조치 등록</button></div></div>').join('')
   :'')
  +(j.done.length?'<details class="hist" style="margin-top:8px"><summary>조치 완료 '+j.done.length+'건</summary>'+j.done.map(f=>'<div class="muted" style="padding:4px 0;border-top:1px solid var(--line)">'+escapeText(f.actionDate)+' · '+escapeText(f.item)+' · '+escapeText(f.actionBy)+'</div>').join('')+'</details>':'')+'</div>';
 if(tt&&tt.photos.length)loadInspPhotos(j.id);setTopGuide('smhome')}
/** F2.7 ☰ 비상훈련 참석: [📷 QR 찍기] (앱 안 카메라) · 도급인이 진행한 훈련과 내 참석 */
function smDrillDraw(d,j){const L=j.drills||[];$('pageTitle').textContent='비상훈련 참석';
 $('my').innerHTML=roleSwitchHtml('sm')+smHeadHtml(d,j)
  +'<div class="card" style="text-align:center"><h2>비상훈련 참석</h2><button class="button" type="button" id="sdScan" style="width:100%" onclick="smPage=\'drill\';renderScan(\'my\',\'smGo(\\\'drill\\\')\',\'drill\')">📷 QR 찍기</button></div>'
  +'<div class="card" id="sdList">'+(L.length?L.map(x=>'<div class="row" style="justify-content:space-between;padding:6px 0;border-top:1px solid var(--line)"><span>'+escapeText(x.label)+' <span class="muted">'+escapeText(omd(x.date))+'</span></span>'+(x.at?'<span class="pill ok">✔ '+escapeText(omd(mgrDay(x.at)))+' 참석</span>':x.open?'<span class="pill bad">참석 전</span>':'<span class="pill lock">'+(x.done?'끝남':'열리기 전')+'</span>')+'</div>').join(''):'<p class="muted" style="margin:0">아직 진행한 비상훈련이 없습니다.</p>')+'</div>';setTopGuide('smdrill')}
/** F2.7 ☰ 근로자 명단 · 교육일지 (등록 방법 · 등록일 · 「관리자 확인」) */
function smEduDraw(d,j){$('pageTitle').textContent='근로자 명단 · 교육일지';const W=j.workers||[];
 $('my').innerHTML=roleSwitchHtml('sm')+smHeadHtml(d,j)
  +'<div class="card" id="seList"><div class="vh-top"><h2 style="margin:0;font-size:16px">근로자 명단</h2><span class="pill ok">'+W.length+'명</span></div>'
  +(W.length?'<table class="rtable" style="margin-top:10px"><tr><th>이름</th><th>구분</th><th>교육 · 서약</th><th style="width:64px">등록일</th></tr>'+W.map(w=>'<tr><td><b>'+escapeText(w.name)+'</b></td><td>'+escapeText(w.role)+'</td><td class="muted" style="font-size:12px">'+(w.method==='SELF'?'본인 서명':escapeText(w.confirmBy||'관리자 확인'))+'</td><td style="font-size:12px">'+escapeText(omd(mgrDay(w.eduAt)))+'</td></tr>').join('')+'</table>'
   :'<p class="muted" style="margin:8px 0 0">아직 등록한 근로자가 없습니다.</p>')+'</div>';setTopGuide('smedu')}
/** F2.7 ☰ TBM 기록 (저장한 날 · 오늘 사진) */
function smTbmDraw(d,j){$('pageTitle').textContent='TBM 기록';const tt=j.tbmToday,D=j.tbmDays||[];
 $('my').innerHTML=roleSwitchHtml('sm')+smHeadHtml(d,j)
  +'<div class="card" id="stList"><div class="vh-top"><h2 style="margin:0;font-size:16px">TBM 기록</h2><span class="pill '+(D.length?'ok':'lock')+'">'+D.length+'일</span></div>'
  +(tt?'<div class="stage">오늘 '+escapeText(omd(j.today))+'</div><div class="row">'+thumbs(tt.photos,'')+'</div>':'<p class="muted" style="margin:8px 0 0">오늘 TBM 전</p>')
  +(D.length?'<div class="stage">저장한 날</div><div style="display:flex;flex-wrap:wrap;gap:6px">'+D.map(x=>'<span class="pill ok">✔ '+escapeText(omd(x))+'</span>').join('')+'</div>':'')
  +'<button class="button ghost" type="button" style="width:100%;margin-top:12px" onclick="smGo(\'home\')">📷 오늘 TBM 사진 올리기</button></div>';
 if(tt&&tt.photos.length)loadInspPhotos(j.id);setTopGuide('smtbm')}
/* TBM 사진: 고르면 미리보기 → [저장] 때 올리기 + 저장 (체크리스트 한 번) */
async function smAddTbm(src){const j=smJob();if(!j)return;const inp=$(src),fl=[...((inp&&inp.files)||[])].slice(0,Math.max(0,10-smTbmNew.length));if(inp)inp.value='';if(!fl.length)return;
 window.__wkCo=j.company||'';const ids=await pendPhotos(fl,async f=>{const x=await readFile(f,PHOTO_SITE);return api('smPhoto',[j.id,x])});ids.forEach(id=>{if(PEND[id]&&PEND[id].url)inspPhoto[id]=PEND[id].url});
 smTbmNew=smTbmNew.concat(ids).slice(0,10);smDraw();$('smTbmCard')?.scrollIntoView({block:'start'})}
function smDropTbm(id){smTbmNew=smTbmNew.filter(x=>x!==id);if(isPend(id)){pendDrop(id);delete inspPhoto[id]}smDraw()}
async function smSaveTbm(){const j=smJob();if(!j||!smTbmNew.length||smBusy)return;smBusy=true;let res=null;
 try{await subRun('TBM 저장',[['TBM 사진 '+pendCount([smTbmNew])+'장 올리기',set=>pendUpload([smTbmNew],set,inspPhoto)],['TBM 저장',async()=>{res=await api('smTbm',[j.id,smTbmNew])}]]);
  smData=res;smTbmNew=[];smDraw();msg('오늘 TBM을 저장했습니다.')}catch(e){showErr('TBM을 저장하지 못했습니다',e)}finally{smBusy=false}}
/* 직접 등록 (보통인부 · 관리자 확인) · 같은 요청 다시 보냄 방지 */
let smPendW=null;
async function smAddForm(e){e.preventDefault();const j=smJob();if(!j||smBusy)return;const name=value('swName'),agree=!!($('swAgree')&&$('swAgree').checked);
 if(!name){markMissing([{key:'swName'}]);return}if(!agree){msg('교육 실시·서약 확인에 체크해 주세요.');return}
 const mark=j.id+'|'+name;if(!smPendW||smPendW.mark!==mark)smPendW={mark,rid:Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('')};
 smBusy=true;const b=$('btnSmAdd');if(b){b.disabled=true;b.textContent='등록하는 중…'}
 try{smData=await call('smAddWorker',j.id,{name,agree},smPendW.rid);smPendW=null;smShow='';smDraw();msg(name+' 님을 등록했습니다.')}
 catch(err){if(b&&b.isConnected){b.disabled=false;b.textContent='직접 등록'}}finally{smBusy=false}}
/* 지적사항 조치 (F2.7 who = 'mgr' 이면 인력관리자(현장대리인)가 조치 · 끝나면 그 목록으로) */
function smRsBack(){const w=smRs&&smRs.who;smRs=null;if(w==='mgr')mgrFixDraw('');else smDraw()}
function smResolveOpen(fid){const j=smJob(),f=j&&j.open.find(x=>x.id===fid);if(!f)return;smRs={f,jobId:j.id,photos:[]};smResolveDraw();window.scrollTo(0,0)}
function smResolveDraw(){const f=smRs.f,t=smToday();
 $('my').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="smRsBack()">← 돌아가기</button><h2 style="margin-top:12px">지적사항 조치 등록</h2><table class="rtable"><tr><th>항목</th><td>'+escapeText(f.item)+'</td></tr><tr><th>지적일</th><td>'+escapeText(f.foundDate)+'</td></tr><tr><th>지적 내용</th><td>'+escapeText(f.memo)+'</td></tr><tr><th>조치 전</th><td>'+(thumbs(f.before||[],'')||'<span class="muted">사진 없음</span>')+'</td></tr></table></div>'
  +'<div class="card"><div class="field"><label for="f_smrMemo">조치 내용 <span class="req">*</span></label><input id="f_smrMemo" value="'+escapeText(smRs.memo||'')+'" placeholder="예) 통로 박스 정리 완료"></div>'
  +'<div class="field"><label for="f_smrDate">조치일 <span class="req">*</span></label><input id="f_smrDate" type="date" value="'+escapeText(smRs.date||t)+'" min="'+escapeText(f.foundDate)+'" max="'+t+'"></div>'
  +'<div class="field" id="smrPh"><label>조치 후 사진 <span class="req">*</span></label><div class="row" id="smrList">'+thumbs(smRs.photos,'')+phBtns('smrFile','smAddRs(','조치 후 사진')+'</div></div></div>'
  +'<div class="card roomfoot"><button class="button" type="button" style="width:100%" onclick="smResolveNow()">조치 완료 등록</button></div>';loadInspPhotos(smRs.jobId)}
async function smAddRs(src){const inp=$(src),fl=[...((inp&&inp.files)||[])].slice(0,Math.max(0,5-smRs.photos.length));if(inp)inp.value='';if(!fl.length)return;
 smRs.memo=value('smrMemo');smRs.date=value('smrDate');const jid=smRs.jobId;
 const ids=await pendPhotos(fl,async f=>{const x=await readFile(f,PHOTO_SITE);return api('smPhoto',[jid,x])});ids.forEach(id=>{if(PEND[id]&&PEND[id].url)inspPhoto[id]=PEND[id].url});smRs.photos=smRs.photos.concat(ids).slice(0,5);smResolveDraw()}
async function smResolveNow(){if(smBusy)return;const d={memo:value('smrMemo'),date:value('smrDate'),photos:smRs.photos},miss=[];if(!d.memo)miss.push('f_smrMemo');if(!d.date)miss.push('f_smrDate');if(!d.photos.length)miss.push('smrPh');
 if(miss.length){inspFlag(miss,'빨간 칸을 채워 주세요 (조치 후 사진 필수)');return}if(!await askOk('조치 완료 등록',d.date+' 조치 완료로 등록할까요?','등록'))return;
 smBusy=true;const fid=smRs.f.id,who=smRs.who;let res=null;
 try{await subRun('조치 완료 등록',[pendCount([smRs.photos])&&['조치 후 사진 '+pendCount([smRs.photos])+'장 올리기',set=>pendUpload([smRs.photos],set,inspPhoto)],['조치 결과 저장',async()=>{d.photos=smRs.photos;res=await api('smResolve',[fid,d])}]]);
  smRs=null;if(who==='mgr'){mgrFixDraw('')}else{smData=res;smDraw()}msg('조치 완료로 등록했습니다.')}catch(e){showErr('조치 완료로 등록하지 못했습니다',e)}finally{smBusy=false}}
