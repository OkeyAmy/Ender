import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession, getUserById } from '@/lib/db'

export async function GET() {
  const sid = cookies().get('sid')?.value
  if (!sid) return NextResponse.json({ authenticated: false }, { status: 200 })
  const session = await getSession(sid)
  if (!session) return NextResponse.json({ authenticated: false }, { status: 200 })
  const user = await getUserById(session.userId)
  if (!user) return NextResponse.json({ authenticated: false }, { status: 200 })
  return NextResponse.json({ authenticated: true, user: { id: user.id, email: user.email } })
}

