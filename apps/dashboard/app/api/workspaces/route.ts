import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, workspaces, workspaceMembers } from '@framevid/db';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser } from '../../lib/auth';

const createSchema = z.object({
  name: z.string().min(1).max(255),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
});

async function assertWorkspaceAdmin(userId: string, workspaceId: string) {
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.role, 'admin')
      )
    )
    .limit(1);
  return Boolean(membership);
}

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const rows = await db
      .select({
        workspace: workspaces,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId, user.id));

    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.workspace.id,
        name: r.workspace.name,
        slug: r.workspace.slug,
        plan: r.workspace.plan,
        role: r.role,
        createdAt: r.workspace.createdAt,
      })),
    });
  } catch (error: unknown) {
    console.error('GET workspaces failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Validation error', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { name } = parsed.data;
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).substring(2, 6)}`;

    // Create the workspace
    const [newWorkspace] = await db
      .insert(workspaces)
      .values({
        name,
        slug,
        ownerId: user.id,
        plan: 'free',
      })
      .returning();

    // Create membership as admin
    await db.insert(workspaceMembers).values({
      workspaceId: newWorkspace.id,
      userId: user.id,
      role: 'admin',
    });

    return NextResponse.json({
      data: {
        id: newWorkspace.id,
        name: newWorkspace.name,
        slug: newWorkspace.slug,
        plan: newWorkspace.plan,
        role: 'admin',
        createdAt: newWorkspace.createdAt,
      },
    });
  } catch (error: unknown) {
    console.error('POST workspaces failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Validation error', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { id, name } = parsed.data;

    // Check if user is an admin of the workspace
    if (!(await assertWorkspaceAdmin(user.id, id))) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const [updated] = await db
      .update(workspaces)
      .set({
        name,
      })
      .where(eq(workspaces.id, id))
      .returning();

    return NextResponse.json({
      data: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        plan: updated.plan,
        createdAt: updated.createdAt,
      },
    });
  } catch (error: unknown) {
    console.error('PATCH workspaces failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Workspace ID required', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    // Verify workspace exists and belongs to the user (owner or admin)
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    if (workspace.ownerId !== user.id && !(await assertWorkspaceAdmin(user.id, id))) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    // Deleting the workspace. cascade deletes folders, video_folders, memberships, etc.
    await db.delete(workspaces).where(eq(workspaces.id, id));

    return NextResponse.json({
      data: {
        success: true,
        message: 'Workspace deleted successfully.',
      },
    });
  } catch (error: unknown) {
    console.error('DELETE workspaces failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
