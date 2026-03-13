export function track(event: string, props?: Record<string, unknown>) {
  console.log('[analytics]', event, props ?? {})
}
