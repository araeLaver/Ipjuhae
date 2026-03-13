import Image from 'next/image'
import { Home } from 'lucide-react'

interface ListingGalleryProps {
  photoUrls: string[]
  address: string
}

export function ListingGallery({ photoUrls, address }: ListingGalleryProps) {
  if (photoUrls.length === 0) {
    // Placeholder grid when no photos available
    return (
      <div
        className="grid grid-cols-2 gap-2 rounded-xl overflow-hidden"
        aria-label="매물 사진 없음"
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-muted flex items-center justify-center h-36 first:col-span-2 first:h-56"
          >
            <Home className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          </div>
        ))}
      </div>
    )
  }

  const [main, ...rest] = photoUrls

  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl overflow-hidden">
      {/* Main photo — full width */}
      <div className="relative col-span-2 h-56 bg-muted">
        <Image
          src={main}
          alt={`${address} 대표 사진`}
          fill
          sizes="(max-width: 768px) 100vw, 800px"
          className="object-cover"
          priority
        />
      </div>

      {/* Additional photos */}
      {rest.slice(0, 4).map((url, idx) => (
        <div key={idx} className="relative h-36 bg-muted">
          <Image
            src={url}
            alt={`${address} 사진 ${idx + 2}`}
            fill
            sizes="(max-width: 768px) 50vw, 400px"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  )
}
