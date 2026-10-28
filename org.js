/* =====================================================================
 * F1.9j 조직도 (마스터) — ☰ [조직도]
 *  왼쪽 = 조직 폴더 (누르면 오른쪽에 그 조직 사람 · 다시 누르면 아래 조직 펼치기/접기)
 *  오른쪽 = [+ 사람] [+ 아래 조직] [✎] · 사람을 누르면 그 자리에서 고치기
 *  권한은 자동: 안전보건팀(과 그 아래) = 안전보건팀 · 그 외 = 도급인 담당자 · 로그인 Gmail이 없으면 앱 접속 안 함
 *  위임장·규정에 들어가는 사람(안전보건총괄책임자 · 현장대리인)은 사람 입력 칸에서 지정
 *  저장: SETTINGS/org(조직) · ORG_MEMBERS(사람) · STAFF(로그인 명단은 자동으로 맞춤) · SETTINGS/principal(책임자)
 * ===================================================================== */
let orgD=null,orgSel='',orgOpen=new Set(),orgF=null,orgUF=null;
/* 예전 화면에서 쓰던 이름 (메뉴·다른 화면이 불러도 오류 없게) */
let orgTab=1,orgEdit=null,orgMem=null;
const ORG_PK={ceo:'총괄책임자',delegate:'현장대리인'};
function orgCss(){if($('orgCss'))return;const s=document.createElement('style');s.id='orgCss';s.textContent=
 '.ogw{display:flex;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;min-height:62vh}'
 +'.ogs{width:36%;max-width:250px;flex:none;background:#f8f9fb;border-right:1px solid var(--line);padding:6px 3px;overflow-y:auto;max-height:78vh}'
 +'.ogsh{display:flex;justify-content:space-between;align-items:center;padding:2px 6px 6px;font-size:12px;font-weight:700;color:var(--sub)}'
 +'.ogf{display:flex;gap:3px;align-items:flex-start;width:100%;border:0;background:none;text-align:left;font:inherit;font-size:12.5px;line-height:1.35;color:var(--text);padding:6px 5px;border-radius:7px;cursor:pointer;word-break:keep-all;overflow-wrap:anywhere}'
 +'.ogf:hover{background:#eef0f4}.ogf.on{background:var(--main);color:#fff}.ogf .ic{flex:none;width:12px;color:#9ca3af;font-size:10px;padding-top:2px}.ogf.on .ic{color:#fff}'
 +'.ogm{flex:1;min-width:0;padding:10px}.ogp{font-size:11px;color:var(--sub);word-break:keep-all;overflow-wrap:anywhere}.ogt{font-size:15px;font-weight:700;margin:1px 0 8px;word-break:keep-all;overflow-wrap:anywhere}'
 +'.ogbar{display:flex;gap:4px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid var(--line)}.ogbar .button{padding:6px 9px;font-size:12px;border-radius:8px;min-height:0}'
 +'.ogr{display:flex;align-items:center;gap:8px;width:100%;border:0;border-bottom:1px solid #f0f1f4;background:none;text-align:left;font:inherit;color:inherit;padding:9px 2px;cursor:pointer}.ogr:hover{background:#fafafa}'
 +'.ogav{width:30px;height:30px;border-radius:50%;background:#eef0f4;color:#374457;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex:none}'
 +'.ognm{min-width:0;flex:1}.ognm b{font-size:13.5px}.ognm .t{font-size:12px;color:var(--sub);margin-left:4px}.ognm div{font-size:11.5px;color:var(--sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
 +'.ogmk{flex:none;font-size:10.5px;border:1px solid var(--main);color:var(--main);border-radius:20px;padding:0 6px;white-space:nowrap}'
 +'.ogfm{border:2px solid var(--main);border-radius:12px;padding:8px 10px;margin:8px 0}.ogfm .field{margin:6px 0}.ogfm .field label{font-size:12px}.ogfm input,.ogfm select{padding:9px;font-size:14px}'
 +'.ogfm .split{grid-template-columns:1fr 1fr;gap:0 8px}'
 +'@media(min-width:700px){.ogf{font-size:13.5px}.ogt{font-size:17px}.ogbar .button{font-size:13px;padding:7px 11px}.ognm b{font-size:14.5px}}';document.head.appendChild(s)}
async function orgLoad(){orgCss();if(orgD)orgRender();else $('staff').innerHTML='<div class="card"><p class="desc">불러오는 중입니다…</p></div>';try{orgD=await call('orgGet');if(!orgSel||!orgD.units.some(u=>u.id===orgSel)){const f=orgD.units.find(u=>!u.parent);orgSel=f?f.id:''}orgRender()}catch(e){}}
const orgKids=p=>orgD.units.filter(u=>(u.parent||'')===(p||''));
function orgPath(id){const L=[];let u=orgD.units.find(x=>x.id===id),g=0;while(u&&g++<12){L.unshift(u.name);const p=u.parent;u=orgD.units.find(x=>x.id===p)}return L}
function orgBelow(id){const s=new Set([id]);let ch=true;while(ch){ch=false;orgD.units.forEach(u=>{if(s.has(u.parent)&&!s.has(u.id)){s.add(u.id);ch=true}})}return s}
function orgFlat(){const out=[],walk=(p,d)=>orgKids(p).forEach(u=>{out.push([u,d]);walk(u.id,d+1)});walk('',0);return out}
function orgRender(){const el=$('staff');if(!el||!orgD)return;orgCss();
 /* 고른 조직의 위 조직은 펼쳐 둠 */let u=orgD.units.find(x=>x.id===orgSel),g=0;while(u&&u.parent&&g++<12){orgOpen.add(u.parent);const p=u.parent;u=orgD.units.find(x=>x.id===p)}
 el.innerHTML='<div class="ogw"><nav class="ogs" aria-label="조직"><div class="ogsh"><span>조직</span><button class="xs" type="button" aria-label="맨 위 조직 추가" onclick="orgUF={mode:\'top\'};orgF=null;orgRender()">+</button></div>'+orgTree('',0)+'</nav>'
  +'<section class="ogm" aria-live="polite">'+orgMain()+'</section></div>';
 if(orgUF||orgF)setTimeout(()=>$(orgUF?'f_ouName':'f_omName')?.focus(),30)}
function orgTree(p,d){return orgKids(p).map(u=>{const kids=orgKids(u.id).length,op=orgOpen.has(u.id);
 return '<button type="button" class="ogf'+(orgSel===u.id?' on':'')+'" style="padding-left:'+(5+d*11)+'px" '+(kids?'aria-expanded="'+op+'"':'')+' onclick="orgPick(\''+u.id+'\')"><span class="ic" aria-hidden="true">'+(kids?(op?'▼':'▶'):'')+'</span><span>📁 '+escapeText(u.name)+'</span></button>'+(kids&&op?orgTree(u.id,d+1):'')}).join('')}
function orgPick(id){if(orgSel===id&&orgKids(id).length){orgOpen.has(id)?orgOpen.delete(id):orgOpen.add(id)}else{orgSel=id;if(orgKids(id).length)orgOpen.add(id)}orgF=null;orgUF=null;orgRender()}
function orgMain(){const u=orgD.units.find(x=>x.id===orgSel);
 if(orgUF&&orgUF.mode==='top')return orgUnitForm();
 if(!u)return '<p class="muted">왼쪽에서 조직을 고르거나 [+]로 조직을 만들어 주세요.</p>';
 const L=orgD.members.filter(m=>m.unitId===u.id);
 return '<div class="ogp">'+escapeText(orgPath(u.id).slice(0,-1).join(' › '))+'</div><div class="ogt">'+escapeText(u.name)+'</div>'
  +'<div class="ogbar"><button class="button" type="button" onclick="orgF={};orgUF=null;orgRender()">+ 사람</button><button class="button ghost" type="button" onclick="orgUF={mode:\'sub\'};orgF=null;orgRender()">+ 아래 조직</button><button class="button ghost" type="button" aria-label="조직 이름 바꾸기 · 옮기기 · 삭제" onclick="orgUF={mode:\'edit\'};orgF=null;orgRender()">✎</button></div>'
  +(orgUF?orgUnitForm(u):'')+(orgF&&!orgF.id?orgMemForm({unitId:u.id}):'')
  +(L.map(m=>orgF&&orgF.id===m.id?orgMemForm(m):'<button type="button" class="ogr" onclick="orgF={id:\''+m.id+'\'};orgUF=null;orgRender()"><span class="ogav" aria-hidden="true">'+escapeText((m.name||'?').slice(0,1))+'</span><span class="ognm"><b>'+escapeText(m.name)+'</b><span class="t">'+escapeText(m.title)+'</span><div>'+escapeText(m.companyEmail||m.phone||' ')+'</div></span>'+(m.pk?'<span class="ogmk">'+ORG_PK[m.pk]+'</span>':'')+'</button>').join('')
   ||(orgF?'':'<p class="muted" style="margin-top:12px">아직 사람이 없습니다. [+ 사람]으로 넣어 주세요.</p>'))}
/* ---------- 조직 만들기 · 이름 바꾸기 · 옮기기 · 삭제 ---------- */
function orgUnitForm(u){const m=orgUF.mode,ed=m==='edit',no=ed?orgBelow(u.id):new Set();
 return '<div class="ogfm"><b style="font-size:13px">'+(m==='top'?'맨 위 조직 추가':m==='sub'?escapeText(u.name)+' 아래에 조직 추가':'조직 고치기')+'</b>'
  +input('ouName','조직 이름',ed?u.name:'','text',false,'예: 인테리어3팀')
  +(ed?'<div class="field"><label for="f_ouParent">위치</label><select id="f_ouParent"><option value="">맨 위</option>'+orgFlat().filter(([x])=>!no.has(x.id)).map(([x,d])=>'<option value="'+x.id+'" '+(u.parent===x.id?'selected':'')+'>'+'　'.repeat(d)+escapeText(x.name)+' 아래</option>').join('')+'</select></div>':'')
  +'<div class="row" style="gap:6px"><button class="button" type="button" style="flex:1" onclick="orgUnitSave()">저장</button><button class="button ghost" type="button" onclick="orgUF=null;orgRender()">취소</button>'+(ed?'<button class="button ghost danger" type="button" onclick="orgDel(\''+u.id+'\')">삭제</button>':'')+'</div></div>'}
async function orgUnitSave(){const name=value('ouName');if(!name){inspFlag(['f_ouName'],'조직 이름을 적어 주세요');return}
 const U=orgD.units.map(x=>({...x})),m=orgUF.mode;let sel=orgSel;
 if(m==='edit'){const u=U.find(x=>x.id===orgSel);u.name=name;if($('f_ouParent'))u.parent=$('f_ouParent').value}
 else{const id='U-'+Math.random().toString(36).slice(2,10).toUpperCase();U.push({id,name,kind:'',parent:m==='sub'?orgSel:''});if(m==='sub')orgOpen.add(orgSel);sel=id}
 try{orgD=await call('orgSaveUnits',U);orgSel=sel;orgUF=null;orgRender();msg('조직을 저장했습니다.')}catch(e){}}
async function orgDel(id){const u=orgD.units.find(x=>x.id===id);if(!u)return;
 if(orgKids(id).length){popup('삭제할 수 없습니다',u.name+' 아래에 조직이 있습니다. 아래 조직부터 지우거나 옮겨 주세요.','확인');return}
 if(orgD.members.some(m=>m.unitId===id)){popup('삭제할 수 없습니다',u.name+'에 사람이 있습니다. 사람을 다른 조직으로 옮기거나 삭제해 주세요.','확인');return}
 if(!await askOk('조직 삭제',u.name+'을(를) 지울까요?','삭제'))return;
 try{orgD=await call('orgSaveUnits',orgD.units.filter(x=>x.id!==id));orgSel=u.parent||((orgD.units.find(x=>!x.parent)||{}).id||'');orgUF=null;orgRender();msg('삭제했습니다.')}catch(e){}}
/* ---------- 사람 ---------- */
function orgMemForm(m){return '<div class="ogfm"><b style="font-size:13px">'+(m.id?'고치기 · '+escapeText(m.name):'사람 추가')+'</b>'
  +'<div class="split">'+input('omName','이름 *',m.name||'','text',false,'홍길동')+input('omTitle','직책 *',m.title||'','text',false,'예: 팀장')+'</div>'
  +input('omPhone','연락처',m.phone||'','tel',false,'숫자만 (- 자동)')+input('omMail','회사 이메일',m.companyEmail||'','email',false,'name@daiso.co.kr')+input('omGmail','로그인 Gmail (앱 쓸 사람만)',m.gmail||'','email',false,'name@gmail.com')
  +(m.id?'<div class="field"><label for="f_omUnit">소속 조직</label><select id="f_omUnit">'+orgFlat().map(([u,d])=>'<option value="'+u.id+'" '+(m.unitId===u.id?'selected':'')+'>'+'　'.repeat(d)+escapeText(u.name)+'</option>').join('')+'</select></div>':'')
  +'<div class="field"><label for="f_omPk">위임장·규정에 들어가는 사람</label><select id="f_omPk"><option value="">해당 없음</option><option value="delegate" '+(m.pk==='delegate'?'selected':'')+'>현장대리인 (위임받는 책임자)</option><option value="ceo" '+(m.pk==='ceo'?'selected':'')+'>안전보건총괄책임자</option></select></div>'
  +'<div class="row" style="gap:6px"><button class="button" type="button" style="flex:1" onclick="orgMemSave(\''+(m.id||'')+'\',\''+escapeText(m.unitId||orgSel)+'\')">저장</button><button class="button ghost" type="button" onclick="orgF=null;orgRender()">취소</button>'+(m.id&&m.gmail!==orgD.me?'<button class="button ghost danger" type="button" onclick="orgMemDel(\''+m.id+'\')">삭제</button>':'')+'</div></div>'}
async function orgMemSave(id,unitId){const pk=$('f_omPk').value,d={id,unitId:$('f_omUnit')?$('f_omUnit').value:unitId,name:value('omName'),title:value('omTitle'),phone:value('omPhone'),companyEmail:value('omMail'),gmail:value('omGmail'),pk},miss=[];
 if(!d.name)miss.push('f_omName');if(!d.title)miss.push('f_omTitle');if(miss.length){inspFlag(miss,'이름과 직책을 적어 주세요');return}
 const cur=pk&&orgD.members.find(x=>x.pk===pk&&x.id!==id);
 if(cur&&!await askOk(ORG_PK[pk]+' 바꾸기','지금 '+ORG_PK[pk]+'은(는) '+cur.name+' '+cur.title+'입니다.\n'+d.name+' '+d.title+'(으)로 바꿀까요?\n\n앞으로 만드는 위임장 · 규정 · 회의록에 새 이름이 들어갑니다.','바꾸기'))return;
 try{orgD=await call('orgSaveMember',d);orgSel=d.unitId;orgF=null;if(pk&&typeof jobData!=='undefined'&&jobData){jobData.principal=orgD.principal;jobAt=0}orgRender();msg('저장했습니다.')}catch(e){}}
async function orgMemDel(id){const m=orgD.members.find(x=>x.id===id);if(!m)return;if(m.pk){popup('삭제할 수 없습니다',m.name+'은(는) '+ORG_PK[m.pk]+'로 지정되어 있습니다. 다른 사람을 '+ORG_PK[m.pk]+'로 먼저 지정해 주세요.','확인');return}
 if(!await askOk('삭제',m.name+' '+m.title+'을(를) 삭제할까요?'+(m.gmail?'\n앱 로그인도 같이 막힙니다.':''),'삭제'))return;
 try{orgD=await call('orgDeleteMember',id);orgF=null;orgRender();msg('삭제했습니다.')}catch(e){}}
