import sharp from 'sharp'

const width = 2400
const height = 1260

const brand = {
  orange: '#f45f3b',
  orangeDark: '#c84020',
  ink: '#201311',
  muted: '#5f504b',
  peach: '#ffe8df',
  peachSoft: '#fff8f5',
}

const escapeXml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const pill = (x, y, text) => `
  <g filter="url(#softShadow)">
    <rect x="${x}" y="${y}" width="360" height="118" rx="58" fill="#fffdfb" stroke="#ffd5c8" stroke-width="2"/>
    <text x="${x + 180}" y="${y + 76}" text-anchor="middle" class="pill">${escapeXml(text)}</text>
  </g>`

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${brand.peachSoft}"/>
      <stop offset="52%" stop-color="#fff0ea"/>
      <stop offset="100%" stop-color="${brand.peach}"/>
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="22%" r="55%">
      <stop offset="0%" stop-color="#ffd0bf" stop-opacity="0.9"/>
      <stop offset="62%" stop-color="#ffd0bf" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#ffd0bf" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-25%" y="-45%" width="150%" height="210%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#d45f3b" flood-opacity="0.14"/>
    </filter>
    <style>
      .brand { font-family: AppleGothic, Arial, sans-serif; font-size: 74px; font-weight: 700; fill: ${brand.orange}; }
      .headline { font-family: AppleGothic, Arial, sans-serif; font-size: 136px; font-weight: 800; fill: ${brand.ink}; }
      .headlineAccent { fill: ${brand.orange}; }
      .subtitle { font-family: AppleGothic, Arial, sans-serif; font-size: 58px; font-weight: 500; fill: ${brand.muted}; }
      .pill { font-family: AppleGothic, Arial, sans-serif; font-size: 48px; font-weight: 700; fill: ${brand.orangeDark}; }
    </style>
  </defs>

  <rect width="2400" height="1260" fill="url(#bg)"/>
  <rect width="2400" height="1260" fill="url(#glow)"/>

  <g transform="translate(202 162)">
    <rect width="194" height="194" rx="40" fill="${brand.orange}"/>
    <path d="M97 44 L48 86 V146 Q48 153 55 153 H139 Q146 153 146 146 V86 Z" fill="white"/>
    <rect x="85" y="115" width="26" height="38" rx="3" fill="${brand.orange}"/>
    <circle cx="141" cy="58" r="18" fill="${brand.orange}" stroke="white" stroke-width="5"/>
    <path d="M132 58 L139 65 L151 49" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <text x="442" y="284" class="brand">입주해</text>

  <text x="202" y="540" class="headline">
    안전한 임대의 <tspan class="headlineAccent">시작</tspan>
  </text>

  <text x="202" y="728" class="subtitle">
    <tspan x="202" dy="0">실제 등록된 매물 데이터로 임대 과정을 빠르게</tspan>
    <tspan x="202" dy="84">탐색하고 매칭하세요.</tspan>
  </text>

  ${pill(202, 986, '검증된 매물')}
  ${pill(598, 986, '신뢰 프로필')}
  ${pill(994, 986, '빠른 매칭')}
</svg>`

await sharp(Buffer.from(svg))
  .flatten({ background: brand.peachSoft })
  .png({ compressionLevel: 9 })
  .toFile('public/og-image.png')
