/**
 * 집 상태와 계약 조건에 맞는 전월세 필수 특약 문구와
 * 중개사·임대인에게 정중하게 보낼 카톡/문자 요청 초안을 생성한다.
 *
 * 생성된 문구는 계약서 작성 참고용이며 법률 자문이 아니다.
 * 실제 계약 시 공인중개사·당사자 간 협의를 거쳐 확정해야 한다.
 */

export interface SpecialTermsInput {
  /** 근저당 채권최고액이 있는가 */
  hasMortgage: boolean
  /** 다가구 등 선순위 세입자 보증금이 있는가 */
  hasPriorTenants: boolean
  /** 전세자금대출을 받을 예정인가 */
  needsJeonseLoan: boolean
  /** 전세보증보험(HUG/HF/SGI) 가입 예정인가 */
  needsInsurance: boolean
  /** 반려동물 동반 여부 */
  hasPet: boolean
  /** 입주 전 수선·청소·옵션 확인 필요 여부 */
  needsRepairCheck: boolean
}

export interface SpecialTermItem {
  id: string
  category: '보증금 보호' | '근저당·선순위' | '대출·보증보험' | '생활·시설'
  title: string
  clause: string
  why: string
  essential: boolean
}

export interface SpecialTermsBundle {
  items: SpecialTermItem[]
  /** 계약서 붙여넣기용 전체 텍스트 */
  contractText: string
  /** 중개사/집주인에게 보내는 정중한 카톡/문자 초안 */
  politeMessage: string
}

export function buildSpecialTerms(input: SpecialTermsInput): SpecialTermsBundle {
  const items: SpecialTermItem[] = [
    {
      id: 'no-rights-change',
      category: '보증금 보호',
      title: '잔금 익일까지 권리변동 금지',
      clause:
        '임대인은 본 계약 체결일부터 임차인의 전입신고 및 확정일자 효력이 발생하는 잔금일 익일 24시까지 본 부동산에 근저당권, 가압류, 신탁 등 일체의 새로운 제한물권을 설정하지 않는다. 이를 위반할 경우 본 계약은 무효로 하며 임대인은 계약금의 배액을 임차인에게 배상한다.',
      why: '전입신고 효력은 다음 날 0시부터 발생해 당일 집주인이 대출을 받으면 세입자가 후순위로 밀립니다.',
      essential: true,
    },
    {
      id: 'tax-clearance',
      category: '보증금 보호',
      title: '임대인 국세·지방세 체납 없음 확인',
      clause:
        '임대인은 계약 시점에 미납 국세·지방세가 없음을 확인하며, 잔금 전 미납 세금 확인서(또는 열람 동의)를 제공한다. 미납 세금으로 인해 보증금 반환이 위협받을 경우 임차인은 계약을 해제하고 계약금 전액을 반환받을 수 있다.',
      why: '조세 채권은 확정일자보다 먼저 배당될 수 있어 체납 확인이 필수입니다.',
      essential: true,
    },
  ]

  if (input.hasMortgage) {
    items.push({
      id: 'mortgage-release',
      category: '근저당·선순위',
      title: '잔금 동시 근저당권 전액 말소',
      clause:
        '현 등기부등본상 설정된 근저당권(을구 기재 채권최고액)은 잔금 지급과 동시에 전액 상환 및 말소 접수하기로 하며, 임대인은 상환 영수증 및 말소 접수증을 당일 임차인에게 교부한다. 미이행 시 계약은 무효로 하고 임대인은 수령한 금액 전액을 즉시 반환한다.',
      why: '근저당이 남으면 경매 시 은행이 먼저 돈을 가져가 보증금 손실 위험이 큽니다.',
      essential: true,
    })
  }

  if (input.hasPriorTenants) {
    items.push({
      id: 'prior-tenants-disclosure',
      category: '근저당·선순위',
      title: '선순위 임차인 보증금 총액 확인',
      clause:
        '임대인은 본 건물(다가구 등)의 선순위 임차인 보증금 총액 및 확정일자 부여 현황을 사실대로 고지하고 관련 서류를 교부한다. 고지된 내용과 실제 선순위 보증금 합계가 다를 경우 임차인은 계약을 해제할 수 있으며 임대인은 계약금 전액을 반환한다.',
      why: '다가구 주택은 등기부에 다른 세입자 보증금이 나오지 않아 서면 확인이 반드시 필요합니다.',
      essential: true,
    })
  }

  if (input.needsInsurance) {
    items.push({
      id: 'hug-insurance',
      category: '대출·보증보험',
      title: '전세보증보험 가입 협조 및 미승인 시 반환',
      clause:
        '임대인은 임차인의 전세보증금반환보증(HUG·HF·SGI 등) 가입에 적극 협조한다. 임대인 또는 목적물의 하자(권리관계, 위반건축물, 선순위 초과 등)로 인해 보증보험 가입이 거절될 경우 본 계약은 무효로 하며 임대인은 계약금 및 기지급 금액 전액을 즉시 반환한다.',
      why: '계약금 입금 후 보증보험이 거절되면 계약금을 떼일 수 있어 반드시 넣어야 합니다.',
      essential: true,
    })
  }

  if (input.needsJeonseLoan) {
    items.push({
      id: 'jeonse-loan',
      category: '대출·보증보험',
      title: '전세자금대출 미승인 시 계약금 반환',
      clause:
        '임대인은 임차인의 전세자금대출 진행(질권설정 통지, 채권양도 승낙 등)에 협조한다. 임차인의 귀책사유 없이 목적물 또는 임대인 요건으로 인해 전세자금대출이 승인되지 않을 경우 본 계약은 해제되며 임대인은 계약금 전액을 즉시 반환한다.',
      why: '대출이 막혀 잔금을 못 치르면 계약금 몰수 분쟁이 자주 발생합니다.',
      essential: true,
    })
  }

  if (input.needsRepairCheck) {
    items.push({
      id: 'repair-and-wear',
      category: '생활·시설',
      title: '입주 전 수선 및 통상적 마모 원상복구 제외',
      clause:
        '보일러·누수·배관 등 주요 설비의 노후로 인한 수선 비용은 임대인이 부담하며, 입주 전 확인된 하자(사진 기록 포함) 및 거주 중 자연적·통상적 마모는 임차인의 원상복구 의무에서 제외한다.',
      why: '퇴거 시 도배·장판·생활 흠집으로 보증금 공제 분쟁을 예방합니다.',
      essential: false,
    })
  }

  if (input.hasPet) {
    items.push({
      id: 'pet-agreement',
      category: '생활·시설',
      title: '반려동물 동반 거주 및 훼손 범위 합의',
      clause:
        '임대인은 임차인의 반려동물 동반 거주를 허용한다. 임차인은 소음·위생 관리에 유의하며, 반려동물로 인해 명백히 파손된 시설물(벽지·장판 찢김 등)에 한해 합리적 실비 범위 내에서 원상복구하기로 한다.',
      why: '구두 허락만 받으면 추후 계약 해지나 과도한 복구비 청구 분쟁이 생길 수 있습니다.',
      essential: false,
    })
  }

  const contractText = items
    .map((item, idx) => `${idx + 1}. [${item.title}] ${item.clause}`)
    .join('\n\n')

  const shortTitles = items.map((item, idx) => `${idx + 1}) ${item.title}`).join('\n')
  const politeMessage = [
    '안녕하세요! 계약 준비로 연락드립니다.',
    '서로 안심하고 깔끔하게 계약 진행하고자 아래 기본 특약 사항을 계약서에 반영할 수 있을지 미리 여쭤봅니다.',
    '',
    shortTitles,
    '',
    '세부 문구는 계약서 작성 시 중개사님과 함께 조율하면 좋겠습니다. 확인 부탁드립니다! 감사합니다.',
  ].join('\n')

  return { items, contractText, politeMessage }
}
