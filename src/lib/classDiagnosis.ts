import type { ClassSession, SessionDiagnosis, SessionProblem } from './types'

export function sessionDiagnosis(s: ClassSession): SessionDiagnosis {
  if (!s.starts_on && !s.schedule) {
    return {
      problems: ['wont_show'],
      label: "NO SCHEDULE · NO START · WON’T SHOW",
      severity: 'danger',
    }
  }

  const problems: SessionProblem[] = []
  if (s.price == null) problems.push('no_price')
  if (s.level == null) problems.push('no_level')
  if (!s.instructor_name) problems.push('no_instructor')

  if (problems.length === 0) {
    return { problems: [], label: null, severity: 'neutral' }
  }

  const segments: string[] = []
  if (problems.includes('no_price')) segments.push('NO PRICE')
  if (problems.includes('no_level')) segments.push('NO LEVEL')
  if (problems.includes('no_instructor')) segments.push('NO INSTRUCTOR')

  const severity = problems.includes('no_price') ? 'warn' as const : 'neutral' as const

  return {
    problems,
    label: segments.slice(0, 3).join(' · '),
    severity,
  }
}
