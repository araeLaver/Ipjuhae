/** Only fixed episode numbers enter guide URLs; calculator amounts never do. */
export function depositGuidePath(title: string): string {
  const match = /^등기부 뜯어보기 (\d+)화\./.exec(title)
  const episode = match ? Number(match[1]) : 0
  return episode >= 1 && episode <= 12 ? `/guides/deungi/${episode}` : '/community'
}
