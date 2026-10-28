/* ---------- F1.9s [담당자] 📄 업체 안내문 (현장설명회 전 사전 준비 · A4 한 장) ----------
 *  담당자는 맨 위 「준비 기한 · 현장설명회」만 적음 → 담당자 이메일 · 이름 · 연락처는 조직도(직원 명단)에서 자동
 *  [이미지 저장] 휴대폰 = 앨범/다운로드 · PC = PNG 파일 / [카톡·문자로 보내기] 휴대폰 공유 창 / [PDF] 인쇄 창
 *  03_업체안내문/업체안내문_1장.html 과 같은 모양 (클래스 이름은 fy… 로 따로 · 다른 화면과 안 겹치게) */
let fyInfo=null,fyBusy=false;
const FY_KEY='flyerForm',FY_DAYS=['일','월','화','수','목','금','토'];
function fyForm(){let o={};try{o=JSON.parse(localStorage.getItem(FY_KEY)||'{}')}catch(e){}return o}
function fyCss(){if($('fyCss'))return;const s=document.createElement('style');s.id='fyCss';s.textContent=
 '.fyWrap{background:#cfd3da;border-radius:12px;padding:8px;overflow:hidden}.fyScale{transform-origin:0 0}'
 +'.fyPage{width:210mm;height:297mm;background:#fff;overflow:hidden;display:flex;flex-direction:column;font-family:"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo",sans-serif;color:#1f2937;box-sizing:border-box;line-height:1.45}'
 +'.fyPage *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
 +'.fyTop{background:#E60012;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:3mm 10mm}.fyTop b{font-family:"Arial Black",Arial,sans-serif;font-weight:900;letter-spacing:4px;font-size:15pt}.fyTop small{font-size:8.5pt}'
 +'.fyHd{background:#111827;color:#fff;padding:4mm 10mm;display:flex;gap:4.5mm;align-items:center}.fyHd img{width:15mm;height:15mm;border-radius:3.5mm;flex:none}.fyHd h1{margin:0;font-size:17pt;letter-spacing:-.5px;color:#fff}.fyHd p{margin:1mm 0 0;font-size:9.5pt;color:#d1d5db}'
 +'.fyBody{padding:4mm 10mm 0;flex:1;display:flex;flex-direction:column;gap:3.4mm}'
 +'.fyDue{border:2px solid #E60012;border-radius:3mm;display:flex;overflow:hidden}.fyDue .k{background:#E60012;color:#fff;font-weight:800;font-size:11pt;padding:2.6mm 4mm;display:flex;align-items:center;white-space:nowrap}.fyDue .v{padding:2.2mm 4mm;font-size:10pt;line-height:1.55}.fyDue .v b{font-size:12.5pt;color:#E60012}'
 +'.fySt{border:1px solid #e5e7eb;border-radius:3mm;padding:3.4mm 4mm}.fySt h2{margin:0 0 2.4mm;font-size:12.5pt;display:flex;align-items:center;gap:2mm;color:#1f2937}'
 +'.fySt h2 i{font-style:normal;background:#111827;color:#fff;border-radius:50%;width:6.5mm;height:6.5mm;display:inline-flex;align-items:center;justify-content:center;font-size:10pt;flex:none}.fySt.hot{border:2px solid #E60012;background:#fff8f8}.fySt.hot h2 i{background:#E60012}'
 +'.fyRow{display:flex;gap:3.4mm}.fyRow>.fySt{flex:1;min-width:0}'
 +'.fyQr{text-align:center}.fyQr img{width:46mm;height:46mm;display:block;margin:0 auto;border:1px solid #e5e7eb;border-radius:2mm}.fyUrl{font-family:Consolas,Menlo,monospace;font-size:10.5pt;font-weight:700;background:#f4f5f7;border-radius:1.5mm;padding:1.2mm 3mm;display:inline-block;margin:2.4mm 0 1mm}.fyCap{font-size:9pt;color:#6b7280}'
 +'.fyOs{border-radius:2.4mm;background:#f4f5f7;padding:2.6mm 3mm;margin-bottom:2.6mm}.fyOs b{font-size:10.5pt;display:block;margin-bottom:1.4mm}.fyFlow{display:flex;align-items:center;gap:1.4mm;flex-wrap:wrap;font-size:9.4pt}'
 +'.fyK{display:inline-block;border:1px solid #9ca3af;border-radius:1.4mm;padding:.5mm 2mm;background:#fff;white-space:nowrap;font-weight:700}.fyAr{color:#6b7280}.fyHome{display:flex;align-items:center;gap:2mm;margin-top:2mm;font-size:9pt;color:#6b7280}.fyHome img{width:9mm;height:9mm;border-radius:2mm}'
 +'.fyLg{display:flex;gap:5mm;align-items:center;padding:0 0 5mm 4mm}.fyPh{width:60mm;flex:none;border:2.2mm solid #1f2937;border-radius:7mm;background:#f4f5f7;padding:4mm 3mm;position:relative}'
 +'.fyLb{background:#fff;border:1px solid #e5e7eb;border-radius:3.5mm;padding:4.5mm 3.8mm 4mm}.fyLbr{display:flex;align-items:center;gap:1.6mm;font-size:8.5pt;font-weight:700;margin-bottom:3.6mm}.fyLbr i{width:2mm;height:2mm;border-radius:50%;background:#E60012}'
 +'.fyLb h4{margin:0 0 1mm;font-size:12pt}.fyLs{margin:0 0 3.2mm;font-size:7pt;color:#6b7280}.fySeg{display:flex;background:#f4f5f7;border-radius:2.4mm;padding:.8mm;margin:0 0 3.6mm}.fySeg span{flex:1;text-align:center;padding:1.8mm 1mm;border-radius:1.8mm;font-size:8pt;font-weight:600;color:#6b7280}.fySeg span.on{background:#fff;color:#111827;box-shadow:0 0 0 .7mm #E60012}'
 +'.fyG{display:flex;align-items:center;justify-content:center;gap:1.8mm;height:8.6mm;border:1px solid #dadce0;border-radius:4.3mm;background:#fff;color:#3c4043;font-size:8pt;font-weight:600;box-shadow:0 0 0 .7mm #E60012}'
 +'.fyPin{position:absolute;width:6mm;height:6mm;border-radius:50%;background:#E60012;color:#fff;font-weight:800;font-size:9.5pt;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 .8mm #fff}'
 +'.fyS3w{flex:1;min-width:0}.fyS3{display:flex;gap:2.4mm;align-items:flex-start;margin-bottom:2.8mm}.fyS3 b.n{flex:none;width:6mm;height:6mm;border-radius:50%;background:#E60012;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9.5pt}.fyS3 div{font-size:10.5pt;line-height:1.5}.fyS3 small{display:block;font-size:8.8pt;color:#6b7280}'
 +'.fyOnly{border:1.5px solid #111827;border-radius:2.4mm;padding:2.2mm 3mm;font-size:9.6pt;line-height:1.55}.fyOnly b{color:#E60012}'
 +'.fyMail{background:#fff;border:2px solid #111827;border-radius:2.4mm;padding:4mm 5mm}.fyMail .l{font-size:9.6pt;color:#6b7280}.fyMail .em{font-family:Consolas,Menlo,monospace;font-size:21pt;font-weight:700;color:#111827;margin:2mm 0;word-break:break-all}.fyMail .p{font-size:10.5pt}'
 +'.fyFt{margin-top:auto;border-top:1px solid #e5e7eb;padding:3mm 10mm 4mm;display:flex;justify-content:space-between;align-items:center;font-size:9pt;color:#374151}.fyFt b{color:#111827}'
 +'.fyGrid{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}.fyAuto{background:var(--bg);border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.7;margin-top:10px}.fyAuto b{display:inline-block;min-width:74px;color:var(--sub);font-weight:600}'
 +'.fyBtns{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.fyBtns .button{flex:1;min-width:140px}'
 +'@media(max-width:520px){.fyGrid{grid-template-columns:1fr}}';document.head.appendChild(s)}
/** 화면 */
function sFlyer(){jobsMode='flyer';fyCss();const f=fyForm();setTimeout(fyInit,0);
 return '<div class="card"><h2 style="margin:0">📄 업체 안내문</h2><p class="muted" style="margin:6px 0 0">현장설명회 전에 업체 소장에게 보내는 A4 한 장 안내문입니다. <b>준비 기한</b>만 적으면 담당자 이메일 · 이름 · 연락처는 조직도에서 자동으로 들어갑니다.</p>'
  +'<div class="fyGrid" style="margin-top:12px"><div class="field"><label for="f_fyDate">준비 기한 (날짜) <span class="req">*</span></label><input id="f_fyDate" type="date" value="'+escapeText(f.date||'')+'" oninput="fySave()"></div>'
  +'<div class="field"><label for="f_fyTime">시간 (선택)</label><input id="f_fyTime" type="time" step="1800" value="'+escapeText(f.time||'')+'" oninput="fySave()"></div></div>'
  +'<div class="field"><label for="f_fyPlace">현장설명회 일시 · 장소 (선택)</label><input id="f_fyPlace" type="text" maxlength="60" value="'+escapeText(f.place||'')+'" placeholder="예: 11. 12 (수) 14시 · 다이소 강남점" oninput="fySave()"></div>'
  +'<div class="fyAuto" id="fyAuto">담당자 정보를 불러오는 중…</div>'
  +'<div class="fyBtns" id="fyBtns"></div></div>'
  +'<div class="card" style="padding:10px"><div class="muted" style="margin:0 0 6px">미리보기 (이 모양 그대로 저장됩니다)</div><div class="fyWrap" id="fyWrap"><div class="fyScale" id="fyScale"></div></div></div>'}
async function fyInit(){try{fyInfo=await call('flyerInfo')}catch(e){fyInfo=fyInfo||{name:(state&&state.staff&&state.staff.name)||'',dept:'',title:'',phone:'',email:''}}fyDraw()}
function fySave(){const o={date:value('fyDate'),time:value('fyTime'),place:value('fyPlace')};try{localStorage.setItem(FY_KEY,JSON.stringify(o))}catch(e){}fyDraw()}
/** 화면 입력 → 안내문에 들어갈 글 */
function fyVals(){const f=fyForm(),i=fyInfo||{};let due='____. __. __ (__)';
 if(/^\d{4}-\d{2}-\d{2}$/.test(f.date||'')){const d=new Date(f.date+'T00:00:00');due=f.date.slice(0,4)+'. '+Number(f.date.slice(5,7))+'. '+Number(f.date.slice(8,10))+' ('+FY_DAYS[d.getDay()]+')'}
 if(/^\d{2}:\d{2}$/.test(f.time||'')){const h=Number(f.time.slice(0,2)),m=f.time.slice(3);due+=' '+h+'시'+(m!=='00'?' '+Number(m)+'분':'')}
 const who=[i.dept,i.name,i.title].filter(Boolean).join(' ');
 return {due,hasDate:!!f.date,place:f.place||'',email:i.email||'',who:who||'-',contact:'아성다이소 '+[who,i.phone].filter(Boolean).join(' · ')}}
/** 안내문 HTML (A4 · 03_업체안내문 과 같은 모양) */
function fyHtml(v,base){const B=base||'';
 return '<div class="fyPage"><div class="fyTop"><b>DAISO</b><small>아성다이소 · 협력업체 안전보건 관리</small></div>'
 +'<div class="fyHd"><img src="'+B+'icon-192.png" alt=""><div><h1>도급 안전관리 앱 · 사전 준비 안내</h1><p>현장설명회 전까지 휴대폰에 앱을 설치하고, 사업자 등록 신청까지 마치고 와 주세요. (10분 · 비용 없음)</p></div></div>'
 +'<div class="fyBody"><div class="fyDue"><div class="k">📅 준비 기한</div><div class="v"><b>'+escapeText(v.due)+'</b> 까지'+(v.place?'<br>현장설명회: '+escapeText(v.place):'')+'</div></div>'
 +'<div class="fyRow"><div class="fySt"><h2><i>1</i>QR 찍고 앱 열기</h2><div class="fyQr"><img src="'+B+'app-qr.png" alt="앱 주소 QR 코드"><div class="fyUrl">newjuna.github.io/Contract-Firebase</div><div class="fyCap">휴대폰 카메라로 찍거나, 위 주소를 주소창에 입력</div></div></div>'
 +'<div class="fySt"><h2><i>2</i>홈 화면에 추가 (앱처럼 쓰기)</h2><div class="fyOs"><b>🤖 안드로이드 · 크롬</b><div class="fyFlow"><span class="fyK">⋮</span><span class="fyAr">→</span><span class="fyK">홈 화면에 추가</span><span class="fyAr">또는</span><span class="fyK">앱 설치</span></div></div>'
 +'<div class="fyOs"><b>🍎 아이폰 · 꼭 Safari</b><div class="fyFlow"><span class="fyK">공유 ⬆</span><span class="fyAr">→</span><span class="fyK">홈 화면에 추가</span><span class="fyAr">→</span><span class="fyK">추가</span></div></div>'
 +'<div class="fyHome"><img src="'+B+'icon-192.png" alt=""><span>이 아이콘 <b style="color:#111827">「도급안전」</b>이 생기면 완료<br>카톡에서 열렸으면 「다른 브라우저로 열기」 먼저</span></div></div></div>'
 +'<div class="fySt"><h2><i>3</i>로그인 → 사업자 등록 신청</h2><div class="fyLg"><div class="fyPh"><div class="fyLb"><div class="fyLbr"><i></i>도급 안전관리</div><h4>로그인</h4><p class="fyLs">접속 구분을 고른 뒤 Google 계정으로 로그인하세요.</p><div class="fySeg"><span class="on">협력업체</span><span>다이소 담당자</span></div>'
 +'<div class="fyG"><svg viewBox="0 0 48 48" width="13" height="13" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>Google 계정으로 로그인</div></div>'
 +'<span class="fyPin" style="left:-4.6mm;top:33.5mm">1</span><span class="fyPin" style="left:-4.6mm;top:45mm">2</span><div style="position:absolute;left:0;right:0;bottom:-6.4mm;text-align:center;font-size:8pt;color:#6b7280">▲ 실제 앱 첫 화면</div></div>'
 +'<div class="fyS3w"><div class="fyS3"><b class="n">1</b><div><b>「협력업체」</b>를 누르기<small>「다이소 담당자」는 누르지 마세요</small></div></div><div class="fyS3"><b class="n">2</b><div><b>「Google 계정으로 로그인」</b><small>이 계정이 우리 업체 대표 계정이 됩니다 (현장대리인이 계속 쓸 계정)</small></div></div>'
 +'<div class="fyS3"><b class="n">3</b><div>첫 화면에서 <b>사업자 등록 신청</b><small>업체명 · 사업자번호 · 대표자 · 주소 · 현장대리인 · 업종 · (사업자등록증 사진)</small></div></div>'
 +'<div class="fyOnly">⚠ <b>Google 아이디(Gmail)로만</b> 로그인됩니다.<br>네이버 · 카카오 · 다음 계정은 안 됩니다. Gmail이 없으면 먼저 만들어 주세요. (무료)</div></div></div></div>'
 +'<div class="fySt hot"><h2><i>4</i>중요 · 다이소 담당자 이메일은 이렇게 적어 주세요</h2><div class="fyMail"><div class="l">사업자 등록 신청서의 「다이소 담당자 이메일」 칸에 그대로 적어 주세요</div><div class="em">'+escapeText(v.email||'(조직도에 회사메일 없음)')+'</div><div class="p">담당 <b>'+escapeText(v.who)+'</b></div></div></div></div>'
 +'<div class="fyFt"><span>문의 · <b>'+escapeText(v.contact)+'</b></span><span>아성다이소 도급 안전관리</span></div></div>'}
/** 미리보기 · 버튼 */
function fyDraw(){const v=fyVals(),i=fyInfo||{},el=$('fyScale');if(!el)return;
 $('fyAuto').innerHTML='<div><b>담당자 이메일</b>'+(i.email?escapeText(i.email):'<span class="req">없음 · 마스터에게 조직도 회사메일 입력을 요청하세요</span>')+'</div><div><b>담당</b>'+escapeText(v.who)+'</div><div><b>문의</b>'+escapeText(v.contact)+(i.phone?'':' <span class="muted">(연락처 없음 · 조직도에서 입력)</span>')+'</div><div class="muted" style="font-size:12px;margin-top:4px">자동으로 들어가는 정보입니다. 틀리면 👥 조직도에서 고치면 됩니다.</div>';
 const mob=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
 $('fyBtns').innerHTML='<button class="button" type="button" onclick="fyExport(\'save\')">💾 이미지 저장</button>'+(mob&&navigator.canShare?'<button class="button ghost" type="button" onclick="fyExport(\'share\')">📤 카톡 · 문자로 보내기</button>':'')+(mob?'':'<button class="button ghost" type="button" onclick="fyPdf()">🖨 PDF 저장</button>');
 el.innerHTML=fyHtml(v,'');fyFit()}
function fyFit(){const w=$('fyWrap'),s=$('fyScale'),p=s&&s.firstChild;if(!w||!p)return;const k=Math.min(1,(w.clientWidth-16)/p.offsetWidth);s.style.transform='scale('+k+')';s.style.width=p.offsetWidth+'px';w.style.height=(p.offsetHeight*k+16)+'px'}
window.addEventListener('resize',()=>{if(jobsMode==='flyer')fyFit()});
/** 이미지 만들기 (html2canvas · 처음 한 번만 받음) */
let fyLib=null;
function fyLoad(){return fyLib||(fyLib=new Promise((res,rej)=>{if(window.html2canvas)return res();const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';s.onload=()=>res();s.onerror=()=>{fyLib=null;rej(Error('이미지 도구를 받지 못했습니다. 인터넷 연결을 확인해 주세요.'))};document.head.appendChild(s)}))}
async function fyImage(){await fyLoad();const box=document.createElement('div');box.style.cssText='position:fixed;left:-10000px;top:0;z-index:-1';box.innerHTML=fyHtml(fyVals(),'');document.body.appendChild(box);
 try{await Promise.all([...box.querySelectorAll('img')].map(im=>im.complete?0:new Promise(r=>{im.onload=im.onerror=r})));
  const c=await window.html2canvas(box.firstChild,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});
  return await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(Error('이미지를 만들지 못했습니다.')),'image/png'))}finally{box.remove()}}
const fyName=()=>{const f=fyForm();return '다이소_업체안내문_'+((f.date||new Date(Date.now()+9*3600e3).toISOString().slice(0,10)).replace(/-/g,'').slice(2))+'.png'};
async function fyExport(mode){if(fyBusy)return;if(!fyForm().date){inspFlag(['f_fyDate'],'준비 기한 날짜를 먼저 골라 주세요');return}if(!(fyInfo&&fyInfo.email)&&!await askOk('담당자 이메일 없음','조직도에 회사메일이 없어 안내문 이메일 칸이 비어 있습니다.\n그래도 저장할까요?','저장'))return;
 fyBusy=true;msg('안내문 이미지를 만드는 중입니다…');let blob;try{blob=await fyImage()}catch(e){fyBusy=false;msg(e.message||'이미지를 만들지 못했습니다.');return}fyBusy=false;
 const file=new File([blob],fyName(),{type:'image/png'}),ios=/iPhone|iPad|iPod/i.test(navigator.userAgent),canShare=navigator.canShare&&navigator.canShare({files:[file]});
 /* 공유: 카톡·문자 · 아이폰은 「이미지 저장」도 공유 창에서 해야 앨범으로 감 */
 if((mode==='share'||ios)&&canShare){try{await navigator.share({files:[file],title:'다이소 업체 안내문'});return}catch(e){if(e&&e.name==='AbortError')return}}
 const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
 msg(ios?'이미지를 열었습니다. 길게 눌러 「사진에 저장」 해 주세요.':'이미지를 저장했습니다 ('+file.name+')')}
/** PC: PDF (인쇄 창 → 「PDF로 저장」) */
function fyPdf(){if(!fyForm().date){inspFlag(['f_fyDate'],'준비 기한 날짜를 먼저 골라 주세요');return}const w=window.open('','_blank');if(!w){msg('팝업이 막혔습니다. 팝업을 허용해 주세요.');return}
 const base=location.href.replace(/[?#].*$/,'').replace(/[^/]*$/,'');
 w.document.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>다이소 업체 안내문</title><style>@page{size:A4;margin:0}html,body{margin:0}'+$('fyCss').textContent+'</style></head><body>'+fyHtml(fyVals(),base)+'<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>');w.document.close()}
