/* 안전작업허가서 (v4.7) — 현업 양식 「안전작업허가서 (매일1회 / 8시간 기준, 연장작업시 추가1회)」 항목 그대로
 *  업체: [오늘 할 일] ③ 작업허가서 → 작성 → [발행] (바로 작업) → 진행 기록(가스측정·작업중 확인·완료·연장)
 *  도급인: [공사·현장미팅] → 공사의 [작업허가서] → 보기 → [승인]
 *  서버 기능은 Code.gs (getPermit·issuePermit·updatePermitProgress·permitList·permitDetail·approvePermit) */
const PERMIT_ATTACH=[['plan','작업계획서'],['tech','기술자료(도면)'],['ext','소화기목록'],['gear','안전장구 목록'],['special','특수작업절차서'],['dig','굴착도면']];
const PERMIT_SAFETY=[['zone','작업구역 설정(출입경고 표지)'],['flam','작업주위 가연성물질 제거'],['gasm','가스농도 측정'],['valve','밸브차단 및 차단표지부착(도면 비교)'],['blind','맹판설치 및 표지부착(도면 비교)'],['hazard','위험물질(가연성분진 포함)방출 및 처리'],
 ['open','용기개방 및 압력방출'],['clean','용기내부 세정 및 처리'],['inert','불활성가스 치환 및 환기'],['spark','비산불티차단막 설치'],['vent','환기장비'],
 ['light','조명장비'],['fire','소화기'],['gear','안전장구'],['edu','안전교육'],['operator','운전요원의 입회']];
const PERMIT_SUPP=[
 ['high','고소',{checks:[['platform','작업발판, 안전난간'],['harness','안전대 착용·부착'],['net','추락방지망']]}],
 ['power','정전',{texts:[['ctrlRoom','차단기기 : 제어실'],['ctrlSite','차단기기 : 현장']],checks:[['c1','제어실 : 스위치, 차단기 내림'],['c2','제어실 : 잠금장치 시건, 표지부착'],['s1','현장 : 스위치, 차단기 내림'],['s2','현장 : 잠금장치 시건, 표지부착']],
   after:[['restoreBy','※ 전원복구 : 요청자'],['restoreAt','복구시간'],['restoreChecker','전원복구 확인자']],note:'전원복구 : 모든 작업이 완료된 후 운전부서의 입회자의 요청에 의해서만 전원을 복구하여야 한다.'}],
 ['heavy','중장비',{texts:[['equip','투입장비']],checks:[['license','자격증 소지'],['supervise','현장책임자 감독'],['ground','기상, 노면상태'],['wire','전선, 설비 간섭'],['signal','신호수배치'],['mat','매트 등 부속장구']],after:[['operatorName','운전원']]}],
 ['dig','굴착',{checks:[['gasPipe','설비 : 가스,기계,소방배관'],['elecLine','설비 : 전기,계장,통신']],after:[['gasBy','점검자 (가스·기계·소방배관)'],['elecBy','점검자 (전기·계장·통신)']]}],
 ['confined','밀폐공간',{checks:[['comm','통신수단'],['rescue','구명장구(줄, 송기마스크)']],note:'가스농도 측정결과 1. CO: 30ppm미만, 2. H2S: 10ppm미만, 3. LEL: %미만, 4. O2: 18%이상'}],
 ['radiation','방사선',{checks:[['access','비인가자 출입제한'],['warn','방사선 위험경고, 표지'],['license','자격증 소지'],['map','방사선 방사점 도면 첨부']]}]];
const GAS_KEYS=[['co','CO(일산화탄소)'],['h2s','H2S(황화수소)'],['lel','LEL(폭발하한계)'],['o2','O2(산소)']];
const P_STATUS={NEW:['작성 전','todo'],ISSUED:['발행됨 · 승인 대기','todo'],APPROVED:['✔ 승인','ok']};
let pm=null;  // 지금 보고 있는 허가서 {mode:'new'|'progress'|'view'|'staff', permit, ...}
const pv=(o,k,d='')=>o&&o[k]!==undefined&&o[k]!==null?o[k]:d;
/* ---------- 업체: [오늘 할 일] ③ 카드 ---------- */
function permitCardHtml(v){const list=v.permits||[],t=list.find(p=>p.date===v.today),past=list.filter(p=>p.date!==v.today),st=t?P_STATUS[t.status]||[t.status,'todo']:null;
 return '<div class="card" id="permitCard"><div class="vh-top"><h2 style="margin:0">오늘 작업허가서</h2>'+(t?'<span class="pill '+st[1]+'">'+escapeText(st[0])+'</span>':'<span class="pill todo">매일 1회 · 미발행</span>')+'</div>'
  +(t?'<p class="desc">허가번호 '+escapeText(t.no)+' · '+escapeText(t.workName)+' · '+escapeText(t.start)+'~'+escapeText(t.end)+(t.completed?' · <b style="color:var(--ok)">작업완료 기록</b>':'')+'<br>발행했으므로 작업을 진행하세요. 도급인 담당자가 나중에 승인합니다. 가스농도 측정·작업중 확인·작업완료는 아래 버튼에서 기록합니다.</p><button class="button" type="button" style="width:100%" onclick="openPermit(\''+escapeText(v.today)+'\')">허가서 보기 · 진행 기록</button>'
   :'<p class="desc">작업 전에 작성하고 <b>[발행]</b>하면 바로 작업할 수 있습니다. 지난 허가서가 있으면 내용이 미리 채워집니다.</p><button class="button" type="button" style="width:100%" onclick="openPermit(\''+escapeText(v.today)+'\')">오늘 작업허가서 작성</button>')
  +(past.length?'<details class="hist" style="margin-top:12px"><summary>지난 허가서 '+past.length+'건</summary>'+past.map(p=>'<div class="item"><div class="row" style="justify-content:space-between"><span>'+escapeText(p.date)+' · '+escapeText(p.workName)+' <span class="pill '+(P_STATUS[p.status]||['','todo'])[1]+'">'+escapeText((P_STATUS[p.status]||[p.status])[0])+'</span></span><button class="button ghost" type="button" onclick="openPermit(\''+escapeText(p.date)+'\')">보기</button></div></div>').join('')+'</details>':'')+'</div>'}
/* v5.20 허가서는 공사 화면을 받을 때 오늘 것을 미리 받아 둠 → [작성]·[보기]를 누르면 로딩 없이 바로 열림
 *  (뒤에서 최신 내용을 확인해, 아직 아무것도 입력하지 않았을 때만 바꿔 줌. 로딩 창은 [최종 제출]·[저장] 때만) */
let pmTouched=false;
function pmShow(r){pm={mode:r.exists?(r.permit.date===r.today?'progress':'view'):'new',permit:r.permit,fromLast:r.fromLast,today:r.today};pmTouched=false;clearInterval(wkTimer);showSheet()}
/** 제출·저장 뒤 받은 최신 허가서를 미리 받아 둔 것에도 반영 (다시 열 때 예전 빈 양식이 보이지 않게) */
function pmSaved(r){if(!r||!r.permit||!vjob)return;if(r.permit.date===r.today)vjob.permitToday=r;cacheSet('getPermit',[vjob.job.id,r.permit.date],r)}
async function openPermit(date){const id=vjob.job.id,c=(date===vjob.today&&vjob.permitToday)||cacheGet('getPermit',[id,date]);
 if(c){pmShow(c);callQuiet('getPermit',id,date).then(r=>{if(date===vjob?.today&&vjob?.job.id===id)vjob.permitToday=r;const o=$('psheet');if(!pm||!o||o.hidden||pm.permit.date!==date||JSON.stringify(r)===JSON.stringify(c))return;if(pmTouched||pm.mode==='edit')return;pmShow(r)}).catch(()=>{});return}
 try{pmShow(await call('getPermit',id,date))}catch(e){}}
function closePermit(){hideSheet();pm=null;if(vjob){renderVJob();$('permitCard')?.scrollIntoView({block:'start'})}}
/* ---------- 허가서: 종이 양식과 같은 모양으로 전체 화면에 한 장 (v4.8) ----------
 *  칸을 눌러 바로 입력 → [최종 제출]. ☐ = 필요한 사항, ○ = 조치 시행 후 */
function si(id,val,dis,o){o=o||{};return '<input class="si'+(o.w?' w'+o.w:'')+'" id="'+id+'" type="'+(o.type||'text')+'" value="'+escapeText(val||'')+'" '+(dis?'disabled':'')+(o.ph?' placeholder="'+escapeText(o.ph)+'"':'')+' aria-label="'+escapeText(o.label||o.ph||id)+'">'}
function cb(id,on,dis,kind,label){return '<label class="pc '+(kind||'sq')+'" title="'+escapeText(label||'')+'"><input type="checkbox" id="'+id+'" '+(on?'checked':'')+' '+(dis?'disabled':'')+' aria-label="'+escapeText(label||'')+'"><i aria-hidden="true"></i></label>'}
function nc(idN,idD,x,dis,label){x=x||{};return '<span class="nc">'+cb(idN,x.need,dis,'sq',label+' 필요')+cb(idD,x.done,dis,'ci',label+' 조치 완료')+'</span>'}
function sheetHtml(){const P=pm.permit,d=P.data||{},M=pm.mode,L=!(M==='new'||M==='edit'),G=!(M==='new'||M==='edit'||M==='progress'),[y,mo,da]=String(P.date||'').split('-');
 const sup=k=>pv(d.supp,k,{}),gas=d.gas||[],dur=d.during||[],cp=d.complete||{},ex=d.extend||{};
 const col=(a,b)=>PERMIT_SAFETY.slice(a,b).map(([k,l])=>'<tr><td class="it" id="ps_'+k+'">ㅇ '+escapeText(l)+'</td><td class="ck">'+cb('psn_'+k,pv(d.safety,k,{}).need,L,'sq',l+' 필요')+'</td><td class="ck">'+cb('psd_'+k,pv(d.safety,k,{}).done,L,'ci',l+' 조치')+'</td></tr>').join('');
 const suppRow=([k,l,s])=>{const x=sup(k),chk=(s.checks||[]).map(([c,cl])=>'<span class="sx" id="puc_'+k+'_'+c+'">'+escapeText(cl)+' '+nc('pucn_'+k+'_'+c,'pucd_'+k+'_'+c,pv(x.checks,c,{}),L,cl)+'</span>').join(' / ');
  const txt=(s.texts||[]).map(([t,tl])=>'<span class="sx">'+escapeText(tl)+'( '+si('put_'+k+'_'+t,x[t],L,{w:'m',label:tl})+' )</span>').join(' ');
  const aft=(s.after||[]).map(([t,tl])=>'<span class="sx">'+escapeText(tl)+' '+si('put_'+k+'_'+t,x[t],G,{w:'m',label:tl})+'</span>').join(' ');
  return '<tr class="su'+(x.on?' on':'')+'" id="pu_'+k+'"><th class="sl">'+l+'</th><td class="ck on">'+cb('puo_'+k,x.on,L,'sq',l+' 작업')+'</td><td class="sc">'
   +(txt?'<div>ㅇ '+txt+'</div>':'')+(chk?'<div>ㅇ '+chk+'</div>':'')+(s.note?'<div class="sn">'+escapeText(s.note)+'</div>':'')
   +'<div class="sr"><span>허가기간 : '+si('puf_'+k,x.from,L,{type:'time',label:l+' 허가기간 시작'})+' ~ '+si('pue_'+k,x.to,L,{type:'time',label:l+' 허가기간 종료'})+'</span><span>확인자 '+si('puk_'+k,x.checker,L,{w:'s',label:l+' 확인자'})+'(서명)</span></div>'+(aft?'<div>'+aft+'</div>':'')+'</td></tr>'};
 const ap=P.status==='APPROVED';
 return '<div class="sheet"><h1 class="st">안 전 작 업 허 가 서</h1><div class="ss">(매일1회 / 8시간 기준, 연장작업시 추가1회)</div>'
 +'<div class="hd"><div>허가번호 : <b>'+escapeText(P.no||'(제출 시 자동)')+'</b></div><div>허가일자 : '+escapeText(y||'')+' 년 '+Number(mo||0)+' 월 '+Number(da||0)+' 일</div></div>'
 +'<div class="hd"><div id="hd_ap">신 청 인 : '+si('p_apDept',pv(d.applicant,'dept'),L,{w:'m',label:'신청인 부서'})+' / 직책 : '+si('p_apTitle',pv(d.applicant,'title'),L,{w:'s',label:'신청인 직책'})+' / 성명 : '+si('p_apName',pv(d.applicant,'name'),L,{w:'s',label:'신청인 성명'})+'</div></div>'
 +'<div class="hd"><div>작업허가기간 : '+escapeText(y||'')+' 년 '+Number(mo||0)+' 월 '+Number(da||0)+' 일 '+si('p_start',pv(d.period,'start'),L,{type:'time',label:'시작 시각'})+' 부터 '+si('p_end',pv(d.period,'end'),L,{type:'time',label:'종료 시각'})+' 까지</div></div>'
 +'<table class="pt"><tr><th>작업장소 및<br>설비(기기)</th><td colspan="3">작업지역(장소) : '+si('p_place',d.place,L,{w:'l',label:'작업지역'})+'<span class="gap"></span>장 치 명 : '+si('p_device',d.device,L,{w:'m',label:'장치명'})+'</td></tr>'
 +'<tr><th>작 업 명 (공정)</th><td>'+si('p_work',d.workName,L,{w:'l',ph:'예: 철거, 목공',label:'작업명'})+'</td><th>업 체 명</th><td><b>'+escapeText(P.company||'')+'</b></td></tr>'
 +'<tr><th>첨부<br>서류</th><td class="at">'+PERMIT_ATTACH.map(([k,l])=>'<span class="ax">'+escapeText(l)+' '+cb('pa_'+k,pv(d.attach,k,false),L,'sq',l)+'</span>').join('')+'</td><th>작업 전<br>위험성평가필요</th><td>'+[['procChange','작업절차서 변화'],['workDiff','변화, 작업상이']].map(([k,l])=>'<div>'+l+' '+['유','무'].map(v=>'<label class="pr"><input type="radio" name="pp_'+k+'" value="'+v+'" '+(pv(d.pre,k,'무')===v?'checked':'')+' '+(L?'disabled':'')+'> '+v+'</label>').join(' ')+'</div>').join('')+'</td></tr></table>'
 +'<div class="bar"><b>안전조치 요구사항</b><span>필요한 사항에 ☐ 표시, 조치 시행 후 ○ 표시</span></div>'
 +'<div class="g3"><table class="pt">'+col(0,6)+'</table><table class="pt">'+col(6,11)+'</table><table class="pt">'+col(11,16)+'</table></div>'
 +'<div class="bar"><b>보충작업허가</b><span>필요한 사항에 ☐ 표시, 조치 시행 후 ○ 표시</span></div>'
 +'<table class="pt">'+PERMIT_SUPP.map(suppRow).join('')+'</table>'
 +'<table class="pt gas"><tr><th rowspan="6" class="vt">가스<br>농도<br>측정<br>(MSDS<br>참조)</th><th>측정시간</th>'+[0,1,2,3,4].map(i=>'<td>'+si('pg_t'+i,(gas[i]||{}).time,G,{type:'time',label:(i+1)+'회 측정시간'})+'</td>').join('')+'<th>비 고</th></tr>'
 +GAS_KEYS.map(([k,l],r)=>'<tr><th class="gl">'+l+'</th>'+[0,1,2,3,4].map(i=>'<td>'+si('pg_'+k+i,(gas[i]||{})[k],G,{label:(i+1)+'회 '+l})+'</td>').join('')+(r===0?'<td rowspan="5" class="gn">가스별 상이<br>(LPG:2.2mol% 미만)<br>'+si('p_gasNote',d.gasNote,G,{label:'비고'})+'</td>':'')+'</tr>').join('')
 +'<tr><th class="gl">측정(확인)자</th>'+[0,1,2,3,4].map(i=>'<td>'+si('pg_by'+i,(gas[i]||{}).by,G,{label:(i+1)+'회 측정자'})+'</td>').join('')+'</tr></table>'
 +'<table class="pt"><tr><th class="w1">안전조치 확인</th><td colspan="5">작업 부서 책임자 : '+si('p_cfMgr',pv(d.confirm,'manager'),L,{w:'s',label:'작업 부서 책임자'})+'(서명) / 입회자 : '+si('p_cfWit',pv(d.confirm,'witness'),L,{w:'s',label:'입회자'})+'(서명)</td></tr>'
 +'<tr><th class="w1" rowspan="2">작업중<br>확인</th>'+[0,1,2,3,4].map(i=>'<td class="dc"><span class="ml">시간</span>'+si('pd_t'+i,(dur[i]||{}).time,G,{type:'time',label:(i+1)+'회 확인 시간'})+'</td>').join('')+'</tr><tr>'+[0,1,2,3,4].map(i=>'<td class="dc"><span class="ml">확인</span>'+si('pd_by'+i,(dur[i]||{}).by,G,{label:(i+1)+'회 확인자'})+'</td>').join('')+'</tr>'
 +'<tr><th class="w1">작업완료</th><td colspan="5">시간 : '+si('pc_time',cp.time,G,{type:'time',label:'완료 시간'})+' , 입회자 : '+si('pc_wit',cp.witness,G,{w:'s',label:'완료 입회자'})+'(인) , 현장담당자 : '+si('pc_site',cp.site,G,{w:'s',label:'현장담당자'})+'(인) , 복원(조치)상태 : '+si('pc_rest',cp.restore,G,{w:'m',label:'복원 상태'})+'</td></tr>'
 +'<tr><th class="w1">기타 특별사항</th><td colspan="5">'+si('p_etc',d.etc,L,{w:'f',label:'기타 특별사항'})+'</td></tr></table>'
 +'<table class="pt sign"><tr><td class="yl">발급자 부서 : '+si('p_isDept',pv(d.issuer,'dept'),L,{w:'m',label:'발급자 부서'})+' 직책 : '+si('p_isTitle',pv(d.issuer,'title'),L,{w:'s',label:'발급자 직책'})+' 성명 : '+si('p_isName',pv(d.issuer,'name'),L,{w:'s',label:'발급자 성명'})+'(인)</td>'
 +'<td class="yl">승인자 '+(ap?'<b>'+escapeText(P.approvedBy)+'</b> <span class="stamp">승인</span><div class="muted">'+escapeText(fmtTime(P.approvedAt))+(P.approveNote?' · '+escapeText(P.approveNote):'')+'</div>':M==='staff'?'<b>'+escapeText(pm.approver?pm.approver.name:'')+'</b> <span class="muted">(승인 시 자동)</span><div>'+si('p_apNote','',false,{w:'f',ph:'승인 의견 (선택)',label:'승인 의견'})+'</div>':'<span class="muted">도급인 담당자가 제출 후 확인·승인</span>')+'</td></tr>'
 +'<tr><th class="w1">작업허가 연장</th><td>'+si('pe_date',ex.date,G,{type:'date',label:'연장일'})+' '+si('pe_from',ex.from,G,{type:'time',label:'연장 시작'})+' 부터 '+si('pe_to',ex.to,G,{type:'time',label:'연장 종료'})+' 까지 &nbsp;발급자 '+si('pe_by',ex.by,G,{w:'s',label:'연장 발급자'})+'(인)</td></tr></table></div>'}
function showSheet(){const P=pm.permit,M=pm.mode,st=P_STATUS[P.status]||[P.status,'todo'];let o=$('psheet');if(!o){o=document.createElement('div');o.id='psheet';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-label','안전작업허가서');document.body.appendChild(o)}
 const canFix=(M==='progress'||M==='view')&&P.status==='ISSUED';  // 승인 전이면 업체가 수정·취소 가능
 const act=M==='new'?'<button class="button" type="button" onclick="issuePermitNow()">최종 제출</button>'
  :M==='edit'?'<button class="button ghost" type="button" onclick="cancelEditPermit()">수정 취소</button><button class="button" type="button" onclick="editPermitNow()">수정 제출</button>'
  :M==='progress'?(canFix?'<button class="button ghost" type="button" onclick="startEditPermit()">내용 수정</button>':'')+'<button class="button" type="button" onclick="savePermitProgress()">저장</button>'
  :M==='view'&&canFix?'<button class="button" type="button" onclick="startEditPermit()">내용 수정</button>':M==='staff'&&P.status!=='APPROVED'?'<button class="button" type="button" onclick="approvePermitNow()">승인</button>':'';
 o.innerHTML='<div class="pbar"><button class="button ghost" type="button" onclick="'+(M==='staff'?'backPermitList()':'closePermit()')+'">✕ 닫기</button><div class="pbt"><b>안전작업허가서</b> <span class="pill '+st[1]+'">'+escapeText(st[0])+'</span></div>'+act+'</div>'
  +(M==='new'?'<div class="phelp">'+(pm.fromLast?escapeText(pm.fromLast)+' 허가서 내용이 채워져 있습니다. ':'')+'필요한 칸만 눌러서 채우고 <b>[최종 제출]</b>을 누르면 바로 작업할 수 있습니다. ☐ 필요한 사항 · ○ 조치 완료</div>':M==='edit'?'<div class="phelp">내용을 고친 뒤 <b>[수정 제출]</b>을 누르세요. 허가번호는 그대로 유지됩니다.</div>'
  :M==='progress'||M==='view'?'<div class="phelp">'+(M==='progress'?'제출된 허가서입니다. 가스농도 측정·작업중 확인·작업완료·연장 칸만 채우고 [저장]하세요.':'지난 허가서입니다.')
   +(canFix?'<br>도급인 승인 전이라 고칠 수 있습니다: <b>[내용 수정]</b> 또는 <button class="linkbtn" type="button" onclick="withdrawPermitNow()">제출 취소 (허가서 삭제)</button>':P.status==='APPROVED'?'<br>도급인이 승인한 허가서는 수정·취소할 수 없습니다.':'')+'</div>':'')
  +'<div class="pwrap">'+sheetHtml()+'</div>';o.hidden=false;if(!o.__tw){o.__tw=1;o.addEventListener('input',()=>{pmTouched=true})}document.body.style.overflow='hidden';o.scrollTop=0;
 o.querySelectorAll('[id^=puo_]').forEach(x=>x.addEventListener('change',()=>x.closest('tr').classList.toggle('on',x.checked)))}
function hideSheet(){const o=$('psheet');if(o){o.hidden=true;o.innerHTML=''}document.body.style.overflow=''}
function toggleSupp(k){const r=$('pu_'+k);if(r)r.classList.toggle('on',ck('puo_'+k))}
const ck=id=>!!($(id)&&$(id).checked),tv=id=>($(id)?$(id).value.trim():'');
/** 화면 → 허가서 내용 */
function permitCollect(){const d={applicant:{dept:tv('p_apDept'),title:tv('p_apTitle'),name:tv('p_apName')},period:{start:tv('p_start'),end:tv('p_end')},place:tv('p_place'),device:tv('p_device'),workName:tv('p_work'),
  attach:Object.fromEntries(PERMIT_ATTACH.map(([k])=>[k,ck('pa_'+k)])),pre:{procChange:document.querySelector('input[name=pp_procChange]:checked')?.value||'무',workDiff:document.querySelector('input[name=pp_workDiff]:checked')?.value||'무'},
  safety:Object.fromEntries(PERMIT_SAFETY.map(([k])=>[k,{need:ck('psn_'+k),done:ck('psd_'+k)}])),supp:{},
  confirm:{manager:tv('p_cfMgr'),witness:tv('p_cfWit')},etc:tv('p_etc'),issuer:{dept:tv('p_isDept'),title:tv('p_isTitle'),name:tv('p_isName')}};
 PERMIT_SUPP.forEach(([k,,s])=>{const x={on:ck('puo_'+k),from:tv('puf_'+k),to:tv('pue_'+k),checker:tv('puk_'+k),checks:{}};(s.texts||[]).concat(s.after||[]).forEach(([t])=>x[t]=tv('put_'+k+'_'+t));(s.checks||[]).forEach(([c])=>x.checks[c]={need:ck('pucn_'+k+'_'+c),done:ck('pucd_'+k+'_'+c)});d.supp[k]=x});
 return d}
function progressCollect(){const supp={};PERMIT_SUPP.forEach(([k,,s])=>(s.after||[]).forEach(([t])=>{if($('put_'+k+'_'+t)){supp[k]=supp[k]||{};supp[k][t]=tv('put_'+k+'_'+t)}}));
 return {gas:[0,1,2,3,4].map(i=>({time:tv('pg_t'+i),co:tv('pg_co'+i),h2s:tv('pg_h2s'+i),lel:tv('pg_lel'+i),o2:tv('pg_o2'+i),by:tv('pg_by'+i)})).filter(g=>Object.values(g).some(Boolean)),gasNote:tv('p_gasNote'),
  during:[0,1,2,3,4].map(i=>({time:tv('pd_t'+i),by:tv('pd_by'+i)})).filter(x=>x.time||x.by),complete:{time:tv('pc_time'),witness:tv('pc_wit'),site:tv('pc_site'),restore:tv('pc_rest')},extend:{date:tv('pe_date'),from:tv('pe_from'),to:tv('pe_to'),by:tv('pe_by')}}}
/** 발행 전 확인: 빠진 칸 → 자동 이동 + 붉은 테두리·흔들림 */
function permitMissing(d){const m=[];if(!d.applicant.name)m.push('p_apName');if(!d.period.start)m.push('p_start');if(!d.period.end)m.push('p_end');if(!d.place)m.push('p_place');if(!d.workName)m.push('p_work');
 PERMIT_SAFETY.forEach(([k])=>{if(d.safety[k].need&&!d.safety[k].done)m.push('ps_'+k)});
 PERMIT_SUPP.forEach(([k,,s])=>{const x=d.supp[k];if(!x.on)return;if(!x.from)m.push('puf_'+k);if(!x.to)m.push('pue_'+k);if(!x.checker)m.push('puk_'+k);(s.checks||[]).forEach(([c])=>{if(x.checks[c].need&&!x.checks[c].done)m.push('puc_'+k+'_'+c)})});
 if(!d.confirm.manager)m.push('p_cfMgr');if(!d.issuer.name)m.push('p_isName');return m}
function flagMissing(ids,text){document.querySelectorAll('.miss').forEach(x=>x.classList.remove('miss','shake'));ids.forEach(id=>{const el=$(id);if(!el)return;el.classList.add('miss');void el.offsetWidth;el.classList.add('shake');if(el.tagName==='INPUT')el.addEventListener('input',()=>el.classList.remove('miss','shake'),{once:true})});const f=$(ids[0]);if(f){f.scrollIntoView({behavior:'smooth',block:'center'});if(f.tagName==='INPUT')setTimeout(()=>f.focus({preventScroll:true}),400)}msg(text)}
async function issuePermitNow(){const d={...permitCollect(),...progressCollect()},m=permitMissing(d);if(m.length){flagMissing(m,'확인할 칸 '+m.length+'개 · 빨간 칸을 확인해 주세요 (필요 항목은 조치 완료 체크)');return}
 if(!confirm('작업허가서를 최종 제출할까요?\n제출하면 바로 작업할 수 있고, 도급인 담당자에게 승인 요청이 갑니다.\n(제출 후에는 가스측정·작업중 확인·완료·연장 칸만 고칠 수 있습니다)'))return;
 try{const r=await call('issuePermit',vjob.job.id,d);pmSaved(r);pm={mode:'progress',permit:r.permit,today:r.today};vjob.permits=[{...r.permit}].concat((vjob.permits||[]).filter(p=>p.date!==r.permit.date));showSheet();msg('제출했습니다. 작업을 시작하세요.')}catch(e){alert(e.message)}}
/* v4.9 승인 전 수정·제출 취소 (업체) */
function startEditPermit(){pm.prevMode=pm.mode;pm.mode='edit';showSheet()}
function cancelEditPermit(){pm.mode=pm.prevMode||'progress';showSheet()}
async function editPermitNow(){const d={...permitCollect(),...progressCollect()},m=permitMissing(d);if(m.length){flagMissing(m,'확인할 칸 '+m.length+'개 · 빨간 칸을 확인해 주세요');return}
 if(!confirm('고친 내용으로 다시 제출할까요?'))return;
 try{const r=await call('editPermit',pm.permit.id,d);pmSaved(r);pm={mode:r.permit.date===r.today?'progress':'view',permit:r.permit,today:r.today};vjob.permits=(vjob.permits||[]).map(p=>p.id===r.permit.id?{...r.permit}:p);showSheet();msg('수정 제출했습니다.')}catch(e){alert(e.message)}}
async function withdrawPermitNow(){if(!confirm('이 허가서 제출을 취소할까요?\n허가서가 삭제되고, 오늘 허가서를 처음부터 다시 작성할 수 있습니다.'))return;
 try{vjob=await call('withdrawPermit',pm.permit.id);hideSheet();pm=null;renderVJob();$('permitCard')?.scrollIntoView({block:'start'});msg('제출을 취소했습니다.')}catch(e){alert(e.message)}}
async function savePermitProgress(){try{const r=await call('updatePermitProgress',pm.permit.id,progressCollect());pmSaved(r);pm.permit=r.permit;showSheet();msg('저장했습니다.');vjob.permits=(vjob.permits||[]).map(p=>p.id===r.permit.id?{...p,completed:r.permit.completed}:p)}catch(e){}}
/* ---------- 직원: 공사별 허가서 목록 · 보기 · 승인 ---------- */
let permitJob=null;
async function openPermitList(jobId){try{permitJob=await call('permitList',jobId);jobsMode='permits';renderPermitList();window.scrollTo(0,0)}catch(e){}}
function renderPermitList(){const d=permitJob,w=d.list.filter(p=>p.status==='ISSUED').length;
 $('jobs').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="loadJobs()">← 공사 목록</button><h2 style="margin-top:12px">작업허가서 · '+escapeText(d.job.title)+'</h2><p class="desc">업체가 발행한 허가서입니다. 발행 즉시 작업이 시작되며, 확인 후 승인해 주세요.'+(w?' <b class="req">승인 대기 '+w+'건</b>':'')+'</p></div>'
  +'<div class="card">'+(d.list.map(p=>'<button class="jobitem" type="button" onclick="openPermitStaff(\''+escapeText(p.id)+'\')"><div><b>'+escapeText(p.date)+' · '+escapeText(p.company)+'</b> <span class="pill '+(P_STATUS[p.status]||['','todo'])[1]+'">'+escapeText((P_STATUS[p.status]||[p.status])[0])+'</span><div class="muted">'+escapeText(p.no)+' · '+escapeText(p.workName)+' · '+escapeText(p.start)+'~'+escapeText(p.end)+(p.completed?' · 작업완료':'')+'</div></div><span aria-hidden="true">›</span></button>').join('')||'<p class="muted">아직 발행된 허가서가 없습니다.</p>')+'</div>'}
async function openPermitStaff(id){try{const r=await call('permitDetail',id);pm={mode:'staff',permit:r,approver:r.approver};showSheet()}catch(e){}}
async function backPermitList(){hideSheet();pm=null;if(permitJob)await openPermitList(permitJob.job.id);else loadJobs()}
async function approvePermitNow(){if(!confirm('이 작업허가서를 승인할까요?'))return;try{const r=await call('approvePermit',pm.permit.id,tv('p_apNote'));pm.permit=r;showSheet();msg('승인했습니다.');refreshBadges();const j=jobData&&jobData.jobs.find(x=>x.id===r.jobId);if(j)j.permitWaiting=Math.max(0,(j.permitWaiting||1)-1)}catch(e){}}
