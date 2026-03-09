import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ipjuhae.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/profile/', '/login', '/signup', '/privacy', '/terms'],
        disallow: ['/landlord/', '/messages/', '/onboarding/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
