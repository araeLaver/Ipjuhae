export type HeaderUser = { email: string; userType: 'tenant' | 'landlord' | 'broker' | 'admin' }

export const roleLabels = { tenant: '세입자', landlord: '집주인', broker: '공인중개사', admin: '관리자' }

