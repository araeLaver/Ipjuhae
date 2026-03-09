import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ipjuhae.com'

  // Static public pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ]

  // Dynamic: public tenant profiles from DB
  let profilePages: MetadataRoute.Sitemap = []
  try {
    const { query } = await import('@/lib/db')
    const profiles = await query<{ id: string; updated_at: Date }>(
      'SELECT id, updated_at FROM profiles WHERE is_complete = true ORDER BY updated_at DESC LIMIT 5000'
    )
    profilePages = profiles.map((p) => ({
      url: `${baseUrl}/profile/${p.id}`,
      lastModified: p.updated_at,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
  } catch {
    // DB not available at build time — skip dynamic pages
  }

  return [...staticPages, ...profilePages]
}
