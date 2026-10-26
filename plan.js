/* 계약 전 서류 앱 작성 ② 안전보건관리계획서 (v5.4)
 *  5단계: 방침·목표 → 조직·연락 → 위험작업 → 비상대책 → 산재 현황·증빙·서명
 *  위험작업을 고르면 위험성평가·작업허가·점검·교육·설비 표가 자동으로 채워짐 (서버 planHtml_)
 *  작성 중 내용은 이 휴대폰에 임시 보관 (닫았다 열어도 이어서 작성)
 *  서버: Code.gs uploadPlanFile · savePlanDoc · portalData.forms.plan */
let pl=null,plStep=1;
const PL_STEPS=['방침·목표','조직·연락','위험작업','비상대책','산재·서명'];
const plKey=()=>'planDraft:'+(state.company&&state.company.id);
function planCardHtml(r,opt){const latest=r.uploads[0],ok=!!latest;
 return '<div class="dcard '+(ok?'ok':'mine')+'" id="row_docC02"><div class="dhead"><b>'+escapeText(r.name)+'</b><span class="badges">'+(r.required?'<span class="reqtag">필수</span>':'')+(ok?'<span class="done">✔ 작성 완료</span>':'<span class="none">미작성</span>')+'</span></div>'
  +'<div class="muted">5단계 입력 + 서명 · 업종에 맞는 기본값이 채워져 있습니다</div>'
  +'<div class="dact">'+(ok?'<button class="dbtn ghost" type="button" onclick="viewFile(\''+escapeText(latest.id)+'\')">📄 문서 보기</button>':'')
  +(r.canUpload?'<button class="dbtn main" type="button" onclick="openPlan()">'+(ok?'✍ 다시 작성':'✍ 작성하기')+'</button>':'<span class="muted">'+escapeText(opt.lockMsg||'')+'</span>')+'</div>'
  +(r.uploads.length>1?'<details class="hist"><summary>이전 작성본 '+(r.uploads.length-1)+'건</summary>'+r.uploads.slice(1).map(u=>'<div><a onclick="viewFile(\''+escapeText(u.id)+'\')">v'+escapeText(u.version)+' · '+escapeText(u.name)+'</a></div>').join('')+'</details>':'')+'</div>'}
function openPlan(){const F=state.forms.plan,saved=F.C02&&F.C02.data,D=F.defaults;let draft=null;try{draft=JSON.parse(localStorage.getItem(plKey())||'null')}catch(e){}
 pl=JSON.parse(JSON.stringify(draft||saved||D));['policy','kpis','org','works','scen','accidents','evidence'].forEach(k=>{if(!Array.isArray(pl[k]))pl[k]=JSON.parse(JSON.stringify(D[k]))});
 pl.years=D.years;pl.evidenceFiles=pl.evidenceFiles||(saved&&saved.evidenceFiles)||[];plStep=1;
 let el=$('csheet');if(!el){el=document.createElement('div');el.id='csheet';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');document.body.appendChild(el)}
 el.setAttribute('aria-label','안전보건관리계획서 작성');el.style.display='block';document.body.style.overflow='hidden';renderPlan()}
function closePlan(){plCollect();try{localStorage.setItem(plKey(),JSON.stringify(pl))}catch(e){}const el=$('csheet');if(el)el.style.display='none';document.body.style.overflow='';msg('작성 중인 내용은 이 휴대폰에 보관됩니다. 다시 [작성하기]를 누르면 이어서 작성합니다.')}
const plW=k=>state.forms.plan.works.find(w=>w[0]===k);
function renderPlan(){const F=state.forms.plan,el=$('csheet'),n=plStep;let body='';
 if(n===1)body='<div class="card"><h2>안전 목표 · 성과지표</h2>'
  +'<div class="field"><label for="f_plGoal">안전 목표 <span class="req">*</span></label><input id="f_plGoal" value="'+escapeText(pl.goal)+'" placeholder="예: 무재해 달성 (산업재해 0건)"></div>'
  +'<div class="stage">성과지표 <span class="req">*</span></div>'+pl.kpis.map((k,i)=>'<div class="plrow"><input id="f_plK'+i+'" value="'+escapeText(k.name)+'" placeholder="지표명" aria-label="지표명 '+(i+1)+'"><input id="f_plT'+i+'" class="sm" value="'+escapeText(k.target)+'" placeholder="목표" aria-label="목표 '+(i+1)+'"><button type="button" class="xs" onclick="plDel(\'kpis\','+i+')" aria-label="지표 빼기">✕</button></div>').join('')
  +'<button class="button ghost" type="button" onclick="plAdd(\'kpis\')">+ 지표 추가</button></div>'
  +'<div class="card"><details class="hist"><summary><b>안전보건경영 방침</b> · 기본 문구 (눌러서 고치기)</summary><textarea id="f_plPol" rows="9" style="width:100%;margin-top:8px">'+escapeText(pl.policy.join('\n'))+'</textarea><p class="muted">한 줄이 한 항목입니다. 첫 줄은 머리말입니다.</p></details>'
  +'<details class="hist"><summary><b>관련 법규 '+F.laws.length+'건</b> · 자동 포함</summary>'+F.laws.map(l=>'<div class="muted">· '+escapeText(l[0])+' — '+escapeText(l[1])+'</div>').join('')+'</details></div>';
 if(n===2)body='<div class="card"><h2>안전보건 조직 · 비상연락</h2><p class="muted">사업장 정보에서 가져왔습니다. 맞는지 확인해 주세요.</p>'
  +pl.org.map((o,i)=>'<div class="plorg"><div class="muted">'+(i<3?escapeText(o.role)+' <span class="req">*</span>':'<input id="f_plR'+i+'" value="'+escapeText(o.role)+'" placeholder="역할 (예: 작업반장)" aria-label="역할">')+'</div><div class="plrow"><input id="f_plN'+i+'" value="'+escapeText(o.name)+'" placeholder="이름" aria-label="'+escapeText(o.role||'추가 인원')+' 이름"><input id="f_plP'+i+'" type="tel" value="'+escapeText(o.phone)+'" placeholder="010-0000-0000" aria-label="연락처">'+(i<3?'':'<button type="button" class="xs" onclick="plDel(\'org\','+i+')" aria-label="빼기">✕</button>')+'</div></div>').join('')
  +'<button class="button ghost" type="button" onclick="plAdd(\'org\')">+ 사람 추가</button></div>';
 if(n===3){const sel=F.works.filter(w=>pl.works.includes(w[0]));body='<div class="card" id="plWorks"><h2>우리 업체가 하는 위험작업 <span class="req">*</span></h2><p class="muted">업종('+escapeText(state.company.industry)+') 기본값이 체크되어 있습니다. 실제로 하는 작업만 남겨 주세요.</p><div class="pchips">'
  +F.works.map(w=>'<label class="pchip"><input type="checkbox" '+(pl.works.includes(w[0])?'checked':'')+' onchange="plWork(\''+w[0]+'\',this.checked)"><span>'+escapeText(w[1].split(' (')[0])+'</span></label>').join('')+'</div></div>'
  +'<div class="card"><h2>자동으로 작성되는 위험성평가</h2>'+(sel.map(w=>{const r=w[4]*w[5];return '<div class="plrisk"><div class="row" style="justify-content:space-between"><b>'+escapeText(w[1])+'</b><span class="pill '+(r>=15?'bad':r>=10?'todo':'ok')+'">위험도 '+r+'</span></div><div class="muted">위험요인 '+escapeText(w[2])+(w[6]?' · <b>작업허가 대상</b>':'')+'</div><div style="font-size:13px">대책: '+escapeText(w[3])+'</div></div>'}).join('')||'<p class="muted">작업을 고르면 여기에 표가 만들어집니다.</p>')+'</div>'}
 if(n===4)body='<div class="card" id="plScen"><h2>비상 시나리오 <span class="req">*</span></h2><p class="muted">사고 유형별 대응 순서가 계획서에 들어갑니다.</p><div class="pchips">'
  +F.scen.map(s=>'<label class="pchip"><input type="checkbox" '+(pl.scen.includes(s[0])?'checked':'')+' onchange="plScen(\''+s[0]+'\',this.checked)"><span>'+escapeText(s[1])+'</span></label>').join('')+'</div>'
  +'<div class="field"><label for="f_plHos">가까운 병원 (선택)</label><input id="f_plHos" value="'+escapeText(pl.hospital)+'" placeholder="예: ○○병원 응급실 02-000-0000"></div></div>'
  +'<div class="card"><h2>자동으로 들어가는 계획</h2><div class="muted">· 안전점검: 작업 전(TBM)·작업 중(순회점검 2일 1회)·작업 후<br>· 안전보건교육: 신규 채용 시·작업 전 TBM·정기'+(pl.works.some(k=>(plW(k)||[])[6])?'·특별교육':'')+'<br>· 작업허가 대상: '+(escapeText(pl.works.filter(k=>(plW(k)||[])[6]).map(k=>plW(k)[1].split(' (')[0]).join(', '))||'없음')+'<br>· 신호·연락체계, 사용 설비 점검</div></div>';
 if(n===5){sigDirty=false;body='<div class="card" id="plAcc"><h2>최근 3년 산업재해 <span class="req">*</span></h2><div class="placc">'+pl.years.map((y,i)=>'<label for="f_plA'+i+'">'+y+'년</label><input id="f_plA'+i+'" type="number" inputmode="numeric" min="0" value="'+escapeText(pl.accidents[i])+'" placeholder="0"><span class="muted">건</span>').join('')+'</div>'
  +'<div class="stage">증빙 (사진 촬영 · 이미지 · PDF)</div><p class="muted">산재 0건이어도 근로복지공단 확인서 등 증빙이 있으면 올려 주세요.</p><div id="plEv">'+plEvHtml()+'</div></div>'
  +'<div class="card"><details class="hist"><summary><b>이행 사례 (가점 · 선택)</b></summary><textarea id="f_plPr" rows="4" style="width:100%;margin-top:8px" placeholder="예) 위험성평가 결과 사다리 작업 → 말비계로 교체 (2025.5)">'+escapeText(pl.practice)+'</textarea></details></div>'
  +'<div class="card" id="sigBox"><h2>대표이사 서명 <span class="req">*</span></h2><p class="muted">방침에 대표이사 서명으로 들어갑니다.</p><canvas id="sigPad" class="sigpad" aria-label="서명 칸 (손가락으로 서명)"></canvas><div class="row" style="justify-content:space-between;margin-top:8px"><span class="muted">'+escapeText(state.company.company)+' 대표이사 '+escapeText(state.company.representative)+'</span><button class="button ghost" type="button" onclick="clearSig()">다시 쓰기</button></div></div>'}
 el.innerHTML='<div class="pbar"><button class="button ghost" type="button" onclick="closePlan()">✕ 닫기</button><b class="pbt">안전보건관리계획서 '+n+'/5</b><span style="width:64px"></span></div><div class="cwrap">'
  +'<div class="plsteps">'+PL_STEPS.map((t,i)=>'<span class="'+(i+1<n?'done':i+1===n?'now':'')+'">'+escapeText(t)+'</span>').join('')+'</div>'+body
  +'<div class="card roomfoot"><div class="row">'+(n>1?'<button class="button ghost" type="button" style="flex:1" onclick="plGo(-1)">이전</button>':'')+(n<5?'<button class="button" type="button" style="flex:2" onclick="plGo(1)">다음</button>':'<button class="button" id="planSave" type="button" style="flex:2" onclick="savePlanNow()">서명하고 작성 완료</button>')+'</div></div></div>';
 el.scrollTop=0;if(n===5)setTimeout(initSig,30)}
function plEvHtml(){return pl.evidenceFiles.map((f,i)=>'<div class="plfile"><span>📎 '+escapeText(f.name)+'</span><button type="button" class="xs" onclick="plEvDel('+i+')" aria-label="빼기">✕</button></div>').join('')+'<label class="button ghost" for="plFile" style="display:block;text-align:center;margin-top:6px">📷 촬영 · 파일 올리기</label><input class="hidefile" type="file" id="plFile" accept="image/*,.pdf,application/pdf" onchange="plUpload()" aria-label="증빙 파일 선택">'}
/** 지금 화면의 입력값을 pl에 담기 */
function plCollect(){if(!pl)return;const n=plStep,v=id=>$('f_'+id)?$('f_'+id).value.trim():null;
 if(n===1){pl.goal=v('plGoal')??pl.goal;pl.kpis=pl.kpis.map((k,i)=>({name:v('plK'+i)??k.name,target:v('plT'+i)??k.target}));const p=v('plPol');if(p!=null)pl.policy=p.split('\n').map(x=>x.trim()).filter(Boolean)}
 if(n===2)pl.org=pl.org.map((o,i)=>({role:i<3?o.role:(v('plR'+i)??o.role),name:v('plN'+i)??o.name,phone:v('plP'+i)??o.phone}));
 if(n===4)pl.hospital=v('plHos')??pl.hospital;
 if(n===5){pl.accidents=pl.years.map((_,i)=>v('plA'+i)??pl.accidents[i]);pl.practice=v('plPr')??pl.practice}
 try{localStorage.setItem(plKey(),JSON.stringify(pl))}catch(e){}}
function plAdd(k){plCollect();pl[k].push(k==='kpis'?{name:'',target:''}:{role:'',name:'',phone:''});renderPlan()}
function plDel(k,i){plCollect();pl[k].splice(i,1);renderPlan()}
function plWork(k,on){plCollect();pl.works=on?[...new Set(pl.works.concat(k))]:pl.works.filter(x=>x!==k);renderPlan()}
function plScen(k,on){plCollect();pl.scen=on?[...new Set(pl.scen.concat(k))]:pl.scen.filter(x=>x!==k);$('plScen').classList.remove('miss','shake')}
function plEvDel(i){pl.evidenceFiles.splice(i,1);$('plEv').innerHTML=plEvHtml()}
async function plUpload(){const inp=$('plFile');try{const f=await readFile(inp.files[0]);const r=await call('uploadPlanFile',f);plCollect();pl.evidenceFiles.push(r);$('plEv').innerHTML=plEvHtml();msg('증빙을 올렸습니다.')}catch(e){if(e&&e.message&&!/권한|올릴 수/.test(e.message))alert(e.message)}finally{if(inp)inp.value=''}}
/** 단계 이동 (다음은 빈 칸 확인) */
function plGo(d){plCollect();if(d>0){const m=plMiss(plStep);if(m.length){inspFlag(m,'빨간 칸을 채워 주세요');return}}plStep=Math.max(1,Math.min(5,plStep+d));renderPlan()}
function plMiss(n){const m=[];if(n===1){if(!pl.goal)m.push('f_plGoal');if(!pl.kpis.some(k=>k.name))m.push(pl.kpis.length?'f_plK0':'f_plGoal')}
 if(n===2)[0,1,2].forEach(i=>{if(!(pl.org[i]||{}).name)m.push('f_plN'+i)});if(n===3&&!pl.works.length)m.push('plWorks');if(n===4&&!pl.scen.length)m.push('plScen');
 if(n===5){pl.accidents.forEach((a,i)=>{if(a==='')m.push('f_plA'+i)});if(!sigDirty)m.push('sigBox')}return m}
async function savePlanNow(){plCollect();const m=plMiss(5);if(m.length){inspFlag(m,m[0]==='sigBox'?'대표이사 서명을 해 주세요':'최근 3년 산재 건수를 적어 주세요 (없으면 0)');return}
 for(let i=1;i<=4;i++)if(plMiss(i).length){plStep=i;renderPlan();setTimeout(()=>inspFlag(plMiss(i),PL_STEPS[i-1]+' 단계에 빈 칸이 있습니다'),50);return}
 const sg=sigData();if(!sg){sigBad();inspFlag(['sigBox'],'서명 칸을 다시 준비했습니다. 한 번 더 서명해 주세요');return}
 if(!await askOk('안전보건관리계획서 작성 완료','위험작업 '+pl.works.length+'개 · 비상 시나리오 '+pl.scen.length+'개 · 증빙 '+pl.evidenceFiles.length+'건\n\n서명이 들어간 PDF가 만들어져 제출 서류로 등록됩니다.','작성 완료'))return;
 const before=((((state.docBoard||{}).rows||[]).find(x=>x.code==='C02')||{}).uploads||[]).length;const btn=$('planSave');if(btn){btn.disabled=true;btn.textContent='계획서를 만드는 중… (20초 정도)'}
 const d=Object.assign({},pl,{evidence:pl.evidenceFiles.map(f=>f.id)});delete d.evidenceFiles;
 const ok=s=>{try{localStorage.removeItem(plKey())}catch(z){}const el=$('csheet');if(el)el.style.display='none';document.body.style.overflow='';pl=null;display(s)};
 try{const s=await call('savePlanDoc',d,sg);ok(s);setTimeout(()=>$('row_docC02')?.scrollIntoView({block:'center'}),100);msg('안전보건관리계획서 작성 완료 · 제출 서류로 등록했습니다.')}
 catch(e){/* F1.7f 응답만 사라진 경우(시간 초과·연결 끊김)도 실제로 등록됐는지 확인 · 실패 이유는 창으로 보여 줌 (예전: 4초 안내만 뜨고 사라짐) */
  if(LOST_RE.test(e&&e.message||'')){try{const s=await callQuiet('portalData');const r=((s.docBoard&&s.docBoard.rows)||[]).find(x=>x.code==='C02');if(r&&r.uploads.length>before){ok(s);msg('안전보건관리계획서가 등록되었습니다.');return}}catch(x){}}
  if(btn){btn.disabled=false;btn.textContent='서명하고 작성 완료'}showErr('계획서를 등록하지 못했습니다',e)}}
