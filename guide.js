/* =====================================================================
 * F1.8a 화면 따라가기 사용 가이드 (협력업체 · 오늘 현장 업무)
 *  실제 화면을 어둡게 하고 눌러야 할 버튼만 밝게 + 👆 손가락 + 말풍선 · 4초마다 저절로 다음 (영상처럼)
 *  [◀ 이전] [⏸ 멈춤] [다음 ▶] [✕ 끝내기] · 안내 중에는 화면이 눌리지 않음 (보기 전용)
 *  작업허가서·순회점검은 그 화면을 열어서 안까지 보여 주고, 끝나면 원래 화면으로 돌아옴 (아무것도 저장하지 않음)
 * ===================================================================== */
const TOUR_STEPS={
 reg:[
  {scr:'today',sel:'#regCard',text:'처음 온 작업자는 여기서 한 번만 등록합니다. 다음 날부터는 다시 등록하지 않아도 됩니다.'},
  {scr:'today',sel:'#btnQr',tap:1,text:'작업자가 구글 계정(휴대폰)이 있으면 [QR 보여주기]를 누르세요. 화면에 QR이 나옵니다.'},
  {scr:'today',sel:'#btnQr',text:'작업자가 자기 휴대폰 카메라로 QR을 찍고 → 본인 구글 계정으로 로그인 → 이름 적고 → 기초안전보건교육 이수증 사진을 찍고 → 안전 수칙을 읽고 서명하면 끝입니다.'},
  {scr:'today',sel:'#btnAdd',tap:1,text:'휴대폰·구글 계정이 없는 사람은 [직접 등록]을 눌러 소장님이 대신 등록합니다. 이수증 사진도 같이 올리고, 수칙 교육 확인에 체크합니다.'},
  {scr:'today',sel:'#regToday',text:'이수증을 안 가져온 사람은 [📷 올리기]로 표시되고 업체 평가에 반영됩니다. 나중에 가져오면 ☰ 메뉴 [신규교육 현황]에서 올릴 수 있습니다.'},
  {scr:'today',sel:'#btnNoNew',tap:1,text:'새로 온 사람이 없는 날은 [오늘 신규자 없음]을 누르면 이 칸이 완료로 표시됩니다.'},
  {scr:'today',sel:'#regToday',text:'오늘 등록한 사람이 이 표에 나옵니다. 등록할 때 신규자 교육일지와 작업 안전 수칙 서명이 같이 만들어집니다 (처음 1회).'}],
 permit:[
  {scr:'today',sel:'#btnPermit',tap:1,text:'작업 전에 [오늘 작업허가서 작성]을 누르세요. (이미 발행했으면 [진행 기록])'},
  {scr:'permit',sel:'#pf_work',text:'① 작업명과 작업 장소를 적습니다. 시간은 08:00~17:00이 기본입니다. 어제 허가서가 있으면 미리 채워져 있습니다.'},
  {scr:'permit',sel:'#pfTypes',tap:1,text:'② 오늘 하는 위험작업 버튼을 모두 누르세요. (화기·고소·정전 등) 없으면 누르지 않고 넘어갑니다.'},
  {scr:'permit',sel:'#pfAll',tap:1,text:'③ 작업 전에 안전조치를 했으면 [모두 조치함]을 누르세요. 고른 위험작업에 필요한 조치만 나옵니다.'},
  {scr:'permit',sel:'#pfIssue',tap:1,text:'④ 현장책임자 이름을 확인하고 [발행]을 누르면 바로 작업할 수 있습니다.'},
  {scr:'permit',sel:'#pfPrev',tap:1,text:'[결과지 미리보기]를 누르면 작업허가서 양식으로 어떻게 나오는지 볼 수 있습니다.'},
  {scr:'permit',sel:'#pgDur',tap:1,text:'발행한 뒤에는: 작업 중 현장을 둘러볼 때마다 [지금 확인 기록]을 누릅니다.'},
  {scr:'permit',sel:'#pgDoneBtn',tap:1,text:'작업이 끝나면 [지금 완료]를 누르고'},
  {scr:'permit',sel:'#pgSave',tap:1,text:'[저장]을 누르면 오늘 작업허가서가 마무리됩니다.'}],
 insp:[
  {scr:'today',sel:'#btnInsp',alt:'#inspCard',tap:1,text:'순회점검은 매일 합니다. [오늘 순회점검 작성]을 누르세요.'},
  {scr:'insp0',sel:'#tbmCard',tap:1,text:'먼저 TBM(작업 전 안전 미팅) 사진을 📷 찍어서 올립니다.'},
  {scr:'insp',sel:'#drillCard',tap:1,text:'오늘 비상대피·CPR·소화기 훈련이나 안전교육을 했으면 종류를 고르고 사진을 올립니다. 안 한 날은 그냥 넘어가면 됩니다. (업체 평가 비상대책에 반영)'},
  {scr:'insp',sel:'#inItems',text:'사진이 올라가면 점검표가 열립니다. 우리 업체 계획서 위험성평가에 맞춘 항목이 나옵니다.'},
  {scr:'insp',sel:'#ii_1 .jm',tap:1,text:'전 항목이 [양호]로 미리 체크되어 있습니다. 문제가 있는 항목만 [불량]을 누르고 사진과 내용을 적으세요.'},
  {scr:'insp',sel:'#inSubmit',tap:1,text:'점검자 이름을 확인하고 [순회점검 제출]을 누르면 끝입니다.'}]};
TOUR_STEPS.day=[{scr:'today',sel:'#gdDay',text:'오늘 현장 업무 사용 가이드입니다. 위에서부터 ① 신규자 등록 → ② 작업허가서 → ③ 순회점검 순서로 하면 됩니다.'}]
 .concat(TOUR_STEPS.reg,TOUR_STEPS.permit.filter(s=>!/^#pg/.test(s.sel)),TOUR_STEPS.insp,[{scr:'today',sel:'#gdDay',text:'끝! 모를 때는 각 칸의 [❔ 사용 가이드]를 누르면 그 부분만 다시 볼 수 있습니다.'}]);
let tour=null;
function tourCss(){if($('tourCss'))return;const s=document.createElement('style');s.id='tourCss';s.textContent=
 '#tourMask{position:fixed;inset:0;z-index:85;background:transparent}'
 +'#tourHole{position:fixed;z-index:86;border-radius:12px;box-shadow:0 0 0 9999px rgba(15,23,42,.62);outline:3px solid #facc15;transition:all .35s ease;pointer-events:none}'
 +'#tourHand{position:fixed;z-index:88;font-size:38px;pointer-events:none;transition:left .35s,top .35s;filter:drop-shadow(0 3px 4px #0006)}'
 +'#tourHand.tap{animation:tourTap 1s ease-in-out infinite}@keyframes tourTap{0%,100%{transform:translate(0,0) scale(1)}45%{transform:translate(-4px,-10px) scale(.9)}}'
 +'#tourBox{position:fixed;z-index:89;left:12px;right:12px;max-width:440px;margin:0 auto;background:#fff;border-radius:14px;padding:14px;box-shadow:0 10px 30px #0005;transition:top .35s}'
 +'#tourBox p{margin:0 0 10px;font-size:15px;line-height:1.55}#tourBox .tbar{display:flex;gap:6px;align-items:center}#tourBox .tbar button{padding:8px 10px;font-size:13px}'
 +'#tourBox .tprog{height:4px;background:#e5e7eb;border-radius:4px;margin:0 0 10px;overflow:hidden}#tourBox .tprog span{display:block;height:100%;background:#facc15;transition:width .3s}'
 +'.touring .doneMask{display:none!important}'
 +'@media (prefers-reduced-motion:reduce){#tourHole,#tourHand,#tourBox{transition:none}#tourHand.tap{animation:none}}';document.head.appendChild(s)}
/** 사용 가이드 시작 (kind: day | reg | permit | insp) */
function startTour(kind){if(!vjob||!TOUR_STEPS[kind])return;endTour(true);tourCss();document.body.classList.add('touring');  // 안내 중에는 '오늘 완료' 막을 잠시 숨김
 const mk=(id,tag)=>{const e=document.createElement(tag||'div');e.id=id;document.body.appendChild(e);return e};
 const mask=mk('tourMask');mask.onclick=()=>tourGo(1);mk('tourHole');const hand=mk('tourHand');hand.textContent='👆';hand.setAttribute('aria-hidden','true');
 const box=mk('tourBox');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','사용 가이드');
 tour={kind,steps:TOUR_STEPS[kind],i:-1,play:true,timer:0,dir:1,demo:false,busy:false};
 tour.key=e=>{if(e.key==='Escape')endTour();else if(e.key==='ArrowRight')tourGo(1);else if(e.key==='ArrowLeft')tourGo(-1)};document.addEventListener('keydown',tour.key);
 tour.pos=()=>tourPlace();window.addEventListener('resize',tour.pos);window.addEventListener('scroll',tour.pos,true);
 tourGo(1)}
/** 지금 화면: today | permit(허가서 화면) | insp0(점검 작성 · 사진 전) | insp(점검 작성 · 점검표 열림) */
function tourScreen(){const ps=$('psheet');if(ps&&!ps.hidden&&ps.innerHTML)return 'permit';if($('tbmCard'))return $('inItems')?'insp':'insp0';return 'today'}
/** 단계에 맞는 화면으로 이동 (안내용 · 아무것도 저장하지 않음) */
async function tourScreenTo(scr){const cur=tourScreen();if(cur===scr)return;
 if(cur==='permit'){hideSheet();pm=null}
 if(cur!=='today'||scr==='today'){if(tour&&tour.demo){ins=null;tour.demo=false}renderVJob()}
 if(scr==='permit'){await openPermit(vjob.today)}
 else if(scr==='insp0'||scr==='insp'){if(vjob.insp&&vjob.insp.todayDone)return;  // 오늘 점검을 이미 냈으면 작성 화면 없음
  if(cur==='today'||!ins){openInspForm();tour.demo=true}  // 안내용 빈 점검표 (끝나면 버림)
  if(scr==='insp'&&!ins.tbm.length){ins.tbm=['__tour'];renderInspForm()}else if(scr==='insp0'&&ins.tbm.includes('__tour')){ins.tbm=[];renderInspForm()}}}
async function tourGo(d){if(!tour||tour.busy)return;clearTimeout(tour.timer);tour.dir=d;tour.busy=true;
 try{let i=tour.i;for(;;){i+=d;if(i<0){i=0;d=1}if(i>=tour.steps.length){tour.busy=false;endTour();return}
   const s=tour.steps[i];await tourScreenTo(s.scr);await new Promise(r=>setTimeout(r,120));
   const el=document.querySelector(s.sel)||(s.alt&&document.querySelector(s.alt));if(el&&el.getClientRects().length){tour.i=i;tour.el=el;break}}  // 지금 화면에 없는 버튼은 건너뜀
  tour.el.scrollIntoView({behavior:'smooth',block:'center'});await new Promise(r=>setTimeout(r,380));tourDraw()}
 finally{if(tour)tour.busy=false}
 if(tour&&tour.play)tour.timer=setTimeout(()=>tourGo(1),4500)}
function tourDraw(){if(!tour)return;const s=tour.steps[tour.i],n=tour.steps.length,box=$('tourBox');
 box.innerHTML='<div class="tprog"><span style="width:'+Math.round((tour.i+1)/n*100)+'%"></span></div><p aria-live="polite">'+escapeText(s.text)+'</p>'
  +'<div class="tbar"><span class="muted" style="flex:1;font-size:12px">'+(tour.i+1)+' / '+n+'</span><button class="button ghost" type="button" onclick="tourGo(-1)" '+(tour.i?'':'disabled')+' aria-label="이전">◀ 이전</button>'
  +'<button class="button ghost" type="button" onclick="tourPlay()" aria-label="'+(tour.play?'멈춤':'자동 재생')+'">'+(tour.play?'⏸':'▶')+'</button><button class="button" type="button" id="tourNext" onclick="tourGo(1)">'+(tour.i===n-1?'끝':'다음 ▶')+'</button><button class="button ghost" type="button" onclick="endTour()" aria-label="가이드 끝내기">✕</button></div>';
 $('tourHand').className=s.tap?'tap':'';$('tourHand').style.display=s.tap?'block':'none';tourPlace();setTimeout(()=>$('tourNext')?.focus({preventScroll:true}),50)}
function tourPlace(){if(!tour||!tour.el)return;if(!tour.el.isConnected){const s=tour.steps[tour.i],e=document.querySelector(s.sel)||(s.alt&&document.querySelector(s.alt));if(!e)return;tour.el=e}  // 화면이 새로 그려졌으면 다시 찾음
 const r=tour.el.getBoundingClientRect(),p=6,h=$('tourHole'),hd=$('tourHand'),box=$('tourBox'),vh=window.innerHeight;
 h.style.left=(r.left-p)+'px';h.style.top=(r.top-p)+'px';h.style.width=(r.width+p*2)+'px';h.style.height=(Math.min(r.height,vh*0.6)+p*2)+'px';
 hd.style.left=(r.left+Math.min(r.width/2,140)-12)+'px';hd.style.top=(r.top+Math.min(r.height,vh*0.6)/2)+'px';
 const bh=box.offsetHeight||150,below=r.top+Math.min(r.height,vh*0.6)+p+14;box.style.top=(below+bh<vh-8?below:Math.max(8,r.top-p-bh-14))+'px'}
function tourPlay(){if(!tour)return;tour.play=!tour.play;clearTimeout(tour.timer);if(tour.play)tour.timer=setTimeout(()=>tourGo(1),1500);tourDraw()}
/** 가이드 끝: 열어 둔 허가서·점검 화면을 닫고 오늘 현장 업무 화면으로 (아무것도 저장 안 함) */
function endTour(quiet){if(!tour)return;const t=tour;clearTimeout(t.timer);document.removeEventListener('keydown',t.key);window.removeEventListener('resize',t.pos);window.removeEventListener('scroll',t.pos,true);
 ['tourMask','tourHole','tourHand','tourBox'].forEach(id=>$(id)?.remove());tour=null;document.body.classList.remove('touring');
 if(quiet)return;const scr=tourScreen();if(scr==='permit'){hideSheet();pm=null}if(scr!=='today'){if(t.demo)ins=null;renderVJob()}
 const back=$(t.kind==='day'?'gdDay':t.kind==='reg'?'gdReg':t.kind==='permit'?'gdPermit':'gdInsp');if(back){back.scrollIntoView({block:'center'});back.focus({preventScroll:true})}
 if(t.kind==='day')msg('모를 때는 각 칸의 [❔ 사용 가이드]를 눌러 보세요.')}
