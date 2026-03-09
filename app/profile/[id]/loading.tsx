import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'

export default function Loading() {
  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-md animate-fade-in">
        <div className="space-y-6">
          <Skeleton className="h-6 w-32 mx-auto" />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </main>
    </div>
  )
}
