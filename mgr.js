/* F2.2 오픈지원 인력관리자 (= 안전관리책임자 대리)
 *  계약담당자(업체 대표 계정) ☰ [인력관리자 관리]: 초대 링크 · 안내문 · 직접 입력 · 사용 중지 · 오픈 매장 배정
 *  인력관리자: 초대 링크(?review=MGR-토큰) → 본인 Google 로그인 → 이름 입력 → 배정된 진행 중 오픈 매장 보기
 *  서버: fb.js mgrBoard · mgrInvite · mgrInviteCancel · mgrAdd · mgrSetStatus · mgrAssign · mgrHome · mgrInviteInfo · mgrJoin (등록은 중계 Relay.gs mgrJoin_) */
let mgrData=null,mgrNew='';
const MGR_LINK=()=>/^MGR-[a-f0-9]{32}$/.test(LINK_REVIEW)&&!window.__mgrDone;
const mgrQr=link=>'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data='+encodeURIComponent(link);
const mgrDay=t=>{try{return new Date(t).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})}catch(e){return ''}};
/** F2.3 짧은 일시 (한국 시간) 예) 11/9 08:05 */
const mgrHM=t=>{try{if(!t)return '';const d=new Date(new Date(t).getTime()+9*3600e3).toISOString();return Number(d.slice(5,7))+'/'+Number(d.slice(8,10))+' '+d.slice(11,16)}catch(e){return ''}};
/** renderMy 맨 앞에서 부름: 초대 링크로 들어왔으면 등록 화면 · 인력관리자 계정이면 인력관리자 화면 (true = 여기서 그림) */
function mgrRoute(){if(!state)return false;
 if(MGR_LINK()){renderMgrJoin();return true}
 if(typeof SM_LINK==='function'&&SM_LINK()){renderSmJoin();return true}  // F2.3 현장관리자 지정 QR
 if(state.company||state.staff||state.mode==='STAFF')return false;
 /* F2.3 인력관리자이면서 현장관리자이기도 하면 위쪽 [화면 바꾸기]로 오감 (기본 = 현장관리자) */
 if(state.sm&&(!state.mgr||roleView!=='mgr')&&typeof renderSmHome==='function'){renderSmHome();return true}
 if(state.mgr){renderMgrHome();return true}
 return false}
let roleView='';
function roleSwitchHtml(cur){if(!(state&&state.sm&&state.mgr))return '';const to=cur==='mgr'?'sm':'mgr';
 return '<div style="text-align:right;margin:0 0 8px"><button class="button ghost" type="button" style="padding:4px 10px;font-size:12px" onclick="roleView=\''+to+'\';renderMy()">↔ '+(to==='mgr'?'인력관리자':'현장관리자')+' 화면으로</button></div>'}
/** 주소창의 초대 링크값 지우기 (등록 끝난 뒤 새로 고침해도 등록 화면이 다시 안 뜨게) */
function mgrClearLink(){window.__mgrDone=true;try{history.replaceState(null,'',location.pathname)}catch(e){}}

/* ---------- 인력관리자: 초대 링크로 등록 ---------- */
async function renderMgrJoin(){const el=$('my'),token=LINK_REVIEW.slice(4).toLowerCase();$('pageTitle').textContent='인력관리자 등록';
 el.innerHTML='<div class="card"><h2>인력관리자 등록</h2><p class="desc">초대 링크를 확인하는 중입니다…</p></div>';
 let r;try{r=await callQuiet('mgrInviteInfo',token)}catch(e){el.innerHTML='<div class="card"><h2>인력관리자 등록</h2><div class="note">'+escapeText(e.message||'초대 링크를 확인하지 못했습니다.')+'</div><button class="button ghost" type="button" style="margin-top:10px" onclick="mgrClearLink();display(state)">닫기</button></div>';return}
 const head='<div class="card"><small class="muted">'+escapeText(r.company)+' · 오픈지원</small><h2>인력관리자 등록</h2>';
 if(r.usedByMe||(r.already&&r.already.status==='ACTIVE')){el.innerHTML=head+'<div style="text-align:center;padding:8px 0"><div style="font-size:40px;color:var(--ok)">✔</div><h2 style="color:var(--ok)">이미 등록되어 있습니다</h2><p class="desc"><b>'+escapeText((r.already&&r.already.name)||'')+'</b> · '+escapeText(r.company)+' 인력관리자<br>계정 '+escapeText(state.email)+'</p></div><button class="button" type="button" style="width:100%" onclick="mgrJoinDone()">내 화면으로</button></div>';return}
 if(r.owner||state.company){el.innerHTML=head+'<div class="note">지금 로그인한 계정 <b>'+escapeText(state.email)+'</b> 은(는) 업체 대표(계약담당자) 계정입니다.<br>이 링크는 <b>인력관리자 본인</b>에게 보내 주세요. 인력관리자는 자기 Google 계정으로 로그인해서 등록합니다.</div><div class="row" style="margin-top:10px"><button class="button ghost" type="button" onclick="relogin()">다른 계정으로 로그인</button><button class="button ghost" type="button" onclick="mgrClearLink();display(state)">닫기</button></div></div>';return}
 if(r.used||r.expired){el.innerHTML=head+'<div class="note">'+(r.used?'이미 다른 사람이 사용한 초대 링크입니다.':'초대 링크 유효기간(7일)이 지났습니다.')+'<br>계약담당자에게 <b>새 초대 링크</b>를 요청해 주세요.</div><button class="button ghost" type="button" style="margin-top:10px" onclick="relogin()">다른 계정으로 로그인</button></div>';return}
 if(r.already&&r.already.status==='STOPPED'){el.innerHTML=head+'<div class="note">사용 중지된 인력관리자 계정입니다. 이 링크로 등록하면 <b>다시 사용</b>으로 바뀝니다.</div>'+mgrJoinForm(r.already.name)+'</div>';return}
 el.innerHTML=head+'<p class="desc"><b>'+escapeText(r.company)+'</b>에서 인력관리자로 초대했습니다.<br>로그인 계정 <b>'+escapeText(state.email)+'</b> 으로 등록합니다. <b>본인 Google 계정</b>인지 확인해 주세요. <button class="linkbtn" type="button" onclick="relogin()">다른 계정으로 로그인</button></p>'+mgrJoinForm('')+'</div>';
 setTimeout(()=>$('f_mjName')?.focus(),50)}
function mgrJoinForm(name){return '<form onsubmit="sendMgrJoin(event)">'+input('mjName','이름','' +(name||''),'text',false,'예: 홍길동')
 +'<div class="note" style="margin-top:8px">하는 일 (안전관리책임자 대리)<br>· 오픈 매장 <b>첫날</b> 현장 방문 · 대표 근로자를 <b>현장관리자</b>로 지정<br>· 협의체 · 합동점검 참석 · 합동점검 지적사항 조치<br>· 연락처는 받지 않습니다. 이 Google 계정과 이름만 기록됩니다.</div>'
 +'<button class="button" type="submit" id="btnMgrJoin" style="width:100%;margin-top:12px">인력관리자로 등록</button></form>'}
async function sendMgrJoin(e){e.preventDefault();const name=value('mjName');if(!name){markMissing([{key:'mjName'}]);return}
 const b=$('btnMgrJoin');if(b){b.disabled=true;b.textContent='등록하는 중…'}
 try{const s=await call('mgrJoin',LINK_REVIEW.slice(4).toLowerCase(),name);mgrClearLink();display(s);msg((s.joined&&s.joined.company?s.joined.company+' ':'')+'인력관리자로 등록했습니다.')}
 catch(err){if(b&&b.isConnected){b.disabled=false;b.textContent='인력관리자로 등록'}}}
async function mgrJoinDone(){mgrClearLink();try{display(await call('portalData'))}catch(e){display(state)}}

/* ---------- 인력관리자: 내 화면 (배정된 진행 중 오픈 매장) ---------- */
async function renderMgrHome(){const el=$('my');$('pageTitle').textContent='인력관리자';$('myTab').textContent='내 업무';
 const M=state.mgr||{};el.innerHTML='<div class="card"><h2>'+escapeText(M.name||'')+' 님 · 인력관리자</h2><p class="desc">배정된 오픈 매장을 불러오는 중입니다…</p></div>';
 let d;try{d=await callQuiet('mgrHome')}catch(e){el.innerHTML='<div class="card"><h2>인력관리자</h2><p class="desc">'+escapeText(e.message||'불러오지 못했습니다.')+'</p><button class="button" type="button" onclick="renderMgrHome()">다시 시도</button></div>';return}
 const act=d.mgrs.filter(m=>m.status==='ACTIVE'),stop=d.mgrs.filter(m=>m.status!=='ACTIVE'),t=d.today;mgrHomeData=d;
 el.innerHTML=roleSwitchHtml('mgr')+'<div class="card"><h2 style="margin:0">'+escapeText((act[0]||d.mgrs[0]||{}).name||M.name||'')+' 님 · 인력관리자</h2><div class="muted">'+escapeText(act.map(m=>m.company).join(', ')||'-')+' · 오픈지원 · '+escapeText(d.email)+'</div>'
  +(stop.length?'<div class="note" style="margin-top:8px">사용 중지: '+escapeText(stop.map(m=>m.company).join(', '))+' (계약담당자에게 문의)</div>':'')+'</div>'
  +'<div class="card"><h2>진행 중인 오픈 매장 <span class="cnt">'+d.jobs.length+'</span></h2>'
  +(d.jobs.length?d.jobs.map(j=>{const s=j.startDate||'',e=j.endDate||'',first=s===t,dd=s>t?'시작 '+Math.round((new Date(s)-new Date(t))/864e5)+'일 전':first?'<b class="req">오늘 첫날</b>':'진행 중';
   /* F2.3 현장관리자 지정 상태 · [지정 QR] */
   const S=(j.siteMgrs||[]),cur=S.find(x=>x.status==='ACTIVE');
   return '<div class="item"><div class="row" style="justify-content:space-between"><b>'+escapeText(j.title)+'</b><span class="pill '+(first?'bad':'ok')+'">'+dd+'</span></div><div class="muted">다이소 '+escapeText(j.storeName)+(j.address?' · '+escapeText(j.address):'')+'<br>'+escapeText(s)+' ~ '+escapeText(e)+' · 도급인 '+escapeText(j.hostName||'')+(act.length>1?' · '+escapeText(j.company):'')+'</div>'
    +'<div class="subbox" style="margin-top:8px">'+(cur?'<div class="row" style="justify-content:space-between"><span>현장관리자 <b>'+escapeText(cur.name)+'</b> <span class="pill ok">지정됨</span></span><span class="muted" style="font-size:12px">'+escapeText(mgrHM(cur.designatedAt))+'</span></div><div class="muted" style="font-size:12px;word-break:break-all">'+escapeText(cur.email)+'</div>'
      :'<div class="row" style="justify-content:space-between"><b class="req">현장관리자 미지정</b><span class="muted" style="font-size:12px">첫날 대표 근로자를 지정해 주세요</span></div>')
     +(S.filter(x=>x.status!=='ACTIVE').length?'<div class="muted" style="font-size:12px">교체 전: '+escapeText(S.filter(x=>x.status!=='ACTIVE').map(x=>x.name).join(', '))+'</div>':'')
     +'<button class="button'+(cur?' ghost':'')+'" type="button" style="width:100%;margin-top:8px" onclick="smQrOpen(\''+escapeText(j.id)+'\')">'+(cur?'현장관리자 바꾸기 (새 지정 QR)':'📱 현장관리자 지정 QR 보여주기')+'</button></div></div>'}).join('')
   :'<p class="muted">아직 배정된 오픈 매장이 없습니다. 계약담당자가 오픈 매장에 배정하면 여기에 나옵니다. (끝난 오픈 매장은 보이지 않습니다)</p>')+'</div>'
  +'<div class="card"><h2>첫날 할 일</h2><ol class="desc" style="padding-left:18px;margin:6px 0">'
  +'<li>현장에서 근로계약서 작성 (앱 밖)</li><li>대표 근로자를 <b>현장관리자</b>로 지정: 위 [현장관리자 지정 QR]을 그 사람 휴대폰 카메라로 찍게 합니다 → <b>현장관리자 안내문</b> 전달</li>'
  +'<li>협의체 · 합동점검 참석: 도급인이 보여 주는 <b>QR을 휴대폰 카메라로</b> 찍으면 인력관리자로 바로 참석 기록</li></ol>'
  +'<p class="muted" style="margin:6px 0 0">현장관리자가 매일 TBM 사진 · 신규 근로자 등록 · 지적사항 조치를 합니다. 지정하면 계약담당자 <b>인력 명부</b>에 자동으로 기록됩니다.</p></div>'}
let mgrHomeData=null;
/** F2.3 [인력관리자] 현장관리자 지정 QR (쓰지 않은 QR이 있으면 그대로 · 없으면 새로) */
async function smQrOpen(jobId,fresh){const j=((mgrHomeData&&mgrHomeData.jobs)||[]).find(x=>x.id===jobId);if(!j)return;
 let iv=!fresh&&j.invite;if(!iv){try{iv=await call('smInvite',jobId);j.invite=iv}catch(e){return}}
 const el=$('my');el.innerHTML='<div class="card row" style="justify-content:space-between"><button class="button ghost" type="button" onclick="renderMgrHome()">‹ 이전으로</button><button class="button ghost" type="button" onclick="smFlyer(\''+escapeText(jobId)+'\')">📄 현장관리자 안내문</button></div>'
  +'<div class="card" style="text-align:center"><small class="muted">'+escapeText(j.company)+' · 다이소 '+escapeText(j.storeName)+'</small><h2>현장관리자 지정 QR</h2>'
  +'<p class="desc">대표 근로자의 <b>휴대폰 카메라</b>로 이 QR을 찍게 해 주세요.<br>본인 Google 계정으로 로그인 → 이름 · 안전 수칙 서약 → <b>현장관리자</b>로 등록됩니다.</p>'
  +'<img src="'+escapeText(mgrQr(iv.link))+'" alt="현장관리자 지정 QR 코드" width="240" height="240" style="border:1px solid var(--line);border-radius:12px">'
  +'<div class="muted" style="word-break:break-all;font-size:12px;margin-top:6px">'+escapeText(iv.link)+'</div>'
  +'<div class="row" style="justify-content:center;gap:6px;margin-top:8px"><button class="button ghost" type="button" style="padding:6px 10px;font-size:13px" onclick="copyLink(\''+escapeText(iv.link)+'\')">링크 복사</button><button class="button ghost" type="button" style="padding:6px 10px;font-size:13px" onclick="smQrOpen(\''+escapeText(jobId)+'\',true)">QR 새로 만들기</button></div>'
  +'<p class="muted" style="margin-top:8px">QR 1개 = 1명 · '+escapeText(mgrHM(iv.expAt))+'까지 · 이미 지정된 사람이 있으면 새로 등록한 사람으로 바뀝니다 (전 사람은 명부에 남음)</p>'
  +'<button class="button" type="button" style="width:100%;margin-top:6px" onclick="smQrCheck(\''+escapeText(jobId)+'\')">등록했는지 확인</button></div>';window.scrollTo(0,0)}
async function smQrCheck(jobId){try{const d=await callQuiet('mgrHome');mgrHomeData=d;const j=d.jobs.find(x=>x.id===jobId),cur=j&&(j.siteMgrs||[]).find(x=>x.status==='ACTIVE');
 if(cur&&!j.invite){msg(cur.name+' 님이 현장관리자로 등록됐습니다.');renderMgrHome()}else msg('아직 등록 전입니다. 등록이 끝나면 다시 눌러 주세요.')}catch(e){}}
/** F2.3 현장관리자 안내문 (A4 1장 · 인쇄 · PDF) */
function smFlyer(jobId){const j=((mgrHomeData&&mgrHomeData.jobs)||[]).find(x=>x.id===jobId)||{},cur=(j.siteMgrs||[]).find(x=>x.status==='ACTIVE');
 const st='border:1px solid #CBD5E1;padding:10px 12px;font-size:14px;line-height:1.6;vertical-align:top';
 $('my').innerHTML='<div class="card row" style="justify-content:space-between"><button class="button ghost" type="button" onclick="smQrOpen(\''+escapeText(jobId)+'\')">‹ 이전으로</button><button class="button" type="button" onclick="printA4(\'smSheet\',\'현장관리자 안내\')">🖨 인쇄 · PDF</button></div>'
  +'<div class="card sheet" style="overflow-x:auto"><div id="smSheet" style="font-family:\'Malgun Gothic\',sans-serif;color:#111827">'
  +'<div style="border-top:6px solid #CE2A4B;padding-top:10px"><div style="font-size:12px;color:#4B5563">(주)아성다이소 · 도급 안전관리 · 오픈지원</div><h1 style="font-size:24px;margin:4px 0 2px">현장관리자 안내</h1><div style="font-size:15px"><b>'+escapeText(j.company||'')+'</b> · 다이소 '+escapeText(j.storeName||'')+' · '+escapeText(j.startDate||'')+' ~ '+escapeText(j.endDate||'')+(cur?' · 현장관리자 <b>'+escapeText(cur.name)+'</b>':'')+'</div></div>'
  +'<table style="width:100%;border-collapse:collapse;margin-top:14px"><tr><td style="'+st+'"><b style="font-size:15px">현장관리자 = 관리감독자</b><p style="margin:4px 0 0">이 오픈 매장 동안 우리 근로자의 안전을 챙기는 대표 근로자입니다. 앱을 열면 <b>이 오픈 매장만</b> 보이고, 오픈 매장이 끝나면 사라집니다.</p></td></tr></table>'
  +'<table style="width:100%;border-collapse:collapse;margin-top:10px"><tr><td style="'+st+'"><b style="font-size:15px">매일 할 일</b><ol style="margin:6px 0 0;padding-left:20px">'
  +'<li><b>작업 시작 전 TBM</b> (안전 미팅) → 앱 [① 오늘 TBM]에 사진 1장 이상 저장</li>'
  +'<li><b>새로 온 근로자</b> → 앱 [② 신규자 등록]의 QR을 그 사람 휴대폰으로 찍게 함 (본인 서명)<br>휴대폰·Google 계정이 없으면 [직접 등록]: 안전 수칙을 설명하고 「관리자 확인」으로 등록</li>'
  +'<li><b>지적사항 조치</b> → 도급인 순회점검에서 지적이 나오면 앱 [③ 지적사항 조치]에서 조치 내용 · 조치 후 사진 등록 (그날 안에)</li></ol></td></tr></table>'
  +'<table style="width:100%;border-collapse:collapse;margin-top:10px"><tr><td style="'+st+'"><b style="font-size:15px">앱 여는 방법</b><p style="margin:4px 0 0">휴대폰 인터넷(크롬·사파리)에서 처음 등록할 때 쓴 주소를 열고 → <b>[협력업체]</b> → <b>지정 QR을 찍을 때 쓴 Google 계정</b>으로 로그인합니다. (홈 화면에 추가해 두면 편합니다)</p>'
  +'<p style="margin:6px 0 0;font-size:12.5px;color:#4B5563">· 비상대피 훈련은 도급인이 진행합니다. 근로자는 도급인이 보여 주는 QR로 참석만 체크합니다.<br>· 사고·위험 상황이면 즉시 작업을 멈추고 도급인 담당자 · 인력관리자에게 알립니다.</p></td></tr></table></div></div>';window.scrollTo(0,0)}

/* ---------- 계약담당자: ☰ 인력관리자 관리 ---------- */
async function renderVMgr(){const el=$('execArea');if(!el)return;$('pageTitle').textContent='인력관리자 관리';
 if(!mgrData)el.innerHTML='<div class="card"><h2>인력관리자 관리</h2><p class="desc">불러오는 중입니다…</p></div>';
 try{mgrData=await callQuiet('mgrBoard')}catch(e){el.innerHTML='<div class="card"><h2>인력관리자 관리</h2><p class="desc">'+escapeText(e.message||'불러오지 못했습니다.')+'</p><button class="button" type="button" onclick="renderVMgr()">다시 시도</button></div>';return}
 mgrDraw()}
function mgrDraw(){const el=$('execArea'),d=mgrData;if(!el||!d||vmenu!=='mgr')return;const act=d.mgrs.filter(m=>m.status==='ACTIVE'),nm=e=>(d.mgrs.find(m=>m.email===e)||{}).name||e;
 const noMgr=d.jobs.filter(j=>!j.mgrs.length).length;
 el.innerHTML='<div class="card"><h2 style="margin:0">인력관리자 관리</h2><p class="desc" style="margin-top:6px">인력관리자 = <b>안전관리책임자 대리</b>입니다. 오픈 매장 첫날 현장에 가서 현장관리자를 지정하고, 협의체·합동점검에 참석합니다.<br>연락처는 받지 않고 <b>Google 계정 · 이름</b>만 기록합니다.</p></div>'
  /* ① 초대 */
  +'<div class="card" id="mgInv"><h2>① 초대 링크로 등록 <span class="pill ok">추천</span></h2><p class="muted">링크(또는 QR)를 인력관리자에게 보내면, 본인 Google 계정으로 로그인해 이름만 적으면 등록됩니다. 링크 1개 = 1명 · '+d.days+'일 동안 유효</p>'
  +(mgrNew?mgrLinkBox(mgrNew,true):'')
  +'<button class="button" type="button" style="width:100%;margin-top:8px" onclick="mgrInvite()">＋ 새 초대 링크 만들기</button>'
  +(d.invites.filter(x=>x.link!==mgrNew).length?'<div class="stage">아직 안 쓴 초대 링크</div>'+d.invites.filter(x=>x.link!==mgrNew).map(x=>'<div class="item"><div class="row" style="justify-content:space-between"><span class="muted">'+escapeText(mgrDay(x.createdAt))+' 만듦 · '+escapeText(mgrDay(x.expAt))+'까지</span><span class="row" style="gap:6px"><button class="button ghost" type="button" style="padding:4px 8px;font-size:12px" onclick="mgrShow(\''+escapeText(x.link)+'\')">보기</button><button class="button ghost danger" type="button" style="padding:4px 8px;font-size:12px" onclick="mgrInviteCancel(\''+escapeText(x.token)+'\')">취소</button></span></div></div>').join(''):'')+'</div>'
  /* ② 직접 입력 */
  +'<div class="card"><h2>② 직접 입력</h2><p class="muted">링크를 보내기 어려우면 이름과 Google 계정(Gmail)을 직접 적습니다. 그 사람이 이 Gmail로 로그인하면 바로 인력관리자 화면이 열립니다.</p>'
  +'<form onsubmit="mgrAddForm(event)"><div class="split">'+input('mgName','이름','','text',false,'홍길동')+input('mgMail','Google 계정 (Gmail)','','email',false,'hong123@gmail.com')+'</div><button class="button ghost" type="submit" style="width:100%;margin-top:6px">직접 등록</button></form></div>'
  /* ③ 명단 */
  +'<div class="card"><h2>③ 인력관리자 명단 <span class="cnt">'+act.length+'</span></h2>'
  +(d.mgrs.length?d.mgrs.map(m=>'<div class="item"'+(m.status==='ACTIVE'?'':' style="opacity:.6"')+'><div class="row" style="justify-content:space-between"><div><b>'+escapeText(m.name)+'</b> <span class="pill '+(m.status==='ACTIVE'?'ok':'lock')+'">'+(m.status==='ACTIVE'?'사용 중':'사용 중지')+'</span>'
   +'<div class="muted" style="word-break:break-all">'+escapeText(m.email)+' · '+(m.method==='INVITE'?'초대 링크':'직접 입력')+(m.method==='MANUAL'&&!m.joinedAt?' · 아직 로그인 전':'')+' · 배정 '+m.jobs.length+'건</div></div>'
   +(m.status==='ACTIVE'?'<button class="button ghost danger" type="button" style="padding:4px 8px;font-size:12px" onclick="mgrSet(\''+escapeText(m.email)+'\',false)">사용 중지</button>':'<button class="button ghost" type="button" style="padding:4px 8px;font-size:12px" onclick="mgrSet(\''+escapeText(m.email)+'\',true)">다시 사용</button>')+'</div></div>').join('')
   :'<p class="muted">아직 등록한 인력관리자가 없습니다. 위 ① 또는 ②로 등록해 주세요.</p>')+'</div>'
  /* ④ 오픈 매장 배정 */
  +'<div class="card" id="mgJobs"><h2>④ 오픈 매장 배정 '+(noMgr?'<span class="pill bad">미배정 '+noMgr+'</span>':'')+'</h2><p class="muted">도급인이 만든 진행 중 오픈 매장입니다. 매장마다 갈 인력관리자를 체크하고 [저장]을 누르세요. 끝난 오픈 매장은 자동으로 빠집니다.</p>'
  +(d.jobs.length?d.jobs.map(j=>'<div class="item"><b>'+escapeText(j.title)+'</b><div class="muted">'+escapeText(j.storeName)+' · '+escapeText(j.startDate)+' ~ '+escapeText(j.endDate||'')+' · 도급인 '+escapeText(j.hostName||'')+'</div>'
   +(act.length||j.mgrs.length?'<div style="margin:6px 0">'+act.map(m=>'<label class="desc" style="display:inline-flex;align-items:center;gap:4px;margin:2px 10px 2px 0"><input type="checkbox" class="mgck" data-job="'+escapeText(j.id)+'" value="'+escapeText(m.email)+'" '+(j.mgrs.includes(m.email)?'checked':'')+'> '+escapeText(m.name)+'</label>').join('')
    +j.mgrs.filter(e=>!act.some(m=>m.email===e)).map(e=>'<span class="pill lock" style="margin-right:6px">'+escapeText(nm(e))+' (사용 중지)</span>').join('')+'</div>'
    +'<div class="row" style="justify-content:space-between"><span class="muted">'+(j.mgrs.length?'배정: '+escapeText(j.mgrs.map(nm).join(', ')):'<span class="req">아직 배정 안 됨</span>')+'</span><button class="button" type="button" style="padding:6px 12px;font-size:13px" onclick="mgrAssign(\''+escapeText(j.id)+'\')">저장</button></div>'
    :'<p class="muted">먼저 인력관리자를 등록해 주세요.</p>')+'</div>').join('')
   :'<p class="muted">진행 중인 오픈 매장이 없습니다. 도급인이 오픈 매장을 만들고 업체를 배정하면 여기에 나옵니다.</p>')+'</div>'
  /* ⑤ F2.3 인력 명부 (현장관리자 지정 때 자동 기록 · 연락처 없음) */
  +'<div class="card" id="mgRoster"><h2>⑤ 인력 명부 · 현장관리자 <span class="cnt">'+(d.roster||[]).length+'</span></h2><p class="muted">인력관리자가 현장관리자를 지정하면 자동으로 기록됩니다. (Google 계정 · 이름 · 매장 · 기간 · 지정 일시 · 지정한 사람)</p>'
  +((d.roster||[]).length?'<div style="overflow-x:auto"><table class="rtable" style="min-width:420px"><tr><th>이름 · 계정</th><th>매장 · 기간</th><th>지정</th></tr>'+d.roster.map(r=>'<tr'+(r.status==='ACTIVE'?'':' style="opacity:.6"')+'><td><b>'+escapeText(r.name)+'</b>'+(r.status==='ACTIVE'?'':' <span class="pill lock">교체됨</span>')+'<div class="muted" style="font-size:11px;word-break:break-all">'+escapeText(r.email)+'</div></td>'
    +'<td>'+escapeText(r.storeName)+'<div class="muted" style="font-size:11px">'+escapeText(String(r.startDate).slice(5))+' ~ '+escapeText(String(r.endDate).slice(5))+'</div></td><td><span style="font-size:12px">'+escapeText(mgrHM(r.designatedAt))+'</span><div class="muted" style="font-size:11px">'+escapeText(r.designatedName||r.designatedBy)+'</div></td></tr>').join('')+'</table></div>'
   :'<p class="muted">아직 지정된 현장관리자가 없습니다.</p>')+'</div>'}
/** 초대 링크 · QR · [복사] [안내문] */
function mgrLinkBox(link,fresh){return '<div class="subbox" style="text-align:center;margin-top:8px">'+(fresh?'<b style="color:var(--ok)">✔ 새 초대 링크를 만들었습니다</b>':'')+'<div style="margin:8px 0"><img src="'+escapeText(mgrQr(link))+'" alt="인력관리자 초대 QR 코드" width="200" height="200" style="border:1px solid var(--line);border-radius:12px"></div>'
 +'<div class="muted" style="word-break:break-all;font-size:12px">'+escapeText(link)+'</div><div class="row" style="justify-content:center;margin-top:8px;gap:6px"><button class="button ghost" type="button" style="padding:6px 10px;font-size:13px" onclick="copyLink(\''+escapeText(link)+'\')">링크 복사</button><button class="button" type="button" style="padding:6px 10px;font-size:13px" onclick="mgrFlyer(\''+escapeText(link)+'\')">📄 안내문 보기 · 인쇄</button></div>'
 +'<p class="muted" style="margin:8px 0 0;font-size:12px">카카오톡·문자로 링크를 보내거나, 안내문을 인쇄해 전달하세요.</p></div>'}
function mgrShow(link){mgrNew=link;mgrDraw();$('mgInv')?.scrollIntoView({block:'start'})}
async function mgrInvite(){try{mgrData=await call('mgrInvite');mgrNew=mgrData.newLink||'';mgrDraw();$('mgInv')?.scrollIntoView({block:'start'})}catch(e){}}
async function mgrInviteCancel(token){if(!confirm('이 초대 링크를 취소할까요? 취소하면 이 링크로는 등록할 수 없습니다.'))return;try{mgrData=await call('mgrInviteCancel',token);if(mgrNew&&mgrNew.endsWith(token))mgrNew='';mgrDraw();msg('초대 링크를 취소했습니다.')}catch(e){}}
async function mgrAddForm(e){e.preventDefault();const n=value('mgName'),m=value('mgMail').toLowerCase();const miss=[];if(!n)miss.push({key:'mgName'});if(!m)miss.push({key:'mgMail'});if(miss.length){markMissing(miss);return}
 try{mgrData=await call('mgrAdd',n,m);mgrNew='';mgrDraw();msg(n+' 님을 인력관리자로 등록했습니다.')}catch(err){}}
async function mgrSet(email,on){const m=(mgrData.mgrs||[]).find(x=>x.email===email)||{};
 if(!on&&!confirm((m.name||email)+' 님을 사용 중지할까요?\n\n· 배정된 오픈 매장이 그 사람 화면에서 보이지 않습니다\n· 기록은 지워지지 않고, [다시 사용]으로 되돌릴 수 있습니다'))return;
 try{mgrData=await call('mgrSetStatus',email,on);mgrDraw();msg((m.name||email)+' 님을 '+(on?'다시 사용합니다.':'사용 중지했습니다.'))}catch(e){}}
async function mgrAssign(jobId){const em=[...document.querySelectorAll('.mgck')].filter(c=>c.dataset.job===jobId&&c.checked).map(c=>c.value);
 if(!em.length&&!confirm('인력관리자를 한 명도 체크하지 않았습니다. 이 오픈 매장의 배정을 모두 뺄까요?'))return;
 try{mgrData=await call('mgrAssign',jobId,em);vjobsAt=0;mgrDraw();msg(em.length?'배정을 저장했습니다.':'배정을 뺐습니다.')}catch(e){}}
/** 인력관리자 안내문 (A4 1장 · 인쇄 · PDF) */
function mgrFlyer(link){const d=mgrData||{},co=d.company||'';clearInterval(wkTimer);
 const st='border:1px solid #CBD5E1;padding:10px 12px;font-size:14px;line-height:1.6;vertical-align:top';
 $('execArea').innerHTML='<div class="card row" style="justify-content:space-between"><button class="button ghost" type="button" onclick="mgrDraw()">‹ 이전으로</button><button class="button" type="button" onclick="printA4(\'mgSheet\',\'인력관리자 등록 안내\')">🖨 인쇄 · PDF</button></div>'
  +'<div class="card sheet" style="overflow-x:auto"><div id="mgSheet" style="font-family:\'Malgun Gothic\',sans-serif;color:#111827">'
  +'<div style="border-top:6px solid #CE2A4B;padding-top:10px"><div style="font-size:12px;color:#4B5563">(주)아성다이소 · 도급 안전관리 · 오픈지원</div><h1 style="font-size:24px;margin:4px 0 2px">인력관리자 등록 안내</h1><div style="font-size:15px"><b>'+escapeText(co)+'</b> 인력관리자(안전관리책임자 대리)</div></div>'
  +'<table style="width:100%;border-collapse:collapse;margin-top:14px"><tr><td style="'+st+';width:58%">'
  +'<b style="font-size:15px">등록 방법 (처음 한 번만)</b><ol style="margin:6px 0 0;padding-left:20px"><li>휴대폰 카메라로 오른쪽 <b>QR</b>을 찍거나 아래 링크를 엽니다</li><li><b>본인 Google 계정(Gmail)</b>으로 로그인합니다 (접속 구분: 협력업체)</li><li><b>이름</b>을 적고 [인력관리자로 등록]을 누릅니다</li><li>계약담당자가 배정한 <b>오픈 매장</b>이 화면에 나옵니다</li></ol>'
  +'<p style="margin:8px 0 0;font-size:12.5px;color:#4B5563">· 이 링크는 <b>1명이 1번</b>만 쓸 수 있습니다 · '+escapeText(String(d.days||7))+'일 안에 등록해 주세요<br>· 연락처는 받지 않습니다 (Google 계정 · 이름만 기록)</p></td>'
  +'<td style="'+st+';text-align:center"><img src="'+escapeText(mgrQr(link))+'" alt="인력관리자 초대 QR" width="190" height="190"><div style="font-size:10.5px;color:#4B5563;word-break:break-all;margin-top:4px">'+escapeText(link)+'</div></td></tr></table>'
  +'<table style="width:100%;border-collapse:collapse;margin-top:12px"><tr><td style="'+st+'"><b style="font-size:15px">인력관리자가 하는 일</b><ul style="margin:6px 0 0;padding-left:20px">'
  +'<li>오픈 매장 <b>첫날</b> 현장 방문 · 근로계약서 작성 (앱 밖)</li><li>대표 근로자를 <b>현장관리자</b>로 지정 (앱의 지정 QR) · 현장관리자 안내문 전달</li>'
  +'<li><b>협의체 · 합동점검</b> 참석 (도급인이 보여 주는 QR을 찍으면 참석 기록)</li><li>합동점검 <b>지적사항 조치</b> (그날 못 하면 현장관리자가 조치)</li></ul></td></tr></table>'
  +'<p style="font-size:12px;color:#4B5563;margin-top:10px">카카오톡 등 앱 안에서 링크가 열려 로그인이 안 되면, 오른쪽 위 메뉴에서 [다른 브라우저로 열기](크롬·사파리)를 눌러 주세요.</p></div></div>';window.scrollTo(0,0)}
