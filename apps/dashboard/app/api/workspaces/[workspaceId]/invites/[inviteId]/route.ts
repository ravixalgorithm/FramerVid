import { NextRequest, NextResponse } from 'next/server';
import { db } from '@framevid/db';
import { workspaceInvites, workspaceMembers } from '@framevid/db/schema';
import { getCurrentUser } from '../../../../../lib/auth';
import { and, eq } from 'drizzle-orm';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { workspaceId: string; inviteId: string } }
) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId, inviteId } = params;

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

    await db
      .delete(workspaceInvites)
      .where(and(eq(workspaceInvites.id, inviteId), eq(workspaceInvites.workspaceId, workspaceId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
