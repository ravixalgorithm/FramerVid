import { NextRequest, NextResponse } from 'next/server';
import { db } from '@framevid/db';
import { workspaceInvites, workspaceMembers } from '@framevid/db/schema';
import { getCurrentUser } from '../../../../lib/auth';
import { and, eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function GET(
  _req: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = params;

    // Check if user is an admin of this workspace
    const member = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, session.id)
      ),
    });

    if (!member || member.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    const invites = await db.query.workspaceInvites.findMany({
      where: eq(workspaceInvites.workspaceId, workspaceId),
      orderBy: (invites, { desc }) => [desc(invites.createdAt)],
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('List invites error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = params;
    const body = await req.json();
    const { email, role } = body;

    if (!email || !role || !['admin', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid email or role' }, { status: 400 });
    }

    // Check if user is an admin
    const member = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, session.id)
      ),
    });

    if (!member || member.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const [invite] = await db.insert(workspaceInvites).values({
      workspaceId,
      email: email.toLowerCase(),
      role,
      token,
      expiresAt,
    }).returning();

    // For now, log the invite URL to the console (Mocking email sending)
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const inviteUrl = `${origin}/invite/${token}`;
    console.log('\n--- INVITE GENERATED ---');
    console.log(`Send this link to ${email}: ${inviteUrl}`);
    console.log('------------------------\n');

    return NextResponse.json({ invite, inviteUrl });
  } catch (error) {
    console.error('Create invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
