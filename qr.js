/* 협의체 및 합동점검 참여 (v5.5) — 앱 안에서 QR 스캔
 *  카메라 앱을 따로 켜지 않고, 화면의 네모 칸에 현장 QR을 비추면 바로 참석 체크 화면으로 이동
 *  - 지원 브라우저(안드로이드 크롬 등): 내장 BarcodeDetector 사용
 *  - 그 외(아이폰 사파리 등): jsQR 1.4.0 (jsDelivr, 버전 고정)을 처음 한 번만 불러와 사용
 *  - 미팅 참석 QR(MEET-…)만 받음. 카메라를 못 쓰면 참여 링크 붙여넣기로도 가능 */
let qrStream=null,qrTimer=null,qrDet=null,MEET_TOKEN='';
const JSQR_URL='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
function renderVMeet(area,back){const el=$(area||'execArea');if(!el)return;
 el.innerHTML=(back?'<div class="card"><button class="button ghost" type="button" onclick="stopScan();'+back+'">← 돌아가기</button></div>':'')+gdRow('vmeet')+'<div class="card"><h2 style="margin:0">협의체 및 합동점검 참여</h2><p class="desc" style="margin-top:6px">현장에 있는 참석 QR을 아래 네모 칸에 비춰 주세요. 인식되면 바로 참석 체크 화면으로 넘어갑니다.</p>'
  +'<div class="qrbox" id="qrBox"><video id="qrVideo" playsinline muted aria-label="QR 스캔 카메라 화면"></video><div class="qrframe" aria-hidden="true"><i></i></div><div class="qrmsg" id="qrMsg">카메라를 켜는 중…</div></div>'
  +'<div class="row" style="margin-top:10px"><button class="button" type="button" style="flex:1" id="qrBtn" onclick="startScan()">카메라 다시 켜기</button></div>'
  +'<details class="hist" style="margin-top:12px"><summary>카메라가 안 되면 · 참여 링크 붙여넣기</summary><div class="plrow"><input id="f_qrLink" placeholder="담당자가 보내 준 참여 링크" aria-label="참여 링크"><button class="button ghost" type="button" onclick="qrUseLink()">참여</button></div></details></div>';
 startScan()}
async function startScan(){stopScan();const v=$('qrVideo'),m=$('qrMsg');if(!v)return;
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){m.textContent='이 브라우저는 카메라를 쓸 수 없습니다. 아래 참여 링크를 이용해 주세요.';return}
 try{qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});v.srcObject=qrStream;await v.play()}
 catch(e){m.textContent=/NotAllowed|Permission/.test(e.name||'')?'카메라 권한이 꺼져 있습니다. 브라우저 설정에서 카메라를 허용한 뒤 [카메라 다시 켜기]를 눌러 주세요.':'카메라를 켤 수 없습니다. 아래 참여 링크를 이용해 주세요.';return}
 m.textContent='QR을 네모 칸 안에 맞춰 주세요';
 let detect=null;
 if('BarcodeDetector' in window){try{const f=await BarcodeDetector.getSupportedFormats();if(f.includes('qr_code')){qrDet=qrDet||new BarcodeDetector({formats:['qr_code']});detect=async()=>{const r=await qrDet.detect(v);return r[0]&&r[0].rawValue}}}catch(e){}}
 if(!detect){try{await loadJsQR()}catch(e){m.textContent='QR 인식 기능을 불러오지 못했습니다. 아래 참여 링크를 이용해 주세요.';return}
  const c=document.createElement('canvas'),g=c.getContext('2d',{willReadFrequently:true});
  detect=async()=>{if(!v.videoWidth)return null;const s=Math.min(1,640/v.videoWidth);c.width=Math.round(v.videoWidth*s);c.height=Math.round(v.videoHeight*s);g.drawImage(v,0,0,c.width,c.height);const r=window.jsQR(g.getImageData(0,0,c.width,c.height).data,c.width,c.height,{inversionAttempts:'dontInvert'});return r&&r.data}}
 let busy=false;qrTimer=setInterval(async()=>{if(busy||!qrStream)return;busy=true;try{const t=await detect();if(t)qrFound(t)}catch(e){}busy=false},250)}
function loadJsQR(){if(window.jsQR)return Promise.resolve();return new Promise((ok,no)=>{const s=document.createElement('script');s.src=JSQR_URL;s.crossOrigin='anonymous';s.onload=()=>window.jsQR?ok():no();s.onerror=no;document.head.appendChild(s)})}
function stopScan(){clearInterval(qrTimer);qrTimer=null;if(qrStream){qrStream.getTracks().forEach(t=>t.stop());qrStream=null}}
/** QR 내용(또는 붙여넣은 링크)에서 미팅 참석값만 꺼냄 */
function meetTokenOf(text){const s=String(text||'').trim();let r='';try{r=new URL(s,location.href).searchParams.get('review')||''}catch(e){}if(!r)r=s;const m=/^MEET-([a-f0-9]{32})$/.exec(r);return m?m[1]:''}
function qrFound(text){const t=meetTokenOf(text);if(!t){$('qrMsg').textContent='협의체·합동점검 참석 QR이 아닙니다. 현장의 참석 QR을 비춰 주세요.';return}
 stopScan();if(navigator.vibrate)navigator.vibrate(80);$('qrMsg').textContent='인식했습니다. 참석 화면으로 이동합니다…';MEET_TOKEN=t;$('pageTitle').textContent='참석 체크';meetCheckIn()}
function qrUseLink(){const t=meetTokenOf(value('qrLink'));if(!t){markMissing([{key:'qrLink'}]);msg('참여 링크가 올바르지 않습니다.');return}stopScan();MEET_TOKEN=t;meetCheckIn()}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScan()});
