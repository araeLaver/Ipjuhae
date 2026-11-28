import { describe, it, expect } from 'vitest'
import {
  CHECK_TOOL_JSONLD,
  HUG_TOOL_JSONLD,
  SPECIAL_TERMS_JSONLD,
} from '@/lib/seo-jsonld'

describe('SEO JSON-LD structured data for core tools', () => {
  it.each([
    ['check', CHECK_TOOL_JSONLD, 'https://www.ipjuhae.com/check'],
    ['hug-check', HUG_TOOL_JSONLD, 'https://www.ipjuhae.com/tools/hug-check'],
    ['special-terms', SPECIAL_TERMS_JSONLD, 'https://www.ipjuhae.com/tools/special-terms'],
  ])('builds valid WebApplication + FAQPage schema for %s', (_slug, schema, expectedUrl) => {
    expect(schema['@context']).toBe('https://schema.org')
    expect(schema['@graph']).toHaveLength(2)

    const [appNode, faqNode] = schema['@graph'] as unknown as [Record<string, any>, Record<string, any>]
    expect(appNode['@type']).toBe('WebApplication')
    expect(appNode.url).toBe(expectedUrl)
    expect(appNode.offers.price).toBe('0')

    expect(faqNode['@type']).toBe('FAQPage')
    expect(faqNode.mainEntity.length).toBeGreaterThanOrEqual(3)
    for (const qa of faqNode.mainEntity) {
      expect(qa['@type']).toBe('Question')
      expect(qa.name.length).toBeGreaterThan(5)
      expect(qa.acceptedAnswer['@type']).toBe('Answer')
      expect(qa.acceptedAnswer.text.length).toBeGreaterThan(20)
    }

    // Must serialize cleanly without throwing
    expect(() => JSON.stringify(schema)).not.toThrow()
  })
})
