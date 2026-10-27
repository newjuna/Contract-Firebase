/* 도급 안전관리 · Firebase 연결부 (F1.7: 로그인 · 직원 · 사업자 등록/승인 · 계약 전 서류 · 공사/작업자 · 작업허가서 · 순회점검 · 협의체/합동점검 · 공사 종료/평가)
 * - 화면(app.js)은 예전처럼 api('기능이름', 인자) 로 부르고, 이 파일이 Firestore에서 바로 처리함
 *   (예전: 버튼마다 Apps Script 서버 왕복 → 느림 / 지금: 휴대폰이 Firestore를 직접 읽고 씀)
 * - 권한(업체는 자기 것만, 직원 관리는 안전보건팀만 등)은 Firebase 보안 규칙(firestore.rules)이 최종 확인
 *   → 이 파일의 권한 확인은 화면 안내용, 진짜 막는 것은 규칙
 * - 아직 옮기지 않은 기능은 '아직 Firebase로 옮기지 않은 기능' 안내
 */
(function () {
  const VERSION = '26.10.24 F1.8t';
  /* ---------- 기존 Code.gs와 같은 기준값 ---------- */
  const CFG = {
    INDUSTRIES: ['입고도우미', '재고조사', '인테리어(마감)', '사인', '냉난방기', '집기', '본사 식당'],
    TEST_SKIP_FILES: true,          // 테스트 기간: 파일 없이도 신청·제출 (운영 전 false)
    APPROVER_DOMAINS: ['daiso.co.kr'],
  };
  const MASTER_EMAILS = ['zxcv6309@gmail.com'];  // firestore.rules의 isMaster()와 같게 유지
  const STAFF_ROLES = { SAFETY: '안전보건팀', CLIENT: '도급인 담당자' };
  const STAFF_SEED = [['박OO', 'gerrard08@daiso.co.kr', 'gerrardbak08@gmail.com'], ['강OO', 'sky5224122@daiso.co.kr', 'sky5224122@gmail.com'], ['유OO', 'junha.yoo@daiso.co.kr', 'zxcv6309@gmail.com'], ['서OO', 'ymoo09@daiso.co.kr', 'sds4436@gmail.com'], ['박OO', 'younha.park@daiso.co.kr', 'kong6866@gmail.com'], ['윤OO', 'jeongin.yoon@daiso.co.kr', 'dndjekrl@gmail.com']];
  const STEP_NAMES = ['기본정보', '안전보건 조직', '안전관리계획', '증빙자료', '최종확인'];
  const FIELDS = {
    // F1.8a 사업장 정보는 3칸만 (현장대리인 성명 · 연락처 · 사업장 소재지) — 중계 서버 FIELDS1_과 같게
    1: [['siteManager', '현장대리인 성명'], ['siteManagerPhone', '현장대리인 연락처'], ['siteAddress', '사업장 소재지 (주소)']],
    2: [['safetyManager', '안전보건 담당자'], ['safetyPhone', '담당자 연락처'], ['orgPolicy', '안전보건 조직 및 역할']],
    3: [['riskFactors', '주요 위험요인'], ['prevention', '안전조치 및 예방대책'], ['emergency', '사고보고·비상대응 절차']],
    4: [['training', '안전보건교육 현황'], ['protective', '보호구 및 장비 관리'], ['otherDocuments', '추가 증빙자료 설명']],
    5: [['finalConfirm', '제출 내용 확인(확인 완료 입력)']],
  };
  const INDUSTRY_FIELDS = {
    '입고도우미': ['롤테이너·L카 이동 안전조치', '하차 중 차량 및 작업자 동선 분리'], '재고조사': ['사다리 및 창고작업 안전조치', '고객 동선과 조사구역 분리'],
    '인테리어(마감)': ['전기·고소·화기작업 안전조치', '분진·소음 및 작업구역 통제'], '사인': ['고소·낙하물 방지대책', '외부 보행자 보호 및 전기 작업'],
    '냉난방기': ['전원 차단·전기 작업관리', '냉매·중량물·고소작업 관리'], '집기': ['집기 전도 및 낙하 방지', '전동공구 및 고객 동선 관리'], '본사 식당': ['미끄러짐·화상·절단 방지', 'MSDS·근골격계 예방'],
  };
  const NOTICE_LABEL = { VENDOR_APPROVED: '계약 전 평가 확정', JOB_EXTENDED: '공사 연장', JOB_ENDED: '공사 종료', JOB_EVAL_DONE: '공사 종료 평가 확정' };
  /* @@v527-start (v5.27 Code.gs에서 그대로 복사한 상수 · 중계 Relay.gs와 같은 값) */
  const DOC_STAGE={CONTRACT:'계약',EXECUTION:'수행',CLOSE:'종료'};
  const DOC_STAGE_ORDER={CONTRACT:1,EXECUTION:2,CLOSE:3};
  const DOC_OWNER={VENDOR:'수급사(협력업체)',PRINCIPAL:'원청',JOINT:'원청·협력업체'};
  const DOC_TYPE_SEED=[
   ['C01','CONTRACT',1,'안전보건관리규정','용역·도급 계약시','VENDOR','TEMPLATE','Y'],
   ['C02','CONTRACT',2,'안전보건관리계획서','용역·도급 계약시','VENDOR','TEMPLATE','Y'],
   ['C03','CONTRACT',3,'수급업체 안전보건수준평가','용역·도급 계약시','PRINCIPAL','EVALUATION','N'],
   ['E01','EXECUTION',1,'안전보건협의체','월1회','JOINT','TEMPLATE','N'],
   ['E02','EXECUTION',2,'위험성평가','정기/수시','VENDOR','TEMPLATE','N'],
   ['E03','EXECUTION',3,'작업장 순회점검','2일1회','PRINCIPAL','TEMPLATE','N'],
   ['E04','EXECUTION',4,'작업장 합동 안전보건점검','2달1회','JOINT','TEMPLATE','N'],
   ['E05','EXECUTION',5,'안전보건교육 지원 및 확인','정기/수시','PRINCIPAL','TEMPLATE','N'],
   ['E06','EXECUTION',6,'안전작업계획서(안전작업허가 운영)','수시','VENDOR','TEMPLATE','N'],
   ['E07','EXECUTION',7,'수급인에 대한 시정조치','수시','PRINCIPAL','TEMPLATE','N'],
   ['E08','EXECUTION',8,'작업환경측정','정기','PRINCIPAL','TEMPLATE','N'],
   ['E09','EXECUTION',9,'비상시 대비 및 대응 훈련','정기','PRINCIPAL','TEMPLATE','N'],
   ['E10','EXECUTION',10,'위생시설 설치 또는 이용','정기/수시','PRINCIPAL','TEMPLATE','N'],
   ['E11','EXECUTION',11,'안전보건에 관한 정보제공','수시','PRINCIPAL','NONE','N'],
   ['X01','CLOSE',1,'안전보건수준 재평가','수시','PRINCIPAL','EVALUATION','N']
  ];
  const RULE_TITLE='도급사업에 있어서의 협의체 운영지침';
  const RULE_TEXT=[
   ['제1조 (목적)','도급사업에 있어서 발생될 수 있는 재해를 미연에 방지하며 수급업체와 함께 안전활동을 전개하여 무재해 사업장을 이룩하기 위함.'],
   ['제2조 (적용범위)','"을" 및 "을"의 근로자를 대상으로 한다.'],
   ['제3조 (협의체 구성)','"갑"과 "을" 전원으로 구성한다.\n【단, "갑"의 업무를 위임받은 안전보건총괄책임자 및 안전관리자 1인, 보건관리자 1인, 주관부서의 책임자 1인으로 하며 "을"의 경우 "을" 또는 "을"의 업무를 위임받은 (현장소장 등) 1인으로 할 수 있다.】'],
   ['제4조 (협의내용)','작업의 시작시간, 작업장 간의 연락방법, 재해위험 시의 대피방법 기타 재해예방을 위하여 필요한 사항'],
   ['제5조 (운영방법)','매월 1회 이상 정기회의 개최'],
   ['제6조 (회의결과)','기록, 보존하여야 함 (안전관리자 기록유지)'],
   ['제7조 (작업장의 순회점검)','2일에 1회 이상 안전보건총괄책임자를 제외한 협의체 위원 전원이 당해 작업장을 순회 점검한다.\n분기에 1회 이상 협의체 위원 전원이 당해 작업장을 순회점검한다.\n"을"은 순회점검을 기피해서는 안 된다.\n순회점검 결과 지적사항에 대해서는 "을"은 즉시 시정하여야 한다.'],
   ['제8조 (작업중지)','안전사고의 급박한 위험이 예상되어 안전보건총괄책임자로부터 작업중지를 요구받은 경우에는 즉시 작업을 중지하고 근로자를 안전한 장소로 대피시켜야 하며 작업중지로 인하여 발생되는 손실은 "을"이 부담한다.'],
   ['제9조 (안전보건교육)','"을"은 당해 "을"의 근로자에 대하여 노동부령이 정하는 바에 의하여 정기적으로 안전보건에 관한 교육을 실시하여야 하며 교육결과를 기록 보전하여야 한다. "갑"은 "을"이 당해 근로자 안전보건교육에 관한 협조 요청 시 특별한 사유가 없는 한 지도와 지원을 할 수 있다.'],
   ['제10조 (유해·위험기계·기구 안전방호장치)','"을"은 노동부령이 정하는 유해·위험기계·기구에 대하여 안전방호장치를 설치 후 작업하여야 한다.']];
  const HQ_NAME='(주)아성다이소';
  /* F1.8r 위험성평가 기본 자료 (업체 제출 위험성평가표 공종별 내용 + 다이소 업종) · 상중하 판단법
   *  [공종키, 공종명, 주요 재해, 주요 대책, 작업허가 대상, 사용 설비, [[위험ID, 세부작업, 유해·위험요인, 감소대책, 위험성(상·중·하), 순회점검 질문], …]]
   *  개선 후 위험성 = 상→중 · 중→하 · 하→하 (감소대책 이행 기준) · fb.js · Relay.gs 같은 값 */
  const RISK_TRADES=[
   ['DEMO','해체·철거','떨어짐·붕괴·비산','개구부 방호, 방진막·가설울타리, 보호구 착용',false,'해체공구·비계',[
    ['DEMO1','가설·비산 방지','가설구조물 설치 불량으로 해체 잔재물 비산·분진·소음 발생','가설울타리·비산차단벽·방진막·살수설비 설치','중','해체 구역에 가설울타리·방진막 등 비산 방지시설이 설치되어 있는가?'],
    ['DEMO2','폐기물 반출','해체물·폐기물 반출 시 적재불량, 수직동선 미확보로 떨어짐','작업발판 적재하중 초과 금지, 양중 와이어로프·체인은 허용하중 표시 제품 사용','상','해체·폐기물 반출 시 적재불량·동선 미확보로 떨어질 위험은 없는가?'],
    ['DEMO3','잔재물 정리','통로·작업발판 잔재물 방치로 넘어짐','잔재물 발생 즉시 처리','중','통로·작업발판에 잔재물이 방치되어 넘어질 위험은 없는가?'],
    ['DEMO4','잔재물 적치','발코니 등 슬래브 단부에 잔재물 적치로 변형·붕괴','슬래브 단부·발코니에 잔재물 적치 금지','상','슬래브 단부·발코니에 잔재물을 쌓아 무너질 위험은 없는가?'],
    ['DEMO5','안전시설','해체로 생긴 개구부에서 떨어짐','개구부 덮개·안전난간·추락방호망 설치','상','해체로 생긴 개구부에 덮개·안전난간이 설치되어 있는가?'],
    ['DEMO6','보호구','보호구 미착용으로 안구·호흡기·머리 손상','안전모·안전화·방진마스크·보안경 지급 및 착용','중','안전모·방진마스크·보안경 등 보호구를 착용하고 있는가?']]],
   ['SCAF','가설·비계 (고소작업)','떨어짐·무너짐·맞음','안전난간·승강계단, 안전대 착용, 아웃트리거·스토퍼',true,'강관비계·이동식 비계·말비계·사다리',[
    ['SCAF1','강관비계 이동','비계 위 이동 시 떨어짐','안전난간·승강계단 설치, 안전대 착용, 발판 고정','상','비계에 안전난간·승강계단이 있고 발판이 고정되어 있는가?'],
    ['SCAF2','강관비계','비계가 무너짐','발판 적재 400kg 이하, 기둥 간격(세로 1.5m·가로 1.8m) 준수, 전용철물로 연결','상','비계 기둥 간격·연결 상태가 양호하고 과적재는 없는가?'],
    ['SCAF3','낙하 방지','자재가 떨어져 맞음','이동통로 위 자재 적재 금지, 상부 작업 시 하부 통행금지, 안전모 착용','중','상부 작업 중 하부 통행 통제·자재 낙하 방지가 되어 있는가?'],
    ['SCAF4','이동식 비계 승강','오르내릴 때 떨어짐','승강사다리 설치, 안전대 착용','상','이동식 비계에 승강사다리가 있고 안전대를 착용하는가?'],
    ['SCAF5','이동식 비계 상부','재료·공구가 떨어짐','재료·공구는 달기로프·포대로 운반','중','재료·공구를 달기로프·포대로 올리고 내리는가?'],
    ['SCAF6','이동식 비계','작업 중 비계가 움직여 떨어짐','아웃트리거 설치, 바퀴 스토퍼 장착','상','이동식 비계에 아웃트리거·바퀴 스토퍼가 설치되어 있는가?'],
    ['SCAF7','사다리·말비계','사다리·말비계에서 떨어짐','사다리 2인 1조·전도방지, 최상단 사용 금지, 말비계 발판 폭 40cm 이상','상','사다리·말비계 사용 시 2인 1조·전도방지가 지켜지는가?']]],
   ['TILE','타일','근골격계·미끄러짐·베임','바른 자세 운반, 바닥 정리, 절단기 방호덮개·집진',false,'타일 절단기·믹서·해머드릴',[
    ['TILE1','자재 반입·운반','인력 운반 시 근골격계질환·넘어짐·끼임','무릎 굽혀 들기, 바닥 돌출물 제거, 받침목 사용','중','타일 박스 운반 시 바른 자세·통로 정리가 되어 있는가?'],
    ['TILE2','붙임재료 배합','배합 시 화재·폭발, 회전날 접촉','정해진 배합용기 사용(폐드럼 절단 사용 금지), 믹서 사용 시 안전장갑·회전날 접근 금지','중','배합 믹서 회전날 접촉·폐드럼 용기 사용 위험은 없는가?'],
    ['TILE3','바탕처리','물고임으로 미끄러짐, 고정못 탈락으로 눈 손상','적정 기울기 유지, 고정못 견고히 고정, 보안경 착용','하','바탕처리 중 물고임으로 미끄러질 위험은 없는가?'],
    ['TILE4','타일 가공','절단 시 신체 손상·분진','연삭숫돌 방호덮개, 평탄한 곳에서 1장씩 절단, 집진·환기설비','중','타일 절단기에 방호덮개가 있고 분진 집진이 되는가?'],
    ['TILE5','타일 붙이기','타일 탈락, 바닥 미끄러짐, 발판에서 떨어짐','작업 전 잔여자재 청소, 페인트통·박스를 발판으로 사용 금지','중','페인트통·박스를 발판으로 쓰거나 바닥이 미끄러운 곳은 없는가?'],
    ['TILE6','타일 철거','해머드릴 접촉, 타일 탈락으로 낙하','철거 부위 사전조사, 드릴은 확실히 잡기, 벽체는 아래 방향으로 철거','중','타일 철거 시 하부 통제·낙하 방지가 되어 있는가?']]],
   ['LGW','경량 벽체','화재·감전·베임','가연물 제거·소화기, 보안경·장갑, 타정총 안전관리',true,'타정총·교반기·절단기·말비계',[
    ['LGW1','작업 전 준비','소운반 장비 부적정, 개구부 방호 불량','형상에 맞는 운반장비, 개구부 안전난간·덮개 확인, 화재·질식 위험 교육','중','작업장·통로 주변 개구부 방호와 운반 장비가 적정한가?'],
    ['LGW2','석고보드·단열재','비산물로 눈 손상, 교반기 감전, 칼 베임','보안경·안전장갑 착용, 교반기 접지·절연 점검','중','보안경·장갑을 착용하고 교반기 접지가 되어 있는가?'],
    ['LGW3','경량벽체 설치','용접·절단 시 화재, 공구 베임','가연물 제거·불티비산방지·소화기 비치, 말비계 폭 40cm 이상','상','용접·절단 시 불티 비산 방지·소화기 비치가 되어 있는가?'],
    ['LGW4','타정총 사용','타정총 화재·폭발·오작동','사전신고, 별도 보관, 사람을 향하지 않기, 안전장치 작업 전 점검','상','타정총 안전장치·보관 상태가 양호하고 사람을 향해 쓰지 않는가?']]],
   ['LGC','경량 천장','떨어짐·낙하·안구 손상','빈틈없는 작업발판, 사다리 대신 비계, 보안경·안전모',true,'이동식 비계·전동드릴·타카건',[
    ['LGC1','부재 운반·적재','양중 시 부딪힘, 부재 떨어짐·전도','적정 양중장비 선정, 공정 순서에 맞게 반입, 벽에 기대 세우지 않기','중','천장 부재를 기대어 세워 두거나 과다 적재한 곳은 없는가?'],
    ['LGC2','천장용 발판','불연속 발판·사다리 사용으로 떨어짐','바닥 전체에 빈틈없이 발판 설치, 2개소 이상 고정','상','천장 작업 발판이 빈틈없이 설치·고정되어 있는가?'],
    ['LGC3','천장틀 설치','상향 작업 시 안구 손상, 발판에서 떨어짐','보안경·안전모 착용, 사다리 대신 이동식 비계 사용','상','천장 작업 때 사다리 대신 비계를 쓰고 보안경을 착용하는가?'],
    ['LGC4','천장재 부착','발판에서 떨어짐, 부재 낙하, 타카건 신체 손상','2인 1조 고정, 타카건은 사람을 향하지 않기·이동 시 잠금','중','천장재 고정 시 2인 1조·타카건 안전 사용을 지키는가?']]],
   ['METAL','금속 (절단·용접)','화재·감전·안구 손상','불티 비산방지·소화기, 절단기 덮개, 자동전격방지기',true,'고속절단기·용접기·연삭기',[
    ['METAL1','자재 절단·가공','보안경 미착용으로 안구 손상','보안경 등 보호구 착용','중','절단·가공 시 보안경을 착용하는가?'],
    ['METAL2','고속절단기','회전부 덮개 미설치로 베임','연삭숫돌 덮개 설치','중','고속절단기 회전부에 덮개가 설치되어 있는가?'],
    ['METAL3','절단 불티','불티 비산으로 화재','불티 비산방지 커버 설치, 소화기 비치','상','절단 불티 비산방지 커버·소화기가 준비되어 있는가?'],
    ['METAL4','인화물질 주변','도료·시너 주변 화기 사용으로 화재','인화물질 주변 화기 사용 금지','상','도료·시너 등 인화물질 주변에서 화기를 쓰지 않는가?'],
    ['METAL5','아크용접','자동전격방지기 미부착으로 감전','자동전격방지기 부착, 입출력 단자부 절연','상','교류아크용접기에 자동전격방지기가 부착되어 있는가?']]],
   ['GLASS','창호·유리','낙하·떨어짐','인양 시 주변 통제, 안전대 착용, 2인 1조',true,'지게차·윈치·흡착기',[
    ['GLASS1','자재 인양','지게차로 인양 중 돌출물에 걸려 낙하','바닥 돌출물 제거, 주변 통제','상','유리 인양 시 주변 통제·돌출물 제거가 되어 있는가?'],
    ['GLASS2','윈치 인양','윈치 지지대가 꺾여 유리 낙하','안정장치·상부 와이어 고정 확인, 반경 내 접근금지','상','윈치 고정 상태를 확인하고 반경 내 접근을 막았는가?'],
    ['GLASS3','창호·유리 설치','안전대 미착용으로 떨어짐','안전대 등 개인보호구 착용','상','창호·유리 설치 시 안전대를 착용하는가?'],
    ['GLASS4','대형유리','흡착기 단독 작업 중 유리 낙하','2인 1조, 흡착기 허용 중량 확인','중','대형유리는 2인 1조로 흡착기 허용 중량 안에서 작업하는가?']]],
   ['PAINT','도장','화재·질식·떨어짐','화기 금지·환기, 방독마스크, 비계 안전난간',false,'그라인더·에어콤프레셔·이동식 비계',[
    ['PAINT1','면처리','그라인더 숫돌 파손으로 비산, 절연 파손으로 감전','적합한 숫돌 선정, 방호장치 유지, 1분 공회전, 보안경 착용','중','그라인더 방호덮개·숫돌 상태를 확인하고 보안경을 쓰는가?'],
    ['PAINT2','초벌도장','이동식 비계 설치 불량으로 떨어짐','발판 틈 3cm 이하, 안전난간·아웃트리거 설치','상','도장용 비계에 안전난간·아웃트리거가 있는가?'],
    ['PAINT3','도장 작업','주변 화기로 화재, 보호구 미착용으로 질식','주변 용접·용단 금지, 라이터 소지 금지, 환기','상','도장 주변에 화기·라이터가 없고 환기가 되는가?'],
    ['PAINT4','퍼티작업','우마 발판 전도, 발코니에서 떨어짐','폭 40cm 이상 발판·일일점검, 안전고리 체결','중','우마(말비계) 발판 상태가 양호하고 안전고리를 거는가?'],
    ['PAINT5','마감도장','환기 미실시로 화재·폭발, 밀폐공간 질식','방독마스크, 환기설비, 소화기 비치, 도료 별도 보관','상','밀폐된 곳 도장 시 환기·방독마스크·소화기가 준비되어 있는가?']]],
   ['ELEC','전기','감전·떨어짐·화재','전원 차단·잠금(LOTO), 절연 보호구, 누전차단기',true,'분전반·전선·검전기·가설전기',[
    ['ELEC1','배선작업','전원 미차단·보호구 미착용으로 감전','전원 차단·잠금장치(LOTO), 검전 후 작업, 절연장갑·안전모 착용','상','전원 차단·잠금(LOTO) 후 절연 보호구를 착용하고 작업하는가?'],
    ['ELEC2','등기구 설치','사다리에서 떨어짐','이동식 비계 등 작업발판 사용','상','등기구 설치 시 사다리 대신 작업발판을 쓰는가?'],
    ['ELEC3','계량기·분전반','전기 스파크로 폭발·화재','주변 인화성 물질 제거 후 작업','상','분전반·계량기 주변에 인화성 물질이 없는가?'],
    ['ELEC4','가설전기','누전으로 감전','누전차단기 설치, 피복 손상 전선 사용 금지','상','가설전기에 누전차단기가 있고 피복이 손상된 전선은 없는가?']]],
   ['MECH','기계설비 (공조·소방·냉난방기)','낙하·화재·감전·떨어짐','신호수 배치, 훅 해지장치, 용접 불티 방지, 고소작업대 점검',true,'크레인·지게차·고속절단기·용접기·고소작업대',[
    ['MECH1','자재 반입','유도자 미배치로 부딪힘','크레인·지게차 사용 시 신호수 배치·주변 통제','상','장비 사용 시 신호수를 배치하고 주변을 통제하는가?'],
    ['MECH2','자재 적재','불안전하게 적재해 무너짐','평탄·견고한 곳에 안정되게 적재','중','자재가 평탄한 곳에 안정되게 쌓여 있는가?'],
    ['MECH3','크레인 인양','훅 해지장치 미설치·로프 손상으로 낙하','훅 해지장치 설치, 작업 전 줄걸이·로프 확인','상','크레인 훅 해지장치와 줄걸이 로프 상태가 양호한가?'],
    ['MECH4','배관 절단·용접','불티로 보온재 등 화재','인화성 자재 주변 용접 금지, 불티 비산방지, 소화기 비치','상','배관 용접·절단 시 보온재 등 가연물을 치우고 소화기를 두었는가?'],
    ['MECH5','고속절단기','누전으로 감전','사용 전 점검, 누전차단기 설치, 접지선 연결','상','고속절단기에 누전차단기·접지가 되어 있는가?'],
    ['MECH6','가스용기','밀폐된 곳에서 LPG·산소 누출','환기되는 곳에 비치, 사용 전 누출 확인','상','LPG·산소 용기를 환기되는 곳에 두고 누출 점검을 하는가?'],
    ['MECH7','천장 배관','배관 낙하, 균형 잃고 떨어짐','받침대·로프로 결속, 2인 1조','중','천장 배관을 결속하고 2인 1조로 작업하는가?'],
    ['MECH8','고소작업대','과상승방지장치 미작동, 떨어짐','과상승방지장치 작동 확인(작업높이보다 50cm 이상), 안전난간 설치','상','고소작업대 과상승방지장치·안전난간이 정상인가?'],
    ['MECH9','수압·기밀시험','시험 중 가스·물 분출','시험 계획 수립, 펌프·압력계 사전 점검','중','수압·기밀시험 전에 펌프·압력계를 점검했는가?']]],
   ['SIGN','간판','낙하·전도·떨어짐','인양 로프 점검, 크레인 거치, 신호수, 하부 통제',true,'이동식 크레인·고소작업대·사다리',[
    ['SIGN1','자재 인양','인양로프 파손으로 자재 낙하','중량을 충분히 지지하는 로프 사용','상','간판 인양 로프 상태가 양호한가?'],
    ['SIGN2','이동식 크레인','아웃트리거 불안정 거치로 전도','평탄·견고한 지반에 거치','상','이동식 크레인 아웃트리거가 견고하게 거치되어 있는가?'],
    ['SIGN3','장비 사용','유도자 미배치로 부딪힘','신호수 배치·주변 통제','중','장비 사용 시 신호수를 배치했는가?'],
    ['SIGN4','상부 작업','공구가 떨어짐','공구 달기로프, 작업구간 하부 인원 통제','중','상부 작업 시 공구 낙하 방지·하부 통제가 되어 있는가?'],
    ['SIGN5','시트지 부착','잔존물로 미끄러짐, 커터칼에 베임','쓰레기 즉시 수거, 커터칼은 작업 때만 꺼내기','하','바닥 쓰레기 정리·커터칼 보관이 잘 되어 있는가?']]],
   ['HOT','화기작업 (용접·절단·그라인더)','화재·화상','화기작업 허가, 가연물 제거, 소화기·화재감시자',true,'용접기·절단기·그라인더',[
    ['HOT1','용접·절단','불티로 화재','화기작업 허가, 가연물 제거, 불티 비산방지포, 소화기 비치, 화재감시자 배치','상','화기작업 허가 후 가연물 제거·소화기·화재감시자가 있는가?'],
    ['HOT2','그라인더','숫돌 파손·회전부 접촉','방호덮개 부착, 보안경·보안면 착용','중','그라인더 방호덮개를 달고 보안경을 쓰는가?']]],
   ['LOAD','입고·중량물 운반','끼임·부딪힘·근골격계','2인 1조, 대차 사용, 차량·작업자 동선 분리',false,'롤테이너·L카·대차',[
    ['LOAD1','롤테이너·L카 이동','끼임·부딪힘·근골격계질환','2인 1조, 대차 사용, 이동 동선 확보','중','롤테이너·L카 이동 동선이 확보되고 2인 1조로 운반하는가?'],
    ['LOAD2','하차 작업','차량과 작업자 동선이 겹쳐 부딪힘','차량·작업자 동선 분리, 유도자 배치','상','하차 중 차량과 작업자 동선이 분리되어 있는가?'],
    ['LOAD3','박스 적재','적재물이 무너지거나 떨어짐','무거운 것은 아래로, 적재 높이 제한','중','상품 박스를 무너지지 않게 쌓았는가?']]],
   ['STOCK','재고조사 (창고·진열대)','떨어짐·맞음·넘어짐','사다리 2인 1조, 상단 적재물 확인, 조사구역 표시',false,'사다리·발판',[
    ['STOCK1','사다리 사용','사다리에서 떨어짐','2인 1조, 전도방지, 최상단 사용 금지','상','사다리를 2인 1조로 쓰고 최상단에 올라가지 않는가?'],
    ['STOCK2','창고 상단','상품이 떨어져 맞음','상단 적재물 확인, 안전모 착용','중','창고 상단 적재물이 떨어질 위험은 없는가?'],
    ['STOCK3','매장 조사','고객과 부딪힘·넘어짐','조사 구역 표시, 고객 동선 분리','하','조사 구역을 표시하고 고객 동선을 분리했는가?']]],
   ['FORK','지게차·전동대차','충돌·깔림','면허자 운전, 유도자 배치, 작업구역 통제',false,'지게차·전동대차',[
    ['FORK1','운전','충돌·깔림','면허자 운전, 제한속도 준수, 유도자 배치','상','지게차는 면허자가 운전하고 유도자를 배치했는가?'],
    ['FORK2','작업구역','보행자와 충돌','작업구역 통제, 경광등·후진경보','상','지게차 작업구역에 보행자 출입을 통제하는가?']]],
   ['CHEM','유해물질 (도료·접착제·세제)','중독·화재','MSDS 비치·교육, 보호구, 화기 엄금 보관',false,'도료·접착제·세제',[
    ['CHEM1','취급','중독·피부 손상','MSDS 비치·교육, 보호장갑·방독마스크 착용','중','MSDS를 비치하고 보호구를 착용하는가?'],
    ['CHEM2','보관','인화성 물질 화재','환기되는 곳에 보관, 화기 엄금','상','인화성 물질을 화기와 떨어진 곳에 보관하는가?']]],
   ['CONF','밀폐공간','질식','산소·유해가스 측정, 환기, 감시인 배치',true,'가스측정기·송풍기',[
    ['CONF1','출입·작업','산소결핍·유해가스로 질식','작업 전 산소·가스 측정, 환기, 감시인 배치','상','밀폐공간 작업 전 산소·가스 측정과 환기를 했는가?']]],
   ['KITCHEN','조리·주방 (본사 식당)','화상·베임·미끄러짐','방열장갑, 안전칼집, 미끄럼방지화',false,'조리기구·튀김기·칼',[
    ['KIT1','조리','화상','방열장갑 착용, 기름 온도 관리','중','조리 시 방열장갑을 쓰고 튀김기 주변이 정리되어 있는가?'],
    ['KIT2','칼 사용','베임','안전칼집 사용, 지정 장소 보관','하','칼을 칼집·지정 장소에 보관하는가?'],
    ['KIT3','바닥','미끄러짐','미끄럼방지화 착용, 물기 즉시 제거','중','주방 바닥 물기를 바로 닦고 미끄럼방지화를 신는가?']]]];
  /* 예전 위험작업 표와 같은 모양 (계획서 Ⅱ-4 · Ⅲ-2 · 계약 전 자동 평가에서 씀) [키, 이름, 재해, 대책, -, -, 허가대상, 설비] */
  const PLAN_WORKS=RISK_TRADES.map(t=>[t[0],t[1],t[2],t[3],0,0,t[4],t[5]]);
  const RISK_ALL=[].concat(...RISK_TRADES.map(t=>t[6].map(r=>({t:t[0],tl:t[1],id:r[0],step:r[1],haz:r[2],meas:r[3],lv:r[4],q:r[5]}))));
  const RISK_AFTER={'상':'중','중':'하','하':'하'};
  /* F1.8s 교육일지 · 산업안전보건법 시행규칙 [별표 5] · 신규자 = 채용 시 교육(다목) 1시간 · 공종을 고르면 특별교육(라목) 추가 → 2시간 · fb.js · Relay.gs 같은 값 */
  const EDU_HIRE=['산업안전 및 산업재해 예방에 관한 사항 (화재·폭발 사고 발생 시 대피에 관한 사항 포함)','산업보건 및 건강장해 예방에 관한 사항','위험성 평가에 관한 사항','산업안전보건법령 및 산업재해보상보험 제도에 관한 사항','직무스트레스 예방 및 관리에 관한 사항','직장 내 괴롭힘, 고객의 폭언 등으로 인한 건강장해 예방 및 관리에 관한 사항','기계·기구의 위험성과 작업의 순서 및 동선에 관한 사항','작업 개시 전 점검에 관한 사항','정리정돈 및 청소에 관한 사항','사고 발생 시 긴급조치에 관한 사항','물질안전보건자료에 관한 사항'];
  const EDU_ETC='그 밖에 안전·보건관리에 필요한 사항';
  const EDU_SPECIAL={
   13:['운반용 등 하역기계를 5대 이상 보유한 사업장에서의 해당 기계로 하는 작업',['운반하역 기계 및 부속설비의 점검에 관한 사항','작업순서와 방법에 관한 사항','안전운전방법에 관한 사항','화물의 취급 및 작업신호에 관한 사항']],
   14:['1톤 이상의 크레인을 사용하는 작업',['방호장치의 종류, 기능 및 취급에 관한 사항','걸고리·와이어로프 및 비상정지장치 등의 기계·기구 점검에 관한 사항','화물의 취급 및 안전작업방법에 관한 사항','신호방법 및 공동작업에 관한 사항','인양 물건의 위험성 및 낙하·비래·충돌재해 예방에 관한 사항','인양물이 적재될 지반의 조건, 인양하중, 풍압 등이 인양물과 타워크레인에 미치는 영향']],
   17:['전압이 75볼트 이상인 정전 및 활선작업',['전기의 위험성 및 전격 방지에 관한 사항','해당 설비의 보수 및 점검에 관한 사항','정전작업·활선작업 시의 안전작업방법 및 순서에 관한 사항','절연용 보호구, 절연용 방호구 및 활선작업용 기구 등의 사용에 관한 사항']],
   23:['높이가 2미터 이상인 물건을 쌓거나 무너뜨리는 작업',['원부재료의 취급 방법 및 요령에 관한 사항','물건의 위험성·낙하 및 붕괴재해 예방에 관한 사항','적재방법 및 전도 방지에 관한 사항','보호구 착용에 관한 사항']],
   26:['비계의 조립·해체 또는 변경작업',['비계의 조립순서 및 방법에 관한 사항','비계작업의 재료 취급 및 설치에 관한 사항','추락재해 방지에 관한 사항','보호구 착용에 관한 사항','비계상부 작업 시 최대 적재하중에 관한 사항']],
   29:['콘크리트 인공구조물(높이 2미터 이상)의 해체 또는 파괴작업',['콘크리트 해체기계의 점검에 관한 사항','파괴 시의 안전거리 및 대피 요령에 관한 사항','작업방법·순서 및 신호 방법 등에 관한 사항','해체·파괴 시의 작업안전기준 및 보호구에 관한 사항']],
   34:['밀폐공간에서의 작업',['산소농도 측정 및 작업환경에 관한 사항','사고 시의 응급처치 및 비상 시 구출에 관한 사항','보호구 착용 및 보호 장비 사용에 관한 사항','작업내용·안전작업방법 및 절차에 관한 사항','장비·설비 및 시설 등의 안전점검에 관한 사항']],
   35:['허가 또는 관리 대상 유해물질의 제조 또는 취급작업',['취급물질의 성질 및 상태에 관한 사항','유해물질이 인체에 미치는 영향','국소배기장치 및 안전설비에 관한 사항','안전작업방법 및 보호구 사용에 관한 사항']],
   38:['가연물이 있는 장소에서 하는 화재위험작업',['작업준비 및 작업절차에 관한 사항','작업장 내 위험물, 가연물의 사용·보관·설치 현황에 관한 사항','화재위험작업에 따른 인근 인화성 액체에 대한 방호조치에 관한 사항','화재위험작업으로 인한 불꽃, 불티 등의 흩날림 방지 조치에 관한 사항','인화성 액체의 증기가 남아 있지 않도록 환기 등의 조치에 관한 사항','화재감시자의 직무 및 피난 교육 등 비상조치에 관한 사항']]};
  /* 공종 → 특별교육 번호 (없는 공종 = 채용 시 교육만 1시간: 타일·주방) */
  const TRADE_SPECIAL={DEMO:[29],SCAF:[26],LGW:[38],LGC:[26],METAL:[38],GLASS:[14],PAINT:[35],ELEC:[17],MECH:[14,38],SIGN:[14],HOT:[38],LOAD:[23],STOCK:[23],FORK:[13],CHEM:[35],CONF:[34]};
  /** 고른 공종 → { tradeKey, tradeName, special: [번호], eduHours: 1|2 } */
  const eduOf=(k)=>{const t=RISK_TRADES.find(x=>x[0]===k),sp=t?(TRADE_SPECIAL[k]||[]).slice():[];return {tradeKey:t?k:'',tradeName:t?t[1]:'',special:sp,eduHours:sp.length?2:1};};
  /** 등록 화면 공종 목록 = 계획서에서 고른 공종 (없으면 전체) */
  const eduTrades=(plan)=>{const w=plan&&Array.isArray(plan.works)&&plan.works.length?plan.works:RISK_TRADES.map(t=>t[0]);return RISK_TRADES.filter(t=>w.includes(t[0])).map(t=>({key:t[0],name:t[1],special:(TRADE_SPECIAL[t[0]]||[]).map(n=>n+'. '+EDU_SPECIAL[n][0])}));};
  /** 계획서의 고른 위험요인 (예전 계획서는 고른 위험작업의 위험요인 전부) */
  const planRisks=(v)=>{v=v||{};const ok=new Set(RISK_ALL.map(r=>r.id));if(Array.isArray(v.risks))return RISK_ALL.filter(r=>v.risks.includes(r.id));const w=Array.isArray(v.works)?v.works:[];return RISK_ALL.filter(r=>w.includes(r.t)&&ok.has(r.id));};
  const PLAN_INDUSTRY_WORKS={'입고도우미':['LOAD','FORK'],'재고조사':['STOCK','LOAD'],'인테리어(마감)':['DEMO','SCAF','LGW','LGC','PAINT'],'사인':['SIGN','SCAF','ELEC'],'냉난방기':['MECH','ELEC','HOT','SCAF'],'집기':['LOAD','SCAF','METAL'],'본사 식당':['KITCHEN','CHEM']};
  const PLAN_SCEN=[
   ['FIRE','화재',[['상황전파','최초 발견자','"불이야"를 외쳐 주변에 알리고 119에 신고'],['초기소화','최초 발견자·주변 근로자','부상자를 안전한 곳으로 옮기고 소화기로 초기 소화'],['대피','현장대리인','작업 중지, 전기·가스 차단, 비상구로 전원 대피 후 인원 확인'],['현장인계','현장대리인','출동한 소방대에 현장 상황 보고, 진입로 확보'],['보고','현장대리인','다이소 담당자에게 즉시 보고, 재발방지 대책 수립']]],
   ['SHOCK','감전',[['상황전파','최초 발견자','"감전 사고!"를 외치고 지휘계통에 통보'],['전원차단','현장대리인','해당 선로 차단 (맨손으로 사고자 접촉 금지)'],['응급조치','안전담당자','호흡 확인, 119 신고, 필요 시 심폐소생술·AED'],['보고','현장대리인','다이소 담당자에게 즉시 보고']]],
   ['FALL','추락',[['상황전파','최초 발견자','주변에 알리고 119 신고'],['2차사고 방지','현장대리인','주변 작업 중지, 낙하물 위험 구역 통제'],['응급조치','안전담당자','사고자를 함부로 움직이지 않고 의식·호흡 확인, 출혈 지혈'],['보고','현장대리인','다이소 담당자에게 즉시 보고']]],
   ['SICK','응급환자 (부상·심정지)',[['상황전파','최초 발견자','119 신고, 주변에 도움 요청'],['응급조치','안전담당자','의식·호흡 확인, 심폐소생술·AED, 상처 지혈'],['인계','현장대리인','구급대 도착 시 상황 설명, 병원 이송 동행'],['보고','현장대리인','다이소 담당자에게 즉시 보고']]]];
  const PLAN_LAWS=[['산업안전보건법 제36조','위험성평가 실시','작업 시작 전 위험성평가 실시·기록 (본 계획서 Ⅱ-1)'],['산업안전보건법 제29조','근로자 안전보건교육','신규 채용 시·작업 전 교육 실시·기록 (본 계획서 Ⅱ-3)'],['산업안전보건법 제63조·제64조','도급인의 안전조치·협의체','협의체 참여, 순회점검 협조, 지적사항 즉시 시정'],['산업안전보건기준에 관한 규칙','위험작업 안전조치','고소·전기·화기 등 위험작업 시 안전조치·작업허가 (본 계획서 Ⅱ-4)']];
  function planPolicy_(company){return [company+'은(는) 안전보건경영이 모든 경영활동의 최우선 가치임을 표명하고, 안전보건 책임과 의무를 성실하게 실행하기 위해 다음과 같이 안전보건경영 방침을 선언한다.',
   '산업안전보건법 등 안전보건 관련 법규 및 제반 규정을 준수하여 쾌적하고 안전한 작업환경을 조성한다.','사업장 내 모든 유해·위험요인을 지속 개선하여 협력사를 포함한 모든 임직원과 이용고객의 안전과 건강을 지킨다.',
   '안전보건에 관한 목표를 설정하고 이를 달성하기 위한 안전보건경영시스템을 구축하여 산업재해를 예방한다.','비상상황에 적극적으로 대응할 수 있는 비상 대응체계를 구축·운영한다.','전 임직원의 자율적인 안전보건활동 참여를 보장하고 안전한 일터 조성으로 사회적 책임을 다한다.'];}
  /* v5.27 Code.gs에서 그대로: 합동안전보건 점검표 26항목 · 협의체 법정 협의사항 */
  const JOINT_ITEMS=[
   ['작업장','작업장 바닥은 견고하며 미끄럽거나 탁진 곳은 없는가?'],['작업장','작업자가 미끄러지거나 추락할 위험은 없는가?'],['작업장','작업장 바닥의 개구부(배수로, 하수도, 지하 핏트의 구멍 등)은 안전하게 덮었는가?'],
   ['작업장','상품은 저장과 적재가 안전하고 사용에 편리하게 되어 있는가?'],['작업장','위험구역에는 위험,경고 표시 및 접근방지 대책이 마련되어 있는가?'],['작업장','작업장의 통로는 충분히 확보되어 있으며, 통로나 계단에 작업자가 충돌할 위험이 있는 설비나 자재 등이 놓여 있지 않은가?'],
   ['건강','건강진단 및 작업환경측정은 주기적으로 실시되고 있는가?'],['건강','질병유소견자에 대한 작업전환 등 사후관리는 적절한가?'],
   ['작업','작업장의 조명은 충분한가?'],['작업','작업실의 실내온도 및 통풍은 알맞게 유지되고 있는가?'],
   ['유해','유해작업에 대한 국소배기나 보호구착용은 양호한가?'],['유해','인화성,가연성물질의 저장, 격리 등의 관리는 양호한가?'],['유해','물질안전보건자료의 관리상태는 양호한가?'],
   ['기계','위험기계기구의 방호장치는 안전하게 사용되고 있는가?'],['기계','벨트 등 위험점이 노출된 곳은 없는가?'],['기계','담당자 외의 근로자가 임의로 운전하고 있지는 않은가?'],['기계','자격이 필요한 기계기구의 무자격 운전자는 없는가?'],['기계','법정 검사는 주기적으로 실시되고 있는가?'],['기계','수리 등 비정상작업시 안전조치는 실시하고 있는가?'],
   ['전기','전기설비의 절연. 접지상태 및 이의 관리상태는 양호한가?'],['전기','젖은 손으로 전기설비를 취급하고 있지는 않은가?'],['전기','정전 및 활선작업시 안전조치 및 보호구 착용상태는 양호한가?'],
   ['기타','안전수칙을 준수하며, 해당보호구를 착용하고 작업하는가?'],['기타','안전교육은 정기적으로 실시되고 있는가?'],['기타','하역. 운반작업시 적절한 안전조치를 실시하고 있는가?'],['기타','기타 근로자에 유해위험을 미칠 수 있는 것이 있는가?']];
  const JOINT_MARKS=['OK','BAD','NA'];
  const COUNCIL_AGENDA=['작업의 시작 시간','작업 또는 작업장 간의 연락방법','재해발생 위험이 있는 경우 대피방법','작업장에서의 법 제36조에 따른 위험성평가의 실시에 관한 사항','사업주와 수급인 또는 수급인 상호 간의 연락 방법 및 작업공정의 조정'];
  /* v5.27 Code.gs에서 그대로: 종료 평가 12항목 · 배점 · 등급 계산 */
  const EVAL_ITEMS=[
   ['1','A. 안전보건관리체제','일반원칙 (안전보건방침)','규정 · 계획서 Ⅰ 안전보건경영 방침'],
   ['2','A. 안전보건관리체제','계획수립 (목표·성과지표·법규)','계획서 Ⅰ 안전목표 · 성과지표 · 관련법규'],
   ['3','A. 안전보건관리체제','역할 및 책임 (조직·연락체계)','계획서 Ⅰ 조직 및 비상연락체계'],
   ['4','B. 실행수준','위험성평가','계획서 Ⅱ-1 위험성평가 계획'],
   ['5','B. 실행수준','안전점검 및 모니터링','계획서 Ⅱ-2 안전점검 및 모니터링 계획'],
   ['6','B. 실행수준','이행확인 (개선조치)','계획서 Ⅴ 이행확인'],
   ['7','B. 실행수준','교육 및 기록','계획서 Ⅱ-3 안전보건교육 계획'],
   ['8','B. 실행수준','안전작업허가','계획서 Ⅱ-4 안전작업 허가'],
   ['9','C. 운영관리','신호 및 연락체계','계획서 Ⅲ-1 신호 및 연락체계'],
   ['10','C. 운영관리','위험물질 및 설비','계획서 Ⅲ-2 위험물질 및 설비'],
   ['11','C. 운영관리','비상대책','계획서 Ⅲ-3 비상대책(시나리오)'],
   ['12','D. 재해발생 수준','최근 3년 산업재해 현황','계획서 Ⅳ 증빙자료']
  ];
  const EVAL_LEVELS={G:'우수',N:'보통',P:'미흡'};
  const EVAL_POINTS={1:[5,3,1],2:[10,5,1],3:[5,3,1],4:[5,3,1],5:[10,5,1],6:[10,5,1],7:[5,3,1],8:[10,5,1],9:[5,3,1],10:[10,5,1],11:[5,3,1],12:[20,10,1]};
  const EVAL_SECTIONS=[['A',[1,2,3],20],['B',[4,5,6,7,8],40],['C',[9,10,11],20],['D',[12],20]];
  const EVAL_RULE={rateGood:0.9,rateNormal:0.6,fixDaysGood:3};
  function evalScore_(items){let total=0;const sec={};EVAL_SECTIONS.forEach(([k,nos])=>{sec[k]=nos.reduce((s,n)=>s+(items[n]?EVAL_POINTS[n]['GNP'.indexOf(items[n].lv)]||0:0),0);total+=sec[k];});
    let grade=total>=90?'S':total>=80?'A':total>=70?'B':total>=60?'C':'D';
    // 등급제한: A·B·C 분야 중 하나라도 배점의 50% 미만이면 D
    const limited=EVAL_SECTIONS.slice(0,3).some(([k,,max])=>sec[k]<max/2);if(limited)grade='D';return {total,grade,sec,limited};}
  /* @@v527-end */

  /* ---------- 준비 ---------- */
  const ok = !!(window.firebase && window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId);
  if (!ok) { window.FB = { ok: false, version: VERSION }; return; }
  firebase.initializeApp(window.FIREBASE_CONFIG);
  const auth = firebase.auth(), db = firebase.firestore();
  let USER = null;
  const ready = new Promise((res) => { auth.onAuthStateChanged((u) => { USER = u; res(u); }); });

  const now = () => new Date().toISOString();
  const tidy = (v, max = 600) => String(v ?? '').trim().slice(0, max);
  const lower = (v) => String(v || '').trim().toLowerCase();
  const fail = (m) => { throw Error(m); };
  /* F1.7f 접속 구분이 비어 있으면(예전에 작업자 QR로 로그인한 기기) 로그인 화면에서 마지막으로 고른 구분을 씀
   *  → 직원 명단에 있는 사람이 [협력업체]로 쓰다가 작업자 QR을 한 번 찍은 뒤 업체 업무가 직원 기준으로 처리되던 문제 */
  const getMode = () => { try { const m = localStorage.getItem('fbMode') || localStorage.getItem('loginMode') || ''; return ['VENDOR', 'STAFF'].includes(m) ? m : ''; } catch (e) { return ''; } };
  async function me() {
    await ready;
    if (!USER) fail('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    return { uid: USER.uid, email: lower(USER.email), mode: getMode() };
  }
  const isMaster = (a) => a.mode !== 'VENDOR' && MASTER_EMAILS.includes(a.email);
  const isInternalEmail = (e) => CFG.APPROVER_DOMAINS.some((d) => lower(e).endsWith('@' + d));
  /** Firebase 오류를 알아듣기 쉬운 말로 */
  function nice(e) {
    const c = e && e.code || '';
    if (c === 'permission-denied') return Error('권한이 없습니다. (보안 규칙에서 막힘)');
    if (c === 'unavailable') return Error('인터넷 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.');
    return e instanceof Error ? e : Error(String(e));
  }
  const audit = (a, companyId, action, detail) => db.collection('AUDIT').add({ time: now(), email: a.email, uid: a.uid, companyId: companyId || '', action, detail: tidy(detail, 2000) }).catch(() => {});

  /* ---------- 직원 · 권한 ---------- */
  async function seedStaffIfEmpty(a) {
    if (!isMaster(a)) return;
    const s = await db.collection('STAFF').limit(1).get();
    if (!s.empty) return;
    const b = db.batch();
    STAFF_SEED.forEach(([name, ce, le]) => b.set(db.collection('STAFF').doc(le), { name, dept: '안전보건팀', role: 'SAFETY', companyEmail: ce, loginEmail: le, active: 'Y', createdBy: 'SYSTEM', createdAt: now() }));
    await b.commit();
  }
  /** 직원 정보 (협력업체로 접속하면 null) — 기존 staffOf_와 같음 */
  async function staffOf(a, memo) {
    if (a.mode === 'VENDOR') return null;
    if (memo && 'staff' in memo) return memo.staff;
    let s = null;
    try { const d = await db.collection('STAFF').doc(a.email).get(); if (d.exists) s = d.data(); }
    catch (e) { if (e.code !== 'permission-denied') throw e; }
    let r;
    if (isMaster(a)) { await seedStaffIfEmpty(a); r = { ...(s || { name: '마스터', dept: '시스템 관리', companyEmail: '', loginEmail: a.email, active: 'Y' }), role: 'SAFETY', master: true }; }
    else r = s && String(s.active).trim().toUpperCase() !== 'N' ? s : null;
    if (memo) memo.staff = r;
    return r;
  }
  const isSafety = async (a, memo) => (await staffOf(a, memo))?.role === 'SAFETY';

  /* ---------- 중계 Apps Script (파일 · 메일 · 승인처럼 업체가 직접 쓰면 안 되는 일) ---------- */
  const relayUrl = () => String(window.APP_CONFIG && window.APP_CONFIG.APPS_SCRIPT_URL || '').trim();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /** 중계 서버에 요청. retry=true면 연결 실패 시 2번까지 다시 보냄 (조회·내려받기만) */
  async function relay(op, body, retry, waitMs) {
    const url = relayUrl();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) fail('config.js에 중계 Apps Script 주소(/exec)가 아직 등록되지 않았습니다.');
    await ready; if (!USER) fail('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    const idToken = await USER.getIdToken();
    for (let i = 0; ; i++) {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null, t = ctl && setTimeout(() => ctl.abort(), waitMs || 90000);
      let o;
      try {
        // text/plain으로 보내야 Apps Script가 추가 확인 요청(CORS) 없이 받음
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, op, idToken, mode: getMode() }), signal: ctl ? ctl.signal : undefined, redirect: 'follow' });
        o = await r.json().catch(() => null);
        if (!o) throw Error('중계 서버 응답을 읽을 수 없습니다. (배포 설정의 액세스가 "모든 사용자"인지 확인)');
      } catch (e) {
        if (retry && i < 2) { await sleep(800 * (i + 1)); continue; }
        if (e && e.name === 'AbortError') fail('중계 서버 응답이 늦습니다. 화면을 새로 고쳐 처리됐는지 확인해 주세요.');
        if (e instanceof TypeError) fail('중계 서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 화면을 새로 고쳐 처리됐는지 확인해 주세요.');
        throw e;
      } finally { if (t) clearTimeout(t); }
      if (!o.ok) fail(o.error || '중계 서버 오류');
      return o.data;
    }
  }

  /* ---------- 업체 (COMPANIES: 업체는 읽기만 · 쓰기는 중계 서버만) ---------- */
  const byNewest = (x, y) => String(y.createdAt || '').localeCompare(String(x.createdAt || ''));
  const docs = (s) => s.docs.map((d) => ({ ...d.data(), id: d.data().id || d.id }));
  /** 내가 신청한 업체 전부 (최신순) */
  async function myCompanies(a) { return docs(await db.collection('COMPANIES').where('uid', '==', a.uid).get()).sort(byNewest); }
  /** 지금 쓰는 업체 (반려 제외) — 기존 mine_와 같음 */
  async function myCompany(a) {
    if (a.mode === 'STAFF') return null;  // 담당자로 접속하면 업체 화면 사용 안 함
    const b = (await myCompanies(a)).find((x) => x.status !== 'REJECTED') || null;
    if (b && b.status === 'OTP_PENDING') b.status = 'VERIFIED';  // 예전 인증번호 단계 → 바로 작성 가능
    return b;
  }
  /* ---------- 계약 전 서류 공통 (기존 Code.gs와 같은 판단) ---------- */
  const kst = (iso) => { try { return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); } catch (e) { return ''; } };  // yyyy-mm-dd (한국 시간)
  const today = () => kst(new Date().toISOString());
  const parse = (j, d) => { try { return JSON.parse(j || ''); } catch (e) { return d; } };
  const docTypes = () => DOC_TYPE_SEED.map(([code, stage, order, name, cycle, owner, kind, required]) => ({ code, stage, order, name, cycle, owner, kind, required }))
    .sort((x, y) => (DOC_STAGE_ORDER[x.stage] - DOC_STAGE_ORDER[y.stage]) || (x.order - y.order));
  const vendorDocTypes = (stage) => docTypes().filter((t) => t.stage === stage && ['VENDOR', 'JOINT'].includes(t.owner) && t.kind !== 'EVALUATION');
  const canExec = (b) => !!b && b.status === 'VERIFIED' && (b.submissionStatus === 'APPROVED' || !!b.renewAt);
  function canUploadDoc(b, code) {
    if (!b || b.status !== 'VERIFIED') return false;
    const s = b.submissionStatus || 'DRAFT'; if (s === 'DRAFT') return true;
    return s === 'CORRECTION' && parse(b.correctionKeys, []).includes('4:doc' + code);
  }
  const staleForm = (b, at) => !!(b && b.renewAt && b.renewMode === 'NEW' && String(at || '') < String(b.renewAt));
  const infoFresh = (b) => !(b && b.renewAt && b.renewMode === 'NEW') || String(b.infoAt || '') >= String(b.renewAt);
  /** 계약 전 평가 유효기간 1년 {from,until,expired,days} */
  function contractValid(b) {
    if (!b || b.status !== 'VERIFIED') return null;
    const at = b.approvedAt || (b.submissionStatus === 'APPROVED' || b.renewAt ? b.submittedAt : ''); if (!at) return null;
    const from = kst(at); if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
    const d = new Date(from + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + 1); d.setUTCDate(d.getUTCDate() - 1);
    const until = d.toISOString().slice(0, 10), t = today();
    return { from, until, expired: t > until, days: Math.round((new Date(until + 'T00:00:00Z') - new Date(t + 'T00:00:00Z')) / 86400000) };
  }
  const docUploads = (subs, code) => subs.filter((x) => x.docType === code).sort((x, y) => Number(y.version) - Number(x.version)).map((x) => ({ id: x.documentId, name: x.name, version: Number(x.version), uploadedAt: x.uploadedAt, status: x.status }));
  function activeTemplates(list) { const m = {}; list.filter((x) => x.active === 'Y').forEach((x) => { if (!m[x.docType] || Number(x.version) > Number(m[x.docType].version)) m[x.docType] = x; }); return m; }
  /** 업체 화면용: 계약 단계 제출서류 + 이후 단계 참고 양식 + 전체 표 */
  function vendorDocBoard(b, tpl, subs) {
    const own = (t) => DOC_OWNER[t.owner] || t.owner;
    const contract = vendorDocTypes('CONTRACT').map((t) => ({ code: t.code, name: t.name, cycle: t.cycle, ownerLabel: own(t), required: t.required === 'Y',
      template: tpl[t.code] ? { name: tpl[t.code].name, version: Number(tpl[t.code].version) } : null, uploads: docUploads(subs, t.code), canUpload: canUploadDoc(b, t.code) }));
    const later = docTypes().filter((t) => t.stage !== 'CONTRACT' && tpl[t.code]).map((t) => ({ code: t.code, name: t.name, stageLabel: DOC_STAGE[t.stage], cycle: t.cycle, ownerLabel: own(t), template: { name: tpl[t.code].name, version: Number(tpl[t.code].version) } }));
    const rows = docTypes().map((t) => {
      const vendorDoc = ['VENDOR', 'JOINT'].includes(t.owner) && t.kind !== 'EVALUATION';
      return { code: t.code, stage: t.stage, stageLabel: DOC_STAGE[t.stage], name: t.name, cycle: t.cycle, owner: t.owner, ownerLabel: own(t), kind: t.kind, required: t.required === 'Y', vendorDoc,
        template: tpl[t.code] ? { version: Number(tpl[t.code].version) } : null, uploads: vendorDoc ? docUploads(subs, t.code) : [],
        canUpload: vendorDoc && ((t.stage === 'CONTRACT' && canUploadDoc(b, t.code)) || (t.stage === 'EXECUTION' && canExec(b))) };
    });
    return { contract, later, rows };
  }
  const reviewDocBoard = (subs) => vendorDocTypes('CONTRACT').map((t) => ({ code: t.code, name: t.name, required: t.required === 'Y', uploads: docUploads(subs, t.code) }));
  function planDefaults(b, p) {
    const y = Number(today().slice(0, 4)), w = PLAN_INDUSTRY_WORKS[b.industry] || [];
    return { policy: planPolicy_(b.company), goal: '무재해 달성 (산업재해 0건)',
      kpis: [{ name: '순회점검 실시율 (2일 1회)', target: '100%' }, { name: '작업 전 TBM·안전교육 실시율', target: '100%' }, { name: '지적사항 즉시 시정률', target: '100%' }],
      org: [{ role: '안전관리책임자 (현장대리인)', name: p.siteManager || '', phone: p.siteManagerPhone || '' }],  // F1.8k 협력업체 관리자 = 현장대리인 1명
      agent: { birth: '', addr: '', licKind: '', licType: '', licNo: '' },  // F1.8k 현장대리인계 (공사마다 자동)
      /* F1.8r 위험성평가: 업종 기본 공종의 위험요인을 전부 체크해 두고 업체가 해당 없는 것만 뺌 */
      works: w.length ? w : ['SCAF', 'LOAD'], risks: RISK_ALL.filter((r) => (w.length ? w : ['SCAF', 'LOAD']).includes(r.t)).map((r) => r.id),
      scen: ['FIRE'].concat(w.includes('ELEC') ? ['SHOCK'] : []).concat((w.length ? w : ['SCAF']).some((k) => ['SCAF', 'LGC', 'GLASS', 'SIGN', 'STOCK'].includes(k)) ? ['FALL'] : []),
      hospital: '', years: [y - 3, y - 2, y - 1], accidents: ['', '', ''], evidence: [], practice: '',
      drill: { route: '', assembly: '', equip: '', manager: p.siteManager || '', items: ['NEW', 'EVAC', 'FIRE'] } };  // F1.8c 비상대피훈련 계획 (중계 서버 planDefaults_와 같게)
  }
  /** 업체 화면용: 앱 작성 서류 (규정 C01 · 계획서 C02) */
  function contractFormsView(b, forms, files, p1) {
    const fresh = (code) => { const f = forms.find((x) => x.code === code); return f && !staleForm(b, f.updatedAt) ? { f, d: parse(f.json, null) } : { f, d: null }; };
    const r = fresh('C01'), p = fresh('C02'), D = planDefaults(b, p1); let d = p.d;
    // 해가 바뀐 뒤 다시 작성하면 최근 3년이 달라짐 → 같은 연도 값만 옮김
    if (d && Array.isArray(d.years) && JSON.stringify(d.years.map(Number)) !== JSON.stringify(D.years)) { const old = d.years.map(Number), ac = d.accidents || []; d.accidents = D.years.map((y) => { const i = old.indexOf(y); return i >= 0 ? String(ac[i] ?? '') : ''; }); d.years = D.years; }
    const ev = ((d && d.evidence) || []).map((id) => { const x = files.find((y) => y.id === id); return x ? { id, name: x.name } : null; }).filter(Boolean);
    return { today: today(), hq: HQ_NAME, hqRep: b.approverName || '', rule: { title: RULE_TITLE, text: RULE_TEXT }, C01: r.d ? { data: r.d, savedAt: r.f.updatedAt } : null,
      plan: { works: PLAN_WORKS, trades: RISK_TRADES.map((t) => [t[0], t[1], t[4], t[6]]), after: RISK_AFTER, scen: PLAN_SCEN.map((s) => [s[0], s[1]]), laws: PLAN_LAWS, defaults: D, C02: d ? { data: Object.assign(d, { evidenceFiles: ev }), savedAt: p.f.updatedAt } : null } };
  }
  /** 화면에 보여 줄 업체 정보 (기존 publicCompany_와 같은 항목) */
  function publicCompany(b) {
    if (!b) return null;
    const o = {};
    ['id', 'email', 'company', 'regNo', 'representative', 'address', 'industry', 'contact', 'phone', 'contactEmail', 'status', 'createdAt', 'duplicate', 'reason', 'submissionStatus', 'submittedAt', 'correctionKeys', 'approverEmail', 'renewAt', 'renewMode', 'infoAt'].forEach((k) => o[k] = b[k] ?? '');
    o.certMissing = !b.certFileId; o.valid = contractValid(b); o.infoFresh = infoFresh(b);
    return o;
  }
  /** 직원이 볼 수 있는 업체: 안전보건팀 = 전체 / 그 외 = 본인(로그인 계정·회사메일)이 승인 담당자인 업체 */
  async function visibleCompanies(a, st, status) {
    const C = db.collection('COMPANIES');
    if (st && st.role === 'SAFETY') return docs(await (status ? C.where('status', '==', status) : C).get());
    const mails = [...new Set([a.email, lower(st && st.companyEmail)].filter(Boolean))], seen = new Map();
    // 보안 규칙이 확인할 수 있게 메일 주소마다 따로 조회
    const snaps = await Promise.all(mails.map((m) => { let q = C.where('approverEmail', '==', m); if (status) q = q.where('status', '==', status); return q.get(); }));
    snaps.forEach((s) => docs(s).forEach((x) => seen.set(x.id, x)));
    return [...seen.values()];
  }
  /** 알림 숫자: 사업자 승인 대기 · 서류 검토 대기 · (안전보건팀) 안 읽은 참조 알림. 공사 관련 숫자는 F1.3부터 */
  async function badges(a, memo) {
    const o = { admin: 0, review: 0, jobs: 0, newVendors: [], pendingAttend: 0, notices: 0 }, st = await staffOf(a, memo);
    if (!st && !isInternalEmail(a.email)) return o;
    const cs = await visibleCompanies(a, st);
    o.admin = cs.filter((x) => x.status === 'PENDING').length;
    if (st) o.review = cs.filter((x) => x.status === 'VERIFIED' && x.submissionStatus === 'SUBMITTED').length;
    if (st && st.role === 'SAFETY') o.notices = docs(await db.collection('NOTICES').get()).filter((n) => !(n.readBy || []).includes(a.email)).length;
    if (st) {
      // 계약 전 검토가 끝났는데 아직 어느 공사에도 배정 안 된 업체 + 종료 예정·종료일 지난 공사
      const [jvs, ver, jobs] = await Promise.all([db.collection('JOB_VENDORS').get().then(docs), db.collection('COMPANIES').where('status', '==', 'VERIFIED').get().then(docs), db.collection('JOBS').get().then(docs)]);
      const assigned = new Set(jvs.map((x) => x.companyId));
      o.newVendors = ver.filter((x) => x.submissionStatus === 'APPROVED' && !assigned.has(x.id)).map((x) => ({ id: x.id, company: x.company, industry: x.industry }));
      o.jobEnd = jobs.filter((j) => (st.role === 'SAFETY' || lower(j.hostEmail) === a.email) && ['SOON', 'OVER'].includes(jobEndInfo(j).state)).length;
      const mine = jobs.filter((j) => st.role === 'SAFETY' || lower(j.hostEmail) === a.email).map((j) => j.id);
      o.permits = mine.length ? (await byJobs('PERMITS', mine)).filter((p) => p.status === 'ISSUED').length : 0;  // 승인 대기 허가서
      o.pendingAttend = mine.length ? (await byJobs('ATTEND', mine)).filter((x) => x.status === 'PENDING').length : 0;  // 미팅 참석 확인 대기
      o.insp = mine.length ? (await byJobs('INSPECTIONS', mine)).filter((x) => !x.checkedAt).length : 0;  // 도급인 확인 대기 순회점검
      o.evalDraft = mine.length ? (await byJobs('JOB_EVALS', mine)).filter((e) => e.status === 'DRAFT').length : 0;  // 작성 중인 종료 평가
      o.jobs = o.newVendors.length + o.pendingAttend + o.permits + o.insp + o.jobEnd + o.evalDraft;
    }
    return o;
  }

  /* ---------- 기능 (기존 Code.gs 이름 그대로) ---------- */
  const API = {};
  /** 첫 화면 정보 (기존 portalData와 같은 모양) */
  /** 승인된 업체의 작성 자료 한꺼번에 (내 것만 읽도록 uid로 조회) */
  async function vendorBundle(a, b) {
    const mine = (col) => db.collection(col).where('uid', '==', a.uid).get().then(docs).then((l) => l.filter((x) => x.companyId === b.id));
    const [profiles, files, subs, forms, tpls, jvs] = await Promise.all([mine('PROFILES'), mine('DOCUMENTS'), mine('DOC_SUBMISSIONS'), mine('CONTRACT_FORMS'), db.collection('TEMPLATES').where('active', '==', 'Y').get().then(docs),
      db.collection('JOB_VENDORS').where('vendorUid', '==', a.uid).get().then(docs).then((l) => l.filter((x) => x.companyId === b.id))]);
    // 진행 중(종료 전) 공사 수 → 0이면 업체 메뉴에서 공사 업무를 숨김
    const js = await Promise.all(jvs.map((v) => db.collection('JOBS').doc(v.jobId).get().then((s) => (s.exists ? s.data() : null)).catch(() => null)));
    return { profiles, files, subs, forms, tpl: activeTemplates(tpls), openJobs: js.filter((j) => j && j.status !== 'ENDED').length };
  }
  API.portalData = async (a) => {
    const memo = {}, st = await staffOf(a, memo), b = await myCompany(a), verified = !!b && b.status === 'VERIFIED';
    const [isApprover, V, bd] = await Promise.all([
      isInternalEmail(a.email) ? db.collection('COMPANIES').where('approverEmail', '==', a.email).limit(1).get().then((s) => !s.empty) : false,
      verified ? vendorBundle(a, b) : null, badges(a, memo)]);
    let steps = [], documents = [], docBoard = null, forms = null;
    if (V) {
      steps = V.profiles.map((x) => ({ step: Number(x.step), data: staleForm(b, x.updatedAt) ? {} : (x.data || {}) }));
      // F1.8n 사업장 정보(현장대리인 · 연락처 · 주소)는 가입 때 받은 값 → 비어 있으면 한 번 채워 둠 (예전에 가입한 업체 포함)
      if (b.submissionStatus === 'DRAFT' && (!(b.renewAt && b.renewMode === 'NEW') || String(b.infoAt || '') >= String(b.renewAt))) {
        const s1 = steps.find((x) => x.step === 1), cur = (s1 && s1.data) || {}, fill = { siteManager: b.contact, siteManagerPhone: b.phone, siteAddress: b.address }, next = { ...cur };
        let ch = false; Object.keys(fill).forEach((k) => { if (!String(cur[k] || '').trim() && fill[k]) { next[k] = tidy(fill[k], 4000); ch = true; } });
        if (ch) { try { await db.collection('PROFILES').doc(b.id + '_1').set({ companyId: b.id, uid: a.uid, step: 1, data: next, updatedAt: now(), updatedBy: a.email }); if (s1) s1.data = next; else steps.push({ step: 1, data: next }); } catch (e) { console.warn('사업장 정보 자동 채움 실패', e && e.message); } }
      }
      const linked = new Set(V.subs.map((x) => x.documentId));
      documents = V.files.filter((x) => !linked.has(x.id)).map((x) => ({ id: x.id, name: x.name, mime: x.mime }));
      docBoard = vendorDocBoard(b, V.tpl, V.subs);
      forms = contractFormsView(b, V.forms, V.files, (steps.find((x) => x.step === 1) || {}).data || {});
      // F1.8k 규정 "갑" 다이소 현장대리인 = 위임받은 도급인 책임자 (곽동민)
      const P = await principal().catch(() => null); if (P && P.delegate.name) forms.hqRep = P.delegate.name;
    }
    return {
      email: a.email, isApprover, correctionNote: b && b.submissionStatus === 'CORRECTION' ? b.correctionNote || '' : '', openJobs: V ? V.openJobs : null,
      staff: st ? { name: st.name, role: st.role, roleLabel: (st.master ? '마스터 · ' : '') + (STAFF_ROLES[st.role] || st.role), master: !!st.master } : null,
      isMaster: isMaster(a), testSkipFiles: CFG.TEST_SKIP_FILES,
      company: publicCompany(b),
      role: st ? st.role : 'VENDOR', industries: CFG.INDUSTRIES, fields: FIELDS, stepNames: STEP_NAMES, industryFields: (b && INDUSTRY_FIELDS[b.industry]) || [],
      steps, documents, docBoard, forms, appVersion: VERSION, mode: a.mode,
      badges: bd, loginUrl: location.origin + location.pathname,
    };
  };
  /** [업체] 승인 대기 화면의 자동 확인용 (반려 포함 가장 최근 신청) */
  API.myStatus = async (a) => {
    const b = (await myCompanies(a))[0];
    return b ? { status: b.status === 'OTP_PENDING' ? 'VERIFIED' : b.status, reason: b.reason || '', submissionStatus: b.submissionStatus || 'DRAFT' } : null;
  };
  API.myBadges = async (a) => badges(a);

  /** [업체] 사업자 등록 신청 → 중계 서버가 기록·승인요청 메일 */
  API.registerBusiness = async (a, d, cert) => {
    if (a.mode === 'STAFF') fail('다이소 담당자로 접속했습니다. 업체 신청은 로그인 화면에서 [협력업체]로 다시 로그인해 주세요.');
    await relay('register', { d: d || {}, cert: cert && cert.data ? cert : null });
    return API.portalData(a);
  };
  /** [직원] 사업자 등록 신청 목록 */
  API.applications = async (a) => {
    const st = await staffOf(a);
    if (!st && !isInternalEmail(a.email)) fail('승인 담당자 권한이 없습니다.');
    return (await visibleCompanies(a, st)).sort(byNewest).map(publicCompany);
  };
  /** [직원] 업체 현황 */
  API.vendorList = async (a) => {
    const st = await staffOf(a);
    if (!st && !isInternalEmail(a.email)) fail('아성다이소 직원 계정만 볼 수 있습니다.');
    const list = (await visibleCompanies(a, st)).sort(byNewest);
    // 승인된 업체: 제출 서류 · 계획서 증빙 · 계약 전 평가 결과 (직원 명단에 없는 승인 담당자는 보안 규칙상 못 봄 → 빈칸)
    const detail = async (b) => {
      if (b.status !== 'VERIFIED' || !st) return { docs: [], evidence: [], contractEval: null };
      const by = (col) => db.collection(col).where('companyId', '==', b.id).get().then(docs);
      try {
        const [subs, forms, evs] = await Promise.all([by('DOC_SUBMISSIONS'), by('CONTRACT_FORMS'), by('EVALUATIONS')]);
        const ids = (parse((forms.find((x) => x.code === 'C02') || {}).json, {}) || {}).evidence || [];
        const files = ids.length ? await by('DOCUMENTS') : [];
        const e = evs.filter((x) => x.result === 'APPROVED').sort((p, q) => String(p.evaluatedAt).localeCompare(String(q.evaluatedAt))).pop();
        return { docs: reviewDocBoard(subs), evidence: ids.map((id) => { const x = files.find((y) => y.id === id); return x ? { id, name: x.name } : null; }).filter(Boolean),
          contractEval: e ? { good: Number(e.good) || 0, normal: Number(e.normal) || 0, poor: Number(e.poor) || 0, at: e.evaluatedAt } : null };
      } catch (e) { if (e.code !== 'permission-denied') throw e; return { docs: [], evidence: [], contractEval: null }; }
    };
    const [more, jvs, evs, jobs] = await Promise.all([Promise.all(list.map(detail)), st ? db.collection('JOB_VENDORS').get().then(docs) : [],
      st ? db.collection('JOB_EVALS').where('status', '==', 'DONE').get().then(docs) : [], st ? db.collection('JOBS').get().then(docs) : []]);
    const le = lastEvals(evs, jobs);
    return { list: list.map((b, i) => ({ ...publicCompany(b), ...more[i], jobs: jvs.filter((x) => x.companyId === b.id).length, lastEval: le[b.id] || null })) };
  };
  /** [직원] 승인·반려 → 중계 서버가 처리하고 업체에 메일 */
  API.decideBusiness = async (a, id, decision, reason, ret) => {
    if (!['APPROVE', 'REJECT'].includes(decision)) fail('승인 또는 반려를 선택해 주세요.');
    if (decision === 'REJECT' && !tidy(reason)) fail('반려 사유를 입력해 주세요.');
    await relay('decide', { companyId: String(id || ''), decision, reason: tidy(reason, 500) });
    return ret === 'vendors' ? API.vendorList(a) : API.applications(a);
  };
  /** [직원] 신청 첨부파일 목록 (직원 명단에 있으면 바로, 아니면 중계 서버가 권한 확인) */
  API.getRegistrationDocs = async (a, id) => {
    if (await staffOf(a)) return docs(await db.collection('DOCUMENTS').where('companyId', '==', String(id || '')).get()).map((x) => ({ id: x.id, name: x.name }));
    return relay('regDocs', { companyId: String(id || '') }, true);
  };
  /** 파일 내려받기 (권한은 중계 서버가 다시 확인) */
  API.getInternalFile = async (a, companyId, docId) => relay('file', { companyId: String(companyId || ''), docId: String(docId || '') }, true);
  API.getMyFile = async (a, docId) => relay('file', { docId: String(docId || ''), raw: true }, true);  // F1.8j 드라이브 화면 대신 내용 (화면 안에서 보기)
  /** F1.8j ZIP 바로 내려받기 (8MB씩) */
  API.jobEvalFilePart = async (a, id, fid, i) => { await staffOnly(a); return relay('evalZipPart', { evalId: tidy(id, 40), fid: tidy(fid, 80), i: Number(i) || 0 }, true, 180000); };
  /** F1.8g 이수증 보기: 파일 내용만 받아 화면 안 창에 띄움 (구글 드라이브 화면 안 열림) */
  API.viewCert = async (a, docId) => relay('certView', { docId: tidy(docId, 60) }, true);
  /* ---------- F1.8k 도급인 책임자 (SETTINGS/principal · 중계 서버 PRINCIPAL_DEF_와 같은 기본값) ---------- */
  const PRINCIPAL_DEF = { ceo: { name: '김기호', rank: '부사장', title: '안전보건총괄책임자', org: '대표이사' },
    delegate: { name: '곽동민', rank: '부장', title: '인테리어부장', org: '영업본부 매장지원부문 인테리어부' }, manager: { name: '', rank: '', org: '' } };
  let PRINC = null;
  async function principal(force) {
    if (PRINC && !force) return PRINC;
    let s = {}; try { const d = await db.collection('SETTINGS').doc('principal').get(); if (d.exists) s = d.data(); } catch (e) {}
    const o = {}; ['ceo', 'delegate', 'manager'].forEach((k) => { o[k] = Object.assign({}, PRINCIPAL_DEF[k]); Object.keys(s[k] || {}).forEach((f) => { if (s[k][f]) o[k][f] = String(s[k][f]); }); });
    if (!o.manager.name) { try { const m = await db.collection('STAFF').doc(MASTER_EMAILS[0]).get(); if (m.exists) o.manager.name = m.data().name || ''; } catch (e) {} }
    PRINC = o; return o;
  }
  API.principalGet = async (a) => { await staffOnly(a); return { ...(await principal(true)), def: PRINCIPAL_DEF }; };
  API.principalSave = async (a, d) => {
    if (!isMaster(a)) fail('마스터 계정만 고칠 수 있습니다.');
    const o = {}; ['ceo', 'delegate', 'manager'].forEach((k) => { o[k] = {}; ['name', 'rank', 'title', 'org'].forEach((f) => { o[k][f] = tidy(((d || {})[k] || {})[f], 60); }); });
    if (!o.ceo.name || !o.delegate.name) fail('총괄책임자와 위임받는 책임자 이름은 꼭 적어 주세요.');
    await db.collection('SETTINGS').doc('principal').set({ ...o, updatedAt: now(), updatedBy: a.email }); audit(a, '', 'PRINCIPAL_SAVE', o.ceo.name + ' → ' + o.delegate.name);
    return API.principalGet(a);
  };
  /** 위임장 · 현장대리인계 보기 (중계 서버가 양식을 만들어 줌) */
  API.jobPaper = async (a, jobId, kind, companyId) => relay('jobPaper', { jobId: tidy(jobId, 40), kind: tidy(kind, 10), companyId: tidy(companyId, 40) }, true);
  /** F1.8i [마스터] 데이터 현황 · 지우기 (중계 서버가 마스터인지 다시 확인) */
  const masterGate = (a) => { if (!isMaster(a)) fail('마스터 계정만 사용할 수 있습니다.'); };
  API.adminStats = async (a) => { masterGate(a); return relay('adminStats', {}, true, 120000); };
  API.adminPreview = async (a, d) => { masterGate(a); return relay('adminPreview', { d: d || {} }, false, 120000); };
  API.adminDelete = async (a, token) => { masterGate(a); return relay('adminDelete', { token: String(token || '') }, false, 150000); };

  /* ---------- F1.2 계약 전 서류 ---------- */
  /** [업체] 사업장 정보 저장 (자동저장) — Firestore에 바로 씀. 상태·보완 항목은 보안 규칙이 다시 확인 */
  API.saveStep = async (a, step, data) => {
    const b = await myCompany(a), n = Number(step);
    if (!b || b.status !== 'VERIFIED' || !FIELDS[n]) fail('작성 권한이 없습니다.');
    const s = b.submissionStatus || 'DRAFT';
    if (!['DRAFT', 'CORRECTION'].includes(s)) fail('제출 완료된 자료는 수정할 수 없습니다.');
    if (s === 'CORRECTION') { const keys = parse(b.correctionKeys, []); if (Object.keys(data || {}).some((k) => !keys.includes(n + ':' + k))) fail('보완 요청받은 항목만 변경할 수 있습니다.'); }
    const allowed = FIELDS[n].map((v) => v[0]); if (n === 3) allowed.push('industry1', 'industry2');
    const id = b.id + '_' + n, cur = docs(await db.collection('PROFILES').where('uid', '==', a.uid).get()).find((x) => x.id === id);
    const next = { ...(cur && !staleForm(b, cur.updatedAt) ? cur.data || {} : {}) };
    for (const [k, v] of Object.entries(data || {})) { if (!allowed.includes(k)) fail('허용되지 않은 입력항목입니다.'); next[k] = tidy(v, 4000); }
    await db.collection('PROFILES').doc(id).set({ companyId: b.id, uid: a.uid, step: n, data: next, updatedAt: now(), updatedBy: a.email });
    return API.portalData(a);
  };
  /** [업체] 제출 전 누락 확인 · 최종 제출 (제출·검토 메일은 중계 서버) */
  API.checkSubmission = async () => relay('check', {}, true);
  API.submitProfile = async (a) => { const r = await relay('submit', {}); return r && r.ok ? { ok: true, portal: await API.portalData(a) } : r; };
  /** [업체] 서류 파일 등록 (덮어쓰지 않고 새 버전) */
  API.uploadContractDoc = async (a, code, f) => { await relay('contractDoc', { code: String(code || ''), f }); return API.portalData(a); };
  API.uploadEvidence = async (a, f) => { await relay('evidence', { f }); return API.portalData(a); };
  /** [업체] 규정·계획서 작성 완료 → 중계 서버가 서명 PDF를 만들어 제출서류로 등록 */
  API.saveRuleDoc = async (a, d, sign) => { await relay('rule', { d: d || {}, sign: String(sign || '') }); return API.portalData(a); };
  API.savePlanDoc = async (a, d, sign) => { await relay('plan', { d: d || {}, sign: String(sign || '') }); return API.portalData(a); };
  API.uploadPlanFile = async (a, f) => relay('planFile', { f });

  /** [업체] 신규 작성(재평가) 시작 · 사업자 정보 수정 */
  API.startRenewal = async (a, mode) => { await relay('renew', { renewMode: mode === 'NEW' ? 'NEW' : 'KEEP' }); return API.portalData(a); };
  /** F1.7e [업체] 신규 작성 취소 (제출 전만) → 시작 전 승인 상태로 */
  API.cancelRenewal = async (a) => { await relay('renewCancel', {}); return API.portalData(a); };
  API.saveCompanyInfo = async (a, d, cert) => { await relay('companyInfo', { d: d || {}, cert: cert && cert.data ? cert : null }); return API.portalData(a); };

  /* 표준양식 (샘플): 목록은 Firestore · 파일은 구글 드라이브(중계) */
  API.getTemplate = async (a, code) => relay('template', { code: String(code || '') }, true);
  API.templateAdminList = async (a) => {
    if (!(await isSafety(a))) fail('안전보건팀만 표준양식을 관리할 수 있습니다.');
    const all = docs(await db.collection('TEMPLATES').get());
    return docTypes().map((t) => {
      const cur = all.filter((x) => x.docType === t.code && x.active === 'Y').sort((x, y) => Number(y.version) - Number(x.version))[0];
      return { code: t.code, stage: t.stage, stageLabel: DOC_STAGE[t.stage], name: t.name, cycle: t.cycle, ownerLabel: DOC_OWNER[t.owner] || t.owner, kind: t.kind, required: t.required === 'Y',
        current: cur ? { name: cur.name, version: Number(cur.version), uploadedAt: cur.uploadedAt, uploadedBy: cur.uploadedBy } : null, history: all.filter((x) => x.docType === t.code).length };
    });
  };
  API.uploadTemplate = async (a, code, f) => { await relay('tplUpload', { code: String(code || ''), f }); return API.templateAdminList(a); };
  API.refreshTemplateFolders = async (a) => { const report = await relay('tplSync', {}); return { report, list: await API.templateAdminList(a) }; };

  /* 참조 알림 (안전보건팀) */
  API.noticeList = async (a) => {
    if (!(await isSafety(a))) fail('안전보건팀만 볼 수 있습니다.');
    const list = docs(await db.collection('NOTICES').get()).sort((x, y) => String(y.time).localeCompare(String(x.time))).slice(0, 100);
    return { labels: NOTICE_LABEL, list: list.map((n) => ({ id: n.id, time: n.time, type: n.type, text: n.text, jobId: n.jobId, read: (n.readBy || []).includes(a.email) })) };
  };
  API.readNotices = async (a) => {
    if (!(await isSafety(a))) fail('안전보건팀만 볼 수 있습니다.');
    const s = await db.collection('NOTICES').get(), b = db.batch(); let n = 0;
    s.docs.forEach((d) => { const r = d.data().readBy || []; if (!r.includes(a.email)) { b.update(d.ref, { readBy: r.concat(a.email) }); n++; } });
    if (n) await b.commit();
    return API.noticeList(a);
  };

  /* 직원 관리: 화면은 줄 번호(row)를 쓰므로 번호 ↔ 문서(로그인 Gmail)를 기억 */
  let ROWS = [];
  API.staffList = async (a) => {
    if (!(await isSafety(a))) fail('안전보건팀만 직원 명단을 관리할 수 있습니다.');
    const s = await db.collection('STAFF').get();
    const list = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => String(x.createdAt || '').localeCompare(String(y.createdAt || '')) || x.id.localeCompare(y.id));
    ROWS = list.map((x) => x.id);
    return { me: a.email, roles: STAFF_ROLES, list: list.map((x, i) => ({ row: i + 1, name: x.name, dept: x.dept, role: x.role, companyEmail: x.companyEmail, loginEmail: x.loginEmail || x.id, active: x.active })) };
  };
  API.saveStaff = async (a, d) => {
    if (!(await isSafety(a))) fail('안전보건팀만 직원 명단을 관리할 수 있습니다.');
    const name = tidy(d?.name, 40), dept = tidy(d?.dept, 60), role = String(d?.role || ''), ce = lower(tidy(d?.companyEmail, 160)), le = lower(tidy(d?.loginEmail, 160)), active = d?.active === 'N' ? 'N' : 'Y';
    const bad = []; if (!name) bad.push('이름'); if (!STAFF_ROLES[role]) bad.push('역할'); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(le)) bad.push('로그인 Gmail'); if (ce && !isInternalEmail(ce)) bad.push('회사메일(@' + CFG.APPROVER_DOMAINS.join(', @') + ')');
    if (bad.length) fail('다음 항목을 확인해 주세요:\n- ' + bad.join('\n- '));
    const row = Number(d?.row) || 0, curId = row ? ROWS[row - 1] : null;
    if (row && !curId) fail('수정할 직원을 찾을 수 없습니다. 화면을 새로 고쳐 주세요.');
    if (curId === a.email && (active === 'N' || role !== 'SAFETY')) fail('본인 계정은 사용중지하거나 안전보건팀에서 뺄 수 없습니다.');
    const o = { name, dept, role, companyEmail: ce, loginEmail: le, active };
    await db.runTransaction(async (tx) => {
      const tgt = db.collection('STAFF').doc(le), t = await tx.get(tgt);
      if (t.exists && le !== curId) fail('이미 등록된 로그인 Gmail입니다.');
      if (curId) {
        const old = await tx.get(db.collection('STAFF').doc(curId)); if (!old.exists) fail('수정할 직원을 찾을 수 없습니다.');
        const base = old.data();
        tx.set(tgt, { ...o, createdBy: base.createdBy || a.email, createdAt: base.createdAt || now(), updatedBy: a.email, updatedAt: now() });
        if (le !== curId) tx.delete(old.ref);  // 로그인 Gmail을 바꾸면 문서 이름도 바뀜
      } else tx.set(tgt, { ...o, createdBy: a.email, createdAt: now() });
    });
    audit(a, '', curId ? 'STAFF_EDIT' : 'STAFF_ADD', name + ' ' + le + ' ' + role + ' ' + active);
    return API.staffList(a);
  };
  API.deleteStaff = async (a, row) => {
    if (!(await isSafety(a))) fail('안전보건팀만 직원 명단을 관리할 수 있습니다.');
    const id = ROWS[Number(row) - 1]; if (!id) fail('삭제할 직원을 찾을 수 없습니다. 화면을 새로 고쳐 주세요.');
    if (id === a.email) fail('본인 계정은 삭제할 수 없습니다.');
    if (MASTER_EMAILS.includes(id)) fail('마스터 계정은 삭제할 수 없습니다.');
    await db.collection('STAFF').doc(id).delete();
    audit(a, '', 'STAFF_DELETE', id);
    return API.staffList(a);
  };

  /* ---------- F1.3 공사 · 업체 배정 · 작업자 · 오늘 인원 ----------
   *  JOBS/{JOB-…}                 공사 (vendorUids = 배정 업체 대표 계정 → 업체가 자기 공사만 읽음)
   *  JOB_VENDORS/{공사ID_업체ID}   배정 (workerToken = 작업자 등록 QR 값)
   *  WORKERS/{WK-…}               작업자 명단 = 신규자 교육일지 (본인 QR 등록은 중계 서버가 씀)
   *  CREW/{공사ID_업체ID_날짜}      오늘 작업 인원 = 그날 작업안전수칙 서명 */
  const JOB_KINDS = { WORK: '매장 공사', CONTRACT: '계약 단위(입고도우미·재고조사 등)' };
  const MEET_KINDS = { COUNCIL: '안전보건협의체 회의', JOINT: '합동안전보건점검' };
  const WORK_RULES = ['작업에 적합한 단정한 복장을 착용한다.',
    '안전화, 안전모 등 안전보호구를 착용하고, 작업에 따라 안전보호구를 선별하며 철저히 착용 후 관리자의 인가를 받고 작업한다.',
    '사다리 포함 고소 작업 시에는 반드시 안전벨트를 착용하고 체결 후 작업한다.',
    '관리감독자의 지시에 따라 올바른 순서로 작업한다.',
    '작업 공구 및 기계는 반드시 안전점검 후 사용한다.',
    '핸드그라인더, 고속절단기 등 유해위험 기계기구는 반드시 안전장치를 설치 후 사용한다.',
    '전기 및 위험물을 취급 시에는 관계자의 지시에 따른다.',
    '현장 내에서는 절대로 뛰어다니지 않는다.',
    '사전 승인 없는 화기의 취급 및 절단, 용접은 엄금한다.',
    '유해위험 작업 시 반드시 작업구역을 설정하고, 경계를 분명히 하여 작업 중 재해가 발생하지 않도록 주의한다.',
    '작업중 음주 및 흡연은 엄금하고, 흡연은 정해진 장소에서만 한다.',
    '작업이 끝나면 반드시 정리정돈을 실시하고, 관계자의 인가를 받고 작업을 종료한다.',
    '관계자의 인가없이 작업을 끝낸 후 하자가 발생하면 공사업체 책임자가 책임을 진다.',
    '업체 책임자 및 직원은 관계인의 연락처를 숙지하고, 긴급상황 등 이상 발생 시 즉시 연락을 취한다.'];
  const WORK_PLEDGE = '작업자는 상기의 안전 작업 수칙을 교육 받고, 작업 시 안전 작업 수칙을 준수하며, 안전 작업 서약서에 서명 후 작업을 실시한다.';
  const WORKER_ROLES = ['관리자', '근로자'], EDU_TYPE = '채용 시 교육';
  const INSP_ITEMS = ['정리정돈 실시상태', '소방설비 관리상태', '복장 및 보호구 착용상태', '안전장치 관리상태', '안전표지 부착', '유해위험작업관리', '안전수칙 준수', '관리감독 이행여부', '유해물질관리', '감전재해 예방관리', '인화성 가스 안전관리'];
  /* F1.8a 순회점검표 = 공통 5항목 + 안전보건관리계획서 위험성평가에서 고른 위험작업별 안전대책
   *  (계획서에 위험작업이 없으면 예전 11항목) · 점검마다 항목 이름을 같이 저장(labels) → 나중에 계획서가 바뀌어도 그날 점검표 그대로 */
  const INSP_BASE = ['정리정돈 실시상태', '소방설비 관리상태', '복장 및 보호구 착용상태', '안전표지 부착', '안전수칙 준수'];
  /* F1.8r 공통 5항목 + 계획서에서 고른 위험요인의 짧은 점검 질문 (예: 해체·폐기물 반출 시 … 떨어질 위험은 없는가?) */
  const inspItemsFor = (plan) => { const r = planRisks(plan); return r.length ? INSP_BASE.concat(r.map((x) => x.q)) : INSP_ITEMS.slice(); };
  /** 업체의 계획서(C02)에서 고른 위험요인 → 점검 항목 */
  async function planOf(a, b) {
    const f = docs(await db.collection('CONTRACT_FORMS').where('uid', '==', a.uid).get().catch(() => ({ docs: [] }))).find((x) => x.companyId === b.id && x.code === 'C02');
    return parse(f && f.json, {}) || {};
  }
  async function inspItemsOf(a, b) { return inspItemsFor(await planOf(a, b)); }
  /* F1.8b 순회점검 때 같이 올리는 교육·비상대응훈련 사진 (한 날만) · 비상훈련 = 대피·CPR·소화기 → 종료 평가 11번 */
  const DRILL_TYPES = { EVAC: '비상대피 훈련', CPR: '심폐소생술(CPR) 교육', FIRE: '소화기 사용 훈련', EDU: '기타 안전교육' }, DRILL_EMERGENCY = ['EVAC', 'CPR', 'FIRE'];
  const drillOf = (x) => { const d = x && x.drill; return d && DRILL_TYPES[d.type] && photoIds(d.photos, 5).length ? { type: d.type, label: DRILL_TYPES[d.type], photos: photoIds(d.photos, 5) } : null; };
  const inspLabels = (x) => (Array.isArray(x && x.labels) && x.labels.length ? x.labels : INSP_ITEMS);
  const daysBetween = (x, y) => Math.round((new Date(y + 'T00:00:00Z') - new Date(x + 'T00:00:00Z')) / 86400000);
  const rand8 = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) => v.toString(16).padStart(2, '0')).join('');
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  function jobEndInfo(j) {
    if (j.status === 'ENDED') return { state: 'ENDED', endedAt: j.endedAt ? kst(j.endedAt) : '' };
    if (!isDate(j.endDate)) return { state: 'OPEN' };
    const left = daysBetween(today(), j.endDate); return { state: left < 0 ? 'OVER' : left <= 3 ? 'SOON' : 'OPEN', left };
  }
  const canSeeJob = (a, s, j) => !!j && (s.role === 'SAFETY' || lower(j.hostEmail) === a.email);
  /** 공사 여러 개의 기록을 한꺼번에 (Firestore 'in'은 30개씩) */
  async function byJobs(col, ids) {
    const parts = []; for (let i = 0; i < ids.length; i += 30) parts.push(ids.slice(i, i + 30));
    return (await Promise.all(parts.map((p) => db.collection(col).where('jobId', 'in', p).get().then(docs)))).flat();
  }
  /** 업체별 이행 현황 (작업일 = 인원·허가서·순회점검 기록이 있는 날) */
  function vjStats(crew, pm, ins, fd) {
    pm = pm || []; ins = ins || []; fd = fd || [];
    const t = today(), wd = new Set([].concat(crew.map((x) => x.date), pm.map((x) => x.date), ins.map((x) => x.date)).filter(Boolean)).size, last = ins.map((x) => x.date).filter(Boolean).sort().pop() || '';
    return { workDays: wd, crewDays: crew.length, permitDays: new Set(pm.map((x) => x.date)).size, insp: ins.length, inspNeed: wd ? Math.max(1, Math.ceil(wd / 2)) : 0,
      openFindings: fd.filter((x) => x.status !== 'DONE').length, findTotal: fd.length, todayPermit: pm.some((p) => p.date === t), inspToday: last === t, inspDue: !last || daysBetween(last, t) >= 2, lastInsp: last };
  }
  /** 공사에 배정할 수 있는 업체 (재평가 중 포함 · 테스트 모드면 승인 전도) */
  async function jobVendorChoices() {
    return docs(await db.collection('COMPANIES').where('status', '==', 'VERIFIED').get()).filter((x) => canExec(x) || CFG.TEST_SKIP_FILES).map((x) => {
      const v = contractValid(x);
      return { id: x.id, uid: x.uid, company: x.company, industry: x.industry, approved: canExec(x), renewing: !!x.renewAt, renewStatus: x.renewAt ? x.submissionStatus : '', valid: v, expired: !!(v && v.expired), lastEval: null };
    });
  }
  function jobView(j, jvs, wks, crews, pms, inss, fds, mts, ats, evs) {
    const of = (l) => (l || []).filter((x) => x.jobId === j.id), vs = of(jvs).sort((x, y) => String(x.addedAt).localeCompare(String(y.addedAt))), cr = of(crews), pm = of(pms), ins = of(inss), fd = of(fds);
    const by = (l, v) => l.filter((x) => x.companyId === v.companyId);
    return { id: j.id, title: j.title, storeName: j.storeName, storeCode: j.storeCode, address: j.address, kind: j.kind, kindLabel: JOB_KINDS[j.kind] || j.kind, startDate: j.startDate, endDate: j.endDate,
      delegations: j.delegations || {}, hostName: j.hostName, hostEmail: j.hostEmail, status: j.status,
      vendors: vs.map((v) => ({ companyId: v.companyId, company: v.company, trade: v.trade })),
      workerCount: wks.filter((w) => w.jobId === j.id).length, permitWaiting: pm.filter((p) => p.status === 'ISSUED').length, permitTotal: pm.length,
      inspTotal: ins.length, inspUnchecked: ins.filter((x) => !x.checkedAt).length, findOpen: fd.filter((f) => f.status !== 'DONE').length,
      // F1.8g 도급인 메인 '지적사항 · 시정조치' 목록
      findings: fd.map((f) => ({ id: f.id, inspId: f.inspId, company: f.company, companyId: f.companyId, no: Number(f.no), item: f.item, memo: f.memo, foundDate: f.foundDate, status: f.status, actionDate: f.actionDate || '' })),
      vstats: vs.map((v) => Object.assign({ company: v.company, companyId: v.companyId }, vjStats(by(cr, v), by(pm, v), by(ins, v), by(fd, v)))),
      end: jobEndInfo(j), evalDone: of(evs).filter((e) => e.status === 'DONE').length, evalTotal: of(evs).length, crewDays: cr.length,
      meetings: of(mts).sort((x, y) => String(x.createdAt).localeCompare(String(y.createdAt))).map((m) => meetSummary(m, of(ats))) };
  }
  async function staffOnly(a) { const s = await staffOf(a); if (!s) fail('아성다이소 직원 계정만 사용할 수 있습니다.'); return s; }
  /** [직원] 공사 목록 + 배정 가능한 업체 */
  API.jobBoard = async (a, noAuto) => {
    const s = await staffOnly(a);
    const [choices, all] = await Promise.all([jobVendorChoices(), db.collection('JOBS').get().then(docs)]);
    const jobs = all.filter((j) => canSeeJob(a, s, j)).sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt))), ids = jobs.map((j) => j.id);
    const L = await Promise.all(['JOB_VENDORS', 'WORKERS', 'CREW', 'PERMITS', 'INSPECTIONS', 'FINDINGS', 'MEETINGS', 'ATTEND', 'JOB_EVALS'].map((n) => byJobs(n, ids)));
    // F1.8l 착수 미팅 · 법정 주기 미팅 자동 생성 → 만들었으면 한 번 더 읽음
    if (noAuto !== true && await autoMeetings(a, s, jobs, L[6])) return API.jobBoard(a, true);
    // 업체 고를 때 지난 종료 평가 (C·D등급 경고)
    const le = lastEvals(await db.collection('JOB_EVALS').where('status', '==', 'DONE').get().then(docs), all);
    return { me: { name: s.name, role: s.role }, principal: await principal().catch(() => null), kinds: JOB_KINDS, meetKinds: MEET_KINDS, vendors: choices.map(({ uid, ...v }) => ({ ...v, lastEval: le[v.id] || null })), testMode: CFG.TEST_SKIP_FILES, jobs: jobs.map((j) => jobView(j, ...L)) };
  };
  /** [직원] 공사 만들기·수정 (참여 업체·위임장 정보 포함) */
  API.saveJob = async (a, d) => {
    const s = await staffOnly(a);
    const title = tidy(d?.title, 120), storeName = tidy(d?.storeName, 80), storeCode = tidy(d?.storeCode, 30), address = tidy(d?.address, 200), kind = JOB_KINDS[d?.kind] ? d.kind : 'WORK', sd = tidy(d?.startDate, 10), ed = tidy(d?.endDate, 10);
    const bad = []; if (!title) bad.push('공사명'); if (!storeName) bad.push('매장명(또는 계약명)'); if (!isDate(sd)) bad.push('시작일'); if (ed && !isDate(ed)) bad.push('종료일'); if (ed && sd && ed < sd) bad.push('종료일이 시작일보다 빠름');
    if (bad.length) fail('다음 항목을 확인해 주세요:\n- ' + bad.join('\n- '));
    const dl = {}; ['COUNCIL', 'JOINT'].forEach((k) => { const x = (d?.delegations || {})[k] || {}; dl[k] = { delegator: tidy(x.delegator, 60), delegatee: tidy(x.delegatee, 60), date: tidy(x.date, 10) }; });
    const choices = await jobVendorChoices(), want = [...new Set((d?.vendorIds || []).map(String))], pick = want.filter((id) => choices.some((c) => c.id === id));
    let id = tidy(d?.id, 40); const cur = id ? await db.collection('JOBS').doc(id).get() : null;
    if (id && (!cur.exists || !canSeeJob(a, s, cur.data()))) fail('수정할 수 없는 공사입니다.');
    const oldSd = cur ? String(cur.data().startDate || '') : '';  // F1.8l 시작일이 바뀌었는지 (착수 미팅 날짜 따라가기)
    const have = id ? docs(await db.collection('JOB_VENDORS').where('jobId', '==', id).get()) : [];
    // 계약 전 평가 유효기간(1년)이 지난 업체는 새로 배정하지 않음 (이미 배정된 업체는 그대로)
    const add = pick.filter((c) => !have.some((h) => h.companyId === c)).map((c) => choices.find((x) => x.id === c));
    const exp = add.filter((v) => v.expired && !CFG.TEST_SKIP_FILES);
    if (exp.length) fail('계약 전 평가 유효기간(1년)이 지난 업체는 새로 배정할 수 없습니다.\n업체가 계약 전 서류를 고쳐 다시 제출하고 승인받으면 배정할 수 있습니다:\n- ' + exp.map((v) => v.company + ' (유효기간 ~' + v.valid.until + ')').join('\n- '));
    // 체크 해제한 업체 배정 취소 (그 업체의 작업자·작업 기록이 있으면 취소 불가)
    const drop = have.filter((v) => !want.includes(v.companyId));
    if (drop.length) {
      const [w, c] = await Promise.all(['WORKERS', 'CREW'].map((n) => db.collection(n).where('jobId', '==', id).get().then(docs)));
      const busy = drop.filter((v) => w.some((x) => x.companyId === v.companyId) || c.some((x) => x.companyId === v.companyId));
      if (busy.length) fail('작업자·작업 기록이 있는 업체는 배정을 취소할 수 없습니다:\n- ' + busy.map((v) => v.company).join('\n- '));
    }
    if (!id) id = 'JOB-' + rand8();
    const vendorUids = [...new Set(have.filter((v) => want.includes(v.companyId)).map((v) => v.vendorUid).concat(add.map((v) => v.uid)).filter(Boolean))];
    const o = { title, storeName, storeCode, address, kind, startDate: sd, endDate: ed, delegations: dl, vendorUids }, b = db.batch(), ref = db.collection('JOBS').doc(id);
    if (cur) b.update(ref, o); else b.set(ref, { id, ...o, hostEmail: a.email, hostName: s.name, status: 'OPEN', createdAt: now(), extensions: [], endedAt: '', endedBy: '' });
    add.forEach((v) => b.set(db.collection('JOB_VENDORS').doc(id + '_' + v.id), { jobId: id, companyId: v.id, company: v.company, trade: v.industry, vendorUid: v.uid, addedBy: a.email, addedAt: now(), workerToken: '' }));
    drop.forEach((v) => b.delete(db.collection('JOB_VENDORS').doc(v.id)));
    await b.commit();
    if (drop.length) audit(a, '', 'JOB_VENDOR_REMOVE', id + ' ' + drop.map((v) => v.company).join(', '));
    audit(a, '', cur ? 'JOB_EDIT' : 'JOB_ADD', id + ' ' + title + ' 업체 ' + pick.length);
    // F1.8l 시작일을 고치면 아직 시작 안 한 착수 미팅 날짜도 따라감 (새 공사의 착수 미팅은 jobBoard가 자동으로 만듦)
    if (cur) { try { const ms = await db.collection('MEETINGS').doc('MT-' + id + '-START').get(); const m = ms.exists ? ms.data() : null, nd = sd >= today() ? sd : today();
      if (m && !m.doneAt && m.open !== 'Y' && m.date !== nd && oldSd !== sd) await API.setMeetingDate(a, m.id, nd); } catch (e) { console.warn('착수 미팅 날짜 변경 실패', e && e.message); } }
    return API.jobBoard(a);
  };
  /** [직원] 공사 삭제 — 업체 배정·작업자·작업 인원 기록까지 함께 (삭제 내역은 접근및작업이력에) */
  API.deleteJob = async (a, jobId) => {
    const s = await staffOnly(a), id = tidy(jobId, 40), js = await db.collection('JOBS').doc(id).get(), j = js.exists ? js.data() : null;
    if (!j || !canSeeJob(a, s, j)) fail('삭제할 수 없는 공사입니다.');
    const COLS = ['JOB_VENDORS', 'WORKERS', 'CREW', 'PERMITS', 'INSPECTIONS', 'FINDINGS', 'MEETINGS', 'ATTEND', 'JOB_EVALS'], lists = await Promise.all(COLS.map((n) => db.collection(n).where('jobId', '==', id).get()));
    const b = db.batch(), cnt = {};
    COLS.forEach((n, i) => { cnt[n] = lists[i].docs.length; lists[i].docs.forEach((d) => b.delete(d.ref)); });
    lists[COLS.indexOf('MEETINGS')].docs.forEach((d) => { if (d.data().token) b.delete(db.collection('MEET_LINKS').doc(d.data().token)); });  // 참석 QR도 무효
    b.delete(js.ref); await b.commit();
    audit(a, '', 'JOB_DELETE', id + ' ' + j.title + ' ' + JSON.stringify(cnt));
    return API.jobBoard(a);
  };

  /* 업체: 내 공사 · 작업자 · 오늘 인원 */
  async function execVendor(a) {
    if (a.mode === 'STAFF') fail('다이소 담당자로 접속했습니다. 업체 업무는 로그인 화면에서 [협력업체]로 다시 로그인해 주세요.');
    const b = await myCompany(a);
    if (!b || b.status !== 'VERIFIED' || !(canExec(b) || CFG.TEST_SKIP_FILES)) fail('계약 전 검토가 승인된 업체 대표 계정만 사용할 수 있습니다.');
    return b;
  }
  const myAssign = async (a, b) => docs(await db.collection('JOB_VENDORS').where('vendorUid', '==', a.uid).get()).filter((v) => v.companyId === b.id);
  const mineOf = (col, a, jobId) => db.collection(col).where('vendorUid', '==', a.uid).where('jobId', '==', jobId).get().then(docs);
  async function vendorJobOf(a, b, jobId, write) {
    const id = tidy(jobId, 40), jv = (await myAssign(a, b)).find((v) => v.jobId === id);
    if (!jv) fail('이 공사에 배정된 업체가 아닙니다.');
    const js = await db.collection('JOBS').doc(id).get(); if (!js.exists) fail('이 공사에 배정된 업체가 아닙니다.');
    const j = js.data(); if (write && j.status === 'ENDED') fail('종료된 공사입니다. 지난 기록은 볼 수만 있습니다.');
    return { jv, j };
  }
  async function siteManagerOf(a, b) { const p = docs(await db.collection('PROFILES').where('uid', '==', a.uid).get()).find((x) => x.id === b.id + '_1'); return String(((p && p.data) || {}).siteManager || ''); }
  /** 그날 수칙 서명 방식: 처음 등록한 날 본인 계정으로 서명 → SELF, 그 외(소장 체크·소장 등록) → MANAGER */
  const crewSnap = (w, date) => ({ id: w.id, name: w.name, role: w.role, trade: w.trade || '', sign: (w.method === 'SELF' && kst(w.rulesAt) === date) ? 'SELF' : 'MANAGER' });
  async function crewWrite(a, b, j, date, list, sm) {
    const id = j.id + '_' + b.id + '_' + date;
    await db.collection('CREW').doc(id).set({ id, jobId: j.id, companyId: b.id, vendorUid: a.uid, date, workers: list.map((w) => crewSnap(w, date)), count: list.length, siteManager: sm, savedBy: a.email, savedAt: now() });
  }
  /** 새로 등록한 작업자를 오늘 인원에 추가 (처음 온 날 = 그날 작업자) */
  async function crewAppend(a, b, j, w, ws) {
    const t = today(), cur = (await mineOf('CREW', a, j.id)).find((x) => x.date === t && x.companyId === b.id), ids = cur ? (cur.workers || []).map((x) => x.id) : [];
    if (ids.includes(w.id)) return;
    const act = ws.filter((x) => x.companyId === b.id && x.active !== 'N'), list = ids.map((id) => act.find((x) => x.id === id)).filter(Boolean).concat([w]);
    await crewWrite(a, b, j, t, list, cur ? cur.siteManager : await siteManagerOf(a, b));
  }
  /** F1.8a 허가서 발행·순회점검 제출 때 같이 보낸 오늘 인원 → 오늘 작업 안전 수칙 서명으로 저장 (인원 저장 버튼을 따로 누르지 않아도 됨)
   *  crew = { ids: [작업자ID…], sm: 현장책임자 } · 비었으면 건너뜀 */
  async function crewWith(a, b, j, crew) {
    if (!crew || !Array.isArray(crew.ids) || !crew.ids.length) return;
    const ws = (await mineOf('WORKERS', a, j.id)).filter((w) => w.companyId === b.id && w.active !== 'N'), pick = [...new Set(crew.ids.map(String))].map((id) => ws.find((w) => w.id === id)).filter(Boolean);
    if (!pick.length) return;
    await crewWrite(a, b, j, today(), pick, tidy(crew.sm, 40) || await siteManagerOf(a, b)); audit(a, b.id, 'CREW_SAVE', j.id + ' ' + today() + ' ' + pick.length + '명 (자동)');
  }
  /** [업체] 내 공사 목록 */
  API.myJobs = async (a) => {
    const b = await execVendor(a), t = today(), jvs = (await myAssign(a, b)).sort((x, y) => String(y.addedAt).localeCompare(String(x.addedAt)));
    const mineAll = (col) => db.collection(col).where('vendorUid', '==', a.uid).get().then(docs);
    const [jobs, wks, crews, pms, inss, fds, nts, ats] = await Promise.all([
      Promise.all(jvs.map((v) => db.collection('JOBS').doc(v.jobId).get().then((s) => (s.exists ? s.data() : null)).catch(() => null))), mineAll('WORKERS'), mineAll('CREW'), mineAll('PERMITS'), mineAll('INSPECTIONS'), mineAll('FINDINGS'),
      // F1.8f 메인 화면 📢 미팅 알림 (도급인이 만든 협의체·합동점검) · 보안 규칙을 아직 안 올렸으면 알림만 빠짐
      db.collection('MEET_NOTICES').where('v.' + a.uid, '==', true).get().then(docs).catch(() => []),
      db.collection('ATTEND').where('uid', '==', a.uid).get().then(docs).catch(() => [])]);
    const jobIds = new Set(jvs.map((v) => v.jobId)), went = new Set(ats.filter((x) => x.status !== 'REJECTED').map((x) => x.meetingId));
    const meets = nts.filter((m) => m.done !== 'Y' && m.date >= t && jobIds.has(m.jobId)).sort((x, y) => (x.date + x.time < y.date + y.time ? -1 : 1))
      .map((m) => ({ id: m.id, jobId: m.jobId, title: m.title, store: m.store, date: m.date, time: m.time || '', place: m.place || '', kinds: (m.kinds || []).map((k) => MEET_KINDS[k]).filter(Boolean), attended: went.has(m.id) }));
    return { today: t, company: b.company, meets, jobs: jvs.map((v, i) => {
      const j = jobs[i]; if (!j) return null;
      const cr = crews.filter((c) => c.jobId === j.id && c.companyId === b.id), c = cr.find((x) => x.date === t);
      return { id: j.id, title: j.title, storeName: j.storeName, startDate: j.startDate, endDate: j.endDate, hostName: j.hostName, trade: v.trade, status: j.status,
        workers: wks.filter((w) => w.jobId === j.id && w.companyId === b.id && w.active !== 'N').length, todayCount: c ? Number(c.count) : 0, todayDone: !!c, end: jobEndInfo(j),
        stats: vjStats(cr, ...[pms, inss, fds].map((l) => l.filter((x) => x.jobId === j.id && x.companyId === b.id))),
        // F1.8f 메인 화면 '지적사항 조치' 목록 (미조치 + 조치 완료)
        findings: fds.filter((f) => f.jobId === j.id && f.companyId === b.id).map((f) => ({ id: f.id, no: Number(f.no), item: f.item, memo: f.memo, foundDate: f.foundDate, status: f.status, actionDate: f.actionDate || '' })) };
    }).filter(Boolean) };
  };
  async function jobPack(a, b, j, jv) {
    const t = today(), [wks, crews, sm0, pms, inss, fds, evs, LB] = await Promise.all([mineOf('WORKERS', a, j.id), mineOf('CREW', a, j.id), siteManagerOf(a, b), mineOf('PERMITS', a, j.id), mineOf('INSPECTIONS', a, j.id), mineOf('FINDINGS', a, j.id),
      j.status === 'ENDED' ? mineOf('JOB_EVALS', a, j.id).catch(() => []) : [], planOf(a, b)]);
    const PL = LB, LBI = inspItemsFor(PL);  // F1.8s 계획서 하나로 점검 항목 + 작업자 등록 공종 목록
    const ev = evs.find((e) => e.companyId === b.id && e.status === 'DONE');
    const ws = wks.filter((w) => w.companyId === b.id && w.active !== 'N'), cr = crews.filter((c) => c.companyId === b.id).sort((x, y) => (x.date < y.date ? 1 : -1));
    const day = (c) => ({ date: c.date, count: Number(c.count) || (c.workers || []).length, siteManager: c.siteManager, savedAt: c.savedAt, workers: c.workers || [] }), tc = cr.find((x) => x.date === t);
    return { today: t, job: { id: j.id, title: j.title, storeName: j.storeName, address: j.address, startDate: j.startDate, endDate: j.endDate, hostName: j.hostName },
      company: { id: b.id, company: b.company, trade: jv.trade }, link: location.origin + location.pathname + '?review=WRK-' + jv.workerToken,
      workers: ws.map((w) => ({ id: w.id, name: w.name, role: w.role, trade: w.trade, tradeKey: w.tradeKey || '', special: w.special || [], eduHours: Number(w.eduHours) || 1, method: w.method, eduAt: w.eduAt, email: w.email, certDoc: w.certDoc || '' })),
      trades: eduTrades(PL),
      todayCrew: tc ? day(tc) : null, history: cr.slice(0, 30).map(day), siteManager: tc ? tc.siteManager : sm0,
      // F1.8a 오늘 인원 기본 체크: 오늘 저장한 인원 → 없으면 가장 최근 날 인원 → 없으면 등록된 전원
      crewDefault: ((tc || cr[0]) ? ((tc || cr[0]).workers || []).map((w) => w.id) : ws.map((w) => w.id)).filter((id) => ws.some((w) => w.id === id)),
      rules: WORK_RULES, pledge: WORK_PLEDGE, roles: WORKER_ROLES,
      permits: pms.filter((p) => p.companyId === b.id).sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 30).map(permitSummary), insp: inspPack(inss.filter((x) => x.companyId === b.id), fds.filter((x) => x.companyId === b.id), LBI),
      jobStatus: j.status, permitToday: null, principal: await principal().catch(() => null), evalResult: ev ? { total: Number(ev.total), grade: ev.grade, comment: ev.comment, date: ev.evaluatedAt ? kst(ev.evaluatedAt) : '' } : null };
  }
  /** [업체] 공사 화면 (처음 열 때 작업자 등록 QR 값 생성) */
  API.vendorJob = async (a, jobId) => {
    const b = await execVendor(a), { jv, j } = await vendorJobOf(a, b, jobId);
    if (!jv.workerToken) { jv.workerToken = newToken(); await db.collection('JOB_VENDORS').doc(jv.id).update({ workerToken: jv.workerToken }); }
    return jobPack(a, b, j, jv);
  };
  /** [업체] QR 새로 만들기 (링크가 외부로 퍼졌을 때) — 이전 QR은 바로 사용 불가 */
  API.renewWorkerQr = async (a, jobId) => {
    const b = await execVendor(a), { jv, j } = await vendorJobOf(a, b, jobId, true);
    await db.collection('JOB_VENDORS').doc(jv.id).update({ workerToken: newToken() }); audit(a, b.id, 'WORKER_QR_RENEW', j.id);
    return API.vendorJob(a, jobId);
  };
  /** [업체] Google 계정이 없는 작업자를 소장이 직접 등록 (교육 실시 확인 필수) */
  API.addWorker = async (a, jobId, info, requestId) => {
    const b = await execVendor(a), { j, jv } = await vendorJobOf(a, b, jobId, true);
    const E = eduOf(tidy(info?.tradeKey, 20));  // F1.8s 공종 고르면 특별교육 → 2시간
    const name = tidy(info?.name, 40), role = WORKER_ROLES.includes(info?.role) ? info.role : '', trade = E.tradeName || tidy(info?.trade, 40) || jv.trade;
    const bad = []; if (!name) bad.push('이름'); if (!role) bad.push('구분(관리자/근로자)'); if (!info?.agree) bad.push('교육 실시·수칙 설명 확인 체크');
    if (bad.length) fail('다음 항목을 확인해 주세요:\n- ' + bad.join('\n- '));
    const rid = String(requestId || '').toLowerCase(); if (rid && !/^[a-f0-9]{32}$/.test(rid)) fail('잘못된 요청 식별값입니다.');
    const workerId = rid ? 'WK-' + rid.slice(0, 16).toUpperCase() : 'WK-' + rand8(), ws = await mineOf('WORKERS', a, j.id), ex = ws.find((x) => x.id === workerId);
    if (ex) {  // 같은 요청을 다시 보낸 경우 (연결이 끊겼다 다시 보냄)
      if (ex.companyId !== b.id || ex.name !== name || ex.role !== role || ex.trade !== trade) fail('등록 요청이 충돌했습니다. 화면을 새로고침해 주세요.');
      await crewAppend(a, b, j, ex, ws);
    } else {
      const t = now(), w = { id: workerId, jobId: j.id, companyId: b.id, company: b.company, name, role, trade, email: '', uid: '', vendorUid: a.uid, method: 'MANUAL', eduType: EDU_TYPE + (E.special.length ? ' · 특별교육' : ''),
        tradeKey: E.tradeKey, special: E.special, eduHours: E.eduHours,
        eduContent: '채용 시 교육 ' + EDU_HIRE.length + '개 항목 · 작업 안전 수칙 ' + WORK_RULES.length + '개 항목' + (E.special.length ? ' · 특별교육 ' + E.special.join(',') + '번' : ''), eduAt: t, rulesAt: t, addedBy: a.email, addedAt: t, active: 'Y' };
      await db.collection('WORKERS').doc(workerId).set(w); await crewAppend(a, b, j, w, ws.concat([w]));
      audit(a, b.id, 'WORKER_ADD_MANUAL', j.id + ' ' + name);
    }
    return { saved: true, workerId, jobId: j.id, companyId: b.id, name, role, trade, tradeKey: E.tradeKey, special: E.special, eduHours: E.eduHours, date: today() };
  };
  /** [업체] 작업자 명단에서 빼기 (기록은 남김) */
  API.removeWorker = async (a, jobId, workerId) => {
    const b = await execVendor(a), { j } = await vendorJobOf(a, b, jobId, true), w = (await mineOf('WORKERS', a, j.id)).find((x) => x.id === tidy(workerId, 40) && x.companyId === b.id);
    if (!w) fail('작업자를 찾을 수 없습니다.');
    await db.collection('WORKERS').doc(w.id).update({ active: 'N' }); audit(a, b.id, 'WORKER_REMOVE', j.id + ' ' + w.name);
    return API.vendorJob(a, jobId);
  };
  /** [업체] 오늘 작업 인원 저장 = 그날 작업안전수칙 서명 (같은 날 다시 저장하면 덮어씀) */
  API.saveCrew = async (a, jobId, ids, siteManager) => {
    const b = await execVendor(a), { j } = await vendorJobOf(a, b, jobId, true), sm = tidy(siteManager, 40);
    if (!sm) fail('현장책임자 이름을 입력해 주세요.');
    const ws = (await mineOf('WORKERS', a, j.id)).filter((w) => w.companyId === b.id && w.active !== 'N'), pick = [...new Set((ids || []).map(String))].map((id) => ws.find((w) => w.id === id)).filter(Boolean);
    if (!pick.length) fail('오늘 작업하는 사람을 한 명 이상 체크해 주세요.');
    await crewWrite(a, b, j, today(), pick, sm); audit(a, b.id, 'CREW_SAVE', j.id + ' ' + today() + ' ' + pick.length + '명');
    return API.vendorJob(a, jobId);
  };
  /** [작업자] QR 본인 등록 — QR 값 확인이 필요해 중계 서버가 처리. info 없이 부르면 입력 화면 정보 */
  API.workerCheckIn = async (a, token, info) => relay('workerIn', { token: String(token || ''), info: info || null }, !info);
  /** F1.8c [업체] 잘못 누른 것 되돌리기: 오늘 등록 취소 · 오늘 순회점검 제출 취소 (중계 서버가 확인 후 지움) */
  API.undoWorker = async (a, jobId, workerId) => { await relay('workerUndo', { jobId: tidy(jobId, 40), workerId: tidy(workerId, 40) }); return API.vendorJob(a, jobId); };
  API.cancelInspection = async (a, jobId) => { await relay('inspCancel', { jobId: tidy(jobId, 40) }); return API.vendorJob(a, jobId); };
  /** F1.8b [업체] 작업자 기초안전보건교육 이수증 올리기 (직접 등록한 사람 · 나중에 가져온 사람) */
  API.uploadWorkerCert = async (a, jobId, workerId, f) => {
    if (!f || !/^(image\/(jpeg|png)|application\/pdf)$/.test(String(f.mime || ''))) fail('이수증은 사진(JPG·PNG) 또는 PDF만 올릴 수 있습니다.');
    await relay('workerCert', { jobId: tidy(jobId, 40), workerId: tidy(workerId, 40), f }); return API.vendorJob(a, jobId);
  };

  /* ---------- F1.4 안전작업허가서 (매일 1회 · 업체 발행 → 바로 작업 · 도급인 나중 승인) ----------
   *  PERMITS/{공사ID_업체ID_날짜}  data = 허가서 내용(JSON 글자) · progress = 발행 후 진행 기록(가스측정·완료·연장)
   *  승인 뒤에는 data는 못 고치고 progress만 고칠 수 있음 (보안 규칙이 확인) */
  const PERMIT_PROGRESS_KEYS = ['gas', 'gasNote', 'complete', 'extend'];  // F1.8p 작업중 확인(during) 없앰
  /** 허가서 내용 정리: 글자 300자, 배열 10개, 키 60개, 깊이 5단계 */
  function permitClean(v, depth) {
    depth = depth || 0; if (depth > 5) return null;
    if (typeof v === 'boolean') return v; if (typeof v === 'number') return isFinite(v) ? v : 0; if (typeof v === 'string') return tidy(v, 300);
    if (Array.isArray(v)) return v.slice(0, 10).map((x) => permitClean(x, depth + 1));
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).slice(0, 60).forEach((k) => { if (/^[A-Za-z0-9_]{1,30}$/.test(k)) o[k] = permitClean(v[k], depth + 1); }); return o; }
    return null;
  }
  const permitData = (p) => ({ ...parse(p.data, {}), ...parse(p.progress, {}) });
  function permitSummary(p) {
    const d = permitData(p);
    return { id: p.id, no: p.no, date: p.date, status: p.status, company: p.company, workName: d.workName || '', place: d.place || '', start: (d.period || {}).start || '', end: (d.period || {}).end || '',
      issuedAt: p.issuedAt, approvedBy: p.approvedBy, approvedAt: p.approvedAt, completed: !!(d.complete && d.complete.time) };
  }
  const permitFull = (p) => ({ ...permitSummary(p), companyId: p.companyId, jobId: p.jobId, data: permitData(p), issuedBy: p.issuedBy, updatedAt: p.updatedAt, approveNote: p.approveNote });
  /** 발행 전 필수 확인 (화면에서도 같은 검사) */
  function permitCheck(d) {
    const bad = [], P = d.period || {};
    if (!d.workName) bad.push('작업명(공정)'); if (!d.place) bad.push('작업지역(장소)'); if (!P.start || !P.end) bad.push('작업허가기간(시작·종료 시각)');
    if (!(d.applicant || {}).name) bad.push('신청인 성명'); if (!(d.issuer || {}).name) bad.push('발급자 성명'); if (!(d.confirm || {}).manager) bad.push('안전조치 확인: 작업 부서 책임자');
    Object.entries(d.safety || {}).forEach(([k, v]) => { if (v && v.need && !v.done) bad.push('안전조치 요구사항 \'' + k + '\' 조치 완료 체크'); });
    Object.entries(d.supp || {}).forEach(([k, v]) => {
      if (v && v.on) {
        if (!v.from || !v.to) bad.push('보충작업(' + k + ') 허가기간'); if (!v.checker) bad.push('보충작업(' + k + ') 확인자');
        Object.entries(v.checks || {}).forEach(([c, x]) => { if (x && x.need && !x.done) bad.push('보충작업(' + k + ') \'' + c + '\' 조치 완료 체크'); });
      }
    });
    return bad;
  }
  /** 업체 허가서 한 장 (지정일) · 없으면 지난 허가서로 미리 채운 새 양식 */
  async function permitPack(a, b, j, jv, dt) {
    const list = (await mineOf('PERMITS', a, j.id)).filter((x) => x.companyId === b.id), p = list.find((x) => x.date === dt);
    if (p) return { exists: true, today: today(), permit: permitFull(p) };
    if (dt !== today()) fail('해당 날짜의 허가서가 없습니다.');
    const last = list.sort((x, y) => (x.date < y.date ? 1 : -1))[0], ld = last ? permitData(last) : null, sm = await siteManagerOf(a, b);
    const base = { applicant: { dept: b.company, title: '현장책임자', name: sm }, period: { start: '08:00', end: '17:00' }, place: j.storeName, device: '', workName: '', attach: {}, pre: { procChange: '무', workDiff: '무' }, safety: {}, supp: {},
      gas: [], gasNote: '', confirm: { manager: sm, witness: '' }, complete: {}, etc: '', issuer: { dept: b.company, title: '현장책임자', name: sm }, extend: {} };
    if (ld) {
      ['applicant', 'period', 'place', 'device', 'workName', 'attach', 'pre', 'safety', 'supp', 'confirm', 'issuer'].forEach((k) => { if (ld[k] !== undefined) base[k] = ld[k]; });
      // 보충작업 확인자·조치 완료 체크는 매일 새로 확인 (필요 체크만 이어받음)
      Object.values(base.supp || {}).forEach((s) => { s.checker = ''; Object.values(s.checks || {}).forEach((c) => { c.done = false; }); }); Object.values(base.safety || {}).forEach((c) => { c.done = false; });
    }
    return { exists: false, today: today(), fromLast: last ? last.date : '', permit: { status: 'NEW', date: today(), company: b.company, trade: jv.trade, data: base } };
  }
  API.getPermit = async (a, jobId, date) => {
    const b = await execVendor(a), { j, jv } = await vendorJobOf(a, b, jobId);
    return permitPack(a, b, j, jv, isDate(date) ? date : today());
  };
  /** [업체] 발행 (매일 1회) → 바로 작업 가능 · 도급인에게 승인 요청 메일(중계 서버, 기다리지 않음) */
  API.issuePermit = async (a, jobId, data, crew) => {
    const b = await execVendor(a), { j, jv } = await vendorJobOf(a, b, jobId, true), d = permitClean(data || {}) || {}, bad = permitCheck(d);
    if (bad.length) fail('발행 전에 확인해 주세요:\n- ' + bad.join('\n- '));
    const raw = JSON.stringify(d); if (raw.length > 30000) fail('허가서 내용이 너무 깁니다.');
    const t = today(), id = j.id + '_' + b.id + '_' + t;
    if ((await mineOf('PERMITS', a, j.id)).some((x) => x.id === id)) fail('오늘 허가서는 이미 발행했습니다. 연장 작업은 허가서의 [작업허가 연장]에 적어 주세요.');
    await crewWith(a, b, j, crew);  // F1.8a 오늘 인원(수칙 서명)도 같이 저장
    const seq = Math.max(0, (j.vendorUids || []).indexOf(a.uid)) + 1;  // 같은 공사·같은 날 업체마다 다른 번호
    const no = j.id.replace('JOB-', '') + '-' + t.replace(/-/g, '').slice(2) + '-' + ('0' + seq).slice(-2);
    await db.collection('PERMITS').doc(id).set({ id, no, jobId: j.id, companyId: b.id, company: b.company, vendorUid: a.uid, date: t, data: raw, progress: '{}', status: 'ISSUED',
      issuedBy: a.email, issuedAt: now(), updatedAt: now(), approvedBy: '', approvedAt: '', approveNote: '' });
    audit(a, b.id, 'PERMIT_ISSUE', no + ' ' + j.id);
    relay('permitMail', { permitId: id }).catch(() => {});
    return permitPack(a, b, j, jv, t);
  };
  async function myPermit(a, b, permitId) {
    const p = docs(await db.collection('PERMITS').where('vendorUid', '==', a.uid).get()).find((x) => x.id === tidy(permitId, 80) && x.companyId === b.id);
    if (!p) fail('허가서를 찾을 수 없습니다.'); return p;
  }
  /** [업체] 발행 후 진행 기록 (가스농도 측정·작업중 확인·작업완료·연장만) — 승인 후에도 가능 */
  API.updatePermitProgress = async (a, permitId, prog) => {
    const b = await execVendor(a), p = await myPermit(a, b, permitId), x = permitClean(prog || {}) || {}, pr = parse(p.progress, {});
    PERMIT_PROGRESS_KEYS.forEach((k) => { if (x[k] !== undefined) pr[k] = x[k]; });
    await db.collection('PERMITS').doc(p.id).update({ progress: JSON.stringify(pr), updatedAt: now() }); audit(a, b.id, 'PERMIT_PROGRESS', p.no);
    return API.getPermit(a, p.jobId, p.date);
  };
  /** [업체] 승인 전 수정 (허가번호 유지) */
  API.editPermit = async (a, permitId, data) => {
    const b = await execVendor(a), d = permitClean(data || {}) || {}, bad = permitCheck(d);
    if (bad.length) fail('수정 제출 전에 확인해 주세요:\n- ' + bad.join('\n- '));
    const raw = JSON.stringify(d); if (raw.length > 30000) fail('허가서 내용이 너무 깁니다.');
    const p = await myPermit(a, b, permitId); if (p.status === 'APPROVED') fail('도급인이 이미 승인한 허가서는 고칠 수 없습니다.');
    await vendorJobOf(a, b, p.jobId, true);
    await db.collection('PERMITS').doc(p.id).update({ data: raw, progress: '{}', updatedAt: now() }); audit(a, b.id, 'PERMIT_EDIT', p.no);
    return API.getPermit(a, p.jobId, p.date);
  };
  /** [업체] 제출 취소 = 삭제 (승인 전까지만 · 이력은 접근및작업이력에) */
  API.withdrawPermit = async (a, permitId) => {
    const b = await execVendor(a), p = await myPermit(a, b, permitId); if (p.status === 'APPROVED') fail('도급인이 이미 승인한 허가서는 취소할 수 없습니다.');
    await vendorJobOf(a, b, p.jobId, true);
    await db.collection('PERMITS').doc(p.id).delete(); audit(a, b.id, 'PERMIT_WITHDRAW', p.no + ' ' + p.date);
    return API.vendorJob(a, p.jobId);
  };
  /* 직원: 공사별 허가서 · 보기 · 승인 */
  async function staffJob(a, s, jobId) { const js = await db.collection('JOBS').doc(tidy(jobId, 40)).get().catch(() => null), j = js && js.exists ? js.data() : null; if (!canSeeJob(a, s, j)) fail('권한이 없는 공사입니다.'); return j; }
  API.permitList = async (a, jobId) => {
    const s = await staffOnly(a), j = await staffJob(a, s, jobId);
    const list = docs(await db.collection('PERMITS').where('jobId', '==', j.id).get()).sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : (x.company < y.company ? -1 : 1)));
    return { job: { id: j.id, title: j.title, storeName: j.storeName }, list: list.map(permitSummary) };
  };
  async function permitOf(a, s, id) {
    const ps = await db.collection('PERMITS').doc(tidy(id, 80)).get().catch(() => null); if (!ps || !ps.exists) fail('허가서를 찾을 수 없거나 권한이 없습니다.');
    const p = ps.data(), j = await staffJob(a, s, p.jobId).catch(() => fail('허가서를 찾을 수 없거나 권한이 없습니다.')); return { p, j };
  }
  const approverOf = (s) => ({ dept: s.dept || '아성다이소', title: STAFF_ROLES[s.role] || '', name: s.name });
  API.permitDetail = async (a, id) => { const s = await staffOnly(a), { p, j } = await permitOf(a, s, id); return { ...permitFull(p), job: { id: j.id, title: j.title, storeName: j.storeName }, approver: approverOf(s) }; };
  /** [직원] 승인 (승인자 부서·직책·성명 = 로그인한 직원) */
  API.approvePermit = async (a, id, note) => {
    const s = await staffOnly(a), { p } = await permitOf(a, s, id); if (p.status === 'APPROVED') fail('이미 승인된 허가서입니다.');
    const ap = approverOf(s);
    await db.collection('PERMITS').doc(p.id).update({ status: 'APPROVED', approvedBy: ap.dept + ' / ' + ap.title + ' / ' + ap.name, approvedAt: now(), approveNote: tidy(note, 300) });
    audit(a, p.companyId, 'PERMIT_APPROVE', p.no);
    return API.permitDetail(a, id);
  };
  /** [직원] 선택·일괄 승인 (승인 대기만 · '일괄 승인'으로 기록) */
  API.approvePermits = async (a, jobId, ids, note) => {
    const s = await staffOnly(a), j = await staffJob(a, s, jobId), pick = Array.isArray(ids) && ids.length ? new Set(ids.map(String)) : null, ap = approverOf(s);
    const ps = docs(await db.collection('PERMITS').where('jobId', '==', j.id).get()).filter((p) => p.status === 'ISSUED' && (!pick || pick.has(p.id)));
    for (let i = 0; i < ps.length; i += 400) {
      const b = db.batch();
      ps.slice(i, i + 400).forEach((p) => b.update(db.collection('PERMITS').doc(p.id), { status: 'APPROVED', approvedBy: ap.dept + ' / ' + ap.title + ' / ' + ap.name, approvedAt: now(), approveNote: tidy(note, 300) || '일괄 승인' }));
      await b.commit();
    }
    audit(a, '', 'PERMIT_APPROVE_BULK', j.id + ' ' + ps.length + '건');
    return API.permitList(a, jobId);
  };

  /* ---------- F1.5 순회점검일지 (2일 1회) ----------
   *  업체가 점검: TBM 사진 + 11항목(양호/불량/해당없음) · 불량 = 지적사항(사진·메모) → 조치될 때까지 남음
   *  지적사항 조치: 업체·도급인 누구나 (조치 내용·조치일·조치 후 사진) · 도급인이 일지를 [확인]
   *  INSPECTIONS/{공사ID_업체ID_날짜} (하루 1장) · FINDINGS/{FD-…} · 사진은 구글 드라이브(중계 서버) */
  const photoIds = (v, max) => (Array.isArray(v) ? v : []).map((x) => tidy(x, 60)).filter((x) => /^[A-Za-z0-9-]+$/.test(x)).slice(0, max || 5);
  const inspView = (x) => ({ id: x.id, date: x.date, company: x.company, companyId: x.companyId, items: x.items || {}, labels: inspLabels(x), drill: drillOf(x), tbm: photoIds(x.tbm, 5), submittedName: x.submittedName, submittedAt: x.submittedAt,
    checkedBy: x.checkedBy || '', checkedAt: x.checkedAt || '', bad: Object.values(x.items || {}).filter((v) => v === 'BAD').length });
  const findView = (f) => ({ id: f.id, inspId: f.inspId, company: f.company, companyId: f.companyId, no: Number(f.no), item: f.item, memo: f.memo, before: photoIds(f.before), foundDate: f.foundDate, status: f.status,
    actionMemo: f.actionMemo || '', after: photoIds(f.after), actionDate: f.actionDate || '', actionBy: f.actionBy || '', actionAt: f.actionAt || '' });
  /** 업체 화면용 요약: 마지막 점검일 · 2일 경과 여부 · 미조치 지적사항 · 최근 기록 */
  function inspPack(ins, fs, items) {
    const t = today(); ins = ins.slice().sort((p, q) => (p.date < q.date ? 1 : -1)); const last = ins[0] ? ins[0].date : '';
    return { items: items || INSP_ITEMS, type: '순회점검일지', last, todayDone: last === t, due: !last || daysBetween(last, t) >= 2, since: last ? daysBetween(last, t) : null,
      open: fs.filter((f) => f.status !== 'DONE').map(findView), recent: ins.slice(0, 30).map(inspView) };
  }
  const isPhoto = (f) => /^image\/(jpeg|png)$/.test(String(f && f.mime || ''));
  /** [업체] 사진 올리기 (TBM·불량·조치 후 공용) → 문서ID */
  API.uploadInspPhoto = async (a, jobId, f) => { if (!isPhoto(f)) fail('사진(JPG·PNG)만 올릴 수 있습니다.'); return relay('inspPhoto', { jobId: tidy(jobId, 40), f }); };
  /** [직원] 조치 후 사진 올리기 */
  API.uploadInspPhotoStaff = async (a, jobId, companyId, f) => { if (!isPhoto(f)) fail('사진(JPG·PNG)만 올릴 수 있습니다.'); return relay('inspPhoto', { jobId: tidy(jobId, 40), companyId: tidy(companyId, 40), f }); };
  /** 점검 사진 보기 — 화면이 한꺼번에 부르면 8장씩 묶어 중계 서버에 한 번만 요청 (사진마다 왕복하지 않음) */
  const PQ = {};
  API.getInspPhoto = (a, jobId, docId) => new Promise((res, rej) => {
    const jid = tidy(jobId, 40), q = PQ[jid] = PQ[jid] || { list: [], t: null };
    q.list.push({ id: tidy(docId, 60), res, rej });
    if (!q.t) q.t = setTimeout(async () => {
      delete PQ[jid];
      for (let i = 0; i < q.list.length; i += 8) {
        const part = q.list.slice(i, i + 8);
        try { const r = await relay('inspPhotos', { jobId: jid, ids: [...new Set(part.map((x) => x.id))] }, true); part.forEach((x) => (r && r[x.id] ? x.res(r[x.id]) : x.rej(Error('사진을 찾을 수 없습니다.')))); }
        catch (e) { part.forEach((x) => x.rej(e)); }
      }
    }, 40);
  });
  /** [업체] 순회점검 제출 (하루 1회) · 불량 항목 → 지적사항 */
  API.submitInspection = async (a, jobId, d) => {
    const b = await execVendor(a), { j } = await vendorJobOf(a, b, jobId, true), t = today();
    const tbm = photoIds(d?.tbm, 5); if (!tbm.length) fail('TBM 실시 사진을 1장 이상 올려 주세요.');
    const LB = await inspItemsOf(a, b), items = {}, bad = [];  // F1.8a 계획서 위험작업에 맞춘 점검표
    LB.forEach((_, i) => { const v = String((d?.items || {})[i + 1] || ''); if (!['OK', 'BAD', 'NA'].includes(v)) bad.push((i + 1) + '번 결과'); items[i + 1] = v; });
    LB.forEach((_, i) => { if (items[i + 1] === 'BAD' && !tidy(((d?.notes || {})[i + 1] || {}).memo, 500)) bad.push((i + 1) + '번 지적 내용'); });
    const name = tidy(d?.name, 40); if (!name) bad.push('점검자 이름');
    const dp = photoIds(d?.drill?.photos, 5), dt = String(d?.drill?.type || '');  // F1.8b 교육·훈련 (선택)
    if (dp.length && !DRILL_TYPES[dt]) bad.push('교육·훈련 종류'); if (DRILL_TYPES[dt] && !dp.length) bad.push('교육·훈련 사진');
    if (bad.length) fail('제출 전에 확인해 주세요:\n- ' + bad.join('\n- '));
    const drill = dp.length ? { type: dt, photos: dp } : null;
    const id = j.id + '_' + b.id + '_' + t;
    if ((await mineOf('INSPECTIONS', a, j.id)).some((x) => x.id === id)) fail('오늘 이행점검은 이미 제출했습니다.');
    await crewWith(a, b, j, d?.crew);  // F1.8a 오늘 인원(수칙 서명)도 같이 저장
    const B = db.batch(), at = now();
    B.set(db.collection('INSPECTIONS').doc(id), { id, jobId: j.id, companyId: b.id, company: b.company, vendorUid: a.uid, date: t, tbm, items, labels: LB, ...(drill ? { drill } : {}), submittedBy: a.email, submittedName: name, submittedAt: at, checkedBy: '', checkedAt: '' });
    LB.forEach((it, i) => {
      const n = i + 1; if (items[n] !== 'BAD') return; const nt = (d.notes || {})[n] || {}, fid = 'FD-' + rand8();
      B.set(db.collection('FINDINGS').doc(fid), { id: fid, inspId: id, jobId: j.id, companyId: b.id, company: b.company, vendorUid: a.uid, no: n, item: it, memo: tidy(nt.memo, 500), before: photoIds(nt.photos, 5),
        foundDate: t, status: 'OPEN', actionMemo: '', after: [], actionDate: '', actionBy: '', actionAt: '' });
    });
    await B.commit(); audit(a, b.id, 'INSP_SUBMIT', id);
    return API.vendorJob(a, jobId);
  };
  /** [업체·직원] 지적사항 조치 등록 (조치일은 지적일 ~ 오늘) — 종료된 공사도 가능 */
  API.resolveFinding = async (a, findingId, d) => {
    const st = await staffOf(a), fid = tidy(findingId, 40); let f, who;
    if (st) {
      const s = await db.collection('FINDINGS').doc(fid).get().catch(() => null); f = s && s.exists ? s.data() : null; if (!f) fail('지적사항을 찾을 수 없습니다.');
      await staffJob(a, st, f.jobId).catch(() => fail('권한이 없습니다.')); who = '도급인 ' + st.name;
    } else {
      const b = await execVendor(a); f = docs(await db.collection('FINDINGS').where('vendorUid', '==', a.uid).get()).find((x) => x.id === fid && x.companyId === b.id);
      if (!f) fail('지적사항을 찾을 수 없습니다.'); who = b.company + ' ' + tidy(d?.name, 40);
    }
    if (f.status === 'DONE') fail('이미 조치 완료된 지적사항입니다.');
    const memo = tidy(d?.memo, 500), date = tidy(d?.date, 10), after = photoIds(d?.photos, 5), t = today(), bad = [];
    if (!memo) bad.push('조치 내용'); if (!isDate(date)) bad.push('조치일'); else if (date < f.foundDate || date > t) bad.push('조치일 (' + f.foundDate + ' ~ ' + t + ' 사이)'); if (!after.length) bad.push('조치 후 사진');
    if (bad.length) fail('다음 항목을 확인해 주세요:\n- ' + bad.join('\n- '));
    await db.collection('FINDINGS').doc(f.id).update({ status: 'DONE', actionMemo: memo, after, actionDate: date, actionBy: who, actionAt: now() });
    audit(a, f.companyId, 'FINDING_DONE', f.id);
    return st ? API.inspList(a, f.jobId) : API.vendorJob(a, f.jobId);
  };
  /** [업체] 내 지적사항 전체 (조치 완료 포함 · 일지 보기용) */
  API.inspMine = async (a, jobId) => { const b = await execVendor(a), { j } = await vendorJobOf(a, b, jobId); return (await mineOf('FINDINGS', a, j.id)).filter((f) => f.companyId === b.id).map(findView); };
  /** [직원] 공사별 순회점검일지 + 지적사항 */
  API.inspList = async (a, jobId) => {
    const s = await staffOnly(a), j = await staffJob(a, s, jobId), t = today();
    const [vs, ins, fs] = await Promise.all(['JOB_VENDORS', 'INSPECTIONS', 'FINDINGS'].map((n) => db.collection(n).where('jobId', '==', j.id).get().then(docs)));
    return { job: { id: j.id, title: j.title, storeName: j.storeName }, items: INSP_ITEMS, type: '순회점검일지',
      vendors: vs.map((v) => { const l = ins.filter((x) => x.companyId === v.companyId).map((x) => x.date).sort().pop() || ''; return { companyId: v.companyId, company: v.company, trade: v.trade, last: l, since: l ? daysBetween(l, t) : null }; }),
      list: ins.sort((p, q) => (p.date < q.date ? 1 : p.date > q.date ? -1 : 0)).map(inspView), findings: fs.sort((p, q) => (p.foundDate < q.foundDate ? 1 : -1)).map(findView) };
  };
  /** [직원] 확인 (선택한 것 또는 확인 안 된 전체) → "도급인 확인: 부서 이름·일시" */
  API.checkInspections = async (a, jobId, ids) => {
    const s = await staffOnly(a), j = await staffJob(a, s, jobId), pick = Array.isArray(ids) && ids.length ? new Set(ids.map(String)) : null;
    const xs = docs(await db.collection('INSPECTIONS').where('jobId', '==', j.id).get()).filter((x) => !x.checkedAt && (!pick || pick.has(x.id)));
    for (let i = 0; i < xs.length; i += 400) { const B = db.batch(); xs.slice(i, i + 400).forEach((x) => B.update(db.collection('INSPECTIONS').doc(x.id), { checkedBy: (s.dept || '아성다이소') + ' ' + s.name, checkedAt: now() })); await B.commit(); }
    audit(a, '', 'INSP_CHECK', j.id + ' ' + xs.length + '건');
    return API.inspList(a, jobId);
  };

  /* ---------- F1.6 현장 미팅 (안전보건협의체 회의 · 합동안전보건점검) ----------
   *  MEETINGS/{MT-…}       미팅 방 · 점검표(joint) · 회의록(minutes) — 직원(안전보건팀·공사 주관자)만
   *  MEET_LINKS/{QR값}      QR로 들어온 사람이 보는 안내(방 열림 여부·참여 업체) — QR 값을 아는 사람만 열람
   *  ATTEND/{미팅ID_계정}   참석 체크 = 본인 계정으로 Firestore에 바로 (여러 명이 동시에 찍어도 빠름)
   *     직원·배정 업체 대표 계정 → 바로 참석 / 그 외 → 확인 대기(도급인이 확인)  ※ 보안 규칙이 다시 확인
   *  사진(합동점검 불량)은 구글 드라이브(중계 서버) */
  const ATTEND_ROLES = ['관리자', '근로자'];
  const meetLink = (token) => location.origin + location.pathname + '?review=MEET-' + token;
  /** 심의결과 자동: 합동점검 불량 항목 → 지적사례, 없으면 '특이사항 없음' */
  function councilResults(joint) {
    const bad = Object.entries((joint && joint.items) || {}).filter(([, v]) => v === 'BAD').map(([n]) => Number(n)).sort((p, q) => p - q);
    if (!bad.length) return ['합동안전보건점검 결과 특이사항 없음 (종결)'];
    return bad.map((n) => '[합동점검 지적] ' + n + '. ' + JOINT_ITEMS[n - 1][1] + ' → 불량' + ((((joint.notes || {})[n]) || {}).memo ? ': ' + joint.notes[n].memo : ''));
  }
  /** 화면에서 받은 점검표·회의록 정리 (불량 항목은 메모·사진 / 발의·심의는 자동) */
  function meetDocs(d) {
    const ji = (d && d.joint) || {}, items = {}, notes = {};
    for (let i = 1; i <= JOINT_ITEMS.length; i++) {
      const v = String((ji.items || {})[i] || ''); if (JOINT_MARKS.includes(v)) items[i] = v;
      const nt = (ji.notes || {})[i]; if (v === 'BAD' && nt) notes[i] = { memo: tidy(nt.memo, 500), photos: photoIds(nt.photos, 5) };
    }
    const opinions = {};
    Object.entries(ji.opinions || {}).slice(0, 15).forEach(([cid, o]) => { const k = tidy(cid, 40); if (/^[A-Za-z0-9-]+$/.test(k)) opinions[k] = { company: tidy(o && o.company, 80), text: tidy(o && o.text, 600) }; });
    const mi = (d && d.minutes) || {}, joint = { items, notes, opinions };
    return { joint, minutes: { type: mi.type === '정기' ? '정기' : '임시', start: tidy(mi.start, 5), end: tidy(mi.end, 5), proposals: COUNCIL_AGENDA.join('\n'), results: councilResults(joint).join('\n'), etc: tidy(mi.etc, 1000) } };
  }
  const meetSummary = (m, at) => {
    const mine = at.filter((x) => x.meetingId === m.id);
    return { id: m.id, title: m.title, date: m.date, time: m.time, place: m.place, kinds: m.kinds || [], open: m.open === 'Y', done: !!m.doneAt, doneAt: m.doneAt || '',
      count: mine.filter((x) => x.status === 'OK').length, pending: mine.filter((x) => x.status === 'PENDING').length };
  };
  async function meetingOf(a, s, id) {
    const ms = await db.collection('MEETINGS').doc(tidy(id, 40)).get().catch(() => null), m = ms && ms.exists ? ms.data() : null;
    if (!m) fail('미팅을 찾을 수 없거나 권한이 없습니다.');
    const j = await staffJob(a, s, m.jobId).catch(() => fail('미팅을 찾을 수 없거나 권한이 없습니다.'));
    return { m, j };
  }
  const jobVendorsOf = async (jobId) => docs(await db.collection('JOB_VENDORS').where('jobId', '==', jobId).get()).map((v) => ({ companyId: v.companyId, company: v.company, trade: v.trade }));
  /** F1.8f 협력업체 메인 화면 📢 알림용 미팅 요약 (QR 값은 넣지 않음 → 현장 QR로만 참석)
   *  MEET_NOTICES/{미팅ID} · v = 공사에 배정된 업체 계정 {uid:true} · 만들기·방 열기·실시 완료·완료 취소 때 새로 씀 · 실패해도 미팅 기능은 그대로 */
  const meetNotice = (m, store, done) => db.collection('JOB_VENDORS').where('jobId', '==', m.jobId).get().then(docs).then((vs) => {
    const v = {}; vs.forEach((x) => { if (x.vendorUid) v[x.vendorUid] = true; });
    return db.collection('MEET_NOTICES').doc(m.id).set({ id: m.id, jobId: m.jobId, title: m.title, store: store || '', date: m.date, time: m.time || '', place: m.place || '', kinds: m.kinds || [], done: done ? 'Y' : 'N', v, at: now() });
  }).catch((e) => console.warn('미팅 알림 저장 실패 (firestore.rules 확인)', e && e.message));
  /** [직원] 미팅 방 화면 (QR·참석자·점검표·회의록) */
  API.meetingDetail = async (a, id) => {
    const s = await staffOnly(a), { m, j } = await meetingOf(a, s, id);
    const [vs, at] = await Promise.all([jobVendorsOf(j.id), db.collection('ATTEND').where('meetingId', '==', m.id).get().then(docs)]);
    return { id: m.id, title: m.title, date: m.date, time: m.time, place: m.place, kinds: (m.kinds || []).map((k) => MEET_KINDS[k]), kindCodes: m.kinds || [], open: m.open === 'Y', link: meetLink(m.token),
      joint: m.joint || null, minutes: m.minutes || null, done: !!m.doneAt, doneAt: m.doneAt || '', doneBy: m.doneBy || '', jointItems: JOINT_ITEMS, agenda: COUNCIL_AGENDA,
      job: { id: j.id, title: j.title, storeName: j.storeName }, vendors: vs,
      attendees: at.filter((x) => x.status !== 'REJECTED').sort((x, y) => String(x.checkedAt).localeCompare(String(y.checkedAt)))
        .map((x) => ({ id: x.id, name: x.name, side: x.side, companyId: x.companyId, company: x.company, role: x.role, status: x.status, email: x.email, checkedAt: x.checkedAt })) };
  };
  /** [직원] 미팅 방 만들기 → 참여 업체 대표 계정에 안내 메일 (중계 서버 · 기다리지 않음) */
  API.createMeeting = async (a, jobId, d) => {
    const s = await staffOnly(a), j = await staffJob(a, s, jobId);
    const kinds = ((d && d.kinds) || []).filter((k) => MEET_KINDS[k]); if (!kinds.length) fail('포함할 행사를 하나 이상 선택해 주세요.');
    const date = tidy(d && d.date, 10); if (!isDate(date)) fail('미팅 일자를 입력해 주세요.');
    const id = await meetMake(a, j, { title: tidy(d.title, 80) || '임시 미팅', date, place: tidy(d.place, 120), kinds });
    return API.meetingDetail(a, id);
  };
  /** 미팅 만들기 공통 (시간 없이 날짜만) · key가 있으면 문서 ID = MT-공사ID-key → 같은 자동 미팅은 한 번만 */
  async function meetMake(a, j, d) {
    const id = d.key ? 'MT-' + j.id + '-' + d.key : 'MT-' + rand8();
    if (d.key) { const ex = await db.collection('MEETINGS').doc(id).get().catch(() => null); if (ex && ex.exists) return null; }
    const token = newToken(), vs = await jobVendorsOf(j.id);
    const m = { id, jobId: j.id, title: d.title || '현장 미팅', date: d.date, time: '', place: d.place || j.storeName, kinds: d.kinds, token, open: 'N', openedAt: '', closedAt: '',
      createdBy: a.email, createdAt: now(), joint: null, minutes: null, doneAt: '', doneBy: '', auto: d.key || '' };
    const B = db.batch();
    B.set(db.collection('MEETINGS').doc(id), m);
    B.set(db.collection('MEET_LINKS').doc(token), { token, meetingId: id, jobId: j.id, title: m.title, store: j.storeName, date: m.date, place: m.place, open: 'N', vendors: vs });
    await B.commit(); audit(a, '', d.key ? 'MEETING_AUTO' : 'MEETING_ADD', id + ' ' + j.id + ' ' + m.date);
    await meetNotice(m, j.storeName, false);
    relay('meetMail', { meetingId: id }).catch(() => {});
    return id;
  }
  /* ---------- F1.8l 미팅 자동 생성 ----------
   *  착수 미팅(협의체 + 합동점검) = 공사 시작일 (이미 지났으면 오늘) · 미팅이 하나도 없는 진행 중 공사에 한 번
   *  법정 주기: 협의체 매월 · 합동점검 분기마다 1회 — 그 기간에 같은 종류 미팅이 없으면 오늘 날짜로 추가
   *  (공사를 시작한 달·분기는 착수 전에 한 미팅도 인정 → 30일 안쪽 공사는 착수 미팅 1번으로 끝)
   *  공사 관리 화면을 열 때(공사 저장 포함) 실행 · 그 공사를 맡은 직원·안전보건팀만 */
  const lastDayOf = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10), pad2 = (n) => String(n).padStart(2, '0');
  function lawNeed(j, t, M) {
    const y = +t.slice(0, 4), mo = +t.slice(5, 7), qm = Math.floor((mo - 1) / 3) * 3 + 1, out = [];
    if (j.status === 'ENDED' || j.startDate > lastDayOf(y, mo)) return out;
    const chk = (kind, ps, pe) => { if (!(j.startDate <= pe && (!j.endDate || j.endDate >= ps))) return;
      const has = M.some((m) => (m.kinds || []).includes(kind) && m.date >= ps && m.date <= pe) || (j.startDate >= ps && j.startDate <= pe && M.some((m) => (m.kinds || []).includes(kind) && m.date <= pe));
      if (!has) out.push(kind); };
    chk('COUNCIL', y + '-' + pad2(mo) + '-01', lastDayOf(y, mo)); chk('JOINT', y + '-' + pad2(qm) + '-01', lastDayOf(y, qm + 2));
    return out;
  }
  async function autoMeetings(a, s, jobs, mts) {
    const t = today(); let n = 0;
    for (const j of jobs) {
      if (j.status === 'ENDED' || !canSeeJob(a, s, j) || !isDate(j.startDate)) continue;
      const M = mts.filter((m) => m.jobId === j.id);
      try {
        if (!M.length) { if (await meetMake(a, j, { key: 'START', title: '착수 미팅', date: j.startDate >= t ? j.startDate : t, kinds: ['COUNCIL', 'JOINT'] })) n++; continue; }
        const need = lawNeed(j, t, M); if (!need.length) continue;
        const label = (need.includes('COUNCIL') ? Number(t.slice(5, 7)) + '월 협의체' : '') + (need.length > 1 ? ' + ' : '') + (need.includes('JOINT') ? Math.ceil(Number(t.slice(5, 7)) / 3) + '분기 합동점검' : '');
        if (await meetMake(a, j, { key: t.slice(0, 7).replace('-', ''), title: label, date: t, kinds: need })) n++;
      } catch (e) { console.warn('미팅 자동 생성 실패 ' + j.id, e && e.message); }
    }
    return n;
  }
  /** [직원] 미팅 날짜만 바꾸기 (실시 전 · 방 열기 전) */
  API.setMeetingDate = async (a, id, date) => {
    const s = await staffOnly(a), { m, j } = await meetingOf(a, s, id); date = tidy(date, 10);
    if (!isDate(date)) fail('날짜를 골라 주세요.'); if (m.doneAt) fail('실시 완료된 미팅입니다.'); if (m.open === 'Y') fail('진행 중인 미팅은 날짜를 바꿀 수 없습니다.');
    const B = db.batch(); B.update(db.collection('MEETINGS').doc(m.id), { date }); B.update(db.collection('MEET_LINKS').doc(m.token), { date });
    await B.commit(); audit(a, '', 'MEETING_DATE', m.id + ' ' + m.date + '→' + date);
    await meetNotice({ ...m, date }, j.storeName, false);
    return API.jobBoard(a);
  };
  /** [직원] 방 열기·닫기 — 열려 있는 동안만 참석 체크 (열 때 참여 업체 목록도 새로) */
  API.setMeetingOpen = async (a, id, open) => {
    const s = await staffOnly(a), { m, j } = await meetingOf(a, s, id);
    if (open && m.doneAt) fail('실시 완료된 미팅은 방을 다시 열 수 없습니다.');
    const B = db.batch(), vs = await jobVendorsOf(j.id);
    B.update(db.collection('MEETINGS').doc(m.id), open ? { open: 'Y', openedAt: now() } : { open: 'N', closedAt: now() });
    B.update(db.collection('MEET_LINKS').doc(m.token), { open: open ? 'Y' : 'N', vendors: vs });
    await B.commit(); audit(a, '', open ? 'MEETING_OPEN' : 'MEETING_CLOSE', m.id);
    /* F1.8m [▶ 미팅 시작]을 누른 도급인 담당자는 QR 없이 바로 참석으로 (방이 열린 뒤에 써야 보안 규칙 통과) */
    if (open) await staffSelfIn(a, s, m, j);
    await meetNotice(m, j.storeName, !!m.doneAt);  // 그 사이 배정된 업체도 알림을 받도록 다시 씀
    return API.meetingDetail(a, id);
  };
  /** F1.8m 미팅을 연(들어간) 도급인 담당자 → 참석 기록 (이미 있으면 그대로) */
  async function staffSelfIn(a, s, m, j) {
    const aid = m.id + '_' + a.uid, ex = await db.collection('ATTEND').doc(aid).get().catch(() => null);
    if (ex && ex.exists && ex.data().status !== 'REJECTED') return;
    await db.collection('ATTEND').doc(aid).set({ id: aid, meetingId: m.id, jobId: j.id, token: m.token, email: a.email, uid: a.uid, checkedAt: now(), confirmedBy: '', confirmedAt: '',
      name: s.name, side: 'STAFF', companyId: '', company: '아성다이소', role: '도급인(' + (STAFF_ROLES[s.role] || s.role) + ')', status: 'OK', auto: 'Y' }).catch((e) => console.warn('담당자 자동 참석 실패', e && e.message));
  }
  /** [직원] 이미 열린 미팅에 들어갈 때도 담당자 자동 참석 */
  API.meetJoin = async (a, id) => { const s = await staffOnly(a), { m, j } = await meetingOf(a, s, id); if (m.open === 'Y' && !m.doneAt) await staffSelfIn(a, s, m, j); return API.meetingDetail(a, id); };
  /** [직원] 확인 대기 참석자 확인/제외 */
  API.confirmAttendee = async (a, meetingId, attendId, okk) => {
    const s = await staffOnly(a), { m } = await meetingOf(a, s, meetingId);
    const x = docs(await db.collection('ATTEND').where('meetingId', '==', m.id).get()).find((r) => r.id === tidy(attendId, 80)); if (!x) fail('참석 기록을 찾을 수 없습니다.');
    await db.collection('ATTEND').doc(x.id).update({ status: okk ? 'OK' : 'REJECTED', confirmedBy: s.name + ' ' + a.email, confirmedAt: now() });
    audit(a, x.companyId, okk ? 'ATTEND_CONFIRM' : 'ATTEND_REJECT', m.id + ' ' + x.email);
    return API.meetingDetail(a, meetingId);
  };
  /** [직원] 미팅 방 삭제 (참석 기록 포함) */
  API.deleteMeeting = async (a, meetingId) => {
    const s = await staffOnly(a), { m } = await meetingOf(a, s, meetingId), at = await db.collection('ATTEND').where('meetingId', '==', m.id).get();
    const B = db.batch(); at.docs.forEach((d) => B.delete(d.ref)); B.delete(db.collection('MEET_LINKS').doc(m.token)); B.delete(db.collection('MEETINGS').doc(m.id));
    await B.commit(); audit(a, '', 'MEETING_DELETE', m.id + ' ' + m.jobId + ' 참석 ' + at.docs.length);
    await db.collection('MEET_NOTICES').doc(m.id).delete().catch(() => {});
    return API.jobBoard(a);
  };
  /** [직원] 점검표·회의록 임시 저장 */
  API.saveMeetingDocs = async (a, id, d) => {
    const s = await staffOnly(a), { m } = await meetingOf(a, s, id); if (m.doneAt) fail('실시 완료된 미팅입니다. 고치려면 [완료 취소]를 먼저 눌러 주세요.');
    const x = meetDocs(d); await db.collection('MEETINGS').doc(m.id).update({ joint: x.joint, minutes: x.minutes }); audit(a, '', 'MEETING_DOCS_SAVE', m.id);
    return API.meetingDetail(a, id);
  };
  /** [직원] 실시 완료: 협력업체 참석 · 확인 대기 없음 · 점검표 26항목 · 불량 메모 → 방 닫고 확정 */
  API.completeMeeting = async (a, id, d) => {
    const s = await staffOnly(a), { m, j } = await meetingOf(a, s, id); if (m.doneAt) fail('이미 실시 완료된 미팅입니다.');
    const kinds = m.kinds || [], x = meetDocs(d), bad = [], at = docs(await db.collection('ATTEND').where('meetingId', '==', m.id).get()), okk = at.filter((r) => r.status === 'OK');
    if (!okk.some((r) => r.side === 'VENDOR')) bad.push('참석한 협력업체가 없습니다 (QR 참석 체크 필요)');
    if (at.some((r) => r.status === 'PENDING')) bad.push('확인 대기 참석자가 있습니다 ([확인] 또는 [제외])');
    if (kinds.includes('JOINT')) {
      const none = [], noMemo = [];
      for (let i = 1; i <= JOINT_ITEMS.length; i++) { if (!x.joint.items[i]) none.push(i); if (x.joint.items[i] === 'BAD' && !((x.joint.notes[i] || {}).memo)) noMemo.push(i); }
      if (none.length) bad.push('합동점검 미체크 항목: ' + none.join(', ') + '번'); if (noMemo.length) bad.push('불량 항목 메모(지적 내용·조치)를 적어 주세요: ' + noMemo.join(', ') + '번');
    }
    if (bad.length) fail('실시 완료 전에 확인해 주세요:\n- ' + bad.join('\n- '));
    const B = db.batch();
    B.update(db.collection('MEETINGS').doc(m.id), { joint: x.joint, minutes: x.minutes, open: 'N', closedAt: m.closedAt || now(), doneAt: now(), doneBy: s.name + ' ' + a.email });
    B.update(db.collection('MEET_LINKS').doc(m.token), { open: 'N' });
    await B.commit(); audit(a, '', 'MEETING_DONE', m.id + ' 참석 ' + okk.length);
    await meetNotice(m, j.storeName, true);  // 실시 완료 → 업체 메인 화면 알림 사라짐
    return API.meetingDetail(a, id);
  };
  /** [직원] 실시 완료 취소 (내용 수정용) */
  API.reopenMeetingDocs = async (a, id) => {
    const s = await staffOnly(a), { m, j } = await meetingOf(a, s, id); if (!m.doneAt) fail('실시 완료 상태가 아닙니다.');
    await db.collection('MEETINGS').doc(m.id).update({ doneAt: '', doneBy: '' }); audit(a, '', 'MEETING_REOPEN', m.id);
    await meetNotice(m, j.storeName, false);
    return API.meetingDetail(a, id);
  };
  /** [직원] 합동점검 불량 항목 사진 → 문서ID (구글 드라이브) */
  API.uploadMeetingPhoto = async (a, meetingId, no, f) => {
    const n = Number(no); if (!(n >= 1 && n <= JOINT_ITEMS.length)) fail('점검 항목 번호가 올바르지 않습니다.'); if (!isPhoto(f)) fail('사진(JPG·PNG)만 올릴 수 있습니다.');
    return relay('meetPhoto', { meetingId: tidy(meetingId, 40), no: n, f });
  };
  /** [직원] 미팅 사진 보기 — 한꺼번에 부르면 8장씩 묶어 한 번만 요청 */
  const MQ = {};
  API.getMeetingPhoto = (a, meetingId, docId) => new Promise((res, rej) => {
    const mid = tidy(meetingId, 40), q = MQ[mid] = MQ[mid] || { list: [], t: null };
    q.list.push({ id: tidy(docId, 60), res, rej });
    if (!q.t) q.t = setTimeout(async () => {
      delete MQ[mid];
      for (let i = 0; i < q.list.length; i += 8) {
        const part = q.list.slice(i, i + 8);
        try { const r = await relay('meetPhotos', { meetingId: mid, ids: [...new Set(part.map((x) => x.id))] }, true); part.forEach((x) => (r && r[x.id] ? x.res(r[x.id]) : x.rej(Error('사진을 찾을 수 없습니다.')))); }
        catch (e) { part.forEach((x) => x.rej(e)); }
      }
    }, 40);
  });
  /** [로그인한 누구나] QR/링크로 참석 체크. info 없이 부르면 필요한 입력을 알려 줌 */
  API.meetCheckIn = async (a, token, info) => {
    token = String(token || '').toLowerCase(); if (!/^[a-f0-9]{32}$/.test(token)) fail('잘못된 참여 링크입니다.');
    const ls = await db.collection('MEET_LINKS').doc(token).get().catch(() => null); if (!ls || !ls.exists) fail('참여 링크를 찾을 수 없습니다.');
    const L = ls.data(), base = { meeting: L.title, store: L.store, date: L.date, place: L.place }, id = L.meetingId + '_' + a.uid;
    const done = (x) => ({ ...base, state: 'DONE', name: x.name, company: x.company, role: x.role, status: x.status, checkedAt: x.checkedAt });
    const mine = docs(await db.collection('ATTEND').where('uid', '==', a.uid).get()).find((x) => x.id === id && x.status !== 'REJECTED');
    if (mine) return done(mine);
    if (L.open !== 'Y') return { ...base, state: 'CLOSED' };
    const rec = async (o) => {
      const r = { id, meetingId: L.meetingId, jobId: L.jobId, token, email: a.email, uid: a.uid, checkedAt: now(), confirmedBy: '', confirmedAt: '', ...o };
      await db.collection('ATTEND').doc(id).set(r); audit(a, r.companyId, 'MEETING_CHECKIN', L.meetingId + ' ' + r.status);
      return done(r);
    };
    const st = await staffOf(a);
    if (st) return rec({ name: st.name, side: 'STAFF', companyId: '', company: '아성다이소', role: '도급인(' + (STAFF_ROLES[st.role] || st.role) + ')', status: 'OK' });
    const vs = L.vendors || [], cs = await myCompanies(a), own = cs.find((x) => x.status === 'VERIFIED') || null, assigned = own && vs.find((v) => v.companyId === own.id);
    if (!vs.length) return { ...base, state: 'NO_VENDOR' };
    /* F1.8j QR만 찍으면 바로 참석 (입력 없음)
     *  배정된 업체 대표 계정 → 업체명 + 현장대리인 이름(없으면 업체 담당자) · 관리자
     *  이 공사에 등록된 작업자 본인 계정 → 등록한 이름 · 업체 · 근로자 */
    if (!info && assigned) return rec({ name: (await siteManagerOf(a, own).catch(() => '')) || own.contact || own.representative || a.email, side: 'VENDOR', companyId: own.id, company: own.company, role: ATTEND_ROLES[0], status: 'OK' });
    if (!info) {
      const w = docs(await db.collection('WORKERS').where('uid', '==', a.uid).get().catch(() => ({ docs: [] }))).find((x) => x.jobId === L.jobId && x.active !== 'N' && vs.some((v) => v.companyId === x.companyId));
      if (w) return rec({ name: w.name, side: 'VENDOR', companyId: w.companyId, company: w.company || (vs.find((v) => v.companyId === w.companyId) || {}).company || '', role: ATTEND_ROLES[1], status: 'OK', workerId: w.id });
    }
    /* F1.8p 승인된 업체 계정도 아니고 이 공사 작업자도 아니면 참석 불가 → 사업자 등록 안내 (승인 대기 중이면 대기 안내) */
    if (!own) { const p = cs.find((x) => x.status === 'PENDING'); return { ...base, state: 'NO_COMPANY', pending: p ? p.company : '' }; }
    if (!info) return { ...base, state: 'NEED_INFO', known: assigned ? { companyId: own.id, company: own.company, name: own.contact } : null, myCompany: own && !assigned ? own.company : '', vendors: vs, roles: ATTEND_ROLES };
    const name = tidy(info.name, 40), role = ATTEND_ROLES.includes(info.role) ? info.role : '';
    if (!name || !role) fail('이름과 역할(관리자/근로자)을 입력해 주세요.');
    if (assigned) return rec({ name, side: 'VENDOR', companyId: own.id, company: own.company, role, status: 'OK' });
    const v = vs.find((x) => x.companyId === String(info.companyId || '')); if (!v) fail('소속 업체를 선택해 주세요.');
    return rec({ name, side: 'VENDOR', companyId: v.companyId, company: v.company, role, status: 'PENDING' });
  };

  /* ---------- F1.7 공사 연장 · 종료 · 종료 평가 ----------
   *  종료 예정 3일 전부터 알림 → [연장](새 종료일·사유, 이력) 또는 [종료]
   *  [종료] → 참여 업체마다 평가서(JOB_EVALS): 12항목을 수행 기록으로 자동 체크 → 담당자 확인·수정 → [평가 확정]
   *  확정 후 [전체 활동내역 ZIP] → 중계 서버가 결과지 PDF·단계별 기록을 만들어 드라이브에 보관 (처음 한 번 1~2분)
   *  참조 알림(연장·종료·평가 확정)은 중계 서버가 안전보건팀에 남김 */
  const notice = (type, text, jobId, companyId) => relay('notice', { type, text: tidy(text, 500), jobId: jobId || '', companyId: companyId || '' }).catch(() => {});
  /** 수행 기록 → 12항목 자동 체크 + 근거 (v5.27 jobEvalAuto_와 같은 기준) */
  async function jobEvalAuto(j, cid) {
    const by = (col) => db.collection(col).where('jobId', '==', j.id).get().then(docs).then((l) => l.filter((x) => x.companyId === cid));
    const [crew, pm, ins, fd, wk, evs] = await Promise.all([by('CREW'), by('PERMITS'), by('INSPECTIONS'), by('FINDINGS'), by('WORKERS'), db.collection('EVALUATIONS').where('companyId', '==', cid).get().then(docs).catch(() => [])]);
    const wd = new Set([].concat(crew.map((x) => x.date), pm.map((x) => x.date), ins.map((x) => x.date)).filter(Boolean)).size;
    const lvRate = (r) => (r >= EVAL_RULE.rateGood ? 'G' : r >= EVAL_RULE.rateNormal ? 'N' : 'P'), pct = (r) => Math.round(r * 100) + '%';
    const ev = evs.filter((x) => x.result === 'APPROVED').sort((p, q) => String(p.evaluatedAt).localeCompare(String(q.evaluatedAt))).pop(), pre = ev ? parse(ev.items, {}) : {}, o = {};
    [1, 2, 3, 4, 9, 10].forEach((n) => { o[n] = { lv: pre[n] || '', why: pre[n] ? '계약 전 평가 결과 (' + EVAL_LEVELS[pre[n]] + ') · 공사 중 이행 상태를 보고 판단' : '계약 전 평가 기록 없음 · 직접 판단', auto: !!pre[n] }; });
    if (!wd) [5, 7, 8].forEach((n) => { o[n] = { lv: '', why: '작업 기록 없음 · 직접 판단', auto: false }; });
    else {
      const need = Math.max(1, Math.ceil(wd / 2)), r5 = ins.length / need; o[5] = { lv: lvRate(r5), why: '순회점검 ' + ins.length + '회 / 필요 ' + need + '회 (작업일 ' + wd + '일 ÷ 2) = ' + pct(r5), auto: true };
      /* F1.8a 신규자 교육·작업 안전 수칙 서명은 등록 때 1회 → 등록 인원 기준 (F1.8b에서 이수증·교육훈련과 비교 예정) */
      /* F1.8b 등록한 작업자 중 기초안전보건교육 이수증을 낸 비율 (안 낸 사람 = 교육 없이 투입된 증빙) · 우수 90% 이상 · 보통 60% 이상 */
      const nc = wk.filter((w) => !w.certDoc), r7 = wk.length ? (wk.length - nc.length) / wk.length : 0;
      o[7] = wk.length ? { lv: lvRate(r7), why: '기초안전보건교육 이수증 ' + (wk.length - nc.length) + ' / 등록 ' + wk.length + '명 = ' + pct(r7) + (nc.length ? ' · 미제출: ' + nc.slice(0, 10).map((w) => w.name).join(', ') + (nc.length > 10 ? ' 외 ' + (nc.length - 10) + '명' : '') : ''), auto: true }
        : { lv: 'P', why: '등록한 작업자 없음 (신규자 교육·이수증 확인 기록 없음)', auto: true };
      const r8 = pm.length / wd, ap = pm.filter((x) => x.status === 'APPROVED').length; o[8] = { lv: lvRate(r8), why: '작업허가서 ' + pm.length + '일 / 작업일 ' + wd + '일 = ' + pct(r8) + ' · 도급인 승인 ' + ap + '건', auto: true };
    }
    const done = fd.filter((f) => f.status === 'DONE'), open = fd.length - done.length, avg = done.length ? done.reduce((s, f) => s + Math.max(0, daysBetween(f.foundDate, f.actionDate)), 0) / done.length : 0;
    o[6] = !fd.length ? { lv: 'G', why: '지적사항 없음', auto: true } : { lv: open ? 'P' : avg <= EVAL_RULE.fixDaysGood ? 'G' : 'N', why: '지적 ' + fd.length + '건 · 조치 ' + done.length + '건 · 미조치 ' + open + '건 · 평균 조치 ' + avg.toFixed(1) + '일', auto: true };
    /* F1.8b 비상대책: 순회점검 때 올린 비상대응훈련(대피·CPR·소화기) 기록 · 공사 중 1회 이상 = 우수 · 기타 교육만 = 보통 · 없음 = 미흡 */
    const dr = ins.map((x) => ({ date: x.date, d: drillOf(x) })).filter((x) => x.d), em = dr.filter((x) => DRILL_EMERGENCY.includes(x.d.type)), list = (l) => l.slice(0, 6).map((x) => x.date.slice(5) + ' ' + x.d.label).join(', ');
    o[11] = em.length ? { lv: 'G', why: '비상대응훈련 ' + em.length + '회 (' + list(em) + ')' + (dr.length > em.length ? ' · 기타 교육 ' + (dr.length - em.length) + '회' : ''), auto: true }
      : dr.length ? { lv: 'N', why: '비상대응훈련 기록 없음 · 기타 안전교육 ' + dr.length + '회 (' + list(dr) + ')', auto: true }
      : { lv: 'P', why: '비상대응훈련·교육 사진 기록 없음 (순회점검 때 올림)', auto: true };
    o[12] = { lv: '', why: '공사 중 사고 여부를 직접 입력 (무재해 = 우수)', auto: false };
    return { items: o, stats: { workDays: wd, crewDays: crew.length, permits: pm.length, inspections: ins.length, findings: fd.length, openFindings: open, workers: wk.length, from: j.startDate, to: (j.endedAt ? kst(j.endedAt) : '') || today() } };
  }
  function jobEvalView(e, fresh) {
    const items = parse(e.items, {}), au = fresh || parse(e.auto, {});
    return { id: e.id, jobId: e.jobId, companyId: e.companyId, company: e.company, status: e.status, items, auto: au, total: e.total === '' || e.total == null ? null : Number(e.total), grade: e.grade, comment: e.comment,
      evaluator: e.evaluator, evaluatedAt: e.evaluatedAt, hasFiles: !!(e.pdfId && e.zipId) };
  }
  async function jobEvalListOf(j, pre) {
    const list = docs(await db.collection('JOB_EVALS').where('jobId', '==', j.id).get()).sort((x, y) => String(x.createdAt).localeCompare(String(y.createdAt)));
    const fresh = await Promise.all(list.map((e) => (e.status === 'DRAFT' ? ((pre && pre[e.companyId]) || jobEvalAuto(j, e.companyId)) : null)));
    return { job: { id: j.id, title: j.title, storeName: j.storeName, startDate: j.startDate, endDate: j.endDate, endedAt: j.endedAt ? kst(j.endedAt) : '', endedBy: j.endedBy || '', extensions: j.extensions || [] },
      evalItems: EVAL_ITEMS, points: EVAL_POINTS, sections: EVAL_SECTIONS, list: list.map((e, i) => jobEvalView(e, fresh[i])) };
  }
  /** [직원] 공사 연장 (새 종료일 · 사유, 이력 남김) */
  API.extendJob = async (a, jobId, newEnd, reason) => {
    const s = await staffOnly(a), j = await staffJob(a, s, jobId); if (j.status === 'ENDED') fail('이미 종료된 공사입니다.');
    const ne = tidy(newEnd, 10), rs = tidy(reason, 200);
    if (!isDate(ne)) fail('새 종료일을 입력해 주세요.'); if (ne <= String(j.endDate || '') || ne < today()) fail('새 종료일은 기존 종료일·오늘보다 뒤여야 합니다.'); if (!rs) fail('연장 사유를 입력해 주세요.');
    const h = (j.extensions || []).concat([{ from: j.endDate || '', to: ne, reason: rs, by: s.name, at: now() }]);
    await db.collection('JOBS').doc(j.id).update({ endDate: ne, extensions: h }); audit(a, '', 'JOB_EXTEND', j.id + ' ' + j.endDate + '→' + ne);
    notice('JOB_EXTENDED', j.title + ' (' + j.storeName + ') 종료일 ' + (j.endDate || '-') + ' → ' + ne + ' · 사유: ' + rs + ' · ' + s.name, j.id, '');
    return API.jobBoard(a);
  };
  /** [직원] 공사 종료 → 참여 업체마다 종료 평가서 (수행 기록 자동 반영) */
  API.endJob = async (a, jobId) => {
    const s = await staffOnly(a), j = await staffJob(a, s, jobId); if (j.status === 'ENDED') fail('이미 종료된 공사입니다.');
    const [vs, had] = await Promise.all([db.collection('JOB_VENDORS').where('jobId', '==', j.id).get().then(docs), db.collection('JOB_EVALS').where('jobId', '==', j.id).get().then(docs)]);
    const at = now(), jj = { ...j, status: 'ENDED', endedAt: at, endedBy: s.name + ' ' + a.email }, pre = {}, B = db.batch();
    B.update(db.collection('JOBS').doc(j.id), { status: 'ENDED', endedAt: at, endedBy: jj.endedBy });
    for (const v of vs) {
      if (had.some((e) => e.companyId === v.companyId)) continue;
      const au = await jobEvalAuto(jj, v.companyId), items = {}, id = 'JE-' + rand8(); pre[v.companyId] = au;
      Object.entries(au.items).forEach(([n, x]) => { items[n] = { lv: x.lv, memo: '' }; });
      B.set(db.collection('JOB_EVALS').doc(id), { id, jobId: j.id, companyId: v.companyId, company: v.company, vendorUid: v.vendorUid || '', status: 'DRAFT', items: JSON.stringify(items), auto: JSON.stringify(au),
        total: '', grade: '', comment: '', evaluator: '', evaluatedAt: '', pdfId: '', zipId: '', createdAt: at });
    }
    await B.commit(); audit(a, '', 'JOB_END', j.id + ' 업체 ' + vs.length);
    notice('JOB_ENDED', j.title + ' (' + j.storeName + ') 공사 종료 · 참여 업체 ' + vs.length + '곳 종료 평가 시작 · ' + s.name, j.id, '');
    return jobEvalListOf(jj, pre);
  };
  /** [직원] 공사의 종료 평가 목록 (작성 중인 평가는 근거를 최신 기록으로 다시 계산) */
  API.jobEvalList = async (a, jobId) => { const s = await staffOnly(a), j = await staffJob(a, s, jobId); return jobEvalListOf(j, null); };
  async function jobEvalOf(a, s, id) {
    const es = await db.collection('JOB_EVALS').doc(tidy(id, 40)).get().catch(() => null), e = es && es.exists ? es.data() : null; if (!e) fail('평가를 찾을 수 없거나 권한이 없습니다.');
    const j = await staffJob(a, s, e.jobId).catch(() => fail('평가를 찾을 수 없거나 권한이 없습니다.')); return { e, j };
  }
  /** [직원] 평가 저장 (final = 확정 · 안전보건팀 참조 알림) */
  API.saveJobEval = async (a, id, d, final) => {
    const s = await staffOnly(a), { e, j } = await jobEvalOf(a, s, id); if (e.status === 'DONE') fail('확정된 평가입니다. 고치려면 [다시 수정]을 눌러 주세요.');
    const items = {}, miss = [];
    EVAL_ITEMS.forEach(([no]) => { const x = ((d && d.items) || {})[no] || {}, lv = ['G', 'N', 'P'].includes(x.lv) ? x.lv : ''; items[no] = { lv, memo: tidy(x.memo, 300) }; if (!lv) miss.push(no + '번'); });
    if (final && miss.length) fail('체크하지 않은 항목이 있습니다: ' + miss.join(', '));
    if (final && !items[12].memo) fail('12번 재해 항목에 공사 중 사고 여부를 적어 주세요. (예: 무재해)');
    const sc = evalScore_(items), au = await jobEvalAuto(j, e.companyId), comment = tidy(d && d.comment, 1000);
    await db.collection('JOB_EVALS').doc(e.id).update({ items: JSON.stringify(items), auto: JSON.stringify(au), comment, total: final ? sc.total : '', grade: final ? sc.grade : '', status: final ? 'DONE' : 'DRAFT',
      pdfId: '', zipId: '', evaluator: final ? (s.dept || '아성다이소') + ' ' + s.name : '', evaluatedAt: final ? now() : '' });
    audit(a, e.companyId, final ? 'JOB_EVAL_DONE' : 'JOB_EVAL_SAVE', e.id + ' ' + (final ? sc.total + '점 ' + sc.grade : ''));
    if (final) notice('JOB_EVAL_DONE', j.title + ' (' + j.storeName + ') · ' + e.company + ' 종료 평가 ' + sc.total + '점 ' + sc.grade + '등급 · 평가 ' + s.name + ' (안전보건팀 사후 검토 대상)', j.id, e.companyId);
    return jobEvalListOf(j, { [e.companyId]: au });
  };
  /** [직원] 확정 평가 다시 수정 */
  API.reopenJobEval = async (a, id) => {
    const s = await staffOnly(a), { e, j } = await jobEvalOf(a, s, id);
    await db.collection('JOB_EVALS').doc(e.id).update({ status: 'DRAFT' }); audit(a, e.companyId, 'JOB_EVAL_REOPEN', e.id);
    return jobEvalListOf(j, null);
  };
  /** [직원] 전체 활동내역 ZIP (결과지 PDF 포함) — 중계 서버가 만들고 드라이브 보기 권한 + 주소를 돌려줌 */
  API.jobEvalFile = async (a, id) => { const s = await staffOnly(a), { e } = await jobEvalOf(a, s, id); if (e.status !== 'DONE') fail('평가를 확정한 뒤 받을 수 있습니다.'); return relay('evalZip', { evalId: e.id }, false, 330000); };
  /** 업체별 최근 확정 종료 평가 (공사 배정 때 경고용) */
  function lastEvals(evals, jobs) {
    const m = {};
    evals.filter((e) => e.status === 'DONE').sort((p, q) => String(p.evaluatedAt).localeCompare(String(q.evaluatedAt))).forEach((l) => {
      const j = jobs.find((x) => x.id === l.jobId) || {}; m[l.companyId] = { grade: l.grade, total: Number(l.total), comment: l.comment, job: j.title || '', date: l.evaluatedAt ? kst(l.evaluatedAt) : '' };
    });
    return m;
  }

  /* ---------- 화면에서 쓰는 창구 ---------- */
  const NEXT = {};  // v5.27의 모든 기능을 옮김 (F1.7). 남은 것은 예전 '제출자료 검토' 화면(reviewList 등 · 메일 링크 검토로 대체)
  async function call(fn, args) {
    const f = Object.prototype.hasOwnProperty.call(API, fn) ? API[fn] : null;
    if (!f) fail('아직 Firebase로 옮기지 않은 기능입니다 (' + fn + (NEXT[fn] ? ' · ' + NEXT[fn] + ' 예정' : '') + ').');
    const a = await me();
    try { return await f(a, ...(args || [])); } catch (e) { throw nice(e); }
  }
  /** 로그인 직후 (기존 op:'login'과 같은 모양으로 돌려줌) */
  async function login(mode, boot) {
    // F1.7f 작업자 QR 로그인은 접속 구분을 바꾸지 않음 (예전: 비워서 같은 기기의 업체 업무가 직원 기준으로 처리됨)
    if (!/^WRK-/.test(boot || '')) { try { localStorage.setItem('fbMode', mode || ''); } catch (e) {} }
    const a = await me(), data = { key: a.uid, email: a.email };
    if (/^WRK-[a-f0-9]{32}$/.test(boot || '')) {  // 작업자 등록 QR로 로그인: 등록 화면을 같이 돌려줌
      data.appVersion = VERSION;
      try { data.wk = await API.workerCheckIn(a, boot.slice(4), null); } catch (e) { data.bootError = nice(e).message; }
      return data;
    }
    try { data.portal = await API.portalData(a); } catch (e) { throw nice(e); }
    // 미팅 참석 QR로 로그인: 참석 화면을 같이 돌려줌
    if (/^MEET-[a-f0-9]{32}$/.test(boot || '')) { try { data.meet = await API.meetCheckIn(a, boot.slice(5), null); } catch (e) { data.bootError = nice(e).message; } }
    return data;
  }
  /** 구글 로그인 창 (막히면 화면 이동 방식으로) */
  async function signIn() {
    const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try { await auth.signInWithPopup(p); }
    catch (e) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) { await auth.signInWithRedirect(p); return 'redirect'; }
      throw e;
    }
    USER = auth.currentUser; return 'ok';
  }
  function loginError(e) {
    const c = e && e.code || '';
    if (c === 'auth/popup-closed-by-user') return '로그인 창을 닫았습니다. 다시 눌러 주세요.';
    if (c === 'auth/unauthorized-domain') return '이 주소는 Firebase에 등록되지 않았습니다. (Authentication → 승인된 도메인)';
    if (c === 'auth/network-request-failed') return '인터넷 연결을 확인해 주세요.';
    if (c === 'auth/web-storage-unsupported' || c === 'auth/internal-error') return '이 브라우저에서는 로그인이 안 됩니다. 크롬·사파리로 열어 주세요.';
    return '로그인 실패: ' + (e && e.message || e);
  }
  /** 화면 이동 방식으로 로그인하고 돌아온 경우 */
  async function redirectResult() { try { const r = await auth.getRedirectResult(); if (r && r.user) { USER = r.user; return true; } } catch (e) { return loginError(e); } return false; }
  window.FB = { ok: true, version: VERSION, ready, call, login, signIn, loginError, redirectResult, signOut: () => auth.signOut(), email: () => lower(USER && USER.email), _api: API };
})();
