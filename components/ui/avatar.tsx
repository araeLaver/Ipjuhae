import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AvatarProps {
  name?: string
  imageUrl?: string | null
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Avatar({ name, imageUrl, className, size = 'md' }: AvatarProps) {
  const initial = name ? name.charAt(0).toUpperCase() : '?'

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-lg',
    xl: 'h-24 w-24 text-2xl',
  }

  const imageSizes = {
    sm: 32,
    md: 40,
    lg: 56,
    xl: 96,
  }

  if (imageUrl) {
    return (
      <div
        className={cn(
          'relative rounded-full overflow-hidden bg-muted',
          sizeClasses[size],
          className
        )}
      >
        <Image
          src={imageUrl}
          alt={name || '프로필 이미지'}
          width={imageSizes[size]}
          height={imageSizes[size]}
          className="object-cover w-full h-full"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold',
        sizeClasses[size],
        className
      )}
    >
      {initial}
    </div>
  )
}
