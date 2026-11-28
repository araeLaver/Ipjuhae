/**
 * SEO JSON-LD structured data builders (WebApplication + FAQPage)
 * for high-intent Korean housing safety search queries on Google & Naver.
 */

export interface FaqEntry {
  question: string
  answer: string
}

export function buildToolJsonLd(params: {
  name: string
  url: string
  description: string
  faqs: FaqEntry[]
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: params.name,
        url: params.url,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web, Android, iOS',
        inLanguage: 'ko-KR',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'KRW',
        },
        description: params.description,
        publisher: {
          '@type': 'Organization',
          name: '입주해',
          url: 'https://www.ipjuhae.com',
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: params.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  }
}

export const CHECK_TOOL_JSONLD = buildToolJsonLd({
  name: '입주해 보증금 위험 점검 · 등기부 10초 자동 분석',
  url: 'https://www.ipjuhae.com/check',
  description:
    '매매 시세, 전세 보증금, 등기부 을구 근저당 채권최고액과 선순위 보증금으로 깡통전세·경매 손실 위험을 가입 없이 10초 만에 계산합니다.',
  faqs: [
    {
      question: '전세 보증금 안전 기준(깡통전세)은 어떻게 계산하나요?',
      answer:
        '보통 선순위 근저당 채권최고액과 선순위 세입자 보증금, 내 보증금을 합한 금액이 매매 시세의 70~80%를 넘거나 경매 낙찰가율(약 70%)을 초과하면 보증금 손실 위험이 커집니다.',
    },
    {
      question: '등기부등본에서 꼭 확인해야 할 6대 위험 신호는 무엇인가요?',
      answer:
        '경매개시결정, 신탁 등기(수탁자 동의 필수), 국세·지방세 압류, 가압류, 이전 세입자의 임차권등기명령, 소유권이전청구권 가등기가 있다면 계약 전 반드시 원인과 말소 여부를 확인해야 합니다.',
    },
    {
      question: '입력한 시세·보증금·등기부 텍스트는 서버에 저장되나요?',
      answer:
        '아니요. 숫자와 붙여넣은 등기부 텍스트 분석은 브라우저와 앱 기기 안에서만 계산되며 서버로 전송하거나 저장하지 않습니다.',
    },
  ],
})

export const HUG_TOOL_JSONLD = buildToolJsonLd({
  name: 'HUG 전세보증보험 126% 가입 가능 계산기',
  url: 'https://www.ipjuhae.com/tools/hug-check',
  description:
    '빌라·오피스텔 공시가격 126% 룰과 아파트 KB시세 90% 룰을 기준으로 HUG 전세보증금반환보증 가입 한도를 무료로 계산합니다.',
  faqs: [
    {
      question: 'HUG 전세보증보험 126% 룰이란 무엇인가요?',
      answer:
        'KB시세 등 공인 시세가 없는 빌라·다세대·오피스텔은 공동주택 공시가격의 140%를 주택가격으로 인정하고, 그 90%(즉 공시가격 × 126%) 이내여야 전세보증보험 가입 한도를 충족합니다.',
    },
    {
      question: '수도권과 비수도권의 HUG 보증금 한도 차이는 어떻게 되나요?',
      answer:
        'HUG 전세보증금반환보증은 수도권 보증금 7억원 이하, 비수도권 보증금 5억원 이하가 기본 가입 대상입니다.',
    },
    {
      question: '선순위 근저당이 있어도 전세보증보험에 가입할 수 있나요?',
      answer:
        '선순위 채권이 인정 주택가격의 60% 이하이고 선순위 채권과 내 보증금 합계가 주택가격의 90%(공시가격 126%) 이하이면 금액 기준을 충족합니다. 초과 시 잔금 동시 근저당 말소 특약이 필요합니다.',
    },
  ],
})

export const SPECIAL_TERMS_JSONLD = buildToolJsonLd({
  name: '전월세 계약 필수 특약 생성기 및 중개사 요청 문자',
  url: 'https://www.ipjuhae.com/tools/special-terms',
  description:
    '근저당 말소, 전세보증보험 미승인 시 계약금 반환, 잔금 익일 권리변동 금지 등 집 조건별 맞춤 특약과 정중한 카톡 요청 문자를 무료로 생성합니다.',
  faqs: [
    {
      question: '전세 계약서에 가장 중요한 필수 특약 3가지는 무엇인가요?',
      answer:
        '① 잔금 익일 24시까지 새로운 근저당·신탁 등 권리변동 금지, ② 임대인 국세·지방세 체납 없음 확인, ③ 전세보증보험 및 전세대출 미승인 시 계약 무효 및 계약금 전액 반환 특약이 핵심입니다.',
    },
    {
      question: '전세보증보험 가입이 거절됐을 때 계약금을 돌려받으려면 어떻게 해야 하나요?',
      answer:
        '계약서 특약에 임대인 또는 목적물 하자로 전세보증금반환보증 가입이 거절될 경우 계약을 무효로 하고 계약금 및 기지급금 전액을 즉시 반환한다는 문구를 명시해야 합니다.',
    },
    {
      question: '중개사나 집주인에게 특약을 어떻게 요청하는 것이 좋나요?',
      answer:
        '계약 당일 현장에서 급하게 요구하기보다 계약서 작성 전 미리 정중한 카톡·문자 메시지로 핵심 항목을 공유하고 합의해 두는 것이 안전합니다.',
    },
  ],
})
