import { supabase } from './supabase'
import type { School, ClassSession, ClassTeacher, ClassInterest, SchoolWithSession, ClassMapData } from './types'

export function isEnrolling(session: ClassSession | null): boolean {
  if (!session?.starts_on) return false
  return new Date(session.starts_on) > new Date()
}

export async function fetchClassMapData(userId: string | null): Promise<ClassMapData> {
  const { data: schools, error: schoolErr } = await supabase
    .from('schools')
    .select('*')

  if (schoolErr) throw schoolErr
  if (!schools?.length) return { schools: [], userInterests: [] }

  const schoolIds = schools.map((s: School) => s.id)

  const { data: sessions } = await supabase
    .from('class_sessions')
    .select('*')
    .in('school_id', schoolIds)
    .order('starts_on', { ascending: true, nullsFirst: false })

  const { data: teachers } = await supabase
    .from('class_teachers')
    .select('*')

  const allSessions: ClassSession[] = sessions ?? []
  const allTeachers: ClassTeacher[] = teachers ?? []

  const now = new Date()
  const schoolsWithSessions: SchoolWithSession[] = schools.map((school: School) => {
    const schoolSessions = allSessions.filter(s => s.school_id === school.id)
    const futureSession = schoolSessions.find(s => s.starts_on && new Date(s.starts_on) > now)
    const dropInSession = schoolSessions.find(s => s.drop_in)
    const nextSession = futureSession ?? dropInSession ?? schoolSessions[0] ?? null

    const sessionTeachers = nextSession
      ? allTeachers.filter(t => t.session_id === nextSession.id)
      : []

    return { ...school, next_session: nextSession, sessions: schoolSessions, teachers: sessionTeachers }
  })

  let userInterests: ClassInterest[] = []
  if (userId) {
    const { data } = await supabase
      .from('class_interest')
      .select('*')
      .eq('user_id', userId)
    userInterests = data ?? []
  }

  return { schools: schoolsWithSessions, userInterests }
}
