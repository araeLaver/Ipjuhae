import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/profile/', '/search/'],
        disallow: ['/api/', '/admin/', '/_next/'],
      },
    ],
    sitemap: 'https://rentme.kr/sitemap.xml',
  }
}
