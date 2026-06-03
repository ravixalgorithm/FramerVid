import { NextRequest, NextResponse } from 'next/server';
import { db } from '@framevid/db';
import { workspaceMembers, users } from '@framevid/db/schema';
import { getCurrentUser } from '../../../../lib/auth';
import { and, eq } from 'drizzle-orm';

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

    // Verify current user has access (any role can list members)
    const membership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, session.id)
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch members with user details
    const members = await db
      .select({
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        invitedAt: workspaceMembers.invitedAt,
        acceptedAt: workspaceMembers.acceptedAt,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(workspaceMembers.invitedAt);

    return NextResponse.json({ members });
  } catch (error) {
    console.error('List members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
