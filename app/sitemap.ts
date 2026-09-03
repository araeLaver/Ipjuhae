import { MetadataRoute } from 'next'

const BASE_URL = 'https://www.ipjuhae.com'

// 사전 대기열 모집 기간: 랜딩과 정책 페이지만 노출한다.
// 서비스 공개 시 이전 라우트(listings/matches/properties 등)를 복원할 것.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]
}
