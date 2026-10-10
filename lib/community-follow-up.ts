export const QUESTION_KEY = 'ipjuhae.community.questions.v1'
export const QUESTION_CHANGED = 'ipjuhae-question-list-changed'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function readQuestions(raw: string | null): string[] {
  if (raw === null) return []
  const items = JSON.parse(raw)
  if (!Array.isArray(items) || items.length > 20 || items.some(id => typeof id !== 'string' || !uuid.test(id))) throw Error('INVALID_QUESTIONS')
  return [...new Set(items)]
}
export function rememberQuestion(id: string): boolean {
  try {
    if (!uuid.test(id)) return false
    const current = readQuestions(localStorage.getItem(QUESTION_KEY))
    localStorage.setItem(QUESTION_KEY, JSON.stringify([id, ...current.filter(value => value !== id)].slice(0, 20)))
    window.dispatchEvent(new Event(QUESTION_CHANGED))
    return true
  } catch { return false }
}
