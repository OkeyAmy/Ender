import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserByEmail, createUser, createSession } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export async function POST(req: Request) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
  const existing = await getUserByEmail(email)
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  const user = await createUser(email, hashPassword(password))
  const session = await createSession(user.id)
  const res = NextResponse.json({ success: true, user: { id: user.id, email: user.email } })
  res.headers.set('Set-Cookie', `sid=${session.id}; HttpOnly; Path=/; SameSite=Lax; Max-Age=259200`)
  return res
}

