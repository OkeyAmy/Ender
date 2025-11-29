import { NextResponse } from 'next/server'
import { getUserByEmail, createSession } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'

export async function POST(req: Request) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
  const user = await getUserByEmail(email)
  if (!user || !verifyPassword(password, user.passwordHash)) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  const session = await createSession(user.id)
  const res = NextResponse.json({ success: true, user: { id: user.id, email: user.email } })
  res.headers.set('Set-Cookie', `sid=${session.id}; HttpOnly; Path=/; SameSite=Lax; Max-Age=259200`)
  return res
}

