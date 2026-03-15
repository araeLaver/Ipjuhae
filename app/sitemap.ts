import { MetadataRoute } from 'next'
import { query } from '@/lib/db'

const BASE_URL = 'https://www.ipjuhae.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/listings`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/match`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]

  let dynamicRoutes: MetadataRoute.Sitemap = []
  try {
    const listings = await query<{ id: number; updated_at: string }>(
      'SELECT id, updated_at FROM properties ORDER BY updated_at DESC LIMIT 500'
    )
    const profiles = await query<{ user_id: string; updated_at: string }>(
      "SELECT user_id, updated_at FROM profiles WHERE is_complete = true ORDER BY updated_at DESC LIMIT 500"
    )

    dynamicRoutes = [
      ...listings.map((l) => ({
        url: `${BASE_URL}/listings/${l.id}`,
        lastModified: new Date(l.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...profiles.map((p) => ({
        url: `${BASE_URL}/profile/${p.user_id}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ]
  } catch {
    // DB unavailable at build time — return static only
  }

  return [...staticRoutes, ...dynamicRoutes]
}
