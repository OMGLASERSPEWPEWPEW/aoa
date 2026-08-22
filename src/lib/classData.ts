import { supabase } from './supabase'
import type { ClassSession, ClassTeacher, ClassInterest, SchoolWithSession, ClassMapData } from './types'

type SessionWithTeachers = ClassSession & { class_teachers: ClassTeacher[] }

export function isEnrolling(session: ClassSession | null): boolean {
  if (!session?.starts_on) return false
  return new Date(session.starts_on) > new Date()
}

export async function fetchClassMapData(userId: string | null): Promise<ClassMapData> {
  const schoolsPromise = supabase
    .from('schools')
    .select('*, class_sessions(*, class_teachers(*))')
    .eq('status', 'active')
    .order('starts_on', { referencedTable: 'class_sessions', ascending: true, nullsFirst: false })

  const interestsPromise = userId
    ? supabase.from('class_interest').select('*').eq('user_id', userId)
    : null

  const [{ data: schools, error: schoolErr }, interestsResult] = await Promise.all([
    schoolsPromise,
    interestsPromise ?? Promise.resolve(null),
  ])

  if (schoolErr) throw schoolErr
  if (!schools?.length) return { schools: [], userInterests: [] }

  const now = new Date()
  const schoolsWithSessions: SchoolWithSession[] = schools.map((school: any) => {
    const embedded: SessionWithTeachers[] = school.class_sessions ?? []
    const sessions: ClassSession[] = embedded.map(({ class_teachers: _, ...s }) => s)
    const futureSession = embedded.find(s => s.starts_on && new Date(s.starts_on) > now)
    const dropInSession = embedded.find(s => s.drop_in)
    const nextEmbedded = futureSession ?? dropInSession ?? embedded[0] ?? null
    const nextSession: ClassSession | null = nextEmbedded ? (() => { const { class_teachers: _, ...s } = nextEmbedded; return s })() : null

    const sessionTeachers: ClassTeacher[] = nextEmbedded?.class_teachers ?? []

    const { class_sessions: _, ...schoolFields } = school
    return { ...schoolFields, next_session: nextSession, sessions, teachers: sessionTeachers }
  })

  const userInterests: ClassInterest[] = interestsResult?.data ?? []

  return { schools: schoolsWithSessions, userInterests }
}
