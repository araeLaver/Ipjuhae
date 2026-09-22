/**
 * 전세 계약에 걸리는 제도 정리.
 *
 * 규칙 하나. **확인한 것만 숫자를 적는다.**
 * 출처마다 값이 다르거나 확인이 안 되면 숫자를 쓰지 않고 공식 창구로 보낸다.
 * 틀린 금액을 보고 계약하면 그 손해는 되돌릴 수 없다.
 *
 * 각 항목에 `checkedAt`과 `sources`를 반드시 둔다. 언제 확인한 정보인지
 * 모르면 읽는 사람이 판단할 수 없다. 제도는 바뀐다.
 */

export interface PolicySource {
  label: string
  url: string
}

export interface PolicyTable {
  caption?: string
  head: string[]
  rows: string[][]
}

export interface Policy {
  slug: string
  title: string
  /** 한 줄로 요약. 목록에서 이것만 읽어도 무엇인지 알게. */
  summary: string
  /** 누구에게 해당하는가. */
  who: string
  body: string[]
  table?: PolicyTable
  /** 값을 단정하지 않고 창구로 보내야 할 때. */
  caution?: string
  sources: PolicySource[]
  /** YYYY-MM-DD. 내용을 마지막으로 확인한 날. */
  checkedAt: string
}

export const POLICIES: Policy[] = [
  {
    slug: 'priority-repayment',
    title: '소액임차인 최우선변제',
    summary:
      '보증금이 지역별 기준 이하면, 집이 경매로 넘어가도 근저당보다 먼저 일정 금액을 받습니다.',
    who: '보증금이 아래 표의 기준 금액 이하인 임차인',
    body: [
      '근저당이 먼저 잡힌 집이라도, 보증금이 지역별 기준 이하이면 그 근저당보다 앞서 일정 금액을 돌려받습니다. 보증금 전액이 아니라 표의 "최우선변제 금액"까지입니다.',
      '받으려면 세 가지가 갖춰져 있어야 합니다. 집에 실제로 들어가 살고 있을 것, 주민등록(전입신고)이 되어 있을 것, 그리고 경매개시결정 등기보다 먼저 대항력을 갖췄을 것입니다.',
      '보증금이 기준을 한 푼이라도 넘으면 이 제도는 적용되지 않습니다. 기준 근처라면 계약 금액을 조정하는 것만으로 보호 여부가 갈립니다.',
    ],
    table: {
      caption: '지역별 기준 금액과 최우선변제 금액',
      head: ['지역', '보증금이 이 금액 이하일 때', '먼저 받는 금액'],
      rows: [
        ['서울특별시', '1억 6,500만원', '5,500만원'],
        ['과밀억제권역(서울 제외), 세종·용인·화성·김포', '1억 4,500만원', '4,800만원'],
        ['광역시(일부 제외), 안산·광주·파주·이천·평택', '8,500만원', '2,800만원'],
        ['그 밖의 지역', '7,500만원', '2,500만원'],
      ],
    },
    sources: [
      {
        label: '찾기쉬운 생활법령정보 — 소액보증금 최우선변제',
        url: 'https://www.easylaw.go.kr/CSP/OnhunqueansInfoRetrieve.laf?onhunqnaAstSeq=84&onhunqueSeq=2466',
      },
      { label: '국가법령정보센터 — 주택임대차보호법', url: 'https://www.law.go.kr' },
    ],
    checkedAt: '2026-09-22',
  },
  {
    slug: 'move-in-report',
    title: '전입신고와 확정일자',
    summary: '계약 당일에 둘 다 받으세요. 효력은 신고한 다음 날 0시부터 생깁니다.',
    who: '전세·월세 계약을 하는 모든 임차인',
    body: [
      '전입신고를 하면 대항력이 생깁니다. 집주인이 바뀌어도 계약 기간 동안 살 수 있고, 보증금을 새 집주인에게 요구할 수 있습니다.',
      '확정일자를 받으면 우선변제권이 생깁니다. 집이 경매로 넘어갔을 때 확정일자보다 늦게 잡힌 근저당보다 먼저 배당받습니다.',
      '문제는 시점입니다. 대항력은 전입신고한 **다음 날 0시**부터 생깁니다. 잔금을 치른 날 집주인이 그날 근저당을 잡으면, 그 근저당이 내 대항력보다 앞섭니다. 계약서에 잔금일에 근저당을 설정하지 않겠다는 조항을 넣어두는 이유가 이것입니다.',
      '확정일자는 주민센터, 등기소, 인터넷등기소에서 받습니다. 전입신고와 같은 날 처리하시면 됩니다.',
    ],
    sources: [
      {
        label: '찾기쉬운 생활법령정보 — 주택임대차',
        url: 'https://www.easylaw.go.kr',
      },
      { label: '정부24 — 전입신고', url: 'https://www.gov.kr' },
    ],
    checkedAt: '2026-09-22',
  },
  {
    slug: 'deposit-guarantee',
    title: '전세보증금반환보증',
    summary:
      '집주인이 보증금을 안 돌려주면 보증기관이 대신 내줍니다. 가입 요건은 기관에서 직접 확인하세요.',
    who: '보증금을 돌려받지 못할 위험이 걱정되는 임차인',
    body: [
      '계약 기간이 끝났는데 집주인이 보증금을 돌려주지 않으면, 보증기관이 임차인에게 먼저 돌려주고 집주인에게 청구합니다. 보증료는 임차인이 냅니다.',
      'HUG(주택도시보증공사), HF(한국주택금융공사), SGI서울보증에서 취급합니다. 기관마다 요건과 보증료가 다릅니다.',
      '중요한 것은 **모든 집이 가입되는 것은 아니라는 점**입니다. 시세 대비 보증금과 선순위 채권이 많으면 거절됩니다. 계약서에 도장을 찍은 뒤에 거절당하면 되돌릴 수 없으니, 계약 전에 가입 가능 여부부터 확인하세요.',
    ],
    caution:
      '가입 요건의 구체적인 비율과 보증료율은 기관과 시점에 따라 다르고, 저희가 확인한 값이 최신이라는 보장을 드릴 수 없습니다. 이 페이지에 숫자를 적지 않는 이유입니다. 아래 공식 창구에서 직접 확인하세요.',
    sources: [
      { label: 'HUG 주택도시보증공사', url: 'https://www.khug.or.kr' },
      { label: 'HF 한국주택금융공사', url: 'https://www.hf.go.kr' },
      { label: 'SGI서울보증', url: 'https://www.sgic.co.kr' },
    ],
    checkedAt: '2026-09-22',
  },
  {
    slug: 'lease-registration-order',
    title: '임차권등기명령',
    summary: '보증금을 못 받은 채 이사해야 할 때, 대항력과 우선변제권을 남겨두는 방법입니다.',
    who: '계약이 끝났는데 보증금을 돌려받지 못한 임차인',
    body: [
      '보증금을 못 받았는데 이사를 나가면 대항력과 우선변제권이 사라집니다. 그 집에 살고 있고 주민등록이 되어 있다는 것이 그 권리의 조건이기 때문입니다.',
      '임차권등기명령을 받아 등기하면, 이사를 나가고 주민등록을 옮겨도 그 권리가 유지됩니다. 등기가 끝난 것을 확인한 뒤에 이사하셔야 합니다.',
      '법원에 신청합니다. 비용과 절차는 관할 법원이나 대한법률구조공단에서 안내받으실 수 있습니다.',
    ],
    sources: [
      { label: '대한법률구조공단', url: 'https://www.klac.or.kr' },
      { label: '대법원 전자민원센터', url: 'https://help.scourt.go.kr' },
    ],
    checkedAt: '2026-09-22',
  },
  {
    slug: 'fraud-victim-support',
    title: '전세사기 피해 지원',
    summary: '피해자로 인정되면 주거와 금융 지원을 받을 수 있습니다. 요건은 창구에서 확인하세요.',
    who: '전세사기 피해를 입었거나 입었다고 의심되는 임차인',
    body: [
      '전세사기 피해자로 결정되면 우선매수권, 긴급 주거 지원, 저리 대출 등이 제공됩니다. 지원 항목과 요건은 제도가 바뀌면서 계속 조정되고 있습니다.',
      '가장 먼저 하실 일은 피해 사실을 정리해 상담을 받는 것입니다. 시간이 지나면 할 수 있는 선택이 줄어듭니다.',
    ],
    caution:
      '지원 항목과 신청 기한은 자주 바뀝니다. 이 페이지의 내용만 보고 판단하지 마시고, 아래 창구에서 현재 기준을 확인하세요.',
    sources: [
      { label: '국토교통부', url: 'https://www.molit.go.kr' },
      { label: '전세피해지원센터 안내(국토교통부)', url: 'https://www.molit.go.kr' },
      { label: '대한법률구조공단', url: 'https://www.klac.or.kr' },
    ],
    checkedAt: '2026-09-22',
  },
]

export function getPolicy(slug: string): Policy | undefined {
  return POLICIES.find((p) => p.slug === slug)
}

/** 2026-09-22 -> 2026년 9월 22일 */
export function formatCheckedAt(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}
