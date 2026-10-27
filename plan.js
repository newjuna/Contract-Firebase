/* 계약 전 서류 앱 작성: 안전보건관리규정(C01) + 안전보건관리계획서(C02) — F1.8c 한 번에 이어서 작성
 *  7단계: 규정 → 방침·목표 → 조직·연락 → 위험작업 → 비상대책 → 비상대피훈련 계획 → 산재·증빙·서명
 *  서명은 마지막에 한 번 → 규정 PDF · 계획서 PDF 두 장에 같은 서명이 들어감 (제출 서류도 두 줄 그대로)
 *  위험작업을 고르면 위험성평가·작업허가·점검·교육·설비 표가 자동으로 채워짐 (서버 planHtml_)
 *  작성 중 내용은 이 휴대폰에 임시 보관 (닫았다 열어도 이어서 작성)
 *  보완 요청으로 둘 중 하나만 고칠 수 있으면 그 문서만 다시 만듦
 *  서버: 중계 rule · plan · planFile */
let pl=null,plStep=1;
/* F1.8k 3단계 = 현장대리인 (협력업체 관리자 1명 · 현장대리인계도 이때 같이 받음 → 공사마다 자동) */
const PL_STEPS=['규정(자동)','방침·목표','현장대리인','위험작업','비상대책','대피훈련 계획','산재·서명'];
const plMgr=()=>pl.org[0]||(pl.org[0]={role:'안전관리책임자 (현장대리인)',name:'',phone:''});
const PL_LAST=PL_STEPS.length;
const DRILL_PLAN=[['NEW','신규자 투입 시 대피 경로·집결 장소 안내'],['EVAC','공사 중 비상대피 훈련 1회 이상'],['CPR','심폐소생술(CPR) 교육'],['FIRE','소화기 사용 훈련']];
const plKey=()=>'planDraft:'+(state.company&&state.company.id);
const plRow=c=>(((state.docBoard||{}).rows||[]).find(x=>x.code===c))||{uploads:[]};
/** 이번에 다시 만들 수 있는 문서 (작성 중 · 보완 요청받은 문서) */
const plCan=()=>({C01:!!plRow('C01').canUpload,C02:!!plRow('C02').canUpload});
/** 첫 단계: 규정을 이번에 만들면 1, 아니면(보완 대상 아님 · 규정만 먼저 등록됨) 2 */
const plFirst=()=>2;  /* F1.8o 규정은 입력 없이 자동 생성 → 항상 2단계부터 (미리보기는 마지막 단계) */
/** F1.8c 계약 전 서류 화면: 규정·계획서를 한 카드로 (작성은 한 번에 · 문서 보기는 따로) */
function docPairCardHtml(r1,r2,opt){const l1=r1.uploads[0],l2=r2.uploads[0],ok=!!(l1&&l2),can=r1.canUpload||r2.canUpload;
 const st=(r,l)=>'<div class="row" style="justify-content:space-between;margin-top:6px"><span>'+escapeText(r.name)+'</span>'+(l?'<button class="dbtn ghost" type="button" style="flex:none;min-height:0;padding:6px 10px" onclick="viewFile(\''+escapeText(l.id)+'\')">📄 보기</button>':'<span class="none">미작성</span>')+'</div>';
 const hist=[r1,r2].filter(r=>r.uploads.length>1).map(r=>'<div class="muted" style="margin-top:4px">'+escapeText(r.name)+'</div>'+r.uploads.slice(1).map(u=>'<div><a onclick="viewFile(\''+escapeText(u.id)+'\')">v'+escapeText(u.version)+' · '+escapeText(u.name)+'</a></div>').join('')).join('');
 return '<div class="dcard '+(ok?'ok':'mine')+'" id="row_docC02"><div id="row_docC01"><div class="dhead"><b>안전보건관리규정 · 안전보건관리계획서</b><span class="badges">'+(r1.required||r2.required?'<span class="reqtag">필수</span>':'')+(ok?'<span class="done">✔ 작성 완료</span>':'<span class="none">미작성</span>')+'</span></div></div>'
  +'<div class="muted">규정 → 계획서 → 비상대피훈련 계획 → 서명 한 번</div>'+st(r1,l1)+st(r2,l2)
  +'<div class="dact">'+(can?'<button class="dbtn main" type="button" onclick="openPlan()">'+(l1||l2?'✍ 다시 작성':'✍ 작성하기')+'</button>':'<span class="muted">'+escapeText(opt.lockMsg||'')+'</span>')+'</div>'
  +(hist?'<details class="hist"><summary>이전 작성본</summary>'+hist+'</details>':'')+'</div>'}
/* 예전 카드 이름도 그대로 씀 (다른 화면에서 부를 때) */
function planCardHtml(r,opt){return docPairCardHtml(plRow('C01'),r,opt)}
function openPlan(){const can=plCan();if(!can.C02&&can.C01){openRule();return}  // 규정만 고칠 수 있으면 예전 규정 화면
 const F=state.forms.plan,saved=F.C02&&F.C02.data,D=F.defaults,R=state.forms,b=state.company,prev=(R.C01&&R.C01.data)||{};let draft=null;try{draft=JSON.parse(localStorage.getItem(plKey())||'null')}catch(e){}
 pl=JSON.parse(JSON.stringify(draft||saved||D));['policy','kpis','org','works','scen','accidents','evidence'].forEach(k=>{if(!Array.isArray(pl[k]))pl[k]=JSON.parse(JSON.stringify(D[k]))});
 /* F1.8k 조직 = 현장대리인 1명 (예전 3칸 자료는 현장대리인 칸만 남김) · 비어 있으면 사업장 정보의 현장대리인으로 */
 {const d0=(D.org||[])[0]||{},m=pl.org.find(o=>/현장대리인/.test(o.role||''))||{};pl.org=[{role:d0.role||'안전관리책임자 (현장대리인)',name:m.name||d0.name||'',phone:m.phone||d0.phone||''}]}
 pl.agent=Object.assign({birth:'',addr:'',licKind:'',licType:'',licNo:''},D.agent||{},(saved&&saved.agent)||{},pl.agent||{});
 pl.drill=Object.assign({},D.drill||{},pl.drill||{});if(!Array.isArray(pl.drill.items))pl.drill.items=(D.drill&&D.drill.items||[]).slice();
 /* F1.8o 규정 = 자동 (갑 = 도급인 위임 현장대리인 고정 · 을 = 등록 때 대표이사 · 시행일 = 오늘) */
 pl.rule={hqRep:R.hqRep||'곽동민',vendorRep:b.representative||prev.vendorRep||'',date:R.today};
 pl.years=D.years;pl.evidenceFiles=pl.evidenceFiles||(saved&&saved.evidenceFiles)||[];pl.ruleDone=!!(draft&&draft.ruleDone&&plRow('C01').uploads.length);plStep=plFirst();  // 규정만 먼저 등록된 경우 계획서부터
 let el=$('csheet');if(!el){el=document.createElement('div');el.id='csheet';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');document.body.appendChild(el)}
 el.setAttribute('aria-label','안전보건관리규정 · 계획서 작성');el.style.display='block';document.body.style.overflow='hidden';renderPlan()}
function closePlan(){plCollect();try{localStorage.setItem(plKey(),JSON.stringify(pl))}catch(e){}const el=$('csheet');if(el)el.style.display='none';document.body.style.overflow='';if(pl&&pl.ruleDone)display(state);msg('작성 중인 내용은 이 휴대폰에 보관됩니다. 다시 [작성하기]를 누르면 이어서 작성합니다.')}
const plW=k=>state.forms.plan.works.find(w=>w[0]===k);
/** 규정 미리보기에 쓰는 값 (contract.js ruleDocHtml이 rd를 읽음) */
function plRuleDoc(){rd={hqRep:pl.rule.hqRep,vendorRep:pl.rule.vendorRep,agent:plMgr().name,date:pl.rule.date};return ruleDocHtml()}
function renderPlan(){const F=state.forms.plan,el=$('csheet'),n=plStep,can=plCan(),b=state.company;let body='';
 /* F1.8o 1단계(규정)는 입력 없음 · 자동 생성 (화면은 2단계부터) */
 if(n===1)body='<div class="note">안전보건관리규정은 자동으로 만들어집니다.</div>';
 if(n===2)body='<div class="card"><h2>안전 목표 · 성과지표</h2>'
  +'<div class="field"><label for="f_plGoal">안전 목표 <span class="req">*</span></label><input id="f_plGoal" value="'+escapeText(pl.goal)+'" placeholder="예: 무재해 달성 (산업재해 0건)"></div>'
  +'<div class="stage">성과지표 <span class="req">*</span></div>'+pl.kpis.map((k,i)=>'<div class="plrow"><input id="f_plK'+i+'" value="'+escapeText(k.name)+'" placeholder="지표명" aria-label="지표명 '+(i+1)+'"><input id="f_plT'+i+'" class="sm" value="'+escapeText(k.target)+'" placeholder="목표" aria-label="목표 '+(i+1)+'"><button type="button" class="xs" onclick="plDel(\'kpis\','+i+')" aria-label="지표 빼기">✕</button></div>').join('')
  +'<button class="button ghost" type="button" onclick="plAdd(\'kpis\')">+ 지표 추가</button></div>'
  +'<div class="card"><details class="hist"><summary><b>안전보건경영 방침</b> · 기본 문구 (눌러서 고치기)</summary><textarea id="f_plPol" rows="9" style="width:100%;margin-top:8px">'+escapeText(pl.policy.join('\n'))+'</textarea><p class="muted">한 줄이 한 항목입니다. 첫 줄은 머리말입니다.</p></details>'
  +'<details class="hist"><summary><b>관련 법규 '+F.laws.length+'건</b> · 자동 포함</summary>'+F.laws.map(l=>'<div class="muted">· '+escapeText(l[0])+' — '+escapeText(l[1])+'</div>').join('')+'</details></div>';
 if(n===3){const o=plMgr(),g=pl.agent;body='<div class="card"><h2>안전관리책임자 (현장대리인)</h2><p class="muted">업체 소장 1명입니다. 공사마다 현장대리인계가 이 정보로 자동으로 만들어집니다.</p>'
  +'<div class="split"><div class="field"><label for="f_plN0">성명 <span class="req">*</span></label><input id="f_plN0" value="'+escapeText(o.name)+'" placeholder="업체 소장 이름"></div><div class="field"><label for="f_plP0">연락처 <span class="req">*</span></label><input id="f_plP0" type="tel" value="'+escapeText(o.phone)+'" placeholder="숫자만 입력 (- 자동)"></div>'
  +'<div class="field"><label for="f_plGb">생년월일 <span class="req">*</span></label><input id="f_plGb" type="date" value="'+escapeText(g.birth)+'"></div><div class="field"><label for="f_plGa">주소 <span class="req">*</span></label><input id="f_plGa" value="'+escapeText(g.addr)+'" placeholder="예: 서울특별시 강남구 ○○로 00"></div></div>'
  +'<details class="hist"'+(g.licKind||g.licType||g.licNo?' open':'')+'><summary>기술자면허 (있으면)</summary><div class="split">'+[['plGk','종별',g.licKind],['plGt','류별',g.licType],['plGn','번호',g.licNo]].map(([id,l,v])=>'<div class="field"><label for="f_'+id+'">기술자면허 '+l+'</label><input id="f_'+id+'" value="'+escapeText(v)+'"></div>').join('')+'</div></details></div>'}
 if(n===4){const sel=F.works.filter(w=>pl.works.includes(w[0]));body='<div class="card" id="plWorks"><h2>우리 업체가 하는 위험작업 <span class="req">*</span></h2><p class="muted">업종('+escapeText(b.industry)+') 기본값이 체크되어 있습니다. 실제로 하는 작업만 남겨 주세요.</p><div class="pchips">'
  +F.works.map(w=>'<label class="pchip"><input type="checkbox" '+(pl.works.includes(w[0])?'checked':'')+' onchange="plWork(\''+w[0]+'\',this.checked)"><span>'+escapeText(w[1].split(' (')[0])+'</span></label>').join('')+'</div></div>'
  +'<div class="card"><h2>자동으로 작성되는 위험성평가</h2>'+(sel.map(w=>{const r=w[4]*w[5];return '<div class="plrisk"><div class="row" style="justify-content:space-between"><b>'+escapeText(w[1])+'</b><span class="pill '+(r>=15?'bad':r>=10?'todo':'ok')+'">위험도 '+r+'</span></div><div class="muted">위험요인 '+escapeText(w[2])+(w[6]?' · <b>작업허가 대상</b>':'')+'</div><div style="font-size:13px">대책: '+escapeText(w[3])+'</div></div>'}).join('')||'<p class="muted">작업을 고르면 여기에 표가 만들어집니다.</p>')+'</div>'}
 if(n===5)body='<div class="card" id="plScen"><h2>비상 시나리오 <span class="req">*</span></h2><p class="muted">사고 유형별 대응 순서가 계획서에 들어갑니다.</p><div class="pchips">'
  +F.scen.map(s=>'<label class="pchip"><input type="checkbox" '+(pl.scen.includes(s[0])?'checked':'')+' onchange="plScen(\''+s[0]+'\',this.checked)"><span>'+escapeText(s[1])+'</span></label>').join('')+'</div>'
  +'<div class="field"><label for="f_plHos">가까운 병원 (선택)</label><input id="f_plHos" value="'+escapeText(pl.hospital)+'" placeholder="예: ○○병원 응급실 02-000-0000"></div></div>';
 /* F1.8c 비상대피훈련 계획 (계획서 Ⅲ-4) · 공사 중 실제 훈련은 순회점검 때 사진으로 남김 */
 if(n===6){const d=pl.drill;body='<div class="card"><h2>비상대피훈련 계획</h2>'
  +'<div class="field"><label for="f_plDr">대피 경로 <span class="req">*</span></label><input id="f_plDr" value="'+escapeText(d.route)+'" placeholder="예: 작업장 → 매장 비상구 → 건물 뒤 주차장"></div>'
  +'<div class="field"><label for="f_plDa">집결 장소 <span class="req">*</span></label><input id="f_plDa" value="'+escapeText(d.assembly)+'" placeholder="예: 건물 뒤 주차장 입구"></div>'
  +'<div class="field"><label for="f_plDe">소화기 · 비상구 위치 (선택)</label><input id="f_plDe" value="'+escapeText(d.equip)+'" placeholder="예: 소화기 계산대 옆·창고 입구 / 비상구 매장 뒤편"></div>'
  +'<div class="field"><label for="f_plDm">훈련 담당자 <span class="req">*</span></label><input id="f_plDm" value="'+escapeText(d.manager||plMgr().name||'')+'" placeholder="예: 현장대리인 이름"></div>'
  +'<div class="stage" id="plDrill">훈련 방법 <span class="req">*</span></div><div class="pchips">'+DRILL_PLAN.map(([k,l])=>'<label class="pchip"><input type="checkbox" '+(d.items.includes(k)?'checked':'')+' onchange="plDrillItem(\''+k+'\',this.checked)"><span>'+escapeText(l)+'</span></label>').join('')+'</div></div>'}
 if(n===7){sigDirty=false;body='<div class="card" id="plAcc"><h2>최근 3년 산업재해 <span class="req">*</span></h2><div class="placc">'+pl.years.map((y,i)=>'<label for="f_plA'+i+'">'+y+'년</label><input id="f_plA'+i+'" type="number" inputmode="numeric" min="0" value="'+escapeText(pl.accidents[i])+'" placeholder="0"><span class="muted">건</span>').join('')+'</div>'
  +'<div class="stage">증빙 (사진 촬영 · 이미지 · PDF)</div><p class="muted">산재 0건이어도 근로복지공단 확인서 등 증빙이 있으면 올려 주세요.</p><div id="plEv">'+plEvHtml()+'</div></div>'
  +'<div class="card"><details class="hist"><summary><b>이행 사례 (가점 · 선택)</b></summary><textarea id="f_plPr" rows="4" style="width:100%;margin-top:8px" placeholder="예) 위험성평가 결과 사다리 작업 → 말비계로 교체 (2025.5)">'+escapeText(pl.practice)+'</textarea></details></div>'
  /* F1.8o 규정은 자동 생성 → 여기서 미리보기만 */
  +(can.C01&&!pl.ruleDone?'<div class="card"><details class="hist"><summary><b>안전보건관리규정</b> · 자동 작성 (눌러서 미리보기)</summary><div class="cdoc" id="plRuleDoc" style="margin-top:8px">'+plRuleDoc()+'</div></details></div>':'')
  /* F1.8k 서명 = 현장대리인 (대표이사 대리) · 같은 서명이 규정 · 계획서 · 공사마다 현장대리인계 등록인감 칸에 들어감 */
  +'<div class="card" id="sigBox"><h2>현장대리인 서명 <span class="req">*</span></h2><p class="muted">'+(can.C01&&!pl.ruleDone?'규정 · 계획서 · 현장대리인계에 같은 서명이 들어갑니다.':'계획서 · 현장대리인계에 같은 서명이 들어갑니다.')+'</p><canvas id="sigPad" class="sigpad" aria-label="서명 칸 (손가락으로 서명)"></canvas><div class="row" style="justify-content:space-between;margin-top:8px"><span class="muted">'+escapeText(b.company)+' 현장대리인 '+escapeText(plMgr().name)+' (대표이사 '+escapeText(can.C01?pl.rule.vendorRep:b.representative)+' 대리)</span><button class="button ghost" type="button" onclick="clearSig()">다시 쓰기</button></div></div>'}
 const first=plFirst();
 el.innerHTML='<div class="pbar"><button class="button ghost" type="button" onclick="closePlan()">‹ 이전으로</button><b class="pbt">안전보건 서류 '+n+'/'+PL_LAST+'</b><span style="width:64px"></span></div><div class="cwrap">'
  +'<div class="plsteps">'+PL_STEPS.map((t,i)=>'<span class="'+(i+1<n?'done':i+1===n?'now':'')+'">'+escapeText(t)+'</span>').join('')+'</div>'+body
  +'<div class="card roomfoot"><div class="row">'+(n>first?'<button class="button ghost" type="button" style="flex:1" onclick="plGo(-1)">이전</button>':'')+(n<PL_LAST?'<button class="button" type="button" style="flex:2" onclick="plGo(1)">다음</button>':'<button class="button" id="planSave" type="button" style="flex:2" onclick="savePlanNow()">서명하고 작성 완료</button>')+'</div></div></div>';
 el.scrollTop=0;if(n===PL_LAST)setTimeout(initSig,30)}
function plEvHtml(){return pl.evidenceFiles.map((f,i)=>'<div class="plfile"><span>📎 '+escapeText(f.name)+'</span><button type="button" class="xs" onclick="plEvDel('+i+')" aria-label="빼기">✕</button></div>').join('')+'<button class="button ghost" type="button" style="display:block;width:100%;margin-top:6px" onclick="pickPhoto(plUploadFile,{title:\'증빙 넣기\',accept:\'image/*,.pdf,application/pdf\'})">📷 촬영 · 파일 올리기</button>'}
/** 지금 화면의 입력값을 pl에 담기 */
function plCollect(){if(!pl)return;const n=plStep,v=id=>$('f_'+id)?$('f_'+id).value.trim():null;
 if(n===2){pl.goal=v('plGoal')??pl.goal;pl.kpis=pl.kpis.map((k,i)=>({name:v('plK'+i)??k.name,target:v('plT'+i)??k.target}));const p=v('plPol');if(p!=null)pl.policy=p.split('\n').map(x=>x.trim()).filter(Boolean)}
 if(n===3){const o=plMgr(),g=pl.agent;o.name=v('plN0')??o.name;o.phone=v('plP0')??o.phone;g.birth=v('plGb')??g.birth;g.addr=v('plGa')??g.addr;g.licKind=v('plGk')??g.licKind;g.licType=v('plGt')??g.licType;g.licNo=v('plGn')??g.licNo}
 if(n===5)pl.hospital=v('plHos')??pl.hospital;
 if(n===6){const d=pl.drill;d.route=v('plDr')??d.route;d.assembly=v('plDa')??d.assembly;d.equip=v('plDe')??d.equip;d.manager=v('plDm')??d.manager}
 if(n===7){pl.accidents=pl.years.map((_,i)=>v('plA'+i)??pl.accidents[i]);pl.practice=v('plPr')??pl.practice}
 try{localStorage.setItem(plKey(),JSON.stringify(pl))}catch(e){}}
function plAdd(k){plCollect();pl[k].push(k==='kpis'?{name:'',target:''}:{role:'',name:'',phone:''});renderPlan()}
function plDel(k,i){plCollect();pl[k].splice(i,1);renderPlan()}
function plWork(k,on){plCollect();pl.works=on?[...new Set(pl.works.concat(k))]:pl.works.filter(x=>x!==k);renderPlan()}
function plScen(k,on){plCollect();pl.scen=on?[...new Set(pl.scen.concat(k))]:pl.scen.filter(x=>x!==k);$('plScen').classList.remove('miss','shake')}
function plDrillItem(k,on){plCollect();pl.drill.items=on?[...new Set(pl.drill.items.concat(k))]:pl.drill.items.filter(x=>x!==k);$('plDrill')?.classList.remove('miss','shake')}
function plEvDel(i){pl.evidenceFiles.splice(i,1);$('plEv').innerHTML=plEvHtml()}
async function plUploadFile(f0){try{const f=await readFile(f0);const r=await call('uploadPlanFile',f);plCollect();pl.evidenceFiles.push(r);$('plEv').innerHTML=plEvHtml();msg('증빙을 올렸습니다.')}catch(e){showErr('증빙을 올리지 못했습니다',e)}}
/** 단계 이동 (다음은 빈 칸 확인) */
function plGo(d){plCollect();if(d>0){const m=plMiss(plStep);if(m.length){inspFlag(m,'빨간 칸을 채워 주세요');return}}plStep=Math.max(plFirst(),Math.min(PL_LAST,plStep+d));renderPlan()}
function plMiss(n){const m=[],can=plCan();
 if(n===2){if(!pl.goal)m.push('f_plGoal');if(!pl.kpis.some(k=>k.name))m.push(pl.kpis.length?'f_plK0':'f_plGoal')}
 if(n===3){const o=plMgr(),g=pl.agent;if(!o.name)m.push('f_plN0');if(!o.phone)m.push('f_plP0');if(!/^\d{4}-\d{2}-\d{2}$/.test(g.birth||''))m.push('f_plGb');if(!g.addr)m.push('f_plGa')}if(n===4&&!pl.works.length)m.push('plWorks');if(n===5&&!pl.scen.length)m.push('plScen');
 if(n===6){const d=pl.drill;if(!d.route)m.push('f_plDr');if(!d.assembly)m.push('f_plDa');if(!d.manager)m.push('f_plDm');if(!d.items.length)m.push('plDrill')}
 if(n===7){pl.accidents.forEach((a,i)=>{if(a==='')m.push('f_plA'+i)});if(!sigDirty)m.push('sigBox')}return m}
/** 서명하고 작성 완료 → 규정 PDF(필요하면) → 계획서 PDF · 같은 서명 · 응답이 끊겨도 실제로 등록됐는지 확인 */
async function savePlanNow(){plCollect();const m=plMiss(PL_LAST);if(m.length){inspFlag(m,m[0]==='sigBox'?'현장대리인 서명을 해 주세요':'최근 3년 산재 건수를 적어 주세요 (없으면 0)');return}
 for(let i=1;i<PL_LAST;i++)if(plMiss(i).length){plStep=i;renderPlan();setTimeout(()=>inspFlag(plMiss(i),PL_STEPS[i-1]+' 단계에 빈 칸이 있습니다'),50);return}
 const sg=sigData();if(!sg){sigBad();inspFlag(['sigBox'],'서명 칸을 다시 준비했습니다. 한 번 더 서명해 주세요');return}
 const can=plCan(),doRule=can.C01&&!pl.ruleDone;
 if(!await askOk('안전보건 서류 작성 완료',(doRule?'안전보건관리규정 + ':'')+'안전보건관리계획서\n위험작업 '+pl.works.length+'개 · 비상 시나리오 '+pl.scen.length+'개 · 대피훈련 계획 · 증빙 '+pl.evidenceFiles.length+'건\n\n서명이 들어간 PDF가 만들어져 제출 서류로 등록됩니다.','작성 완료'))return;
 const cnt=(s,c)=>((((s||state).docBoard||{}).rows||[]).find(x=>x.code===c)||{uploads:[]}).uploads.length,b1=cnt(null,'C01'),b2=cnt(null,'C02'),btn=$('planSave');
 const busy=t=>{if(btn){btn.disabled=true;btn.textContent=t}};
 const done=s=>{try{localStorage.removeItem(plKey())}catch(z){}const el=$('csheet');if(el)el.style.display='none';document.body.style.overflow='';pl=null;display(s);setTimeout(()=>$('row_docC02')?.scrollIntoView({block:'center'}),100);msg('규정·계획서 작성 완료 · 제출 서류로 등록했습니다.')};
 const run=async(fn,args,code,before)=>{try{return await call(fn,...args)}catch(e){if(LOST_RE.test(e&&e.message||'')){try{const s=await callQuiet('portalData');if(cnt(s,code)>before)return s}catch(x){}}throw e}};
 try{
  if(doRule){busy('① 규정을 만드는 중… (10초 정도)');const s1=await run('saveRuleDoc',[{hqRep:pl.rule.hqRep,vendorRep:pl.rule.vendorRep,agent:plMgr().name,date:pl.rule.date},sg],'C01',b1);state=s1;pl.ruleDone=true}
  busy((doRule?'② ':'')+'계획서를 만드는 중… (20초 정도)');
  const d=Object.assign({},pl,{evidence:pl.evidenceFiles.map(f=>f.id)});['evidenceFiles','rule','ruleDone'].forEach(k=>delete d[k]);
  done(await run('savePlanDoc',[d,sg],'C02',b2));
 }catch(e){if(btn){btn.disabled=false;btn.textContent='서명하고 작성 완료'}
  showErr(pl&&pl.ruleDone&&doRule?'규정은 등록했지만 계획서를 등록하지 못했습니다':'서류를 등록하지 못했습니다',{message:(e&&e.message||'')+(pl&&pl.ruleDone?'\n\n[서명하고 작성 완료]를 다시 누르면 계획서만 다시 만듭니다.':'')})}}
