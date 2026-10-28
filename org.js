/* =====================================================================
 * F1.9g 조직·구성원 관리 (마스터) — ☰ [조직·구성원 관리]
 *  ① 조직도: 경영진 · 본부 → 부문 → 부 → 팀 (이름 바꾸기 · 아래 단계 추가 · 순서 · 옮기기 · 삭제)
 *  ② 구성원: 팀별 표 · 이름 · 직책 · 연락처 · 회사 이메일 · 로그인 Gmail · 앱 권한
 *  ③ 도급인 책임자: 안전보건총괄책임자 · 위임받는 책임자(현장대리인) · 공사 담당자를 구성원에서 고름
 *  저장: SETTINGS/org(조직도) · ORG_MEMBERS(구성원) · 앱 권한은 STAFF(로그인 명단)에 자동으로 맞춤
 * ===================================================================== */
let orgD=null,orgTab=1,orgEdit=null,orgQ='',orgMem=null;
const ORG_KINDS=['경영진','본부','부문','부','팀'],ORG_ROLES={SAFETY:'안전보건팀',CLIENT:'도급인 담당자',NONE:'앱 사용 안 함'},ORG_ROLE_SUB={SAFETY:' (전체 · 관리)',CLIENT:' (자기 공사만)',NONE:' (조직도에만 표시)'},ORG_TAG={SAFETY:'bad',CLIENT:'lock',NONE:'todo'};
function orgCss(){if($('orgCss'))return;const s=document.createElement('style');s.id='orgCss';s.textContent=
 '.orgnode{display:flex;align-items:center;gap:6px;padding:8px 0;border-top:1px solid var(--line);flex-wrap:wrap}.orglv{font-size:11px;color:var(--sub);background:var(--bg);border-radius:6px;padding:1px 6px;flex:none}'
 +'.orgact{margin-left:auto;display:flex;gap:4px}.orgact .xs{min-width:30px;min-height:30px}.orgform{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:8px 0;border-top:1px solid var(--line)}'
 +'.orgform select,.orgform input{padding:8px;border:1px solid var(--line);border-radius:8px;font:inherit}.orgform input{flex:1;min-width:120px}'
 +'.orgtb{width:100%;border-collapse:collapse;font-size:13px}.orgtb th{font-size:12px;color:var(--sub);font-weight:600;text-align:left;padding:6px 4px;border-bottom:2px solid var(--main)}.orgtb td{padding:8px 4px;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}'
 +'.orgtb tr.g td{background:var(--bg);font-weight:700;font-size:12px;padding:5px 4px}.orgpv{background:var(--bg);border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.7}';document.head.appendChild(s)}
async function orgLoad(){orgCss();if(orgD)orgRender();else $('staff').innerHTML='<div class="card"><p class="desc">불러오는 중입니다…</p></div>';try{orgD=await call('orgGet');orgRender()}catch(e){}}
const orgKids=p=>orgD.units.filter(u=>(u.parent||'')===(p||''));
function orgPath(id){const L=[];let u=orgD.units.find(x=>x.id===id),g=0;while(u&&g++<12){L.unshift(u.name);const p=u.parent;u=orgD.units.find(x=>x.id===p)}return L}
function orgFlat(){const out=[],walk=(p,d)=>orgKids(p).forEach(u=>{out.push([u,d]);walk(u.id,d+1)});walk('',0);return out}
function orgBelow(id){const s=new Set([id]);let ch=true;while(ch){ch=false;orgD.units.forEach(u=>{if(s.has(u.parent)&&!s.has(u.id)){s.add(u.id);ch=true}})}return s}
const orgCount=id=>{const s=orgBelow(id);return orgD.members.filter(m=>s.has(m.unitId)).length};
function orgRender(){const el=$('staff');if(!el||!orgD)return;orgCss();
 el.innerHTML='<div class="card"><div class="vh-top"><h2 style="margin:0">조직·구성원 관리</h2><span class="pill ok">마스터</span></div><p class="muted" style="margin-top:6px">회사 조직도와 구성원을 관리합니다. 앱 권한(안전보건팀 · 도급인 담당자)도 여기서 줍니다.</p>'
  +'<div class="seg" role="tablist" style="margin-top:10px">'+[[1,'① 조직도'],[2,'② 구성원'],[3,'③ 도급인 책임자']].map(([k,l])=>'<button type="button" role="tab" aria-selected="'+(orgTab===k)+'" class="'+(orgTab===k?'on':'')+'" onclick="orgTab='+k+';orgEdit=null;orgMem=null;orgRender()">'+l+'</button>').join('')+'</div></div>'
  +(orgTab===1?orgTreeHtml():orgTab===2?orgMemHtml():orgPrHtml());
 if(orgTab===3)orgPrPv();if(orgEdit)setTimeout(()=>$('f_ouName')?.focus(),30)}
/* ---------- ① 조직도 ---------- */
function orgTreeHtml(){const F=orgFlat(),isAdd=p=>orgEdit&&orgEdit.mode==='add'&&(orgEdit.parent||'')===p;
 return '<div class="card"><div class="row" style="justify-content:space-between"><b>조직도</b><button class="button ghost" type="button" style="padding:6px 10px" onclick="orgEdit={mode:\'add\',parent:\'\'};orgRender()">+ 맨 위에 추가</button></div>'
  +'<p class="muted" style="margin:4px 0 6px">✎ 이름·단계·위치 바꾸기 · + 아래 단계 추가 · ↑↓ 순서 · 🗑 삭제 (사람·아래 조직이 없을 때만). 이름을 바꾸면 구성원 소속 표시도 같이 바뀝니다.</p>'
  +(isAdd('')?orgUnitForm():'')
  +F.map(([u,d])=>{const n=orgCount(u.id),ed=orgEdit&&orgEdit.mode==='edit'&&orgEdit.id===u.id;
   return (ed?'<div style="padding-left:'+(d*16)+'px">'+orgUnitForm(u)+'</div>'
    :'<div class="orgnode" style="padding-left:'+(d*16)+'px">'+(d?'<span class="muted" aria-hidden="true">└</span>':'')+'<span class="orglv">'+escapeText(u.kind)+'</span><b>'+escapeText(u.name)+'</b>'+(n?' <span class="muted">'+n+'명</span>':'')
    +'<span class="orgact"><button type="button" class="xs" aria-label="'+escapeText(u.name)+' 고치기" onclick="orgEdit={mode:\'edit\',id:\''+u.id+'\'};orgRender()">✎</button><button type="button" class="xs" aria-label="'+escapeText(u.name)+' 아래에 추가" onclick="orgEdit={mode:\'add\',parent:\''+u.id+'\'};orgRender()">+</button>'
    +'<button type="button" class="xs" aria-label="위로" onclick="orgMove(\''+u.id+'\',-1)">↑</button><button type="button" class="xs" aria-label="아래로" onclick="orgMove(\''+u.id+'\',1)">↓</button><button type="button" class="xs" aria-label="'+escapeText(u.name)+' 삭제" onclick="orgDel(\''+u.id+'\')">🗑</button></span></div>')
    +(isAdd(u.id)?'<div style="padding-left:'+((d+1)*16)+'px">'+orgUnitForm()+'</div>':'')}).join('')+'</div>'}
function orgDefKind(){const p=orgEdit&&orgEdit.parent&&orgD.units.find(x=>x.id===orgEdit.parent);if(!p)return '본부';const i=ORG_KINDS.indexOf(p.kind);return ORG_KINDS[Math.min(ORG_KINDS.length-1,Math.max(1,i+1))]}
function orgUnitForm(u){const no=u?orgBelow(u.id):new Set();
 return '<div class="orgform"><select id="f_ouKind" aria-label="단계">'+ORG_KINDS.map(k=>'<option '+((u?u.kind:orgDefKind())===k?'selected':'')+'>'+k+'</option>').join('')+'</select>'
  +'<input id="f_ouName" value="'+escapeText(u?u.name:'')+'" placeholder="조직 이름" aria-label="조직 이름" maxlength="40" onkeydown="if(event.key===\'Enter\')orgUnitSave()">'
  +(u?'<select id="f_ouParent" aria-label="위치 (위 조직)"><option value="">맨 위</option>'+orgFlat().filter(([x])=>!no.has(x.id)).map(([x,d])=>'<option value="'+x.id+'" '+(u.parent===x.id?'selected':'')+'>'+'　'.repeat(d)+escapeText(x.name)+' 아래</option>').join('')+'</select>':'')
  +'<button class="button" type="button" style="padding:7px 12px" onclick="orgUnitSave()">저장</button><button class="button ghost" type="button" style="padding:7px 10px" onclick="orgEdit=null;orgRender()">취소</button></div>'}
async function orgUnitSave(){const name=value('ouName'),kind=$('f_ouKind').value;if(!name){inspFlag(['f_ouName'],'이름을 적어 주세요');return}
 const U=orgD.units.map(x=>({...x}));
 if(orgEdit.mode==='edit'){const u=U.find(x=>x.id===orgEdit.id);u.name=name;u.kind=kind;if($('f_ouParent'))u.parent=$('f_ouParent').value}
 else U.push({id:'U-'+Math.random().toString(36).slice(2,10).toUpperCase(),name,kind,parent:orgEdit.parent||''});
 orgSaveUnits(U)}
async function orgSaveUnits(U){try{orgD=await call('orgSaveUnits',U);orgEdit=null;orgRender();msg('조직도를 저장했습니다.')}catch(e){}}
function orgMove(id,d){const U=orgD.units.map(x=>({...x})),u=U.find(x=>x.id===id),sib=U.filter(x=>(x.parent||'')===(u.parent||'')),i=sib.indexOf(u),j=i+d;if(j<0||j>=sib.length)return;const a=U.indexOf(sib[i]),b=U.indexOf(sib[j]);[U[a],U[b]]=[U[b],U[a]];orgSaveUnits(U)}
async function orgDel(id){const u=orgD.units.find(x=>x.id===id);if(!u)return;
 if(orgD.units.some(x=>x.parent===id)){popup('삭제할 수 없습니다',u.name+' 아래에 조직이 있습니다. 아래 조직부터 지우거나 ✎로 위치를 옮겨 주세요.','확인');return}
 if(orgD.members.some(m=>m.unitId===id)){popup('삭제할 수 없습니다',u.name+'에 구성원이 있습니다. ② 구성원에서 소속을 먼저 바꿔 주세요.','확인');return}
 if(!await askOk('조직 삭제',u.name+'을(를) 조직도에서 지울까요?','삭제'))return;orgSaveUnits(orgD.units.filter(x=>x.id!==id))}
/* ---------- ② 구성원 ---------- */
function orgMemHtml(){return '<div class="card"><div class="row" style="gap:6px"><input id="f_orgQ" value="'+escapeText(orgQ)+'" placeholder="이름·팀·이메일 검색" aria-label="구성원 검색" oninput="orgQ=this.value;$(\'orgMemBox\').innerHTML=orgMemTable()" style="flex:1;min-width:140px;padding:10px;border:1px solid var(--line);border-radius:9px;font:inherit">'
  +'<button class="button" type="button" onclick="orgMem={};orgRender()">+ 구성원 추가</button></div>'+(orgMem&&!orgMem.id?orgMemForm({}):'')+'</div>'
  +'<div class="card" style="padding:12px"><div id="orgMemBox">'+orgMemTable()+'</div><p class="muted" style="margin:8px 2px 0">이름을 누르면 고칠 수 있습니다 · 권한: '+Object.entries(ORG_ROLES).map(([k,v])=>'<span class="pill '+ORG_TAG[k]+'">'+v+'</span>').join(' ')+'</p></div>'}
function orgMemTable(){const q=orgQ.trim().toLowerCase(),hit=m=>!q||[m.name,m.title,m.phone,m.companyEmail,m.gmail,orgPath(m.unitId).join(' ')].join(' ').toLowerCase().includes(q);let rows='';
 orgFlat().forEach(([u])=>{const L=orgD.members.filter(m=>m.unitId===u.id&&hit(m));if(L.length)rows+='<tr class="g"><td colspan="3">'+escapeText(orgPath(u.id).join(' › '))+'</td></tr>'+L.map(orgMemRow).join('')});
 const lost=orgD.members.filter(m=>!orgD.units.some(u=>u.id===m.unitId)&&hit(m));if(lost.length)rows+='<tr class="g"><td colspan="3" class="req">소속 없음 · 이름을 눌러 소속을 골라 주세요</td></tr>'+lost.map(orgMemRow).join('');
 return '<table class="orgtb"><thead><tr><th>이름 · 직책</th><th>연락처 · 이메일</th><th style="width:84px">권한</th></tr></thead><tbody>'+(rows||'<tr><td colspan="3" class="muted">'+(q?'검색 결과가 없습니다.':'아직 구성원이 없습니다. [+ 구성원 추가]를 눌러 주세요.')+'</td></tr>')+'</tbody></table>'}
function orgMemRow(m){const ed=orgMem&&orgMem.id===m.id;
 return '<tr><td><button type="button" class="linkbtn" style="font-weight:700;font-size:14px" onclick="orgMem={id:\''+m.id+'\'};orgRender()" aria-expanded="'+ed+'">'+escapeText(m.name)+'</button><div class="muted">'+escapeText(m.title)+(m.gmail===orgD.me?' · <b>나</b>':'')+'</div></td>'
  +'<td>'+escapeText(m.phone||'-')+'<div class="muted">'+escapeText(m.companyEmail||'회사 이메일 없음')+(m.gmail?'<br>로그인 '+escapeText(m.gmail):'')+'</div></td><td><span class="pill '+ORG_TAG[m.role]+'">'+ORG_ROLES[m.role]+'</span></td></tr>'
  +(ed?'<tr><td colspan="3">'+orgMemForm(m)+'</td></tr>':'')}
function orgMemForm(m){return '<div style="margin-top:10px;border-top:1px solid var(--line);padding-top:6px"><div class="field"><label for="f_omUnit">소속 <span class="req">*</span></label><select id="f_omUnit"><option value="">소속 고르기</option>'
  +orgFlat().map(([u,d])=>'<option value="'+u.id+'" '+(m.unitId===u.id?'selected':'')+'>'+'　'.repeat(d)+escapeText(u.name)+' ('+escapeText(u.kind)+')</option>').join('')+'</select></div>'
  +'<div class="split">'+input('omName','이름 *',m.name||'','text',false,'홍길동')+input('omTitle','직책 *',m.title||'','text',false,'예: 대표이사, 부장, 팀장, 과장')+input('omPhone','연락처',m.phone||'','tel',false,'숫자만 입력 (- 자동)')+input('omMail','회사 이메일 (알림 · Teams용)',m.companyEmail||'','email',false,'name@daiso.co.kr')+input('omGmail','로그인 Gmail (앱 접속용 · 개인 Google 계정)',m.gmail||'','email',false,'name@gmail.com')+'</div>'
  +'<div class="field"><label for="f_omRole">앱 권한</label><select id="f_omRole">'+Object.entries(ORG_ROLES).map(([k,v])=>'<option value="'+k+'" '+((m.role||'CLIENT')===k?'selected':'')+'>'+v+ORG_ROLE_SUB[k]+'</option>').join('')+'</select><p class="muted" style="margin:4px 0 0">앱을 쓰려면 로그인 Gmail이 꼭 있어야 합니다. 퇴사·이동하면 [앱 사용 안 함]으로 바꿔 주세요.</p></div>'
  +'<div class="row"><button class="button" type="button" onclick="orgMemSave(\''+(m.id||'')+'\')">저장</button><button class="button ghost" type="button" onclick="orgMem=null;orgRender()">취소</button>'+(m.id&&m.gmail!==orgD.me?'<button class="button ghost danger" type="button" onclick="orgMemDel(\''+m.id+'\')">삭제</button>':'')+'</div></div>'}
async function orgMemSave(id){const d={id,unitId:$('f_omUnit').value,name:value('omName'),title:value('omTitle'),phone:value('omPhone'),companyEmail:value('omMail'),gmail:value('omGmail'),role:$('f_omRole').value},miss=[];
 if(!d.unitId)miss.push('f_omUnit');if(!d.name)miss.push('f_omName');if(!d.title)miss.push('f_omTitle');if(d.role!=='NONE'&&!d.gmail)miss.push('f_omGmail');
 if(miss.length){inspFlag(miss,miss.includes('f_omGmail')&&miss.length===1?'앱을 쓰려면 로그인 Gmail을 적어 주세요':'빨간 칸을 채워 주세요');return}
 try{orgD=await call('orgSaveMember',d);orgMem=null;orgRender();msg('저장했습니다.')}catch(e){}}
async function orgMemDel(id){const m=orgD.members.find(x=>x.id===id);if(!m)return;if(!await askOk('구성원 삭제',m.name+' '+m.title+'을(를) 삭제할까요?'+(m.role!=='NONE'?'\n앱 로그인 권한도 같이 없어집니다.':''),'삭제'))return;
 try{orgD=await call('orgDeleteMember',id);orgMem=null;orgRender();msg('삭제했습니다.')}catch(e){}}
/* ---------- ③ 도급인 책임자 ---------- */
const ORG_PR=[['ceo','안전보건총괄책임자 (위임인)',''],['delegate','위임받는 책임자 (도급인 현장대리인)','마스터만 수정'],['manager','공사 담당자 (선택)','']];
function orgPrHtml(){const P=orgD.principal||{};
 return ORG_PR.map(([k,l,tag])=>{const p=P[k]||{},cur=p.memberId||'';
  return '<div class="card" oninput="orgPrPv()"><b>'+l+'</b>'+(tag?' <span class="pill bad">'+tag+'</span>':'')
   +'<div class="field"><label for="f_prm_'+k+'">사람 (구성원에서 고르기)</label><select id="f_prm_'+k+'" onchange="orgPrPick(\''+k+'\')"><option value="">'+(k==='manager'?'비워 두기 (버튼을 누른 사람 이름)':'구성원에 없음 · 아래에 직접 적기')+'</option>'
   +orgFlat().map(([u])=>orgD.members.filter(m=>m.unitId===u.id).map(m=>'<option value="'+m.id+'" '+(cur===m.id?'selected':'')+'>'+escapeText(m.name+' · '+m.title+' · '+u.name)+'</option>').join('')).join('')+'</select></div>'
   +'<div class="split">'+input('pr_'+k+'_name','성명',p.name||'')+input('pr_'+k+'_rank','직급',p.rank||'',"text",false,'예: 대표이사, 부장')+input('pr_'+k+'_title','표기 직함 (문서에 들어감)',p.title||'','text',false,k==='ceo'?'안전보건총괄책임자':'예: 인테리어부장')+input('pr_'+k+'_org','소속',p.org||'')+'</div></div>'}).join('')
  +'<div class="card"><div class="orgpv" id="prPv"></div><p class="muted" style="margin:8px 0 0">들어가는 곳: 협의체·합동점검 위임장 · 규정 "갑" 현장대리인 · 순회점검일지 승인 · 회의록·점검표 머리</p></div>'
  +'<div class="card roomfoot"><button class="button" type="button" style="width:100%" onclick="orgPrSave()">저장</button></div>'}
function orgPrPick(k){const id=$('f_prm_'+k).value,m=orgD.members.find(x=>x.id===id);if(!m){orgPrPv();return}
 $('f_pr_'+k+'_name').value=m.name;$('f_pr_'+k+'_rank').value=m.title;$('f_pr_'+k+'_org').value=orgPath(m.unitId).join(' ');
 if(!$('f_pr_'+k+'_title').value&&k!=='manager')$('f_pr_'+k+'_title').value=k==='ceo'?'안전보건총괄책임자':(orgPath(m.unitId).slice(-1)[0]||'')+(/장$/.test(m.title)?'장':'');orgPrPv()}
function orgPrVal(k){return {memberId:$('f_prm_'+k)?.value||'',name:value('pr_'+k+'_name'),rank:value('pr_'+k+'_rank'),title:value('pr_'+k+'_title'),org:value('pr_'+k+'_org')}}
function orgPrPv(){const b=$('prPv');if(!b)return;const c=orgPrVal('ceo'),d=orgPrVal('delegate'),m=orgPrVal('manager');
 b.innerHTML='<b>문서에 이렇게 들어갑니다</b><br>'+escapeText(c.title||'안전보건총괄책임자')+' <b>'+escapeText([c.name,c.rank].filter(Boolean).join(' ')||'-')+'</b> → 위임 <b>'+escapeText([d.name,d.rank].filter(Boolean).join(' ')||'-')+'</b>'
  +'<br>소속: '+escapeText(d.org||'-')+'<br>규정 "갑": 아성다이소 현장대리인 <b>'+escapeText(d.name||'-')+'</b>'+(d.title?' ('+escapeText(d.title)+')':'')+(m.name?'<br>공사 담당자: '+escapeText([m.name,m.rank].filter(Boolean).join(' ')):'')}
async function orgPrSave(){const d={};ORG_PR.forEach(([k])=>d[k]=orgPrVal(k));const miss=[];if(!d.ceo.name)miss.push('f_pr_ceo_name');if(!d.delegate.name)miss.push('f_pr_delegate_name');if(miss.length){inspFlag(miss,'총괄책임자와 위임받는 책임자 이름은 꼭 적어 주세요');return}
 if(!await askOk('도급인 책임자 저장','총괄책임자 '+[d.ceo.name,d.ceo.rank].filter(Boolean).join(' ')+'\n→ 위임 '+[d.delegate.name,d.delegate.rank].filter(Boolean).join(' ')+'\n\n앞으로 만드는 위임장 · 규정 · 회의록에 이 이름이 들어갑니다.','저장'))return;
 try{const P=await call('principalSave',d);orgD.principal=P;if(typeof jobData!=='undefined'&&jobData){jobData.principal=P;jobAt=0}orgRender();msg('도급인 책임자를 저장했습니다. 위임장·규정·회의록에 바로 반영됩니다.')}catch(e){}}
