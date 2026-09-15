/**
 * 입주해 브랜드 색.
 *
 * 웹(`app/globals.css`)과 같은 값을 쓴다 — 앱과 웹이 다른 색이면 같은 서비스로 보이지 않는다.
 * 감빛 오렌지 #f0663f, 앰버 #e8a33d, 버터 #fff3dc, 크림 #fbf6ef, 잉크 #262220.
 *
 * 화면에서 색을 직접 쓰지 말고 여기서 가져다 쓴다.
 */
export const colors = {
  /** 버튼·강조. 흰 글자를 얹는 용도. */
  primary: '#F0663F',
  /** 눌린 상태·비활성 채움. */
  primaryMuted: '#F4977B',
  /**
   * 밝은 바탕 위의 글자·아이콘에 쓰는 진한 변형.
   * primary는 흰 바탕에서 작은 글자로 쓰기엔 대비가 모자란다.
   */
  primaryInk: '#C2451F',
  /** 보조 강조(배지·점수). */
  amber: '#E8A33D',

  /** 연한 강조 바탕(태그·배지). */
  tint: '#FFF3DC',
  /** 화면 바탕. */
  background: '#FBF6EF',
  /** 카드·입력창 바탕. */
  surface: '#FFFFFF',
  /** 카드 위 한 단계 내려앉은 바탕. */
  sunken: '#F3EEE6',

  /** 본문 글자. */
  ink: '#262220',
  /** 보조 글자. */
  muted: '#6B625C',
  /** 더 흐린 글자·플레이스홀더. */
  faint: '#9A8F87',
  /** 경계선. */
  line: '#E7DFD4',

  success: '#3F7A5E',
  successTint: '#E3EFE9',
  warning: '#B7801F',
  warningTint: '#FBF1D8',
  danger: '#C0392B',
  dangerTint: '#F7E8E6',

  white: '#FFFFFF',
} as const

export type Colors = typeof colors
