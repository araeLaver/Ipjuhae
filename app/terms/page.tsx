import { Header } from '@/components/layout/header'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto p-6 animate-fade-in">
        <h1 className="text-2xl font-bold mb-6">이용약관</h1>

        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">제1조 (목적)</h2>
            <p>
              이 약관은 렌트미(이하 &quot;회사&quot;)가 제공하는 세입자 신뢰 프로필 서비스(이하 &quot;서비스&quot;)의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">제2조 (용어의 정의)</h2>
            <ol className="list-decimal pl-4 space-y-1">
              <li>&quot;서비스&quot;란 회사가 제공하는 세입자 신뢰 프로필 구축 및 공유 플랫폼을 말합니다.</li>
              <li>&quot;회원&quot;이란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.</li>
              <li>&quot;세입자 프로필&quot;이란 회원이 입력한 개인 정보 및 인증 정보로 구성된 신뢰 지표를 말합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">제3조 (약관의 효력)</h2>
            <p>
              본 약관은 서비스를 이용하고자 하는 모든 회원에게 적용됩니다. 회사는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지사항을 통해 고지합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">제4조 (회원가입 및 서비스 이용)</h2>
            <ol className="list-decimal pl-4 space-y-1">
              <li>회원가입은 이메일 또는 소셜 계정을 통해 가능합니다.</li>
              <li>회원은 정확한 정보를 제공해야 하며, 허위 정보 제공 시 서비스 이용이 제한될 수 있습니다.</li>
              <li>회원은 자신의 계정 정보를 안전하게 관리할 책임이 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">제5조 (서비스 제공 및 변경)</h2>
            <p>
              회사는 서비스의 내용을 변경할 수 있으며, 변경 시 사전에 공지합니다. 서비스의 일부 또는 전부를 운영상 필요에 의해 수정, 중단할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">제6조 (회원 탈퇴 및 자격 상실)</h2>
            <p>
              회원은 언제든지 서비스 내에서 탈퇴를 요청할 수 있으며, 회사는 즉시 처리합니다. 다음 사유 발생 시 회원 자격이 제한될 수 있습니다:
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>허위 정보 등록</li>
              <li>다른 회원의 서비스 이용 방해</li>
              <li>법령 또는 약관 위반</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">제7조 (면책 조항)</h2>
            <p>
              회사는 천재지변, 불가항력 등으로 인한 서비스 중단에 대해 책임을 지지 않습니다. 회원 간 거래 및 분쟁에 대해 회사는 중개자로서의 책임만을 부담합니다.
            </p>
          </section>

          <p className="text-xs text-muted-foreground pt-4 border-t">
            시행일: 2025년 1월 1일
          </p>
        </div>
      </main>
    </div>
  )
}
