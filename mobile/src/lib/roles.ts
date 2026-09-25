/** 웹과 앱이 함께 사용하는 계정 역할 라벨. Metro 루트 안에 두어 앱에서도 직접 사용한다. */
export const ROLE_LABELS: Record<string, string> = {
  tenant: '임차인',
  landlord: '임대인',
  broker: '공인중개사',
  admin: '운영자',
};

export type SignupRole = 'tenant' | 'landlord' | 'broker';
export const SIGNUP_ROLES: { value: SignupRole; label: string }[] = [
  { value: 'tenant', label: '세입자' },
  { value: 'landlord', label: '집주인' },
  { value: 'broker', label: ROLE_LABELS.broker },
];
