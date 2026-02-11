import { Header } from '@/components/layout/header'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto p-6 animate-fade-in">
        <h1 className="text-2xl font-bold mb-6">개인정보처리방침</h1>

        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. 개인정보의 수집 및 이용 목적</h2>
            <p>회사는 다음 목적을 위해 개인정보를 수집·이용합니다:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>회원 가입 및 관리: 본인 확인, 서비스 이용</li>
              <li>세입자 신뢰 프로필 구축: 재직·소득·신용 인증, 레퍼런스 수집</li>
              <li>서비스 개선: 이용 통계, 서비스 분석</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. 수집하는 개인정보 항목</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>필수: 이메일, 비밀번호(이메일 가입 시), 회원 유형</li>
              <li>소셜 로그인 시: 소셜 계정 고유 ID, 이름, 프로필 이미지, 이메일</li>
              <li>본인 인증 시: 휴대폰 번호</li>
              <li>프로필 작성 시: 이름, 연령대, 가구 유형, 생활 패턴 정보</li>
              <li>인증 시: 재직 회사명, 소득 구간, 신용 등급, 서류 이미지</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. 개인정보의 보유 및 이용 기간</h2>
            <p>
              회원 탈퇴 시까지 보유하며, 탈퇴 후 즉시 파기합니다. 단, 관계 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>계약 또는 청약 철회에 관한 기록: 5년</li>
              <li>대금 결제 및 재화 공급에 관한 기록: 5년</li>
              <li>소비자 불만 또는 분쟁 처리 기록: 3년</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. 개인정보의 제3자 제공</h2>
            <p>
              회사는 원칙적으로 회원의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만, 집주인이 세입자 프로필을 열람하는 경우 회원이 공개 설정한 정보에 한해 제공됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. 개인정보의 파기</h2>
            <p>
              보유 기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 해당 개인정보를 파기합니다. 전자적 파일은 복구 불가능한 방법으로, 종이 문서는 분쇄 또는 소각하여 파기합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. 이용자의 권리</h2>
            <p>회원은 언제든지 다음 권리를 행사할 수 있습니다:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>개인정보 열람 요구</li>
              <li>오류 등에 대한 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리 정지 요구</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. 개인정보 보호책임자</h2>
            <p>
              개인정보 보호와 관련한 문의는 아래 연락처로 문의해 주시기 바랍니다.
            </p>
            <p>이메일: privacy@rentme.kr</p>
          </section>

          <p className="text-xs text-muted-foreground pt-4 border-t">
            시행일: 2025년 1월 1일
          </p>
        </div>
      </main>
    </div>
  )
}
