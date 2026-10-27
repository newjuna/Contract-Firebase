/* 계약 전 서류 앱 작성 (v5.2)
 *  ① 안전보건관리규정 (도급사업 협의체 운영지침): 3칸 입력 + 손가락 서명 → PDF 자동 생성 → C01 제출서류로 등록
 *     "갑" 다이소 = 현장대리인 이름만 / "을" 업체 = 대표이사 이름 + 서명
 *  서버: Code.gs saveRuleDoc · portalData.forms */
let rd=null,sigDirty=false;
/* ---------- 계약 전 화면의 규정 카드 ---------- */
function ruleCardHtml(r,opt){const latest=r.uploads[0],ok=!!latest;
 return '<div class="dcard '+(ok?'ok':'mine')+'" id="row_docC01"><div class="dhead"><b>'+escapeText(r.name)+'</b><span class="badges">'+(r.required?'<span class="reqtag">필수</span>':'')+(ok?'<span class="done">✔ 작성 완료</span>':'<span class="none">미작성</span>')+'</span></div>'
  +'<div class="muted">휴대폰에서 3칸 입력 + 서명</div>'
  +'<div class="dact">'+(ok?'<button class="dbtn ghost" type="button" onclick="viewFile(\''+escapeText(latest.id)+'\')">📄 문서 보기</button>':'')
  +(r.canUpload?'<button class="dbtn main" type="button" onclick="openRule()">'+(ok?'✍ 다시 작성':'✍ 작성하기')+'</button>':'<span class="muted">'+escapeText(opt.lockMsg||'')+'</span>')+'</div>'
  +(r.uploads.length>1?'<details class="hist"><summary>이전 작성본 '+(r.uploads.length-1)+'건</summary>'+r.uploads.slice(1).map(u=>'<div><a onclick="viewFile(\''+escapeText(u.id)+'\')">v'+escapeText(u.version)+' · '+escapeText(u.name)+'</a> <span class="muted">'+escapeText(fmtTime(u.uploadedAt))+'</span></div>').join('')+'</details>':'')+'</div>'}
/* ---------- 작성 화면 (전체 화면) ---------- */
function openRule(){const F=state.forms,b=state.company,prev=(F.C01&&F.C01.data)||{};
 rd={hqRep:prev.hqRep||F.hqRep||'',vendorRep:prev.vendorRep||b.representative||'',date:F.today};sigDirty=false;
 let el=$('csheet');if(!el){el=document.createElement('div');el.id='csheet';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');document.body.appendChild(el)}
 el.setAttribute('aria-label','안전보건관리규정 작성');  // F1.8e 합친 화면에서 쓰던 창을 다시 쓸 때도 이름을 바꿔야 뒤로가기가 규정 닫기로 감
 el.innerHTML='<div class="pbar"><button class="button ghost" type="button" onclick="closeRule()">‹ 이전으로</button><b class="pbt">안전보건관리규정 작성</b><span style="width:64px"></span></div><div class="cwrap">'
  +'<div class="card"><h2>① 세 칸만 확인해 주세요</h2><p class="desc">나머지 내용(제1조~제10조)은 정해진 지침 문구가 자동으로 들어갑니다.</p>'
  +'<div class="field"><label for="f_rhq">"갑" 다이소 현장대리인 이름 <span class="req">*</span></label><input id="f_rhq" value="'+escapeText(rd.hqRep)+'" placeholder="예: 김담당 (다이소 담당자 이름)" oninput="ruleIn()"></div>'
  +'<div class="field"><label for="f_rrep">"을" '+escapeText(b.company)+' 대표이사 <span class="req">*</span></label><input id="f_rrep" value="'+escapeText(rd.vendorRep)+'" oninput="ruleIn()"></div>'
  +'<div class="field"><label for="f_rdate">시행일 <span class="req">*</span></label><input id="f_rdate" type="date" value="'+escapeText(rd.date)+'" oninput="ruleIn()"></div></div>'
  +'<div class="card cdoc"><div class="stage" style="margin-top:0">② 완성될 문서 미리보기</div><div id="ruleDoc">'+ruleDocHtml()+'</div></div>'
  +'<div class="card" id="sigBox"><h2>③ 대표이사 서명 <span class="req">*</span></h2><p class="desc">아래 칸에 손가락으로 서명해 주세요.</p><canvas id="sigPad" class="sigpad" aria-label="서명 칸 (손가락으로 서명)"></canvas><div class="row" style="justify-content:space-between;margin-top:8px"><span class="muted">"을" '+escapeText(b.company)+' 대표이사</span><button class="button ghost" type="button" onclick="clearSig()">다시 쓰기</button></div></div>'
  +'<div class="card roomfoot"><button class="button" id="ruleSave" type="button" style="width:100%" onclick="saveRuleNow()">서명하고 작성 완료</button></div></div>';
 el.style.display='block';document.body.style.overflow='hidden';el.scrollTop=0;initSig()}
function closeRule(){const el=$('csheet');if(el)el.style.display='none';document.body.style.overflow='';rd=null}
function ruleIn(){rd.hqRep=value('rhq');rd.vendorRep=value('rrep');rd.date=value('rdate');$('ruleDoc').innerHTML=ruleDocHtml();['f_rhq','f_rrep','f_rdate'].forEach(id=>$(id).classList.remove('miss','shake'))}
function ruleDocHtml(){const F=state.forms,b=state.company,fill=v=>'<b class="fill">'+(v?escapeText(v):'_____')+'</b>',dt=/^\d{4}-\d{2}-\d{2}$/.test(rd.date)?rd.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1년 $2월 $3일'):'';
 return '<h3>&lt;'+escapeText(F.rule.title)+'&gt;</h3><p>도급사업주 '+escapeText(F.hq)+' 현장대리인 '+fill(rd.hqRep)+' (이하 "갑"이라 한다)</p><p>수급사업주 '+escapeText(b.company)+' 대표이사 '+fill(rd.vendorRep)+' (이하 "을"이라 한다)은 도급사업에 다음과 같이 협의체를 구성 운영한다.</p>'
  +F.rule.text.map(([t,x])=>'<div class="art"><b>'+escapeText(t)+'</b><div>'+escapeText(x).replace(/\n/g,'<br>')+'</div></div>').join('')
  +'<p style="margin-top:14px">※ 시행일자 : 이 지침은 '+fill(dt)+'부터 시행</p>'
  +'<div class="csign"><div><b>"갑"</b><br>'+escapeText(F.hq)+'<br>현장대리인 '+fill(rd.hqRep)+'</div><div><b>"을"</b><br>'+escapeText(b.company)+'<br>대표이사 '+fill(rd.vendorRep)+'<br><span class="muted">(아래 ③ 서명이 들어갑니다)</span></div></div>'}
/* ---------- 손가락 서명 칸 ---------- */
/* F1.7f 화면이 다 그려지기 전에 준비하면 서명 칸 크기가 0이 되어 서명이 비어서 보내짐(서버가 '서명 없음'으로 거절)
 *  → 크기가 0이면 잠시 뒤 다시 준비 · 서명 시작할 때도 확인 */
function initSig(n){const c=$('sigPad');if(!c)return;const r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
 if(r.width<20||r.height<20){if((n||0)<30)setTimeout(()=>initSig((n||0)+1),100);return}
 c.width=Math.round(r.width*dpr);c.height=Math.round(r.height*dpr);
 const g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.lineWidth=2.8;g.lineCap='round';g.lineJoin='round';g.strokeStyle=g.fillStyle='#111';let down=false,last=null;
 const pt=e=>{const b=c.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top]};
 c.onpointerdown=e=>{e.preventDefault();if(sigBad())return;down=true;last=pt(e);try{c.setPointerCapture(e.pointerId)}catch(x){}g.beginPath();g.arc(last[0],last[1],1.3,0,7);g.fill();sigDirty=true;$('sigBox').classList.remove('miss','shake')};
 c.onpointermove=e=>{if(!down)return;e.preventDefault();const p=pt(e);g.beginPath();g.moveTo(last[0],last[1]);g.lineTo(p[0],p[1]);g.stroke();last=p};
 c.onpointerup=c.onpointercancel=c.onpointerleave=()=>{down=false}}
function clearSig(){const c=$('sigPad');c.getContext('2d').clearRect(0,0,c.width,c.height);sigDirty=false;initSig()}
/** 서명 칸이 준비되지 않았으면(크기 0) 다시 준비하고 true */
function sigBad(){const c=$('sigPad');if(!c)return true;const r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
 if(c.width>=20&&c.height>=20)return false;if(r.width<20)return true;sigDirty=false;initSig();msg('서명 칸을 다시 준비했습니다. 한 번 더 서명해 주세요.');return true}
/** 서명 이미지 (가로 최대 600px PNG) · 서명 칸이 비정상이면 '' */
function sigData(){const c=$('sigPad');if(!c||c.width<20||c.height<20)return '';const w=Math.min(600,c.width),h=Math.round(c.height*w/c.width),t=document.createElement('canvas');t.width=w;t.height=h;t.getContext('2d').drawImage(c,0,0,w,h);return t.toDataURL('image/png')}
async function saveRuleNow(){ruleIn();const miss=[];if(!rd.hqRep)miss.push('f_rhq');if(!rd.vendorRep)miss.push('f_rrep');if(!rd.date)miss.push('f_rdate');if(!sigDirty)miss.push('sigBox');
 if(miss.length){inspFlag(miss,miss[0]==='sigBox'?'대표이사 서명을 해 주세요':'빨간 칸을 채워 주세요');return}
 const sg=sigData();if(!sg){sigBad();inspFlag(['sigBox'],'서명 칸을 다시 준비했습니다. 한 번 더 서명해 주세요');return}
 if(!await askOk('안전보건관리규정 작성 완료','"갑" '+state.forms.hq+' 현장대리인 '+rd.hqRep+'\n"을" '+state.company.company+' 대표이사 '+rd.vendorRep+'\n시행일 '+rd.date+'\n\n서명이 들어간 PDF가 만들어져 제출 서류로 등록됩니다.','작성 완료'))return;
 const before=((((state.docBoard||{}).rows||[]).find(x=>x.code==='C01')||{}).uploads||[]).length;const btn=$('ruleSave');if(btn){btn.disabled=true;btn.textContent='문서를 만드는 중… (10초 정도)'}
 try{const s=await call('saveRuleDoc',{hqRep:rd.hqRep,vendorRep:rd.vendorRep,date:rd.date},sg);closeRule();display(s);setTimeout(()=>$('row_docC01')?.scrollIntoView({block:'center'}),100);msg('안전보건관리규정 작성 완료 · 제출 서류로 등록했습니다.')}
 catch(e){/* F1.7f 응답만 사라진 경우(시간 초과·연결 끊김)도 실제로 등록됐는지 확인 · 실패 이유는 창으로 보여 줌 */
  if(LOST_RE.test(e&&e.message||'')){try{const s=await callQuiet('portalData');const r=((s.docBoard&&s.docBoard.rows)||[]).find(x=>x.code==='C01');if(r&&r.uploads.length>before){closeRule();display(s);msg('안전보건관리규정이 등록되었습니다.');return}}catch(x){}}
  if(btn){btn.disabled=false;btn.textContent='서명하고 작성 완료'}showErr('규정을 등록하지 못했습니다',e)}}
