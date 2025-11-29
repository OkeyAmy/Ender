import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession, getProjectsByUser, upsertProject } from '@/lib/db'

export async function GET() {
  const sid = cookies().get('sid')?.value
  if (!sid) return NextResponse.json({ projects: [] })
  const session = await getSession(sid)
  if (!session) return NextResponse.json({ projects: [] })
  const projects = await getProjectsByUser(session.userId)
  return NextResponse.json({ projects })
}

export async function POST(req: Request) {
  const sid = cookies().get('sid')?.value
  if (!sid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = await getSession(sid)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { sandboxId, url, name } = await req.json()
  if (!sandboxId || !url) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const project = await upsertProject(session.userId, sandboxId, url, name)
  return NextResponse.json({ success: true, project })
}

