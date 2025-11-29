import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { deleteSession } from '@/lib/db'

export async function POST() {
  const sid = (await cookies()).get('sid')?.value
  if (sid) await deleteSession(sid)
  const res = NextResponse.json({ success: true })
  res.headers.set('Set-Cookie', `sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`)
  return res
}

