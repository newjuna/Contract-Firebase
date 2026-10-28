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
  {scr:'permit',sel:'#pf_work',text:'① 작업명을 적습니다. 작업 장소는 공사 매장(다이소 ○○점)으로 자동으로 들어갑니다. 시간은 08:00~17:00이 기본입니다. 어제 허가서가 있으면 미리 채워져 있습니다.'},
  {scr:'permit',sel:'#pfTypes',tap:1,text:'② 오늘 하는 위험작업 버튼을 모두 누르세요. (화기·고소·정전 등) 없으면 누르지 않고 넘어갑니다.'},
  {scr:'permit',sel:'#pfAll',tap:1,text:'③ 작업 전에 안전조치를 했으면 [모두 조치함]을 누르세요. 고른 위험작업에 필요한 조치만 나옵니다.'},
  {scr:'permit',sel:'#pfIssue',tap:1,text:'④ 현장책임자 이름을 확인하고 [발행]을 누르면 바로 작업할 수 있습니다.'},
  {scr:'permit',sel:'#pfPrev',tap:1,text:'[결과지 미리보기]를 누르면 작업허가서 양식으로 어떻게 나오는지 볼 수 있습니다.'},
  {scr:'permit',sel:'#pgDoneCard',text:'작업 완료 칸은 기본값(17:00 · 현장대리인)이 들어가 있습니다. 다를 때만 고치세요.'},
  {scr:'permit',sel:'#pgSave',tap:1,text:'[작업 완료 저장]을 누르면 오늘 작업허가서가 마무리됩니다.'}],
 insp:[
  {scr:'today',sel:'#btnInsp',alt:'#inspCard',tap:1,text:'순회점검은 매일 합니다. [오늘 순회점검 작성]을 누르세요.'},
  {scr:'insp0',sel:'#tbmCard',tap:1,text:'먼저 TBM(작업 전 안전 미팅) 사진을 📷 찍어서 올립니다.'},
  {scr:'insp',sel:'#drillCard',tap:1,text:'오늘 비상대피·CPR·소화기 훈련이나 안전교육을 했으면 종류를 고르고 사진을 올립니다. 안 한 날은 그냥 넘어가면 됩니다. (업체 평가 비상대책에 반영)'},
  {scr:'insp',sel:'#inItems',text:'사진이 올라가면 점검표가 열립니다. 우리 업체 계획서 위험성평가에 맞춘 항목이 나옵니다.'},
  {scr:'insp',sel:'#ii_1 .jm',tap:1,text:'전 항목이 [양호]로 미리 체크되어 있습니다. 문제가 있는 항목만 [불량]을 누르고 사진과 내용을 적으세요.'},
  {scr:'insp',sel:'#inSubmit',tap:1,text:'점검자 이름을 확인하고 [순회점검 제출]을 누르면 끝입니다.'}]};
TOUR_STEPS.day=[{scr:'today',sel:'#gdDay',text:'오늘 현장 업무 사용 가이드입니다. 위에서부터 ① 신규자 등록 → ② 작업허가서 → ③ 순회점검 순서로 하면 됩니다.'}]
 .concat(TOUR_STEPS.reg,TOUR_STEPS.permit.filter(s=>!/^#pg/.test(s.sel)),TOUR_STEPS.insp,[{scr:'today',sel:'#gdDay',text:'끝! 모를 때는 각 칸의 [❔ 사용 가이드]를 누르면 그 부분만 다시 볼 수 있습니다.'}]);
/* F1.9a 화면별 사용 가이드 (scr 없음 = 지금 화면 그대로 · 화면에 없는 칸은 자동으로 건너뜀) */
const G=(kind,first,list)=>{TOUR_STEPS[kind]=[{sel:'#gd_'+kind,text:first}].concat(list.map(a=>({sel:a[0],tap:a[2]?1:0,text:a[1]})))};
// ── 협력업체 ──
G('regForm','사업자 등록 화면입니다. 위에서부터 차례대로 적으면 됩니다.',[
 ['#f_company','① 업체명(상호)을 사업자등록증에 적힌 그대로 적습니다.'],
 ['#f_regNo','② 사업자등록번호 10자리를 적습니다. (- 없이 숫자만 적어도 됩니다)'],
 ['#f_representative','③ 대표자 이름을 적습니다.'],
 ['#f_address','④ 사업장 주소를 적습니다.'],
 ['#f_contact','⑤ 현장대리인(업체소장) 이름을 적습니다. 현장 업무를 맡는 사람입니다.'],
 ['#f_phone','⑥ 연락받을 휴대폰 번호를 적습니다.'],
 ['#f_approverEmail','⑦ 다이소 담당자(도급인) 이메일을 적습니다. 이 사람이 등록을 승인합니다.'],
 ['#f_industry','⑧ 업종(공종)을 고릅니다.'],
 ['#cert','⑨ 사업자등록증 사진이나 PDF를 올립니다. 지금 없으면 나중에 올려도 됩니다.',1],
 ['#agree','⑩ 개인정보 수집·이용 동의에 체크합니다.',1],
 ['form button[type=submit]','⑪ [등록 신청]을 누르면 다이소 담당자에게 승인 요청이 갑니다.',1]]);
G('pending','등록 신청이 끝났습니다. 다이소 승인 담당자가 메일 링크로 승인하면 이 화면에 안내 창이 뜨고 서류 작성으로 넘어갑니다.',[
 ['#pollInfo','승인 여부는 15초마다 저절로 확인합니다. 화면을 켜 두기만 하면 됩니다.'],
 ['#btnChkApv','바로 확인하고 싶으면 [지금 확인하기]를 누르세요.',1],
 ['#btnRegEdit','승인 담당자 메일 주소 등을 잘못 적었으면 [신청 내용 고치기]로 고치고 다시 보냅니다.',1]]);
G('contract','계약 전에 할 일 화면입니다. 위에서부터 ① → ② → ③ 순서로 하면 됩니다.',[
 ['#infoCard','① 사업장 정보입니다. 가입 때 적은 값이 들어가 있으니 틀린 곳만 고칩니다.',1],
 ['#docsCard','② 계약 전에 낼 서류입니다. [미작성] 표시가 아직 안 한 서류입니다.'],
 ['#row_docC02','안전보건관리규정·계획서는 [✍ 작성하기]를 눌러 화면에서 바로 씁니다. 규정은 자동, 계획서는 단계별로 적고 서명 한 번이면 끝입니다.',1],
 ['#finCard','③ 다 채웠으면 여기서 제출합니다. 본사 담당자 → 안전보건팀 순서로 검토합니다.'],
 ['#btnSubmitAll','[누락 확인 후 제출하기]를 누르면 빠진 칸은 빨갛게 표시되고, 다 됐으면 제출됩니다.',1]]);
const PL_NEXT=['.roomfoot .button:not(.ghost)','다 적었으면 [다음]을 누르세요. 위쪽 탭을 눌러 원하는 단계로 바로 갈 수도 있습니다.',1];
G('plan2','계획서 작성 화면입니다. 위쪽 탭이 빨간색이면 아직 덜 쓴 단계, 초록색이면 다 쓴 단계입니다.',[
 ['#plTabs','탭을 누르면 그 단계로 바로 이동합니다.',1],
 ['#f_plGoal','안전 목표를 적습니다. (예: 무재해 달성)'],
 ['#f_plK0','성과지표(지표명·목표)를 적습니다. [+ 지표 추가]로 늘릴 수 있습니다.'],
 ['details.hist','관련 법규는 자동으로 들어갑니다. 눌러서 볼 수만 있습니다.'],PL_NEXT]);
G('plan3','안전관리책임자(현장대리인 = 업체 소장) 단계입니다.',[
 ['#f_plN0','업체 소장 이름을 적습니다.'],
 ['#f_plP0','연락처를 숫자만 적습니다. (- 는 자동)'],
 ['#f_plGb','생년월일을 고릅니다.'],
 ['#f_plGa','주소를 적습니다. 기술자면허가 있으면 아래 칸을 펼쳐 적습니다.'],PL_NEXT]);
G('plan4','위험성평가 단계입니다.',[
 ['#plWorks','우리 업체가 실제로 하는 공종만 체크해 둡니다.',1],
 ['#plRisks','고른 공종의 위험요인 중 해당하는 것만 체크합니다. 감소대책은 자동으로 들어가고 순회점검 때 확인합니다.',1],PL_NEXT]);
G('plan5','비상 시나리오 단계입니다.',[
 ['#plScen','일어날 수 있는 사고 유형을 체크합니다. 유형별 대응 순서가 계획서에 들어갑니다.',1],
 ['#f_plHos','가까운 병원을 적습니다. (선택)'],PL_NEXT]);
G('plan6','비상대피훈련 계획 단계입니다.',[
 ['#f_plDr','대피 경로를 적습니다. (예: 작업장 → 비상구 → 주차장)'],
 ['#f_plDa','집결 장소를 적습니다.'],
 ['#f_plDm','훈련 담당자 이름을 적습니다.'],
 ['#plDrill','훈련 방법을 체크합니다. 실제 훈련은 공사 중 순회점검 때 사진으로 남깁니다.',1],PL_NEXT]);
G('plan7','마지막 단계입니다. 서명하면 계획서가 완성됩니다.',[
 ['#plAcc','최근 3년 산업재해 건수를 적습니다. 없으면 0.'],
 ['#plEv','근로복지공단 산재 확인서 등 증빙을 올립니다. 증빙이 없으면 미제출로 평가 12번 미흡(1점)입니다.',1],
 ['#plPrCard','이행 사례(평가 6번)를 적습니다. 글 + 증빙 사진 = 우수 10점 · 글만 = 보통 5점 · 비우면 미흡 1점.',1],
 ['#sigBox','현장대리인이 손가락으로 서명합니다. 같은 서명이 계획서·현장대리인계에 들어갑니다.',1],
 ['#planSave','[서명하고 작성 완료]를 누르면 끝입니다.',1]]);
G('vdash','업체 첫 화면입니다. 오늘 할 일이 여기 모여 있습니다.',[
 ['.vmeet','협의체·합동점검 참여 칸입니다. 회의가 있는 날 눌러서 참여합니다.',1],
 ['.vgo','진행 중인 공사입니다. 누르면 오늘 현장 업무(신규자 등록·작업허가서·순회점검)로 갑니다.',1],
 ['#fxCard','다이소 담당자가 고쳐 달라고 한 내용(시정조치)입니다. 고친 뒤 사진을 올립니다.',1],
 ['.gt','공사 일정입니다. 오늘이 어디쯤인지 보입니다.'],
 ['.dns','공사별 이행률(순회점검·작업허가서·신규자 교육)입니다. 매일 빠짐없이 하면 100%가 됩니다.']]);
G('vmeet','협의체·합동점검 참여 화면입니다.',[
 ['#qrBox','현장에 있는 참석 QR을 이 네모 칸에 비추세요. 인식되면 바로 참석 체크 화면으로 넘어갑니다.'],
 ['#qrBtn','카메라가 꺼졌으면 [카메라 다시 켜기]를 누르세요.',1],
 ['details.hist','카메라가 안 되면 담당자가 보내 준 참여 링크를 여기에 붙여넣습니다.',1]]);
G('edu','신규교육 현황 화면입니다. 이 공사에 등록한 작업자 전체가 나옵니다.',[
 ['#eduCard','작업자별 등록일과 이수증 여부가 나옵니다.'],
 ['.linkbtn.req','이수증이 없는 사람은 [📷 올리기]로 나중에 사진을 넣습니다.',1],
 ['[onclick^="showEduSheet"]','[📋 교육일지]를 누르면 그 사람의 교육일지(1명당 1장)를 봅니다.',1],
 ['details.hist','작업 안전 수칙 서명 기록은 여기를 펼쳐 봅니다.',1]]);
// ── 도급인(다이소 담당자) ──
G('sdash','담당자 첫 화면입니다. 처리할 일이 위에 모여 있습니다.',[
 ['#abar','🔔 새 알림이 있으면 여기 나옵니다. 누르면 알림 목록이 열립니다.',1],
 ['.vgo','[현장 확인하기]를 누르면 작업허가서 승인·순회점검일지 확인을 합니다.',1],
 ['#fxCard','지적사항·시정조치 현황입니다.'],
 ['.jcard','공사별 진행 상황입니다. 누르면 그 공사의 자세한 현황이 나옵니다.',1]]);
G('sjobs','공사 관리 화면입니다. 공사를 만들고 업체를 배정합니다.',[
 ['button[onclick="jobForm()"]','[+ 새 공사 만들기]를 눌러 공사를 만듭니다.',1],
 ['.alertcard','가입 승인 후 아직 공사가 없는 업체입니다. [이 업체로 공사 만들기]를 누르면 바로 배정됩니다.',1],
 ['.item input[type=date]','착수 미팅은 공사를 저장하면 자동으로 생깁니다. 날짜만 여기서 고칩니다.'],
 ['.fxchip','협의체·합동점검 위임장과 현장대리인계는 자동으로 만들어집니다. 눌러서 봅니다.',1],
 ['button[onclick^="jobEndPage"]','공사 기간 연장이나 공사 종료는 이 버튼으로 합니다.',1]]);
G('jobform','공사 만들기 화면입니다.',[
 ['#f_jKind','구분을 고릅니다.'],
 ['#f_jTitle','공사명을 적습니다. (예: 다이소 매봉역점 리뉴얼 공사)'],
 ['#f_jStore','매장명을 적습니다.'],
 ['#f_jStart','공사 시작일을 고릅니다.'],
 ['#f_jEnd','공사 종료일(예정)을 고릅니다.'],
 ['.jv','참여 업체를 체크합니다. 계약 전 검토가 승인된 업체만 고를 수 있습니다.',1],
 ['form button[type=submit]','저장하면 업체 화면에 공사가 나오고 착수 미팅이 자동으로 생깁니다.',1]]);
G('smeet','협의체·합동점검 화면입니다. 착수 미팅은 공사를 저장하면 자동으로 생깁니다.',[
 ['button[onclick="meetAdd()"]','미팅을 하나 더 잡을 때 [+ 미팅 추가]를 누릅니다.',1],
 ['.item input[type=date]','실시 전 미팅은 날짜를 바로 고칠 수 있습니다.'],
 ['button[onclick^="meetStart"]','현장에서 [▶ 미팅 시작]을 누르면 참석 QR이 나옵니다.',1]]);
G('room','미팅 화면입니다. ① 참석 → ② 합동점검 → ③ 회의록 순서로 합니다.',[
 ['#rt_att','위 번호 칩을 누르면 그 단계로 바로 갑니다.',1],
 ['#rp_att','업체가 QR을 찍으면 참석자가 여기 나옵니다. 담당자 확인을 누릅니다.'],
 ['#rp_joint','합동점검표입니다. 전 항목이 [양호]로 미리 체크되어 있으니 문제 있는 것만 바꿉니다.'],
 ['#rp_council','협의체 회의록을 적습니다.'],
 ['.roomfoot','다 적었으면 맨 아래 버튼으로 미팅을 마칩니다.',1]]);
G('scheck','현장 확인 화면입니다.',[
 ['.jobitem','확인할 공사를 누르면 작업허가서 승인·순회점검일지 확인 화면이 열립니다. 숫자는 처리할 건수입니다.',1]]);
G('permits','작업허가서 확인 화면입니다. 업체는 발행 즉시 작업하고, 담당자는 확인 후 승인합니다.',[
 ['.seg','위 탭으로 작업허가서 ↔ 순회점검일지를 바꿔 봅니다. 숫자는 처리할 건수입니다.',1],
 ['.rtable','업체별 발행·대기·특이사항 건수입니다.'],
 ['.pmck','승인할 허가서만 골라서 체크할 수 있습니다.',1],
 ['.blmain','누르면 허가서 내용을 자세히 봅니다.',1],
 ['button[onclick="pmApprove(false)"]','체크한 허가서만 승인할 때 [선택 승인]을 누릅니다.',1],
 ['button[onclick="pmApprove(true)"]','대기 중인 허가서를 한 번에 승인할 때 [대기 전체 승인]을 누릅니다.',1]]);
G('insplist','순회점검일지 확인 화면입니다.',[
 ['.rtable','업체별 마지막 점검일·대기·미조치 건수입니다. 빨간 글씨는 확인이 필요한 곳입니다.'],
 ['details.hist','미조치 지적사항입니다. 펼쳐서 볼 수 있습니다.',1],
 ['.inck','확인할 일지만 골라서 체크할 수 있습니다.',1],
 ['.blmain','누르면 일지 내용과 사진을 봅니다.',1],
 ['button[onclick="inCheck(false)"]','체크한 일지만 확인할 때 [선택 확인]을 누릅니다.',1],
 ['button[onclick="inCheck(true)"]','대기 중인 일지를 한 번에 확인할 때 [대기 전체 확인]을 누릅니다. 일지에 "도급인 확인"이 남습니다.',1]]);
G('vendors','업체 현황 화면입니다.',[
 ['.seg','상태별(가입 대기·작성 중·검토 중·승인)로 골라 봅니다.',1],
 ['.svitem','업체를 누르면 신청 내용과 제출 서류가 펼쳐집니다.',1],
 ['button[onclick^="svDecide"]','가입 대기 업체는 내용을 확인하고 [가입 승인] 또는 [반려]를 누릅니다.',1]]);
G('jobend','공사 연장·종료 화면입니다.',[
 ['#f_exEnd','공사가 계속되면 새 종료일을 고릅니다.'],
 ['#f_exWhy','연장 사유를 적습니다. (예: 자재 입고 지연)'],
 ['button[onclick^="extendNow"]','[연장 저장]을 누르면 기간이 늘어나고 이력이 남습니다.',1],
 ['button[onclick^="endJobNow"]','공사가 끝났으면 [공사 종료하고 평가 시작]을 누릅니다. 업체마다 종료 평가서가 만들어집니다.',1]]);
G('evallist','공사 종료 평가 화면입니다.',[
 ['.jobitem','평가할 업체를 누르세요.',1]]);
G('evalform','업체 종료 평가 화면입니다.',[
 ['.pill.lock','[자동] 표시 항목은 순회점검·작업허가서 기록으로 미리 체크했습니다. 맞지 않으면 바꿉니다.'],
 ['#ev_1 .jm','항목마다 우수·보통·미흡을 고릅니다.',1],
 ['#f_evm12','12번은 공사 중 사고 여부를 꼭 적습니다. (예: 무재해)'],
 ['#f_evCmt','개선사항을 적으면 다음 계약·현장설명 때 안내됩니다.'],
 ['#evSum','합계 점수와 등급이 여기 나옵니다.'],
 ['button[onclick="saveEval(false)"]','중간에 멈출 때는 [임시 저장]을 누릅니다.',1],
 ['button[onclick="saveEval(true)"]','다 했으면 [평가 확정]을 누릅니다.',1]]);
const TODAY_KINDS=['day','reg','permit','insp'];
/** ❔ 사용 가이드 버튼 (kind 별) */
function gdBtn(kind,label){return '<button type="button" class="button ghost gdbtn" id="gd_'+kind+'" style="padding:4px 8px;font-size:12px" onclick="startTour(\''+kind+'\')">'+(label||'❔ 사용 가이드')+'</button>'}
function gdRow(kind){return '<div style="text-align:right;margin:0 0 8px">'+gdBtn(kind)+'</div>'}
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
function startTour(kind){if(!TOUR_STEPS[kind]||(TODAY_KINDS.includes(kind)&&!vjob))return;endTour(true);tourCss();document.body.classList.add('touring');  // 안내 중에는 '오늘 완료' 막을 잠시 숨김
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
async function tourScreenTo(scr){if(!scr)return;const cur=tourScreen();  // scr 없음 = 지금 화면 그대로if(cur===scr)return;
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
 if(quiet)return;
 if(!TODAY_KINDS.includes(t.kind)){const b=$('gd_'+t.kind);if(b){b.scrollIntoView({block:'center'});b.focus({preventScroll:true})}return}  // 화면별 가이드: 화면은 그대로 두고 버튼으로 돌아옴
 const scr=tourScreen();if(scr==='permit'){hideSheet();pm=null}if(scr!=='today'){if(t.demo)ins=null;renderVJob()}
 const back=$(t.kind==='day'?'gdDay':t.kind==='reg'?'gdReg':t.kind==='permit'?'gdPermit':'gdInsp');if(back){back.scrollIntoView({block:'center'});back.focus({preventScroll:true})}
 if(t.kind==='day')msg('모를 때는 각 칸의 [❔ 사용 가이드]를 눌러 보세요.')}
