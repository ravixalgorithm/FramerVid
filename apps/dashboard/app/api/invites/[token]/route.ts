import { NextRequest, NextResponse } from 'next/server';
import { db } from '@framevid/db';
import { workspaceInvites, workspaceMembers, workspaces } from '@framevid/db/schema';
import { getCurrentUser } from '../../../lib/auth';
import { eq, and } from 'drizzle-orm';

// Public route to fetch invite details to display on the accept page
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    const invite = await db.query.workspaceInvites.findFirst({
      where: eq(workspaceInvites.token, token),
      with: {
        workspace: true,
      },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 });
    }

    if (new Date() > new Date(invite.expiresAt)) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 400 });
    }

    // Fetch workspace details manually since we didn't define relations in schema.ts
    // Wait, Drizzle query API needs relations defined, which we might not have.
    // Let's do a join to be safe.
    const results = await db
      .select({
        invite: workspaceInvites,
        workspace: workspaces,
      })
      .from(workspaceInvites)
      .leftJoin(workspaces, eq(workspaceInvites.workspaceId, workspaces.id))
      .where(eq(workspaceInvites.token, token))
      .limit(1);

    if (results.length === 0) {
      return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 });
    }

    const data = results[0];

    return NextResponse.json({
      invite: data.invite,
      workspace: data.workspace,
    });
  } catch (error) {
    console.error('Get invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Authenticated route to accept the invite
export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = params;

    const [invite] = await db
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.token, token))
      .limit(1);

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 });
    }

    if (new Date() > new Date(invite.expiresAt)) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 400 });
    }

    // Check if user is already a member
    const existingMember = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, invite.workspaceId),
        eq(workspaceMembers.userId, session.id)
      ),
    });

    if (!existingMember) {
      await db.insert(workspaceMembers).values({
        workspaceId: invite.workspaceId,
        userId: session.id,
        role: invite.role,
        acceptedAt: new Date(),
      });
    }

    // Delete the invite so it can't be used again
    await db.delete(workspaceInvites).where(eq(workspaceInvites.id, invite.id));

    return NextResponse.json({ success: true, workspaceId: invite.workspaceId });
  } catch (error) {
    console.error('Accept invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
