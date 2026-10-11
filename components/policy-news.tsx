import { getPolicyNewsSnapshot } from '@/lib/policy-news-store'
import { PolicyNewsFeed } from './policy-news-feed'

export async function PolicyNews({ compact = false }: { compact?: boolean }) {
  return <PolicyNewsFeed initialSnapshot={await getPolicyNewsSnapshot()} compact={compact} />
}
