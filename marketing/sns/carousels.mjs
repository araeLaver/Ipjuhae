/**
 * 연속 이미지 세트(캐러셀) 정의 — 게시물 한 건이 이미지 여러 장으로 이어진다.
 *
 * 한 장짜리 이미지는 쓰지 않는다. 한 장은 넘길 이유가 없어서 저장도 팔로우도 안 붙는다.
 * 세트는 전부 같은 틀을 쓴다 — 표지 → 논점 한 장씩 → 다음 화 예고.
 * 이 틀이 매 화 같아야 연재로 읽힌다.
 *
 * 슬라이드 종류
 *   cover  표지. title(줄바꿈 허용) + sub
 *   point  논점. label(하나·둘·셋) + title + desc
 *   plain  라벨 없는 본문. title + desc
 *   list   항목 나열. title + items[]
 *   end    마지막 장. 다음 화 예고 또는 연재 마무리
 *
 * 원고(`posts/*.md`)의 캡션과 짝을 이룬다. 캡션은 여기서 다시 쓰지 않는다.
 */

export const COVER_NOTE = '제목 위에 앰버 가로막대 140×14'

/** 등기부 뜯어보기 — 도달 트랙 · 세입자 */
const DEUNGI = [
  {
    num: '01', title: '등기부에서 볼 세 줄', next: '갑구 — 계약 상대가 진짜 주인인가',
    slides: [
      { kind: 'cover', title: '이 집, 계약해도 되는지\n3분이면 압니다', sub: '등기부등본 읽는 법' },
      { kind: 'plain', title: '준비물', desc: '등기부등본 1통.\n인터넷등기소에서 뗄 수 있습니다.' },
      { kind: 'point', label: '하나', title: '갑구 — 소유자', desc: '계약하려는 사람과 이름이 같은지 봅니다.\n대리인이 나왔다면 위임장을 확인하세요.' },
      { kind: 'point', label: '둘', title: '을구 — 근저당', desc: '채권최고액이 시세에 비해 얼마인지 봅니다.\n경매로 넘어가면 은행이 먼저 가져갑니다.' },
      { kind: 'point', label: '셋', title: '신탁 표시', desc: '있으면 집주인에게 계약 권한이 없을 수 있습니다.\n여기서 멈추고 신탁원부를 확인하세요.' },
      { kind: 'plain', title: '등기부에\n안 나오는 것', desc: '나보다 먼저 들어온 세입자의 보증금,\n집주인이 안 낸 세금.\n\n둘 다 경매에서 내 보증금보다 순위가 앞섭니다.' },
      { kind: 'end', title: '다음 화', desc: '갑구 — 계약 상대가 진짜 주인인가' },
    ],
  },
  {
    num: '02', title: '갑구 — 계약 상대가 진짜 주인인가', next: '을구 — 근저당과 순위',
    slides: [
      { kind: 'cover', title: '갑구 —\n계약 상대가\n진짜 주인인가', sub: '이 집이 누구 것인지 적힌 칸' },
      { kind: 'point', label: '하나', title: '이름', desc: '계약서에 도장 찍을 사람과 같은지\n신분증으로 대조합니다.' },
      { kind: 'point', label: '둘', title: '날짜', desc: '소유권이 언제 넘어왔는지 봅니다.\n얼마 전에 주인이 바뀌었다면\n왜 바뀌었는지 한 번은 물어볼 만합니다.' },
      { kind: 'point', label: '셋', title: '원인', desc: '매매인지 상속인지 신탁인지.\n신탁이면 이야기가 완전히 달라집니다.' },
      { kind: 'plain', title: '대리인이\n나왔다면', desc: '생각보다 많습니다.\n위임장과 인감증명서를 같이 봅니다.' },
      { kind: 'end', title: '다음 화', desc: '을구 — 근저당과 순위' },
    ],
  },
  {
    num: '03', title: '을구 — 근저당과 순위', next: '신탁 표시가 있으면 멈춘다',
    slides: [
      { kind: 'cover', title: '확정일자보다\n순위가 먼저입니다', sub: '을구 — 근저당' },
      { kind: 'plain', title: '채권최고액', desc: '집주인이 이 집을 담보로 빌린 돈입니다.\n을구에 적혀 있습니다.' },
      { kind: 'plain', title: '경매로 가면', desc: '은행이 먼저 가져갑니다.\n이 금액이 시세에 가까울수록\n나한테 남는 게 없습니다.' },
      { kind: 'plain', title: '확정일자를\n받았는데도', desc: '근저당이 먼저 잡혀 있으면\n아무리 빨리 받아도 뒤로 밀립니다.' },
      { kind: 'plain', title: '봐야 하는 건\n날짜가 아니라 순위', desc: '내 앞에 뭐가 몇 개 있는지를 봅니다.' },
      { kind: 'end', title: '다음 화', desc: '신탁 표시가 있으면 멈춘다' },
    ],
  },
  {
    num: '04', title: '신탁 표시가 있으면 멈춘다', next: '등기부에 안 나오는 위험',
    slides: [
      { kind: 'cover', title: '신탁 표시가 있으면\n일단 멈춥니다', sub: '전세사기에서 반복되는 유형' },
      { kind: 'plain', title: '소유자 칸에\n회사 이름', desc: '신탁이라고 적혀 있으면\n소유자 칸에 신탁회사 이름이 있습니다.' },
      { kind: 'plain', title: '집주인이라고\n소개받은 사람은', desc: '등기부상 주인이 아닐 수 있습니다.' },
      { kind: 'plain', title: '그럼 빌려줄 권한은\n누구에게 있나', desc: '신탁회사일 수도, 원래 주인에게\n일부 남아 있을 수도 있습니다.' },
      { kind: 'plain', title: '등기부에는\n안 나옵니다', desc: '신탁원부라는 별도 문서를 봐야 압니다.' },
      { kind: 'plain', title: '권한 없는 사람과\n계약하면', desc: '나중에 그 계약은 무효라는 말을 듣습니다.\n보증금을 돌려받을 상대가 사라집니다.' },
      { kind: 'end', title: '다음 화', desc: '등기부에 안 나오는 위험' },
    ],
  },
  {
    num: '05', title: '등기부에 안 나오는 위험', next: '계약서에 넣어달라고 할 한 줄',
    slides: [
      { kind: 'cover', title: '등기부가 깨끗해도\n안전한 게 아닙니다', sub: '떼어봐도 안 보이는 것' },
      { kind: 'point', label: '하나', title: '앞선 세입자의\n보증금', desc: '나보다 먼저 들어온 사람들의 보증금.' },
      { kind: 'point', label: '둘', title: '집주인이\n안 낸 세금', desc: '체납된 세금.' },
      { kind: 'plain', title: '둘 다 등기부에\n안 나옵니다', desc: '그런데 경매로 넘어가면\n내 보증금보다 순위가 앞섭니다.' },
      { kind: 'plain', title: '그래서', desc: '등기부는 시작이지 끝이 아닙니다.' },
      { kind: 'end', title: '다음 화', desc: '계약서에 넣어달라고 할 한 줄' },
    ],
  },
  {
    num: '06', title: '계약서에 넣어달라고 할 한 줄', next: '집 보러 가서 물어볼 것',
    slides: [
      { kind: 'cover', title: '계약서에\n이 한 줄', sub: '넣어달라고 요구할 수 있습니다' },
      { kind: 'plain', title: '무슨 일이\n생기냐면', desc: '계약하고 잔금 치르기 전에\n집주인이 대출을 받아버리면\n내 순위가 밀립니다.' },
      { kind: 'plain', title: '넣을 문장', desc: '임대인은 잔금일 다음 날까지\n본 부동산에 근저당권을 설정하지 않는다' },
      { kind: 'plain', title: '드물지만\n실제로 있습니다', desc: '그리고 이 한 줄이 막아줍니다.' },
      { kind: 'end', title: '다음 화', desc: '집 보러 가서 물어볼 것' },
    ],
  },
  {
    num: '07', title: '집 보러 가서 물어볼 것', next: '가압류·가처분이 있는 집',
    slides: [
      { kind: 'cover', title: '집 보러 가서\n물어봐도 되는 것', sub: '까다로운 게 아니라 당연한 것' },
      { kind: 'point', label: '하나', title: '지금 대출이\n얼마나 잡혀 있나요' },
      { kind: 'point', label: '둘', title: '저보다 먼저 들어온\n세입자가 있나요' },
      { kind: 'point', label: '셋', title: '보증금은 언제 어떻게\n돌려주시나요' },
      { kind: 'plain', title: '망설이게 되지만', desc: '안 물어보는 게 훨씬 위험합니다.\n집주인 입장에서도, 이런 걸 묻는 사람이\n월세를 제때 냅니다.' },
      { kind: 'end', title: '다음 화', desc: '가압류·가처분이 있는 집' },
    ],
  },
  {
    num: '08', title: '가압류·가처분이 있는 집', next: '다가구와 다세대가 다른 이유',
    slides: [
      { kind: 'cover', title: '이 집은 지금\n다툼 중입니다', sub: '갑구의 가압류 · 가처분' },
      { kind: 'plain', title: '가압류', desc: '누가 이 집주인한테 받을 돈이 있다며\n집을 묶어둔 것입니다.' },
      { kind: 'plain', title: '가처분', desc: '이 집의 소유권 자체를 두고\n다투는 중이라는 표시입니다.' },
      { kind: 'plain', title: '둘 다 같은 신호', desc: '재판이 끝나면 이 집이\n넘어갈 수도 있다는 뜻입니다.' },
      { kind: 'plain', title: '근저당과 다른 점', desc: '근저당은 금액이라도 보이는데\n이건 결과를 알 수 없습니다.' },
      { kind: 'end', title: '다음 화', desc: '다가구와 다세대가 다른 이유' },
    ],
  },
  {
    num: '09', title: '다가구와 다세대가 다른 이유', next: '전입신고와 확정일자, 하루가 갈랐다',
    slides: [
      { kind: 'cover', title: '이름은 비슷한데\n위험은 다릅니다', sub: '다가구 · 다세대' },
      { kind: 'plain', title: '다세대', desc: '호실마다 등기가 따로 있습니다.\n201호 등기부를 떼면 201호 이야기만 나옵니다.' },
      { kind: 'plain', title: '다가구', desc: '건물 하나에 등기가 하나입니다.\n주인도 한 명, 등기부도 한 장인데\n세입자는 열 몇 가구입니다.' },
      { kind: 'plain', title: '그래서 다가구는', desc: '내 앞에 들어온 세입자들의 보증금 전부가\n내 보증금보다 앞순위입니다.' },
      { kind: 'plain', title: '그 총액은\n등기부에 없습니다', desc: '확정일자 부여현황과 전입세대 열람 내역을\n집주인에게 요청해 직접 확인합니다.' },
      { kind: 'plain', title: '거절하면', desc: '그것도 하나의 답입니다.' },
      { kind: 'end', title: '다음 화', desc: '전입신고와 확정일자, 하루가 갈랐다' },
    ],
  },
  {
    num: '10', title: '전입신고와 확정일자, 하루가 갈랐다', next: '보증보험이 거절되는 집',
    slides: [
      { kind: 'cover', title: '같은 날 했는데도\n순위가 밀립니다', sub: '전입신고와 대항력' },
      { kind: 'plain', title: '대항력은\n다음 날부터', desc: '전입신고를 하면 대항력이 생기는데\n그날 바로가 아니라 그다음 날부터입니다.' },
      { kind: 'plain', title: '그래서 생기는 틈', desc: '잔금 치른 날 오전에 전입신고를 해도\n그날 오후에 집주인이 근저당을 걸면\n근저당이 먼저입니다.' },
      { kind: 'plain', title: '막는 방법', desc: '계약서에 잔금일 다음 날까지\n근저당을 설정하지 않는다는 특약을 넣습니다.' },
      { kind: 'end', title: '다음 화', desc: '보증보험이 거절되는 집' },
    ],
  },
  {
    num: '11', title: '보증보험이 거절되는 집', next: '계약 전 마지막 점검표',
    slides: [
      { kind: 'cover', title: '심사하는 곳이\n안 받겠다는 집', sub: '전세보증금 반환보증 거절' },
      { kind: 'plain', title: '거절당했다면', desc: '보험사가 이 집을 위험하다고\n판단했다는 뜻입니다.' },
      { kind: 'plain', title: '대체로\n이런 이유', desc: '선순위 채권이 너무 많거나,\n신탁등기가 걸려 있거나,\n집값 대비 보증금 비중이 기준을 넘거나.' },
      { kind: 'plain', title: '중요한 건\n개별 기준이 아니라', desc: '심사를 전문으로 하는 곳이 안 받겠다고 한 집에\n내가 보증금 전부를 걸 이유가 있느냐입니다.' },
      { kind: 'plain', title: '계약 전에\n확인하세요', desc: '계약하고 나서 알면 늦습니다.' },
      { kind: 'end', title: '다음 화', desc: '계약 전 마지막 점검표' },
    ],
  },
  {
    num: '12', title: '계약 전 마지막 점검표', next: null,
    slides: [
      { kind: 'cover', title: '열한 편을\n한 장으로', sub: '계약 전 마지막 점검표' },
      { kind: 'list', title: '먼저 볼 것', items: ['계약하려는 사람이 등기부상 소유자와 같은가', '근저당 채권최고액이 시세에 비해 얼마인가', '신탁 표시가 있는가'] },
      { kind: 'list', title: '그다음', items: ['가압류·가처분이 있는가', '다가구라면 앞선 보증금 총액을 확인했는가'] },
      { kind: 'list', title: '계약할 때', items: ['잔금 다음 날까지 근저당 금지 특약을 넣었는가', '보증보험 가입이 되는 집인가'] },
      { kind: 'plain', title: '반나절이면\n다 확인합니다', desc: '보증금은 반나절보다 비쌉니다.' },
      { kind: 'end', title: '연재 끝', desc: '다음 주부터 집주인 쪽을 확인하는 이야기' },
    ],
  },
]

/** 임대인 노트 — 전환 트랙 · 임대인·중개사 */
const LANDLORD = [
  {
    num: '01', title: '공실보다 연체가 비싸다', next: '물어봐도 되는 것과 안 되는 것',
    slides: [
      { kind: 'cover', title: '제일 비싼 실수는\n공실이 아닙니다', sub: '임대인 노트' },
      { kind: 'plain', title: '공실 한 달', desc: '한 달치 손해로 끝납니다.' },
      { kind: 'plain', title: '연체는', desc: '명도까지 가면 몇 달에\n소송비까지 붙습니다.' },
      { kind: 'plain', title: '그런데', desc: '세입자를 고를 때 쓸 수 있는 정보는\n여전히 느낌뿐입니다.' },
      { kind: 'end', title: '다음 화', desc: '물어봐도 되는 것과 안 되는 것' },
    ],
  },
  {
    num: '02', title: '물어봐도 되는 것과 안 되는 것', next: '연체는 얼마짜리 실수인가',
    slides: [
      { kind: 'cover', title: '물어봐도 되는 것과\n안 되는 것', sub: '세입자에게' },
      { kind: 'list', title: '물어봐도 되는 것', items: ['월세를 낼 수 있는 소득이 되는지', '이전 계약을 잘 마쳤는지'] },
      { kind: 'list', title: '물어보면 안 되는 것', items: ['결혼 계획', '출신 학교', '국적', '가족 구성'] },
      { kind: 'plain', title: '아래쪽은', desc: '판단에 도움이 안 되면서\n차별이 됩니다.' },
      { kind: 'plain', title: '진짜 문제는', desc: '위쪽은 물어봐도\n확인할 방법이 없다는 것입니다.' },
      { kind: 'end', title: '다음 화', desc: '연체는 얼마짜리 실수인가' },
    ],
  },
  {
    num: '03', title: '연체는 얼마짜리 실수인가', next: '중개사가 확인할 수 없는 것',
    slides: [
      { kind: 'cover', title: '세입자를 잘못 받으면\n얼마나 손해인가', sub: '월세 80만 원 가정' },
      { kind: 'plain', title: '3개월 밀리면', desc: '240만 원' },
      { kind: 'plain', title: '명도 소송에\n들어가면', desc: '변호사비가 붙습니다.' },
      { kind: 'plain', title: '그동안', desc: '못 받는 월세는 계속 쌓입니다.' },
      { kind: 'plain', title: '보증금에서\n까면 된다고 하지만', desc: '보증금을 다 까먹을 때까지\n안 나가는 경우가 진짜 문제입니다.' },
      { kind: 'end', title: '다음 화', desc: '중개사가 확인할 수 없는 것' },
    ],
  },
  {
    num: '04', title: '중개사가 확인할 수 없는 것', next: '보증금을 올리는 것 말고',
    slides: [
      { kind: 'cover', title: '계약 자리에서\n확인하실 수 있나요', sub: '중개사 분들께' },
      { kind: 'plain', title: '세입자가 준 서류가\n진짜인지', desc: '현장에서 확인할 방법이 있으신가요.' },
      { kind: 'plain', title: '재직증명서 위조는', desc: '생각보다 쉽습니다.' },
      { kind: 'plain', title: '확인 안 하고\n넘어갔다가', desc: '사고가 나면 책임은 중개사에게 옵니다.' },
      { kind: 'end', title: '다음 화', desc: '보증금을 올리는 것 말고' },
    ],
  },
  {
    num: '05', title: '보증금을 올리는 것 말고', next: '좋은 세입자의 신호는 무엇인가',
    slides: [
      { kind: 'cover', title: '보증금을 올리면\n같이 일어나는 일', sub: '연체가 걱정될 때' },
      { kind: 'plain', title: '두 가지가\n같이 일어납니다', desc: '위험은 줄어들고,\n들어올 사람도 줄어듭니다.' },
      { kind: 'plain', title: '돈을 잘 내는 사람일수록', desc: '선택지가 많아서 보증금 높은 집을\n굳이 고르지 않습니다.' },
      { kind: 'plain', title: '그래서', desc: '보증금을 올려서 걸러지는 쪽이\n오히려 성실한 세입자일 수 있습니다.' },
      { kind: 'list', title: '보증금 말고\n쓸 수 있는 것', items: ['월세를 자동이체로 받기', '연체 시 지연손해금을 계약서에 명확히', '계약 전에 확인할 수 있는 걸 확인하기'] },
      { kind: 'end', title: '다음 화', desc: '좋은 세입자의 신호는 무엇인가' },
    ],
  },
  {
    num: '06', title: '좋은 세입자의 신호는 무엇인가', next: null,
    slides: [
      { kind: 'cover', title: '좋은 세입자를\n어떻게 알아보나', sub: '저희가 보는 세 가지' },
      { kind: 'point', label: '하나', title: '월세가 소득에서\n차지하는 비율', desc: '액수가 아니라 비율입니다.\n많이 버는 사람이 아니라\n감당 가능한 사람을 찾는 거니까요.' },
      { kind: 'point', label: '둘', title: '이전 계약을\n끝까지 마쳤는가', desc: '중간에 나갔는지, 분쟁이 있었는지.' },
      { kind: 'point', label: '셋', title: '정기적으로 나가는 돈을\n밀리지 않고 내왔는가', desc: '통신비 같은 것들요.' },
      { kind: 'list', title: '안 보는 것', items: ['직업', '학력', '나이', '결혼 여부', '국적'] },
      { kind: 'plain', title: '솔직히 말하면', desc: '저 셋도 지금은 확인할 방법이 없습니다.\n그게 저희가 만들고 있는 것입니다.' },
      { kind: 'end', title: '연재 끝', desc: '입주해 사전 신청 — 프로필 링크' },
    ],
  },
]

export const SERIES = [
  { name: '등기부 뜯어보기', track: '도달 · 세입자', total: 12, sets: DEUNGI, source: '01-series-deungi.md' },
  { name: '임대인 노트', track: '전환 · 임대인·중개사', total: 6, sets: LANDLORD, source: '02-series-landlord.md' },
]
