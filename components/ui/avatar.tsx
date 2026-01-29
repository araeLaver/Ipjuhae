import { cn } from '@/lib/utils'

interface AvatarProps {
  name?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Avatar({ name, className, size = 'md' }: AvatarProps) {
  const initial = name ? name.charAt(0).toUpperCase() : '?'

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-lg',
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
