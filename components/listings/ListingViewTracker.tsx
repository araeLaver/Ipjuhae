'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics-client'

export function ListingViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    trackEvent('listing_viewed', { listing_id: listingId })
  }, [listingId])

  return null
}
